/**
 * Commission #128 — Rule + ledger constants.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §4.1 (rule schema),
 * §4.2 (ledger), §4.3 (specificity tie-break: PRODUCT > CATEGORY > ALL).
 *
 * All amounts in PAISE (integer). All rates in BASIS POINTS.
 * `rateBps` capped at 10000 = 100 % (security audit S2 — staff cannot earn
 * more than the gross/net of the sale).
 */

// ─── Rule scope ─────────────────────────────────────────────────────────────

export const COMMISSION_RULE_SCOPES = ['ALL', 'PRODUCT', 'CATEGORY'] as const
export type CommissionRuleScope = (typeof COMMISSION_RULE_SCOPES)[number]

/**
 * Specificity rank — higher number wins ties. PRODUCT-targeted rules
 * always trump CATEGORY rules, which always trump catch-all ALL rules.
 * Service-layer rule-picker sorts by this rank DESC, then by `createdAt`
 * DESC (most-recently-defined rule wins among equal specificity).
 */
export const COMMISSION_RULE_SCOPE_RANK: Record<CommissionRuleScope, number> = {
  PRODUCT: 3,
  CATEGORY: 2,
  ALL: 1,
}

// ─── Rule mode ──────────────────────────────────────────────────────────────

export const COMMISSION_RULE_MODES = [
  'PERCENT_GROSS', // % of line subtotal BEFORE discount
  'PERCENT_NET',   // % of line subtotal AFTER discount, BEFORE tax
  'FLAT_PER_UNIT', // fixed paise per unit sold
] as const
export type CommissionRuleMode = (typeof COMMISSION_RULE_MODES)[number]

/** Modes that require `rateBps` (and forbid `flatPerUnitPaise`) */
export const PERCENT_MODES: ReadonlySet<CommissionRuleMode> = new Set([
  'PERCENT_GROSS',
  'PERCENT_NET',
])

/** Modes that require `flatPerUnitPaise` (and forbid `rateBps`) */
export const FLAT_MODES: ReadonlySet<CommissionRuleMode> = new Set(['FLAT_PER_UNIT'])

// ─── Applies-to ─────────────────────────────────────────────────────────────

/**
 * `appliesTo` controls WHICH staff receive the commission:
 *  - ALL: every staff user on the business inherits the rule
 *  - LIST: only `staffUserIds[]` receive it
 */
export const COMMISSION_APPLIES_TO_VALUES = ['ALL', 'LIST'] as const
export type CommissionAppliesTo = (typeof COMMISSION_APPLIES_TO_VALUES)[number]

// ─── Validation bounds ─────────────────────────────────────────────────────

/** Rate cap = 100 % — staff never earn more than the basis (audit S2) */
export const COMMISSION_RATE_MAX_BPS = 10000

export const COMMISSION_NAME_MIN_LEN = 1
export const COMMISSION_NAME_MAX_LEN = 80
export const COMMISSION_SCOPE_ID_MAX_LEN = 64

/** flatPerUnitPaise hard cap = Rs 10,000/unit — sanity guard, not a policy */
export const COMMISSION_FLAT_MAX_PAISE = 1_000_000

/** Architecture §4.4 — leaderboard + ledger pagination defaults */
export const COMMISSION_PAGE_SIZE_DEFAULT = 50
export const COMMISSION_PAGE_SIZE_MAX = 200

/** Architecture §4.4 — month string format YYYY-MM (matches periodYearMonth column) */
export const PERIOD_YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

// ─── Architecture §3.5 — CRM follow-ups query cap ───────────────────────────
// Lives here because the follow-ups schema imports both follow-up
// constants and commission constants in the same Zod file group.
// Architecture §3.5 + Security audit M3.
export const FOLLOW_UPS_WITHIN_DAYS_MIN = 1
export const FOLLOW_UPS_WITHIN_DAYS_MAX = 365
