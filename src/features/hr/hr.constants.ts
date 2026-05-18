/** HR feature constants — Phase 6 PR5 + PR6 FE
 *
 * PR5: Attendance status labels, colors, icons, cycle order, range cap.
 * PR6: Employee bounds (mirror BE Zod), payroll status + mode i18n keys,
 *      idempotency-key helper.
 *
 * Translation-key suffixes resolve to BOTH `translations.en.ts` AND
 * `translations.hi.ts` — never hardcode strings here.
 */

import type { AttendanceStatus } from './hr.types'

// ─── Attendance status — PR5 ─────────────────────────────────────────────────

export const ATTENDANCE_STATUS_I18N_KEYS: Record<AttendanceStatus, string> = {
  PRESENT:      'attendanceStatusPresent',
  ABSENT:       'attendanceStatusAbsent',
  HALF_DAY:     'attendanceStatusHalfDay',
  LEAVE_PAID:   'attendanceStatusLeavePaid',
  LEAVE_UNPAID: 'attendanceStatusLeaveUnpaid',
}

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT:      'var(--color-success-600)',
  ABSENT:       'var(--color-error-600)',
  HALF_DAY:     'var(--color-warning-600)',
  LEAVE_PAID:   'var(--color-primary-500)',
  LEAVE_UNPAID: 'var(--color-gray-500)',
}

export const ATTENDANCE_STATUS_BG: Record<AttendanceStatus, string> = {
  PRESENT:      'var(--color-success-50)',
  ABSENT:       'var(--color-error-50)',
  HALF_DAY:     'var(--color-warning-50)',
  LEAVE_PAID:   'var(--color-primary-50)',
  LEAVE_UNPAID: 'var(--color-gray-100)',
}

export const ATTENDANCE_STATUS_ICONS: Record<AttendanceStatus, string> = {
  PRESENT:      'Check',
  ABSENT:       'X',
  HALF_DAY:     'CircleDot',
  LEAVE_PAID:   'Plane',
  LEAVE_UNPAID: 'PlaneTakeoff',
}

export const ATTENDANCE_CYCLE: ReadonlyArray<AttendanceStatus> = [
  'PRESENT',
  'HALF_DAY',
  'ABSENT',
  'LEAVE_PAID',
  'LEAVE_UNPAID',
] as const

export const ATTENDANCE_DEFAULT_VIEW: 'week' | 'month' = 'week'
export const ATTENDANCE_RANGE_MAX_DAYS = 92
export const ATTENDANCE_BATCH_MAX = 500

// ─── Employee bounds (mirror BE Zod) — PR6 ───────────────────────────────────

/** Mirror server/src/schemas/employee.schemas.ts:38 — name trimmed 1..120. */
export const EMPLOYEE_NAME_MAX = 120
/** Mirror server schema:40 — designation trimmed max 80. */
export const DESIGNATION_MAX = 80
/** Mirror server schema:12 — DAILY_RATE_MAX_PAISE = Rs 10,000/day in paise. */
export const DAILY_RATE_MAX_PAISE = 1_000_000
/** Mirror server schema:15 — E.164-ish 10..15 digits, optional leading '+'. */
export const PHONE_REGEX = /^\+?[0-9]{10,15}$/

/** Default page size for GET /hr/employees. Server caps at 100. */
export const EMPLOYEE_LIST_DEFAULT_LIMIT = 20

// ─── Payroll status + mode i18n keys — PR6 ───────────────────────────────────

/** PayrollRun.status — DRAFT is unused on the wire today but reserved. */
export type PayrollRunStatus = 'DRAFT' | 'FINALIZED' | 'REVERSED'

export const PAYROLL_STATUS_I18N_KEYS: Record<PayrollRunStatus, string> = {
  DRAFT:     'payrollStatusDraft',
  FINALIZED: 'payrollStatusFinalized',
  REVERSED:  'payrollStatusReversed',
}

/** Match Badge variants — `info` for finalized, `overdue` (red) for reversed. */
export const PAYROLL_STATUS_BADGE_VARIANT: Record<
  PayrollRunStatus,
  'paid' | 'pending' | 'overdue' | 'draft' | 'info'
> = {
  DRAFT:     'draft',
  FINALIZED: 'info',
  REVERSED:  'overdue',
}

/** Mirror BE PAYROLL_PAYMENT_MODES — full union supported by the BE Zod. */
export type PayrollPaymentMode =
  | 'CASH'
  | 'UPI'
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'NEFT_RTGS_IMPS'
  | 'CREDIT_CARD'
  | 'OTHER'

/** UI-exposed subset — covers >99% of MSME payroll. */
export const PAYROLL_MODE_CHOICES: ReadonlyArray<PayrollPaymentMode> = [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
] as const

export const PAYROLL_MODE_I18N_KEYS: Record<PayrollPaymentMode, string> = {
  CASH:           'payrollModeCash',
  UPI:            'payrollModeUpi',
  BANK_TRANSFER:  'payrollModeBankTransfer',
  CHEQUE:         'payrollModeCheque',
  NEFT_RTGS_IMPS: 'payrollModeNeftRtgsImps',
  CREDIT_CARD:    'payrollModeCreditCard',
  OTHER:          'payrollModeOther',
}

// ─── Idempotency helper ──────────────────────────────────────────────────────

/**
 * Mint a fresh UUID per logical attempt. The same key MUST be re-used on a
 * network retry (handled by the offline queue) so the BE de-dupes; minting a
 * new one for each `mutate()` call from the caller is the correct grain.
 */
export function idempotencyKey(): string {
  return crypto.randomUUID()
}
