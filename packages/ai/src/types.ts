import { z } from 'zod';

export const CategoryAssignmentSchema = z.object({
  transactionId: z.string(),
  categoryName: z.string(),
  confidence: z.number().min(0).max(1),
});

export const CategorizationResponseSchema = z.object({
  assignments: z.array(CategoryAssignmentSchema),
});

export type CategoryAssignment = z.infer<typeof CategoryAssignmentSchema>;
export type CategorizationResponse = z.infer<typeof CategorizationResponseSchema>;

export interface TransactionForCategorization {
  id: string;
  description: string;
  amount: number; // cents
  date: string;
}

export interface CategoryInfo {
  id: string;
  name: string;
}
