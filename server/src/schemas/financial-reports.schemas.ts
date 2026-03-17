/**
 * Financial Reports Zod Schemas — validation for all financial report query params
 */

import { z } from 'zod'

// === P&L / Cash Flow / Tally Export — date range ===

export const periodQuerySchema = z.object({
  from: z.coerce.date({ message: 'from must be a valid date' }),
  to: z.coerce.date({ message: 'to must be a valid date' }),
})

export type PeriodQuery = z.infer<typeof periodQuerySchema>

// === Balance Sheet — point in time ===

export const balanceSheetQuerySchema = z.object({
  asOf: z.coerce.date({ message: 'asOf must be a valid date' }),
})

export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>

// === Aging Report ===

export const agingQuerySchema = z.object({
  type: z.enum(['RECEIVABLE', 'PAYABLE']),
  asOf: z.coerce.date({ message: 'asOf must be a valid date' }).optional(),
})

export type AgingQuery = z.infer<typeof agingQuerySchema>

// === Profitability Report ===

export const profitabilityQuerySchema = z.object({
  from: z.coerce.date({ message: 'from must be a valid date' }),
  to: z.coerce.date({ message: 'to must be a valid date' }),
  groupBy: z.enum(['PARTY', 'PRODUCT', 'DOCUMENT']).default('PARTY'),
})

export type ProfitabilityQuery = z.infer<typeof profitabilityQuerySchema>

// === Cash Flow Statement ===

export const cashFlowQuerySchema = z.object({
  from: z.coerce.date({ message: 'from must be a valid date' }),
  to: z.coerce.date({ message: 'to must be a valid date' }),
})

export type CashFlowQuery = z.infer<typeof cashFlowQuerySchema>

// === Tally Export ===

export const tallyExportQuerySchema = z.object({
  from: z.coerce.date({ message: 'from must be a valid date' }),
  to: z.coerce.date({ message: 'to must be a valid date' }),
})

export type TallyExportQuery = z.infer<typeof tallyExportQuerySchema>

// === Discount Report ===

export const discountQuerySchema = z.object({
  from: z.coerce.date({ message: 'from must be a valid date' }),
  to: z.coerce.date({ message: 'to must be a valid date' }),
})

export type DiscountQuery = z.infer<typeof discountQuerySchema>
