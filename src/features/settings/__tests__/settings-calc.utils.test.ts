import { describe, it, expect } from 'vitest'
import {
  applyPercentage,
  calculateMarkup,
  calculateGst,
  evaluateExpression,
} from '../settings-calc.utils'

// ─── applyPercentage ──────────────────────────────────────────────────────────

describe('applyPercentage', () => {
  it('adds percentage', () => {
    expect(applyPercentage(1000, 18, 'add')).toBe(1180)
  })

  it('subtracts percentage', () => {
    expect(applyPercentage(1000, 18, 'subtract')).toBe(820)
  })

  it('handles 0%', () => {
    expect(applyPercentage(1000, 0, 'add')).toBe(1000)
  })

  it('handles 100%', () => {
    expect(applyPercentage(1000, 100, 'add')).toBe(2000)
    expect(applyPercentage(1000, 100, 'subtract')).toBe(0)
  })
})

// ─── calculateMarkup ─────────────────────────────────────────────────────────

describe('calculateMarkup', () => {
  it('calculates selling price from cost and margin', () => {
    expect(calculateMarkup(100, 20)).toBe(125)
  })

  it('returns null for 100% margin', () => {
    expect(calculateMarkup(100, 100)).toBeNull()
  })

  it('returns null for margin > 100%', () => {
    expect(calculateMarkup(100, 150)).toBeNull()
  })

  it('handles 0% margin', () => {
    expect(calculateMarkup(100, 0)).toBe(100)
  })

  it('rounds result', () => {
    // cost=100, margin=30 → 100 / 0.7 = 142.857... → 143
    expect(calculateMarkup(100, 30)).toBe(143)
  })
})

// ─── calculateGst ─────────────────────────────────────────────────────────────

describe('calculateGst', () => {
  it('calculates exclusive GST (amount + tax)', () => {
    const result = calculateGst(10000, 18, 'exclusive')
    expect(result.base).toBe(10000)
    expect(result.gst).toBe(1800)
    expect(result.total).toBe(11800)
  })

  it('extracts inclusive GST (amount contains tax)', () => {
    const result = calculateGst(11800, 18, 'inclusive')
    expect(result.base).toBe(10000)
    expect(result.gst).toBe(1800)
    expect(result.total).toBe(11800)
  })

  it('handles 0% rate', () => {
    const result = calculateGst(10000, 0, 'exclusive')
    expect(result.gst).toBe(0)
    expect(result.total).toBe(10000)
  })
})

// ─── evaluateExpression ───────────────────────────────────────────────────────

describe('evaluateExpression', () => {
  it('evaluates addition', () => {
    expect(evaluateExpression('2 + 3')).toBe(5)
  })

  it('evaluates subtraction', () => {
    expect(evaluateExpression('10 - 4')).toBe(6)
  })

  it('evaluates multiplication', () => {
    expect(evaluateExpression('3 * 4')).toBe(12)
  })

  it('evaluates division', () => {
    expect(evaluateExpression('10 / 2')).toBe(5)
  })

  it('respects operator precedence (* before +)', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14)
  })

  it('handles percentage suffix', () => {
    expect(evaluateExpression('100 + 18%')).toBe(118)
  })

  it('handles percentage subtraction', () => {
    expect(evaluateExpression('100 - 10%')).toBe(90)
  })

  it('returns null for division by zero', () => {
    expect(evaluateExpression('10 / 0')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(evaluateExpression('')).toBeNull()
  })

  it('returns null for invalid expression', () => {
    expect(evaluateExpression('abc')).toBeNull()
  })

  it('handles decimal numbers', () => {
    expect(evaluateExpression('2.5 + 3.5')).toBe(6)
  })

  it('handles chained operations', () => {
    expect(evaluateExpression('10 + 5 - 3')).toBe(12)
  })
})
