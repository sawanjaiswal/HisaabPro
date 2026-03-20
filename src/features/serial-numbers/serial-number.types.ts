export type SerialStatus = 'AVAILABLE' | 'SOLD' | 'RETURNED' | 'DAMAGED' | 'WARRANTY'

export interface SerialNumber {
  id: string
  businessId: string
  productId: string
  serialNumber: string
  status: SerialStatus
  batchId: string | null
  godownId: string | null
  soldInDocumentId: string | null
  soldAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface SerialNumberDetail extends SerialNumber {
  product?: { id: string; name: string; sku: string | null }
  batch?: { id: string; batchNumber: string; expiryDate: string | null } | null
  godown?: { id: string; name: string } | null
  soldInDocument?: {
    id: string
    documentNumber: string
    documentDate: string
    party?: { id: string; name: string; phone: string | null }
  } | null
}

export interface SerialListResponse {
  serialNumbers: SerialNumber[]
  total: number
  pagination: { nextCursor: string | null }
}

export interface CreateSerialData {
  serialNumber: string
  batchId?: string
  godownId?: string
  notes?: string
}

export interface BulkCreateSerialData {
  serialNumbers: string[]
  batchId?: string
  godownId?: string
}

export interface BulkCreateResult {
  created: number
  errors: Array<{ serial: string; message: string }>
}

export interface UpdateSerialData {
  status?: SerialStatus
  notes?: string | null
}
