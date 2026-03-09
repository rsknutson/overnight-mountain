import { z } from 'zod';

// Chase checking CSV columns:
// Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #
export const ChaseCheckingRowSchema = z.object({
  Details: z.string(),
  'Posting Date': z.string(),
  Description: z.string(),
  Amount: z.string(),
  Type: z.string(),
  Balance: z.string().optional(),
  'Check or Slip #': z.string().optional(),
});

export type ChaseCheckingRow = z.infer<typeof ChaseCheckingRowSchema>;

export const CHASE_CHECKING_HEADERS = [
  'Details',
  'Posting Date',
  'Description',
  'Amount',
  'Type',
  'Balance',
];
