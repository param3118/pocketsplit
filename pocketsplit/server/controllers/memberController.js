const { dbQuery, dbGet, dbRun } = require('../db/database');
const { computeBalances } = require('../services/balanceService');

// GET /members/:groupId
async function getMembers(req, res) {
  const { groupId } = req.params;

  const group = await dbGet(`SELECT id FROM groups_table WHERE id = ?`, [groupId]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  const members = await dbQuery(
    `SELECT u.id, u.name, u.created_at FROM users u
     JOIN group_members gm ON gm.user_id = u.id
     WHERE gm.group_id = ?
     ORDER BY u.name`,
    [groupId]
  );

  res.json({ success: true, data: members });
}

// POST /members
async function addMember(req, res) {
  const { group_id, name } = req.body;

  if (!group_id) return res.status(400).json({ success: false, error: 'group_id is required' });
  if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'name is required' });

  const group = await dbGet(`SELECT id FROM groups_table WHERE id = ?`, [group_id]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  // Check for duplicate name in this group
  const existingInGroup = await dbGet(
    `SELECT u.id FROM users u
     JOIN group_members gm ON gm.user_id = u.id
     WHERE gm.group_id = ? AND lower(u.name) = lower(?)`,
    [group_id, name.trim()]
  );
  if (existingInGroup) {
    return res.status(409).json({ success: false, error: 'A member with this name already exists in the group' });
  }

  // Find or create user globally
  let user = await dbGet(`SELECT id, name FROM users WHERE lower(name) = lower(?)`, [name.trim()]);
  if (!user) {
    await dbRun(`INSERT INTO users (name) VALUES (?)`, [name.trim()]);
    user = await dbGet(`SELECT id, name FROM users ORDER BY id DESC LIMIT 1`);
  }

  await dbRun(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`, [group_id, user.id]);

  res.status(201).json({ success: true, data: user });
}

// DELETE /members/:groupId/:userId
async function removeMember(req, res) {
  const { groupId, userId } = req.params;

  const member = await dbGet(
    `SELECT user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId]
  );
  if (!member) return res.status(404).json({ success: false, error: 'Member not found in group' });

  // Check pending balances
  const balances = await computeBalances(groupId);
  const userBalance = balances.find(b => b.userId === parseInt(userId));

  if (userBalance && userBalance.balance !== 0) {
    return res.status(400).json({
      success: false,
      error: `Cannot remove member with pending balance (${userBalance.balance} paise). Settle all dues first.`
    });
  }

  await dbRun(`DELETE FROM group_members WHERE group_id = ? AND user_id = ?`, [groupId, userId]);

  res.json({ success: true, message: 'Member removed successfully' });
}

module.exports = { getMembers, addMember, removeMember };