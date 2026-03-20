/** POS Quick-Sale — Constants & config */

import type { PaymentMode } from './pos.types'

export const MAX_CART_ITEMS = 50
export const MAX_ITEM_QTY = 9999
export const QUICK_GRID_LIMIT = 12

export const PAYMENT_MODES: Array<{ value: PaymentMode; label: string; icon: string }> = [
  { value: 'cash', label: 'Cash', icon: 'Banknote' },
  { value: 'upi', label: 'UPI', icon: 'Smartphone' },
  { value: 'card', label: 'Card', icon: 'CreditCard' },
]

export const STATE_LABELS: Record<string, string> = {
  idle: 'Ready to scan',
  scanning: 'Scanning...',
  'item-found': 'Item found',
  'cart-active': 'Cart',
  checkout: 'Checkout',
  processing: 'Processing...',
  receipt: 'Sale Complete',
}
