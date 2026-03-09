import { z } from 'zod';

// Chase credit card CSV columns:
// Transaction Date, Post Date, Description, Category, Type, Amount, Memo
export const ChaseCreditRowSchema = z.object({
  'Transaction Date': z.string(),
  'Post Date': z.string(),
  Description: z.string(),
  Category: z.string().optional(),
  Type: z.string(),
  Amount: z.string(),
  Memo: z.string().optional(),
});

export type ChaseCreditRow = z.infer<typeof ChaseCreditRowSchema>;

export const CHASE_CREDIT_HEADERS = [
  'Transaction Date',
  'Post Date',
  'Description',
  'Category',
  'Type',
  'Amount',
];
