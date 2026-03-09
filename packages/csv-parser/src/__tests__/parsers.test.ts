import { describe, it, expect } from 'vitest';
import { parseChaseChecking } from '../parsers/chase-checking-parser.js';
import { parseChaseCredit } from '../parsers/chase-credit-parser.js';
import { detectFormat } from '../detect-format.js';
import { dollarsToCents, parseChaseDate, generateExternalId } from '../parsers/utils.js';

describe('dollarsToCents', () => {
  it('converts positive amounts', () => {
    expect(dollarsToCents('123.45')).toBe(12345);
  });

  it('converts negative amounts', () => {
    expect(dollarsToCents('-67.89')).toBe(-6789);
  });

  it('handles dollar signs and commas', () => {
    expect(dollarsToCents('$1,234.56')).toBe(123456);
  });

  it('handles zero', () => {
    expect(dollarsToCents('0.00')).toBe(0);
  });

  it('rounds correctly', () => {
    expect(dollarsToCents('10.005')).toBe(1001);
  });
});

describe('parseChaseDate', () => {
  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(parseChaseDate('01/15/2024')).toBe('2024-01-15');
  });

  it('pads single-digit months and days', () => {
    expect(parseChaseDate('3/5/2024')).toBe('2024-03-05');
  });
});

describe('generateExternalId', () => {
  it('creates deterministic IDs', () => {
    const id1 = generateExternalId('checking', '2024-01-15', 'GROCERY STORE', -5000);
    const id2 = generateExternalId('checking', '2024-01-15', 'GROCERY STORE', -5000);
    expect(id1).toBe(id2);
  });

  it('different inputs produce different IDs', () => {
    const id1 = generateExternalId('checking', '2024-01-15', 'STORE A', -5000);
    const id2 = generateExternalId('checking', '2024-01-15', 'STORE B', -5000);
    expect(id1).not.toBe(id2);
  });
});

describe('detectFormat', () => {
  it('detects Chase checking format', () => {
    const headers = ['Details', 'Posting Date', 'Description', 'Amount', 'Type', 'Balance', 'Check or Slip #'];
    expect(detectFormat(headers)).toBe('chase-checking');
  });

  it('detects Chase credit card format', () => {
    const headers = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo'];
    expect(detectFormat(headers)).toBe('chase-credit');
  });

  it('returns null for unknown format', () => {
    const headers = ['Date', 'Description', 'Amount'];
    expect(detectFormat(headers)).toBeNull();
  });
});

describe('parseChaseChecking', () => {
  const sampleCsv = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/15/2024,GROCERY STORE,-45.67,DEBIT_CARD,1234.56,
CREDIT,01/16/2024,DIRECT DEPOSIT,2500.00,ACH_CREDIT,3734.56,`;

  it('parses transactions correctly', () => {
    const result = parseChaseChecking(sampleCsv);
    expect(result).toHaveLength(2);
  });

  it('normalizes amounts to cents', () => {
    const result = parseChaseChecking(sampleCsv);
    expect(result[0].amount).toBe(-4567);
    expect(result[1].amount).toBe(250000);
  });

  it('normalizes dates to ISO format', () => {
    const result = parseChaseChecking(sampleCsv);
    expect(result[0].date).toBe('2024-01-15');
  });

  it('sets accountType to checking', () => {
    const result = parseChaseChecking(sampleCsv);
    expect(result[0].accountType).toBe('checking');
  });

  it('generates external IDs', () => {
    const result = parseChaseChecking(sampleCsv);
    expect(result[0].externalId).toBeTruthy();
  });
});

describe('parseChaseCredit', () => {
  const sampleCsv = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/10/2024,01/12/2024,RESTAURANT,Food & Drink,Sale,-32.50,
01/11/2024,01/13/2024,PAYMENT THANK YOU,,Payment,500.00,`;

  it('parses transactions correctly', () => {
    const result = parseChaseCredit(sampleCsv);
    expect(result).toHaveLength(2);
  });

  it('normalizes amounts to cents', () => {
    const result = parseChaseCredit(sampleCsv);
    expect(result[0].amount).toBe(-3250);
    expect(result[1].amount).toBe(50000);
  });

  it('uses Post Date for date', () => {
    const result = parseChaseCredit(sampleCsv);
    expect(result[0].date).toBe('2024-01-12');
  });

  it('sets accountType to credit_card', () => {
    const result = parseChaseCredit(sampleCsv);
    expect(result[0].accountType).toBe('credit_card');
  });
});
