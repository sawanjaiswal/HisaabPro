/**
 * Phase 7 · 7.1C PR-C3 — Invoice product resolver (strict, no fly-create).
 *
 * Pre-flight to commit: every line must resolve to an existing Product row
 * scoped to `businessId`. Strict precedence (ARCH §2.7):
 *   1. BY_SKU            — `sku` exact (case-sensitive; SKUs are codes)
 *   2. BY_NAME_EXACT     — `lower(name)` exact (case-insensitive)
 *   3. BY_NAME_TRGM      — `pg_trgm` similarity ≥ 0.6 against lower(name);
 *                          single unambiguous winner only
 *   4. AMBIGUOUS         — multiple trigram hits at top score → user must
 *                          disambiguate by adding SKU
 *   5. NOT_FOUND         — no candidate; commit-blocked sentinel
 *
 * SKU sample for `COMMIT_BLOCKED_PRODUCT_NOT_FOUND` payload is logged at
 * **DEBUG** only (S5) — never INFO. The user-facing error carries up to
 * 5 entries; the rest are dropped to keep payload bounded.
 */

import type { Tx } from '../commit.helpers.js'

export type ProductMatchedBy =
  | 'BY_SKU'
  | 'BY_NAME_EXACT'
  | 'BY_NAME_TRGM'
  | 'AMBIGUOUS'
  | 'NOT_FOUND'

export interface ProductSnapshotRow {
  id: string
  sku: string // '' when null
  nameLower: string
}

export interface ProductSnapshot {
  bySku: Map<string, ProductSnapshotRow>
  byNameLower: Map<string, ProductSnapshotRow[]>
  /** Flat array — used by trigram fallback (string-distance O(N), N≤chunk products). */
  all: ProductSnapshotRow[]
}

export interface ProductCandidateInput {
  sku: string | null
  name: string | null
}

export interface ProductResolution {
  productId?: string
  matchedBy: ProductMatchedBy
}

const TRGM_THRESHOLD = 0.6

/**
 * Single-roundtrip preload of every Product for this business that COULD
 * match a chunk's line items. We pre-filter by `lower(name)` ANY OR `sku`
 * ANY to keep the result set bounded; trigram fallback works against the
 * already-loaded set client-side (cheap; chunk ≤ 200 invoices × ~10 lines
 * = ≤ 2k candidates max).
 */
export async function loadProductSnapshot(
  tx: Tx,
  businessId: string,
  candidates: ProductCandidateInput[],
): Promise<ProductSnapshot> {
  const skus = Array.from(
    new Set(candidates.map((c) => c.sku?.trim()).filter((s): s is string => !!s)),
  )
  const names = Array.from(
    new Set(
      candidates
        .map((c) => c.name?.trim().toLowerCase())
        .filter((s): s is string => !!s),
    ),
  )
  if (skus.length === 0 && names.length === 0) {
    return { bySku: new Map(), byNameLower: new Map(), all: [] }
  }
  const rows = await tx.$queryRaw<
    Array<{ id: string; sku: string; nameLower: string }>
  >`
    SELECT id, COALESCE(sku, '') AS sku, lower(name) AS "nameLower"
    FROM "Product"
    WHERE "businessId" = ${businessId}
      AND "deletedAt" IS NULL
      AND (
        sku = ANY(${skus.length > 0 ? skus : ['']}::text[])
        OR lower(name) = ANY(${names.length > 0 ? names : ['']}::text[])
      )
  `
  const bySku = new Map<string, ProductSnapshotRow>()
  const byNameLower = new Map<string, ProductSnapshotRow[]>()
  for (const row of rows) {
    if (row.sku) bySku.set(row.sku, row)
    const bucket = byNameLower.get(row.nameLower)
    if (bucket) bucket.push(row)
    else byNameLower.set(row.nameLower, [row])
  }
  return { bySku, byNameLower, all: rows }
}

/** Cheap trigram-like similarity — share of distinct trigrams. */
function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const trig = (s: string): Set<string> => {
    const padded = `  ${s}  `
    const out = new Set<string>()
    for (let i = 0; i < padded.length - 2; i++) {
      out.add(padded.slice(i, i + 3))
    }
    return out
  }
  const sa = trig(a)
  const sb = trig(b)
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter += 1
  const union = sa.size + sb.size - inter
  return union === 0 ? 0 : inter / union
}

export function resolveProductForLine(
  snapshot: ProductSnapshot,
  candidate: ProductCandidateInput,
): ProductResolution {
  const sku = candidate.sku?.trim() ?? ''
  const name = candidate.name?.trim() ?? ''
  const nameLower = name.toLowerCase()

  if (sku) {
    const hit = snapshot.bySku.get(sku)
    if (hit) return { productId: hit.id, matchedBy: 'BY_SKU' }
  }

  if (nameLower) {
    const exactBucket = snapshot.byNameLower.get(nameLower)
    if (exactBucket && exactBucket.length === 1) {
      return { productId: exactBucket[0].id, matchedBy: 'BY_NAME_EXACT' }
    }
    if (exactBucket && exactBucket.length > 1) {
      return { matchedBy: 'AMBIGUOUS' }
    }
    // Trigram fallback against the loaded set.
    let top = { id: '' as string | '', score: 0 }
    let tieCount = 0
    for (const row of snapshot.all) {
      const score = trigramSimilarity(nameLower, row.nameLower)
      if (score >= TRGM_THRESHOLD) {
        if (score > top.score) {
          top = { id: row.id, score }
          tieCount = 1
        } else if (score === top.score) {
          tieCount += 1
        }
      }
    }
    if (top.id && tieCount === 1) {
      return { productId: top.id, matchedBy: 'BY_NAME_TRGM' }
    }
    if (top.id && tieCount > 1) {
      return { matchedBy: 'AMBIGUOUS' }
    }
  }

  return { matchedBy: 'NOT_FOUND' }
}
