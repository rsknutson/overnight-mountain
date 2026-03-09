import Papa from 'papaparse';
import { AmazonOrderRowSchema } from '../schemas/amazon-order.js';
import { dollarsToCents } from './utils.js';

export interface NormalizedAmazonOrder {
  orderId: string;
  orderDate: string; // YYYY-MM-DD
  itemName: string;
  category?: string;
  asin?: string;
  quantity: number;
  itemTotal: number; // cents
}

/**
 * Parse Amazon date format (MM/DD/YYYY or YYYY-MM-DD) to ISO date (YYYY-MM-DD).
 */
function parseAmazonDate(dateStr: string): string {
  // Handle MM/DD/YYYY format
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Already YYYY-MM-DD
  return dateStr;
}

export function parseAmazonOrders(csvText: string): NormalizedAmazonOrder[] {
  // Auto-detect delimiter (Amazon reports can be tab-separated)
  const firstLine = csvText.split('\n')[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  const { data, errors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    delimiter,
  });

  if (errors.length > 0) {
    const criticalErrors = errors.filter((e) => e.type !== 'FieldMismatch');
    if (criticalErrors.length > 0) {
      throw new Error(
        `CSV parse errors: ${criticalErrors.map((e) => e.message).join(', ')}`
      );
    }
  }

  const results: NormalizedAmazonOrder[] = [];

  for (const row of data) {
    const parsed = AmazonOrderRowSchema.safeParse(row);
    if (!parsed.success) continue;

    const itemTotalStr = parsed.data['Item Net Total'];
    // Skip rows with no price
    if (!itemTotalStr || itemTotalStr === '$0.00') continue;

    const title = parsed.data.Title;
    // Skip rows with no title
    if (!title || title.trim() === '') continue;

    const orderDate = parseAmazonDate(parsed.data['Order Date']);
    const itemTotal = dollarsToCents(itemTotalStr);

    results.push({
      orderId: parsed.data['Order ID'],
      orderDate,
      itemName: title,
      category: parsed.data['Amazon-Internal Product Category'] || undefined,
      asin: parsed.data.ASIN || undefined,
      quantity: parseInt(parsed.data['Item Quantity'], 10) || 1,
      itemTotal: Math.abs(itemTotal), // always store as positive
    });
  }

  return results;
}
