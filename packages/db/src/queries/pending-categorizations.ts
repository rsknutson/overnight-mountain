import { and, eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../client.js';
import {
  pendingCategorizations,
  transactions,
  categories,
} from '../schema/index.js';

export interface PendingCategorizationInsert {
  transactionId: string;
  proposedCategoryId: string;
  confidence: number; // 0-100
}

export function insertPendingCategorizations(
  db: Db,
  items: PendingCategorizationInsert[]
) {
  // Clear any existing pending proposals for these transactions
  const txnIds = items.map((i) => i.transactionId);
  db.delete(pendingCategorizations)
    .where(
      and(
        eq(pendingCategorizations.status, 'pending'),
        sql`${pendingCategorizations.transactionId} IN (${sql.join(
          txnIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    )
    .run();

  db.transaction((tx) => {
    for (const item of items) {
      tx.insert(pendingCategorizations)
        .values({
          id: nanoid(),
          transactionId: item.transactionId,
          proposedCategoryId: item.proposedCategoryId,
          confidence: item.confidence,
        })
        .run();
    }
  });

  return { inserted: items.length };
}

export function listPendingCategorizations(db: Db) {
  return db
    .select({
      id: pendingCategorizations.id,
      transactionId: pendingCategorizations.transactionId,
      transactionDate: transactions.date,
      transactionDescription: transactions.description,
      transactionAmount: transactions.amount,
      currentCategoryId: transactions.categoryId,
      proposedCategoryId: pendingCategorizations.proposedCategoryId,
      proposedCategoryName: categories.name,
      proposedCategoryColor: categories.color,
      confidence: pendingCategorizations.confidence,
      createdAt: pendingCategorizations.createdAt,
    })
    .from(pendingCategorizations)
    .innerJoin(
      transactions,
      eq(pendingCategorizations.transactionId, transactions.id)
    )
    .innerJoin(
      categories,
      eq(pendingCategorizations.proposedCategoryId, categories.id)
    )
    .where(eq(pendingCategorizations.status, 'pending'))
    .orderBy(transactions.date)
    .all();
}

export function acceptPendingCategorization(db: Db, id: string) {
  const pending = db
    .select()
    .from(pendingCategorizations)
    .where(eq(pendingCategorizations.id, id))
    .get();

  if (!pending) return;

  db.transaction((tx) => {
    // Apply the category to the transaction
    tx.update(transactions)
      .set({
        categoryId: pending.proposedCategoryId,
        categorySource: 'ai',
      })
      .where(eq(transactions.id, pending.transactionId))
      .run();

    // Mark as accepted
    tx.update(pendingCategorizations)
      .set({ status: 'accepted' })
      .where(eq(pendingCategorizations.id, id))
      .run();
  });
}

export function rejectPendingCategorization(db: Db, id: string) {
  db.update(pendingCategorizations)
    .set({ status: 'rejected' })
    .where(eq(pendingCategorizations.id, id))
    .run();
}

export function acceptAllPendingCategorizations(db: Db) {
  const pendings = db
    .select()
    .from(pendingCategorizations)
    .where(eq(pendingCategorizations.status, 'pending'))
    .all();

  db.transaction((tx) => {
    for (const pending of pendings) {
      tx.update(transactions)
        .set({
          categoryId: pending.proposedCategoryId,
          categorySource: 'ai',
        })
        .where(eq(transactions.id, pending.transactionId))
        .run();

      tx.update(pendingCategorizations)
        .set({ status: 'accepted' })
        .where(eq(pendingCategorizations.id, pending.id))
        .run();
    }
  });

  return { accepted: pendings.length };
}

export function rejectAllPendingCategorizations(db: Db) {
  const result = db
    .update(pendingCategorizations)
    .set({ status: 'rejected' })
    .where(eq(pendingCategorizations.status, 'pending'))
    .run();

  return { rejected: result.changes };
}

export function clearPendingCategorizations(db: Db) {
  db.delete(pendingCategorizations)
    .where(
      sql`${pendingCategorizations.status} IN ('accepted', 'rejected')`
    )
    .run();
}
