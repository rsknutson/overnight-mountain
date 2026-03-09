import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../client.js';
import { transactions, transferPairs } from '../schema/index.js';

const PAYMENT_KEYWORDS = [
  'CHASE CREDIT',
  'AUTOPAY',
  'PAYMENT THANK YOU',
  'AUTOMATIC PAYMENT',
  'ONLINE PAYMENT',
  'CREDIT CARD PAYMENT',
];

export function listTransferPairs(db: Db) {
  return db.select().from(transferPairs).all();
}

export function detectTransfers(db: Db) {
  // Find checking debits matching payment keywords
  const checkingDebits = db
    .select()
    .from(transactions)
    .where(
      and(
        sql`${transactions.amount} < 0`,
        sql`(${transactions.description} LIKE '%CHASE CREDIT%' OR ${transactions.description} LIKE '%AUTOPAY%' OR ${transactions.description} LIKE '%PAYMENT THANK YOU%' OR ${transactions.description} LIKE '%AUTOMATIC PAYMENT%' OR ${transactions.description} LIKE '%ONLINE PAYMENT%' OR ${transactions.description} LIKE '%CREDIT CARD PAYMENT%')`,
        eq(transactions.isTransfer, false)
      )
    )
    .all();

  const newPairs: Array<{
    checkingTxnId: string;
    creditTxnId: string;
    amount: number;
  }> = [];

  for (const debit of checkingDebits) {
    const debitDate = new Date(debit.date);
    const threeDaysBefore = new Date(debitDate);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
    const threeDaysAfter = new Date(debitDate);
    threeDaysAfter.setDate(threeDaysAfter.getDate() + 3);

    const matchingCredits = db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.amount, Math.abs(debit.amount)),
          gte(transactions.date, threeDaysBefore.toISOString().split('T')[0]),
          lt(transactions.date, threeDaysAfter.toISOString().split('T')[0]),
          eq(transactions.isTransfer, false),
          sql`${transactions.id} != ${debit.id}`
        )
      )
      .all();

    for (const credit of matchingCredits) {
      // Check if this pair already exists
      const existing = db
        .select()
        .from(transferPairs)
        .where(
          and(
            eq(transferPairs.checkingTxnId, debit.id),
            eq(transferPairs.creditTxnId, credit.id)
          )
        )
        .get();

      if (!existing) {
        newPairs.push({
          checkingTxnId: debit.id,
          creditTxnId: credit.id,
          amount: Math.abs(debit.amount),
        });
      }
    }
  }

  // Insert new pairs
  for (const pair of newPairs) {
    db.insert(transferPairs)
      .values({
        id: nanoid(),
        ...pair,
        status: 'pending',
      })
      .run();
  }

  return newPairs.length;
}

export function confirmTransferPair(db: Db, pairId: string) {
  const pair = db
    .select()
    .from(transferPairs)
    .where(eq(transferPairs.id, pairId))
    .get();

  if (!pair) return;

  db.update(transferPairs)
    .set({ status: 'confirmed' })
    .where(eq(transferPairs.id, pairId))
    .run();

  db.update(transactions)
    .set({ isTransfer: true, transferPairId: pairId })
    .where(
      sql`${transactions.id} IN (${pair.checkingTxnId}, ${pair.creditTxnId})`
    )
    .run();
}

export function dismissTransferPair(db: Db, pairId: string) {
  db.update(transferPairs)
    .set({ status: 'dismissed' })
    .where(eq(transferPairs.id, pairId))
    .run();
}

export function undismissTransferPair(db: Db, pairId: string) {
  db.update(transferPairs)
    .set({ status: 'pending' })
    .where(eq(transferPairs.id, pairId))
    .run();
}
