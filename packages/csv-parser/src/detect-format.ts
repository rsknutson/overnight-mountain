import type { CsvFormat } from './schemas/common.js';
import { CHASE_CHECKING_HEADERS } from './schemas/chase-checking.js';
import { CHASE_CREDIT_HEADERS } from './schemas/chase-credit.js';
import { AMAZON_ORDER_HEADERS } from './schemas/amazon-order.js';

/**
 * Parse a raw header line into individual column names.
 * Handles both comma-separated and tab-separated formats.
 */
export function parseHeaderLine(line: string): string[] {
  // If tabs are present and more numerous than commas, treat as TSV
  const tabCount = (line.match(/\t/g) || []).length;
  const commaCount = (line.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';
  return line.split(delimiter).map((h) => h.trim().replace(/"/g, ''));
}

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

  const hasAllAmazonHeaders = AMAZON_ORDER_HEADERS.every((h) =>
    normalized.includes(h)
  );
  if (hasAllAmazonHeaders) return 'amazon-orders';

  return null;
}
