/**
 * Convert a dollar amount string (e.g., "-123.45") to integer cents.
 */
export function dollarsToCents(dollarStr: string): number {
  const cleaned = dollarStr.replace(/[,$\s]/g, '');
  const dollars = parseFloat(cleaned);
  if (isNaN(dollars)) {
    throw new Error(`Invalid dollar amount: ${dollarStr}`);
  }
  return Math.round(dollars * 100);
}

/**
 * Parse Chase date format (MM/DD/YYYY) to ISO date (YYYY-MM-DD).
 */
export function parseChaseDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  const [month, day, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Generate a deterministic external ID for dedup.
 */
export function generateExternalId(
  accountType: string,
  date: string,
  description: string,
  amount: number
): string {
  return `${accountType}:${date}:${description}:${amount}`;
}
