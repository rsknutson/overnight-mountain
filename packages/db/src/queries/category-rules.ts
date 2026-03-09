import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../client.js';
import { categoryRules, categories } from '../schema/index.js';

export function listCategoryRules(db: Db) {
  return db
    .select({
      id: categoryRules.id,
      pattern: categoryRules.pattern,
      categoryId: categoryRules.categoryId,
      categoryName: categories.name,
      priority: categoryRules.priority,
      createdAt: categoryRules.createdAt,
    })
    .from(categoryRules)
    .leftJoin(categories, eq(categoryRules.categoryId, categories.id))
    .orderBy(desc(categoryRules.priority))
    .all();
}

export function createCategoryRule(
  db: Db,
  data: { pattern: string; categoryId: string; priority?: number }
) {
  const id = nanoid();
  db.insert(categoryRules)
    .values({
      id,
      pattern: data.pattern,
      categoryId: data.categoryId,
      priority: data.priority ?? 0,
    })
    .run();
  return id;
}

export function applyRules(
  db: Db,
  txns: Array<{ id: string; description: string }>
) {
  const rules = db
    .select()
    .from(categoryRules)
    .orderBy(desc(categoryRules.priority))
    .all();

  const results: Array<{ txnId: string; categoryId: string }> = [];

  for (const txn of txns) {
    for (const rule of rules) {
      if (
        txn.description.toLowerCase().includes(rule.pattern.toLowerCase())
      ) {
        results.push({ txnId: txn.id, categoryId: rule.categoryId });
        break; // first matching rule wins
      }
    }
  }

  return results;
}

export function deleteCategoryRule(db: Db, id: string) {
  db.delete(categoryRules).where(eq(categoryRules.id, id)).run();
}
