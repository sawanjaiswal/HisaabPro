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
  return api<ProductListResponse>(`/products${buildProductQuery(filters)}`, {
    signal,
    cacheReads: true,
  })
}

import { ProductRepository } from '@/repositories/product.repository'

function mapLocalProductToDetail(p: any): ProductDetail {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku || '',
    barcode: undefined,
    category: null,
    unit: { id: p.unitId || 'default_unit', name: 'Units', symbol: 'PCS' },
    salePrice: p.salePrice || 0,
    purchasePrice: p.purchasePrice ?? null,
    currentStock: p.currentStock || 0,
    minStockLevel: p.minStockLevel || 0,
    status: p.isActive ? 'ACTIVE' : 'INACTIVE',
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    description: null,
    hsnCode: null,
    sacCode: null,
    stockValidation: 'WARN_ONLY',
    images: [],
    customFields: [],
    recentMovements: [],
  }
}

/**
 * Fetch full detail for a single product by ID.
 * Returns instantly from local Dexie store if present, falls back to server.
 */
export async function getProduct(
  id: string,
  signal?: AbortSignal
): Promise<ProductDetail> {
  try {
    const repo = new ProductRepository()
    const local = await repo.getById(id)
    if (local) return mapLocalProductToDetail(local)
  } catch {}
  const { product } = await api<{ product: ProductDetail }>(`/products/${id}`, { signal })
  return product
}

/**
 * Create a new product.
 * Writes locally to Dexie in <1ms + enqueues to outbox, then background syncs.
 */
export async function createProduct(
  data: ProductFormData,
  _signal?: AbortSignal
): Promise<ProductDetail> {
  const repo = new ProductRepository()
  const local = await repo.create(data)
  return mapLocalProductToDetail(local)
}

/**
 * Update an existing product. Accepts partial form data.
 * Note: openingStock and autoGenerateSku cannot be changed after creation.
 * Returns the updated product detail.
 */
export async function updateProduct(
  id: string,
  data: Partial<Omit<ProductFormData, 'openingStock' | 'autoGenerateSku'>>,
  _signal?: AbortSignal,
  _expectedVersion?: number
): Promise<ProductDetail> {
  const repo = new ProductRepository()
  const local = await repo.update(id, data as any)
  if (!local) {
    throw new Error('Product not found in local store')
  }
  return mapLocalProductToDetail(local)
}

/**
 * Soft-delete a product locally and queue background deletion.
 */
export async function deleteProduct(
  id: string,
  _signal?: AbortSignal
): Promise<void> {
  const repo = new ProductRepository()
  await repo.delete(id)
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
    entityType: 'stock-adjustment',
    entityLabel: `${data.type === 'ADJUSTMENT_IN' ? '+' : '-'}${data.quantity} stock`,
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
 * Look up a product by barcode value.
 * Returns the product summary or null if not found.
 */
export async function getProductByBarcode(
  barcode: string,
  signal?: AbortSignal
): Promise<ProductDetail | null> {
  try {
    const { product } = await api<{ product: ProductDetail | null }>(
      `/products/by-barcode/${encodeURIComponent(barcode)}`,
      { signal }
    )
    return product
  } catch {
    return null
  }
}

export async function validateStock(
  items: StockValidateItem[],
  signal?: AbortSignal
): Promise<StockValidationResponse> {
  return api<StockValidationResponse>('/stock/validate', {
    method: 'POST',
    body: JSON.stringify({ items }),
    signal,
    // Pre-flight check, never queued — must hit a live server to be meaningful
    offlineQueue: false,
    entityType: 'stock-check',
    entityLabel: 'Stock pre-check',
  })
}
