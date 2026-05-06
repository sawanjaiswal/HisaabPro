/** Inventory — Batch picker types (BAT-05)
 *
 * Mirrors the backend GET /api/products/:productId/batches/picker response.
 * Field names are the exact names returned by the server.
 */

export interface BatchPickerItem {
  id: string
  batchNumber: string
  /** ISO date string or null when no expiry */
  expiryDate: string | null
  currentStock: number
  /** Cost price in paise at time of claim; null when not set */
  costPriceAtClaim: number | null
  isExpired: boolean
}

export interface BatchPickerResponse {
  batches: BatchPickerItem[]
}

/** Extended alert types for the expiry alerts page */
export interface ExpiryAlert {
  id: string
  alertType: 'EXPIRY_NEAR' | 'EXPIRY_PASSED'
  status: 'ACTIVE' | 'RESOLVED'
  daysRemaining: number | null
  batch: {
    id: string
    batchNumber: string
    expiryDate: string
    currentStock: number
  }
  product: {
    id: string
    name: string
    sku: string | null
    unit: { symbol: string }
  }
  createdAt: string
}

export interface ExpiryAlertListResponse {
  alerts: ExpiryAlert[]
  total: number
  pagination: { nextCursor: string | null }
}

/** Inline 409 error detail shapes from the backend */
export interface ExpiredBatchDetail {
  batchId: string
  batchNumber?: string
  expiryDate: string
  available?: number
}

export interface AllBatchesExpiredDetail {
  productId: string
  productName?: string
  expiredBatchCount?: number
}

export interface InsufficientBatchStockDetail {
  batchId: string
  available: number
  requested: number
}
