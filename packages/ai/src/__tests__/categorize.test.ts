import { describe, it, expect } from 'vitest';
import { buildCategorizationPrompt } from '../prompt.js';
import { batchTransactions } from '../batch.js';
import { CategorizationResponseSchema } from '../types.js';

describe('buildCategorizationPrompt', () => {
  const categories = [
    { id: '1', name: 'Groceries' },
    { id: '2', name: 'Dining' },
    { id: '3', name: 'Transportation' },
  ];

  const transactions = [
    { id: 'txn-1', description: 'WHOLE FOODS', amount: -5000, date: '2024-01-15' },
    { id: 'txn-2', description: 'UBER TRIP', amount: -2500, date: '2024-01-16' },
  ];

  it('includes all categories', () => {
    const prompt = buildCategorizationPrompt(transactions, categories);
    expect(prompt).toContain('Groceries');
    expect(prompt).toContain('Dining');
    expect(prompt).toContain('Transportation');
  });

  it('includes all transactions', () => {
    const prompt = buildCategorizationPrompt(transactions, categories);
    expect(prompt).toContain('WHOLE FOODS');
    expect(prompt).toContain('UBER TRIP');
  });

  it('formats amounts correctly', () => {
    const prompt = buildCategorizationPrompt(transactions, categories);
    expect(prompt).toContain('$-50.00');
    expect(prompt).toContain('$-25.00');
  });

  it('includes correction history when provided', () => {
    const corrections = [{ description: 'WHOLE FOODS', categoryName: 'Groceries' }];
    const prompt = buildCategorizationPrompt(transactions, categories, corrections);
    expect(prompt).toContain('correction history');
    expect(prompt).toContain('WHOLE FOODS');
  });
});

describe('batchTransactions', () => {
  it('creates batches of the correct size', () => {
    const txns = Array.from({ length: 120 }, (_, i) => ({
      id: `txn-${i}`,
      description: `TXN ${i}`,
      amount: -1000,
      date: '2024-01-15',
    }));

    const batches = batchTransactions(txns);
    expect(batches).toHaveLength(3);
    expect(batches[0]).toHaveLength(50);
    expect(batches[1]).toHaveLength(50);
    expect(batches[2]).toHaveLength(20);
  });

  it('handles empty input', () => {
    expect(batchTransactions([])).toHaveLength(0);
  });
});

describe('CategorizationResponseSchema', () => {
  it('validates correct responses', () => {
    const response = {
      assignments: [
        { transactionId: 'txn-1', categoryName: 'Groceries', confidence: 0.95 },
        { transactionId: 'txn-2', categoryName: 'Transportation', confidence: 0.8 },
      ],
    };

    const result = CategorizationResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it('rejects invalid confidence values', () => {
    const response = {
      assignments: [
        { transactionId: 'txn-1', categoryName: 'Groceries', confidence: 1.5 },
      ],
    };

    const result = CategorizationResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const response = {
      assignments: [{ transactionId: 'txn-1' }],
    };

    const result = CategorizationResponseSchema.safeParse(response);
    expect(result.success).toBe(false);
  });
});
