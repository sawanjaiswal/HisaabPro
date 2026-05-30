/**
 * V2 Appointments — pure helpers (no I/O).
 *
 * Date math is timezone-naive: the calling layer passes business-local Date
 * objects; we operate on UTC instants.
 */

import type { AppointmentRecurrenceFreq } from '@prisma/client'

const MIN_MS = 60 * 1000
const DAY_MS = 24 * 60 * MIN_MS

export function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * MIN_MS)
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MIN_MS)
}

export function rangeOverlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  // half-open intervals [start, end)
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
}

/** Returns the start-of-day in UTC for the given instant. */
export function startOfDayUTC(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

export function endOfDayUTC(d: Date): Date {
  const x = startOfDayUTC(d)
  return new Date(x.getTime() + DAY_MS)
}

/** Increment helper for recurrence expansion. */
export function advanceByFreq(d: Date, freq: AppointmentRecurrenceFreq): Date {
  const x = new Date(d)
  switch (freq) {
    case 'DAILY':
      x.setUTCDate(x.getUTCDate() + 1)
      return x
    case 'WEEKLY':
      x.setUTCDate(x.getUTCDate() + 7)
      return x
    case 'MONTHLY':
      x.setUTCMonth(x.getUTCMonth() + 1)
      return x
  }
}

/** Slot-grid generator — every `stepMinutes` between dayStart..dayEnd. */
export function generateSlotGrid(
  dayStart: Date,
  dayEnd: Date,
  serviceDurationMin: number,
  stepMin: number
): Array<{ startAt: Date; endAt: Date }> {
  const out: Array<{ startAt: Date; endAt: Date }> = []
  let cursor = new Date(dayStart)
  while (cursor.getTime() + serviceDurationMin * MIN_MS <= dayEnd.getTime()) {
    out.push({ startAt: new Date(cursor), endAt: addMinutes(cursor, serviceDurationMin) })
    cursor = addMinutes(cursor, stepMin)
  }
  return out
}

/** Subtract any conflicting ranges from the slot grid. */
export function filterAvailableSlots(
  grid: Array<{ startAt: Date; endAt: Date }>,
  busy: Array<{ startAt: Date; endAt: Date }>
): Array<{ startAt: Date; endAt: Date }> {
  if (busy.length === 0) return grid
  return grid.filter(
    (slot) =>
      !busy.some((b) => rangeOverlaps(slot.startAt, slot.endAt, b.startAt, b.endAt))
  )
}
