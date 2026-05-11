const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { initSql } = require('./init');

const DB_PATH = path.join(__dirname, '../../pocketsplit.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL + foreign keys
  db.run("PRAGMA foreign_keys=ON;");

  // Init schema
  db.run(initSql);

  // Persist after every write
  patchDb(db);

  return db;
}

function persist() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function patchDb(dbInstance) {
  const origRun = dbInstance.run.bind(dbInstance);
  dbInstance.run = function(sql, params) {
    const result = origRun(sql, params);
    if (/^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|PRAGMA)/i.test(sql)) {
      persist();
    }
    return result;
  };
}

module.exports = { getDb, persist };