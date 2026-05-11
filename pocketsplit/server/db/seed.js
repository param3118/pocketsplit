const { dbQuery, dbGet, dbRun } = require('./database');
const { generateTxnId } = require('../services/txnIdService');

async function seed() {
  // Check if already seeded
  const existing = await dbGet(`SELECT id FROM groups_table LIMIT 1`);
  if (existing) {
    console.log('[Seed] Already seeded. Skipping.');
    return;
  }

  console.log('[Seed] Seeding demo data...');

  // Create group
  await dbRun(`INSERT INTO groups_table (name) VALUES ('Flat 4B - Rooftop Squad')`);
  const group = await dbGet(`SELECT * FROM groups_table ORDER BY id DESC LIMIT 1`);

  // Create users
  const memberNames = ['Param', 'Rahul', 'Aman', 'Priya'];
  const memberIds = [];

  for (const name of memberNames) {
    await dbRun(`INSERT INTO users (name) VALUES (?)`, [name]);
    const user = await dbGet(`SELECT id FROM users ORDER BY id DESC LIMIT 1`);
    memberIds.push(user.id);
    await dbRun(`INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`, [group.id, user.id]);
  }

  const [paramId, rahulId, amanId, priyaId] = memberIds;

  // Helper: equal split with remainder distribution
  function equalShares(total, participants) {
    const n = participants.length;
    const base = Math.floor(total / n);
    const rem = total - base * n;
    return participants.map((uid, i) => ({ user_id: uid, share_amount: i < rem ? base + 1 : base }));
  }

  async function insertExpense({ title, totalAmount, paidBy, splitType, note, participants, customShares }) {
    const txnId = await generateTxnId('EXP');
    await dbRun(
      `INSERT INTO expenses (transaction_id, group_id, title, total_amount, paid_by, split_type, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [txnId, group.id, title, totalAmount, paidBy, splitType, note || null]
    );
    const exp = await dbGet(`SELECT * FROM expenses ORDER BY id DESC LIMIT 1`);

    const shares = splitType === 'equal'
      ? equalShares(totalAmount, participants)
      : customShares;

    for (const s of shares) {
      await dbRun(`INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES (?,?,?)`,
        [exp.id, s.user_id, s.share_amount]);
      const isPaid = s.user_id === paidBy ? 1 : 0;
      await dbRun(`INSERT INTO expense_payment_status (expense_id, user_id, is_paid, paid_at) VALUES (?,?,?,?)`,
        [exp.id, s.user_id, isPaid, isPaid ? new Date().toISOString() : null]);
    }
    return exp;
  }

  // Expense 1: Grocery run — paid by Param, all 4 split equally
  const exp1 = await insertExpense({
    title: 'Monthly Grocery Run',
    totalAmount: 480000, // ₹4800
    paidBy: paramId,
    splitType: 'equal',
    participants: [paramId, rahulId, amanId, priyaId],
    note: 'Big restock from DMart'
  });

  // Mark Rahul paid on exp1
  await dbRun(
    `UPDATE expense_payment_status SET is_paid=1, paid_at=datetime('now') WHERE expense_id=? AND user_id=?`,
    [exp1.id, rahulId]
  );

  // Expense 2: Netflix + Prime — paid by Rahul
  await insertExpense({
    title: 'Netflix + Amazon Prime',
    totalAmount: 119900, // ₹1199
    paidBy: rahulId,
    splitType: 'equal',
    participants: [paramId, rahulId, amanId, priyaId],
    note: 'Monthly streaming subscriptions'
  });

  // Expense 3: Pizza night — unequal split
  await insertExpense({
    title: 'Pizza Night 🍕',
    totalAmount: 240000, // ₹2400
    paidBy: amanId,
    splitType: 'unequal',
    participants: [paramId, rahulId, amanId, priyaId],
    customShares: [
      { user_id: paramId, share_amount: 70000 },
      { user_id: rahulId, share_amount: 70000 },
      { user_id: amanId, share_amount: 50000 },
      { user_id: priyaId, share_amount: 50000 }
    ],
    note: 'Extra toppings for Param & Rahul'
  });

  // Expense 4: Electricity bill — paid by Priya
  await insertExpense({
    title: 'Electricity Bill',
    totalAmount: 320000, // ₹3200
    paidBy: priyaId,
    splitType: 'equal',
    participants: [paramId, rahulId, amanId, priyaId],
    note: 'BESCOM June bill'
  });

  // Expense 5: House cleaning service
  await insertExpense({
    title: 'House Cleaning Service',
    totalAmount: 80000, // ₹800
    paidBy: paramId,
    splitType: 'equal',
    participants: [paramId, rahulId, amanId, priyaId],
    note: 'Urban Company deep clean'
  });

  // Settlement: Aman pays Priya ₹500
  const setTxnId = await generateTxnId('SET');
  await dbRun(
    `INSERT INTO settlements (transaction_id, group_id, payer_id, receiver_id, amount, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [setTxnId, group.id, amanId, priyaId, 50000, 'Partial settle for electricity']
  );

  console.log('[Seed] Demo data seeded successfully!');
  console.log(`[Seed] Group: "${group.name}" | Members: ${memberNames.join(', ')}`);
}

module.exports = { seed };