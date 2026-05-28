/** #147 Bank reconciliation — API service layer. */
import { api } from '@/lib/api'
import type {
  CreateImportInput,
  CreateImportResult,
  ListLinesResult,
  ReconTab,
} from './bank-reconciliation.types'

const BASE = '/bank-reconciliation'

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

export async function createImport(
  input: CreateImportInput,
  signal?: AbortSignal,
): Promise<CreateImportResult> {
  return api<CreateImportResult>(`${BASE}/imports`, {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'bank-statement-import',
    entityLabel: input.fileName,
  })
}

export async function listLines(
  tab: ReconTab,
  bankAccountId: string | null,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<ListLinesResult> {
  const params = new URLSearchParams({ status: tab, limit: '50' })
  if (bankAccountId) params.set('bankAccountId', bankAccountId)
  if (cursor) params.set('cursor', cursor)
  return api<ListLinesResult>(`${BASE}/lines?${params}`, { signal })
}

export async function confirmLine(lineId: string): Promise<unknown> {
  return api(`${BASE}/lines/${lineId}/confirm`, {
    method: 'POST',
    headers: replayHeaders(),
    entityType: 'reconciliation-match',
    entityLabel: 'Confirm match',
  })
}

export async function matchLine(lineId: string, paymentId: string): Promise<unknown> {
  return api(`${BASE}/lines/${lineId}/match`, {
    method: 'POST',
    body: JSON.stringify({ paymentId }),
    headers: replayHeaders(),
    entityType: 'reconciliation-match',
    entityLabel: 'Manual match',
  })
}

export async function ignoreLine(lineId: string): Promise<unknown> {
  return api(`${BASE}/lines/${lineId}/ignore`, {
    method: 'POST',
    headers: replayHeaders(),
    entityType: 'bank-statement-line',
    entityLabel: 'Ignore line',
  })
}

export async function unreconcileLine(lineId: string): Promise<unknown> {
  return api(`${BASE}/matches/${lineId}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    entityType: 'reconciliation-match',
    entityLabel: 'Un-reconcile',
  })
}
