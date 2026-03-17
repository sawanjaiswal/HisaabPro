/** Other Income — API service layer */

import { api } from '@/lib/api'
import type {
  OtherIncome,
  OtherIncomeListResponse,
  OtherIncomeSummary,
  CreateOtherIncomeInput,
} from './other-income.types'

const PAGE_LIMIT = 20

function replayHeaders(): HeadersInit {
  return {
    'X-Request-Nonce': crypto.randomUUID(),
    'X-Request-Timestamp': String(Date.now()),
  }
}

export async function listOtherIncome(
  page: number,
  category: string | null,
  signal?: AbortSignal
): Promise<OtherIncomeListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) })
  if (category) params.set('category', category)
  return api<OtherIncomeListResponse>(`/other-income?${params}`, { signal })
}

export async function getOtherIncome(id: string, signal?: AbortSignal): Promise<OtherIncome> {
  return api<OtherIncome>(`/other-income/${id}`, { signal })
}

export async function createOtherIncome(
  input: CreateOtherIncomeInput,
  signal?: AbortSignal
): Promise<OtherIncome> {
  return api<OtherIncome>('/other-income', {
    method: 'POST',
    body: JSON.stringify(input),
    headers: replayHeaders(),
    signal,
  })
}

export async function deleteOtherIncome(id: string, signal?: AbortSignal): Promise<void> {
  return api<void>(`/other-income/${id}`, {
    method: 'DELETE',
    headers: replayHeaders(),
    signal,
  })
}

export async function getOtherIncomeSummary(
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<OtherIncomeSummary> {
  const params = new URLSearchParams({ from, to })
  return api<OtherIncomeSummary>(`/other-income/summary?${params}`, { signal })
}
