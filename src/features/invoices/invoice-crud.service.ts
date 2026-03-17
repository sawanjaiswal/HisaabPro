/** Invoicing — CRUD, stock validation, and document number series
 *
 * All monetary values are in PAISE (integer) — the server and client both
 * use paise. Display conversion is done at the component level via formatCurrency.
 *
 * API base: the `api()` helper already prepends API_URL, so paths start at /
 * (not /api). The server routes are mounted at /documents and /settings/documents.
 */

import { api } from '@/lib/api'
import type {
  DocumentListResponse,
  DocumentDetail,
  DocumentDeleteResponse,
  DocumentFilters,
  DocumentFormData,
  ConversionTargetType,
  NextDocumentNumber,
  DocumentNumberSeriesConfig,
  DocumentType,
} from './invoice.types'

// ─── Query builder helper ────────────────────────────────────────────────────

/**
 * Builds a URLSearchParams query string from DocumentFilters.
 * Only appends params that have non-undefined, non-empty values.
 */
export function buildDocumentQuery(filters: Partial<DocumentFilters>): string {
  const params = new URLSearchParams()

  const {
    page,
    limit,
    type,
    status,
    partyId,
    fromDate,
    toDate,
    search,
    sortBy,
    sortOrder,
  } = filters

  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  if (type !== undefined) params.set('type', type)
  if (status !== undefined && status !== '') params.set('status', status)
  if (partyId !== undefined) params.set('partyId', partyId)
  if (fromDate !== undefined) params.set('fromDate', fromDate)
  if (toDate !== undefined) params.set('toDate', toDate)
  if (search !== undefined && search !== '') params.set('search', search)
  if (sortBy !== undefined) params.set('sortBy', sortBy)
  if (sortOrder !== undefined) params.set('sortOrder', sortOrder)

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

// ─── Stock Validation ────────────────────────────────────────────────────────

export interface StockValidationItem {
  productId: string
  productName: string
  requestedQty: number
  requestedUnit: string
  currentStock: number
  deficit: number
  validation: 'OK' | 'WARN' | 'BLOCK'
  message: string | null
}

export interface StockValidationResult {
  valid: boolean
  items: StockValidationItem[]
}

/**
 * Pre-save stock availability check.
 * Returns per-item validation status (OK, WARN, BLOCK).
 * BLOCK = hard block (insufficient stock, cannot save).
 * WARN = soft warning (stock low but save is allowed).
 */
export async function validateStock(
  items: Array<{ productId: string; quantity: number; unitId: string }>
): Promise<StockValidationResult> {
  return api<StockValidationResult>('/documents/validate-stock', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

// ─── Documents CRUD ───────────────────────────────────────────────────────────

/**
 * Fetch paginated document list.
 * `type` is required in filters — each document type has its own list screen.
 * Supports filtering by party, date range, search, and status (comma-separated).
 */
export async function getDocuments(
  filters: Partial<DocumentFilters> = {},
  signal?: AbortSignal
): Promise<DocumentListResponse> {
  return api<DocumentListResponse>(
    `/documents${buildDocumentQuery(filters)}`,
    { signal }
  )
}

/**
 * Fetch full detail for a single document by ID.
 * Includes lineItems, additionalCharges, shareLogs, sourceDocument, convertedTo.
 */
export async function getDocument(
  id: string,
  signal?: AbortSignal
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}`, { signal })
}

/**
 * Create a new document (any of the 7 types).
 *
 * Pass `status: 'DRAFT'` for auto-saves and `status: 'SAVED'` when the user
 * taps "Save". Only SAVED triggers stock deduction and outstanding updates.
 *
 * Returns the full DocumentDetail (201 Created).
 */
export async function createDocument(
  data: DocumentFormData
): Promise<DocumentDetail> {
  return api<DocumentDetail>('/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Update an existing document.
 * Cannot update CONVERTED or DELETED documents (server returns 400 DOCUMENT_LOCKED).
 * Stock and outstanding deltas are recalculated atomically on the server.
 * Returns the updated DocumentDetail (200 OK).
 */
export async function updateDocument(
  id: string,
  data: Partial<DocumentFormData>
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/**
 * Soft-delete a document — moves it to the recycle bin.
 * Side effects: stock reversed, outstanding reversed, deletedAt set.
 * Cannot delete CONVERTED documents.
 * Returns a slim { id, status, deletedAt, permanentDeleteAt } object.
 */
export async function deleteDocument(
  id: string
): Promise<DocumentDeleteResponse> {
  return api<DocumentDeleteResponse>(`/documents/${id}`, {
    method: 'DELETE',
  })
}

// ─── Document Conversion ──────────────────────────────────────────────────────

/**
 * Convert a source document to a new document type.
 *
 * Allowed chains:
 *   ESTIMATE -> SALE_ORDER | SALE_INVOICE
 *   PROFORMA -> SALE_INVOICE
 *   SALE_ORDER -> SALE_INVOICE | DELIVERY_CHALLAN
 *   PURCHASE_ORDER -> PURCHASE_INVOICE
 *   DELIVERY_CHALLAN -> SALE_INVOICE
 *
 * Returns the new document in DRAFT status (201). The client should redirect
 * to the edit form so the user can review and tap "Save".
 */
export async function convertDocument(
  id: string,
  targetType: ConversionTargetType
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ targetType }),
  })
}

// ─── Document Number Series ───────────────────────────────────────────────────

/**
 * Fetch the next auto-generated document number for a given type.
 * Called when opening the create form to pre-fill the document number field.
 * The number is reserved only when the document is saved (SAVED status).
 */
export async function getNextDocumentNumber(
  type: DocumentType,
  signal?: AbortSignal
): Promise<NextDocumentNumber> {
  return api<NextDocumentNumber>(
    `/settings/documents/number-series/${type}/next`,
    { signal }
  )
}

/**
 * Update the number series configuration for a document type.
 * Controls prefix, separator, financial year format, padding, and reset behaviour.
 * Returns the updated NextDocumentNumber preview showing what the next number will look like.
 */
export async function updateNumberSeries(
  type: DocumentType,
  data: Partial<DocumentNumberSeriesConfig>
): Promise<NextDocumentNumber> {
  return api<NextDocumentNumber>(`/settings/documents/number-series/${type}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
