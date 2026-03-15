/** Invoicing & Documents — API service layer
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
  ShareWhatsAppResponse,
  ShareEmailResponse,
  ExportFormat,
  NextDocumentNumber,
  DocumentNumberSeriesConfig,
  DocumentType,
} from './invoice.types'

// ─── Local request-body types ─────────────────────────────────────────────────

export interface ShareWhatsAppRequest {
  /** 'IMAGE' renders to JPG; 'PDF' uses react-pdf */
  format: 'IMAGE' | 'PDF'
  recipientPhone: string
  message: string
}

export interface ShareEmailRequest {
  recipientEmail: string
  subject: string
  body: string
  format: 'PDF'
}

export interface RecycleBinFilters {
  page?: number
  limit?: number
  /** Optional — filter recycle bin to a specific document type */
  type?: DocumentType
}

export interface EmptyRecycleBinResponse {
  deletedCount: number
}

export interface PermanentDeleteOptions {
  /** Required if the business has PIN protection enabled */
  pin?: string
}

// ─── Query builder helpers ────────────────────────────────────────────────────

/**
 * Builds a URLSearchParams query string from DocumentFilters.
 * Only appends params that have non-undefined, non-empty values.
 */
function buildDocumentQuery(filters: Partial<DocumentFilters>): string {
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

/**
 * Builds a query string from RecycleBinFilters.
 */
function buildRecycleBinQuery(filters: RecycleBinFilters): string {
  const params = new URLSearchParams()

  const { page, limit, type } = filters

  if (page !== undefined) params.set('page', String(page))
  if (limit !== undefined) params.set('limit', String(limit))
  if (type !== undefined) params.set('type', type)

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
 * Soft-delete a document → moves it to the recycle bin.
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
 *   ESTIMATE → SALE_ORDER | SALE_INVOICE
 *   PROFORMA → SALE_INVOICE
 *   SALE_ORDER → SALE_INVOICE | DELIVERY_CHALLAN
 *   PURCHASE_ORDER → PURCHASE_INVOICE
 *   DELIVERY_CHALLAN → SALE_INVOICE
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

// ─── Recycle Bin ──────────────────────────────────────────────────────────────

/**
 * Fetch documents currently in the recycle bin (status = DELETED).
 * Items are auto-purged 30 days after deletion.
 * Same shape as DocumentListResponse but always DELETED status.
 */
export async function getRecycleBin(
  filters: RecycleBinFilters = {},
  signal?: AbortSignal
): Promise<DocumentListResponse> {
  return api<DocumentListResponse>(
    `/documents/recycle-bin${buildRecycleBinQuery(filters)}`,
    { signal }
  )
}

/**
 * Restore a deleted document back to SAVED status.
 * Side effects: stock re-applied, outstanding re-applied, deletedAt cleared.
 * Returns the restored DocumentDetail.
 */
export async function restoreDocument(id: string): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}/restore`, {
    method: 'POST',
  })
}

/**
 * Permanently (hard) delete a single document from the recycle bin.
 * If the business has PIN protection, pass pin in options.
 * Returns void (204 No Content).
 */
export async function permanentDeleteDocument(
  id: string,
  options: PermanentDeleteOptions = {}
): Promise<void> {
  return api<void>(`/documents/${id}/permanent`, {
    method: 'DELETE',
    headers: options.pin ? { 'X-PIN': options.pin } : {},
  })
}

/**
 * Permanently delete ALL documents in the recycle bin (empty bin).
 * If the business has PIN protection, pass pin in options.
 * Returns { deletedCount } (number of documents removed).
 */
export async function emptyRecycleBin(
  options: PermanentDeleteOptions = {}
): Promise<EmptyRecycleBinResponse> {
  return api<EmptyRecycleBinResponse>('/documents/recycle-bin', {
    method: 'DELETE',
    headers: options.pin ? { 'X-PIN': options.pin } : {},
  })
}

// ─── Sharing ──────────────────────────────────────────────────────────────────

/**
 * Generate and share a document via WhatsApp.
 * The API generates the image/PDF file and returns the URL + WhatsApp deep link.
 * On mobile (Capacitor), the client opens the native share sheet with the file.
 * Updates document status to SHARED. Creates a DocumentShareLog entry.
 */
export async function shareViaWhatsApp(
  id: string,
  data: ShareWhatsAppRequest
): Promise<ShareWhatsAppResponse> {
  return api<ShareWhatsAppResponse>(`/documents/${id}/share/whatsapp`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Send a document via email using the Resend integration.
 * The API generates the PDF and emails it to recipientEmail.
 * Updates document status to SHARED. Creates a DocumentShareLog entry.
 */
export async function shareViaEmail(
  id: string,
  data: ShareEmailRequest
): Promise<ShareEmailResponse> {
  return api<ShareEmailResponse>(`/documents/${id}/share/email`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Export a document as PDF, JPG, or PNG.
 * Returns the raw file Blob — caller should use URL.createObjectURL() for download.
 * Optionally specify a templateId to override the business default template.
 *
 * Note: Image export must complete in < 3 seconds per the performance target.
 */
export async function exportDocument(
  id: string,
  format: ExportFormat,
  templateId?: string
): Promise<Blob> {
  const params = new URLSearchParams({ format })
  if (templateId) params.set('templateId', templateId)

  // Cannot use the typed api() helper here because the response is binary, not JSON.
  const { API_URL } = await import('@/config/app.config')
  const token = sessionStorage.getItem('accessToken')

  const response = await fetch(
    `${API_URL}/documents/${id}/export?${params.toString()}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  )

  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`)
  }

  return response.blob()
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
