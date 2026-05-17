/**
 * Commission #128 — Frontend constants.
 *
 * Mirrors `server/src/services/commission/commission.constants.ts`. Bounds
 * duplicated client-side so the form can validate before round-tripping; the
 * server is still the authority (security audit S2).
 */

import type {
  CommissionAppliesTo,
  CommissionRuleMode,
  CommissionRuleScope,
  LeaderboardSortKey,
} from './commission.types'

// ─── Rate bounds (mirrors COMMISSION_RATE_MAX_BPS on the server) ──────────

export const RATE_MIN_BPS = 0
/** Yellow warn at 50% — staff are taking half the sale. Configurable in finance. */
export const RATE_WARN_BPS = 5000
/** Hard cap at 100% — server rejects > 10000 with COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT */
export const RATE_MAX_BPS = 10000

// ─── Enum values (mirror server) ──────────────────────────────────────────

export const SCOPE_VALUES: readonly CommissionRuleScope[] = ['PRODUCT', 'CATEGORY', 'ALL']

export const MODE_VALUES: readonly CommissionRuleMode[] = [
  'PERCENT_GROSS',
  'PERCENT_NET',
  'FLAT_PER_UNIT',
]

export const APPLIES_TO_VALUES: readonly CommissionAppliesTo[] = ['POS', 'INVOICE', 'BOTH']

// ─── Field bounds ──────────────────────────────────────────────────────────

export const NAME_MIN_LEN = 1
export const NAME_MAX_LEN = 80

/** Flat-per-unit hard cap (paise) = Rs 10,000/unit — server sanity guard. */
export const FLAT_MAX_PAISE = 1_000_000

// ─── Pagination + UI knobs ────────────────────────────────────────────────

export const LEDGER_PAGE_SIZE = 50
export const LEDGER_PAGE_SIZE_MAX = 200

export const LEADERBOARD_DEFAULT_LIMIT = 50

// ─── Leaderboard client-side sort options ─────────────────────────────────

export const SORT_OPTIONS: readonly LeaderboardSortKey[] = [
  'amount',
  'sale_count',
  'name',
]

/** i18n key per sort option — populated in ext42. */
export const SORT_LABEL_KEY: Record<LeaderboardSortKey, string> = {
  amount: 'commissionLeaderboardSortByAmount',
  sale_count: 'commissionLeaderboardSortByCount',
  name: 'commissionLeaderboardSortByName',
}

// ─── Server error codes the FE handles by name ────────────────────────────

export const ERR_RATE_EXCEEDS = 'COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT'
export const ERR_STAFF_NOT_FOUND = 'STAFF_NOT_FOUND'
