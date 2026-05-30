/** Recurrence validation — count-vs-until mutex + ≤365d span (SF-SEC-2). */

import { describe, it, expect } from 'vitest'
import { validateRecurrence, recurrenceToDTO } from '../recurrence.utils'
import type { RecurrenceFormState } from '../appointment.types'

const startISO = new Date(2026, 4, 30, 9, 0, 0).toISOString()

function form(over: Partial<RecurrenceFormState>): RecurrenceFormState {
  return {
    enabled: true,
    frequency: 'WEEKLY',
    interval: 1,
    endMode: 'count',
    count: 4,
    until: '',
    byweekday: [],
    ...over,
  }
}

describe('validateRecurrence', () => {
  it('returns ok when disabled', () => {
    expect(validateRecurrence(form({ enabled: false }), startISO).ok).toBe(true)
  })

  it('flags zero/negative interval', () => {
    const v = validateRecurrence(form({ interval: 0 }), startISO)
    expect(v.ok).toBe(false)
    expect(v.messageKey).toBe('recurrenceIntervalInvalid')
  })

  it('flags too-many occurrences (count > 52)', () => {
    const v = validateRecurrence(form({ endMode: 'count', count: 60 }), startISO)
    expect(v.ok).toBe(false)
    expect(v.messageKey).toBe('recurrenceOccurrencesTooMany')
  })

  it('accepts a sane count', () => {
    expect(validateRecurrence(form({ endMode: 'count', count: 4 }), startISO).ok).toBe(true)
  })

  it('flags until-before-start', () => {
    const v = validateRecurrence(
      form({ endMode: 'until', until: '2026-05-29' }),
      startISO,
    )
    expect(v.ok).toBe(false)
    expect(v.messageKey).toBe('recurrenceUntilBeforeStart')
  })

  it('flags missing until when endMode=until', () => {
    const v = validateRecurrence(form({ endMode: 'until', until: '' }), startISO)
    expect(v.ok).toBe(false)
  })

  it('flags span > 365 days', () => {
    // ~2 years out
    const v = validateRecurrence(
      form({ endMode: 'until', until: '2028-05-30' }),
      startISO,
    )
    expect(v.ok).toBe(false)
    expect(v.messageKey).toBe('recurrenceSpanTooLong')
  })

  it('accepts a 200-day span', () => {
    expect(
      validateRecurrence(form({ endMode: 'until', until: '2026-12-01' }), startISO).ok,
    ).toBe(true)
  })
})

describe('recurrenceToDTO', () => {
  it('returns null when disabled', () => {
    expect(recurrenceToDTO(form({ enabled: false }), startISO)).toBeNull()
  })

  it('emits {frequency, endAt, occurrences=count} for count mode', () => {
    const dto = recurrenceToDTO(form({ endMode: 'count', count: 6, frequency: 'DAILY' }), startISO)!
    expect(dto.frequency).toBe('DAILY')
    expect(dto.occurrences).toBe(6)
  })

  it('emits occurrences=0 for until mode (server drives by date)', () => {
    const dto = recurrenceToDTO(
      form({ endMode: 'until', until: '2026-12-01', frequency: 'WEEKLY' }),
      startISO,
    )!
    expect(dto.occurrences).toBe(0)
    expect(new Date(dto.endAt).getTime()).toBeGreaterThan(new Date(startISO).getTime())
  })
})
