import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const amazonOrders = sqliteTable('amazon_orders', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  orderDate: text('order_date').notNull(), // YYYY-MM-DD
  itemName: text('item_name').notNull(),
  category: text('category'),
  asin: text('asin'),
  quantity: integer('quantity').notNull().default(1),
  itemTotal: integer('item_total').notNull(), // cents
  orderUrl: text('order_url'),
  transactionId: text('transaction_id'), // linked transaction (nullable until matched)
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
