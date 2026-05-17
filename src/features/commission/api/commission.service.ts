/**
 * Commission #128 — API wrappers (all via api() — no raw fetch).
 *
 * Endpoints (server SSOT: server/src/routes/commission.routes.ts):
 *   GET    /api/commission/rules                  → { rules: CommissionRuleDTO[] }
 *   GET    /api/commission/rules/:id              → { rule }
 *   POST   /api/commission/rules                  → { rule }   201
 *   PUT    /api/commission/rules/:id              → { rule }
 *   DELETE /api/commission/rules/:id              → { ok: true }
 *   GET    /api/commission/ledger?periodYearMonth → CommissionLedgerPageDTO
 *   GET    /api/commission/leaderboard?periodYearMonth → CommissionLeaderboardResponseDTO
 *
 * Cache strategy (Offline Rule 3):
 *   - Rules are tenant-scoped configuration → cacheReads: true (small payload).
 *   - Ledger + leaderboard are PII (per-staff payouts) → cacheReads: false.
 *
 * Mutations include `entityType: 'commission_rule'` + `entityLabel` per
 * Offline Rule 2 so the queue UI shows "Commission rule — <name>".
 *
 * S2 / M4 server contract:
 *   - 400 COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT → form maps via ApiError.code
 *   - 404 STAFF_NOT_FOUND on cross-tenant ledger probe → hook catches +
 *     shows commissionStaffNotFoundToast (cross-tenant probe).
 */

import { api, ApiError } from '@/lib/api'
import { ERR_STAFF_NOT_FOUND, LEDGER_PAGE_SIZE } from '../commission.constants'
import type {
  CommissionRuleDTO,
  CommissionRuleInput,
  CommissionLedgerPageDTO,
  CommissionLeaderboardResponseDTO,
} from '../commission.types'

// ─── Rule CRUD ─────────────────────────────────────────────────────────────

interface ListRulesResponse {
  rules: CommissionRuleDTO[]
}

interface SingleRuleResponse {
  rule: CommissionRuleDTO
}

export interface ListRulesParams {
  includeInactive?: boolean
}

export async function listRules(
  params: ListRulesParams = {}
): Promise<CommissionRuleDTO[]> {
  const qs = new URLSearchParams()
  if (params.includeInactive) qs.set('includeInactive', 'true')
  const tail = qs.toString()
  const res = await api<ListRulesResponse>(
    `/commission/rules${tail ? `?${tail}` : ''}`,
    { cacheReads: true }
  )
  return res?.rules ?? []
}

export async function getRule(id: string): Promise<CommissionRuleDTO | null> {
  const res = await api<SingleRuleResponse>(
    `/commission/rules/${encodeURIComponent(id)}`,
    { cacheReads: true }
  )
  return res?.rule ?? null
}

export async function createRule(
  input: CommissionRuleInput
): Promise<CommissionRuleDTO | null> {
  const res = await api<SingleRuleResponse>('/commission/rules', {
    method: 'POST',
    body: JSON.stringify(input),
    entityType: 'commission_rule',
    entityLabel: input.name || 'Commission rule',
  })
  // Offline Rule 5 — api() may return `{}` when queued; tolerate it.
  return res?.rule ?? null
}

export async function updateRule(
  id: string,
  input: Partial<CommissionRuleInput>
): Promise<CommissionRuleDTO | null> {
  const res = await api<SingleRuleResponse>(
    `/commission/rules/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
      entityType: 'commission_rule',
      entityLabel: input.name || 'Commission rule',
    }
  )
  return res?.rule ?? null
}

export async function deleteRule(
  id: string,
  label: string
): Promise<void> {
  await api<{ ok: true }>(
    `/commission/rules/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
      entityType: 'commission_rule',
      entityLabel: label || 'Commission rule',
    }
  )
}

// ─── Ledger ────────────────────────────────────────────────────────────────

export interface ListLedgerParams {
  periodYearMonth: string
  staffUserId?: string
  cursor?: string
  limit?: number
}

/**
 * On 404 STAFF_NOT_FOUND (cross-tenant probe via ?staffUserId=other),
 * the hook layer catches the ApiError.code and shows a toast — we re-throw
 * so React Query enters the error state cleanly.
 */
export async function getLedger(
  params: ListLedgerParams
): Promise<CommissionLedgerPageDTO> {
  const qs = new URLSearchParams()
  qs.set('periodYearMonth', params.periodYearMonth)
  if (params.staffUserId) qs.set('staffUserId', params.staffUserId)
  if (params.cursor) qs.set('cursor', params.cursor)
  qs.set('limit', String(params.limit ?? LEDGER_PAGE_SIZE))
  try {
    return await api<CommissionLedgerPageDTO>(
      `/commission/ledger?${qs.toString()}`,
      { cacheReads: false }
    )
  } catch (err) {
    if (err instanceof ApiError && err.code === ERR_STAFF_NOT_FOUND) {
      // Re-throw with the same code so the hook layer can route to the toast.
      throw err
    }
    throw err
  }
}

// ─── Leaderboard ───────────────────────────────────────────────────────────

export interface ListLeaderboardParams {
  periodYearMonth: string
  limit?: number
}

export async function getLeaderboard(
  params: ListLeaderboardParams
): Promise<CommissionLeaderboardResponseDTO> {
  const qs = new URLSearchParams()
  qs.set('periodYearMonth', params.periodYearMonth)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  return api<CommissionLeaderboardResponseDTO>(
    `/commission/leaderboard?${qs.toString()}`,
    { cacheReads: false }
  )
}
