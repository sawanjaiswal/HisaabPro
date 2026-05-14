/**
 * Zod validators for price-list endpoints.
 * All schemas use .strict() to reject unknown keys.
 * Money in paise (Int), percent in basis points (Int).
 */

import { z } from 'zod'

// ── List CRUD ─────────────────────────────────────────────────────────────────

export const createPriceListSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(60, 'Name must be 60 characters or fewer'),
    isDefault: z.boolean().optional(),
  })
  .strict()

export const updatePriceListSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(60, 'Name must be 60 characters or fewer').optional(),
    isDefault: z.boolean().optional(),
  })
  .strict()
  .refine((d) => d.name !== undefined || d.isDefault !== undefined, {
    message: 'At least one of name or isDefault must be provided',
  })

// ── Entry CRUD ────────────────────────────────────────────────────────────────

const modeEnum = z.enum(['ABSOLUTE', 'PERCENT_OFF', 'FIXED_OFF'])

export const createEntrySchema = z
  .object({
    productId: z.string().min(1, 'productId is required'),
    mode: modeEnum,
    valuePaise: z.number().int().positive().optional(),
    percentBps: z.number().int().min(0).max(10000).optional(),
    fixedOffPaise: z.number().int().positive().optional(),
    minQty: z.number().int().min(1, 'minQty must be at least 1'),
    maxQty: z.number().int().positive().optional().nullable(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.mode === 'ABSOLUTE' && !d.valuePaise) {
      ctx.addIssue({ code: 'custom', path: ['valuePaise'], message: 'ABSOLUTE mode requires valuePaise > 0' })
    }
    if (d.mode === 'PERCENT_OFF' && d.percentBps === undefined) {
      ctx.addIssue({ code: 'custom', path: ['percentBps'], message: 'PERCENT_OFF mode requires percentBps (0–10000)' })
    }
    if (d.mode === 'FIXED_OFF' && !d.fixedOffPaise) {
      ctx.addIssue({ code: 'custom', path: ['fixedOffPaise'], message: 'FIXED_OFF mode requires fixedOffPaise > 0' })
    }
    if (d.maxQty !== undefined && d.maxQty !== null && d.maxQty <= d.minQty) {
      ctx.addIssue({ code: 'custom', path: ['maxQty'], message: 'maxQty must be greater than minQty' })
    }
  })

export const updateEntrySchema = z
  .object({
    mode: modeEnum.optional(),
    valuePaise: z.number().int().positive().optional().nullable(),
    percentBps: z.number().int().min(0).max(10000).optional().nullable(),
    fixedOffPaise: z.number().int().positive().optional().nullable(),
    minQty: z.number().int().min(1).optional(),
    maxQty: z.number().int().positive().optional().nullable(),
  })
  .strict()

// ── Bulk assign ───────────────────────────────────────────────────────────────

export const bulkAssignPartiesSchema = z
  .object({
    partyIds: z
      .array(z.string().min(1))
      .min(1, 'At least one partyId required')
      .max(500, 'Cannot assign more than 500 parties at once'),
  })
  .strict()

// ── Type exports ──────────────────────────────────────────────────────────────

export type CreatePriceListInput = z.infer<typeof createPriceListSchema>
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>
export type CreateEntryInput = z.infer<typeof createEntrySchema>
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>
export type BulkAssignPartiesInput = z.infer<typeof bulkAssignPartiesSchema>
