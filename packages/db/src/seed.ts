import { nanoid } from 'nanoid';
import type { Db } from './client.js';
import { categories } from './schema/index.js';

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', color: '#4CAF50' },
  { name: 'Dining', color: '#FF9800' },
  { name: 'Transportation', color: '#2196F3' },
  { name: 'Entertainment', color: '#9C27B0' },
  { name: 'Utilities', color: '#607D8B' },
  { name: 'Rent/Mortgage', color: '#795548' },
  { name: 'Shopping', color: '#E91E63' },
  { name: 'Healthcare', color: '#00BCD4' },
  { name: 'Income', color: '#8BC34A' },
  { name: 'Subscriptions', color: '#673AB7' },
  { name: 'Travel', color: '#FF5722' },
  { name: 'Uncategorized', color: '#9E9E9E' },
] as const;

export async function seedCategories(db: Db) {
  for (const cat of DEFAULT_CATEGORIES) {
    db.insert(categories)
      .values({
        id: nanoid(),
        name: cat.name,
        color: cat.color,
        isSystem: true,
      })
      .onConflictDoNothing()
      .run();
  }
}
