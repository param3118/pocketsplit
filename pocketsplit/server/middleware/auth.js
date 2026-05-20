const crypto = require('crypto');
const { dbGet } = require('../db/database');

// Helper to hash passkey
function hashPasskey(passkey) {
  if (!passkey) return null;
  // Use a simple, fast hash for demo/roommate purposes
  // In a high-security app, use a unique salt per group.
  return crypto.pbkdf2Sync(passkey, 'pocketsplit_salt', 1000, 64, 'sha512').toString('hex');
}

// Middleware to check group passkey
async function checkGroupAccess(req, res, next) {
  // Extract groupId from params or body
  let groupId = req.params.groupId || req.params.id || req.body.group_id;
  
  // If no group ID is directly available in the route, we might need to look it up 
  // based on expenseId or settlementId, but we'll handle that per-controller if needed,
  // or pass it explicitly. For most routes, it's there.
  
  if (!groupId) {
    // If it's a route like PUT /expenses/:id, we need to fetch the group_id first
    if (req.baseUrl.includes('expenses') && req.params.id) {
        const exp = await dbGet(`SELECT group_id FROM expenses WHERE id = ?`, [req.params.id]);
        if (exp) groupId = exp.group_id;
    } else if (req.baseUrl.includes('groups') && req.params.id) {
        groupId = req.params.id;
    }
  }

  if (!groupId) return next(); // Not a group-specific route or couldn't determine

  const group = await dbGet(`SELECT passcode_hash FROM groups_table WHERE id = ?`, [groupId]);
  if (!group) return res.status(404).json({ success: false, error: 'Group not found' });

  // If group has no passcode, it's public (legacy/demo)
  if (!group.passcode_hash) {
    return next();
  }

  const providedPasskey = req.headers['x-group-passkey'];
  
  if (!providedPasskey) {
    return res.status(401).json({ success: false, error: 'Passkey required for this group' });
  }

  const hashedProvided = hashPasskey(providedPasskey);
  if (hashedProvided !== group.passcode_hash) {
    return res.status(401).json({ success: false, error: 'Invalid group passkey' });
  }

  next();
}

module.exports = { hashPasskey, checkGroupAccess };
