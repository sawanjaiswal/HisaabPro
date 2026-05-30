/**
 * V2 Appointments — domain constants.
 */

import type { AppointmentStatus } from '@prisma/client'

/** Hard cap on recurrence expansion per architecture §3. */
export const MAX_RECURRENCE_OCCURRENCES = 52

/** Max horizon for `recurrence.endAt` from `startAt` (SF-SEC-2). */
export const MAX_RECURRENCE_END_DAYS = 365

/** Public-booking HMAC link max validity (architecture §5 / security §HMAC). */
export const PUBLIC_BOOKING_HMAC_MAX_DAYS = 90

/** Public-booking signature delimiter — canonical pipe-separated payload. */
export const PUBLIC_BOOKING_CANONICAL_SEP = '|'

/** Public-booking rate limit: 30 requests/min/IP. */
export const PUBLIC_BOOKING_RATE_LIMIT_PER_MIN = 30

/** /availability auth user rate limit (SF-SEC-1). */
export const AVAILABILITY_USER_RATE_LIMIT_PER_MIN = 120

/** Status state machine. */
export const STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
}

/** Statuses that count as "active" — block soft-delete of party/employee. */
export const ACTIVE_STATUSES: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
]

/** Statuses that participate in the slot-conflict exclusion (mirrors btree_gist constraint). */
export const CONFLICT_STATUSES: AppointmentStatus[] = [
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
]

/** PG SQLSTATE for exclusion-constraint violation. */
export const PG_EXCLUSION_VIOLATION = '23P01'

/** Verticals where appointments are enabled. */
export const APPOINTMENTS_VERTICALS = new Set<string>(['salon', 'clinic'])

/** Domain-specific error codes (mapped via AppError + ErrorCode passthrough). */
export const APPT_ERR = {
  SLOT_CONFLICT: 'APPT_SLOT_CONFLICT',
  INVALID_STATUS_TRANSITION: 'APPT_INVALID_STATUS_TRANSITION',
  HAS_ACTIVE_APPOINTMENTS: 'HAS_ACTIVE_APPOINTMENTS',
  RECURRENCE_TOO_LARGE: 'APPT_RECURRENCE_TOO_LARGE',
  PUBLIC_BOOKING_INVALID: 'PUBLIC_BOOKING_INVALID',
  PUBLIC_BOOKING_EXPIRED: 'PUBLIC_BOOKING_EXPIRED',
  REPLAY_REJECTED: 'APPT_REPLAY_REJECTED',
} as const
