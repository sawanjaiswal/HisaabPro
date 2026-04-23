/** GSTR-1 Reconciliation — API service
 *
 * All list/detail calls go through the shared api() wrapper which
 * handles auth cookies, timeout, 401 refresh, and offline queuing.
 * Input amounts are rupees floats from the user; response amounts are paise.
 */

import { api } from '@/lib/api'
import { RECON_PAGE_LIMIT } from './reconciliation.constants'
import type {
  GstrInputItem,
  MatchStatus,
  ReconciliationEntriesResponse,
  ReconciliationListResponse,
  ReconciliationSummary,
  ReconType,
} from './reconciliation.types'

export interface StartReconPayload {
  period: string
  reconType: ReconType
  gstrData: GstrInputItem[]
}

export async function startReconciliation(
  payload: StartReconPayload,
  signal?: AbortSignal
): Promise<ReconciliationSummary> {
  return api<ReconciliationSummary>('/gst/reconciliation', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
    entityType: 'gst-reconciliation',
    entityLabel: `Reconcile ${payload.reconType} ${payload.period}`,
  })
}

export async function listReconciliations(params: {
  page?: number
  limit?: number
  period?: string
  status?: string
}, signal?: AbortSignal): Promise<ReconciliationListResponse> {
  const q = new URLSearchParams()
  q.set('page',  String(params.page  ?? 1))
  q.set('limit', String(params.limit ?? RECON_PAGE_LIMIT))
  if (params.period) q.set('period', params.period)
  if (params.status) q.set('status', params.status)
  return api<ReconciliationListResponse>(`/gst/reconciliation?${q}`, { signal })
}

export async function getReconciliationDetail(
  id: string,
  signal?: AbortSignal
): Promise<ReconciliationSummary> {
  return api<ReconciliationSummary>(`/gst/reconciliation/${id}`, { signal })
}

export async function getReconciliationEntries(params: {
  id: string
  matchStatus?: MatchStatus | 'ALL'
  page?: number
  limit?: number
}, signal?: AbortSignal): Promise<ReconciliationEntriesResponse> {
  const q = new URLSearchParams()
  q.set('page',  String(params.page  ?? 1))
  q.set('limit', String(params.limit ?? RECON_PAGE_LIMIT))
  if (params.matchStatus && params.matchStatus !== 'ALL') {
    q.set('matchStatus', params.matchStatus)
  }
  return api<ReconciliationEntriesResponse>(
    `/gst/reconciliation/${params.id}/entries?${q}`,
    { signal }
  )
}

export async function deleteReconciliation(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/gst/reconciliation/${id}`, {
    method: 'DELETE',
    signal,
    offlineQueue: false,
    entityType: 'gst-reconciliation',
    entityLabel: 'Delete reconciliation',
  })
}
