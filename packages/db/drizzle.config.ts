import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env['LEDGER_DB_PATH'] ?? 'ledger.db',
  },
});
