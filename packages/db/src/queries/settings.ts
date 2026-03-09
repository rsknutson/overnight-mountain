import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { settings } from '../schema/index.js';

export function getSetting<T = unknown>(db: Db, key: string): T | undefined {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value as T | undefined;
}

export function setSetting(db: Db, key: string, value: unknown) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function getAutoCategorizeSetting(db: Db): boolean {
  return getSetting<boolean>(db, 'auto_categorize') ?? true;
}
