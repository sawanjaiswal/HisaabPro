/** POS Quick-Sale — Constants & config */

import type { PaymentMode } from './pos.types'

export const MAX_CART_ITEMS = 50
export const MAX_ITEM_QTY = 9999
export const QUICK_GRID_LIMIT = 12

export const PAYMENT_MODES: Array<{ value: PaymentMode; labelKey: string; icon: string }> = [
  { value: 'cash', labelKey: 'posCash', icon: 'Banknote' },
  { value: 'upi', labelKey: 'posUpi', icon: 'Smartphone' },
  { value: 'card', labelKey: 'posCard', icon: 'CreditCard' },
]
