import type { CsvFormat } from './schemas/common.js';
import { CHASE_CHECKING_HEADERS } from './schemas/chase-checking.js';
import { CHASE_CREDIT_HEADERS } from './schemas/chase-credit.js';

export function detectFormat(headerRow: string[]): CsvFormat | null {
  const normalized = headerRow.map((h) => h.trim());

  const hasAllCheckingHeaders = CHASE_CHECKING_HEADERS.every((h) =>
    normalized.includes(h)
  );
  if (hasAllCheckingHeaders) return 'chase-checking';

  const hasAllCreditHeaders = CHASE_CREDIT_HEADERS.every((h) =>
    normalized.includes(h)
  );
  if (hasAllCreditHeaders) return 'chase-credit';

  return null;
}
