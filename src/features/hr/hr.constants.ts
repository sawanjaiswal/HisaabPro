/** HR feature constants — Phase 6 PR5 FE
 *
 * Status labels, colors, and icons for AttendanceStatusPill + grid header.
 * Colors map to existing semantic tokens (--color-success-*, --color-error-*,
 * --color-warning-*, --color-primary-*, --color-gray-* for "neutral").
 * Icons are lucide-react component names (resolved by the consumer to keep
 * this file a pure constants module with zero JSX imports).
 */

import type { AttendanceStatus } from './hr.types'

/** Translation-key suffixes — full keys live in translations.{en,hi}.ts. */
export const ATTENDANCE_STATUS_I18N_KEYS: Record<AttendanceStatus, string> = {
  PRESENT:      'attendanceStatusPresent',
  ABSENT:       'attendanceStatusAbsent',
  HALF_DAY:     'attendanceStatusHalfDay',
  LEAVE_PAID:   'attendanceStatusLeavePaid',
  LEAVE_UNPAID: 'attendanceStatusLeaveUnpaid',
}

/** Solid colors for the pill border/text — used inline via style={{ color }}. */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT:      'var(--color-success-600)',
  ABSENT:       'var(--color-error-600)',
  HALF_DAY:     'var(--color-warning-600)',
  LEAVE_PAID:   'var(--color-primary-500)',
  LEAVE_UNPAID: 'var(--color-gray-500)',
}

/** Tinted background — paired with the solid color for the pill fill. */
export const ATTENDANCE_STATUS_BG: Record<AttendanceStatus, string> = {
  PRESENT:      'var(--color-success-50)',
  ABSENT:       'var(--color-error-50)',
  HALF_DAY:     'var(--color-warning-50)',
  LEAVE_PAID:   'var(--color-primary-50)',
  LEAVE_UNPAID: 'var(--color-gray-100)',
}

/** lucide-react icon component names. The consumer imports + maps to the JSX. */
export const ATTENDANCE_STATUS_ICONS: Record<AttendanceStatus, string> = {
  PRESENT:      'Check',
  ABSENT:       'X',
  HALF_DAY:     'CircleDot',
  LEAVE_PAID:   'Plane',
  LEAVE_UNPAID: 'PlaneTakeoff',
}

/** Click-cycle order. Tapping a pill advances by one (wraps at end). */
export const ATTENDANCE_CYCLE: ReadonlyArray<AttendanceStatus> = [
  'PRESENT',
  'HALF_DAY',
  'ABSENT',
  'LEAVE_PAID',
  'LEAVE_UNPAID',
] as const

/** Default = current week. The grid loads from monday-of-week → sunday. */
export const ATTENDANCE_DEFAULT_VIEW: 'week' | 'month' = 'week'

/** Max range the BE will scan in one GET. Matches ATTENDANCE_LIST_RANGE_MAX_DAYS. */
export const ATTENDANCE_RANGE_MAX_DAYS = 92

/** Max entries in one batch POST. Matches the BE Zod cap. */
export const ATTENDANCE_BATCH_MAX = 500
