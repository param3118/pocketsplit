const { dbGet, dbRun } = require('../db/database');

function getDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function generateTxnId(prefix) {
  // prefix: 'EXP' or 'SET'
  const key = `${prefix}_${getDateStr()}`;

  const row = await dbGet(`SELECT last_seq FROM txn_counter WHERE prefix = ?`, [key]);
  let seq = 1;

  if (row) {
    seq = row.last_seq + 1;
    await dbRun(`UPDATE txn_counter SET last_seq = ? WHERE prefix = ?`, [seq, key]);
  } else {
    await dbRun(`INSERT INTO txn_counter (prefix, last_seq) VALUES (?, 1)`, [key]);
  }

  const seqStr = String(seq).padStart(4, '0');
  return `${prefix}-${getDateStr()}-${seqStr}`;
}

module.exports = { generateTxnId };