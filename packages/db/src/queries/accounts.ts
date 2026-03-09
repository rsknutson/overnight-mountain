import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Db } from '../client.js';
import { accounts } from '../schema/index.js';

export function listAccounts(db: Db) {
  return db.select().from(accounts).all();
}

export function getAccount(db: Db, id: string) {
  return db.select().from(accounts).where(eq(accounts.id, id)).get();
}

export function upsertAccount(
  db: Db,
  data: { name: string; type: 'checking' | 'credit_card' }
) {
  const existing = db
    .select()
    .from(accounts)
    .where(eq(accounts.name, data.name))
    .get();

  if (existing) return existing;

  const id = nanoid();
  db.insert(accounts).values({ id, ...data }).run();
  return { id, ...data };
}
