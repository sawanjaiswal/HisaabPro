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
