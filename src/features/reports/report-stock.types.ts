/** Stock Summary Report — TypeScript types
 *
 * All monetary amounts are in PAISE (integer).
 */

import type { Pagination } from './report-shared.types'

// ─── Stock Summary Report ──────────────────────────────────────────────────────

/** Stock level classification per product */
export type StockStatus = 'in_stock' | 'low' | 'out_of_stock'

/** Sort options for the stock summary list */
export type StockSortBy =
  | 'name_asc'
  | 'name_desc'
  | 'stock_asc'
  | 'stock_desc'
  | 'value_asc'
  | 'value_desc'

/** Query parameters for the stock summary endpoint */
export interface StockSummaryFilters {
  categoryId?: string
  stockStatus?: StockStatus
  search?: string
  sortBy: StockSortBy
  cursor?: string
  limit: number
}

/** Aggregate stats shown in the summary bar */
export interface StockSummaryStats {
  totalProducts: number
  totalStockValueAtPurchase: number  // paise
  totalStockValueAtSale: number      // paise
  lowStockCount: number
  outOfStockCount: number
}

/** A single product row in the stock summary */
export interface StockSummaryItem {
  productId: string
  name: string
  category: string
  unit: string
  currentStock: number
  minStockLevel: number
  purchasePrice: number              // paise — per unit
  salePrice: number                  // paise — per unit
  stockValueAtPurchase: number       // paise — currentStock * purchasePrice
  stockValueAtSale: number           // paise — currentStock * salePrice
  stockStatus: StockStatus
}

/** Full response shape from GET /reports/stock-summary */
export interface StockSummaryResponse {
  success: boolean
  data: {
    summary: StockSummaryStats
    items: StockSummaryItem[]
  }
  meta: Pagination
}
