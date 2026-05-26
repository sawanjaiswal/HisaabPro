/**
 * Phase 7 · 7.1D PR-D3 — S9 audit homogeneity assertion.
 *
 * Defends against a regression where a developer adds a new parallel
 * array to an `emit*ImportedBatch` audit call but forgets to push a
 * row to one of them inside the chunk loop. The drift silently breaks
 * replay (sourceIndex N in `sourceIndices` no longer pairs with the
 * id at index N in `paymentIds`).
 */

import { describe, it, expect } from 'vitest'
import { assertEqualLengths } from '../audit-emit.js'

describe('assertEqualLengths — S9 type-homogeneity', () => {
  it('returns silently when every array has the same length', () => {
    expect(() =>
      assertEqualLengths({
        a: [1, 2, 3],
        b: ['x', 'y', 'z'],
        c: [true, false, true],
      }),
    ).not.toThrow()
  })

  it('returns silently for empty arrays', () => {
    expect(() => assertEqualLengths({ a: [], b: [], c: [] })).not.toThrow()
  })

  it('returns silently when called with no arrays', () => {
    expect(() => assertEqualLengths({})).not.toThrow()
  })

  it('throws when one array is shorter than the others', () => {
    expect(() =>
      assertEqualLengths({
        paymentIds: ['p1', 'p2', 'p3'],
        sourceIndices: [0, 1, 2],
        codes: ['COMMITTED', 'COMMITTED'], // <- drifted
      }),
    ).toThrowError(/parallel-array length mismatch/)
  })

  it('throws when one array is longer', () => {
    expect(() =>
      assertEqualLengths({
        paymentIds: ['p1'],
        sourceIndices: [0, 1], // <- drifted
      }),
    ).toThrowError(/length mismatch/)
  })

  it('error message names both the reference array and the drifted one', () => {
    try {
      assertEqualLengths({ a: [1, 2], b: [1, 2, 3] })
      throw new Error('should have thrown')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      expect(msg).toContain('a=2')
      expect(msg).toContain('b=3')
    }
  })
})
