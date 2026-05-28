/**
 * Predictive analytics (#146) — request Zod schemas.
 */

import { z } from 'zod'

export const revenueForecastSchema = z
  .object({
    /** Months of history to fit the trend on (3–24). */
    months: z.coerce.number().int().min(3).max(24).default(6),
    /** Months to project forward (1–6). */
    horizon: z.coerce.number().int().min(1).max(6).default(3),
  })
  .strict()

export const stockForecastSchema = z
  .object({
    /** Lookback window for sales velocity, in days (7–180). */
    windowDays: z.coerce.number().int().min(7).max(180).default(30),
    /** Flag products projected to run out within this many days. */
    horizonDays: z.coerce.number().int().min(1).max(90).default(14),
    /** Max products returned, soonest stock-out first. */
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export type RevenueForecastQuery = z.infer<typeof revenueForecastSchema>
export type StockForecastQuery = z.infer<typeof stockForecastSchema>
