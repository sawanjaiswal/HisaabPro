/** V2 Appointments — recurrence form validation + DTO translation.
 *
 *  Pure module. Mirrors the server's recurrence contract (route
 *  `POST /appointments`: `{ frequency, occurrences, endAt }`) with the
 *  build-phase SF-SEC-2 cap of `RECURRENCE_MAX_SPAN_DAYS`.
 */

import type { RecurrenceFormState } from './appointment.types'
import { isoDateToLocalDate } from './appointment.utils'
import {
  RECURRENCE_MAX_OCCURRENCES,
  RECURRENCE_MAX_SPAN_DAYS,
} from './appointment.constants'

export type RecurrenceMessageKey =
  | 'recurrenceUntilBeforeStart'
  | 'recurrenceSpanTooLong'
  | 'recurrenceOccurrencesTooMany'
  | 'recurrenceIntervalInvalid'

export interface RecurrenceValidation {
  ok: boolean
  messageKey?: RecurrenceMessageKey
}

/** Pure validator — mirrors server SF-SEC-2 (span ≤ RECURRENCE_MAX_SPAN_DAYS). */
export function validateRecurrence(
  r: RecurrenceFormState,
  startISO: string,
): RecurrenceValidation {
  if (!r.enabled) return { ok: true }
  if (r.interval <= 0) {
    return { ok: false, messageKey: 'recurrenceIntervalInvalid' }
  }
  if (r.endMode === 'count') {
    if (r.count <= 0 || r.count > RECURRENCE_MAX_OCCURRENCES) {
      return { ok: false, messageKey: 'recurrenceOccurrencesTooMany' }
    }
    return { ok: true }
  }
  // endMode === 'until'
  if (!r.until) {
    return { ok: false, messageKey: 'recurrenceUntilBeforeStart' }
  }
  const start = new Date(startISO)
  const until = isoDateToLocalDate(r.until)
  until.setHours(23, 59, 59, 999)
  if (until.getTime() <= start.getTime()) {
    return { ok: false, messageKey: 'recurrenceUntilBeforeStart' }
  }
  const days = (until.getTime() - start.getTime()) / 86_400_000
  if (days > RECURRENCE_MAX_SPAN_DAYS) {
    return { ok: false, messageKey: 'recurrenceSpanTooLong' }
  }
  return { ok: true }
}

/** Translate the local form to the wire DTO accepted by POST /appointments.
 *  Returns null when recurrence is disabled (server expects the field absent). */
export function recurrenceToDTO(
  r: RecurrenceFormState,
  startISO: string,
): { frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; endAt: string; occurrences: number } | null {
  if (!r.enabled) return null
  if (r.endMode === 'count') {
    // Project end date heuristically — server actually drives by occurrences.
    const start = new Date(startISO)
    return { frequency: r.frequency, endAt: start.toISOString(), occurrences: r.count }
  }
  // 'until' — translate the local date to end-of-day UTC.
  const until = isoDateToLocalDate(r.until)
  until.setHours(23, 59, 59, 999)
  return { frequency: r.frequency, endAt: until.toISOString(), occurrences: 0 }
}
