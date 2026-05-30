/** V2 Appointments — utils unit tests. */

import { describe, it, expect } from 'vitest'
import {
  dateToISODate,
  isoDateToLocalDate,
  startOfDay,
  endOfDay,
  addMinutes,
  formatHHMM,
  buildEntityLabel,
  groupByHour,
  emptyForm,
  formToCreateBody,
  isFormerParty,
  isFormerEmployee,
} from '../appointment.utils'
import type { AppointmentRow } from '../appointment.types'

function makeRow(partial: Partial<AppointmentRow>): AppointmentRow {
  return {
    id: 'a1',
    businessId: 'b1',
    partyId: 'p1',
    employeeId: 'e1',
    partyNameSnapshot: 'Raju',
    employeeNameSnapshot: 'Stylist',
    serviceId: null,
    status: 'SCHEDULED',
    startAt: new Date(2026, 4, 30, 9, 30).toISOString(),
    endAt: new Date(2026, 4, 30, 10, 0).toISOString(),
    notes: null,
    vertical: 'general',
    recurrenceTemplateId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

describe('dateToISODate / isoDateToLocalDate', () => {
  it('round-trips a local date', () => {
    const d = new Date(2026, 4, 30) // 30 May 2026 local
    const iso = dateToISODate(d)
    expect(iso).toBe('2026-05-30')
    const back = isoDateToLocalDate(iso)
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(4)
    expect(back.getDate()).toBe(30)
  })
})

describe('startOfDay / endOfDay', () => {
  it('zeros and maxes the time', () => {
    const d = new Date(2026, 4, 30, 14, 23, 59)
    expect(startOfDay(d).getHours()).toBe(0)
    expect(endOfDay(d).getHours()).toBe(23)
  })
})

describe('addMinutes', () => {
  it('adds minutes', () => {
    const d = new Date(2026, 4, 30, 9, 0)
    expect(addMinutes(d, 45).getMinutes()).toBe(45)
    expect(addMinutes(d, 90).getHours()).toBe(10)
  })
})

describe('formatHHMM', () => {
  it('pads single-digit hour/minute', () => {
    expect(formatHHMM(new Date(2026, 4, 30, 9, 5))).toBe('09:05')
  })
})

describe('buildEntityLabel', () => {
  it('formats as "Name @ HH:mm"', () => {
    const iso = new Date(2026, 4, 30, 9, 30).toISOString()
    expect(buildEntityLabel('Raju Traders', iso)).toBe('Raju Traders @ 09:30')
  })
})

describe('groupByHour', () => {
  it('places appointments into the matching hour bucket', () => {
    const date = new Date(2026, 4, 30)
    const rows = [
      makeRow({ id: 'a', startAt: new Date(2026, 4, 30, 9, 15).toISOString() }),
      makeRow({ id: 'b', startAt: new Date(2026, 4, 30, 9, 45).toISOString() }),
      makeRow({ id: 'c', startAt: new Date(2026, 4, 30, 12, 0).toISOString() }),
    ]
    const buckets = groupByHour(rows, date, 8, 20)
    expect(buckets).toHaveLength(12)
    const nine = buckets.find((b) => b.hour === 9)!
    expect(nine.rows.map((r) => r.id)).toEqual(['a', 'b'])
    const twelve = buckets.find((b) => b.hour === 12)!
    expect(twelve.rows.map((r) => r.id)).toEqual(['c'])
  })

  it('skips appointments outside the hour window', () => {
    const date = new Date(2026, 4, 30)
    const rows = [makeRow({ id: 'before', startAt: new Date(2026, 4, 30, 6, 0).toISOString() })]
    const buckets = groupByHour(rows, date, 8, 20)
    expect(buckets.every((b) => b.rows.length === 0)).toBe(true)
  })
})

describe('emptyForm', () => {
  it('seeds a date and start hour', () => {
    const form = emptyForm({ date: new Date(2026, 4, 30), startHour: 14 })
    expect(form.dateISO).toBe('2026-05-30')
    expect(form.startTime).toBe('14:00')
  })
})

describe('formToCreateBody', () => {
  it('produces ISO startAt/endAt at the right offset apart', () => {
    const form = emptyForm({ date: new Date(2026, 4, 30), startHour: 9 })
    form.durationMinutes = 45
    const { startAt, endAt } = formToCreateBody(form)
    const ms = new Date(endAt).getTime() - new Date(startAt).getTime()
    expect(ms).toBe(45 * 60 * 1000)
  })
})

describe('isFormer*', () => {
  it('flags nulled FK with non-empty snapshot', () => {
    expect(isFormerParty(makeRow({ partyId: null, partyNameSnapshot: 'Raju' }))).toBe(true)
    expect(isFormerParty(makeRow({ partyId: 'p1' }))).toBe(false)
    expect(isFormerEmployee(makeRow({ employeeId: null, employeeNameSnapshot: 'Stylist' }))).toBe(true)
    expect(isFormerEmployee(makeRow({ employeeId: 'e1' }))).toBe(false)
  })
})
