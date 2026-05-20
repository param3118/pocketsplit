require('dotenv').config();
const { createClient } = require('@libsql/client');
const { initSql } = require('./init');

let client = null;

async function getDb() {
  if (client) return client;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const dbPath = process.env.DB_PATH || './pocketsplit.db';

  let url;
  let authToken;

  if (tursoUrl && tursoToken) {
    console.log('🔌 Connecting to Turso Database...');
    url = tursoUrl;
    authToken = tursoToken;
  } else {
    console.log(`📂 Using Local SQLite: ${dbPath}`);
    url = `file:${dbPath}`;
    
    // Ensure directory exists if path includes one
    const fs = require('fs');
    const path = require('path');
    const dir = path.dirname(dbPath);
    if (dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  client = createClient({ url, authToken });

  // Enable foreign keys
  await client.execute("PRAGMA foreign_keys=ON;");

  // Init schema (only creates if not exists)
  // Split initSql into individual statements because Turso execute() likes one at a time or specific batching
  const statements = initSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    try {
      await client.execute(statement);
    } catch (e) {
      // Ignore errors about tables already existing
      if (!e.message.includes('already exists')) {
        console.error('Migration error:', e.message);
      }
    }
  }

  return client;
}

// Run after getDb() to apply migrations for existing databases
async function runMigrations() {
  try {
    await client.execute("ALTER TABLE groups_table ADD COLUMN passcode_hash TEXT");
    console.log('[Migration] Added passcode_hash column to groups_table');
  } catch (e) {
    // Column already exists — safe to ignore
  }
}

/**
 * Helper to run a query and return all rows as objects
 */
async function dbQuery(sql, params = []) {
  const db = await getDb();
  const res = await db.execute({ sql, args: params });
  return res.rows;
}

/**
 * Helper to run a query and return the first row as an object
 */
async function dbGet(sql, params = []) {
  const rows = await dbQuery(sql, params);
  return rows[0] || null;
}

/**
 * Helper to run a write query (alias for execute)
 */
async function dbRun(sql, params = []) {
  const db = await getDb();
  return await db.execute({ sql, args: params });
}

module.exports = { getDb, runMigrations, dbQuery, dbGet, dbRun };