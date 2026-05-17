/**
 * Commission #128 — Frontend DTOs.
 *
 * Mirrors the server contract exactly. Server SSOT:
 *   - server/src/services/commission/commission-rule.service.ts    (CommissionRuleDTO)
 *   - server/src/services/commission/commission-ledger.service.ts  (Ledger + Leaderboard DTOs)
 *   - server/src/services/commission/commission.constants.ts       (enums + bounds)
 *
 * All amounts in PAISE (integer). All rates in BASIS POINTS (1bp = 0.01%).
 * `rateBps` capped at 10000 = 100% (security audit S2). Server returns 400
 * `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT` if violated.
 *
 * Wire format: dates come back as ISO strings (JSON); kept as `string` on the
 * wire and parsed on render.
 */

// ─── Rule shape ────────────────────────────────────────────────────────────
// Specificity tie-break (architecture §4.5): PRODUCT > CATEGORY > ALL.
export type CommissionRuleScope = 'ALL' | 'PRODUCT' | 'CATEGORY'

// PERCENT_GROSS = % of subtotal BEFORE discount
// PERCENT_NET   = % of subtotal AFTER discount, BEFORE tax
// FLAT_PER_UNIT = paise per unit
export type CommissionRuleMode = 'PERCENT_GROSS' | 'PERCENT_NET' | 'FLAT_PER_UNIT'

// POS = POS sales · INVOICE = SALE_INVOICE document · BOTH = either
export type CommissionAppliesTo = 'POS' | 'INVOICE' | 'BOTH'

export interface CommissionRuleDTO {
  id: string
  businessId: string
  name: string
  scope: CommissionRuleScope
  scopeId: string | null
  mode: CommissionRuleMode
  /** Required when mode ∈ {PERCENT_GROSS, PERCENT_NET}. null otherwise. */
  rateBps: number | null
  /** Required when mode = FLAT_PER_UNIT. null otherwise. */
  flatPerUnitPaise: number | null
  appliesTo: CommissionAppliesTo
  /** Empty = all staff. Non-empty = only these staffUserIds. */
  staffUserIds: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CommissionRuleInput {
  name: string
  scope: CommissionRuleScope
  scopeId?: string | null
  mode: CommissionRuleMode
  rateBps?: number | null
  flatPerUnitPaise?: number | null
  appliesTo: CommissionAppliesTo
  staffUserIds: string[]
  isActive: boolean
}

// ─── Ledger ────────────────────────────────────────────────────────────────

export interface CommissionLedgerRowDTO {
  id: string
  staffUserId: string
  ruleId: string | null
  posSaleId: string | null
  documentId: string | null
  basisPaise: number
  /** Signed: positive for accruals, negative for void reversals. */
  commissionPaise: number
  /** YYYY-MM */
  periodYearMonth: string
  createdAt: string
  meta: unknown
}

export interface CommissionLedgerSummaryDTO {
  periodYearMonth: string
  totalCommissionPaise: number
  rowCount: number
}

export interface CommissionLedgerPageDTO {
  rows: CommissionLedgerRowDTO[]
  /** Cursor for next page — null = last page. */
  nextCursor: string | null
  summary: CommissionLedgerSummaryDTO
}

// ─── Leaderboard ───────────────────────────────────────────────────────────

export interface CommissionLeaderboardRowDTO {
  staffUserId: string
  staffName: string | null
  totalCommissionPaise: number
  rowCount: number
}

export interface CommissionLeaderboardResponseDTO {
  entries: CommissionLeaderboardRowDTO[]
  periodYearMonth: string
}

// ─── Client-side leaderboard sort (server returns ordered by amount desc) ──

export type LeaderboardSortKey = 'amount' | 'sale_count' | 'name'

// ─── Validation hint returned to forms ─────────────────────────────────────

export interface RateValidation {
  warn: boolean   // 5000 ≤ rateBps < 10000
  block: boolean  // rateBps >= 10000 (save disabled)
}
