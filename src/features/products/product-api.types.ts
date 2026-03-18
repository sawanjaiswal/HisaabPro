/** Basic Inventory — API responses, filters, form data, settings */

import type { ProductStatus, ProductSummary } from '@/lib/types/product.types'
import type {
  StockValidationMode,
  StockMovementType,
  StockAdjustType,
  StockAdjustReason,
  ProductSortBy,
  LowStockAlertFrequency,
} from './product-enums.types'
import type { StockMovement } from './product-models.types'

// ─── API responses ────────────────────────────────────────────────────────────

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ProductListResponse {
  products: ProductSummary[]
  pagination: Pagination
  summary: {
    totalProducts: number
    lowStockCount: number
    /** Total stock value in PAISE (sum of currentStock x purchasePrice) */
    totalStockValue: number
  }
}

export interface StockMovementListResponse {
  movements: StockMovement[]
  pagination: Pagination
}

export interface StockAdjustResponse {
  movement: StockMovement
  product: {
    id: string
    currentStock: number
    previousStock: number
  }
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface ProductFilters {
  page: number
  limit: number
  search: string
  categoryId?: string
  status?: ProductStatus
  lowStockOnly?: boolean
  sortBy: ProductSortBy
  sortOrder: 'asc' | 'desc'
}

export interface StockMovementFilters {
  page: number
  limit: number
  type?: StockMovementType
  startDate?: string
  endDate?: string
}

// ─── Form data ────────────────────────────────────────────────────────────────

/** Mirrors CreateProductSchema from PRD 4.1 */
export interface ProductFormData {
  name: string
  sku?: string
  autoGenerateSku: boolean
  /** Barcode value (e.g. EAN-13, CODE128) — optional */
  barcode?: string
  /** Barcode format — defaults to CODE128 */
  barcodeFormat?: import('@/lib/types/product.types').BarcodeFormat
  categoryId?: string | null
  unitId: string
  /** Sale price in PAISE */
  salePrice: number
  /** Purchase price in PAISE */
  purchasePrice?: number
  openingStock: number
  minStockLevel: number
  stockValidation: StockValidationMode
  hsnCode?: string
  sacCode?: string
  /** Phase 2 GST — tax category (FK to TaxCategory) */
  taxCategoryId?: string | null
  description?: string
  status: ProductStatus
  customFields?: Array<{
    fieldDefId: string
    value: string
  }>
}

/** Mirrors StockAdjustSchema from PRD 4.2 */
export interface StockAdjustFormData {
  type: StockAdjustType
  quantity: number
  reason: StockAdjustReason
  customReason?: string  // required when reason === 'OTHER'
  notes?: string
  date?: string          // ISO datetime, defaults to now
}

/** Mirrors CreateCategorySchema from PRD 4.3 */
export interface CategoryFormData {
  name: string
  color?: string
  sortOrder?: number
}

/** Mirrors CreateUnitSchema from PRD 4.4 */
export interface UnitFormData {
  name: string
  symbol: string
}

// ─── Inventory Settings ───────────────────────────────────────────────────────

/** Business-level inventory configuration — mirrors GET /settings/inventory response */
export interface InventorySettings {
  stockValidationMode: 'WARN_ONLY' | 'HARD_BLOCK'
  skuPrefix: string
  skuAutoGenerate: boolean
  lowStockAlertFrequency: LowStockAlertFrequency
  lowStockAlertEnabled: boolean
  /** Decimal places to show/store for quantities (0-3) */
  decimalPrecisionQty: number
  defaultCategoryId: string | null
  defaultUnitId: string | null
}
