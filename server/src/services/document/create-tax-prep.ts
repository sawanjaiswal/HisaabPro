/**
 * Document Create — GST/Tax Pre-processing Helpers
 * Extracted to keep create.ts ≤250 lines.
 */
import { validationError } from '../../lib/errors.js'
import { calculateDocumentTotals } from '../document-calc.js'
import { backCalculateInclusive } from '../tax-calc.js'
import { determineSupplyType } from '../gstin.utils.js'
import type { LineItemCalc } from '../document-calc.js'
import type { DocumentTotalsResult } from '../document-calc.types.js'

interface TaxPrepInput {
  placeOfSupply?: string
  isReverseCharge?: boolean
  taxPricingMode?: string
  isComposite?: boolean
}

interface BusinessContext {
  stateCode: string | null
  compositionScheme: boolean
  gstEnabled: boolean
}

interface TaxCategorySlice {
  /** basis points — the SSOT for what a line tagged with this category is taxed at */
  rate: number
  cessRate: number
  cessType: string
}

interface LineItemSlice {
  productId: string
  quantity: number
  rate: number
  discountType: string
  discountValue: number
  gstRate?: number
  taxCategoryId?: string | null
  /** #133 BOGO — when true, line is treated as rate=0 / discount=0 (giveaway). */
  isFreeItem?: boolean
}

export interface GstPrep {
  taxPricingMode: string
  isComposite: boolean
  isReverseCharge: boolean
  supplyType: string
  totals: DocumentTotalsResult
}

export function assertGstEnabled(
  data: TaxPrepInput,
  business: BusinessContext | null,
): void {
  const hasGstFields = data.placeOfSupply || data.isReverseCharge || data.taxPricingMode === 'INCLUSIVE'
  if (hasGstFields && !business?.gstEnabled) {
    throw validationError(
      'GST is not enabled for this business. Enable GST in settings before using GST fields.',
    )
  }
}

/** Throws 400 if a composition-scheme document has any line with a tax category. */
export function assertCompositionNoLineTax(
  isComposite: boolean,
  lineItems: { taxCategoryId?: string | null }[],
): void {
  if (!isComposite) return
  if (lineItems.some(li => li.taxCategoryId)) {
    throw validationError(
      'Composition scheme invoices (Bill of Supply) must not have line-level tax categories. Remove tax from all lines.',
    )
  }
}

/**
 * Throws 400 if a composition-scheme document is inter-state.
 * Composition dealers cannot make inter-state outward supplies (GST rules).
 */
export function assertCompositionNoInterState(
  isComposite: boolean,
  businessStateCode: string | null,
  placeOfSupply: string | null,
): void {
  if (!isComposite) return
  if (
    businessStateCode &&
    placeOfSupply &&
    businessStateCode.trim() !== placeOfSupply.trim()
  ) {
    throw validationError(
      'Composition taxpayers cannot make inter-state outward supplies.',
    )
  }
}

export function buildCalcItems(
  lineItems: LineItemSlice[],
  productPurchasePrices: Map<string, number>,
  taxCategoryMap: Map<string, TaxCategorySlice>,
  taxPricingMode: string,
  isComposite: boolean,
): LineItemCalc[] {
  return lineItems.map(li => {
    const tc = li.taxCategoryId ? taxCategoryMap.get(li.taxCategoryId) : undefined
    // The rate belongs to the tax category, not to the request: the invoice form
    // posts only `taxCategoryId` (it renders its GST summary from the category's
    // own rate), and a client that could state the rate could bill 0% GST on
    // taxable goods. `li.gstRate` survives only for a line with no category.
    const gstRate = tc?.rate ?? li.gstRate ?? 0
    let effectiveRate = li.rate

    if (taxPricingMode === 'INCLUSIVE' && !isComposite && gstRate > 0) {
      const grossLine = Math.round(li.quantity * li.rate)
      const { taxableValue } = backCalculateInclusive(grossLine, gstRate)
      effectiveRate = li.quantity > 0 ? Math.round(taxableValue / li.quantity) : 0
    }

    // #133 BOGO — free items contribute 0 to revenue, discount, taxable value, and tax.
    // Profit becomes -purchasePrice*qty (cost without revenue) naturally.
    if (li.isFreeItem) {
      return {
        quantity: li.quantity,
        rate: 0,
        discountType: li.discountType,
        discountValue: 0,
        purchasePrice: productPurchasePrices.get(li.productId) || 0,
        gstRate: 0,
        cessRate: 0,
        cessType: tc?.cessType ?? 'PERCENTAGE',
      }
    }

    return {
      quantity: li.quantity,
      rate: effectiveRate,
      discountType: li.discountType,
      discountValue: li.discountValue,
      purchasePrice: productPurchasePrices.get(li.productId) || 0,
      gstRate,
      cessRate: tc?.cessRate ?? 0,
      cessType: tc?.cessType ?? 'PERCENTAGE',
    }
  })
}

export function computeGstTotals(
  calcItems: LineItemCalc[],
  charges: { type: string; value: number }[],
  roundOffSetting: string,
  business: BusinessContext | null,
  placeOfSupply: string | null,
  isComposite: boolean,
  isReverseCharge: boolean,
): DocumentTotalsResult {
  // The RCM rule lives in the calculator (it changes what the customer owes,
  // not just what is reported) — this function only assembles its inputs.
  return calculateDocumentTotals(calcItems, charges, roundOffSetting, {
    businessStateCode: business?.stateCode ?? null,
    placeOfSupply,
    isComposite,
    isReverseCharge,
  })
}

export function resolveSupplyType(partyGstin: string | null, grandTotal: number): string {
  return determineSupplyType(partyGstin, grandTotal)
}
