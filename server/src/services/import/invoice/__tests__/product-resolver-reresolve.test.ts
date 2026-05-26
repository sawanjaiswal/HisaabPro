/**
 * Phase 7 · 7.1C PR-C3 — stale-snapshot re-resolve (ARCH §6 P2.5).
 *
 * Asserts in-place mutation semantics for the three branches that matter:
 *   (a) NOT_FOUND → fresh snapshot has the row by SKU → flip to BY_SKU
 *   (b) NOT_FOUND → fresh snapshot still missing → unchanged
 *   (c) NOT_FOUND → fresh snapshot has it by name → flip to BY_NAME_EXACT
 *
 * Already-resolved lines (BY_SKU / BY_NAME_EXACT) must NOT be re-checked
 * (no wasted lookups, preserves preview-time precedence).
 */

import { describe, it, expect } from 'vitest'
import { reResolveProductsInPlace } from '../product-resolver-reresolve.js'
import type { ProductSnapshot } from '../product-resolver.js'

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

describe('reResolveProductsInPlace', () => {
  it('(a) stale → BY_SKU after fresh snapshot has the product', () => {
    const rows = [
      {
        normalized: {
          lines: [
            {
              source: { sku: 'NEW-SKU', productNameRaw: 'New Widget' },
              resolved: { productId: null, matchedBy: 'NOT_FOUND' },
            },
          ],
        },
      },
    ]
    const fresh = snap([{ id: 'p-new', sku: 'NEW-SKU', nameLower: 'new widget' }])
    const flipped = reResolveProductsInPlace(rows, fresh)
    expect(flipped).toBe(1)
    expect(rows[0].normalized.lines[0].resolved).toEqual({
      productId: 'p-new',
      matchedBy: 'BY_SKU',
    })
  })

  it('(b) still-missing → resolved unchanged', () => {
    const rows = [
      {
        normalized: {
          lines: [
            {
              source: { sku: 'GONE', productNameRaw: 'Gone Item' },
              resolved: { productId: null, matchedBy: 'NOT_FOUND' },
            },
          ],
        },
      },
    ]
    const fresh = snap([])
    const flipped = reResolveProductsInPlace(rows, fresh)
    expect(flipped).toBe(0)
    expect(rows[0].normalized.lines[0].resolved).toEqual({
      productId: null,
      matchedBy: 'NOT_FOUND',
    })
  })

  it('(c) BY_NAME_EXACT re-resolution', () => {
    const rows = [
      {
        normalized: {
          lines: [
            {
              source: { sku: null, productNameRaw: 'Widget' },
              resolved: { productId: null, matchedBy: 'NOT_FOUND' },
            },
          ],
        },
      },
    ]
    const fresh = snap([{ id: 'p1', nameLower: 'widget' }])
    const flipped = reResolveProductsInPlace(rows, fresh)
    expect(flipped).toBe(1)
    expect(rows[0].normalized.lines[0].resolved.matchedBy).toBe('BY_NAME_EXACT')
  })

  it('does not touch lines that are already resolved', () => {
    const rows = [
      {
        normalized: {
          lines: [
            {
              source: { sku: 'A', productNameRaw: 'A' },
              resolved: { productId: 'existing-p', matchedBy: 'BY_SKU' },
            },
          ],
        },
      },
    ]
    const fresh = snap([{ id: 'different-p', sku: 'A', nameLower: 'a' }])
    const flipped = reResolveProductsInPlace(rows, fresh)
    expect(flipped).toBe(0)
    expect(rows[0].normalized.lines[0].resolved.productId).toBe('existing-p')
  })

  it('AMBIGUOUS hits are not flipped from NOT_FOUND (need user disambiguation)', () => {
    const rows = [
      {
        normalized: {
          lines: [
            {
              source: { sku: null, productNameRaw: 'Widget' },
              resolved: { productId: null, matchedBy: 'NOT_FOUND' },
            },
          ],
        },
      },
    ]
    const fresh = snap([
      { id: 'p1', nameLower: 'widget' },
      { id: 'p2', nameLower: 'widget' },
    ])
    const flipped = reResolveProductsInPlace(rows, fresh)
    expect(flipped).toBe(0)
    expect(rows[0].normalized.lines[0].resolved.matchedBy).toBe('NOT_FOUND')
  })
})
