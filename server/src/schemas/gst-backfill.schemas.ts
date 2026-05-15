/**
 * Zod schemas for GST Backfill endpoints.
 * Date range max: 1 year (365 days).
 */

import { z } from 'zod'

const MAX_RANGE_MS = 365 * 24 * 60 * 60 * 1000 // 1 year in ms

export const previewBackfillSchema = z.object({}).strict()

export const executeBackfillSchema = z.object({
  defaultTaxCategoryId: z
    .string({ required_error: 'defaultTaxCategoryId is required' })
    .min(1, 'defaultTaxCategoryId must not be empty'),
  dateRange: z
    .tuple([
      z.coerce.date({ errorMap: () => ({ message: 'dateRange[0] must be a valid date' }) }),
      z.coerce.date({ errorMap: () => ({ message: 'dateRange[1] must be a valid date' }) }),
    ])
    .refine(([start, end]) => start <= end, { message: 'dateRange start must be before end' })
    .refine(
      ([start, end]) => end.getTime() - start.getTime() <= MAX_RANGE_MS,
      { message: 'dateRange cannot exceed 1 year' },
    ),
  setPositionFromParty: z.boolean().default(false),
}).strict()

export type ExecuteBackfillInput = z.infer<typeof executeBackfillSchema>
