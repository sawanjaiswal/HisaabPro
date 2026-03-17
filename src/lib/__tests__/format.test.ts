import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatCurrency, formatNumber, formatDate, formatPhone, formatRelativeTime, toLocalISODate } from '../format'

describe('formatCurrency', () => {
  it('formats paise to INR with 2 decimals', () => {
    expect(formatCurrency(1550000)).toBe('₹15,500.00')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('₹0.00')
  })

  it('formats small amounts', () => {
    expect(formatCurrency(50)).toBe('₹0.50')
  })

  it('formats lakhs with Indian comma grouping', () => {
    // 10,00,000 paise = ₹10,000.00
    expect(formatCurrency(1000000)).toBe('₹10,000.00')
  })

  it('formats crores', () => {
    // 10,00,00,000 paise = ₹1,00,00,000.00
    expect(formatCurrency(1000000000)).toBe('₹1,00,00,000.00')
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-50000)).toBe('-₹500.00')
  })
})

describe('formatNumber', () => {
  it('formats with Indian comma grouping', () => {
    expect(formatNumber(100000)).toBe('1,00,000')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatDate', () => {
  it('formats Date object', () => {
    const result = formatDate(new Date('2026-03-14T00:00:00.000Z'))
    expect(result).toMatch(/14\/03\/2026/)
  })

  it('formats ISO string', () => {
    const result = formatDate('2026-01-05T00:00:00.000Z')
    expect(result).toMatch(/05\/01\/2026/)
  })
})

describe('formatPhone', () => {
  it('formats 10-digit number', () => {
    expect(formatPhone('9876543210')).toBe('+91 98765 43210')
  })

  it('formats 12-digit with 91 prefix', () => {
    expect(formatPhone('919876543210')).toBe('+91 98765 43210')
  })

  it('handles non-standard input unchanged', () => {
    expect(formatPhone('12345')).toBe('12345')
  })

  it('strips non-digit chars before formatting', () => {
    expect(formatPhone('+91-9876543210')).toBe('+91 98765 43210')
  })
})

describe('toLocalISODate', () => {
  it('returns YYYY-MM-DD using local date parts', () => {
    // March 17 2026 at any time of day
    const d = new Date(2026, 2, 17, 23, 59, 59) // local 11:59 PM
    expect(toLocalISODate(d)).toBe('2026-03-17')
  })

  it('does NOT shift to previous day for late-night IST', () => {
    // 11:30 PM IST on March 17 = 6:00 PM UTC March 17 — but toISOString
    // would give "2026-03-17" in UTC. However if it were 1:00 AM IST on March 18,
    // toISOString would give "2026-03-17" (UTC) — losing a day.
    // toLocalISODate always uses local components, so it's safe.
    const d = new Date(2026, 2, 18, 1, 0, 0) // 1 AM local on March 18
    expect(toLocalISODate(d)).toBe('2026-03-18')
  })

  it('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5) // January 5
    expect(toLocalISODate(d)).toBe('2026-01-05')
  })

  it('handles Dec 31 → no year rollover in local time', () => {
    const d = new Date(2026, 11, 31, 23, 30, 0) // Dec 31 11:30 PM local
    expect(toLocalISODate(d)).toBe('2026-12-31')
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-17T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Just now" for < 60s ago', () => {
    expect(formatRelativeTime('2026-03-17T11:59:30.000Z')).toBe('Just now')
  })

  it('returns minutes ago', () => {
    expect(formatRelativeTime('2026-03-17T11:55:00.000Z')).toBe('5m ago')
  })

  it('returns hours ago', () => {
    expect(formatRelativeTime('2026-03-17T09:00:00.000Z')).toBe('3h ago')
  })

  it('returns days ago', () => {
    expect(formatRelativeTime('2026-03-15T12:00:00.000Z')).toBe('2d ago')
  })

  it('falls back to date format for > 7 days', () => {
    const result = formatRelativeTime('2026-03-01T12:00:00.000Z')
    expect(result).toMatch(/01\/03\/2026/)
  })
})
