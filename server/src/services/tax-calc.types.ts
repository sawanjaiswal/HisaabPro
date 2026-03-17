/**
 * Tax calculation types — shared across tax-calc.ts and document-calc.ts
 * All amounts in PAISE. Rates in BASIS POINTS.
 */

export interface TaxLineInput {
  lineTotal: number            // paise — taxable value (after discount)
  gstRate: number              // basis points (e.g. 1800 = 18%)
  cessRate: number             // basis points
  cessType: 'PERCENTAGE' | 'FIXED_PER_UNIT'
  quantity: number             // for FIXED_PER_UNIT cess
}

export interface TaxLineResult {
  taxableValue: number         // paise — same as lineTotal
  cgstRate: number             // basis points (half of gstRate)
  cgstAmount: number           // paise
  sgstRate: number             // basis points (half of gstRate)
  sgstAmount: number           // paise
  igstRate: number             // basis points (full gstRate if inter-state)
  igstAmount: number           // paise
  cessRate: number             // basis points
  cessAmount: number           // paise
  totalTax: number             // paise — sum of all tax components
}

export interface TaxSummary {
  totalTaxableValue: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalCess: number
  totalTax: number
  lineResults: TaxLineResult[]
}
