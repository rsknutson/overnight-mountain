import { z } from 'zod';

export const NormalizedTransactionSchema = z.object({
  externalId: z.string(),
  date: z.string(), // YYYY-MM-DD
  description: z.string(),
  amount: z.number().int(), // cents, negative = debit, positive = credit
  rawDescription: z.string(),
  accountType: z.enum(['checking', 'credit_card']),
});

export type NormalizedTransaction = z.infer<typeof NormalizedTransactionSchema>;

export type CsvFormat = 'chase-checking' | 'chase-credit' | 'amazon-orders';
