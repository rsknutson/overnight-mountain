import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { categories } from './categories.js';

export const categoryRules = sqliteTable('category_rules', {
  id: text('id').primaryKey(),
  pattern: text('pattern').notNull(),
  categoryId: text('category_id')
    .notNull()
    .references(() => categories.id),
  priority: integer('priority').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
