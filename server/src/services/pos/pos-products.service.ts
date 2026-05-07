/**
 * POS Products Service — product grid for the POS checkout screen.
 * Cursor-paginated by name ASC.
 * TODO: upgrade ordering to recently-used pivot (PosSaleItem last 30 days, COUNT DESC) then name ASC.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import type { PosServiceCtx } from './pos.types.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PosProductDTO {
  id: string
  name: string
  sku: string | null
  hsnCode: string | null
  categoryId: string | null
  categoryName: string | null
  unitId: string | null
  unitSymbol: string | null
  /** Sale price in paise */
  salePricePaise: number
  currentStock: number
  taxCategoryId: string | null
  /** GST rate in basis points */
  gstRate: number
  imageUrl: string | null
}

export interface ListPosProductsQuery {
  search?: string
  categoryId?: string
  limit?: number
  cursor?: string
  includeOutOfStock?: boolean
}

export interface ListPosProductsResult {
  products: PosProductDTO[]
  nextCursor: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 60
const MAX_LIMIT = 200

// ─── Cursor helpers ──────────────────────────────────────────────────────────

function encodeCursor(name: string, id: string): string {
  return Buffer.from(JSON.stringify({ name, id }), 'utf8').toString('base64')
}

function decodeCursor(encoded: string): { name: string; id: string } | null {
  try {
    const raw = Buffer.from(encoded, 'base64').toString('utf8')
    const parsed = JSON.parse(raw) as { name: string; id: string }
    if (typeof parsed.name !== 'string' || typeof parsed.id !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function listPosProducts(
  ctx: PosServiceCtx,
  query: ListPosProductsQuery
): Promise<ListPosProductsResult> {
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  const includeOutOfStock = query.includeOutOfStock ?? false

  const cursor = query.cursor ? decodeCursor(query.cursor) : null

  const products = await prisma.product.findMany({
    where: {
      businessId: ctx.businessId,
      status: 'ACTIVE',
      isDeleted: false,
      ...(includeOutOfStock ? {} : { currentStock: { gt: 0 } }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { name: { gt: cursor.name } },
              { name: { equals: cursor.name }, id: { gt: cursor.id } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      hsnCode: true,
      categoryId: true,
      category: { select: { name: true } },
      unitId: true,
      unit: { select: { symbol: true } },
      salePrice: true,
      currentStock: true,
      taxCategoryId: true,
      taxCategory: { select: { rate: true } },
      imageUrl: true,
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: limit + 1,
  })

  const hasMore = products.length > limit
  const slice = hasMore ? products.slice(0, limit) : products

  const dtos: PosProductDTO[] = slice.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    hsnCode: p.hsnCode ?? null,
    categoryId: p.categoryId ?? null,
    categoryName: p.category?.name ?? null,
    unitId: p.unitId ?? null,
    unitSymbol: p.unit?.symbol ?? null,
    salePricePaise: Number(p.salePrice),
    currentStock: Number(p.currentStock),
    taxCategoryId: p.taxCategoryId ?? null,
    gstRate: Number(p.taxCategory?.rate ?? 0),
    imageUrl: p.imageUrl ?? null,
  }))

  const nextCursor = hasMore
    ? encodeCursor(slice[slice.length - 1].name, slice[slice.length - 1].id)
    : null

  logger.debug('POS products listed', {
    businessId: ctx.businessId,
    count: dtos.length,
    hasMore,
  })

  return { products: dtos, nextCursor }
}
