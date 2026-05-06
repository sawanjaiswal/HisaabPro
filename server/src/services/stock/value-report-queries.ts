/**
 * BAT-06 — Stock Value Report Queries
 * UNION ALL: per-batch rows (products with batches) + per-product rows (no batches).
 * All money in paise as BigInt.
 */

import { prisma } from '../../lib/prisma.js'
import { Prisma } from '@prisma/client'

export interface BatchValueRow {
  kind: 'batch'
  productId: string; productName: string; sku: string | null; unit: string | null
  batchId: string; batchNumber: string; expiryDate: Date | null
  currentStock: number; unitCostPaise: bigint; totalPaise: bigint
}

export interface ProductValueRow {
  kind: 'product'
  productId: string; productName: string; sku: string | null; unit: string | null
  batchId: null; batchNumber: null; expiryDate: null
  currentStock: number; unitCostPaise: bigint; totalPaise: bigint
}

export type ValueRow = BatchValueRow | ProductValueRow

interface RawValueRow {
  kind: string; productId: string; productName: string; sku: string | null; unit: string | null
  batchId: string | null; batchNumber: string | null; expiryDate: Date | null
  currentStock: number; unitCostPaise: bigint; totalPaise: bigint
}

export interface ValueCursor { totalPaise: bigint; productId: string; batchId: string }

export function encodeCursor(row: ValueRow): string {
  const b = row.batchId ?? ''
  return Buffer.from(`${row.totalPaise}:${row.productId}:${b}`).toString('base64url')
}

export function decodeCursor(cursor: string): ValueCursor | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    const [totalPaiseStr, productId, ...rest] = decoded.split(':')
    if (!totalPaiseStr || !productId) return null
    return { totalPaise: BigInt(totalPaiseStr), productId, batchId: rest.join(':') }
  } catch { return null }
}

function normalise(raw: RawValueRow): ValueRow {
  const base = {
    productId: raw.productId, productName: raw.productName,
    sku: raw.sku, unit: raw.unit,
    currentStock: Number(raw.currentStock),
    unitCostPaise: BigInt(raw.unitCostPaise),
    totalPaise: BigInt(raw.totalPaise),
  }
  if (raw.kind === 'batch') {
    return { kind: 'batch', ...base, batchId: raw.batchId!, batchNumber: raw.batchNumber!, expiryDate: raw.expiryDate }
  }
  return { kind: 'product', ...base, batchId: null, batchNumber: null, expiryDate: null }
}

interface QueryOpts { businessId: string; cursor: ValueCursor | null; limit: number; categoryId?: string }

/** UNION ALL page query — returns limit+1 rows so caller can detect hasMore. */
export async function runValueQuery(opts: QueryOpts): Promise<ValueRow[]> {
  const { businessId, cursor, limit, categoryId } = opts
  const catClause = categoryId ? Prisma.sql`AND p."categoryId" = ${categoryId}` : Prisma.empty
  const curClause = cursor
    ? Prisma.sql`AND (
        total_paise < ${cursor.totalPaise}
        OR (total_paise = ${cursor.totalPaise} AND "productId" > ${cursor.productId})
        OR (total_paise = ${cursor.totalPaise} AND "productId" = ${cursor.productId}
            AND COALESCE("batchId", '') > ${cursor.batchId}))`
    : Prisma.empty

  const rows = await prisma.$queryRaw<RawValueRow[]>`
    WITH batch_rows AS (
      SELECT 'batch'::text AS kind,
        b.id AS "batchId", b."batchNumber", b."expiryDate",
        p.id AS "productId", p.name AS "productName", p.sku, u.symbol AS unit,
        b."currentStock",
        COALESCE(b."costPrice", p."weightedAvgCostPaise", 0)::bigint AS "unitCostPaise",
        FLOOR(b."currentStock" * COALESCE(b."costPrice", p."weightedAvgCostPaise", 0))::bigint AS total_paise
      FROM "Batch" b
      JOIN "Product" p ON p.id = b."productId"
      JOIN "Unit"    u ON u.id = p."unitId"
      WHERE b."businessId" = ${businessId} AND b."isDeleted" = false
        AND b."currentStock" > 0 AND p."isDeleted" = false ${catClause}
    ),
    product_rows AS (
      SELECT 'product'::text AS kind,
        NULL::text AS "batchId", NULL::text AS "batchNumber", NULL::timestamptz AS "expiryDate",
        p.id AS "productId", p.name AS "productName", p.sku, u.symbol AS unit,
        p."currentStock",
        COALESCE(p."weightedAvgCostPaise", 0)::bigint AS "unitCostPaise",
        FLOOR(p."currentStock" * COALESCE(p."weightedAvgCostPaise", 0))::bigint AS total_paise
      FROM "Product" p
      JOIN "Unit" u ON u.id = p."unitId"
      WHERE p."businessId" = ${businessId} AND p."isDeleted" = false AND p."currentStock" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "Batch" bx
          WHERE bx."productId" = p.id AND bx."businessId" = ${businessId} AND bx."isDeleted" = false
        ) ${catClause}
    ),
    combined AS (SELECT * FROM batch_rows UNION ALL SELECT * FROM product_rows)
    SELECT kind, "batchId", "batchNumber", "expiryDate", "productId", "productName",
      sku, unit, "currentStock", "unitCostPaise", total_paise AS "totalPaise"
    FROM combined
    WHERE true ${curClause}
    ORDER BY total_paise DESC, "productId" ASC, COALESCE("batchId", '') ASC
    LIMIT ${limit + 1}`

  return rows.map(normalise)
}

/** Summary strip — grand total without cursor/limit. */
export async function runValueSummary(
  businessId: string, categoryId?: string
): Promise<{ totalPaise: bigint; rowCount: number }> {
  const catClause = categoryId ? Prisma.sql`AND p."categoryId" = ${categoryId}` : Prisma.empty

  const [result] = await prisma.$queryRaw<{ total: bigint; cnt: bigint }[]>`
    WITH batch_rows AS (
      SELECT FLOOR(b."currentStock" * COALESCE(b."costPrice", p."weightedAvgCostPaise", 0))::bigint AS val
      FROM "Batch" b JOIN "Product" p ON p.id = b."productId"
      WHERE b."businessId" = ${businessId} AND b."isDeleted" = false
        AND b."currentStock" > 0 AND p."isDeleted" = false ${catClause}
    ),
    product_rows AS (
      SELECT FLOOR(p."currentStock" * COALESCE(p."weightedAvgCostPaise", 0))::bigint AS val
      FROM "Product" p
      WHERE p."businessId" = ${businessId} AND p."isDeleted" = false AND p."currentStock" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "Batch" bx
          WHERE bx."productId" = p.id AND bx."businessId" = ${businessId} AND bx."isDeleted" = false
        ) ${catClause}
    )
    SELECT COALESCE(SUM(val), 0)::bigint AS total, COUNT(*)::bigint AS cnt
    FROM (SELECT val FROM batch_rows UNION ALL SELECT val FROM product_rows) t`

  return { totalPaise: result ? BigInt(result.total) : BigInt(0), rowCount: result ? Number(result.cnt) : 0 }
}
