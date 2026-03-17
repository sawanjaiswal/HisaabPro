/** Recurring Invoices — API service layer
 *
 * All mutation requests include replay-protection headers:
 *   X-Request-Nonce      — crypto.randomUUID(), unique per request
 *   X-Request-Timestamp  — Unix ms, server validates within ±5 min window
 *
 * Every fetch accepts an AbortSignal so the calling hook can cancel on cleanup,
 * preventing stale responses from corrupting state (RESILIENCE_RULES).
 */

import { api } from '@/lib/api'
import type {
  RecurringInvoice,
  RecurringListResponse,
  CreateRecurringInput,
  UpdateRecurringInput,
} from './recurring.types'
import { RECURRING_PAGE_LIMIT } from './recurring.constants'

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
  return api<RecurringListResponse>(`/recurring?${params}`, { signal })
}

export async function getRecurring(
  id: string,
  signal?: AbortSignal
): Promise<RecurringInvoice> {
  return api<RecurringInvoice>(`/recurring/${id}`, { signal })
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
  })
}

export async function updateRecurring(
  id: string,
  input: UpdateRecurringInput,
  signal?: AbortSignal
): Promise<RecurringInvoice> {
  return api<RecurringInvoice>(`/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
  })
}

export async function deleteRecurring(
  id: string,
  signal?: AbortSignal
): Promise<void> {
  return api<void>(`/recurring/${id}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    signal,
  })
}

export async function generateDueInvoices(
  signal?: AbortSignal
): Promise<{ generated: number }> {
  return api<{ generated: number }>('/recurring/generate', {
    method: 'POST',
    headers: replayHeaders(),
    signal,
  })
}
