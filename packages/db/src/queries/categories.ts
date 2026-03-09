import { eq, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../client.js';
import { categories, transactions } from '../schema/index.js';

export function listCategories(db: Db) {
  return db.select().from(categories).all();
}

export function listCategoriesWithCounts(db: Db) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      isSystem: categories.isSystem,
      parentId: categories.parentId,
      transactionCount: sql<number>`count(${transactions.id})`.as(
        'transaction_count'
      ),
    })
    .from(categories)
    .leftJoin(transactions, eq(transactions.categoryId, categories.id))
    .groupBy(categories.id)
    .all();
}

export function listCategoriesHierarchical(db: Db) {
  const all = db.select().from(categories).all();
  const parents = all.filter((c) => !c.parentId);
  const childMap = new Map<string, typeof all>();
  for (const cat of all) {
    if (cat.parentId) {
      const list = childMap.get(cat.parentId) ?? [];
      list.push(cat);
      childMap.set(cat.parentId, list);
    }
  }
  return parents.map((p) => ({
    ...p,
    children: childMap.get(p.id) ?? [],
  }));
}

export function getCategory(db: Db, id: string) {
  return db.select().from(categories).where(eq(categories.id, id)).get();
}

export function createCategory(
  db: Db,
  data: { name: string; color?: string | null; parentId?: string | null }
) {
  const id = nanoid();
  db.insert(categories)
    .values({
      id,
      name: data.name,
      color: data.color ?? null,
      parentId: data.parentId ?? null,
    })
    .run();
  return { id, ...data };
}

export function updateCategory(
  db: Db,
  id: string,
  data: { name?: string; color?: string | null; parentId?: string | null }
) {
  db.update(categories).set(data).where(eq(categories.id, id)).run();
}

export function deleteCategory(db: Db, id: string) {
  // Reassign children to no parent before deleting
  db.update(categories)
    .set({ parentId: null })
    .where(eq(categories.parentId, id))
    .run();
  db.delete(categories).where(eq(categories.id, id)).run();
}
