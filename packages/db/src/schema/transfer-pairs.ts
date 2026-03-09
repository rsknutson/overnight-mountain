import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const transferPairs = sqliteTable('transfer_pairs', {
  id: text('id').primaryKey(),
  checkingTxnId: text('checking_txn_id').notNull(),
  creditTxnId: text('credit_txn_id').notNull(),
  amount: integer('amount').notNull(), // cents (absolute value)
  status: text('status', {
    enum: ['pending', 'confirmed', 'dismissed'],
  })
    .notNull()
    .default('pending'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
