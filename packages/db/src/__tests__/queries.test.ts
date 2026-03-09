import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '../schema/index.js';
import { seedCategories } from '../seed.js';
import {
  upsertAccount,
  listAccounts,
  bulkInsertTransactions,
  listTransactions,
  getLatestTransactionMonth,
  getMonthlySummary,
  listCategories,
  listCategoriesHierarchical,
  createCategory,
  updateTransactionCategory,
  getSetting,
  setSetting,
} from '../queries/index.js';
import type { Db } from '../client.js';

function createTestDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });

  // Create tables
  db.run(sql`CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT REFERENCES categories(id)
  )`);

  db.run(sql`CREATE TABLE transfer_pairs (
    id TEXT PRIMARY KEY,
    checking_txn_id TEXT NOT NULL,
    credit_txn_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE transactions (
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

  db.run(sql`CREATE TABLE category_rules (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,
    category_id TEXT NOT NULL REFERENCES categories(id),
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);

  db.run(sql`CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  return db;
}

describe('accounts', () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('creates and lists accounts', () => {
    upsertAccount(db, { name: 'Chase Checking', type: 'checking' });
    upsertAccount(db, { name: 'Chase Credit', type: 'credit_card' });

    const accounts = listAccounts(db);
    expect(accounts).toHaveLength(2);
  });

  it('deduplicates accounts by name', () => {
    upsertAccount(db, { name: 'Chase Checking', type: 'checking' });
    upsertAccount(db, { name: 'Chase Checking', type: 'checking' });

    const accounts = listAccounts(db);
    expect(accounts).toHaveLength(1);
  });
});

describe('categories', () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('seeds default categories with hierarchy', () => {
    seedCategories(db);
    const all = listCategories(db);
    // Should have parent + child categories
    expect(all.length).toBeGreaterThanOrEqual(40);
    // Should have parent categories without parentId
    const parents = all.filter((c) => !c.parentId);
    expect(parents.length).toBeGreaterThanOrEqual(12);
    // Should have child categories with parentId
    const children = all.filter((c) => c.parentId);
    expect(children.length).toBeGreaterThan(0);
  });

  it('seeds are idempotent', () => {
    seedCategories(db);
    const first = listCategories(db);
    seedCategories(db);
    const second = listCategories(db);
    expect(second.length).toBe(first.length);
  });

  it('creates custom categories with parent', () => {
    const parent = createCategory(db, { name: 'Parent', color: '#FF0000' });
    createCategory(db, { name: 'Child', color: '#00FF00', parentId: parent.id });
    const hierarchy = listCategoriesHierarchical(db);
    const parentGroup = hierarchy.find((c) => c.name === 'Parent');
    expect(parentGroup).toBeDefined();
    expect(parentGroup!.children).toHaveLength(1);
    expect(parentGroup!.children[0].name).toBe('Child');
  });

  it('lists categories hierarchically', () => {
    seedCategories(db);
    const hierarchy = listCategoriesHierarchical(db);
    // All entries should be parents (no parentId)
    expect(hierarchy.every((c) => !c.parentId)).toBe(true);
    // Repairs & Maintenance should have children
    const repairs = hierarchy.find((c) => c.name === 'Repairs & Maintenance');
    expect(repairs).toBeDefined();
    expect(repairs!.children.length).toBeGreaterThanOrEqual(4);
  });
});

describe('transactions', () => {
  let db: Db;
  let accountId: string;

  beforeEach(() => {
    db = createTestDb();
    const account = upsertAccount(db, { name: 'Test', type: 'checking' });
    accountId = account.id;
  });

  it('bulk inserts transactions', () => {
    const result = bulkInsertTransactions(db, [
      {
        externalId: 'test-1',
        accountId,
        date: '2024-01-15',
        description: 'GROCERY STORE',
        amount: -4567,
      },
      {
        externalId: 'test-2',
        accountId,
        date: '2024-01-16',
        description: 'DIRECT DEPOSIT',
        amount: 250000,
      },
    ]);

    expect(result.inserted).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('deduplicates on externalId', () => {
    bulkInsertTransactions(db, [
      {
        externalId: 'test-1',
        accountId,
        date: '2024-01-15',
        description: 'GROCERY STORE',
        amount: -4567,
      },
    ]);

    const result = bulkInsertTransactions(db, [
      {
        externalId: 'test-1',
        accountId,
        date: '2024-01-15',
        description: 'GROCERY STORE',
        amount: -4567,
      },
    ]);

    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('lists transactions sorted by date desc', () => {
    bulkInsertTransactions(db, [
      {
        externalId: 'old',
        accountId,
        date: '2024-01-01',
        description: 'OLD',
        amount: -100,
      },
      {
        externalId: 'new',
        accountId,
        date: '2024-01-31',
        description: 'NEW',
        amount: -200,
      },
    ]);

    const txns = listTransactions(db);
    expect(txns[0].description).toBe('NEW');
    expect(txns[1].description).toBe('OLD');
  });

  it('returns latest transaction month', () => {
    bulkInsertTransactions(db, [
      {
        externalId: 'jan',
        accountId,
        date: '2024-01-15',
        description: 'JAN',
        amount: -100,
      },
      {
        externalId: 'mar',
        accountId,
        date: '2024-03-20',
        description: 'MAR',
        amount: -200,
      },
    ]);

    expect(getLatestTransactionMonth(db)).toBe('2024-03');
  });

  it('returns null when no transactions exist', () => {
    expect(getLatestTransactionMonth(db)).toBeNull();
  });

  it('computes monthly summary', () => {
    bulkInsertTransactions(db, [
      {
        externalId: 'income',
        accountId,
        date: '2024-01-15',
        description: 'SALARY',
        amount: 500000,
      },
      {
        externalId: 'expense',
        accountId,
        date: '2024-01-20',
        description: 'RENT',
        amount: -150000,
      },
    ]);

    const summary = getMonthlySummary(db, '2024-01');
    expect(summary.totalIncome).toBe(500000);
    expect(summary.totalExpenses).toBe(-150000);
    expect(summary.net).toBe(350000);
    expect(summary.transactionCount).toBe(2);
  });
});

describe('settings', () => {
  let db: Db;

  beforeEach(() => {
    db = createTestDb();
  });

  it('gets and sets settings', () => {
    setSetting(db, 'auto_categorize', true);
    expect(getSetting(db, 'auto_categorize')).toBe(true);
  });

  it('returns undefined for missing settings', () => {
    expect(getSetting(db, 'nonexistent')).toBeUndefined();
  });

  it('overwrites existing settings', () => {
    setSetting(db, 'auto_categorize', true);
    setSetting(db, 'auto_categorize', false);
    expect(getSetting(db, 'auto_categorize')).toBe(false);
  });
});
