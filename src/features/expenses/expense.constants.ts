/** Expenses — Constants */

import type { ExpensePaymentMode } from './expense.types'

export const PAYMENT_MODE_LABELS: Record<ExpensePaymentMode, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  CARD: 'Card',
}

export const EXPENSE_PAGE_LIMIT = 20
