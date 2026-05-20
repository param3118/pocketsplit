const { dbQuery } = require('../db/database');

/**
 * Compute net balances for all members of a group.
 * Balance = money_paid - money_owed + settlements_received - settlements_paid
 * Positive → user should RECEIVE money
 * Negative → user OWES money
 * 
 * All amounts in integer paise/cents.
 */
async function computeBalances(groupId) {
  // Get group members
  const members = await dbQuery(
    `SELECT u.id, u.name FROM users u
     JOIN group_members gm ON gm.user_id = u.id
     WHERE gm.group_id = ?`,
    [groupId]
  );

  if (!members.length) return [];

  const balanceMap = {};
  members.forEach(m => { balanceMap[m.id] = 0; });

  // Active (non-deleted) expenses
  const expenses = await dbQuery(
    `SELECT e.id, e.paid_by, e.total_amount
     FROM expenses e
     WHERE e.group_id = ? AND e.is_deleted = 0`,
    [groupId]
  );

  for (const exp of expenses) {
    // Payer gets credit for paying
    if (balanceMap.hasOwnProperty(exp.paid_by)) {
      balanceMap[exp.paid_by] += exp.total_amount;
    }

    // Deduct each participant's share
    const shares = await dbQuery(
      `SELECT es.user_id, es.share_amount
       FROM expense_shares es
       WHERE es.expense_id = ?`,
      [exp.id]
    );

    for (const s of shares) {
      if (balanceMap.hasOwnProperty(s.user_id)) {
        balanceMap[s.user_id] -= s.share_amount;
      }
    }
  }

  // Settlements
  const settlements = await dbQuery(
    `SELECT payer_id, receiver_id, amount
     FROM settlements
     WHERE group_id = ?`,
    [groupId]
  );

  for (const sett of settlements) {
    if (balanceMap.hasOwnProperty(sett.payer_id)) balanceMap[sett.payer_id] += sett.amount;
    if (balanceMap.hasOwnProperty(sett.receiver_id)) balanceMap[sett.receiver_id] -= sett.amount;
  }

  return members.map(m => ({
    userId: m.id,
    name: m.name,
    balance: balanceMap[m.id] || 0
  }));
}

/**
 * Debt Simplification using greedy net-balance algorithm.
 * Returns minimal list of transactions to settle all debts.
 */
async function simplifyDebts(groupId) {
  const balances = await computeBalances(groupId);

  // Filter out zero balances
  const nonZero = balances.filter(b => b.balance !== 0);

  if (!nonZero.length) return [];

  // Debtors owe money (negative), creditors should receive (positive)
  const debtors = nonZero
    .filter(b => b.balance < 0)
    .map(b => ({ ...b, balance: b.balance }))
    .sort((a, b) => a.balance - b.balance); // most negative first

  const creditors = nonZero
    .filter(b => b.balance > 0)
    .map(b => ({ ...b }))
    .sort((a, b) => b.balance - a.balance); // most positive first

  const transactions = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(-debtor.balance, creditor.balance);

    if (amount > 0) {
      transactions.push({
        from: { id: debtor.userId, name: debtor.name },
        to: { id: creditor.userId, name: creditor.name },
        amount
      });
    }

    debtor.balance += amount;
    creditor.balance -= amount;

    if (debtor.balance === 0) i++;
    if (creditor.balance === 0) j++;
  }

  return transactions;
}

module.exports = { computeBalances, simplifyDebts };