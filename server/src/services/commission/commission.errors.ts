/**
 * Commission #128 — Service-layer error factories.
 * Architecture: docs/ARCHITECTURE_EPIC_D_crm_loyalty.md §4 + §6.4 (RBAC).
 * Security audit M4 (STAFF_NOT_FOUND), S2 (RATE_MAX), M3 (WITHIN_DAYS_RANGE).
 *
 * Each factory wraps `AppError` with a Commission-specific code + status +
 * safe message. Service code throws these directly; global errorHandler
 * serializes them to `{ success: false, error: { code, message, details? } }`.
 */

import { AppError, ErrorCode } from '../../lib/errors.js'
import { COMMISSION_RATE_MAX_BPS } from './commission.constants.js'

// ─── 400 — bad input / business-rule violation ─────────────────────────────

/**
 * 400 COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT — rateBps > 10000.
 * Security audit S2. Zod schema is the first line of defence; this
 * factory exists for service-layer guards (e.g. bulk rule import).
 */
export function commissionRateExceedsMaxError(rateBps: number): AppError {
  return new AppError(
    ErrorCode.COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT,
    400,
    `Commission rate cannot exceed ${COMMISSION_RATE_MAX_BPS} bps (100 %)`,
    { rateBps, maxBps: COMMISSION_RATE_MAX_BPS }
  )
}

/**
 * 400 COMMISSION_RULE_MODE_MISMATCH — mode says PERCENT_* but rateBps missing,
 * or mode says FLAT_PER_UNIT but flatPerUnitPaise missing. Zod schema
 * normally catches this — factory is for service-layer follow-up checks.
 */
export function commissionRuleModeMismatchError(detail: string): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    `Commission rule mode mismatch: ${detail}`,
    { reason: 'COMMISSION_RULE_MODE_MISMATCH' }
  )
}

/**
 * 400 COMMISSION_RULE_SCOPE_MISMATCH — scope=PRODUCT/CATEGORY but scopeId
 * missing, or scope=ALL but scopeId present.
 */
export function commissionRuleScopeMismatchError(detail: string): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    `Commission rule scope mismatch: ${detail}`,
    { reason: 'COMMISSION_RULE_SCOPE_MISMATCH' }
  )
}

/**
 * 400 INVALID_WITHIN_DAYS_RANGE — CRM follow-ups withinDays query parameter
 * outside [1, 365]. Security audit M3 — prevents accidental full-table scans.
 *
 * NOTE: Lives in commission.errors.ts because the CRM party additions and
 * the commission RBAC checks share the same security audit batch; placing
 * here keeps the error in one of the new-file groups and avoids touching
 * the un-namespaced shared errors.ts more than necessary.
 */
export function invalidWithinDaysRangeError(value: number, min: number, max: number): AppError {
  return new AppError(
    ErrorCode.INVALID_WITHIN_DAYS_RANGE,
    400,
    `withinDays must be between ${min} and ${max} (got ${value})`,
    { value, min, max }
  )
}

/**
 * 400 INVALID_PERIOD_YEAR_MONTH — periodYearMonth not in YYYY-MM format
 * or refers to a month so far past/future that ledger reads are pointless.
 */
export function invalidPeriodYearMonthError(value: string): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    400,
    'periodYearMonth must be in YYYY-MM format',
    { reason: 'INVALID_PERIOD_YEAR_MONTH', value }
  )
}

// ─── 403 — permission denied (specific to commission view scope) ───────────

/**
 * 403 COMMISSION_OTHER_STAFF_DENIED — staff role tried to read another
 * staff's ledger / leaderboard row (security audit §6.4 RBAC matrix).
 *
 * Sits in commission.errors.ts because the permission key
 * `commission.view_all` is also Commission-specific. The shared
 * `unauthorizedError()` from errors.ts uses 401 — this is 403.
 */
export function commissionOtherStaffDeniedError(): AppError {
  return new AppError(
    ErrorCode.PERMISSION_DENIED,
    403,
    'You do not have permission to view other staff commissions',
    { reason: 'COMMISSION_OTHER_STAFF_DENIED' }
  )
}

// ─── 404 — addressed resource missing ──────────────────────────────────────

/**
 * 404 STAFF_NOT_FOUND — caller requested ledger/leaderboard for a staffUserId
 * that either doesn't exist or belongs to a different business.
 * Security audit M4 — protects against cross-tenant staff enumeration.
 */
export function staffNotFoundError(staffUserId: string): AppError {
  return new AppError(
    ErrorCode.STAFF_NOT_FOUND,
    404,
    'Staff user not found',
    { staffUserId }
  )
}

/**
 * 404 COMMISSION_RULE_NOT_FOUND — rule id missing or cross-tenant.
 */
export function commissionRuleNotFoundError(ruleId: string): AppError {
  return new AppError(
    ErrorCode.NOT_FOUND,
    404,
    'Commission rule not found',
    { ruleId }
  )
}
