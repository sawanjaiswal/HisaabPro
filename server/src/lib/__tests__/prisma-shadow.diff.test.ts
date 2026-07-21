/**
 * File #8 — `diffIds` over fixtures. No DB (ARCHITECTURE §12.2, §13 Phase 1).
 *
 * The assertion that matters most here is AC-28, the id cap. It is a privacy
 * bound, not a performance one: the divergence table pairs a querying tenant with
 * row ids belonging to other tenants, so an uncapped whole-tenant divergence
 * would persist every id it touched (§9.3). Rev 2 lost this cap between documents
 * — a test is the only thing that stops it being lost again.
 */
import { describe, it, expect } from 'vitest'
import { diffIds } from '../prisma-shadow.diff.js'
import { SHADOW_MAX_IDS, SHADOW_MAX_ROWS } from '../prisma-shadow.constants.js'

const rows = (...ids: string[]) => ids.map((id) => ({ id }))

describe('diffIds — symmetric difference', () => {
  it('reports the id present only on the unscoped side (§12.2)', () => {
    const d = diffIds(rows('a', 'b'), rows('a'))
    expect(d.onlyUnscoped).toEqual(['b'])
    expect(d.onlyScoped).toEqual([])
    expect(d.unscopedCount).toBe(2)
    expect(d.scopedCount).toBe(1)
    expect(d.truncated).toBe(false)
  })

  it('reports the id present only on the scoped side', () => {
    const d = diffIds(rows('a'), rows('a', 'b'))
    expect(d.onlyScoped).toEqual(['b'])
    expect(d.onlyUnscoped).toEqual([])
  })

  it('identical sets diff to nothing', () => {
    const d = diffIds(rows('a', 'b'), rows('b', 'a'))
    expect(d.onlyUnscoped).toEqual([])
    expect(d.onlyScoped).toEqual([])
    expect(d.unscopedCount).toBe(2)
    expect(d.scopedCount).toBe(2)
  })

  it('handles a single-object result (findFirst) and null', () => {
    expect(diffIds({ id: 'a' }, null).onlyUnscoped).toEqual(['a'])
    expect(diffIds(null, null).unscopedCount).toBe(0)
  })
})

describe('diffIds — AC-28 id cap', () => {
  it('500 divergent ids in ⇒ 20 out, truncated, counts intact', () => {
    const many = rows(...Array.from({ length: 500 }, (_, i) => `id-${i}`))
    const d = diffIds(many, [])

    expect(d.onlyUnscoped).toHaveLength(SHADOW_MAX_IDS)
    expect(d.truncated).toBe(true)
    // The magnitude survives the cap — this is what makes a whole-tenant-shaped
    // divergence still legible after only 20 ids are kept.
    expect(d.unscopedCount).toBe(500)
    expect(d.scopedCount).toBe(0)
  })

  it('caps each array independently', () => {
    const a = rows(...Array.from({ length: 100 }, (_, i) => `a-${i}`))
    const b = rows(...Array.from({ length: 100 }, (_, i) => `b-${i}`))
    const d = diffIds(a, b)
    expect(d.onlyUnscoped).toHaveLength(SHADOW_MAX_IDS)
    expect(d.onlyScoped).toHaveLength(SHADOW_MAX_IDS)
  })

  it('does not set truncated when the cap did not bite', () => {
    const d = diffIds(rows(...Array.from({ length: SHADOW_MAX_IDS }, (_, i) => `x${i}`)), [])
    expect(d.onlyUnscoped).toHaveLength(SHADOW_MAX_IDS)
    expect(d.truncated).toBe(false)
  })
})

describe('diffIds — comparison ceiling (FM-7)', () => {
  it('above SHADOW_MAX_ROWS compares counts only', () => {
    const huge = rows(...Array.from({ length: SHADOW_MAX_ROWS + 1 }, (_, i) => `id-${i}`))
    const d = diffIds(huge, [])

    expect(d.onlyUnscoped).toEqual([])
    expect(d.truncated).toBe(true)
    expect(d.unsupportedShape).toBe(false)
    // A count-only comparison still detects the divergence, which is the point.
    expect(d.unscopedCount).toBe(SHADOW_MAX_ROWS + 1)
    expect(d.scopedCount).toBe(0)
  })
})

describe('diffIds — unsupported shapes', () => {
  it('flags rows with no id scalar rather than reporting agreement', () => {
    const d = diffIds([{ name: 'x' }], [{ name: 'x' }])
    expect(d.unsupportedShape).toBe(true)
    // Both id arrays are empty here — without the flag this is indistinguishable
    // from a clean read, which would be a false negative.
    expect(d.onlyUnscoped).toEqual([])
  })

  it('flags a non-string id', () => {
    expect(diffIds([{ id: 7 }], []).unsupportedShape).toBe(true)
  })

  it('flags scalar rows (groupBy-shaped results)', () => {
    expect(diffIds([1, 2], []).unsupportedShape).toBe(true)
  })
})
