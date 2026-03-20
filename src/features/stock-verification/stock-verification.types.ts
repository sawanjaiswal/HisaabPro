export type VerificationStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED'

export interface StockVerification {
  id: string
  businessId: string
  status: VerificationStatus
  notes: string | null
  totalItems: number
  countedItems: number
  discrepancies: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  createdBy?: { id: string; name: string }
}

export interface VerificationItem {
  id: string
  verificationId: string
  productId: string
  expectedQuantity: number
  actualQuantity: number | null
  discrepancy: number | null
  notes: string | null
  product?: {
    id: string
    name: string
    sku: string | null
    unit?: { symbol: string }
  }
}

export interface VerificationDetail extends StockVerification {
  items: VerificationItem[]
}

export interface VerificationListResponse {
  verifications: StockVerification[]
  total: number
  pagination: { nextCursor: string | null }
}

export interface RecordCountData {
  actualQuantity: number
  notes?: string
}
