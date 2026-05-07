/**
 * POS Checkout — Tax Calculation Wrapper
 *
 * Wraps the existing tax-calc.ts engine for POS-specific concerns:
 * - Derives place of supply from party (B2B) or business state code (walk-in).
 * - Determines supplyType (B2B vs B2C_SMALL).
 * - Calls calculateLineTax + calculateDocumentTax from tax-calc.ts.
 * - Returns TaxedLine[] and doc-level tax totals.
 */

import {
  calculateLineTax,
  calculateDocumentTax,
  isInterState,
} from '../tax-calc.js'
import type { TaxLineInput, TaxSummary } from '../tax-calc.types.js'
import type { PricedLine, TaxedLine, PartyResolution } from './pos.types.js'

export interface TaxResult {
  taxedLines: TaxedLine[]
  taxSummary: TaxSummary
  grandTotal: number    // paise — grandTotalPreTax + totalTax
  interState: boolean
}

/**
 * Derive supply type from party GSTIN presence.
 * POS is always B2C_SMALL for walk-in; B2B when party has GSTIN.
 */
export function deriveSupplyType(
  partyGstin: string | null
): 'B2B' | 'B2C_SMALL' {
  return partyGstin ? 'B2B' : 'B2C_SMALL'
}

/**
 * Derive place of supply for POS:
 * - Named party with stateCode → use party's stateCode.
 * - Walk-in or party without stateCode → use business stateCode.
 */
export function derivePlaceOfSupply(
  partyResolution: Pick<PartyResolution, 'partyStateCode' | 'partyGstin'>,
  businessStateCode: string | null
): string | null {
  if (partyResolution.partyGstin && partyResolution.partyStateCode) {
    return partyResolution.partyStateCode
  }
  return businessStateCode
}

/**
 * Apply GST to every priced line and compute document totals.
 *
 * @param lines             - Output from pos-checkout.pricing.ts
 * @param businessStateCode - Business stateCode (2-digit)
 * @param party             - Resolved party info
 * @param taxPricingMode    - EXCLUSIVE | INCLUSIVE (POS always EXCLUSIVE for now)
 * @returns TaxResult
 */
export function applyTax(
  lines: PricedLine[],
  businessStateCode: string | null,
  party: PartyResolution,
  taxPricingMode: 'EXCLUSIVE' | 'INCLUSIVE' = 'EXCLUSIVE'
): TaxResult {
  const placeOfSupply = derivePlaceOfSupply(party, businessStateCode)
  const interState = isInterState(businessStateCode, placeOfSupply)

  // Build TaxLineInput[] for the engine
  const taxInputs: TaxLineInput[] = lines.map(l => ({
    lineTotal: l.lineTotal,
    gstRate: l.gstRate,
    cessRate: l.cessRate,
    cessType: l.cessType,
    quantity: l.quantity,
  }))

  const taxSummary = calculateDocumentTax(taxInputs, interState)

  // Merge per-line tax results back into TaxedLine[]
  const taxedLines: TaxedLine[] = lines.map((line, idx) => {
    const lineResult = taxSummary.lineResults[idx]
    const lineTax = calculateLineTax(taxInputs[idx]!, interState)

    // For INCLUSIVE mode, taxableValue should be recalculated. For MVP POS we
    // support EXCLUSIVE only. TODO(PR-followup): inclusive pricing support.
    const taxableValue = taxPricingMode === 'EXCLUSIVE'
      ? line.lineTotal
      : Math.round(line.lineTotal * 10_000 / (10_000 + line.gstRate + line.cessRate))

    return {
      ...line,
      taxableValue,
      cgstRate: lineResult?.cgstRate ?? lineTax.cgstRate,
      cgstAmount: lineResult?.cgstAmount ?? lineTax.cgstAmount,
      sgstRate: lineResult?.sgstRate ?? lineTax.sgstRate,
      sgstAmount: lineResult?.sgstAmount ?? lineTax.sgstAmount,
      igstRate: lineResult?.igstRate ?? lineTax.igstRate,
      igstAmount: lineResult?.igstAmount ?? lineTax.igstAmount,
      cessAmount: lineResult?.cessAmount ?? lineTax.cessAmount,
      totalLineTax: lineResult?.totalTax ?? lineTax.totalTax,
    }
  })

  const grandTotalPreTax = lines.reduce((sum, l) => sum + l.lineTotal, 0)
  const grandTotal = grandTotalPreTax + taxSummary.totalTax

  return { taxedLines, taxSummary, grandTotal, interState }
}
