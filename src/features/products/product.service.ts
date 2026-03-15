/** Basic Inventory — API service layer */

import { api } from '@/lib/api'
import type {
  ProductListResponse,
  ProductDetail,
  ProductFilters,
  ProductFormData,
  StockAdjustFormData,
  StockAdjustResponse,
  StockMovementListResponse,
  StockMovementFilters,
  StockValidationResponse,
  Category,
  Unit,
  UnitConversion,
  InventorySettings,
} from './product.types'

// ─── Local types for endpoints not covered by product.types ──────────────────

export interface CategoryInput {
  name: string
  color?: string
  sortOrder?: number
}

export interface UnitInput {
  name: string
  symbol: string
}

export interface UnitConversionInput {
  fromUnitId: string
  toUnitId: string
  factor: number
}

export interface InventorySettingsInput {
  stockValidationMode?: 'WARN_ONLY' | 'HARD_BLOCK'
  skuPrefix?: string
  skuAutoGenerate?: boolean
  lowStockAlertFrequency?: 'ONCE' | 'DAILY' | 'EVERY_TIME'
  lowStockAlertEnabled?: boolean
  /** 0–3 */
  decimalPrecisionQty?: number
  defaultCategoryId?: string
  defaultUnitId?: string
}

export interface StockValidateItem {
  productId: string
  quantity: number
  /** May differ from product's base unit — server handles conversion */
  unitId: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a query string from ProductFilters, omitting undefined/null/default values.
 * Follows the same pattern as buildPartyQuery in party.service.ts.
 */
function buildProductQuery(filters: Partial<ProductFilters>): string {
  const params = new URLSearchParams()

  const {
    page,
    limit,
    search,
    categoryId,
    status,
    lowStockOnly,
    sortBy,
    sortOrder,
  } = filters

  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  if (search !== undefined && search !== '') params.set('search', search)
  if (categoryId !== undefined) params.set('categoryId', categoryId)
  if (status !== undefined) params.set('status', status)
  if (lowStockOnly !== undefined) params.set('lowStockOnly', String(lowStockOnly))
  if (sortBy !== undefined) params.set('sortBy', sortBy)
  if (sortOrder !== undefined) params.set('sortOrder', sortOrder)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Build a query string from StockMovementFilters for the movements log.
 */
function buildMovementQuery(filters: Partial<StockMovementFilters>): string {
  const params = new URLSearchParams()

  const { page, limit, type, startDate, endDate } = filters

  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  if (type !== undefined) params.set('type', type)
  if (startDate !== undefined) params.set('startDate', startDate)
  if (endDate !== undefined) params.set('endDate', endDate)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Products CRUD ────────────────────────────────────────────────────────────

/**
 * Fetch paginated product list with optional filters.
 * Returns products, pagination meta, and low-stock summary.
 */
export async function getProducts(
  filters: Partial<ProductFilters> = {},
  signal?: AbortSignal
): Promise<ProductListResponse> {
  return api<ProductListResponse>(`/products${buildProductQuery(filters)}`, { signal })
}

/**
 * Fetch full detail for a single product by ID.
 * Includes recentMovements (last 10 stock movements).
 */
export async function getProduct(
  id: string,
  signal?: AbortSignal
): Promise<ProductDetail> {
  return api<ProductDetail>(`/products/${id}`, { signal })
}

/**
 * Create a new product. Returns the full product detail.
 * If openingStock > 0 the server creates an OPENING StockMovement atomically.
 */
export async function createProduct(
  data: ProductFormData,
  signal?: AbortSignal
): Promise<ProductDetail> {
  return api<ProductDetail>('/products', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing product. Accepts partial form data.
 * Note: openingStock and autoGenerateSku cannot be changed after creation.
 * Returns the updated product detail.
 */
export async function updateProduct(
  id: string,
  data: Partial<Omit<ProductFormData, 'openingStock' | 'autoGenerateSku'>>,
  signal?: AbortSignal
): Promise<ProductDetail> {
  return api<ProductDetail>(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Soft-delete a product (sets status = INACTIVE).
 * Products referenced by invoices can never be hard-deleted.
 */
export async function deleteProduct(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/products/${id}`, {
    method: 'DELETE',
    signal,
  })
}

// ─── Stock ────────────────────────────────────────────────────────────────────

/**
 * Manually adjust stock for a product (ADJUSTMENT_IN or ADJUSTMENT_OUT).
 * Returns the created StockMovement plus updated stock counts.
 * Throws ApiError with code INSUFFICIENT_STOCK if hard-block mode prevents the out.
 */
export async function adjustStock(
  productId: string,
  data: StockAdjustFormData,
  signal?: AbortSignal
): Promise<StockAdjustResponse> {
  return api<StockAdjustResponse>(`/products/${productId}/stock/adjust`, {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Fetch paginated stock movement log for a product.
 * Supports filtering by type and date range.
 */
export async function getStockMovements(
  productId: string,
  filters: Partial<StockMovementFilters> = {},
  signal?: AbortSignal
): Promise<StockMovementListResponse> {
  return api<StockMovementListResponse>(
    `/products/${productId}/stock/movements${buildMovementQuery(filters)}`,
    { signal }
  )
}

/**
 * Pre-validate stock availability before saving an invoice.
 * Items may specify a non-base unit — server converts using UnitConversions.
 * Returns per-item OK / WARN / BLOCK status and an overall valid flag.
 */
export async function validateStock(
  items: StockValidateItem[],
  signal?: AbortSignal
): Promise<StockValidationResponse> {
  return api<StockValidationResponse>('/stock/validate', {
    method: 'POST',
    body: JSON.stringify({ items }),
    signal,
  })
}

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * Fetch all categories (predefined + custom), with optional name search.
 */
export async function getCategories(
  search?: string,
  signal?: AbortSignal
): Promise<Category[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return api<Category[]>(`/categories${qs}`, { signal })
}

/**
 * Create a new custom category. Returns the created category.
 */
export async function createCategory(
  data: CategoryInput,
  signal?: AbortSignal
): Promise<Category> {
  return api<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing custom category. Only CUSTOM categories can be edited.
 * Returns the updated category.
 */
export async function updateCategory(
  id: string,
  data: Partial<CategoryInput>,
  signal?: AbortSignal
): Promise<Category> {
  return api<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a custom category.
 * `reassignTo` is required — all products move to the target category before deletion.
 */
export async function deleteCategory(
  id: string,
  reassignTo: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/categories/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reassignTo }),
    signal,
  })
}

// ─── Units ────────────────────────────────────────────────────────────────────

/**
 * Fetch all units (predefined + custom), with optional name/symbol search.
 */
export async function getUnits(
  search?: string,
  signal?: AbortSignal
): Promise<Unit[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return api<Unit[]>(`/units${qs}`, { signal })
}

/**
 * Create a new custom unit. Returns the created unit.
 */
export async function createUnit(
  data: UnitInput,
  signal?: AbortSignal
): Promise<Unit> {
  return api<Unit>('/units', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Update an existing custom unit. Only CUSTOM units can be edited.
 * Returns the updated unit.
 */
export async function updateUnit(
  id: string,
  data: Partial<UnitInput>,
  signal?: AbortSignal
): Promise<Unit> {
  return api<Unit>(`/units/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a custom unit.
 * Fails if any products still reference this unit — reassign products first.
 */
export async function deleteUnit(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/units/${id}`, {
    method: 'DELETE',
    signal,
  })
}

// ─── Unit Conversions ─────────────────────────────────────────────────────────

/**
 * Fetch all unit conversions for this business.
 * The server also stores the reverse direction — this returns both.
 */
export async function getUnitConversions(
  signal?: AbortSignal
): Promise<UnitConversion[]> {
  return api<UnitConversion[]>('/unit-conversions', { signal })
}

/**
 * Create a new unit conversion (e.g. 1 box = 12 pcs).
 * Server automatically creates the reverse (1 pcs = 0.0833 box).
 * Returns the forward conversion record.
 */
export async function createUnitConversion(
  data: UnitConversionInput,
  signal?: AbortSignal
): Promise<UnitConversion> {
  return api<UnitConversion>('/unit-conversions', {
    method: 'POST',
    body: JSON.stringify(data),
    signal,
  })
}

/**
 * Delete a unit conversion by ID.
 * Server deletes both the forward and reverse conversion records.
 */
export async function deleteUnitConversion(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/unit-conversions/${id}`, {
    method: 'DELETE',
    signal,
  })
}

// ─── Inventory Settings ───────────────────────────────────────────────────────

/**
 * Fetch business-level inventory settings (global stock validation mode,
 * SKU prefix, low-stock alert config, default category/unit, etc.).
 */
export async function getInventorySettings(
  signal?: AbortSignal
): Promise<InventorySettings> {
  return api<InventorySettings>('/settings/inventory', { signal })
}

/**
 * Update inventory settings. Accepts partial updates — only changed fields needed.
 * Returns the full updated settings object.
 */
export async function updateInventorySettings(
  data: InventorySettingsInput,
  signal?: AbortSignal
): Promise<InventorySettings> {
  return api<InventorySettings>('/settings/inventory', {
    method: 'PUT',
    body: JSON.stringify(data),
    signal,
  })
}
