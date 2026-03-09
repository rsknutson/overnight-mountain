import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { accounts } from './accounts.js';
import { categories } from './categories.js';
import { transferPairs } from './transfer-pairs.js';

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  externalId: text('external_id').unique().notNull(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  date: text('date').notNull(), // ISO date string YYYY-MM-DD
  description: text('description').notNull(),
  amount: integer('amount').notNull(), // cents
  categoryId: text('category_id').references(() => categories.id),
  categorySource: text('category_source', {
    enum: ['ai', 'user', 'rule', 'chase'],
  }),
  isTransfer: integer('is_transfer', { mode: 'boolean' })
    .notNull()
    .default(false),
  transferPairId: text('transfer_pair_id').references(() => transferPairs.id),
  rawDescription: text('raw_description'),
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
