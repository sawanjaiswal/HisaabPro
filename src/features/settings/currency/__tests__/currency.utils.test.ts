import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatRate,
  formatRateLabel,
  parseRateInput,
  formatEffectiveDate,
  todayIso,
} from '../currency.utils'

// ─── Rate formatting ────────────────────────────────────────────────────────

describe('formatRate', () => {
  it('formats whole rate (84.00)', () => {
    expect(formatRate(840000)).toBe('84.00')
  })

  it('formats rate with decimals (84.50)', () => {
    expect(formatRate(845000)).toBe('84.50')
  })

  it('formats zero rate', () => {
    expect(formatRate(0)).toBe('0.00')
  })

  it('formats small rate (1.25)', () => {
    expect(formatRate(12500)).toBe('1.25')
  })

  it('formats large rate (1234.56)', () => {
    expect(formatRate(12345600)).toBe('1234.56')
  })

  it('rounds to 2 decimal places', () => {
    // 845050 / 10000 = 84.505 → toFixed(2) = "84.50" (IEEE 754 rounds-half-to-even)
    expect(formatRate(845050)).toBe('84.50')
  })
})

// ─── Rate label formatting ──────────────────────────────────────────────────

describe('formatRateLabel', () => {
  it('formats USD rate label', () => {
    expect(formatRateLabel('USD', 845000)).toBe('1 USD = Rs 84.50')
  })

  it('formats EUR rate label', () => {
    expect(formatRateLabel('EUR', 920000)).toBe('1 EUR = Rs 92.00')
  })

  it('formats GBP rate label', () => {
    expect(formatRateLabel('GBP', 1060000)).toBe('1 GBP = Rs 106.00')
  })
})

// ─── Rate input parsing ─────────────────────────────────────────────────────

describe('parseRateInput', () => {
  it('parses whole number rate', () => {
    expect(parseRateInput('84')).toBe(840000)
  })

  it('parses decimal rate', () => {
    expect(parseRateInput('84.50')).toBe(845000)
  })

  it('parses small rate', () => {
    expect(parseRateInput('1.25')).toBe(12500)
  })

  it('returns NaN for empty string', () => {
    expect(parseRateInput('')).toBeNaN()
  })

  it('returns NaN for non-numeric input', () => {
    expect(parseRateInput('abc')).toBeNaN()
  })

  it('returns NaN for zero', () => {
    expect(parseRateInput('0')).toBeNaN()
  })

  it('returns NaN for negative value', () => {
    expect(parseRateInput('-10')).toBeNaN()
  })

  it('rounds to nearest integer', () => {
    // 84.505 * 10000 = 845050 → Math.round → 845050
    expect(parseRateInput('84.505')).toBe(845050)
  })
})

// ─── Effective date formatting ──────────────────────────────────────────────

describe('formatEffectiveDate', () => {
  it('formats YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(formatEffectiveDate('2026-03-17')).toBe('17/03/2026')
  })

  it('formats first day of year', () => {
    expect(formatEffectiveDate('2026-01-01')).toBe('01/01/2026')
  })

  it('returns raw string for invalid format', () => {
    expect(formatEffectiveDate('invalid')).toBe('invalid')
  })

  it('returns raw string for empty string', () => {
    expect(formatEffectiveDate('')).toBe('')
  })
})

// ─── Today ISO ──────────────────────────────────────────────────────────────

describe('todayIso', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns ISO date string', () => {
    const result = todayIso()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns correct date with fake timers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 17, 12, 0, 0)) // March 17, 2026
    const result = todayIso()
    expect(result).toBe('2026-03-17')
  })
})
