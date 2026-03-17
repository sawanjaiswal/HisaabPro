/**
 * Document Calculation types — shared across document-calc.ts
 */

export interface LineItemCalc {
  quantity: number
  rate: number            // paise
  discountType: string
  discountValue: number
  purchasePrice: number   // paise
  // Phase 2 — optional GST fields
  gstRate?: number        // basis points
  cessRate?: number       // basis points
  cessType?: string       // 'PERCENTAGE' | 'FIXED_PER_UNIT'
}

export interface ChargeCalc {
  type: string
  value: number           // paise for FIXED, basis points for PERCENTAGE
}

export interface LineResult {
  discountAmount: number
  lineTotal: number
  profit: number
  profitPercent: number
  // Phase 2 tax fields — present when GST params are provided
  taxableValue?: number
  cgstRate?: number
  cgstAmount?: number
  sgstRate?: number
  sgstAmount?: number
  igstRate?: number
  igstAmount?: number
  cessRate?: number
  cessAmount?: number
}

export interface DocumentTotalsOpts {
  businessStateCode?: string | null
  placeOfSupply?: string | null
  isComposite?: boolean
  isReverseCharge?: boolean
}

export interface DocumentTotalsResult {
  subtotal: number
  totalDiscount: number
  totalAdditionalCharges: number
  roundOff: number
  grandTotal: number
  totalCost: number
  totalProfit: number
  profitPercent: number
  totalTaxableValue: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalCess: number
  totalTax: number
  lineResults: LineResult[]
}
