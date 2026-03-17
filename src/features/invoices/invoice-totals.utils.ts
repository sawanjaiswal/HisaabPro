/** Invoice Totals — Profit calculation + orchestrator
 *
 * No hooks, no side effects. All functions: input → output.
 * All monetary params/return values in PAISE (integer).
 *
 * Depends on invoice-calc.utils.ts for primitive calculations.
 */

import type { RoundOffSetting } from './invoice.types'
import {
  calculateLineTotal,
  calculateSubtotal,
  calculateTotalDiscount,
  calculateTotalCharges,
  calculateRoundOff,
  calculateGrandTotal,
} from './invoice-calc.utils'
import type { LineItemCalc, ChargeCalc, InvoiceTotals } from './invoice-calc.utils'

// ─── Profit calculation ────────────────────────────────────────────────────────

/**
 * Profit for a single line item, in paise and percent.
 *
 * profit = lineTotal - (qty × purchasePricePaise)
 * profitPercent = profit / lineTotal × 100  (0 when lineTotal = 0)
 */
export function calculateLineProfit(
  ratePaise: number,
  purchasePricePaise: number,
  qty: number,
  discountAmountPaise: number,
): { profit: number; profitPercent: number } {
  const lineTotal = Math.round(qty * ratePaise) - discountAmountPaise
  const lineCost = Math.round(qty * purchasePricePaise)
  const profit = lineTotal - lineCost
  const profitPercent =
    lineTotal === 0 ? 0 : Math.round((profit / lineTotal) * 10000) / 100
  return { profit, profitPercent }
}

/**
 * Aggregate profit across all line items.
 *
 * Returns totalCost, totalProfit, and overall profitPercent.
 * profitPercent = totalProfit / grandTotal × 100.
 * grandTotal here = sum of lineTotals (charge/round-off profit is not tracked).
 */
export function calculateTotalProfit(lineItems: LineItemCalc[]): {
  totalCost: number
  totalProfit: number
  profitPercent: number
} {
  let totalCost = 0
  let totalRevenue = 0

  for (const item of lineItems) {
    const { lineTotal, discountAmount } = calculateLineTotal(
      item.quantity,
      item.ratePaise,
      item.discountType,
      item.discountValue,
    )
    const lineCost = Math.round(item.quantity * item.purchasePricePaise)
    totalRevenue += lineTotal
    totalCost += lineCost
    // discountAmount is already subtracted from lineTotal above
    void discountAmount
  }

  const totalProfit = totalRevenue - totalCost
  const profitPercent =
    totalRevenue === 0
      ? 0
      : Math.round((totalProfit / totalRevenue) * 10000) / 100
  return { totalCost, totalProfit, profitPercent }
}

// ─── Main calculation orchestrator ───────────────────────────────────────────

/**
 * THE main function — computes all invoice totals in a single pass.
 *
 * Call this whenever any line item or charge changes.
 * All returned values are in PAISE.
 */
export function calculateInvoiceTotals(
  lineItems: LineItemCalc[],
  charges: ChargeCalc[],
  roundOffSetting: RoundOffSetting,
): InvoiceTotals {
  const subtotal = calculateSubtotal(lineItems)
  const totalDiscount = calculateTotalDiscount(lineItems)
  const totalCharges = calculateTotalCharges(charges, subtotal)

  const preRoundTotal = subtotal - totalDiscount + totalCharges
  const roundOff = calculateRoundOff(preRoundTotal, roundOffSetting)
  const grandTotal = calculateGrandTotal(subtotal, totalDiscount, totalCharges, roundOff)

  const { totalCost, totalProfit, profitPercent } = calculateTotalProfit(lineItems)

  return {
    subtotal,
    totalDiscount,
    totalCharges,
    roundOff,
    grandTotal,
    totalCost,
    totalProfit,
    profitPercent,
  }
}
