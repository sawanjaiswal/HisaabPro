/** POS Quick-Sale — Type definitions */

import type { ProductSummary } from '@/lib/types/product.types'

export type PaymentMode = 'cash' | 'upi' | 'card'

export type PosStatus =
  | 'idle'
  | 'scanning'
  | 'item-found'
  | 'cart-active'
  | 'checkout'
  | 'processing'
  | 'receipt'

export interface PosCartItem {
  productId: string
  name: string
  sku: string
  quantity: number
  /** Unit price in paise */
  unitPrice: number
  /** Discount in paise */
  discount: number
  /** Current stock (for validation) */
  stock: number
}

export interface PosCart {
  items: PosCartItem[]
  status: PosStatus
}

export interface QuickSalePayload {
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    discount?: number
  }>
  paymentMode: PaymentMode
  /** Amount paid in paise */
  amountPaid: number
  partyId?: string
}

export interface QuickSaleResult {
  document: { id: string; number: string; date: string }
  payment: { id: string; amount: number; mode: PaymentMode }
}

/**
 * The subset of a product POS needs to add a line to the cart.
 *
 * Derived from `ProductSummary` — the canonical wire type for
 * `GET /api/products` — rather than restated. POS previously declared these
 * fields by hand and got two of them wrong (`stock` for `currentStock`,
 * and a `{ items }` envelope the server never sent), which TypeScript could
 * not catch because a hand-written interface has nothing to disagree with.
 * Picking from the canonical type means a server-side rename breaks the
 * build here instead of at the till.
 */
export type QuickProduct = Pick<
  ProductSummary,
  'id' | 'name' | 'sku' | 'salePrice' | 'currentStock'
> & Pick<Partial<ProductSummary>, 'barcode'>
