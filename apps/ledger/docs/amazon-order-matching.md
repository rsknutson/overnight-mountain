# Amazon Order Matching

## Overview

Bank statements from Amazon only show generic descriptions like "AMAZON.COM" or "AMZN Mktp US" with no detail about what was actually purchased. This feature lets you import your Amazon order history and match individual items to bank transactions, so you can see exactly what each Amazon charge was for.

## How It Works

### Step 1: Download your Amazon Order Report

1. Go to [Amazon Order Reports](https://www.amazon.com/gp/b2b/reports)
2. Select "Items" as the report type
3. Choose a date range that covers the transactions you want to match
4. Click "Request Report", then download the CSV when ready

The CSV should have these columns: `Order ID`, `Order Date`, `Title`, `Category`, `ASIN/ISBN`, `Quantity`, `Item Total`.

### Step 2: Import the Amazon CSV

1. Go to the **Import** page in Ledger
2. Drop or browse for the Amazon order report CSV (you can import it alongside Chase CSVs in the same batch)
3. The system auto-detects it as an Amazon order report and imports the items
4. Duplicates are skipped based on Order ID + Item Name + Item Total

### Step 3: Match orders to transactions

1. Go to **Transactions** and click on any Amazon transaction (anything with "Amazon" or "AMZN" in the description)
2. On the detail page, you'll see an **Amazon Purchase** section
3. The system suggests matching orders based on:
   - **Date proximity**: orders within 7 days of the transaction date
   - **Amount similarity**: sorted by closest match to the transaction amount
4. Click **Link** on the correct order(s)
5. A single transaction can have multiple linked orders (e.g., one charge for a multi-item shipment)

### Unlinking

If you linked the wrong order, click **Unlink** on the linked order card. The order becomes available for matching to other transactions again.

## Matching Details

### Why matching isn't automatic

Amazon charges don't map cleanly to orders:

- A single order can result in multiple charges (split shipments)
- One charge can cover multiple items
- Tax, discounts, and Subscribe & Save adjustments mean the charge amount rarely matches a single item's price exactly
- There can be several days between the order date and the charge posting date

Because of this, the system **suggests** matches but requires the user to **confirm** the link. This ensures accuracy over convenience.

### What gets stored

For each Amazon order item:

| Field | Description |
|-------|-------------|
| Order ID | Amazon order identifier (e.g., `111-2345678-9012345`) |
| Order Date | When the order was placed |
| Item Name | Product title |
| Category | Amazon's product category |
| ASIN | Amazon Standard Identification Number |
| Quantity | Number of items |
| Item Total | Price in cents |
| Order URL | Direct link to the order on Amazon |

When linked, the `transaction_id` field connects the order to a bank transaction. The order URL is auto-generated from the Order ID: `https://www.amazon.com/gp/your-account/order-details?orderID=<id>`.

## Architecture

### Data Flow

```
Amazon Order CSV
  → parseAmazonOrders() (@om/csv-parser)
  → bulkInsertAmazonOrders() (@om/db)
  → amazon_orders table

Transaction Detail Page
  → detects "amazon" / "amzn" in description
  → findCandidateAmazonOrders() — date ±7 days, sorted by amount closeness
  → getLinkedAmazonOrders() — already matched items
  → user confirms → linkAmazonOrder()
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/csv-parser/src/parsers/amazon-order-parser.ts` | Parses Amazon order report CSV |
| `packages/csv-parser/src/schemas/amazon-order.ts` | Zod schema + header detection |
| `packages/db/src/schema/amazon-orders.ts` | Database table definition |
| `packages/db/src/queries/amazon-orders.ts` | Insert, find candidates, link/unlink |
| `apps/ledger/src/routes/import.tsx` | Import page (handles Amazon CSVs) |
| `apps/ledger/src/routes/transactions.$id.tsx` | Detail page with matching UI |

## Limitations

- Only supports Amazon's order report CSV format (from amazon.com/gp/b2b/reports)
- Matching is manual — the system suggests but doesn't auto-link
- Amazon order data must be imported separately from bank statements
- Tax and shipping are not broken out per-item in the order report, so the item total may not sum to the bank charge exactly
