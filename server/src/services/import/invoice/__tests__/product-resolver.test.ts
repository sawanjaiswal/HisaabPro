/**
 * Phase 7 · 7.1C PR-C3 — product-resolver unit tests.
 *
 * Covers all five matchedBy branches: BY_SKU, BY_NAME_EXACT, BY_NAME_TRGM,
 * AMBIGUOUS, NOT_FOUND. Resolver is pure (no DB I/O) — loadProductSnapshot
 * is the DB roundtrip; these tests construct snapshots inline.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveProductForLine,
  type ProductSnapshot,
} from '../product-resolver.js'

function snap(
  rows: Array<{ id: string; sku?: string; nameLower: string }>,
): ProductSnapshot {
  const all = rows.map((r) => ({ id: r.id, sku: r.sku ?? '', nameLower: r.nameLower }))
  const bySku = new Map<string, (typeof all)[number]>()
  const byNameLower = new Map<string, (typeof all)[number][]>()
  for (const r of all) {
    if (r.sku) bySku.set(r.sku, r)
    const bucket = byNameLower.get(r.nameLower)
    if (bucket) bucket.push(r)
    else byNameLower.set(r.nameLower, [r])
  }
  return { bySku, byNameLower, all }
}

describe('resolveProductForLine', () => {
  it('BY_SKU — sku exact wins over everything else', () => {
    const s = snap([{ id: 'p1', sku: 'WIDGET-9', nameLower: 'wonderwidget' }])
    const r = resolveProductForLine(s, { sku: 'WIDGET-9', name: 'something else' })
    expect(r).toEqual({ productId: 'p1', matchedBy: 'BY_SKU' })
  })

  it('BY_SKU is case-sensitive (SKUs are codes)', () => {
    const s = snap([{ id: 'p1', sku: 'WIDGET-9', nameLower: 'w' }])
    const r = resolveProductForLine(s, { sku: 'widget-9', name: null })
    expect(r.matchedBy).toBe('NOT_FOUND')
  })

  it('BY_NAME_EXACT — single name match, case-insensitive', () => {
    const s = snap([{ id: 'p1', nameLower: 'widget' }])
    const r = resolveProductForLine(s, { sku: null, name: 'WIDGET' })
    expect(r).toEqual({ productId: 'p1', matchedBy: 'BY_NAME_EXACT' })
  })

  it('AMBIGUOUS — two rows share lower(name)', () => {
    const s = snap([
      { id: 'p1', nameLower: 'widget' },
      { id: 'p2', nameLower: 'widget' },
    ])
    const r = resolveProductForLine(s, { sku: null, name: 'widget' })
    expect(r.matchedBy).toBe('AMBIGUOUS')
    expect(r.productId).toBeUndefined()
  })

  it('BY_NAME_TRGM — close-but-not-exact, single winner', () => {
    const s = snap([
      { id: 'p1', nameLower: 'royal wonderwidget assembly v2' },
    ])
    const r = resolveProductForLine(s, {
      sku: null,
      // Slightly different (extra word) — trigram similarity above 0.6 but
      // NOT an exact lower(name) hit.
      name: 'Royal Wonderwidget Assembly V2 Premium',
    })
    expect(r.matchedBy).toBe('BY_NAME_TRGM')
    expect(r.productId).toBe('p1')
  })

  it('NOT_FOUND — empty snapshot', () => {
    const s = snap([])
    const r = resolveProductForLine(s, { sku: 'X', name: 'Y' })
    expect(r.matchedBy).toBe('NOT_FOUND')
  })

  it('NOT_FOUND — trigram below 0.6 threshold', () => {
    const s = snap([{ id: 'p1', nameLower: 'apple' }])
    const r = resolveProductForLine(s, { sku: null, name: 'orange' })
    expect(r.matchedBy).toBe('NOT_FOUND')
  })

  it('falls back to name when sku is provided but not in snapshot', () => {
    const s = snap([{ id: 'p1', nameLower: 'widget' }])
    const r = resolveProductForLine(s, { sku: 'NOT-IN-DB', name: 'widget' })
    expect(r.matchedBy).toBe('BY_NAME_EXACT')
    expect(r.productId).toBe('p1')
  })
})
