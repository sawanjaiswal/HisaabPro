/**
 * GST Tax Calculation Engine — Pure Functions
 * All amounts in PAISE. Rates in BASIS POINTS (1800 = 18%).
 * Must match frontend tax-calc.utils.ts exactly.
 */

import type { TaxLineInput, TaxLineResult, TaxSummary } from './tax-calc.types.js'
import { PAISE_BASIS_POINTS } from '../../shared/enums.js'

// Re-export types for convenience
export type { TaxLineInput, TaxLineResult, TaxSummary }

/**
 * Determine if inter-state based on place of supply vs business state.
 * If either is null, defaults to intra-state (CGST + SGST).
 */
export function isInterState(
  businessStateCode: string | null,
  placeOfSupply: string | null,
): boolean {
  if (!businessStateCode || !placeOfSupply) return false
  return businessStateCode.trim() !== placeOfSupply.trim()
}

/**
 * Calculate GST for a single line item.
 * Intra-state: CGST = SGST = rate/2, IGST = 0
 * Inter-state: IGST = full rate, CGST = SGST = 0
 */
export function calculateLineTax(input: TaxLineInput, interState: boolean): TaxLineResult {
  const { lineTotal, gstRate, cessRate, cessType, quantity } = input
  const taxableValue = lineTotal

  let cgstRate = 0, cgstAmount = 0
  let sgstRate = 0, sgstAmount = 0
  let igstRate = 0, igstAmount = 0

  if (interState) {
    igstRate = gstRate
    igstAmount = Math.round(taxableValue * igstRate / PAISE_BASIS_POINTS)
  } else {
    cgstRate = Math.floor(gstRate / 2)
    sgstRate = gstRate - cgstRate
    cgstAmount = Math.round(taxableValue * cgstRate / PAISE_BASIS_POINTS)
    sgstAmount = Math.round(taxableValue * sgstRate / PAISE_BASIS_POINTS)
  }

  let cessAmount = 0
  if (cessType === 'PERCENTAGE' && cessRate > 0) {
    cessAmount = Math.round(taxableValue * cessRate / PAISE_BASIS_POINTS)
  } else if (cessType === 'FIXED_PER_UNIT' && cessRate > 0) {
    cessAmount = Math.round(quantity * cessRate)
  }

  const totalTax = cgstAmount + sgstAmount + igstAmount + cessAmount

  return {
    taxableValue, cgstRate, cgstAmount, sgstRate, sgstAmount,
    igstRate, igstAmount, cessRate, cessAmount, totalTax,
  }
}

/** Calculate GST for all line items and return a TaxSummary. */
export function calculateDocumentTax(lines: TaxLineInput[], interState: boolean): TaxSummary {
  const lineResults: TaxLineResult[] = []
  let totalTaxableValue = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalCess = 0

  for (const line of lines) {
    const result = calculateLineTax(line, interState)
    lineResults.push(result)
    totalTaxableValue += result.taxableValue
    totalCgst += result.cgstAmount
    totalSgst += result.sgstAmount
    totalIgst += result.igstAmount
    totalCess += result.cessAmount
  }

  const totalTax = totalCgst + totalSgst + totalIgst + totalCess
  return { totalTaxableValue, totalCgst, totalSgst, totalIgst, totalCess, totalTax, lineResults }
}
