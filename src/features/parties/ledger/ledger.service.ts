/** Party Ledger — API service layer */

import { api } from '@/lib/api'
import type { LedgerResponse, LedgerParams } from './ledger.types'

/**
 * Fetch party ledger with date range, optional voucher type filter, and cursor pagination.
 * Reads are cached per-session — ledger is safe to cache (no cross-party PII).
 */
export async function getPartyLedger(
  partyId: string,
  params: LedgerParams,
  signal?: AbortSignal,
): Promise<LedgerResponse> {
  const qs = buildLedgerQuery(params)
  return api<LedgerResponse>(
    `/parties/${encodeURIComponent(partyId)}/ledger${qs}`,
    { signal, cacheReads: true },
  )
}

function buildLedgerQuery(params: LedgerParams): string {
  const p = new URLSearchParams()
  p.set('from', params.from)
  p.set('to', params.to)
  if (params.voucherTypes && params.voucherTypes.length > 0) {
    p.set('voucherTypes', params.voucherTypes.join(','))
  }
  if (params.cursor) p.set('cursor', params.cursor)
  if (params.limit !== undefined) p.set('limit', String(params.limit))
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}
