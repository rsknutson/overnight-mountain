import { CategorizationResponseSchema } from './types.js';
import type {
  CategoryAssignment,
  CategoryInfo,
  TransactionForCategorization,
} from './types.js';
import { buildCategorizationPrompt } from './prompt.js';
import { batchTransactions } from './batch.js';

function getApiKey(): string {
  const apiKey = process.env['GROQ_API_KEY'];
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY environment variable');
  }
  return apiKey;
}

export interface CategorizeOptions {
  agentInstructions?: string;
  userPrompt?: string;
  correctionHistory?: Array<{ description: string; categoryName: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function categorizeTransactions(
  transactions: TransactionForCategorization[],
  categories: CategoryInfo[],
  correctionHistoryOrOptions?:
    | Array<{ description: string; categoryName: string }>
    | CategorizeOptions
): Promise<CategoryAssignment[]> {
  if (transactions.length === 0) return [];

  let options: CategorizeOptions;
  if (Array.isArray(correctionHistoryOrOptions)) {
    options = { correctionHistory: correctionHistoryOrOptions };
  } else {
    options = correctionHistoryOrOptions ?? {};
  }

  // Deduplicate correction history — keep unique description→category pairs
  if (options.correctionHistory && options.correctionHistory.length > 0) {
    const seen = new Set<string>();
    options.correctionHistory = options.correctionHistory.filter((c) => {
      const key = `${c.description}→${c.categoryName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Cap at 30 unique examples
    options.correctionHistory = options.correctionHistory.slice(0, 30);
  }

  const batches = batchTransactions(transactions);
  const allAssignments: CategoryAssignment[] = [];

  for (let i = 0; i < batches.length; i++) {
    const assignments = await categorizeBatch(
      batches[i],
      categories,
      options
    );
    allAssignments.push(...assignments);

    // Only pause between batches if there are multiple
    if (i < batches.length - 1) {
      await sleep(2000);
    }
  }

  return allAssignments;
}

async function callGroq(prompt: string, retries = 3): Promise<string> {
  const apiKey = getApiKey();
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192,
        temperature: 0.1,
      }),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.min(30000, 5000 * Math.pow(2, attempt));
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('No text response from Groq');
    }
    return text;
  }

  throw new Error(
    'Groq API rate limit exceeded after retries. Try again in a minute.'
  );
}

async function categorizeBatch(
  transactions: TransactionForCategorization[],
  categories: CategoryInfo[],
  options: CategorizeOptions
): Promise<CategoryAssignment[]> {
  const prompt = buildCategorizationPrompt(
    transactions,
    categories,
    options.correctionHistory,
    {
      agentInstructions: options.agentInstructions,
      userPrompt: options.userPrompt,
    }
  );

  const text = await callGroq(prompt);

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);
  const validated = CategorizationResponseSchema.parse(parsed);

  const validNames = new Set(categories.map((c) => c.name));
  return validated.assignments.filter((a) => validNames.has(a.categoryName));
}
