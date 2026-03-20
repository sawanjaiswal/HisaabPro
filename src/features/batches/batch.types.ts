/** Batch Tracking — Types and interfaces */

export interface Batch {
  id: string
  businessId: string
  productId: string
  batchNumber: string
  manufacturingDate: string | null
  expiryDate: string | null
  costPrice: number | null  // paise
  salePrice: number | null  // paise
  currentStock: number
  notes: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface BatchListResponse {
  batches: Batch[]
  total: number
  pagination: { nextCursor: string | null }
}

export interface CreateBatchData {
  batchNumber: string
  manufacturingDate?: string
  expiryDate?: string
  costPrice?: number  // paise
  salePrice?: number  // paise
  currentStock?: number
  notes?: string
}

export interface UpdateBatchData {
  batchNumber?: string
  manufacturingDate?: string | null
  expiryDate?: string | null
  costPrice?: number | null
  salePrice?: number | null
  notes?: string | null
}

export type BatchSortBy = 'batchNumber' | 'expiryDate' | 'currentStock' | 'createdAt'

export type ExpiryStatus = 'expired' | 'expiring' | 'fresh' | 'none'
