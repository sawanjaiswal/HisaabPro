/**
 * Zod schemas for Cash Register endpoints.
 * Strict mode ensures no extra fields pass through.
 */

import { z } from 'zod'

export const createCashEntrySchema = z
  .object({
    expression: z.string().min(1, 'expression is required').max(100, 'expression too long'),
    direction: z.enum(['IN', 'OUT'], { errorMap: () => ({ message: 'direction must be IN or OUT' }) }),
    note: z.string().max(500, 'note too long').nullable().optional(),
  })
  .strict()

export type CreateCashEntryInput = z.infer<typeof createCashEntrySchema>

export const editCashEntrySchema = z
  .object({
    expression: z.string().min(1, 'expression is required').max(100, 'expression too long').optional(),
    note: z.string().max(500, 'note too long').nullable().optional(),
  })
  .strict()

export type EditCashEntryInput = z.infer<typeof editCashEntrySchema>

export const voidCashEntrySchema = z
  .object({
    reason: z.string().max(200, 'reason too long').nullable().optional(),
  })
  .strict()

export type VoidCashEntryInput = z.infer<typeof voidCashEntrySchema>

export const listCashEntriesQuerySchema = z.object({
  direction: z.enum(['IN', 'OUT']).optional(),
  voided: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  includeVoided: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type ListCashEntriesQuery = z.infer<typeof listCashEntriesQuerySchema>

export const cashSummaryQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d']).default('today'),
  tzOffsetMinutes: z.coerce.number().int().min(-840).max(840).default(330),
})

export type CashSummaryQuery = z.infer<typeof cashSummaryQuerySchema>
