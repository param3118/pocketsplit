const { getDb } = require('../db/database');

function getDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function generateTxnId(prefix) {
  // prefix: 'EXP' or 'SET'
  const db = await getDb();
  const key = `${prefix}_${getDateStr()}`;

  const row = db.exec(`SELECT last_seq FROM txn_counter WHERE prefix = ?`, [key]);
  let seq = 1;

  if (row.length > 0 && row[0].values.length > 0) {
    seq = row[0].values[0][0] + 1;
    db.run(`UPDATE txn_counter SET last_seq = ? WHERE prefix = ?`, [seq, key]);
  } else {
    db.run(`INSERT INTO txn_counter (prefix, last_seq) VALUES (?, 1)`, [key]);
  }

  const seqStr = String(seq).padStart(4, '0');
  return `${prefix}-${getDateStr()}-${seqStr}`;
}

module.exports = { generateTxnId };