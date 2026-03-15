/** Basic Inventory — Type definitions
 *
 * All monetary amounts stored in PAISE (integer).
 * All quantities stored in the product's base unit.
 */

// ─── Enums / union types ────────────────────────────────────────────────────

export type ProductStatus = 'ACTIVE' | 'INACTIVE'

export type StockValidationMode = 'GLOBAL' | 'WARN_ONLY' | 'HARD_BLOCK'

export type StockMovementType =
  | 'SALE'
  | 'PURCHASE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'OPENING'
  | 'RETURN_IN'
  | 'RETURN_OUT'

export type StockAdjustReason =
  | 'DAMAGE'
  | 'THEFT'
  | 'AUDIT'
  | 'GIFT'
  | 'RETURN'
  | 'OTHER'

export type CategoryType = 'PREDEFINED' | 'CUSTOM'

export type UnitType = 'PREDEFINED' | 'CUSTOM'

export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN'

export type StockStatus = 'ok' | 'low' | 'out'

export type ProductSortBy =
  | 'name'
  | 'salePrice'
  | 'purchasePrice'
  | 'currentStock'
  | 'createdAt'

export type StockAdjustType = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT'

export type ReferenceType = 'INVOICE' | 'PURCHASE_ORDER' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'MANUAL'

export type StockValidationResult = 'OK' | 'WARN' | 'BLOCK'

// ─── Category ───────────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  type: CategoryType
  color: string
  productCount: number
  sortOrder: number
}

export interface CreateCategoryData {
  name: string
  color?: string
  sortOrder?: number
}

export interface DeleteCategoryData {
  reassignTo: string // target category id — required before deleting
}

// ─── Unit ───────────────────────────────────────────────────────────────────

export interface Unit {
  id: string
  name: string
  symbol: string
  type: UnitType
  productCount: number
}

export interface CreateUnitData {
  name: string
  symbol: string
}

export interface UnitConversion {
  id: string
  fromUnitId: string
  fromUnit: { name: string; symbol: string }
  toUnitId: string
  toUnit: { name: string; symbol: string }
  factor: number   // 1 fromUnit = factor toUnits  e.g. 1 box = 12 pcs
  businessId: string
}

export interface CreateUnitConversionData {
  fromUnitId: string
  toUnitId: string
  factor: number
}

// ─── Custom fields ───────────────────────────────────────────────────────────

export interface CustomFieldDef {
  id: string
  name: string
  fieldType: CustomFieldType
  isRequired: boolean
  showOnInvoice: boolean
  isSearchable: boolean
  options: string[] | null  // only for DROPDOWN type
  sortOrder: number
}

export interface CustomFieldValue {
  fieldDefId: string
  fieldName: string
  fieldType: CustomFieldType
  value: string  // all stored as string, parsed by type
}

export interface CreateCustomFieldDefData {
  name: string
  fieldType: CustomFieldType
  isRequired?: boolean
  showOnInvoice?: boolean
  isSearchable?: boolean
  options?: string[]  // required when fieldType === 'DROPDOWN'
}

// ─── Product (list item) ─────────────────────────────────────────────────────

export interface ProductSummary {
  id: string
  name: string
  sku: string
  category: { id: string; name: string }
  unit: { id: string; name: string; symbol: string }
  /** Sale price in PAISE */
  salePrice: number
  /** Purchase price in PAISE — optional, for profit tracking */
  purchasePrice: number | null
  currentStock: number    // in base unit
  minStockLevel: number   // 0 means no alert
  status: ProductStatus
  createdAt: string
}

// ─── Product (full detail) ───────────────────────────────────────────────────

export interface ProductDetail extends ProductSummary {
  description: string | null
  hsnCode: string | null    // HSN for goods  (Phase 2 GST)
  sacCode: string | null    // SAC for services (Phase 2 GST)
  stockValidation: StockValidationMode
  customFields: CustomFieldValue[]
  recentMovements: StockMovement[]  // last 10
  updatedAt: string
}

// ─── Stock movement ──────────────────────────────────────────────────────────

export interface StockMovement {
  id: string
  productId: string
  type: StockMovementType
  /** Positive = in, negative = out */
  quantity: number
  /** Running balance after this movement */
  balanceAfter: number
  reason: StockAdjustReason | null
  customReason: string | null
  notes: string | null
  referenceType: ReferenceType | null
  referenceId: string | null
  referenceNumber: string | null
  createdBy: { id: string; name: string }
  createdAt: string
}

// ─── Stock validation ─────────────────────────────────────────────────────────

export interface StockValidationItem {
  productId: string
  productName: string
  requestedQty: number     // in base units after conversion
  requestedUnit: string
  currentStock: number
  deficit: number
  validation: StockValidationResult
  message: string
}

export interface StockValidationResponse {
  valid: boolean
  items: StockValidationItem[]
}

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
    /** Total stock value in PAISE (sum of currentStock × purchasePrice) */
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

/** Mirrors CreateProductSchema from PRD §4.1 */
export interface ProductFormData {
  name: string
  sku?: string
  autoGenerateSku: boolean
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
  description?: string
  status: ProductStatus
  customFields?: Array<{
    fieldDefId: string
    value: string
  }>
}

/** Mirrors StockAdjustSchema from PRD §4.2 */
export interface StockAdjustFormData {
  type: StockAdjustType
  quantity: number
  reason: StockAdjustReason
  customReason?: string  // required when reason === 'OTHER'
  notes?: string
  date?: string          // ISO datetime, defaults to now
}

/** Mirrors CreateCategorySchema from PRD §4.3 */
export interface CategoryFormData {
  name: string
  color?: string
  sortOrder?: number
}

/** Mirrors CreateUnitSchema from PRD §4.4 */
export interface UnitFormData {
  name: string
  symbol: string
}

// ─── Inventory Settings ───────────────────────────────────────────────────────

export type LowStockAlertFrequency = 'ONCE' | 'DAILY' | 'EVERY_TIME'

/** Business-level inventory configuration — mirrors GET /settings/inventory response */
export interface InventorySettings {
  stockValidationMode: 'WARN_ONLY' | 'HARD_BLOCK'
  skuPrefix: string
  skuAutoGenerate: boolean
  lowStockAlertFrequency: LowStockAlertFrequency
  lowStockAlertEnabled: boolean
  /** Decimal places to show/store for quantities (0–3) */
  decimalPrecisionQty: number
  defaultCategoryId: string | null
  defaultUnitId: string | null
}
