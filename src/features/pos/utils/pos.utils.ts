/** POS — Pure utility functions (no side effects, no API calls) */

import type { PosCartItem, PosCartTotals, PaymentSplit } from '../types/pos.types'

/** Line total for a single cart item (paise) */
export function lineTotal(item: PosCartItem): number {
  return item.quantity * item.unitPrice - item.discount
}

/** Tax amount for a single line based on taxRate percent */
export function lineTax(item: PosCartItem): number {
  const taxable = lineTotal(item)
  return Math.round(taxable * item.taxRate / 100)
}

/** Build cart totals from all items */
export function buildCartTotals(items: PosCartItem[]): PosCartTotals {
  let subtotal = 0
  let totalDiscount = 0
  let totalTaxable = 0
  let totalTax = 0

  for (const item of items) {
    const gross = item.quantity * item.unitPrice
    const disc  = item.discount
    const net   = gross - disc
    const tax   = Math.round(net * item.taxRate / 100)
    subtotal      += gross
    totalDiscount += disc
    totalTaxable  += net
    totalTax      += tax
  }

  return {
    subtotal,
    totalDiscount,
    totalTaxable,
    totalTax,
    grandTotal: totalTaxable + totalTax,
  }
}

/** Returns true when supply is inter-state (IGST applies) */
export function deriveInterState(
  partyState?: string,
  businessState?: string,
): boolean {
  if (!partyState || !businessState) return false
  return partyState.toUpperCase() !== businessState.toUpperCase()
}

/** Total of all payment splits */
export function splitTotal(splits: PaymentSplit[]): number {
  return splits.reduce((s, p) => s + p.amount, 0)
}

/** Generate a UUID v4 for idempotency key */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Format quantity with unit */
export function formatQtyUnit(qty: number, unit: string): string {
  return `${qty} ${unit}`
}
