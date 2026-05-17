/**
 * Commission #128 — Pure utility functions.
 *
 * No React, no api(), no toast — easily unit-testable.
 * - currentPeriodYearMonth: YYYY-MM for the current local month.
 * - bps ↔ percent conversions for the form.
 * - validateRateBps: returns { warn, block } for inline form states (S2).
 * - sortLeaderboard: client-side resort of the server's amount-desc payload.
 */

import {
  RATE_MAX_BPS,
  RATE_WARN_BPS,
} from './commission.constants'
import type {
  CommissionLeaderboardRowDTO,
  LeaderboardSortKey,
  RateValidation,
} from './commission.types'

// ─── Period helpers ───────────────────────────────────────────────────────

/** YYYY-MM for the current LOCAL month (matches periodYearMonth column). */
export function currentPeriodYearMonth(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Format YYYY-MM → "May 2026". Pure, locale-en-IN. */
export function formatPeriodLabel(periodYearMonth: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(periodYearMonth)
  if (!m) return periodYearMonth
  const year = Number(m[1])
  const monthIdx = Number(m[2]) - 1
  const d = new Date(year, monthIdx, 1)
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(d)
}

// ─── Rate ↔ percent conversion (used by CommissionRuleForm) ───────────────

/**
 * Parse a user-entered percent string (e.g. "1.5", "50") → basis points.
 * Empty / NaN → 0. Negative → 0. Non-integer percent is rounded.
 */
export function percentToBps(percentInput: string | number): number {
  const n = typeof percentInput === 'number' ? percentInput : parseFloat(String(percentInput))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

/** Format bps (integer) → user-facing percent string with up to 2 decimals. */
export function bpsToPercentLabel(bps: number): string {
  const pct = bps / 100
  // Trim trailing zeros: 1.00 → "1", 1.50 → "1.5"
  return String(parseFloat(pct.toFixed(2)))
}

// ─── Rate validation (S2 — server is authoritative, this is UX guard) ─────

/**
 * Returns the warn/block UI signal for the form.
 *  - rateBps < 5000  → { warn: false, block: false } (normal)
 *  - 5000 ≤ rateBps < 10000 → { warn: true, block: false } (yellow chip)
 *  - rateBps >= 10000 → { warn: false, block: true } (red, save disabled)
 *
 * NOTE: rateBps > 10000 is also `block: true` — the field caps at 100% in the
 * UI, but a fat-finger paste can still exceed. Server rejects with
 * COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT — we map that error to the toast.
 */
export function validateRateBps(rateBps: number): RateValidation {
  if (!Number.isFinite(rateBps) || rateBps < 0) {
    return { warn: false, block: false }
  }
  if (rateBps >= RATE_MAX_BPS) {
    return { warn: false, block: true }
  }
  if (rateBps >= RATE_WARN_BPS) {
    return { warn: true, block: false }
  }
  return { warn: false, block: false }
}

// ─── Leaderboard client-side sort ─────────────────────────────────────────

/**
 * Server returns entries sorted by amount desc. Resort client-side when the
 * user clicks a column header. Stable: equal keys preserve server order.
 */
export function sortLeaderboard(
  rows: readonly CommissionLeaderboardRowDTO[],
  sort: LeaderboardSortKey
): CommissionLeaderboardRowDTO[] {
  const copy = [...rows]
  if (sort === 'amount') {
    return copy.sort((a, b) => b.totalCommissionPaise - a.totalCommissionPaise)
  }
  if (sort === 'sale_count') {
    return copy.sort((a, b) => b.rowCount - a.rowCount)
  }
  // name — null names sort last, ties stable.
  return copy.sort((a, b) => {
    if (a.staffName == null && b.staffName == null) return 0
    if (a.staffName == null) return 1
    if (b.staffName == null) return -1
    return a.staffName.localeCompare(b.staffName, 'en-IN', { sensitivity: 'base' })
  })
}

// ─── Permission helper — reads from BusinessSummary.permissions ───────────

/**
 * Mirror of the server-side `requirePermission` check — owners bypass all
 * (empty `permissions: []` array on BusinessSummary).
 *
 * Note: AuthContext stores businesses; the caller resolves the active one and
 * passes its `permissions` array here. This avoids importing AuthContext in
 * utils.ts (keeps the module pure / testable).
 */
export function hasPermission(
  permissions: readonly string[] | undefined,
  permKey: string,
  isOwner: boolean
): boolean {
  if (isOwner) return true
  if (!permissions) return false
  return permissions.includes(permKey)
}
