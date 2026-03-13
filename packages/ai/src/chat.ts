export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface FinancialContext {
  monthlySummary?: {
    month: string;
    totalIncome: number;
    totalExpenses: number;
    net: number;
    transactionCount: number;
    byCategory: Array<{
      categoryName: string | null;
      total: number;
      count: number;
    }>;
  };
  recentTransactions?: Array<{
    date: string;
    description: string;
    amount: number;
    categoryName: string | null;
  }>;
  categories?: Array<{ name: string; transactionCount: number }>;
  amazonOrders?: Array<{
    orderDate: string;
    itemName: string;
    itemTotal: number;
    category: string | null;
    linked: boolean;
  }>;
  agentInstructions?: string;
}

function getApiKey(): string {
  const apiKey = process.env['GROQ_API_KEY'];
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY environment variable');
  }
  return apiKey;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function buildSystemPrompt(context: FinancialContext): string {
  const parts: string[] = [
    `You are a helpful personal finance assistant for a ledger application. You help the user understand their transactions, spending patterns, categories, and Amazon orders. Be concise, specific, and use dollar amounts when discussing finances. All amounts are stored in cents internally but you should always display them as dollars.`,
  ];

  if (context.agentInstructions) {
    parts.push(`\nUser's custom instructions:\n${context.agentInstructions}`);
  }

  if (context.monthlySummary) {
    const s = context.monthlySummary;
    parts.push(
      `\nCurrent month summary (${s.month}):`,
      `- Income: ${formatCents(s.totalIncome)}`,
      `- Expenses: ${formatCents(s.totalExpenses)}`,
      `- Net: ${formatCents(s.net)}`,
      `- Transaction count: ${s.transactionCount}`
    );
    if (s.byCategory.length > 0) {
      parts.push(`- Spending by category:`);
      for (const cat of s.byCategory) {
        parts.push(
          `  - ${cat.categoryName ?? 'Uncategorized'}: ${formatCents(cat.total)} (${cat.count} txns)`
        );
      }
    }
  }

  if (context.categories && context.categories.length > 0) {
    parts.push(`\nCategories in the system:`);
    for (const cat of context.categories) {
      parts.push(`- ${cat.name} (${cat.transactionCount} transactions)`);
    }
  }

  if (context.recentTransactions && context.recentTransactions.length > 0) {
    parts.push(
      `\nRecent transactions (last ${context.recentTransactions.length}):`
    );
    for (const txn of context.recentTransactions) {
      parts.push(
        `- ${txn.date} | ${txn.description} | ${formatCents(txn.amount)} | ${txn.categoryName ?? 'Uncategorized'}`
      );
    }
  }

  if (context.amazonOrders && context.amazonOrders.length > 0) {
    parts.push(
      `\nRecent Amazon orders (last ${context.amazonOrders.length}):`
    );
    for (const order of context.amazonOrders) {
      parts.push(
        `- ${order.orderDate} | ${order.itemName} | ${formatCents(order.itemTotal)} | ${order.category ?? 'No category'} | ${order.linked ? 'Linked to transaction' : 'Unlinked'}`
      );
    }
  }

  return parts.join('\n');
}

export async function chat(
  messages: ChatMessage[],
  context: FinancialContext
): Promise<string> {
  const apiKey = getApiKey();
  const systemPrompt = buildSystemPrompt(context);

  const apiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: apiMessages,
        max_tokens: 2048,
        temperature: 0.3,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('No response from AI');
  }
  return text;
}
