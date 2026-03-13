import type { TransactionForCategorization } from './types.js';

const BATCH_SIZE = 200;

export function batchTransactions(
  transactions: TransactionForCategorization[]
): TransactionForCategorization[][] {
  const batches: TransactionForCategorization[][] = [];
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    batches.push(transactions.slice(i, i + BATCH_SIZE));
  }
  return batches;
}
