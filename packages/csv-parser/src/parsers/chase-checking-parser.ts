import Papa from 'papaparse';
import { ChaseCheckingRowSchema } from '../schemas/chase-checking.js';
import type { NormalizedTransaction } from '../schemas/common.js';
import { dollarsToCents, generateExternalId, parseChaseDate } from './utils.js';

export function parseChaseChecking(csvText: string): NormalizedTransaction[] {
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
    const parsed = ChaseCheckingRowSchema.safeParse(row);
    if (!parsed.success) continue;

    const { Description, Amount } = parsed.data;
    const postingDate = parsed.data['Posting Date'];
    const date = parseChaseDate(postingDate);
    const amount = dollarsToCents(Amount);

    results.push({
      externalId: generateExternalId('checking', date, Description, amount),
      date,
      description: Description,
      amount,
      rawDescription: Description,
      accountType: 'checking',
    });
  }

  return results;
}
