/**
 * Serial Number schemas — Phase 4 (#100 Serial Number Tracking)
 * Per-unit tracking for high-value products (electronics, equipment, etc.)
 */

import { z } from 'zod'

export const createSerialNumberSchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required').max(100),
  batchId: z.string().optional(),
  godownId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export const bulkCreateSerialNumbersSchema = z.object({
  serialNumbers: z
    .array(z.string().min(1).max(100))
    .min(1, 'At least one serial number is required')
    .max(200, 'Maximum 200 serial numbers per request'),
  batchId: z.string().optional(),
  godownId: z.string().optional(),
})

export const updateSerialNumberSchema = z.object({
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(['AVAILABLE', 'SOLD', 'RETURNED', 'DAMAGED', 'WARRANTY']).optional(),
})

export const listSerialNumbersSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['AVAILABLE', 'SOLD', 'RETURNED', 'DAMAGED', 'WARRANTY']).optional(),
  search: z.string().max(100).optional(),
})

export const serialLookupSchema = z.object({
  serial: z.string().min(1).max(100),
})

// === Inferred types ===

export type CreateSerialNumberInput = z.infer<typeof createSerialNumberSchema>
export type BulkCreateSerialNumbersInput = z.infer<typeof bulkCreateSerialNumbersSchema>
export type UpdateSerialNumberInput = z.infer<typeof updateSerialNumberSchema>
export type ListSerialNumbersQuery = z.infer<typeof listSerialNumbersSchema>
