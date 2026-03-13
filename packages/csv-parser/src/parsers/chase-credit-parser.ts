import Papa from 'papaparse';
import { ChaseCreditRowSchema } from '../schemas/chase-credit.js';
import type { NormalizedTransaction } from '../schemas/common.js';
import { dollarsToCents, generateExternalId, parseChaseDate } from './utils.js';

export function parseChaseCredit(csvText: string): NormalizedTransaction[] {
  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (errors.length > 0) {
    const criticalErrors = errors.filter((e) => e.type !== 'FieldMismatch');
    if (criticalErrors.length > 0) {
      throw new Error(
        `CSV parse errors: ${criticalErrors.map((e) => e.message).join(', ')}`
      );
    }
  }

  const results: NormalizedTransaction[] = [];

  for (const row of data) {
    const parsed = ChaseCreditRowSchema.safeParse(row);
    if (!parsed.success) continue;

    const { Description, Amount } = parsed.data;
    const transactionDate = parsed.data['Transaction Date'];
    const date = parseChaseDate(transactionDate);
    const amount = dollarsToCents(Amount);

    results.push({
      externalId: generateExternalId('credit', date, Description, amount),
      date,
      description: Description,
      amount,
      rawDescription: Description,
      accountType: 'credit_card',
    });
  }

  return results;
}
