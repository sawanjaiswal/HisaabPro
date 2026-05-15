/** Sales pipeline — document list API service (GET-only, no mutations). */

import { api } from '@/lib/api'
import type { DocumentListResponse } from '../invoices/invoice.types'
import type { SalesDocumentFilters } from './sales.types'

/** Build a URLSearchParams string from SalesDocumentFilters. */
function buildQuery(filters: SalesDocumentFilters): string {
  const params = new URLSearchParams()
  params.set('type', filters.type)
  params.set('page', String(filters.page))
  params.set('limit', String(filters.limit))
  params.set('sortBy', filters.sortBy)
  params.set('sortOrder', filters.sortOrder)

  if (filters.search)   params.set('search', filters.search)
  if (filters.status)   params.set('status', filters.status)
  if (filters.partyId)  params.set('partyId', filters.partyId)
  if (filters.fromDate) params.set('fromDate', filters.fromDate)
  if (filters.toDate)   params.set('toDate', filters.toDate)

  return `?${params.toString()}`
}

/**
 * Fetch paginated list of documents for a given SalesDocumentType.
 * All reads go through api() from @/lib/api — offline rule §1 compliant.
 * cacheReads: false (financial data, changes often).
 */
export async function getSalesDocuments(
  filters: SalesDocumentFilters,
  signal?: AbortSignal,
): Promise<DocumentListResponse> {
  const qs = buildQuery(filters)
  const response = await api<{ success: boolean; data: DocumentListResponse }>(
    `/documents${qs}`,
    { signal },
  )
  return response.data
}
