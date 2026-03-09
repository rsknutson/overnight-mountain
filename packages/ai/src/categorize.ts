import Anthropic from '@anthropic-ai/sdk';
import { CategorizationResponseSchema } from './types.js';
import type {
  CategoryAssignment,
  CategoryInfo,
  TransactionForCategorization,
} from './types.js';
import { buildCategorizationPrompt } from './prompt.js';
import { batchTransactions } from './batch.js';

let _client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

export async function categorizeTransactions(
  transactions: TransactionForCategorization[],
  categories: CategoryInfo[],
  correctionHistory?: Array<{ description: string; categoryName: string }>
): Promise<CategoryAssignment[]> {
  if (transactions.length === 0) return [];

  const batches = batchTransactions(transactions);
  const allAssignments: CategoryAssignment[] = [];

  for (const batch of batches) {
    const assignments = await categorizeBatch(
      batch,
      categories,
      correctionHistory
    );
    allAssignments.push(...assignments);
  }

  return allAssignments;
}

async function categorizeBatch(
  transactions: TransactionForCategorization[],
  categories: CategoryInfo[],
  correctionHistory?: Array<{ description: string; categoryName: string }>
): Promise<CategoryAssignment[]> {
  const client = getClient();
  const prompt = buildCategorizationPrompt(
    transactions,
    categories,
    correctionHistory
  );

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from AI');
  }

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = textBlock.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);
  const validated = CategorizationResponseSchema.parse(parsed);

  // Filter to only valid category names
  const validNames = new Set(categories.map((c) => c.name));
  return validated.assignments.filter((a) => validNames.has(a.categoryName));
}
