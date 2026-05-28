/** Pure reorder-math tests (#148) — suggested qty, value, urgency, sort. */

import { describe, it, expect } from 'vitest'
import {
  suggestedReorderQty,
  reorderValuePaise,
  reorderUrgency,
  urgencyRank,
} from '../reorder.math.js'

describe('suggestedReorderQty', () => {
  it('covers lead + coverage demand minus current stock, rounded up', () => {
    // velocity 10/day, lead 7 + coverage 30 = 37 days → target 370, have 100 → 270
    expect(suggestedReorderQty(10, 7, 30, 100)).toBe(270)
  })

  it('rounds fractional deficits up to whole units', () => {
    // velocity 1.5/day × 10 days = 15 target, have 4 → 11
    expect(suggestedReorderQty(1.5, 4, 6, 4)).toBe(11)
  })

  it('returns 0 when current stock already exceeds the target', () => {
    expect(suggestedReorderQty(2, 7, 30, 1000)).toBe(0)
  })

  it('returns 0 for a non-selling product', () => {
    expect(suggestedReorderQty(0, 7, 30, 0)).toBe(0)
  })
})

describe('reorderValuePaise', () => {
  it('multiplies qty by unit cost', () => {
    expect(reorderValuePaise(270, 5000)).toBe(1_350_000)
  })

  it('is 0 when qty or cost is non-positive', () => {
    expect(reorderValuePaise(0, 5000)).toBe(0)
    expect(reorderValuePaise(10, 0)).toBe(0)
  })
})

describe('reorderUrgency', () => {
  it('flags out-of-stock first', () => {
    expect(reorderUrgency(0, 5, 7, 30)).toBe('out')
    expect(reorderUrgency(-2, null, 7, 30)).toBe('out')
  })

  it('flags critical when stock runs out within the lead time', () => {
    expect(reorderUrgency(50, 5, 7, 30)).toBe('critical')
    expect(reorderUrgency(50, 7, 7, 30)).toBe('critical')
  })

  it('flags low within the lead + coverage horizon', () => {
    expect(reorderUrgency(50, 20, 7, 30)).toBe('low')
    expect(reorderUrgency(50, 37, 7, 30)).toBe('low')
  })

  it('is ok beyond the horizon or when not selling', () => {
    expect(reorderUrgency(50, 90, 7, 30)).toBe('ok')
    expect(reorderUrgency(50, null, 7, 30)).toBe('ok')
  })
})

describe('urgencyRank', () => {
  it('orders out < critical < low < ok', () => {
    const ranks = (['out', 'critical', 'low', 'ok'] as const).map(urgencyRank)
    expect(ranks).toEqual([0, 1, 2, 3])
  })
})
