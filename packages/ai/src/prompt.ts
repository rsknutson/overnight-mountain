import type { CategoryInfo, TransactionForCategorization } from './types.js';

export function buildCategorizationPrompt(
  transactions: TransactionForCategorization[],
  categories: CategoryInfo[],
  correctionHistory?: Array<{ description: string; categoryName: string }>,
  options?: {
    agentInstructions?: string;
    userPrompt?: string;
  }
): string {
  const categoryList = categories.map((c) => c.name).join(', ');

  const txnList = transactions
    .map(
      (t) =>
        `- ID: "${t.id}" | Description: "${t.description}" | Amount: $${(t.amount / 100).toFixed(2)} | Date: ${t.date}`
    )
    .join('\n');

  let prompt = `You are a personal finance categorization assistant. Categorize each transaction into exactly one of these categories:

Categories: ${categoryList}

Transactions to categorize:
${txnList}`;

  if (options?.agentInstructions) {
    prompt += `\n\nAdditional instructions from the user on how to categorize:
${options.agentInstructions}`;
  }

  if (options?.userPrompt) {
    prompt += `\n\nSpecific guidance for this categorization run:
${options.userPrompt}`;
  }

  if (correctionHistory && correctionHistory.length > 0) {
    const corrections = correctionHistory
      .slice(0, 20)
      .map((c) => `- "${c.description}" → ${c.categoryName}`)
      .join('\n');
    prompt += `\n\nUser correction history (use these as guidance):
${corrections}`;
  }

  prompt += `

Respond with valid JSON matching this schema:
{
  "assignments": [
    { "transactionId": "<id>", "categoryName": "<category>", "confidence": <0.0-1.0> }
  ]
}

Rules:
- Use ONLY the categories listed above
- Assign exactly one category per transaction
- Set confidence between 0.0 and 1.0
- Positive amounts are typically income/credits
- Negative amounts are expenses/debits`;

  return prompt;
}
