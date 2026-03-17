/** Expenses — Type definitions */

export type ExpensePaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD'

export interface ExpenseCategory {
  id: string
  businessId: string
  name: string
  icon: string | null
  color: string | null
  isSystem: boolean
  createdAt: string
}

export interface Expense {
  id: string
  businessId: string
  categoryId: string | null
  categoryName: string | null
  amount: number             // paise
  date: string               // ISO date string
  paymentMode: ExpensePaymentMode
  notes: string | null
  referenceNumber: string | null
  partyId: string | null
  partyName: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseListResponse {
  items: Expense[]
  total: number
  page: number
  limit: number
}

export interface ExpenseSummary {
  totalAmount: number        // paise
  byCategory: Array<{
    categoryId: string | null
    categoryName: string | null
    totalAmount: number
  }>
}

export interface CreateExpenseInput {
  categoryId?: string
  amount: number             // paise
  date: string
  paymentMode: ExpensePaymentMode
  notes?: string
  referenceNumber?: string
  partyId?: string
}

export interface CreateExpenseCategoryInput {
  name: string
  icon?: string
  color?: string
}
