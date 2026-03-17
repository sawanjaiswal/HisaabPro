/** Shared party service — search function used by invoices and payments */

import { api } from '@/lib/api'
import type { PartySummary } from '@/lib/types/party.types'

interface PartySearchParams {
  search?: string
  limit?: number
  page?: number
  type?: string
}

interface PartySearchResponse {
  parties: PartySummary[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Search parties by name/phone — thin wrapper used by PartySearchInput.
 * For full party CRUD, use the feature-specific party.service.
 */
export async function getParties(
  filters: PartySearchParams = {},
  signal?: AbortSignal
): Promise<PartySearchResponse> {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  if (filters.page !== undefined) params.set('page', String(filters.page))
  if (filters.type) params.set('type', filters.type)
  const qs = params.toString()
  return api<PartySearchResponse>(`/parties${qs ? `?${qs}` : ''}`, { signal })
}
