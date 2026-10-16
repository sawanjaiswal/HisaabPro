/** Invoicing CRUD, stock validation, and document number series (paise). */
import { api } from '@/lib/api'
import type {
  DocumentListResponse,
  DocumentDetail,
  DocumentDeleteResponse,
  DocumentFilters,
  DocumentFormData,
  DocumentWirePayload,
  ConversionTargetType,
  NextDocumentNumber,
  DocumentNumberSeriesConfig,
  DocumentType,
} from './invoice.types'

/** Build URLSearchParams query from DocumentFilters (skips empty values). */
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

/** Pre-save stock availability check (per-item OK/WARN/BLOCK). */
export async function validateStock(
  items: Array<{ productId: string; quantity: number; unitId?: string }>
): Promise<StockValidationResult> {
  return api<StockValidationResult>('/documents/validate-stock', {
    method: 'POST',
    body: JSON.stringify({ items }),
    offlineQueue: false,                  // pre-flight only
    entityType: 'stock-check',
    entityLabel: 'Stock pre-check',
  })
}

/** Fetch paginated document list filtered by type / party / date / status. */
export async function getDocuments(
  filters: Partial<DocumentFilters> = {},
  signal?: AbortSignal
): Promise<DocumentListResponse> {
  return api<DocumentListResponse>(
    `/documents${buildDocumentQuery(filters)}`,
    { signal }
  )
}

import { InvoiceRepository } from '@/repositories/invoice.repository'
import { mapLocalDocToDetail } from '@/repositories/invoice.mapper'

/** Fetch full detail for a single document by ID. */
export async function getDocument(
  id: string,
  signal?: AbortSignal
): Promise<DocumentDetail> {
  try {
    const repo = new InvoiceRepository()
    const local = await repo.getById(id)
    if (local) return mapLocalDocToDetail(local)
  } catch {}
  return api<DocumentDetail>(`/documents/${id}`, { signal })
}

/** Create a new document (DRAFT or SAVED). Accepts wire payload + totals.
 *  Level 6 SSOT: Writes locally to Dexie in <1ms + enqueues to transactional outbox.
 */
export async function createDocument(
  data: DocumentWirePayload & { grandTotal?: number; paidAmount?: number; balanceDue?: number }
): Promise<DocumentDetail> {
  const rawData = data as any
  const repo = new InvoiceRepository()
  const lineItems = (data.lineItems || []) as any[]
  const totalPaise = lineItems.reduce((acc, it) => acc + (it.quantity || 0) * (it.rate || 0), 0)
  const grandTotal = rawData.grandTotal !== undefined ? Number(rawData.grandTotal) : totalPaise
  const paidAmount = data.payment?.amountReceived !== undefined
    ? Number(data.payment.amountReceived)
    : (rawData.paidAmount !== undefined ? Number(rawData.paidAmount) : 0)
  const balanceDue = rawData.balanceDue !== undefined
    ? Number(rawData.balanceDue)
    : Math.max(0, grandTotal - paidAmount)

  const local = await repo.create({
    partyId: data.partyId,
    partyName: rawData.partyName,
    type: data.type,
    status: data.status || 'SAVED',
    documentNumber: rawData.documentNumber,
    documentDate: data.documentDate,
    dueDate: data.dueDate,
    grandTotal,
    paidAmount,
    balanceAmount: balanceDue,
    lineItems: data.lineItems,
    notes: data.notes,
    payment: data.payment,
  })
  return mapLocalDocToDetail(local)
}

/** Update an existing document (blocked once CONVERTED or DELETED). */
export async function updateDocument(
  id: string,
  data: Partial<DocumentWirePayload>,
  expectedVersion?: number
): Promise<DocumentDetail> {
  // The form payload is create-shaped, but updateDocumentSchema is `.strict()`
  // and forbids the immutable create-only keys. Strip them before serializing
  // so the PUT body conforms — otherwise every edit 400s ("Unrecognized key(s)").
  // `type` is read first for offline-queue metadata, then dropped from the body.
  const {
    type,
    clientId: _clientId,
    originalDocumentId: _originalDocumentId,
    creditDebitReason: _creditDebitReason,
    ...body
  } = data as Partial<DocumentFormData> & {
    clientId?: string
    originalDocumentId?: string
    creditDebitReason?: string
  }

  return api<DocumentDetail>(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    entityType: type ? docTypeToEntity(type) : 'document',
    entityLabel: type ? `${docTypeToEntity(type)} update` : 'Document update',
    entityVersion: expectedVersion, // #150 optimistic lock
  })
}

/** Soft-delete a document (reverses stock + outstanding; recycle bin). */
export async function deleteDocument(
  id: string
): Promise<DocumentDeleteResponse> {
  return api<DocumentDeleteResponse>(`/documents/${id}`, {
    method: 'DELETE',
    entityType: 'document',
    entityLabel: 'Delete document',
  })
}

/** Convert a source document to a new type (returns new DRAFT). */
export async function convertDocument(
  id: string,
  targetType: ConversionTargetType
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ targetType }),
    entityType: docTypeToEntity(targetType as DocumentType),
    entityLabel: `Convert → ${targetType}`,
  })
}

/** Fetch the next auto-generated document number preview for a type. */
export async function getNextDocumentNumber(
  type: DocumentType,
  signal?: AbortSignal
): Promise<NextDocumentNumber> {
  return api<NextDocumentNumber>(
    `/settings/documents/number-series/${type}/next`,
    { signal }
  )
}

/** Update the number-series configuration for a document type. */
export async function updateNumberSeries(
  type: DocumentType,
  data: Partial<DocumentNumberSeriesConfig>
): Promise<NextDocumentNumber> {
  return api<NextDocumentNumber>(`/settings/documents/number-series/${type}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    entityType: 'number-series',
    entityLabel: `${type} numbering`,
  })
}

/** Map a DocumentType to a short noun for the offline queue UI label. */
function docTypeToEntity(type: DocumentType): string {
  switch (type) {
    case 'SALE_INVOICE': return 'invoice'
    case 'PURCHASE_INVOICE': return 'purchase'
    case 'ESTIMATE': return 'estimate'
    case 'PROFORMA': return 'proforma'
    case 'SALE_ORDER': return 'sale-order'
    case 'PURCHASE_ORDER': return 'purchase-order'
    case 'DELIVERY_CHALLAN': return 'challan'
    default: return 'document'
  }
}
