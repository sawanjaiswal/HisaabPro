/**
 * Loyalty #125 — API wrappers (all via api() — no raw fetch).
 *
 * Endpoints (server SSOT: server/src/routes/loyalty.routes.ts):
 *   GET    /api/loyalty/program             → { program: LoyaltyProgramDTO | null }
 *   PUT    /api/loyalty/program             → { program: LoyaltyProgramDTO }
 *   GET    /api/loyalty/balance/:partyId    → LoyaltyBalanceDTO
 *   GET    /api/loyalty/ledger/:partyId     → LoyaltyLedgerPageDTO
 *
 * Cache strategy (Offline Rule 3):
 *   - getProgram is cached — small payload, business-scoped, refreshed on PUT.
 *   - getBalance + getLedger are PII (per-party history) → cacheReads: false.
 *
 * Mutations include `entityType` + `entityLabel` per Offline Rule 2 so the
 * sync queue shows "Loyalty program" instead of "Offline change".
 */

import { api } from '@/lib/api'
import { LEDGER_PAGE_SIZE_DEFAULT } from '../loyalty.constants'
import type {
  LoyaltyProgramDTO,
  LoyaltyProgramInput,
  LoyaltyBalanceDTO,
  LoyaltyLedgerPageDTO,
} from '../loyalty.types'

// ─── Program ────────────────────────────────────────────────────────────────

interface ProgramResponse {
  program: LoyaltyProgramDTO | null
}

export async function getProgram(): Promise<LoyaltyProgramDTO | null> {
  // Safe to cache: same payload for every read in the tenant, refreshed on PUT.
  const res = await api<ProgramResponse>('/loyalty/program', { cacheReads: true })
  return res.program ?? null
}

export async function updateProgram(
  input: LoyaltyProgramInput
): Promise<LoyaltyProgramDTO | null> {
  const res = await api<ProgramResponse>('/loyalty/program', {
    method: 'PUT',
    body: JSON.stringify(input),
    entityType: 'loyalty_program',
    entityLabel: 'Loyalty program',
  })
  // Offline Rule 5 — api() may return `{}` when queued; tolerate it.
  return res?.program ?? null
}

// ─── Balance ────────────────────────────────────────────────────────────────

export async function getBalance(partyId: string): Promise<LoyaltyBalanceDTO> {
  return api<LoyaltyBalanceDTO>(
    `/loyalty/balance/${encodeURIComponent(partyId)}`,
    { cacheReads: false }
  )
}

// ─── Ledger ─────────────────────────────────────────────────────────────────

export interface ListLedgerParams {
  cursor?: string
  limit?: number
}

export async function getLedger(
  partyId: string,
  params: ListLedgerParams = {}
): Promise<LoyaltyLedgerPageDTO> {
  const qs = new URLSearchParams()
  if (params.cursor) qs.set('cursor', params.cursor)
  qs.set('limit', String(params.limit ?? LEDGER_PAGE_SIZE_DEFAULT))
  const tail = qs.toString()
  return api<LoyaltyLedgerPageDTO>(
    `/loyalty/ledger/${encodeURIComponent(partyId)}${tail ? `?${tail}` : ''}`,
    { cacheReads: false }
  )
}
