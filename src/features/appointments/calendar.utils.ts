/** V2 Appointments — calendar grid math (FE-2).
 *
 *  Pure helpers for CalendarDayView / CalendarWeekView positioning and the
 *  current-time line. Kept here (not in `appointment.utils.ts`) so the day-
 *  list FE-1 helpers stay small and the grid math is its own ≤250-line file.
 */

import type { AppointmentRow } from './appointment.types'
import { startOfDay, isoDateToLocalDate, sameLocalDay as _sameLocalDay } from './appointment.utils'
import { WEEK_STARTS_ON } from './appointment.constants'

// Re-export for convenience — callers should NOT import from two places.
export { _sameLocalDay as sameLocalDay }

/** Pixel offset of a Date inside an hour-grid that starts at `startHour`.
 *  Returns 0 when the date falls before the grid; capped at the grid bottom. */
export function pxFromTopForDate(
  date: Date,
  forDay: Date,
  startHour: number,
  endHour: number,
  hourRowPx: number,
): number {
  const base = startOfDay(forDay)
  base.setHours(startHour, 0, 0, 0)
  const minutes = Math.max(0, (date.getTime() - base.getTime()) / 60_000)
  const maxMinutes = (endHour - startHour) * 60
  return Math.min(minutes, maxMinutes) * (hourRowPx / 60)
}

/** Returns { topPx, heightPx } for an appointment block. Clamped to grid. */
export function blockPosition(
  row: AppointmentRow,
  forDay: Date,
  startHour: number,
  endHour: number,
  hourRowPx: number,
): { topPx: number; heightPx: number } {
  const start = new Date(row.startAt)
  const end = new Date(row.endAt)
  const topPx = pxFromTopForDate(start, forDay, startHour, endHour, hourRowPx)
  const endPx = pxFromTopForDate(end, forDay, startHour, endHour, hourRowPx)
  return { topPx, heightPx: Math.max(20, endPx - topPx) }
}

/** Mon..Sun by default (WEEK_STARTS_ON=1). Returns the 7 dates in the week
 *  that contains `forDate`. */
export function weekDates(forDate: Date, weekStartsOn = WEEK_STARTS_ON): Date[] {
  const d = startOfDay(forDate)
  const dayIdx = d.getDay() // 0=Sun..6=Sat
  const offset = (dayIdx - weekStartsOn + 7) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - offset)
  const out: Date[] = []
  for (let i = 0; i < 7; i++) {
    const dd = new Date(start)
    dd.setDate(start.getDate() + i)
    out.push(dd)
  }
  return out
}

/** Rows whose startAt falls on `forDay` (local). Sorted ascending. */
export function rowsOnDay(rows: AppointmentRow[], forDay: Date): AppointmentRow[] {
  return rows
    .filter((r) => _sameLocalDay(new Date(r.startAt), forDay))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
}

/** Translate a tap-y position inside the grid to the hour the user tapped. */
export function hourFromYPx(
  yPx: number,
  startHour: number,
  endHour: number,
  hourRowPx: number,
): number {
  const hour = startHour + Math.floor(yPx / hourRowPx)
  if (hour < startHour) return startHour
  if (hour >= endHour) return endHour - 1
  return hour
}

/** Used by DayPicker / formatters. */
export { isoDateToLocalDate }
