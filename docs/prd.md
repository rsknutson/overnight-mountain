# Ledger — Personal Finance Transaction Tracker

## Problem

Managing personal finances across multiple Chase bank accounts (checking + credit card) requires manually reviewing CSV exports, categorizing transactions, identifying internal transfers, and calculating true monthly spending. This is tedious and error-prone.

## Solution

A web application that imports Chase CSV statements, merges transactions across accounts, intelligently categorizes spending with AI, auto-detects internal transfers, and provides clear monthly spending summaries.

## Users

Personal use (single user, no auth required).

## Functional Requirements

### FR-1: CSV Import

- Upload Chase checking and credit card CSV files
- Auto-detect CSV format from header row (checking vs credit card have different columns)
- Preview parsed transactions before confirming import
- Deduplicate on re-import (same transaction won't be inserted twice)
- Support importing multiple files in sequence

### FR-2: Transaction Management

- View all transactions in a sortable, filterable table
- Filter by: date range, account (checking/credit card), category, search text
- View individual transaction details
- Edit transaction category manually

### FR-3: AI-Powered Categorization

- Auto-categorize transactions on import (toggleable in settings)
- Two-pass system: (1) apply learned rules first, (2) use Anthropic API for remaining
- Manual category override creates a rule for future imports
- On-demand "Categorize" button for uncategorized transactions
- Default categories seeded: Groceries, Dining, Transportation, Entertainment, Utilities, Rent/Mortgage, Shopping, Healthcare, Income, Subscriptions, Travel, Uncategorized

### FR-4: Transfer Detection

- Auto-detect credit card payments from checking account
- Match by: exact amount + posting dates within 3 days + payment keywords in description
- Present matched pairs for user confirmation
- Confirmed transfers excluded from spending calculations
- Dismissed pairs not re-suggested

### FR-5: Monthly Spending Dashboard

- Total income, total expenses, net for selected month
- Breakdown by category (amounts + transaction counts)
- Recent transactions list
- Transfers excluded from totals

### FR-6: Category Management

- Create, edit, delete custom categories
- Each category has a name and optional color
- View transaction count per category

### FR-7: Settings

- Toggle auto-categorization on import (on/off)
- Manage accounts (view imported accounts)

## Non-Functional Requirements

- **NFR-1**: Full TypeScript strict mode, Zod validation at all boundaries
- **NFR-2**: Vitest for unit tests, Testing Library for component tests
- **NFR-3**: SQLite for persistence (zero-infrastructure, file-based)
- **NFR-4**: TanStack ecosystem (Start, Router, Table, DB, Query)
- **NFR-5**: Amounts stored as integers (cents) to avoid floating-point issues
- **NFR-6**: Nx monorepo with shared packages (`@om/*` scope)
- **NFR-7**: Server functions for all DB and AI operations (no direct client-side DB access)

## Out of Scope (v1)

- Multi-user / authentication
- Banks other than Chase
- Budget setting / alerts
- Charts / data visualization
- Mobile responsive design
- Data export
- Recurring transaction detection
