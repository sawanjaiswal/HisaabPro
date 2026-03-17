/**
 * Currency Zod Schemas — Multi-Currency Phase 2E
 */

import { z } from 'zod'

// 3-character ISO 4217 currency code
const currencyCodeSchema = z
  .string()
  .length(3)
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code')

export const setExchangeRateSchema = z.object({
  fromCurrency: currencyCodeSchema,
  // rate * 10000 — e.g., 1 USD = 84.5678 INR → 845678
  rate: z.number().int().positive(),
  effectiveDate: z.string().date('Must be a valid date (YYYY-MM-DD)'),
  source: z.enum(['MANUAL', 'API']).default('MANUAL'),
})

export const listExchangeRatesSchema = z.object({
  fromCurrency: currencyCodeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
})

export const convertAmountSchema = z.object({
  fromCurrency: currencyCodeSchema,
  toCurrency: currencyCodeSchema,
  amount: z.number().int().nonnegative('Amount must be a non-negative integer'),
  // Optional — defaults to today on the server side
  date: z.string().date().optional(),
})

export const getExchangeRateSchema = z.object({
  date: z.string().date().optional(),
})

export type SetExchangeRateInput = z.infer<typeof setExchangeRateSchema>
export type ListExchangeRatesInput = z.infer<typeof listExchangeRatesSchema>
export type ConvertAmountInput = z.infer<typeof convertAmountSchema>
export type GetExchangeRateInput = z.infer<typeof getExchangeRateSchema>
