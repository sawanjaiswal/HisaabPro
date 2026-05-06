/**
 * BAT-06 — Stock Value Report Queries
 *
 * UNION ALL of batch rows (products with batches, per-batch) and
 * product rows (products without any batch, single row per product).
 *
 * All monetary values stay in paise as BigInt. No Number() wrapping
 * of Decimal/BigInt money columns.
 */

import { prisma } from '../../lib/prisma.js'
import { Prisma } from '@prisma/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchValueRow {
  kind: 'batch'
  productId: string
  productName: string
  sku: string | null
  unit: string | null
  batchId: string
  batchNumber: string
  expiryDate: Date | null
  currentStock: number
  unitCostPaise: bigint
  totalPaise: bigint
}

export interface ProductValueRow {
  kind: 'product'
  productId: string
  productName: string
  sku: string | null
  unit: string | null
  batchId: null
  batchNumber: null
  expiryDate: null
  currentStock: number
  unitCostPaise: bigint
  totalPaise: bigint
}

export type ValueRow = BatchValueRow | ProductValueRow

// Raw DB row shape returned by $queryRaw
interface RawValueRow {
  kind: string
  productId: string
  productName: string
  sku: string | null
  unit: string | null
  batchId: string | null
  batchNumber: string | null
  expiryDate: Date | null
  currentStock: number
  unitCostPaise: bigint
  totalPaise: bigint
}

// ── Cursor helpers ─────────────────────────────────────────────────────────────

export interface ValueCursor {
  totalPaise: bigint
  productId: string
  batchId: string // '' for product rows
}

export function encodeCursor(row: ValueRow): string {
  const b = row.batchId ?? ''
  return Buffer.from(`${row.totalPaise}:${row.productId}:${b}`).toString('base64url')
}

export function decodeCursor(cursor: string): ValueCursor | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    const parts = decoded.split(':')
    if (parts.length < 3) return null
    // batchId may contain colons (cuid uses none, but be safe: join remaining)
    const [totalPaiseStr, productId, ...rest] = parts
    return {
      totalPaise: BigInt(totalPaiseStr),
      productId,
      batchId: rest.join(':'),
    }
  } catch {
    return null
  }
}

// ── Normalise raw rows ─────────────────────────────────────────────────────────

function normalise(raw: RawValueRow): ValueRow {
  if (raw.kind === 'batch') {
    return {
      kind: 'batch',
      productId: raw.productId,
      productName: raw.productName,
      sku: raw.sku,
      unit: raw.unit,
      batchId: raw.batchId!,
      batchNumber: raw.batchNumber!,
      expiryDate: raw.expiryDate,
      currentStock: Number(raw.currentStock),
      unitCostPaise: BigInt(raw.unitCostPaise),
      totalPaise: BigInt(raw.totalPaise),
    }
  }
  return {
    kind: 'product',
    productId: raw.productId,
    productName: raw.productName,
    sku: raw.sku,
    unit: raw.unit,
    batchId: null,
    batchNumber: null,
    expiryDate: null,
    currentStock: Number(raw.currentStock),
    unitCostPaise: BigInt(raw.unitCostPaise),
    totalPaise: BigInt(raw.totalPaise),
  }
}

// ── Main query ─────────────────────────────────────────────────────────────────

interface QueryOpts {
  businessId: string
  cursor: ValueCursor | null
  limit: number
  categoryId?: string
}

/**
 * Run UNION ALL of per-batch rows and per-product (non-batch) rows.
 * Returns `limit + 1` rows so the caller can detect hasMore.
 */
