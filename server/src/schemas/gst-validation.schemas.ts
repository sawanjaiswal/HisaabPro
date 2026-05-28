/**
 * Query schema for the GST filing-readiness validator (#144).
 * Mirrors the period/returnType shape used by gstReturnSchema.
 */

import { z } from 'zod'

export const filingReadinessSchema = z
  .object({
    returnType: z.enum(['GSTR1', 'GSTR3B']).default('GSTR1'),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be YYYY-MM'),
  })
  .strict()

export type FilingReadinessQuery = z.infer<typeof filingReadinessSchema>
