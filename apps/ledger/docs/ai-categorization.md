# AI Transaction Categorization

## Overview

Ledger uses Claude (Anthropic) to automatically categorize imported transactions into spending categories. The system combines AI-powered classification with user-defined rules and a correction feedback loop.

## Architecture

```
packages/ai/          → AI categorization engine
packages/db/          → Database queries, rules, settings
apps/ledger/          → UI (import, settings, transactions)
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/ai/src/categorize.ts` | Main entry point — batches transactions and calls Claude |
| `packages/ai/src/prompt.ts` | Builds the categorization prompt |
| `packages/ai/src/batch.ts` | Splits transactions into batches of 50 |
| `packages/ai/src/types.ts` | Zod schemas and TypeScript types |
| `packages/db/src/queries/category-rules.ts` | Pattern-based rule matching |
| `packages/db/src/queries/settings.ts` | Auto-categorize setting |

## How It Works

### 1. Trigger

When CSV files are imported, the app checks the `auto_categorize` setting (stored in the `settings` table, defaults to `true`). Users can toggle this from the Settings page.

### 2. AI Classification

The `categorizeTransactions()` function in `@om/ai`:

1. **Batches** transactions into groups of 50 (to stay within token limits)
2. **Builds a prompt** containing:
   - The full list of available category names
   - Each transaction's ID, description, amount (dollars), and date
   - Up to 20 recent user corrections as guidance (optional)
3. **Calls Claude** (`claude-sonnet-4-20250514`) via the Anthropic SDK
4. **Parses the response** — extracts JSON (handles markdown code blocks), validates with Zod
5. **Filters results** to only include valid category names

### 3. Prompt Structure

```
You are a personal finance categorization assistant. Categorize each
transaction into exactly one of these categories:

Categories: Groceries, Dining Out, Rent, Utilities, ...

Transactions to categorize:
- ID: "abc" | Description: "WHOLE FOODS" | Amount: $-85.32 | Date: 2025-01-15
- ...

User correction history (use these as guidance):
- "SPOTIFY" → Entertainment
- ...

Respond with valid JSON:
{ "assignments": [{ "transactionId": "<id>", "categoryName": "<category>", "confidence": <0.0-1.0> }] }

Rules:
- Use ONLY the categories listed above
- Assign exactly one category per transaction
- Set confidence between 0.0 and 1.0
- Positive amounts are typically income/credits
- Negative amounts are expenses/debits
```

### 4. Response Schema

```typescript
{
  assignments: Array<{
    transactionId: string;
    categoryName: string;
    confidence: number; // 0.0 – 1.0
  }>
}
```

Validated with Zod. Only assignments referencing valid category names are kept.

### 5. Applying Results

Each assignment is written to the database via `updateTransactionCategory(db, id, categoryId, 'ai')`, which sets:
- `categoryId` — the matched category
- `categorySource` — `'ai'` (distinguishing it from `'user'`, `'rule'`, or `'chase'`)

## Category Rules (Complementary)

In addition to AI, a rule-based system provides deterministic matching:

- Rules are stored in the `category_rules` table with a `pattern` (substring match) and `priority`
- `applyRules()` checks each transaction description against rules in priority order — first match wins
- Rules can be managed via the UI

## Category Source Tracking

Every transaction tracks *how* it was categorized:

| Source | Meaning |
|--------|---------|
| `ai` | Assigned by Claude |
| `user` | Manually set by the user |
| `rule` | Matched by a category rule |
| `chase` | Came from the CSV data itself |

## Configuration

- **Auto-categorize toggle**: Settings page → "Auto-categorize on Import"
- **API key**: The Anthropic SDK reads `ANTHROPIC_API_KEY` from the environment
- **Model**: `claude-sonnet-4-20250514` (hardcoded in `categorize.ts`)
- **Batch size**: 50 transactions per API call (hardcoded in `batch.ts`)
