import { and, desc, eq, gte, lt, sql, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../client.js';
import { amazonOrders } from '../schema/index.js';

export interface AmazonOrderInsert {
  orderId: string;
  orderDate: string; // YYYY-MM-DD
  itemName: string;
  category?: string;
  asin?: string;
  quantity: number;
  itemTotal: number; // cents
}

export function listAmazonOrders(
  db: Db,
  filters?: { year?: number; month?: number }
) {
  const conditions = [];

  if (filters?.year && filters?.month) {
    const monthStr = `${filters.year}-${String(filters.month).padStart(2, '0')}`;
    conditions.push(gte(amazonOrders.orderDate, `${monthStr}-01`));
    const nextMonth =
      filters.month === 12
        ? `${filters.year + 1}-01-01`
        : `${filters.year}-${String(filters.month + 1).padStart(2, '0')}-01`;
    conditions.push(lt(amazonOrders.orderDate, nextMonth));
  } else if (filters?.year) {
    conditions.push(gte(amazonOrders.orderDate, `${filters.year}-01-01`));
    conditions.push(lt(amazonOrders.orderDate, `${filters.year + 1}-01-01`));
  }

  return db
    .select()
    .from(amazonOrders)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(amazonOrders.orderDate))
    .all();
}

export function getAmazonOrderYears(db: Db): number[] {
  const rows = db
    .select({
      year: sql<number>`cast(substr(${amazonOrders.orderDate}, 1, 4) as integer)`,
    })
    .from(amazonOrders)
    .groupBy(sql`substr(${amazonOrders.orderDate}, 1, 4)`)
    .orderBy(desc(sql`substr(${amazonOrders.orderDate}, 1, 4)`))
    .all();

  return rows.map((r) => r.year);
}

export function bulkInsertAmazonOrders(db: Db, orders: AmazonOrderInsert[]) {
  let inserted = 0;
  let skipped = 0;

  db.transaction((tx) => {
    for (const order of orders) {
      // Deduplicate by orderId + itemName + itemTotal
      const existing = tx
        .select({ id: amazonOrders.id })
        .from(amazonOrders)
        .where(
          and(
            eq(amazonOrders.orderId, order.orderId),
            eq(amazonOrders.itemName, order.itemName),
            eq(amazonOrders.itemTotal, order.itemTotal)
          )
        )
        .get();

      if (existing) {
        skipped++;
        continue;
      }

      const orderUrl = `https://www.amazon.com/gp/your-account/order-details?orderID=${order.orderId}`;
      tx.insert(amazonOrders)
        .values({
          id: nanoid(),
          orderId: order.orderId,
          orderDate: order.orderDate,
          itemName: order.itemName,
          category: order.category ?? null,
          asin: order.asin ?? null,
          quantity: order.quantity,
          itemTotal: order.itemTotal,
          orderUrl,
          transactionId: null,
        })
        .run();
      inserted++;
    }
  });

  return { inserted, skipped };
}

/**
 * Find unmatched Amazon orders that could correspond to a transaction,
 * based on date proximity (within 5 days) and similar amount.
 */
export function findCandidateAmazonOrders(
  db: Db,
  transactionDate: string,
  transactionAmount: number // cents (negative for debits)
) {
  const absAmount = Math.abs(transactionAmount);
  // Look within 7 days before and after the transaction date
  const dateObj = new Date(transactionDate);
  const startDate = new Date(dateObj);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(dateObj);
  endDate.setDate(endDate.getDate() + 7);

  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);

  return db
    .select()
    .from(amazonOrders)
    .where(
      and(
        isNull(amazonOrders.transactionId),
        gte(amazonOrders.orderDate, start),
        lt(amazonOrders.orderDate, end)
      )
    )
    .orderBy(
      // Sort by amount closeness
      sql`abs(${amazonOrders.itemTotal} - ${absAmount}) asc`
    )
    .all();
}

/**
 * Link an Amazon order to a transaction.
 */
export function linkAmazonOrder(db: Db, amazonOrderId: string, transactionId: string) {
  db.update(amazonOrders)
    .set({ transactionId })
    .where(eq(amazonOrders.id, amazonOrderId))
    .run();
}

/**
 * Unlink an Amazon order from a transaction.
 */
export function unlinkAmazonOrder(db: Db, amazonOrderId: string) {
  db.update(amazonOrders)
    .set({ transactionId: null })
    .where(eq(amazonOrders.id, amazonOrderId))
    .run();
}

/**
 * Get all Amazon orders linked to a specific transaction.
 */
export function getLinkedAmazonOrders(db: Db, transactionId: string) {
  return db
    .select()
    .from(amazonOrders)
    .where(eq(amazonOrders.transactionId, transactionId))
    .all();
}

/**
 * List all unlinked Amazon orders, sorted by date descending.
 */
export function listUnlinkedAmazonOrders(db: Db) {
  return db
    .select()
    .from(amazonOrders)
    .where(isNull(amazonOrders.transactionId))
    .orderBy(desc(amazonOrders.orderDate))
    .all();
}
