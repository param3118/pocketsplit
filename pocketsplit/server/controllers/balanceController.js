const { dbQuery, dbGet, dbRun } = require('../db/database');
const { computeBalances, simplifyDebts } = require('../services/balanceService');
const { generateTxnId } = require('../services/txnIdService');
const { validateAmount, validateNonEmpty } = require('../utils/validators');

// GET /balances/:groupId
async function getBalances(req, res) {
  const { groupId } = req.params;

  const group = await dbGet(`SELECT id FROM groups_table WHERE id = ?`, [groupId]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  const balances = await computeBalances(groupId);
  const simplifiedDebts = await simplifyDebts(groupId);

  res.json({
    success: true,
    data: {
      balances,
      simplified_debts: simplifiedDebts
    }
  });
}

// POST /settlements
async function createSettlement(req, res) {
  const { group_id, payer_id, receiver_id, amount, note } = req.body;
  const actingUserId = parseInt(req.headers['x-user-id']);

  if (!group_id) return res.status(400).json({ success: false, error: 'group_id is required' });

  if (actingUserId && actingUserId !== parseInt(payer_id)) {
    return res.status(403).json({ success: false, error: 'Only the payer can record this settlement' });
  }

  const amtErr = validateAmount(amount);
  if (amtErr) return res.status(400).json({ success: false, error: amtErr });

  if (!payer_id || !receiver_id) {
    return res.status(400).json({ success: false, error: 'payer_id and receiver_id are required' });
  }

  if (payer_id === receiver_id) {
    return res.status(400).json({ success: false, error: 'Payer and receiver cannot be the same' });
  }

  const group = await dbGet(`SELECT id FROM groups_table WHERE id = ?`, [group_id]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  // Verify both are group members
  for (const uid of [payer_id, receiver_id]) {
    const m = await dbGet(
      `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
      [group_id, uid]
    );
    if (!m) return res.status(400).json({ success: false, error: `User ${uid} is not a member of the group` });
  }

  const txnId = await generateTxnId('SET');

  await dbRun(
    `INSERT INTO settlements (transaction_id, group_id, payer_id, receiver_id, amount, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [txnId, group_id, payer_id, receiver_id, amount, note || null]
  );

  const settlement = await dbGet(`SELECT * FROM settlements ORDER BY id DESC LIMIT 1`);

  res.status(201).json({ success: true, data: settlement });
}

// GET /settlements/:groupId
async function getSettlements(req, res) {
  const { groupId } = req.params;

  const settlements = await dbQuery(
    `SELECT s.*, p.name as payer_name, r.name as receiver_name
     FROM settlements s
     JOIN users p ON p.id = s.payer_id
     JOIN users r ON r.id = s.receiver_id
     WHERE s.group_id = ?
     ORDER BY s.created_at DESC`,
    [groupId]
  );

  res.json({ success: true, data: settlements });
}

module.exports = { getBalances, createSettlement, getSettlements };