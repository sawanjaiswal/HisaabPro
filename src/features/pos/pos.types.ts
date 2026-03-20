/** POS Quick-Sale — Type definitions */

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

export interface QuickProduct {
  id: string
  name: string
  salePrice: number
  sku: string
  stock: number
}
