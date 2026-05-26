/**
 * Phase 7 · 7.1C PR-C3 — Stale-snapshot product re-resolve (ARCH §6 P2.5).
 *
 * Between preview-time (when the normalizer wrote `lines[*].resolved`) and
 * commit-time, the user may have created the missing Products in another
 * tab. The commit-invoices chunk-tx preloads a FRESH ProductSnapshot and
 * walks every line still marked `matchedBy === 'NOT_FOUND'`, attempting
 * resolution one more time. Hits mutate `row.normalized.lines[*].resolved`
 * **in memory only** — never persisted. The chunk's INSERT statements
 * read the post-mutation state.
 *
 * Why in-memory only: persisting would require a second UPDATE pass inside
 * the chunk tx, doubling the statement count without changing behaviour —
 * if commit succeeds the row flips to COMMITTED anyway; if it fails the
 * roll-back discards both the INSERT and the (would-be) UPDATE.
 */

import {
  resolveProductForLine,
  type ProductSnapshot,
} from './product-resolver.js'

/**
 * Minimum shape we need to mutate. Matches `StagedInvoiceRow.normalized`
 * but the test/runtime payload is `unknown` (ImportJobRow.normalized is
 * `Json`), so we widen via a structural type instead of importing the
 * full nominal type.
 */
export interface ReResolveLine {
  source: { sku: string | null; name?: string | null; productNameRaw?: string | null }
  resolved: { productId: string | null; matchedBy: string }
}

export interface ReResolveRow {
  normalized: { lines: ReResolveLine[] } | null
}

/**
 * Walk every line of every row; if `matchedBy === 'NOT_FOUND'`, look up
 * against `snapshot` and rewrite resolved in-place on a hit. Returns the
 * number of lines that flipped from NOT_FOUND to a hit (handy for tests +
 * the DEBUG log line in commit-invoices.service.ts).
 */
export function reResolveProductsInPlace(
  rows: ReResolveRow[],
  snapshot: ProductSnapshot,
): number {
  let flipped = 0
  for (const row of rows) {
    const lines = row.normalized?.lines
    if (!lines) continue
    for (const line of lines) {
      if (line.resolved.matchedBy !== 'NOT_FOUND') continue
      const candidate = {
        sku: line.source.sku ?? null,
        name: line.source.productNameRaw ?? line.source.name ?? null,
      }
      const r = resolveProductForLine(snapshot, candidate)
      if (r.productId && r.matchedBy !== 'NOT_FOUND' && r.matchedBy !== 'AMBIGUOUS') {
        line.resolved.productId = r.productId
        line.resolved.matchedBy = r.matchedBy
        flipped += 1
      }
    }
  }
  return flipped
}
