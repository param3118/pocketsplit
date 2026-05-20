const { dbQuery, dbGet, dbRun } = require('../db/database');
const { validateNonEmpty } = require('../utils/validators');
const { hashPasskey } = require('../middleware/auth');


// GET /groups
async function getAllGroups(req, res) {
  const groups = await dbQuery(
    `SELECT g.id, g.name, g.created_at,
       CASE WHEN g.passcode_hash IS NOT NULL THEN 1 ELSE 0 END as passcode_hash,
       COUNT(DISTINCT gm.user_id) as member_count,
       COUNT(DISTINCT CASE WHEN e.is_deleted=0 THEN e.id END) as expense_count
     FROM groups_table g
     LEFT JOIN group_members gm ON gm.group_id = g.id
     LEFT JOIN expenses e ON e.group_id = g.id
     GROUP BY g.id
     ORDER BY g.created_at DESC`
  );
  res.json({ success: true, data: groups });
}

// GET /groups/:id
async function getGroup(req, res) {
  const group = await dbGet(
    `SELECT g.id, g.name, g.created_at FROM groups_table g WHERE g.id = ?`,
    [req.params.id]
  );
  if (!group) {
    return res.status(404).json({ success: false, error: 'Group not found' });
  }
  const members = await dbQuery(
    `SELECT u.id, u.name, u.created_at FROM users u
     JOIN group_members gm ON gm.user_id = u.id
     WHERE gm.group_id = ?`,
    [req.params.id]
  );
  res.json({ success: true, data: { ...group, members } });
}

// POST /groups
async function createGroup(req, res) {
  const { name, member_names, passkey } = req.body;
  const nameErr = validateNonEmpty(name, 'name');
  if (nameErr) return res.status(400).json({ success: false, error: nameErr });

  const hashed = hashPasskey(passkey); // null if empty

  await dbRun(`INSERT INTO groups_table (name, passcode_hash) VALUES (?, ?)`, [name.trim(), hashed]);
  const group = await dbGet(`SELECT * FROM groups_table ORDER BY id DESC LIMIT 1`);

  // Optionally create members
  if (member_names && Array.isArray(member_names)) {
    for (const mName of member_names) {
      if (!mName || !mName.trim()) continue;
      let user = await dbGet(`SELECT id FROM users WHERE name = ?`, [mName.trim()]);
      if (!user) {
        await dbRun(`INSERT INTO users (name) VALUES (?)`, [mName.trim()]);
        user = await dbGet(`SELECT id FROM users ORDER BY id DESC LIMIT 1`);
      }
      await dbRun(`INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)`, [group.id, user.id]);
    }
  }

  res.status(201).json({ success: true, data: group });
}

// PUT /groups/:id
async function updateGroup(req, res) {
  const { name } = req.body;
  const nameErr = validateNonEmpty(name, 'name');
  if (nameErr) return res.status(400).json({ success: false, error: nameErr });

  const group = await dbGet(`SELECT id FROM groups_table WHERE id = ?`, [req.params.id]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  await dbRun(`UPDATE groups_table SET name = ? WHERE id = ?`, [name.trim(), req.params.id]);
  const updated = await dbGet(`SELECT * FROM groups_table WHERE id = ?`, [req.params.id]);
  res.json({ success: true, data: updated });
}

// DELETE /groups/:id
async function deleteGroup(req, res) {
  const group = await dbGet(`SELECT id FROM groups_table WHERE id = ?`, [req.params.id]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  // Cascade will handle group_members, expenses (soft-delete not possible via FK)
  // Soft delete all expenses first
  await dbRun(`UPDATE expenses SET is_deleted = 1 WHERE group_id = ?`, [req.params.id]);
  await dbRun(`DELETE FROM groups_table WHERE id = ?`, [req.params.id]);

  res.json({ success: true, message: 'Group deleted successfully' });
}

// POST /groups/:id/verify
async function verifyPasskey(req, res) {
  // Middleware handles the check, if it reaches here, it's valid
  res.json({ success: true, message: 'Passkey verified' });
}

module.exports = { getAllGroups, getGroup, createGroup, updateGroup, deleteGroup, verifyPasskey };