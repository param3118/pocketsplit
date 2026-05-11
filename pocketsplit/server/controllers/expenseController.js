const { dbQuery, dbGet, dbRun } = require('../db/database');
const { generateTxnId } = require('../services/txnIdService');
const {
  validateAmount,
  validateSplitType,
  validateShares,
  validateNonEmpty
} = require('../utils/validators');

/**
 * Equal split with integer-safe remainder distribution.
 * Distributes remainder paise to first N participants.
 */
function computeEqualShares(totalAmount, participants) {
  const n = participants.length;
  const base = Math.floor(totalAmount / n);
  const remainder = totalAmount - base * n;

  return participants.map((userId, i) => ({
    user_id: userId,
    share_amount: i < remainder ? base + 1 : base
  }));
}

// GET /expenses/:groupId
async function getExpenses(req, res) {
  const { groupId } = req.params;

  const group = await dbGet(`SELECT id FROM groups_table WHERE id = ?`, [groupId]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  const expenses = await dbQuery(
    `SELECT e.id, e.transaction_id, e.title, e.total_amount, e.split_type,
            e.note, e.created_at, e.paid_by,
            u.name as paid_by_name
     FROM expenses e
     JOIN users u ON u.id = e.paid_by
     WHERE e.group_id = ? AND e.is_deleted = 0
     ORDER BY e.created_at DESC`,
    [groupId]
  );

  // Attach shares and payment statuses
  const enriched = await Promise.all(expenses.map(async exp => {
    const shares = await dbQuery(
      `SELECT es.user_id, u.name, es.share_amount,
              COALESCE(eps.is_paid, 0) as is_paid, eps.paid_at
       FROM expense_shares es
       JOIN users u ON u.id = es.user_id
       LEFT JOIN expense_payment_status eps
         ON eps.expense_id = es.expense_id AND eps.user_id = es.user_id
       WHERE es.expense_id = ?`,
      [exp.id]
    );
    const allPaid = shares.length > 0 && shares.every(s => s.is_paid);
    const somePaid = shares.some(s => s.is_paid);
    return {
      ...exp,
      shares,
      status: allPaid ? 'paid' : somePaid ? 'partial' : 'pending'
    };
  }));

  res.json({ success: true, data: enriched });
}

// GET /expenses/detail/:id
async function getExpenseDetail(req, res) {
  const exp = await dbGet(
    `SELECT e.*, u.name as paid_by_name FROM expenses e
     JOIN users u ON u.id = e.paid_by
     WHERE e.id = ? AND e.is_deleted = 0`,
    [req.params.id]
  );
  if (!exp) return res.status(404).json({ success: false, error: 'Expense not found' });

  const shares = await dbQuery(
    `SELECT es.user_id, u.name, es.share_amount,
            COALESCE(eps.is_paid, 0) as is_paid, eps.paid_at
     FROM expense_shares es
     JOIN users u ON u.id = es.user_id
     LEFT JOIN expense_payment_status eps
       ON eps.expense_id = es.expense_id AND eps.user_id = es.user_id
     WHERE es.expense_id = ?`,
    [req.params.id]
  );

  res.json({ success: true, data: { ...exp, shares } });
}

// POST /expenses
async function createExpense(req, res) {
  const { group_id, title, total_amount, paid_by, split_type, note, participants, shares, date } = req.body;

  // Validations
  const titleErr = validateNonEmpty(title, 'title');
  if (titleErr) return res.status(400).json({ success: false, error: titleErr });

  const amtErr = validateAmount(total_amount);
  if (amtErr) return res.status(400).json({ success: false, error: amtErr });

  const splitErr = validateSplitType(split_type);
  if (splitErr) return res.status(400).json({ success: false, error: splitErr });

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({ success: false, error: 'participants array is required and non-empty' });
  }

  // Verify group
  const group = await dbGet(`SELECT id FROM groups_table WHERE id = ?`, [group_id]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  // Verify payer is a group member
  const payer = await dbGet(
    `SELECT u.id FROM users u JOIN group_members gm ON gm.user_id = u.id
     WHERE gm.group_id = ? AND u.id = ?`,
    [group_id, paid_by]
  );
  if (!payer) return res.status(400).json({ success: false, error: 'Payer is not a member of the group' });

  // Verify all participants are group members
  for (const uid of participants) {
    const p = await dbGet(
      `SELECT u.id FROM users u JOIN group_members gm ON gm.user_id = u.id
       WHERE gm.group_id = ? AND u.id = ?`,
      [group_id, uid]
    );
    if (!p) return res.status(400).json({ success: false, error: `User ${uid} is not a member of the group` });
  }

  // Compute shares
  let computedShares;
  if (split_type === 'equal') {
    computedShares = computeEqualShares(total_amount, participants);
  } else {
    // unequal
    if (!shares || !Array.isArray(shares) || shares.length === 0) {
      return res.status(400).json({ success: false, error: 'shares array required for unequal split' });
    }
    const sharesErr = validateShares(total_amount, shares);
    if (sharesErr) return res.status(400).json({ success: false, error: sharesErr });
    computedShares = shares.map(s => ({ user_id: s.user_id, share_amount: s.share_amount }));
  }

  const txnId = await generateTxnId('EXP');

  const createdAt = date || new Date().toISOString();

  await dbRun(
    `INSERT INTO expenses (transaction_id, group_id, title, total_amount, paid_by, split_type, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [txnId, group_id, title.trim(), total_amount, paid_by, split_type, note || null, createdAt]
  );

  const expense = await dbGet(`SELECT * FROM expenses ORDER BY id DESC LIMIT 1`);

  for (const s of computedShares) {
    await dbRun(
      `INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES (?, ?, ?)`,
      [expense.id, s.user_id, s.share_amount]
    );
    await dbRun(
      `INSERT INTO expense_payment_status (expense_id, user_id, is_paid)
       VALUES (?, ?, ?)`,
      [expense.id, s.user_id, s.user_id === paid_by ? 1 : 0]
    );
  }

  // Update paid_at for payer
  await dbRun(
    `UPDATE expense_payment_status SET paid_at = datetime('now') WHERE expense_id = ? AND user_id = ?`,
    [expense.id, paid_by]
  );

  res.status(201).json({ success: true, data: expense });
}

// PUT /expenses/:id
async function updateExpense(req, res) {
  const { title, total_amount, paid_by, split_type, note, participants, shares, date } = req.body;

  const existing = await dbGet(`SELECT * FROM expenses WHERE id = ? AND is_deleted = 0`, [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, error: 'Expense not found' });

  const titleErr = validateNonEmpty(title, 'title');
  if (titleErr) return res.status(400).json({ success: false, error: titleErr });

  const amtErr = validateAmount(total_amount);
  if (amtErr) return res.status(400).json({ success: false, error: amtErr });

  const splitErr = validateSplitType(split_type);
  if (splitErr) return res.status(400).json({ success: false, error: splitErr });

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({ success: false, error: 'participants array required' });
  }

  let computedShares;
  if (split_type === 'equal') {
    computedShares = computeEqualShares(total_amount, participants);
  } else {
    if (!shares || !Array.isArray(shares)) {
      return res.status(400).json({ success: false, error: 'shares required for unequal split' });
    }
    const sharesErr = validateShares(total_amount, shares);
    if (sharesErr) return res.status(400).json({ success: false, error: sharesErr });
    computedShares = shares;
  }

  // Update expense
  if (date) {
    await dbRun(
      `UPDATE expenses SET title=?, total_amount=?, paid_by=?, split_type=?, note=?, created_at=? WHERE id=?`,
      [title.trim(), total_amount, paid_by, split_type, note || null, date, req.params.id]
    );
  } else {
    await dbRun(
      `UPDATE expenses SET title=?, total_amount=?, paid_by=?, split_type=?, note=? WHERE id=?`,
      [title.trim(), total_amount, paid_by, split_type, note || null, req.params.id]
    );
  }

  // Delete old shares and payment statuses
  await dbRun(`DELETE FROM expense_shares WHERE expense_id = ?`, [req.params.id]);
  await dbRun(`DELETE FROM expense_payment_status WHERE expense_id = ?`, [req.params.id]);

  for (const s of computedShares) {
    await dbRun(`INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES (?,?,?)`,
      [req.params.id, s.user_id, s.share_amount]);
    await dbRun(`INSERT INTO expense_payment_status (expense_id, user_id, is_paid) VALUES (?,?,?)`,
      [req.params.id, s.user_id, s.user_id === paid_by ? 1 : 0]);
  }

  await dbRun(
    `UPDATE expense_payment_status SET paid_at = datetime('now') WHERE expense_id = ? AND user_id = ?`,
    [req.params.id, paid_by]
  );

  const updated = await dbGet(`SELECT * FROM expenses WHERE id = ?`, [req.params.id]);
  res.json({ success: true, data: updated });
}

// DELETE /expenses/:id  (soft delete)
async function deleteExpense(req, res) {
  const existing = await dbGet(`SELECT id FROM expenses WHERE id = ? AND is_deleted = 0`, [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, error: 'Expense not found' });

  await dbRun(`UPDATE expenses SET is_deleted = 1 WHERE id = ?`, [req.params.id]);

  res.json({ success: true, message: 'Expense deleted (soft) successfully' });
}

// POST /expenses/:id/mark-paid
async function markPaid(req, res) {
  const { user_id } = req.body;
  const { id: expenseId } = req.params;

  if (!user_id) return res.status(400).json({ success: false, error: 'user_id is required' });

  const expense = await dbGet(`SELECT id FROM expenses WHERE id = ? AND is_deleted = 0`, [expenseId]);
  if (!expense) return res.status(404).json({ success: false, error: 'Expense not found' });

  const paymentStatus = await dbGet(
    `SELECT id, is_paid FROM expense_payment_status WHERE expense_id = ? AND user_id = ?`,
    [expenseId, user_id]
  );

  if (!paymentStatus) return res.status(404).json({ success: false, error: 'User not a participant in this expense' });

  // One-way state transition: PENDING → PAID only
  if (paymentStatus.is_paid) {
    return res.status(400).json({ success: false, error: 'User is already marked as paid. Cannot reverse.' });
  }

  await dbRun(
    `UPDATE expense_payment_status SET is_paid = 1, paid_at = datetime('now') WHERE expense_id = ? AND user_id = ?`,
    [expenseId, user_id]
  );

  res.json({ success: true, message: 'Marked as paid successfully' });
}

module.exports = { getExpenses, getExpenseDetail, createExpense, updateExpense, deleteExpense, markPaid };