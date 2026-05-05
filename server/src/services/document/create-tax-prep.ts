/**
 * Document Create — GST/Tax Pre-processing Helpers
 * Extracted to keep create.ts ≤250 lines.
 */
import { validationError } from '../../lib/errors.js'
import { calculateDocumentTotals } from '../document-calc.js'
import { backCalculateInclusive, applyRcmFlag } from '../tax-calc.js'
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
  taxCategoryId?: string
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

export function buildCalcItems(
  lineItems: LineItemSlice[],
  productPurchasePrices: Map<string, number>,
  taxCategoryMap: Map<string, TaxCategorySlice>,
  taxPricingMode: string,
  isComposite: boolean,
): LineItemCalc[] {
  return lineItems.map(li => {
    const tc = li.taxCategoryId ? taxCategoryMap.get(li.taxCategoryId) : undefined
    let effectiveRate = li.rate

    if (taxPricingMode === 'INCLUSIVE' && !isComposite && li.gstRate && li.gstRate > 0) {
      const grossLine = Math.round(li.quantity * li.rate)
      const { taxableValue } = backCalculateInclusive(grossLine, li.gstRate)
      effectiveRate = li.quantity > 0 ? Math.round(taxableValue / li.quantity) : 0
    }

    return {
      quantity: li.quantity,
      rate: effectiveRate,
      discountType: li.discountType,
      discountValue: li.discountValue,
      purchasePrice: productPurchasePrices.get(li.productId) || 0,
      gstRate: li.gstRate,
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
  const rawTotals = calculateDocumentTotals(calcItems, charges, roundOffSetting, {
    businessStateCode: business?.stateCode ?? null,
    placeOfSupply,
    isComposite,
  })

  if (!isReverseCharge) return rawTotals

  const rcm = applyRcmFlag(
    {
      totalTaxableValue: rawTotals.totalTaxableValue,
      totalCgst: rawTotals.totalCgst,
      totalSgst: rawTotals.totalSgst,
      totalIgst: rawTotals.totalIgst,
      totalCess: rawTotals.totalCess,
      totalTax: rawTotals.totalTax,
      lineResults: [],
    },
    true,
  )

  return {
    ...rawTotals,
    totalCgst: rcm.totalCgst,
    totalSgst: rcm.totalSgst,
    totalIgst: rcm.totalIgst,
    totalCess: rcm.totalCess,
    totalTax: rcm.totalTax,
  }
}

export function resolveSupplyType(partyGstin: string | null, grandTotal: number): string {
  return determineSupplyType(partyGstin, grandTotal)
}
