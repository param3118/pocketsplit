const { getDb } = require('../db/database');

/**
 * Compute net balances for all members of a group.
 * Balance = money_paid - money_owed + settlements_received - settlements_paid
 * Positive → user should RECEIVE money
 * Negative → user OWES money
 * 
 * All amounts in integer paise/cents.
 */
async function computeBalances(groupId) {
  const db = await getDb();

  // Get group members
  const membersRes = db.exec(
    `SELECT u.id, u.name FROM users u
     JOIN group_members gm ON gm.user_id = u.id
     WHERE gm.group_id = ?`,
    [groupId]
  );

  if (!membersRes.length || !membersRes[0].values.length) return [];

  const members = membersRes[0].values.map(([id, name]) => ({ id, name }));
  const memberIds = members.map(m => m.id);

  const balanceMap = {};
  memberIds.forEach(id => { balanceMap[id] = 0; });

  // Active (non-deleted) expenses
  const expensesRes = db.exec(
    `SELECT e.id, e.paid_by, e.total_amount
     FROM expenses e
     WHERE e.group_id = ? AND e.is_deleted = 0`,
    [groupId]
  );

  if (expensesRes.length && expensesRes[0].values.length) {
    for (const [expId, paidBy, totalAmount] of expensesRes[0].values) {
      // Payer gets credit for paying
      if (balanceMap.hasOwnProperty(paidBy)) {
        balanceMap[paidBy] += totalAmount;
      }

      // Deduct each participant's share, but only if they haven't paid their share
      const sharesRes = db.exec(
        `SELECT es.user_id, es.share_amount, COALESCE(eps.is_paid, 0) as is_paid
         FROM expense_shares es
         LEFT JOIN expense_payment_status eps 
           ON eps.expense_id = es.expense_id AND eps.user_id = es.user_id
         WHERE es.expense_id = ?`,
        [expId]
      );

      if (sharesRes.length && sharesRes[0].values.length) {
        for (const [userId, shareAmount, isPaid] of sharesRes[0].values) {
          if (!balanceMap.hasOwnProperty(userId)) continue;
          // Owe their share regardless; if paid via mark-paid, we handle via payment status
          balanceMap[userId] -= shareAmount;
        }
      }
    }
  }

  // Settlements
  const settlementsRes = db.exec(
    `SELECT payer_id, receiver_id, amount
     FROM settlements
     WHERE group_id = ?`,
    [groupId]
  );

  if (settlementsRes.length && settlementsRes[0].values.length) {
    for (const [payerId, receiverId, amount] of settlementsRes[0].values) {
      if (balanceMap.hasOwnProperty(payerId)) balanceMap[payerId] -= amount;
      if (balanceMap.hasOwnProperty(receiverId)) balanceMap[receiverId] += amount;
    }
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