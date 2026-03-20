/**
 * Batch schemas — Phase 4 (#99 Batch Tracking + #105 Expiry Alerts)
 * All prices in paise (integer).
 */

import { z } from 'zod'

export const createBatchSchema = z.object({
  batchNumber: z.string().min(1, 'Batch number is required').max(100),
  manufacturingDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  costPrice: z.number().int().min(0).optional(),     // paise
  salePrice: z.number().int().min(0).optional(),     // paise — batch-specific override
  currentStock: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional(),
})

export const updateBatchSchema = z.object({
  batchNumber: z.string().min(1).max(100).optional(),
  manufacturingDate: z.string().datetime().nullable().optional(),
  expiryDate: z.string().datetime().nullable().optional(),
  costPrice: z.number().int().min(0).nullable().optional(),
  salePrice: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export const listBatchesSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  includeDeleted: z.coerce.boolean().default(false),
})

export const expiringBatchesSchema = z.object({
  daysAhead: z.coerce.number().int().min(1).max(365).default(30),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// === Inferred types ===

export type CreateBatchInput = z.infer<typeof createBatchSchema>
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>
export type ListBatchesQuery = z.infer<typeof listBatchesSchema>
export type ExpiringBatchesQuery = z.infer<typeof expiringBatchesSchema>
