/**
 * Document Calculation — server-side totals calculation
 * All amounts in PAISE (integer). Must match frontend utils exactly.
 * Extended in Phase 2 to include GST calculations.
 */

import type { TaxLineInput, TaxLineResult } from './tax-calc.types.js'
import { calculateLineTax, isInterState } from './tax-calc.js'
import type {
  LineItemCalc, ChargeCalc, LineResult,
  DocumentTotalsOpts, DocumentTotalsResult,
} from './document-calc.types.js'

export type { LineItemCalc, ChargeCalc, LineResult, DocumentTotalsOpts, DocumentTotalsResult }

export function calculateLineDiscount(
  quantity: number,
  ratePaise: number,
  discountType: string,
  discountValue: number,
): { discountAmount: number; lineTotal: number } {
  const gross = Math.round(quantity * ratePaise)
  let discountAmount = 0

  if (discountType === 'PERCENTAGE' && discountValue > 0) {
    discountAmount = Math.round(gross * discountValue / 10000)
  } else if (discountType === 'AMOUNT' && discountValue > 0) {
    discountAmount = discountValue
  }

  const lineTotal = Math.max(0, gross - discountAmount)
  return { discountAmount, lineTotal }
}

export function calculateChargeAmount(
  subtotalPaise: number,
  chargeType: string,
  chargeValue: number,
): number {
  if (chargeType === 'PERCENTAGE' && chargeValue > 0) {
    return Math.round(subtotalPaise * chargeValue / 10000)
  }
  return chargeValue
}

export function calculateRoundOff(amountPaise: number, roundOffSetting: string): number {
  if (roundOffSetting === 'NONE') return 0
  let roundTo = 100
  if (roundOffSetting === 'NEAREST_050') roundTo = 50
  if (roundOffSetting === 'NEAREST_010') roundTo = 10
  const rounded = Math.round(amountPaise / roundTo) * roundTo
  return rounded - amountPaise
}

/**
 * Calculate full document totals including optional GST.
 * BACKWARD COMPATIBLE — if no opts passed, behaviour is identical to Phase 1.
 */
export function calculateDocumentTotals(
  lineItems: LineItemCalc[],
  charges: ChargeCalc[],
  roundOffSetting: string,
  opts?: DocumentTotalsOpts,
): DocumentTotalsResult {
  const { businessStateCode, placeOfSupply, isComposite } = opts ?? {}
  const taxEnabled = !isComposite
  const interState = isInterState(businessStateCode ?? null, placeOfSupply ?? null)

  let subtotal = 0, totalDiscount = 0, totalCost = 0
  let totalTaxableValue = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0, totalCess = 0
  const lineResults: LineResult[] = []

  for (const item of lineItems) {
    const { discountAmount, lineTotal } = calculateLineDiscount(
      item.quantity, item.rate, item.discountType, item.discountValue,
    )
    subtotal += lineTotal
    totalDiscount += discountAmount

    const cost = Math.round(item.quantity * item.purchasePrice)
    totalCost += cost
    const profit = lineTotal - cost
    const profitPercent = lineTotal > 0 ? Math.round((profit / lineTotal) * 10000) / 100 : 0

    const lineResult: LineResult = { discountAmount, lineTotal, profit, profitPercent }

    if (taxEnabled && item.gstRate != null && item.gstRate > 0) {
      const taxInput: TaxLineInput = {
        lineTotal,
        gstRate: item.gstRate,
        cessRate: item.cessRate ?? 0,
        cessType: (item.cessType as 'PERCENTAGE' | 'FIXED_PER_UNIT') ?? 'PERCENTAGE',
        quantity: item.quantity,
      }
      const tax: TaxLineResult = calculateLineTax(taxInput, interState)

      totalTaxableValue += tax.taxableValue
      totalCgst += tax.cgstAmount
      totalSgst += tax.sgstAmount
      totalIgst += tax.igstAmount
      totalCess += tax.cessAmount

      lineResult.taxableValue = tax.taxableValue
      lineResult.cgstRate = tax.cgstRate
      lineResult.cgstAmount = tax.cgstAmount
      lineResult.sgstRate = tax.sgstRate
      lineResult.sgstAmount = tax.sgstAmount
      lineResult.igstRate = tax.igstRate
      lineResult.igstAmount = tax.igstAmount
      lineResult.cessRate = tax.cessRate
      lineResult.cessAmount = tax.cessAmount
    }

    lineResults.push(lineResult)
  }

  let totalAdditionalCharges = 0
  for (const charge of charges) {
    totalAdditionalCharges += calculateChargeAmount(subtotal, charge.type, charge.value)
  }

  const totalTax = totalCgst + totalSgst + totalIgst + totalCess
  const preRound = subtotal + totalAdditionalCharges + totalTax
  const roundOff = calculateRoundOff(preRound, roundOffSetting)
  const grandTotal = preRound + roundOff
  const totalProfit = grandTotal - totalCost - totalTax
  const profitPercent = grandTotal > 0 ? Math.round((totalProfit / grandTotal) * 10000) / 100 : 0

  return {
    subtotal, totalDiscount, totalAdditionalCharges, roundOff, grandTotal,
    totalCost, totalProfit, profitPercent,
    totalTaxableValue, totalCgst, totalSgst, totalIgst, totalCess, totalTax,
    lineResults,
  }
}
