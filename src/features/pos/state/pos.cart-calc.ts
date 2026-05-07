/** POS — Pure cart total recalculation (paise math) */

import type { PosCartItem, PosCartTotals } from '../types/pos.types'

/**
 * Recalculate cart totals from items.
 * All values in paise (integer math — no floats).
 * Called on every cart mutation.
 */
export function recalcCart(items: PosCartItem[]): PosCartTotals {
  if (items.length === 0) {
    return {
      subtotal:      0,
      totalDiscount: 0,
      totalTaxable:  0,
      totalTax:      0,
      grandTotal:    0,
    }
  }

  let subtotal      = 0
  let totalDiscount = 0
  let totalTaxable  = 0
  let totalTax      = 0

  for (const item of items) {
    const gross   = item.quantity * item.unitPrice  // no float: all paise integers
    const disc    = item.discount
    const taxable = gross - disc
    const tax     = Math.round(taxable * item.taxRate / 100)

    subtotal      += gross
    totalDiscount += disc
    totalTaxable  += taxable
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

/** Return updated items array after qty change (capped at stock) */
export function applyQtyChange(
  items: PosCartItem[],
  productId: string,
  qty: number,
): PosCartItem[] {
  return items.map((item) => {
    if (item.productId !== productId) return item
    const capped = Math.min(Math.max(1, qty), item.stock, 9999)
    return { ...item, quantity: capped }
  })
}

/** Return updated items array after discount change (capped at line gross) */
export function applyDiscountChange(
  items: PosCartItem[],
  productId: string,
  discountPaise: number,
): PosCartItem[] {
  return items.map((item) => {
    if (item.productId !== productId) return item
    const maxDisc = item.quantity * item.unitPrice
    const disc    = Math.min(Math.max(0, discountPaise), maxDisc)
    return { ...item, discount: disc }
  })
}