export async function runValueQuery(opts: QueryOpts): Promise<ValueRow[]> {
  const { businessId, cursor, limit, categoryId } = opts

  const categoryClause = categoryId
    ? Prisma.sql`AND p."categoryId" = ${categoryId}`
    : Prisma.empty

  // Cursor WHERE: rows that come after the cursor in (totalPaise DESC, productId ASC, batchId ASC)
  const cursorClause = cursor
    ? Prisma.sql`
        AND (
          total_paise < ${cursor.totalPaise}
          OR (total_paise = ${cursor.totalPaise} AND "productId" > ${cursor.productId})
          OR (total_paise = ${cursor.totalPaise} AND "productId" = ${cursor.productId}
              AND COALESCE("batchId", '') > ${cursor.batchId})
        )`
    : Prisma.empty

  const rows = await prisma.$queryRaw<RawValueRow[]>`
    WITH batch_rows AS (
      SELECT
        'batch'::text                                                          AS kind,
        b.id                                                                   AS "batchId",
        b."batchNumber"                                                        AS "batchNumber",
        b."expiryDate"                                                         AS "expiryDate",
        p.id                                                                   AS "productId",
        p.name                                                                 AS "productName",
        p.sku                                                                  AS sku,
        u.symbol                                                               AS unit,
        b."currentStock"                                                       AS "currentStock",
        COALESCE(b."costPrice", p."weightedAvgCostPaise", 0)::bigint          AS "unitCostPaise",
        FLOOR(
          b."currentStock" * COALESCE(b."costPrice", p."weightedAvgCostPaise", 0)
        )::bigint                                                              AS total_paise
      FROM "Batch" b
      JOIN "Product" p ON p.id = b."productId"
      JOIN "Unit"    u ON u.id = p."unitId"
      WHERE b."businessId" = ${businessId}
        AND b."isDeleted"  = false
        AND b."currentStock" > 0
        AND p."isDeleted"  = false
        ${categoryClause}
    ),
    product_rows AS (
      SELECT
        'product'::text                                   AS kind,
        NULL::text                                        AS "batchId",
        NULL::text                                        AS "batchNumber",
        NULL::timestamptz                                 AS "expiryDate",
        p.id                                              AS "productId",
        p.name                                            AS "productName",
        p.sku                                             AS sku,
        u.symbol                                          AS unit,
        p."currentStock"                                  AS "currentStock",
        COALESCE(p."weightedAvgCostPaise", 0)::bigint    AS "unitCostPaise",
        FLOOR(
          p."currentStock" * COALESCE(p."weightedAvgCostPaise", 0)
        )::bigint                                         AS total_paise
      FROM "Product" p
      JOIN "Unit"    u ON u.id = p."unitId"
      WHERE p."businessId" = ${businessId}
        AND p."isDeleted"  = false
        AND p."currentStock" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "Batch" bx
          WHERE bx."productId" = p.id
            AND bx."businessId" = ${businessId}
            AND bx."isDeleted"  = false
        )
        ${categoryClause}
    ),
    combined AS (
      SELECT * FROM batch_rows
      UNION ALL
      SELECT * FROM product_rows
    )
    SELECT
      kind,
      "batchId",
      "batchNumber",
      "expiryDate",
      "productId",
      "productName",
      sku,
      unit,
      "currentStock",
      "unitCostPaise",
      total_paise AS "totalPaise"
    FROM combined
    WHERE true
      ${cursorClause}
    ORDER BY total_paise DESC, "productId" ASC, COALESCE("batchId", '') ASC
    LIMIT ${limit + 1}
  `

  return rows.map(normalise)
}

/**
 * Grand total across ALL rows (no cursor, no limit) — used for summary strip.
 */
export async function runValueSummary(
  businessId: string,
  categoryId?: string
): Promise<{ totalPaise: bigint; rowCount: number }> {
  const categoryClause = categoryId
    ? Prisma.sql`AND p."categoryId" = ${categoryId}`
    : Prisma.empty

  const [result] = await prisma.$queryRaw<{ total: bigint; cnt: bigint }[]>`
    WITH batch_rows AS (
      SELECT FLOOR(
        b."currentStock" * COALESCE(b."costPrice", p."weightedAvgCostPaise", 0)
      )::bigint AS val
      FROM "Batch" b
      JOIN "Product" p ON p.id = b."productId"
      WHERE b."businessId" = ${businessId}
        AND b."isDeleted"  = false
        AND b."currentStock" > 0
        AND p."isDeleted"  = false
        ${categoryClause}
    ),
    product_rows AS (
      SELECT FLOOR(
        p."currentStock" * COALESCE(p."weightedAvgCostPaise", 0)
      )::bigint AS val
      FROM "Product" p
      WHERE p."businessId" = ${businessId}
        AND p."isDeleted"  = false
        AND p."currentStock" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "Batch" bx
          WHERE bx."productId" = p.id
            AND bx."businessId" = ${businessId}
            AND bx."isDeleted"  = false
        )
        ${categoryClause}
    )
    SELECT
      COALESCE(SUM(val), 0)::bigint  AS total,
      COUNT(*)::bigint               AS cnt
    FROM (SELECT val FROM batch_rows UNION ALL SELECT val FROM product_rows) t
  `

  return {
    totalPaise: result ? BigInt(result.total) : BigInt(0),
    rowCount: result ? Number(result.cnt) : 0,
  }
}
