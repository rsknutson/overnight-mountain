import { z } from 'zod';

// Amazon Business Order Reports CSV columns
export const AmazonOrderRowSchema = z.object({
  'Order Date': z.string(),
  'Order ID': z.string(),
  Title: z.string(),
  ASIN: z.string().optional(),
  'Item Quantity': z.string(),
  'Item Subtotal': z.string(),
  'Item Tax': z.string().optional(),
  'Item Net Total': z.string(),
  'Amazon-Internal Product Category': z.string().optional(),
  Brand: z.string().optional(),
  'Seller Name': z.string().optional(),
  'Order Status': z.string().optional(),
});

export type AmazonOrderRow = z.infer<typeof AmazonOrderRowSchema>;

// Minimum headers needed to identify this as an Amazon order report
export const AMAZON_ORDER_HEADERS = [
  'Order ID',
  'Order Date',
  'Title',
  'ASIN',
  'Item Quantity',
  'Item Net Total',
];
