/** Other Income — Type definitions */

export type OtherIncomePaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD'

export interface OtherIncome {
  id: string
  businessId: string
  category: string | null
  amount: number              // paise
  date: string                // ISO date string
  paymentMode: OtherIncomePaymentMode
  notes: string | null
  referenceNumber: string | null
  createdAt: string
  updatedAt: string
}

export interface OtherIncomeListResponse {
  items: OtherIncome[]
  total: number
  page: number
  limit: number
}

export interface OtherIncomeSummary {
  totalAmount: number         // paise
  byCategory: Array<{ category: string | null; totalAmount: number }>
}

export interface CreateOtherIncomeInput {
  category?: string
  amount: number              // paise
  date: string
  paymentMode: OtherIncomePaymentMode
  notes?: string
  referenceNumber?: string
}
