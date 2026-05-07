/**
 * Cash Register — API service layer.
 * All calls go through api() from @/lib/api. Never raw fetch().
 * Mutations carry entityType + entityLabel per OFFLINE_RULES Rule 2.
 * No cacheReads — entries carry PII (freeform notes).
 */

import { api } from '@/lib/api'
import { formatPaise } from './cashRegister.utils'
import type { CashEntryDTO, CashSummaryDTO, CashHistoryFilter, CashHistorySort } from './cashRegister.types'

type ListResult = { entries: CashEntryDTO[]; nextCursor: string | null }

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listCashEntries(args: {
  businessId: string
  filter: CashHistoryFilter
  sort: CashHistorySort
  tzOffsetMinutes: number
  cursor?: string
  limit?: number
}): Promise<ListResult> {
  const p = new URLSearchParams()
  if (args.filter.direction) p.set('direction', args.filter.direction)
  if (args.filter.includeVoided) p.set('includeVoided', 'true')
  p.set('tzOffsetMinutes', String(args.tzOffsetMinutes))
  if (args.cursor) p.set('cursor', args.cursor)
  if (args.limit) p.set('limit', String(args.limit))

  return api<ListResult>(
    `/cash-entries?${p}`,
    { method: 'GET' },
  )
}

export async function getCashSummary(args: {
  businessId: string
  tzOffsetMinutes: number
}): Promise<CashSummaryDTO> {
  const p = new URLSearchParams({ tzOffsetMinutes: String(args.tzOffsetMinutes) })
  return api<CashSummaryDTO>(
    `/cash-entries/summary?${p}`,
    { method: 'GET' },
  )
}

export async function getCashEntry(args: {
  businessId: string
  id: string
}): Promise<CashEntryDTO> {
  return api<CashEntryDTO>(
    `/cash-entries/${args.id}`,
    { method: 'GET' },
  )
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function postCashEntry(args: {
  businessId: string
  direction: 'IN' | 'OUT'
  amountPaise: number
  expression: string
  note: string | null
  idempotencyKey: string
}): Promise<CashEntryDTO> {
  const res = await api<{ success: true; entry: CashEntryDTO }>(
    `/cash-entries`,
    {
      method: 'POST',
      body: JSON.stringify({
        direction: args.direction,
        expression: args.expression,
        ...(args.note != null ? { note: args.note } : {}),
      }),
      entityType: 'cashEntry',
      entityLabel: formatPaise(args.amountPaise),
      headers: { 'X-Idempotency-Key': args.idempotencyKey },
    },
  )
  return res.entry
}

export async function patchCashEntry(args: {
  businessId: string
  id: string
  patch: { direction?: 'IN' | 'OUT'; amountPaise?: number; expression?: string; note?: string | null }
  idempotencyKey: string
}): Promise<CashEntryDTO> {
  const res = await api<{ success: true; entry: CashEntryDTO }>(
    `/cash-entries/${args.id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(args.patch),
      entityType: 'cashEntry',
      entityLabel: 'Cash entry edit',
      headers: { 'X-Idempotency-Key': args.idempotencyKey },
    },
  )
  return res.entry
}

export async function voidCashEntry(args: {
  businessId: string
  id: string
  reason: string | null
  idempotencyKey: string
}): Promise<CashEntryDTO> {
  const res = await api<{ success: true; entry: CashEntryDTO }>(
    `/cash-entries/${args.id}/void`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: args.reason }),
      entityType: 'cashEntry',
      entityLabel: 'Void cash entry',
      headers: { 'X-Idempotency-Key': args.idempotencyKey },
    },
  )
  return res.entry
}

export async function restoreCashEntry(args: {
  businessId: string
  id: string
  idempotencyKey: string
}): Promise<CashEntryDTO> {
  const res = await api<{ success: true; entry: CashEntryDTO }>(
    `/cash-entries/${args.id}/restore`,
    {
      method: 'POST',
      body: JSON.stringify({}),
      entityType: 'cashEntry',
      entityLabel: 'Restore cash entry',
      headers: { 'X-Idempotency-Key': args.idempotencyKey },
    },
  )
  return res.entry
}

export async function deleteCashEntry(args: {
  businessId: string
  id: string
  idempotencyKey: string
}): Promise<void> {
  await api<void>(
    `/cash-entries/${args.id}`,
    {
      method: 'DELETE',
      entityType: 'cashEntry',
      entityLabel: 'Delete cash entry',
      headers: { 'X-Idempotency-Key': args.idempotencyKey },
    },
  )
}
