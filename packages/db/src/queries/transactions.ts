import { and, desc, eq, gte, like, lt, notInArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../client.js';
import { transactions, categories } from '../schema/index.js';

function getExcludedCategoryIds(db: Db): string[] {
  return db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.isExcluded, true))
    .all()
    .map((r) => r.id);
}

export interface TransactionInsert {
  externalId: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  rawDescription?: string;
  categoryId?: string;
  categorySource?: 'ai' | 'user' | 'rule' | 'chase';
}

export function listTransactions(
  db: Db,
  filters?: {
    accountId?: string;
    categoryId?: string;
    month?: string; // YYYY-MM
    search?: string;
    includeTransfers?: boolean;
  }
) {
  const conditions = [];

  if (filters?.accountId) {
    conditions.push(eq(transactions.accountId, filters.accountId));
  }
  if (filters?.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  if (filters?.month) {
    const start = `${filters.month}-01`;
    const [year, month] = filters.month.split('-').map(Number);
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    conditions.push(gte(transactions.date, start));
    conditions.push(lt(transactions.date, nextMonth));
  }
  if (filters?.search) {
    conditions.push(like(transactions.description, `%${filters.search}%`));
  }
  if (!filters?.includeTransfers) {
    conditions.push(eq(transactions.isTransfer, false));
  }

  return db
    .select({
      id: transactions.id,
      externalId: transactions.externalId,
      accountId: transactions.accountId,
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      categoryId: transactions.categoryId,
      categorySource: transactions.categorySource,
      categoryName: categories.name,
      categoryColor: categories.color,
      isTransfer: transactions.isTransfer,
      transferPairId: transactions.transferPairId,
      rawDescription: transactions.rawDescription,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date))
    .all();
}

export function getTransaction(db: Db, id: string) {
  return db
    .select({
      id: transactions.id,
      externalId: transactions.externalId,
      accountId: transactions.accountId,
      date: transactions.date,
      description: transactions.description,
      amount: transactions.amount,
      categoryId: transactions.categoryId,
      categorySource: transactions.categorySource,
      categoryName: categories.name,
      categoryColor: categories.color,
      isTransfer: transactions.isTransfer,
      transferPairId: transactions.transferPairId,
      rawDescription: transactions.rawDescription,
      notes: transactions.notes,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.id, id))
    .get();
}

export function bulkInsertTransactions(db: Db, txns: TransactionInsert[]) {
  let inserted = 0;
  let skipped = 0;

  db.transaction((tx) => {
    for (const txn of txns) {
      const result = tx
        .insert(transactions)
        .values({
          id: nanoid(),
          externalId: txn.externalId,
          accountId: txn.accountId,
          date: txn.date,
          description: txn.description,
          amount: txn.amount,
          rawDescription: txn.rawDescription ?? null,
          categoryId: txn.categoryId ?? null,
          categorySource: txn.categorySource ?? null,
        })
        .onConflictDoNothing()
        .run();

      if (result.changes > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }
  });

  return { inserted, skipped };
}

export function updateTransactionCategory(
  db: Db,
  id: string,
  categoryId: string,
  source: 'ai' | 'user' | 'rule' | 'chase'
) {
  db.update(transactions)
    .set({ categoryId, categorySource: source })
    .where(eq(transactions.id, id))
    .run();
}

export function getUncategorizedTransactions(db: Db) {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        sql`${transactions.categoryId} IS NULL`,
        eq(transactions.isTransfer, false)
      )
    )
    .orderBy(desc(transactions.date))
    .all();
}

export function updateTransactionNotes(db: Db, id: string, notes: string | null) {
  db.update(transactions)
    .set({ notes })
    .where(eq(transactions.id, id))
    .run();
}

export function getLatestTransactionMonth(db: Db): string | null {
  const row = db
    .select({
      month:
        sql<string>`substr(${transactions.date}, 1, 7)`,
    })
    .from(transactions)
    .where(eq(transactions.isTransfer, false))
    .orderBy(desc(transactions.date))
    .limit(1)
    .get();

  return row?.month ?? null;
}

export function getMonthlySummary(db: Db, month: string) {
  const start = `${month}-01`;
  const [year, m] = month.split('-').map(Number);
  const nextMonth =
    m === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(m + 1).padStart(2, '0')}-01`;

  const excludedIds = getExcludedCategoryIds(db);
  const excludeCondition = excludedIds.length > 0
    ? sql`(${transactions.categoryId} IS NULL OR ${notInArray(transactions.categoryId, excludedIds)})`
    : undefined;

  const result = db
    .select({
      totalIncome: sql<number>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)`,
      totalExpenses: sql<number>`coalesce(sum(case when ${transactions.amount} < 0 then ${transactions.amount} else 0 end), 0)`,
      transactionCount: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, start),
        lt(transactions.date, nextMonth),
        eq(transactions.isTransfer, false),
        excludeCondition
      )
    )
    .get();

  const byCategory = db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      total: sql<number>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        gte(transactions.date, start),
        lt(transactions.date, nextMonth),
        eq(transactions.isTransfer, false),
        excludeCondition
      )
    )
    .groupBy(transactions.categoryId)
    .orderBy(sql`sum(${transactions.amount}) asc`)
    .all();

  return {
    month,
    totalIncome: result?.totalIncome ?? 0,
    totalExpenses: result?.totalExpenses ?? 0,
    net: (result?.totalIncome ?? 0) + (result?.totalExpenses ?? 0),
    transactionCount: result?.transactionCount ?? 0,
    byCategory,
  };
}

export function getTransactionYears(db: Db): number[] {
  const rows = db
    .select({
      year: sql<number>`cast(substr(${transactions.date}, 1, 4) as integer)`,
    })
    .from(transactions)
    .where(eq(transactions.isTransfer, false))
    .groupBy(sql`substr(${transactions.date}, 1, 4)`)
    .orderBy(desc(sql`substr(${transactions.date}, 1, 4)`))
    .all();

  return rows.map((r) => r.year);
}

export function getYearlySummary(db: Db, year: number) {
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;

  const excludedIds = getExcludedCategoryIds(db);
  const excludeCondition = excludedIds.length > 0
    ? sql`(${transactions.categoryId} IS NULL OR ${notInArray(transactions.categoryId, excludedIds)})`
    : undefined;

  const result = db
    .select({
      totalIncome: sql<number>`coalesce(sum(case when ${transactions.amount} > 0 then ${transactions.amount} else 0 end), 0)`,
      totalExpenses: sql<number>`coalesce(sum(case when ${transactions.amount} < 0 then ${transactions.amount} else 0 end), 0)`,
      transactionCount: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.date, start),
        lt(transactions.date, end),
        eq(transactions.isTransfer, false),
        excludeCondition
      )
    )
    .get();

  const byCategory = db
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      total: sql<number>`sum(${transactions.amount})`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        gte(transactions.date, start),
        lt(transactions.date, end),
        eq(transactions.isTransfer, false),
        excludeCondition
      )
    )
    .groupBy(transactions.categoryId)
    .orderBy(sql`sum(${transactions.amount}) asc`)
    .all();

  return {
    year,
    totalIncome: result?.totalIncome ?? 0,
    totalExpenses: result?.totalExpenses ?? 0,
    net: (result?.totalIncome ?? 0) + (result?.totalExpenses ?? 0),
    transactionCount: result?.transactionCount ?? 0,
    byCategory,
  };
}
