/** POS Quick-Sale — Pure utility functions */

import type { PosCartItem, QuickSalePayload, PaymentMode } from './pos.types'
import { MAX_CART_ITEMS, MAX_ITEM_QTY } from './pos.constants'

/** Line total for a single cart item (in paise) */
export function lineTotal(item: PosCartItem): number {
  return item.quantity * item.unitPrice - item.discount
}

/** Sum of all item line totals (paise) */
export function cartSubtotal(items: PosCartItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0)
}

/** Total discount across all items (paise) */
export function cartTotalDiscount(items: PosCartItem[]): number {
  return items.reduce((sum, item) => sum + item.discount, 0)
}

/** Total item count (sum of quantities) */
export function cartItemCount(items: PosCartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/** Translation strings needed by validateCart */
interface CartValidationLabels {
  posCartEmpty: string
  posMaxItemsAllowed: string
  posInvalidQty: string
  posOnlyXInStockFor: string
  posDiscountExceeds: string
}

/** Validate cart before checkout. Returns error message or null. */
export function validateCart(items: PosCartItem[], labels: CartValidationLabels): string | null {
  if (items.length === 0) return labels.posCartEmpty
  if (items.length > MAX_CART_ITEMS) {
    return labels.posMaxItemsAllowed.replace('{count}', String(MAX_CART_ITEMS))
  }

  for (const item of items) {
    if (item.quantity < 1 || item.quantity > MAX_ITEM_QTY) {
      return labels.posInvalidQty.replace('{name}', item.name)
    }
    if (item.quantity > item.stock) {
      return labels.posOnlyXInStockFor
        .replace('{name}', item.name)
        .replace('{count}', String(item.stock))
    }
    if (item.discount > item.quantity * item.unitPrice) {
      return labels.posDiscountExceeds.replace('{name}', item.name)
    }
  }
  return null
}

/** Build the API payload from cart items + payment info */
export function buildPayload(
  items: PosCartItem[],
  paymentMode: PaymentMode,
  amountPaid: number,
  partyId?: string,
): QuickSalePayload {
  return {
    items: items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      ...(i.discount > 0 ? { discount: i.discount } : {}),
    })),
    paymentMode,
    amountPaid,
    partyId,
  }
}
