/** Recurring Invoices — API service layer
 *
 * All mutation requests include replay-protection headers:
 *   X-Request-Nonce      — crypto.randomUUID(), unique per request
 *   X-Request-Timestamp  — Unix ms, server validates within ±5 min window
 *
 * Every fetch accepts an AbortSignal so the calling hook can cancel on cleanup,
 * preventing stale responses from corrupting state.
 * api() already prepends /api — paths here start with /recurring.
 */

import { api } from '@/lib/api'
import type {
  RecurringInvoice,
  RecurringListResponse,
  RecurringRunsResponse,
  CreateRecurringInput,
  UpdateRecurringInput,
} from './recurring.types'
import { RECURRING_PAGE_LIMIT, RECURRING_RUNS_PAGE_LIMIT } from './recurring.constants'

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

export async function listRecurring(
  page: number,
  status: string,
  signal?: AbortSignal
): Promise<RecurringListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(RECURRING_PAGE_LIMIT),
  })
  if (status !== 'ALL') params.set('status', status)
  return api<RecurringListResponse>(`/recurring?${params}`, {
    signal,
    cacheReads: true,
  })
}

export async function getRecurring(
  id: string,
  signal?: AbortSignal
): Promise<RecurringInvoice> {
  return api<RecurringInvoice>(`/recurring/${id}`, {
    signal,
    cacheReads: true,
  })
}

export async function createRecurring(
  input: CreateRecurringInput,
  signal?: AbortSignal
): Promise<RecurringInvoice> {
  return api<RecurringInvoice>('/recurring', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'recurring-invoice',
    entityLabel: `New ${input.frequency.toLowerCase()} recurring invoice`,
  })
}

export async function updateRecurring(
  id: string,
  input: UpdateRecurringInput,
  entityLabel: string,
  signal?: AbortSignal
): Promise<RecurringInvoice> {
  return api<RecurringInvoice>(`/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'recurring-invoice',
    entityLabel,
  })
}

export async function pauseRecurring(
  id: string,
  entityLabel: string,
  signal?: AbortSignal
): Promise<RecurringInvoice> {
  return api<RecurringInvoice>(`/recurring/${id}/pause`, {
    method: 'POST',
    headers: replayHeaders(),
    signal,
    entityType: 'recurring-invoice',
    entityLabel,
  })
}

export async function resumeRecurring(
  id: string,
  entityLabel: string,
  signal?: AbortSignal
): Promise<RecurringInvoice> {
  return api<RecurringInvoice>(`/recurring/${id}/resume`, {
    method: 'POST',
    headers: replayHeaders(),
    signal,
    entityType: 'recurring-invoice',
    entityLabel,
  })
}

export async function generateNow(
  id: string,
  entityLabel: string,
  idempotencyKey: string,
  signal?: AbortSignal
): Promise<{ documentId: string; runId: string; nextRunDate: string }> {
  return api(`/recurring/${id}/generate-now`, {
    method: 'POST',
    headers: {
      ...replayHeaders(),
      'x-idempotency-key': idempotencyKey,
    },
    signal,
    entityType: 'recurring-invoice',
    entityLabel,
  })
}

export async function deleteRecurring(
  id: string,
  entityLabel: string,
  signal?: AbortSignal
): Promise<{ deleted: boolean; hard: boolean }> {
  return api<{ deleted: boolean; hard: boolean }>(`/recurring/${id}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    signal,
    entityType: 'recurring-invoice',
    entityLabel,
  })
}

export async function listRuns(
  id: string,
  cursor?: string,
  signal?: AbortSignal
): Promise<RecurringRunsResponse> {
  const params = new URLSearchParams({ limit: String(RECURRING_RUNS_PAGE_LIMIT) })
  if (cursor) params.set('cursor', cursor)
  // NOT cached — run history changes on every generation
  return api<RecurringRunsResponse>(`/recurring/${id}/runs?${params}`, { signal })
}

export async function generateDueInvoices(
  signal?: AbortSignal
): Promise<{ generated: number }> {
  return api<{ generated: number }>('/recurring/generate', {
    method: 'POST',
    headers: replayHeaders(),
    signal,
    entityType: 'recurring-invoice',
    entityLabel: 'Generate due invoices',
  })
}
