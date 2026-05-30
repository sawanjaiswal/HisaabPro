/** V2 Appointments — Constants (tokens only, no hex).
 *
 * Status colors map to existing semantic Badge variants from `src/components/ui/Badge.tsx`
 * so we inherit the project's color contract for free. The label maps point to
 * translation keys — actual strings come from `useLanguage()` at render time.
 */

import type { AppointmentStatus, ViewMode } from './appointment.types'

/** Map FE status -> Badge variant. ConfirmedV is an alias for paid (green-ish). */
export const STATUS_BADGE_VARIANT: Record<AppointmentStatus, 'paid' | 'pending' | 'overdue' | 'draft' | 'info'> = {
  SCHEDULED: 'info',
  CONFIRMED: 'paid',
  CHECKED_IN: 'paid',
  IN_PROGRESS: 'pending',
  COMPLETED: 'paid',
  CANCELLED: 'draft',
  NO_SHOW: 'overdue',
}

/** Translation-key map. Consumer reads `t[STATUS_LABEL_KEY[status]]`. */
export const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  SCHEDULED: 'apptStatusScheduled',
  CONFIRMED: 'apptStatusConfirmed',
  CHECKED_IN: 'apptStatusCheckedIn',
  IN_PROGRESS: 'apptStatusInProgress',
  COMPLETED: 'apptStatusCompleted',
  CANCELLED: 'apptStatusCancelled',
  NO_SHOW: 'apptStatusNoShow',
}

/** Allowed forward transitions on the FE — kept in sync with the BE state
 *  machine in `appointment-status.service.ts`. The BE is still the source of
 *  truth; this map only governs which action buttons render.
 */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
}

/** Action button → translation key for label */
export const ACTION_LABEL_KEY: Record<AppointmentStatus, string> = {
  SCHEDULED: 'apptActionSchedule',
  CONFIRMED: 'apptActionConfirm',
  CHECKED_IN: 'checkIn',
  IN_PROGRESS: 'apptActionStart',
  COMPLETED: 'complete',
  CANCELLED: 'confirmCancel',
  NO_SHOW: 'noShow',
}

/** Day-view hour range. FE-1 is a list grouped by hour, not a true grid. */
export const DAY_VIEW_START_HOUR = 8
export const DAY_VIEW_END_HOUR = 20
export const DEFAULT_DURATION_MINUTES = 30
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const

export const DEFAULT_VIEW_MODE: ViewMode = 'day'

/** Stale time for list reads — short because the calendar is highly
 *  time-sensitive and the create flow invalidates anyway. */
export const APPOINTMENT_LIST_STALE_MS = 30_000

/** Entity-type slug used by the offline queue. MUST be 'appointment'. */
export const APPOINTMENT_ENTITY_TYPE = 'appointment'

/** Pixel height of one hour-row in the calendar grid. Touch ergonomics:
 *  44px min × 60min / 44px = ~1.36, so 60px gives sub-15-min resolution at
 *  ≥44px tap targets for the empty-hour create button. */
export const HOUR_ROW_PX = 60

/** Week view starts Monday by default — Indian biz week. UI can override. */
export const WEEK_STARTS_ON = 1

/** Recurrence — match server hard cap (SF-SEC-2 build-phase fix). */
export const RECURRENCE_MAX_SPAN_DAYS = 365
export const RECURRENCE_MAX_OCCURRENCES = 52
export const RECURRENCE_DEFAULT_INTERVAL = 1
export const RECURRENCE_DEFAULT_COUNT = 4

/** Sentry message used when an offline appointment mutation is replay-rejected. */
export const SENTRY_REPLAY_REJECTED_MSG = 'appointment_replay_rejected'
