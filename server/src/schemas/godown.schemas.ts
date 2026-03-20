/**
 * Godown schemas — Phase 4 (#101 Multi-Godown)
 * Quantities are integers (unit-level, not paise).
 */

import { z } from 'zod'

export const createGodownSchema = z.object({
  name: z.string().min(1, 'Godown name is required').max(100),
  address: z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
})

export const updateGodownSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
})

export const godownStockQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().max(100).optional(),
})

export const transferStockSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  fromGodownId: z.string().min(1, 'Source godown is required'),
  toGodownId: z.string().min(1, 'Destination godown is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  batchId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export const transferHistorySchema = z.object({
  productId: z.string().optional(),
  godownId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// === Inferred types ===

export type CreateGodownInput = z.infer<typeof createGodownSchema>
export type UpdateGodownInput = z.infer<typeof updateGodownSchema>
export type GodownStockQuery = z.infer<typeof godownStockQuerySchema>
export type TransferStockInput = z.infer<typeof transferStockSchema>
export type TransferHistoryQuery = z.infer<typeof transferHistorySchema>
