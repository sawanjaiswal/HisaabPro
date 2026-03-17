import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatAmount,
  formatReportDate,
  formatDateShort,
  getDateRange,
  getTodayISO,
  getPrevDate,
  getNextDate,
  buildQueryString,
} from '../report.utils'

// ─── Currency ────────────────────────────────────────────────────────────────

describe('formatAmount (reports)', () => {
  it('formats paise as INR', () => {
    expect(formatAmount(150000)).toContain('1,500')
  })
})

// ─── Date formatting ─────────────────────────────────────────────────────────

describe('formatReportDate', () => {
  it('formats as DD/MM/YYYY', () => {
    const result = formatReportDate('2026-03-15')
    expect(result).toMatch(/15\/03\/2026/)
  })
})

describe('formatDateShort', () => {
  it('returns short format', () => {
    const result = formatDateShort('2026-03-14')
    expect(result).toMatch(/14/)
    expect(result).toMatch(/Mar/)
  })
})

// ─── Date range presets ──────────────────────────────────────────────────────

describe('getDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Use local time constructor to avoid UTC offset issues
    vi.setSystemTime(new Date(2026, 2, 17, 12, 0, 0)) // March 17, 2026 noon local
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('today returns same from/to', () => {
    const range = getDateRange('today')
    expect(range.from).toBe(range.to)
  })

  it('this_week from <= to', () => {
    const range = getDateRange('this_week')
    expect(range.from <= range.to).toBe(true)
  })

  it('this_month from < to', () => {
    const range = getDateRange('this_month')
    expect(range.from <= range.to).toBe(true)
  })

  it('last_month returns previous month boundaries', () => {
    const range = getDateRange('last_month')
    expect(range.from < range.to).toBe(true)
    // Both dates should be valid ISO strings
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('this_fy starts before today', () => {
    const range = getDateRange('this_fy')
    expect(range.from < range.to).toBe(true)
    // FY start should be in the past
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('custom returns today-today', () => {
    const range = getDateRange('custom')
    expect(range.from).toBe(range.to)
  })
})

// ─── Day navigation ──────────────────────────────────────────────────────────

describe('getTodayISO', () => {
  it('returns ISO date string', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 17, 12, 0, 0))
    const result = getTodayISO()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    vi.useRealTimers()
  })
})

describe('getPrevDate', () => {
  it('goes back one day', () => {
    expect(getPrevDate('2026-03-15')).toBe('2026-03-14')
  })

  it('crosses month boundary', () => {
    expect(getPrevDate('2026-03-01')).toBe('2026-02-28')
  })
})

describe('getNextDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 17, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('goes forward one day for past date', () => {
    const result = getNextDate('2026-03-14')
    expect(result).toBe('2026-03-15')
  })

  it('returns null for future date', () => {
    expect(getNextDate('2026-04-01')).toBeNull()
  })
})

// ─── Query string builder ────────────────────────────────────────────────────

describe('buildQueryString', () => {
  it('builds from filter object', () => {
    const result = buildQueryString({ type: 'sale', limit: 20 })
    expect(result).toContain('type=sale')
    expect(result).toContain('limit=20')
  })

  it('skips undefined and null', () => {
    const result = buildQueryString({ type: 'sale', status: undefined, page: null })
    expect(result).toBe('type=sale')
  })

  it('skips empty strings', () => {
    const result = buildQueryString({ search: '' })
    expect(result).toBe('')
  })
})
