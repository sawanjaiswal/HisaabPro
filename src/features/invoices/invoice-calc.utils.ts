/** Invoice Calculations — Pure utility functions (THE CALCULATION ENGINE)
 *
 * No hooks, no side effects. All functions: input → output.
 * All monetary params/return values in PAISE (integer) unless noted.
 *
 * Rule: never use floating-point arithmetic on money directly.
 * Always Math.round() when multiplying paise by a fraction.
 */

import type {
  DiscountType,
  ChargeType,
  RoundOffSetting,
} from './invoice.types'

// ─── Calculation input types ────────────────────────────────────────────────
// These are what the calculation engine receives — subset of full domain types.
// The hook provides these from form state; no DB/API shapes leaked in here.

export interface LineItemCalc {
  quantity: number
  /** Rate in PAISE */
  ratePaise: number
  discountType: DiscountType
  /** Absolute PAISE (AMOUNT) or 0-100 percent (PERCENTAGE) */
  discountValue: number
  /** Purchase price snapshot in PAISE — used for profit calculation */
  purchasePricePaise: number
}

export interface ChargeCalc {
  type: ChargeType
  /** Absolute PAISE (FIXED) or 0-100 percent (PERCENTAGE) */
  value: number
}

export interface InvoiceTotals {
  /** Sum of all line totals, in PAISE */
  subtotal: number
  /** Sum of all line discount amounts, in PAISE */
  totalDiscount: number
  /** Sum of all additional charge amounts, in PAISE */
  totalCharges: number
  /** Round-off delta (positive or negative), in PAISE */
  roundOff: number
  /** subtotal - totalDiscount + totalCharges + roundOff, in PAISE */
  grandTotal: number
  /** Sum of (qty × purchasePrice) across all items, in PAISE */
  totalCost: number
  /** grandTotal - totalCost, in PAISE */
  totalProfit: number
  /** totalProfit / grandTotal × 100 (two decimal places) — 0 when grandTotal = 0 */
  profitPercent: number
}

// ─── Line item calculation ─────────────────────────────────────────────────────

/**
 * Calculate the total and discount amount for a single line item.
 *
 * Example (AMOUNT discount):
 *   calculateLineTotal(2, 800000, 'AMOUNT', 50000)
 *   → qty=2, rate=₹8000, discount=₹500 flat
 *   → gross = 2 × 800000 = 1600000
 *   → discountAmount = 50000
 *   → lineTotal = 1550000 (₹15,500)
 *
 * Example (PERCENTAGE discount):
 *   calculateLineTotal(3, 100000, 'PERCENTAGE', 10)
 *   → gross = 300000, discount = 10% of 300000 = 30000
 *   → lineTotal = 270000
 */
export function calculateLineTotal(
  qty: number,
  ratePaise: number,
  discountType: DiscountType,
  discountValue: number,
): { lineTotal: number; discountAmount: number } {
  const gross = Math.round(qty * ratePaise)
  const discountAmount = calculateDiscount(gross, discountType, discountValue)
  const lineTotal = gross - discountAmount
  return { lineTotal, discountAmount }
}

// ─── Discount calculation ──────────────────────────────────────────────────────

/**
 * Calculate the discount amount in paise.
 *
 * AMOUNT: discountValue is already in paise — returned as-is (capped at subtotal).
 * PERCENTAGE: discountValue is 0-100 — returns Math.round(subtotalPaise × value / 100).
 */
export function calculateDiscount(
  subtotalPaise: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  if (discountValue <= 0) return 0
  if (discountType === 'AMOUNT') {
    // Discount cannot exceed the line gross
    return Math.min(discountValue, subtotalPaise)
  }
  // PERCENTAGE: cap at 100%
  const pct = Math.min(discountValue, 100)
  return Math.round((subtotalPaise * pct) / 100)
}

// ─── Additional charge calculation ────────────────────────────────────────────

/**
 * Calculate additional charge amount in paise.
 *
 * FIXED: chargeValue is in paise.
 * PERCENTAGE: chargeValue is 0-100, applied to subtotal after line discounts.
 */
export function calculateChargeAmount(
  subtotalPaise: number,
  chargeType: ChargeType,
  chargeValue: number,
): number {
  if (chargeValue <= 0) return 0
  if (chargeType === 'FIXED') return chargeValue
  const pct = Math.min(chargeValue, 100)
  return Math.round((subtotalPaise * pct) / 100)
}

// ─── Subtotal / totals ────────────────────────────────────────────────────────

/**
 * Sum of all line totals (after per-line discounts), in paise.
 */
export function calculateSubtotal(lineItems: LineItemCalc[]): number {
  return lineItems.reduce((sum, item) => {
    const { lineTotal } = calculateLineTotal(
      item.quantity,
      item.ratePaise,
      item.discountType,
      item.discountValue,
    )
    return sum + lineTotal
  }, 0)
}

/**
 * Sum of all line discount amounts, in paise.
 */
export function calculateTotalDiscount(lineItems: LineItemCalc[]): number {
  return lineItems.reduce((sum, item) => {
    const { discountAmount } = calculateLineTotal(
      item.quantity,
      item.ratePaise,
      item.discountType,
      item.discountValue,
    )
    return sum + discountAmount
  }, 0)
}

/**
 * Sum of all additional charge amounts, in paise.
 * Percentage charges use the subtotalPaise (after line discounts) as base.
 */
export function calculateTotalCharges(
  charges: ChargeCalc[],
  subtotalPaise: number,
): number {
  return charges.reduce(
    (sum, charge) =>
      sum + calculateChargeAmount(subtotalPaise, charge.type, charge.value),
    0,
  )
}

// ─── Round-off calculation ─────────────────────────────────────────────────────

/**
 * Compute the round-off delta in paise.
 *
 * Returns the amount to ADD to get the rounded value.
 * (May be negative when rounding down.)
 *
 * NONE        → 0
 * NEAREST_010 → round to nearest 10 paise (₹0.10)
 * NEAREST_050 → round to nearest 50 paise (₹0.50)
 * NEAREST_1   → round to nearest 100 paise (₹1)
 *
 * Example: amountPaise = 15175, NEAREST_050 (50p)
 *   → 15175 / 50 = 303.5 → round to 304 × 50 = 15200
 *   → delta = 15200 - 15175 = +25
 */
export function calculateRoundOff(
  amountPaise: number,
  setting: RoundOffSetting,
): number {
  if (setting === 'NONE') return 0

  const unitPaise =
    setting === 'NEAREST_010' ? 10
    : setting === 'NEAREST_050' ? 50
    : 100  // NEAREST_1 = ₹1 = 100 paise

  const rounded = Math.round(amountPaise / unitPaise) * unitPaise
  return rounded - amountPaise
}

// ─── Grand total ──────────────────────────────────────────────────────────────

/**
 * Final payable amount in paise.
 *
 * grandTotal = subtotal - totalDiscount + totalCharges + roundOff
 * Guaranteed >= 0 (clamped).
 */
export function calculateGrandTotal(
  subtotal: number,
  totalDiscount: number,
  totalCharges: number,
  roundOff: number,
): number {
  return Math.max(0, subtotal - totalDiscount + totalCharges + roundOff)
}

