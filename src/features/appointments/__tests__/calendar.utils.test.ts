/** Calendar grid math — block positioning, week dates, hour-from-y. */

import { describe, it, expect } from 'vitest'
import {
  pxFromTopForDate,
  blockPosition,
  weekDates,
  rowsOnDay,
  hourFromYPx,
} from '../calendar.utils'
import type { AppointmentRow } from '../appointment.types'

function row(partial: Partial<AppointmentRow> & { startAt: string; endAt: string }): AppointmentRow {
  return {
    id: 'a1',
    businessId: 'biz',
    partyId: 'p1',
    employeeId: null,
    partyNameSnapshot: 'X',
    employeeNameSnapshot: null,
    serviceId: null,
    status: 'SCHEDULED',
    notes: null,
    vertical: 'general',
    recurrenceTemplateId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  } as AppointmentRow
}

describe('pxFromTopForDate', () => {
  it('returns 0 when the date is before grid start', () => {
    const day = new Date(2026, 4, 30, 0, 0, 0, 0) // local
    const t = new Date(2026, 4, 30, 6, 0, 0, 0) // 6am, before startHour=8
    expect(pxFromTopForDate(t, day, 8, 20, 60)).toBe(0)
  })

  it('returns hourRowPx for one hour past start', () => {
    const day = new Date(2026, 4, 30, 0, 0, 0, 0)
    const t = new Date(2026, 4, 30, 9, 0, 0, 0)
    expect(pxFromTopForDate(t, day, 8, 20, 60)).toBe(60)
  })

  it('clamps to grid bottom', () => {
    const day = new Date(2026, 4, 30, 0, 0, 0, 0)
    const t = new Date(2026, 4, 30, 23, 0, 0, 0)
    // grid 8..20 = 12 hours * 60 = 720 max
    expect(pxFromTopForDate(t, day, 8, 20, 60)).toBe(720)
  })
})

describe('blockPosition', () => {
  it('returns top + height proportional to duration', () => {
    const day = new Date(2026, 4, 30, 0, 0, 0, 0)
    const r = row({
      startAt: new Date(2026, 4, 30, 9, 0, 0, 0).toISOString(),
      endAt: new Date(2026, 4, 30, 10, 30, 0, 0).toISOString(),
    })
    const { topPx, heightPx } = blockPosition(r, day, 8, 20, 60)
    expect(topPx).toBe(60)
    expect(heightPx).toBe(90)
  })

  it('enforces a minimum height of 20px for very short blocks', () => {
    const day = new Date(2026, 4, 30, 0, 0, 0, 0)
    const r = row({
      startAt: new Date(2026, 4, 30, 9, 0, 0, 0).toISOString(),
      endAt: new Date(2026, 4, 30, 9, 5, 0, 0).toISOString(),
    })
    const { heightPx } = blockPosition(r, day, 8, 20, 60)
    expect(heightPx).toBe(20)
  })
})

describe('weekDates', () => {
  it('returns Mon..Sun starting from Monday', () => {
    // 2026-05-30 is a Saturday (locally).
    const sat = new Date(2026, 4, 30)
    const week = weekDates(sat, 1)
    expect(week).toHaveLength(7)
    expect(week[0].getDay()).toBe(1) // Mon
    expect(week[6].getDay()).toBe(0) // Sun
  })
})

describe('rowsOnDay', () => {
  it('filters by local day and sorts ascending', () => {
    const day = new Date(2026, 4, 30)
    const rows = [
      row({ id: 'b', startAt: new Date(2026, 4, 30, 11).toISOString(), endAt: new Date(2026, 4, 30, 12).toISOString() }),
      row({ id: 'a', startAt: new Date(2026, 4, 30, 9).toISOString(), endAt: new Date(2026, 4, 30, 10).toISOString() }),
      row({ id: 'c', startAt: new Date(2026, 4, 29, 9).toISOString(), endAt: new Date(2026, 4, 29, 10).toISOString() }),
    ]
    const out = rowsOnDay(rows, day)
    expect(out.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('hourFromYPx', () => {
  it('clamps below startHour to startHour', () => {
    expect(hourFromYPx(-50, 8, 20, 60)).toBe(8)
  })
  it('clamps at/after endHour to endHour-1', () => {
    expect(hourFromYPx(10_000, 8, 20, 60)).toBe(19)
  })
  it('returns the hour for a midpoint y', () => {
    expect(hourFromYPx(90, 8, 20, 60)).toBe(9) // 90px = row 1.5 -> 8+1
  })
})
