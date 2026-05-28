import { describe, it, expect } from 'vitest'
import {
  linearFit,
  projectLinear,
  percentChange,
  dailyVelocity,
  daysToStockOut,
  addDaysIso,
} from '../forecast.math.js'

describe('linearFit', () => {
  it('returns a flat line at 0 for empty input', () => {
    expect(linearFit([])).toEqual({ slope: 0, intercept: 0 })
  })

  it('returns intercept = the single sample with slope 0', () => {
    expect(linearFit([42])).toEqual({ slope: 0, intercept: 42 })
  })

  it('recovers an exact upward line y = 2x + 1', () => {
    const fit = linearFit([1, 3, 5, 7])
    expect(fit.slope).toBeCloseTo(2, 10)
    expect(fit.intercept).toBeCloseTo(1, 10)
  })

  it('recovers a downward slope', () => {
    const fit = linearFit([10, 8, 6, 4])
    expect(fit.slope).toBeCloseTo(-2, 10)
    expect(fit.intercept).toBeCloseTo(10, 10)
  })

  it('fits a least-squares line through noisy data', () => {
    // roughly y = x; least-squares slope should be ~1
    const fit = linearFit([0, 1, 1, 3, 4])
    expect(fit.slope).toBeGreaterThan(0.7)
    expect(fit.slope).toBeLessThan(1.3)
  })
})

describe('projectLinear', () => {
  it('extrapolates the next periods of a clean trend', () => {
    // y = 2x + 1 over x=0..3 → next two are x=4 (9), x=5 (11)
    expect(projectLinear([1, 3, 5, 7], 2)).toEqual([9, 11])
  })

  it('floors negative projections at 0 (revenue cannot go negative)', () => {
    // steep decline crosses zero within the projection window
    const out = projectLinear([100, 60, 20], 3)
    expect(out.every((v) => v >= 0)).toBe(true)
    expect(out[out.length - 1]).toBe(0)
  })

  it('rounds to integers (paise)', () => {
    const out = projectLinear([1, 2, 4], 1)
    expect(Number.isInteger(out[0])).toBe(true)
  })

  it('returns an empty array for zero periods', () => {
    expect(projectLinear([1, 2, 3], 0)).toEqual([])
  })
})

describe('percentChange', () => {
  it('computes a positive change', () => {
    expect(percentChange(100, 125)).toBeCloseTo(25, 10)
  })

  it('computes a negative change', () => {
    expect(percentChange(200, 150)).toBeCloseTo(-25, 10)
  })

  it('returns null when the baseline is zero (no meaningful %)', () => {
    expect(percentChange(0, 500)).toBeNull()
    expect(percentChange(-10, 500)).toBeNull()
  })
})

describe('dailyVelocity', () => {
  it('divides units by window days', () => {
    expect(dailyVelocity(300, 30)).toBe(10)
  })

  it('returns 0 for a non-positive window', () => {
    expect(dailyVelocity(300, 0)).toBe(0)
  })
})

describe('daysToStockOut', () => {
  it('floors stock / velocity', () => {
    expect(daysToStockOut(95, 10)).toBe(9)
  })

  it('returns null when there are no sales (velocity 0)', () => {
    expect(daysToStockOut(50, 0)).toBeNull()
  })

  it('returns 0 when already out of stock but still selling', () => {
    expect(daysToStockOut(0, 5)).toBe(0)
    expect(daysToStockOut(-3, 5)).toBe(0)
  })
})

describe('addDaysIso', () => {
  it('adds days in UTC and returns YYYY-MM-DD', () => {
    expect(addDaysIso(new Date('2026-05-28T00:00:00Z'), 9)).toBe('2026-06-06')
  })

  it('handles month boundaries', () => {
    expect(addDaysIso(new Date('2026-01-30T12:00:00Z'), 3)).toBe('2026-02-02')
  })
})
