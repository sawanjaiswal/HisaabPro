/** Godowns/Warehouses — Type definitions */

export interface Godown {
  id: string
  businessId: string
  name: string
  address: string | null
  isDefault: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface GodownListResponse {
  godowns: Godown[]
  total: number
  pagination: { nextCursor: string | null }
}

export interface GodownStock {
  id: string
  productId: string
  godownId: string
  batchId: string | null
  quantity: number
  product?: { id: string; name: string; sku: string | null }
  batch?: { id: string; batchNumber: string } | null
}

export interface GodownStockResponse {
  stock: GodownStock[]
  total: number
  pagination: { nextCursor: string | null }
}

export interface GodownTransfer {
  id: string
  productId: string
  fromGodownId: string
  toGodownId: string
  quantity: number
  batchId: string | null
  notes: string | null
  transferredBy: string
  createdAt: string
  product?: { name: string }
  fromGodown?: { name: string }
  toGodown?: { name: string }
}

export interface TransferHistoryResponse {
  transfers: GodownTransfer[]
  total: number
  pagination: { nextCursor: string | null }
}

export interface CreateGodownData {
  name: string
  address?: string
  isDefault?: boolean
}

export interface TransferStockData {
  productId: string
  fromGodownId: string
  toGodownId: string
  quantity: number
  batchId?: string
  notes?: string
}
