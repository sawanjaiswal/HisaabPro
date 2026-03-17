/** Cheques — Type definitions */

export type ChequeType = 'RECEIVED' | 'ISSUED'
export type ChequeStatus = 'PENDING' | 'CLEARED' | 'BOUNCED' | 'CANCELLED'

export interface Cheque {
  id: string
  businessId: string
  chequeNumber: string
  bankName: string
  accountNumber: string | null
  type: ChequeType
  status: ChequeStatus
  amount: number              // paise
  chequeDate: string          // ISO date string
  dueDate: string | null
  partyId: string | null
  partyName: string | null
  notes: string | null
  clearedAt: string | null
  bouncedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ChequeListResponse {
  items: Cheque[]
  total: number
  page: number
  limit: number
}

export interface ChequeSummary {
  totalPending: number        // paise
  totalCleared: number        // paise
  totalBounced: number        // paise
  pendingCount: number
}

export interface CreateChequeInput {
  chequeNumber: string
  bankName: string
  accountNumber?: string
  type: ChequeType
  amount: number              // paise
  chequeDate: string
  dueDate?: string
  partyId?: string
  notes?: string
}

export interface UpdateChequeStatusInput {
  status: ChequeStatus
  notes?: string
}
