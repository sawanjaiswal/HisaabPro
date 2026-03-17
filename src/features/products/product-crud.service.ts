/** Product CRUD + Stock — API service layer */

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
} from './product.types'

// ─── Local types ─────────────────────────────────────────────────────────────

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

// ─── Products CRUD ───────────────────────────────────────────────────────────

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

// ─── Stock ───────────────────────────────────────────────────────────────────

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
