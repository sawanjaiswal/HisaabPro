/** Invoicing CRUD, stock validation, and document number series (paise). */
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

/** Fetch full detail for a single document by ID. */
export async function getDocument(
  id: string,
  signal?: AbortSignal
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}`, { signal })
}

/** Create a new document (DRAFT or SAVED). */
export async function createDocument(
  data: DocumentFormData
): Promise<DocumentDetail> {
  return api<DocumentDetail>('/documents', {
    method: 'POST',
    body: JSON.stringify(data),
    entityType: docTypeToEntity(data.type),
    entityLabel: `New ${docTypeToEntity(data.type)}`,
  })
}

/** Update an existing document (blocked once CONVERTED or DELETED). */
export async function updateDocument(
  id: string,
  data: Partial<DocumentFormData>
): Promise<DocumentDetail> {
  return api<DocumentDetail>(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    entityType: data.type ? docTypeToEntity(data.type) : 'document',
    entityLabel: data.type ? `${docTypeToEntity(data.type)} update` : 'Document update',
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
