import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from './schema/index.js';

const DB_PATH = process.env['LEDGER_DB_PATH'] ?? 'ledger.db';

let _db: ReturnType<typeof createDb> | undefined;

function createDb() {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });

  // Auto-create tables if they don't exist
  db.run(sql`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    is_system INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS transfer_pairs (
    id TEXT PRIMARY KEY,
    checking_txn_id TEXT NOT NULL,
    credit_txn_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    external_id TEXT UNIQUE NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category_id TEXT REFERENCES categories(id),
    category_source TEXT,
    is_transfer INTEGER NOT NULL DEFAULT 0,
    transfer_pair_id TEXT REFERENCES transfer_pairs(id),
    raw_description TEXT,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS category_rules (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id),
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  return db;
}

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
