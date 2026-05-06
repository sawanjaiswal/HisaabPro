/**
 * Unit tests for recurring-date-math.ts
 *
 * Covers all cases from ARCHITECTURE.md §7:
 *  - DAILY: +1 day
 *  - WEEKLY: +7 days, weekday snap preserved
 *  - MONTHLY: anchor day preserved; Feb-28 clamping; month-end safety
 *  - QUARTERLY: +3 months, anchor preserved
 *  - YEARLY: Feb-29 leap → Feb-28 next year
 *  - IST midnight: parseIstDate returns correct UTC instant
 *  - isDueNow helper
 */

import { describe, it, expect } from 'vitest'
import {
  computeNextRunDate,
  parseIstDate,
  isDueNow,
} from '../recurring-date-math.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a UTC midnight date from 'YYYY-MM-DD' string. */
function utc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// DAILY
// ---------------------------------------------------------------------------

describe('DAILY frequency', () => {
  it('advances by exactly 1 day', () => {
    const next = computeNextRunDate(utc('2026-05-06'), 'DAILY')
    expect(ymd(next)).toBe('2026-05-07')
  })

  it('crosses month boundary', () => {
    const next = computeNextRunDate(utc('2026-01-31'), 'DAILY')
    expect(ymd(next)).toBe('2026-02-01')
  })

  it('crosses year boundary', () => {
    const next = computeNextRunDate(utc('2025-12-31'), 'DAILY')
    expect(ymd(next)).toBe('2026-01-01')
  })
})

// ---------------------------------------------------------------------------
// WEEKLY
// ---------------------------------------------------------------------------

describe('WEEKLY frequency', () => {
  it('advances by exactly 7 days when no anchor', () => {
    const next = computeNextRunDate(utc('2026-05-06'), 'WEEKLY') // Wednesday
    expect(ymd(next)).toBe('2026-05-13') // next Wednesday
  })

  it('preserves same weekday with anchor', () => {
    // 2026-05-06 is a Wednesday (day 3)
    const next = computeNextRunDate(utc('2026-05-06'), 'WEEKLY', 3)
    expect(next.getUTCDay()).toBe(3)
    expect(ymd(next)).toBe('2026-05-13')
  })

  it('crosses month boundary', () => {
    const next = computeNextRunDate(utc('2026-01-28'), 'WEEKLY')
    expect(ymd(next)).toBe('2026-02-04')
  })
})

// ---------------------------------------------------------------------------
// MONTHLY
// ---------------------------------------------------------------------------

describe('MONTHLY frequency', () => {
  it('advances by one month, no anchor', () => {
    const next = computeNextRunDate(utc('2026-03-15'), 'MONTHLY')
    expect(ymd(next)).toBe('2026-04-15')
  })

  it('anchor=28: Jan-28 → Feb-28 (non-leap)', () => {
    const next = computeNextRunDate(utc('2026-01-28'), 'MONTHLY', 28)
    expect(ymd(next)).toBe('2026-02-28')
  })

  it('anchor=28: Feb-28 → Mar-28 (not Mar-28 rollover)', () => {
    const next = computeNextRunDate(utc('2026-02-28'), 'MONTHLY', 28)
    expect(ymd(next)).toBe('2026-03-28')
  })

  it('anchor preserved: Jan-31 → Feb-28 (snapped, non-leap 2026)', () => {
    // Schema caps dayOfMonth at 28, but test clamping logic directly
    const next = computeNextRunDate(utc('2026-01-31'), 'MONTHLY', 31)
    // clamp: Feb 2026 has 28 days → Feb-28
    expect(ymd(next)).toBe('2026-02-28')
  })

  it('anchor preserved: Feb-28 → Mar-31 (anchor=31, Mar has 31 days)', () => {
    const next = computeNextRunDate(utc('2026-02-28'), 'MONTHLY', 31)
    expect(ymd(next)).toBe('2026-03-31')
  })

  it('crosses year boundary: Dec → Jan', () => {
    const next = computeNextRunDate(utc('2026-12-15'), 'MONTHLY', 15)
    expect(ymd(next)).toBe('2027-01-15')
  })
})

// ---------------------------------------------------------------------------
// QUARTERLY
// ---------------------------------------------------------------------------

describe('QUARTERLY frequency', () => {
  it('advances by 3 months', () => {
    const next = computeNextRunDate(utc('2026-03-15'), 'QUARTERLY')
    expect(ymd(next)).toBe('2026-06-15')
  })

  it('anchor=28: Jan-28 → Apr-28', () => {
    const next = computeNextRunDate(utc('2026-01-28'), 'QUARTERLY', 28)
    expect(ymd(next)).toBe('2026-04-28')
  })

  it('anchor=31: Jan-31 → Apr-30 (Apr has 30 days)', () => {
    const next = computeNextRunDate(utc('2026-01-31'), 'QUARTERLY', 31)
    expect(ymd(next)).toBe('2026-04-30')
  })

  it('crosses year boundary: Nov → Feb', () => {
    const next = computeNextRunDate(utc('2026-11-15'), 'QUARTERLY', 15)
    expect(ymd(next)).toBe('2027-02-15')
  })
})

// ---------------------------------------------------------------------------
// YEARLY
// ---------------------------------------------------------------------------

describe('YEARLY frequency', () => {
  it('advances by 1 year', () => {
    const next = computeNextRunDate(utc('2026-05-06'), 'YEARLY')
    expect(ymd(next)).toBe('2027-05-06')
  })

  it('Feb-29 leap year → Feb-28 next (non-leap) year', () => {
    const next = computeNextRunDate(utc('2024-02-29'), 'YEARLY', 29)
    // 2025 is not a leap year; Feb has 28 days → clamp to Feb-28
    expect(ymd(next)).toBe('2025-02-28')
  })

  it('Feb-28 non-leap → Feb-28 leap year (28 is valid)', () => {
    const next = computeNextRunDate(utc('2027-02-28'), 'YEARLY', 28)
    expect(ymd(next)).toBe('2028-02-28')
  })
})

// ---------------------------------------------------------------------------
// parseIstDate
// ---------------------------------------------------------------------------

describe('parseIstDate', () => {
  it('converts IST date string to correct UTC instant (midnight IST = 18:30 UTC prior day)', () => {
    const d = parseIstDate('2026-05-07')
    // IST midnight 2026-05-07 = UTC 2026-05-06T18:30:00.000Z
    expect(d.toISOString()).toBe('2026-05-06T18:30:00.000Z')
  })

  it('first day of year', () => {
    const d = parseIstDate('2026-01-01')
    expect(d.toISOString()).toBe('2025-12-31T18:30:00.000Z')
  })
})

// ---------------------------------------------------------------------------
// isDueNow
// ---------------------------------------------------------------------------

describe('isDueNow', () => {
  it('returns true when nextRunDate <= now', () => {
    const past = new Date(Date.now() - 1000)
    expect(isDueNow(past)).toBe(true)
  })

  it('returns true when nextRunDate === now', () => {
    const now = new Date()
    expect(isDueNow(now, now)).toBe(true)
  })

  it('returns false when nextRunDate is in the future', () => {
    const future = new Date(Date.now() + 60_000)
    expect(isDueNow(future)).toBe(false)
  })
})
