/** GST & Tax — Core type definitions
 *
 * All monetary amounts in PAISE (integer).
 * All rates in BASIS POINTS (1800 = 18.00%).
 *
 * E-compliance types (EInvoice, EWayBill, etc.) → ecompliance.types.ts
 */

// Shared types re-exported from lib for backward compatibility within this feature
export type { TaxCategory } from '@/lib/types/tax.types'

export interface TaxCategoryFormData {
  name: string
  rate: number           // basis points
  cessRate: number
  cessType: 'PERCENTAGE' | 'FIXED_PER_UNIT'
  hsnCode: string
  sacCode: string
}

// ─── HSN / SAC ────────────────────────────────────────────────────────────────

/** HSN code from pre-seeded database */
export interface HsnCode {
  code: string
  description: string
  chapter: string | null
  defaultRate: number    // basis points
  cessApplicable: boolean
  cessRate: number
}

// ─── GSTIN ────────────────────────────────────────────────────────────────────

/** GSTIN verification result */
export interface GstinVerifyResult {
  valid: boolean
  stateCode: string | null
  legalName?: string
  status?: string
  type?: string
  error?: string
}

// ─── Tax calculations ─────────────────────────────────────────────────────────

/** Tax breakdown for a single line item */
export interface LineTaxBreakdown {
  taxableValue: number   // paise
  cgstRate: number       // basis points
  cgstAmount: number     // paise
  sgstRate: number       // basis points
  sgstAmount: number     // paise
  igstRate: number       // basis points
  igstAmount: number     // paise
  cessRate: number       // basis points
  cessAmount: number     // paise
  totalTax: number       // paise
}

/** Document-level tax summary */
export interface DocumentTaxSummary {
  totalTaxableValue: number  // paise
  totalCgst: number          // paise
  totalSgst: number          // paise
  totalIgst: number          // paise
  totalCess: number          // paise
  totalTax: number           // paise
  lineResults: LineTaxBreakdown[]
}

/** Supply type for GSTR categorization */
export type SupplyType = 'B2B' | 'B2C_LARGE' | 'B2C_SMALL' | 'EXPORT' | 'SEZ'
