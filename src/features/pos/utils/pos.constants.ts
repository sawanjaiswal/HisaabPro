/** POS — Constants & configuration */

import type { PaymentMode, ReceiptWidth } from '../types/pos.types'

export const MAX_CART_ITEMS = 200
export const MAX_ITEM_QTY = 9999
export const SEARCH_DEBOUNCE_MS = 300
export const PRODUCT_PAGE_LIMIT = 24
export const SALES_PAGE_LIMIT = 20

export const PAYMENT_MODES: Array<{
  value: PaymentMode
  labelKey: string
  icon: string
}> = [
  { value: 'CASH',          labelKey: 'posModeCash',         icon: 'Banknote'     },
  { value: 'UPI',           labelKey: 'posModeUpi',          icon: 'Smartphone'   },
  { value: 'CARD',          labelKey: 'posModeCard',         icon: 'CreditCard'   },
  { value: 'BANK_TRANSFER', labelKey: 'posModeBank',         icon: 'Building2'    },
  { value: 'CHEQUE',        labelKey: 'modeCheque',          icon: 'FileText'     },
  { value: 'CREDIT',        labelKey: 'posModeCredit',       icon: 'Clock'        },
]

export const RECEIPT_WIDTHS: Array<{ value: ReceiptWidth; label: string; chars: number }> = [
  { value: '58mm', label: '58mm Thermal', chars: 32 },
  { value: '80mm', label: '80mm Thermal', chars: 48 },
  { value: 'A5',   label: 'A5 / Standard', chars: 60 },
]

export const VOID_WINDOW_HOURS = 24
