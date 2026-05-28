/** Smart inventory (#148) — reorder-suggestion request schema. */

import { z } from 'zod'

export const reorderSuggestionSchema = z
  .object({
    /** Lookback window for sales velocity, in days (7–180). */
    windowDays: z.coerce.number().int().min(7).max(180).default(30),
    /** Days a restock takes to arrive (1–90). */
    leadTimeDays: z.coerce.number().int().min(1).max(90).default(7),
    /** Target days of stock to hold after restock arrives (1–180). */
    coverageDays: z.coerce.number().int().min(1).max(180).default(30),
    /** Max products returned, most urgent first. */
    limit: z.coerce.number().int().min(1).max(200).default(50),
    /** When true (default), only return products that need a reorder. */
    onlyNeeded: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
  })
  .strict()

export type ReorderSuggestionQuery = z.infer<typeof reorderSuggestionSchema>
