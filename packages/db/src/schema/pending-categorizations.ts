import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { transactions } from './transactions.js';
import { categories } from './categories.js';

export const pendingCategorizations = sqliteTable('pending_categorizations', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id')
    .notNull()
    .references(() => transactions.id),
  proposedCategoryId: text('proposed_category_id')
    .notNull()
    .references(() => categories.id),
  confidence: integer('confidence').notNull(), // 0-100
  status: text('status', {
    enum: ['pending', 'accepted', 'rejected'],
  })
    .notNull()
    .default('pending'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
