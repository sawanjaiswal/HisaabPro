/** V2 Appointments — pure utils (date math, grouping, format helpers).
 *
 * Kept side-effect-free so tests don't need to stub Date or fetch.
 */

import type {
  AppointmentRow,
  AppointmentFormState,
  RecurrenceFormState,
} from './appointment.types'
import {
  DEFAULT_DURATION_MINUTES,
  RECURRENCE_DEFAULT_COUNT,
  RECURRENCE_DEFAULT_INTERVAL,
} from './appointment.constants'

/** yyyy-mm-dd in local time (NOT UTC) — calendars are inherently local. */
export function dateToISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse yyyy-mm-dd as local-midnight. Date strings without time are UTC by
 *  default in JS, which shifts the displayed day across timezones. */
export function isoDateToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Add N minutes; returns a fresh Date. */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

/** Format `HH:mm` in 24h. The UI displays via Intl.DateTimeFormat for am/pm. */
export function formatHHMM(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Locale-aware short time (e.g. "9:30 AM"). */
export function formatLocalTime(date: Date, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
}

/** Long day label (e.g. "Sat, May 30"). */
export function formatDayLabel(date: Date, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

/** Build the offline-queue label: "Raju Traders @ 09:30". */
export function buildEntityLabel(partyName: string, startISO: string): string {
  const d = new Date(startISO)
  return `${partyName} @ ${formatHHMM(d)}`
}

/** Group appointments by hour-of-day for the FE-1 DayListView. Returns one
 *  bucket per hour in [startHour, endHour); empty buckets included so the UI
 *  can render tap-to-create rows for empty hours.
 */
export interface HourBucket {
  hour: number // 0-23
  startsAt: Date // local time, at the date passed in
  rows: AppointmentRow[]
}

export function groupByHour(
  rows: AppointmentRow[],
  forDate: Date,
  startHour: number,
  endHour: number
): HourBucket[] {
  const base = startOfDay(forDate)
  const buckets: HourBucket[] = []
  for (let h = startHour; h < endHour; h++) {
    const startsAt = new Date(base)
    startsAt.setHours(h, 0, 0, 0)
    buckets.push({ hour: h, startsAt, rows: [] })
  }
  for (const row of rows) {
    const start = new Date(row.startAt)
    const h = start.getHours()
    if (h < startHour || h >= endHour) continue
    const bucket = buckets[h - startHour]
    if (bucket) bucket.rows.push(row)
  }
  for (const b of buckets) {
    b.rows.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  }
  return buckets
}

export function emptyRecurrence(): RecurrenceFormState {
  return {
    enabled: false,
    frequency: 'WEEKLY',
    interval: RECURRENCE_DEFAULT_INTERVAL,
    endMode: 'count',
    count: RECURRENCE_DEFAULT_COUNT,
    until: '',
    byweekday: [],
  }
}

/** Mint a v4-ish UUID — crypto.randomUUID is the runtime form, but vitest
 *  jsdom without `crypto.randomUUID` falls through to a Math.random fallback
 *  that's good enough for tests (we don't ship the fallback in prod). */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Build an empty form for the create drawer, optionally pre-filled with
 *  date + start-hour (when the user taps an empty hour row). */
export function emptyForm(seed?: { date?: Date; startHour?: number }): AppointmentFormState {
  const base = seed?.date ?? new Date()
  const hh = seed?.startHour !== undefined ? String(seed.startHour).padStart(2, '0') : '09'
  return {
    partyId: '',
    partyName: '',
    employeeId: null,
    employeeName: null,
    serviceId: null,
    dateISO: dateToISODate(base),
    startTime: `${hh}:00`,
    durationMinutes: DEFAULT_DURATION_MINUTES,
    notes: '',
    recurrence: emptyRecurrence(),
    idempotencyKey: uuid(),
  }
}

/** Combine form date + HH:mm into an ISO-with-offset string (toISOString uses UTC,
 *  which is fine because the server stores UTC and renders in local at read time). */
export function formToCreateBody(form: AppointmentFormState): {
  startAt: string
  endAt: string
} {
  const [hh, mm] = form.startTime.split(':').map(Number)
  const base = isoDateToLocalDate(form.dateISO)
  base.setHours(hh ?? 0, mm ?? 0, 0, 0)
  const start = new Date(base)
  const end = addMinutes(start, form.durationMinutes)
  return { startAt: start.toISOString(), endAt: end.toISOString() }
}

/** True when the underlying party/employee FK has been nulled by a soft-delete
 *  but the appointment still carries a snapshot — drives the "(former)" badge. */
export function isFormerParty(row: AppointmentRow): boolean {
  return row.partyId === null && row.partyNameSnapshot.length > 0
}
export function isFormerEmployee(row: AppointmentRow): boolean {
  return row.employeeId === null && (row.employeeNameSnapshot?.length ?? 0) > 0
}
