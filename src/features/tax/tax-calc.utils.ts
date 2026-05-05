/**
 * GST Tax Calculation — Pure Functions
 * MUST match server/src/services/tax-calc.ts exactly.
 * All amounts in PAISE. Rates in BASIS POINTS.
 */

import type { LineTaxBreakdown, DocumentTaxSummary } from './tax.types'
import { PAISE_BASIS_POINTS } from '@shared/enums'

export interface TaxLineInput {
  lineTotal: number       // paise (taxable value after discount)
  gstRate: number         // basis points (e.g. 1800 = 18%)
  cessRate: number        // basis points
  cessType: 'PERCENTAGE' | 'FIXED_PER_UNIT'
  quantity: number
}

/** Check if inter-state (IGST) vs intra-state (CGST+SGST) */
export function isInterState(
  businessStateCode: string | null,
  placeOfSupply: string | null,
): boolean {
  if (!businessStateCode || !placeOfSupply) return false
  return businessStateCode.trim() !== placeOfSupply.trim()
}

/** Calculate tax for a single line item */
export function calculateLineTax(
  input: TaxLineInput,
  interState: boolean,
): LineTaxBreakdown {
  const { lineTotal, gstRate, cessRate, cessType, quantity } = input
  const taxableValue = lineTotal

  let cgstRate = 0, cgstAmount = 0
  let sgstRate = 0, sgstAmount = 0
  let igstRate = 0, igstAmount = 0

  if (gstRate > 0) {
    if (interState) {
      igstRate = gstRate
      igstAmount = Math.round(taxableValue * igstRate / PAISE_BASIS_POINTS)
    } else {
      cgstRate = Math.floor(gstRate / 2)
      sgstRate = gstRate - cgstRate
      cgstAmount = Math.round(taxableValue * cgstRate / PAISE_BASIS_POINTS)
      sgstAmount = Math.round(taxableValue * sgstRate / PAISE_BASIS_POINTS)
    }
  }

  let cessAmount = 0
  if (cessRate > 0) {
    cessAmount = cessType === 'FIXED_PER_UNIT'
      ? Math.round(quantity * cessRate)
      : Math.round(taxableValue * cessRate / PAISE_BASIS_POINTS)
  }

  const totalTax = cgstAmount + sgstAmount + igstAmount + cessAmount

  return {
    taxableValue, cgstRate, cgstAmount, sgstRate, sgstAmount,
    igstRate, igstAmount, cessRate, cessAmount, totalTax,
  }
}

/** Calculate tax summary for all line items */
export function calculateDocumentTax(
  lines: TaxLineInput[],
  interState: boolean,
): DocumentTaxSummary {
  let totalTaxableValue = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalCess = 0
  const lineResults: LineTaxBreakdown[] = []

  for (const line of lines) {
    const result = calculateLineTax(line, interState)
    totalTaxableValue += result.taxableValue
    totalCgst += result.cgstAmount
    totalSgst += result.sgstAmount
    totalIgst += result.igstAmount
    totalCess += result.cessAmount
    lineResults.push(result)
  }

  const totalTax = totalCgst + totalSgst + totalIgst + totalCess
  return { totalTaxableValue, totalCgst, totalSgst, totalIgst, totalCess, totalTax, lineResults }
}

/**
 * Back-calculate taxable value from a tax-inclusive line total.
 * taxableValue = round(lineTotal × 10000 / (10000 + gstRateBP))
 * gstAmount    = lineTotal − taxableValue
 * Integer paise math; single rounding boundary.
 */
export function backCalculateInclusive(
  lineTotalPaise: number,
  gstRateBP: number,
): { taxableValue: number; gstAmount: number } {
  if (gstRateBP <= 0) return { taxableValue: lineTotalPaise, gstAmount: 0 }
  const taxableValue = Math.round((lineTotalPaise * PAISE_BASIS_POINTS) / (PAISE_BASIS_POINTS + gstRateBP))
  const gstAmount = lineTotalPaise - taxableValue
  return { taxableValue, gstAmount }
}

/**
 * Apply RCM flag to a DocumentTaxSummary.
 * When isRcm=true, zero out all GST/Cess totals at document level
 * (line amounts are retained for audit). Cess is zeroed too per GSTN spec.
 */
export function applyRcmFlag(summary: DocumentTaxSummary, isRcm: boolean): DocumentTaxSummary {
  if (!isRcm) return summary
  return {
    ...summary,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalCess: 0,
    totalTax: 0,
  }
}

/**
 * Calculate composition scheme totals.
 * Composition taxpayers pay a flat % on taxable turnover; no GST in lines.
 * compositionLiability is transient — never written to line tax columns.
 */
export function calculateCompositionTotals(
  lines: TaxLineInput[],
  compositionRateBP: number,
): { taxableTurnover: number; compositionLiability: number } {
  const taxableTurnover = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const compositionLiability = Math.round(taxableTurnover * compositionRateBP / PAISE_BASIS_POINTS)
  return { taxableTurnover, compositionLiability }
}
