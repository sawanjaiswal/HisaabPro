/**
 * Product Bulk Import / Export / Reorder Service — Feature #104, #106
 * All operations are scoped to businessId.
 */

import { prisma } from '../lib/prisma.js'
import { adjustStock } from './stock.service.js'
import logger from '../lib/logger.js'
import type { ExportProductsQuery, ReorderListQuery } from '../schemas/product.schemas.js'

// ============================================================
// Bulk Import
// ============================================================

interface BulkProductRow {
  name: string
  sku?: string
  categoryId?: string
  unitId: string
  salePrice: number
  purchasePrice?: number
  openingStock: number
  minStockLevel: number
  hsnCode?: string
}

interface BulkImportError {
  index: number
  message: string
}

export interface BulkImportResult {
  created: number
  errors: BulkImportError[]
}

/**
 * Import products one-by-one in individual transactions.
 * Per-row transactions mean a bad row never rolls back good rows.
 */
export async function bulkImportProducts(
  businessId: string,
  userId: string,
  rows: BulkProductRow[]
): Promise<BulkImportResult> {
  let created = 0
  const errors: BulkImportError[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      await prisma.$transaction(async (tx) => {
        const unit = await tx.unit.findFirst({ where: { id: row.unitId, businessId } })
        if (!unit) throw new Error(`Unit "${row.unitId}" not found`)

        if (row.categoryId) {
          const cat = await tx.category.findFirst({ where: { id: row.categoryId, businessId } })
          if (!cat) throw new Error(`Category "${row.categoryId}" not found`)
        }

        if (row.sku) {
          const exists = await tx.product.findFirst({ where: { businessId, sku: row.sku } })
          if (exists) throw new Error(`SKU "${row.sku}" already exists`)
        }

        const product = await tx.product.create({
          data: {
            businessId,
            name: row.name,
            sku: row.sku ?? null,
            categoryId: row.categoryId ?? null,
            unitId: row.unitId,
            salePrice: row.salePrice,
            purchasePrice: row.purchasePrice ?? null,
            currentStock: 0,
            minStockLevel: row.minStockLevel,
            hsnCode: row.hsnCode ?? null,
          },
          select: { id: true },
        })

        if (row.openingStock > 0) {
          await adjustStock(tx, {
            productId: product.id,
            businessId,
            quantity: row.openingStock,
            type: 'OPENING',
            userId,
          })
        }
      })
      created++
    } catch (err: unknown) {
      errors.push({
        index: i,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  logger.info('Bulk import complete', { businessId, created, errorCount: errors.length })
  return { created, errors }
}

// ============================================================
// Export
// ============================================================

export async function exportProducts(businessId: string, query: ExportProductsQuery) {
  const products = await prisma.product.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      sku: true,
      hsnCode: true,
      salePrice: true,
      purchasePrice: true,
      currentStock: true,
      minStockLevel: true,
      status: true,
      category: { select: { name: true } },
      unit: { select: { name: true, symbol: true } },
    },
  })

  const hasMore = products.length > query.limit
  if (hasMore) products.pop()
  const nextCursor = hasMore ? products[products.length - 1].id : null

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    hsnCode: p.hsnCode,
    categoryName: p.category?.name ?? null,
    unitName: p.unit.name,
    unitSymbol: p.unit.symbol,
    salePrice: p.salePrice,
    purchasePrice: p.purchasePrice,
    currentStock: Number(p.currentStock),
    minStockLevel: Number(p.minStockLevel),
    status: p.status,
  }))

  return { products: rows, nextCursor, hasMore }
}

// ============================================================
// Reorder List
// ============================================================

type ReorderRow = {
  id: string
  name: string
  sku: string | null
  current_stock: number
  min_stock_level: number
  deficit: number
  unit_name: string
  unit_symbol: string
}

export async function getReorderList(businessId: string, query: ReorderListQuery) {
  const fetchLimit = query.limit + 1

  // Cursor uses a subquery on createdAt for stable ordering
  const cursorFilter = query.cursor
    ? `AND p."createdAt" > (SELECT "createdAt" FROM "Product" WHERE id = $3 LIMIT 1)`
    : ''
  const params: unknown[] = query.cursor
    ? [businessId, fetchLimit, query.cursor]
    : [businessId, fetchLimit]

  const rows = await prisma.$queryRawUnsafe<ReorderRow[]>(
    `SELECT
       p.id,
       p.name,
       p.sku,
       p."currentStock"              AS current_stock,
       p."minStockLevel"             AS min_stock_level,
       (p."minStockLevel" - p."currentStock") AS deficit,
       u.name                        AS unit_name,
       u.symbol                      AS unit_symbol
     FROM "Product" p
     JOIN "Unit" u ON u.id = p."unitId"
     WHERE p."businessId" = $1
       AND p."minStockLevel" > 0
       AND p."currentStock" <= p."minStockLevel"
       ${cursorFilter}
     ORDER BY deficit DESC, p.name ASC
     LIMIT $2`,
    ...params
  )

  const hasMore = rows.length > query.limit
  if (hasMore) rows.pop()
  const nextCursor = hasMore ? rows[rows.length - 1].id : null

  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    currentStock: Number(r.current_stock),
    minStockLevel: Number(r.min_stock_level),
    deficit: Number(r.deficit),
    unit: { name: r.unit_name, symbol: r.unit_symbol },
  }))

  return { items, nextCursor, hasMore }
}
