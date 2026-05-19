/**
 * Phase 7 · 7.1B — Product dedup (exact SKU + trgm name)
 *
 * Two passes, both scoped strictly by businessId (S5 / M1):
 *   1. exactSkuMatch — Prisma findMany on Product (businessId, sku) for
 *      every staged row that has a sku
 *   2. trgmNameMatch — pg-trgm similarity() ≥ TRGM_THRESHOLD via
 *      `$queryRaw` parameterised by `$1=businessId`
 *
 * Cross-references:
 *   - SCOPE_PHASE7_IMPORT_7_1B.md File Plan rows 15-16
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1B.md M1 (auth-helper), S5 (tenant)
 */

import type { NormalizedProduct } from '../../../types/import.types.js'
import type { ExtendedPrismaClient } from '../../../lib/prisma.js'
import { TRGM_THRESHOLD, TRGM_TOP_K } from '../../../constants/import.constants.js'

export interface ExactSkuMatch {
  productId: string
  sku: string
  name: string
}

export interface TrgmNameMatch {
  productId: string
  name: string
  score: number
}

export interface FindExactSkuArgs {
  businessId: string
  rows: Array<NormalizedProduct & { sourceIndex: number }>
  prisma: Pick<ExtendedPrismaClient, 'product'>
}

/**
 * Build Map<sourceIndex, ExactSkuMatch> for rows whose sku already
 * exists in this business's Product table. Soft-deleted rows excluded
 * — re-importing into a tombstoned sku should produce a fresh row.
 */
export async function exactSkuMatch(
  args: FindExactSkuArgs,
): Promise<Map<number, ExactSkuMatch>> {
  const { businessId, rows, prisma } = args
  const out = new Map<number, ExactSkuMatch>()
  if (rows.length === 0) return out

  const skus = new Set<string>()
  for (const r of rows) if (r.sku) skus.add(r.sku)
  if (skus.size === 0) return out

  const existing = await prisma.product.findMany({
    where: {
      businessId, // tenancy guard — non-negotiable
      isDeleted: false,
      sku: { in: Array.from(skus) },
    },
    select: { id: true, sku: true, name: true },
  })
  const bySku = new Map<string, { id: string; name: string }>()
  for (const p of existing) {
    if (p.sku) bySku.set(p.sku, { id: p.id, name: p.name })
  }
  for (const r of rows) {
    if (!r.sku) continue
    const hit = bySku.get(r.sku)
    if (hit) {
      out.set(r.sourceIndex, {
        productId: hit.id,
        sku: r.sku,
        name: hit.name,
      })
    }
  }
  return out
}

interface TrgmRow {
  id: string
  name: string
  score: number
}

export interface FindTrgmArgs {
  businessId: string
  rows: Array<NormalizedProduct & { sourceIndex: number }>
  prisma: ExtendedPrismaClient
  threshold?: number
  topK?: number
}

/**
 * Per-row similarity() lookup against business's Product table using
 * pg_trgm. ORDER BY similarity DESC LIMIT topK, threshold filter.
 *
 * Parameters are bound positionally — never interpolated into the SQL —
 * so a malicious row name cannot escape into SQL. businessId is the
 * FIRST positional parameter so the planner-side tenant guard is
 * literally the first row in the query plan.
 */
export async function trgmNameMatch(
  args: FindTrgmArgs,
): Promise<Map<number, TrgmNameMatch[]>> {
  const {
    businessId,
    rows,
    prisma,
    threshold = TRGM_THRESHOLD,
    topK = TRGM_TOP_K,
  } = args
  const out = new Map<number, TrgmNameMatch[]>()
  if (rows.length === 0) return out

  for (const r of rows) {
    if (!r.name) continue
    const results = await prisma.$queryRaw<TrgmRow[]>`
      SELECT id, name, similarity(name, ${r.name}) AS score
      FROM "Product"
      WHERE "businessId" = ${businessId}
        AND "isDeleted" = false
        AND similarity(name, ${r.name}) >= ${threshold}
      ORDER BY score DESC
      LIMIT ${topK}
    `
    if (results.length === 0) continue
    out.set(
      r.sourceIndex,
      results.map((row) => ({
        productId: row.id,
        name: row.name,
        score: Number(row.score),
      })),
    )
  }
  return out
}
