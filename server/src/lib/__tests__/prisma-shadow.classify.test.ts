/**
 * File #9 — `classify` over fixtures. No DB (ARCHITECTURE §9.1, §13 Phase 1).
 *
 * Two of these tests exist because of the ordering hazard, not because of the
 * happy path: `clean` must outrank the excuse kinds (or a healthy paginated read
 * inflates `unstable-window`), and the excuse kinds must outrank `diverged` (or
 * ordinary write skew never lets the 72-hour zero-divergence gate go green).
 * AC-17 is the bounded-window case.
 */
import { describe, it, expect } from 'vitest'
import { classify } from '../prisma-shadow.classify.js'
import { SHADOW_SKEW_MAX_IDS } from '../prisma-shadow.constants.js'
import type { ShadowArgFlags, ShadowDiff } from '../prisma-shadow.types.js'

const flags = (over: Partial<ShadowArgFlags> = {}): ShadowArgFlags => ({
  hasInclude: false,
  hasBoundedWindow: false,
  ...over,
})

const diff = (over: Partial<ShadowDiff> = {}): ShadowDiff => ({
  onlyUnscoped: [],
  onlyScoped: [],
  unscopedCount: 0,
  scopedCount: 0,
  truncated: false,
  unsupportedShape: false,
  ...over,
})

describe('classify — clean', () => {
  it('empty symmetric difference is clean', () => {
    expect(classify(diff({ unscopedCount: 3, scopedCount: 3 }), flags(), 5)).toBe('clean')
  })

  it('clean outranks a bounded window — a healthy paginated read is not an anomaly', () => {
    const d = diff({ unscopedCount: 10, scopedCount: 10 })
    expect(classify(d, flags({ hasBoundedWindow: true }), 5)).toBe('clean')
  })

  it('count-only divergence above the row ceiling is NOT clean', () => {
    // Both id arrays empty by design at this size; only the counts carry the
    // signal. Checking arrays alone would report this as agreement.
    const d = diff({ unscopedCount: 9000, scopedCount: 12, truncated: true })
    expect(classify(d, flags(), 5)).toBe('diverged')
  })
})

describe('classify — unsupported-shape outranks everything', () => {
  it('an id-less result is unsupported, not clean', () => {
    expect(classify(diff({ unsupportedShape: true }), flags(), 5)).toBe('unsupported-shape')
  })
})

describe('classify — unstable-window (AC-17)', () => {
  it('a divergence under take/skip/cursor is excused as unstable-window', () => {
    const d = diff({ onlyUnscoped: ['b'], unscopedCount: 2, scopedCount: 1 })
    expect(classify(d, flags({ hasBoundedWindow: true }), 5)).toBe('unstable-window')
  })
})

describe('classify — skew-suspect', () => {
  it('a small one-directional diff is skew-suspect', () => {
    const d = diff({ onlyScoped: ['x'], unscopedCount: 4, scopedCount: 5 })
    expect(classify(d, flags(), 12)).toBe('skew-suspect')
  })

  it('at the skew ceiling it is still skew-suspect', () => {
    const ids = Array.from({ length: SHADOW_SKEW_MAX_IDS }, (_, i) => `x${i}`)
    const d = diff({ onlyUnscoped: ids, unscopedCount: 10, scopedCount: 7 })
    expect(classify(d, flags(), 12)).toBe('skew-suspect')
  })

  it('one over the ceiling is a real divergence', () => {
    const ids = Array.from({ length: SHADOW_SKEW_MAX_IDS + 1 }, (_, i) => `x${i}`)
    const d = diff({ onlyUnscoped: ids, unscopedCount: 10, scopedCount: 6 })
    expect(classify(d, flags(), 12)).toBe('diverged')
  })

  it('a small BI-directional diff is not skew — skew is systematic, not random', () => {
    // Promise-reuse fixes the control first and the candidate second, so an
    // insert lands in onlyScoped and a delete in onlyUnscoped — never both.
    const d = diff({ onlyUnscoped: ['a'], onlyScoped: ['b'], unscopedCount: 2, scopedCount: 2 })
    expect(classify(d, flags(), 12)).toBe('diverged')
  })
})

describe('classify — diverged', () => {
  it('a whole-tenant-shaped diff on an unbounded read is diverged', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `other-tenant-${i}`)
    const d = diff({ onlyUnscoped: ids, unscopedCount: 25, scopedCount: 5, truncated: true })
    expect(classify(d, flags(), 8)).toBe('diverged')
  })
})
