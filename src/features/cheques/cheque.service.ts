/** Cheques — API service layer */

import { api } from '@/lib/api'
import type {
  Cheque,
  ChequeListResponse,
  ChequeSummary,
  CreateChequeInput,
  UpdateChequeStatusInput,
} from './cheque.types'
import { CHEQUE_PAGE_LIMIT } from './cheque.constants'

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

export async function listCheques(
  page: number,
  status: string,
  signal?: AbortSignal
): Promise<ChequeListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(CHEQUE_PAGE_LIMIT) })
  if (status !== 'ALL') params.set('status', status)
  return api<ChequeListResponse>(`/cheques?${params}`, { signal })
}

export async function getCheque(id: string, signal?: AbortSignal): Promise<Cheque> {
  return api<Cheque>(`/cheques/${id}`, { signal })
}

export async function createCheque(
  input: CreateChequeInput,
  signal?: AbortSignal
): Promise<Cheque> {
  return api<Cheque>('/cheques', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'cheque',
    entityLabel: input.chequeNumber ? `Cheque ${input.chequeNumber}` : 'New cheque',
  })
}

export async function updateChequeStatus(
  id: string,
  input: UpdateChequeStatusInput,
  signal?: AbortSignal
): Promise<Cheque> {
  return api<Cheque>(`/cheques/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
    entityType: 'cheque',
    entityLabel: `Mark cheque ${input.status}`,
  })
}

export async function deleteCheque(id: string, signal?: AbortSignal): Promise<void> {
  return api<void>(`/cheques/${id}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    signal,
    entityType: 'cheque',
    entityLabel: 'Delete cheque',
  })
}

export async function getChequeSummary(signal?: AbortSignal): Promise<ChequeSummary> {
  return api<ChequeSummary>('/cheques/summary', { signal })
}
