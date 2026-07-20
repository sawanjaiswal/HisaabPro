/** Stock Alerts (#49 Low Stock) — wire + view types. */

import type { ExpiryAlertCardData } from './ExpiryAlertCard'

export interface StockAlertProduct {
  id: string
  name: string
  sku: string | null
  currentStock: number
  minStockLevel: number
  reorderQty: number | null
  unit: { symbol: string }
}

export interface StockAlert {
  id: string
  type: 'LOW_STOCK' | 'OUT_OF_STOCK'
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  product: StockAlertProduct
  createdAt: string
}

export interface StockAlertListResponse {
  alerts: StockAlert[]
  total: number
  pagination: { nextCursor: string | null }
}

export interface ExpiryAlertListResponse {
  alerts: ExpiryAlertCardData[]
  total: number
  pagination: { nextCursor: string | null }
}

/** Mockup #49's chip row. CRITICAL is a subset of LOW, not a separate API state. */
export type StockAlertFilter = 'ALL' | 'CRITICAL' | 'LOW' | 'OUT_OF_STOCK'

/** How far below the minimum a product has fallen — drives colour and bar width. */
export type StockSeverity = 'OUT' | 'CRITICAL' | 'LOW'
