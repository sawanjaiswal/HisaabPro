/** Invoicing & Documents — Pure utility functions (THE CALCULATION ENGINE)
 *
 * No hooks, no side effects. All functions: input → output.
 * All monetary params/return values in PAISE (integer) unless noted.
 *
 * Rule: never use floating-point arithmetic on money directly.
 * Always Math.round() when multiplying paise by a fraction.
 */

import {
  ALLOWED_CONVERSIONS,
  AFFECTS_STOCK,
  AFFECTS_OUTSTANDING,
  DOCUMENT_DIRECTION,
  PAYMENT_TERMS_DAYS,
  INVOICE_NUMBER_PADDING,
  INVOICE_NUMBER_SEPARATOR,
} from './invoice.constants'
import type {
  DocumentType,
  DiscountType,
  ChargeType,
  RoundOffSetting,
  PaymentTerms,
  PaymentStatus,
} from './invoice.types'

// ─── Calculation input types (local to this file) ────────────────────────────
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

// ─── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format paise as Indian ₹ currency string.
 * 1550000 → "₹15,500.00"
 * 100000  → "₹1,000.00"
 * 10000000→ "₹1,00,000.00"
 */
export function formatInvoiceAmount(paise: number): string {
  const rupees = paise / 100
  return rupees.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format an ISO date string as a human-readable date.
 * "2026-03-14T00:00:00.000Z" → "14 Mar 2026"
 */
export function formatInvoiceDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Payment status ────────────────────────────────────────────────────────────

/**
 * Derive payment status from grand total and amount paid (both in paise).
 *
 * PAID    → paidAmount >= grandTotal (fully paid)
 * PARTIAL → paidAmount > 0 but < grandTotal
 * UNPAID  → paidAmount = 0
 */
export function getPaymentStatus(
  grandTotal: number,
  paidAmount: number,
): PaymentStatus {
  if (paidAmount <= 0) return 'UNPAID'
  if (paidAmount >= grandTotal) return 'PAID'
  return 'PARTIAL'
}

// ─── Due date helpers ─────────────────────────────────────────────────────────

/**
 * Days overdue as of today.
 * Returns 0 if not overdue or dueDate is in the future.
 *
 * getDaysOverdue("2026-03-01") with today = 2026-03-15 → 14
 * getDaysOverdue("2026-04-01") with today = 2026-03-15 → 0
 */
export function getDaysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  // Strip time components for a clean day comparison
  due.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  const diffMs = now.getTime() - due.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Calculate due date from document date and payment terms.
 * Returns an ISO date string "YYYY-MM-DD".
 *
 * CUSTOM → returns documentDate unchanged (caller must set explicit due date).
 * COD    → returns documentDate (due same day).
 */
export function calculateDueDate(
  documentDate: string,
  paymentTerms: PaymentTerms,
): string {
  const days = PAYMENT_TERMS_DAYS[paymentTerms]
  const date = new Date(documentDate)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// ─── Document number generation ───────────────────────────────────────────────

/**
 * Generate a formatted document number from its components.
 *
 * generateDocumentNumber('INV', '2526', 1, 3, '-') → "INV-2526-001"
 * generateDocumentNumber('PI',  '2526', 42, 3, '-') → "PI-2526-042"
 * generateDocumentNumber('EST', '2526', 1000, 3, '-') → "EST-2526-1000" (no truncation)
 */
export function generateDocumentNumber(
  prefix: string,
  financialYear: string,
  sequence: number,
  padding: number,
  separator: string,
): string {
  const padded = sequence.toString().padStart(padding, '0')
  return `${prefix}${separator}${financialYear}${separator}${padded}`
}

/**
 * Generate a document number using the default separator and padding.
 * generateDefaultDocumentNumber('INV', '2526', 5) → "INV-2526-005"
 */
export function generateDefaultDocumentNumber(
  prefix: string,
  financialYear: string,
  sequence: number,
): string {
  return generateDocumentNumber(
    prefix,
    financialYear,
    sequence,
    INVOICE_NUMBER_PADDING,
    INVOICE_NUMBER_SEPARATOR,
  )
}

// ─── Financial year ────────────────────────────────────────────────────────────

/**
 * Return the current Indian financial year in SHORT format.
 * Indian FY runs April 1 → March 31.
 *
 * April 2025 – March 2026 → "2526"
 * April 2026 – March 2027 → "2627"
 */
export function getCurrentFinancialYear(): string {
  const now = new Date()
  const month = now.getMonth()  // 0-indexed: 0=Jan, 3=Apr
  const year = now.getFullYear()

  // If month is Jan-Mar (0-2), we are in the tail of the previous FY
  const startYear = month >= 3 ? year : year - 1
  const endYear = startYear + 1

  // "2526" = last 2 digits of startYear + last 2 digits of endYear
  const start2 = String(startYear).slice(-2)
  const end2 = String(endYear).slice(-2)
  return `${start2}${end2}`
}

// ─── Conversion helpers ────────────────────────────────────────────────────────

/**
 * Whether a source document type can be converted to a target type.
 * Returns false for terminal types (SALE_INVOICE, PURCHASE_INVOICE) and invalid combos.
 */
export function isConversionAllowed(
  sourceType: DocumentType,
  targetType: DocumentType,
): boolean {
  const allowed = ALLOWED_CONVERSIONS[sourceType]
  if (!allowed) return false
  return (allowed as DocumentType[]).includes(targetType)
}

// ─── Stock / outstanding effects ─────────────────────────────────────────────

/**
 * The direction in which a document type affects inventory.
 *
 * INCREASE → stock goes up (Purchase Invoice)
 * DECREASE → stock goes down (Sale Invoice, Delivery Challan)
 * NONE     → no stock movement
 */
export function getStockEffect(
  type: DocumentType,
): 'INCREASE' | 'DECREASE' | 'NONE' {
  if (!AFFECTS_STOCK[type]) return 'NONE'
  return DOCUMENT_DIRECTION[type] === 'INWARD' ? 'INCREASE' : 'DECREASE'
}

/**
 * The direction in which a document type affects party outstanding balance.
 *
 * RECEIVABLE → party owes us (Sale Invoice: their balance goes up)
 * PAYABLE    → we owe party  (Purchase Invoice: our liability goes up)
 * NONE       → no outstanding change
 */
export function getOutstandingEffect(
  type: DocumentType,
): 'RECEIVABLE' | 'PAYABLE' | 'NONE' {
  if (!AFFECTS_OUTSTANDING[type]) return 'NONE'
  return DOCUMENT_DIRECTION[type] === 'OUTWARD' ? 'RECEIVABLE' : 'PAYABLE'
}

// ─── Paise ↔ rupees helpers (shared across invoice forms) ────────────────────

/**
 * Convert paise integer to rupees float for form field display.
 * Use formatInvoiceAmount() for display — this is for form pre-population only.
 */
export function paiseToRupees(paise: number): number {
  return paise / 100
}

/**
 * Convert rupees float entered in a form to paise integer for storage.
 * Math.round prevents floating-point drift: 149.99 * 100 = 14998.999…
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}
