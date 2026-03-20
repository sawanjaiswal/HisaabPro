/**
 * Stock Verification Schemas — Feature #111
 * Zod validation for all stock-verification endpoints.
 */

import { z } from 'zod'

export const createVerificationSchema = z.object({
  notes: z.string().max(500).optional(),
})

export const updateVerificationItemSchema = z.object({
  actualQuantity: z.number().min(0, 'Actual quantity cannot be negative'),
  notes: z.string().max(500).optional(),
})

export const listVerificationsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED']).optional(),
})

export const completeVerificationSchema = z.object({
  notes: z.string().max(500).optional(),
})

// === Inferred types ===

export type CreateVerificationInput = z.infer<typeof createVerificationSchema>
export type UpdateVerificationItemInput = z.infer<typeof updateVerificationItemSchema>
export type ListVerificationsQuery = z.infer<typeof listVerificationsSchema>
export type CompleteVerificationInput = z.infer<typeof completeVerificationSchema>
