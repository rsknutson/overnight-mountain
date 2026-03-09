import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color'),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  parentId: text('parent_id'),
});
