/**
 * Product list + low-stock search with server-side filtering and pagination.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import type { ListProductsQuery } from '../../schemas/product.schemas.js'
import { productListSelect } from './selects.js'

interface LowStockFilters {
  page: number
  limit: number
  skip: number
  search?: string
  categoryId?: string
  status?: string
  sortBy: string
  sortOrder: string
}

type RawProductRow = {
  id: string
  name: string
  sku: string | null
  sale_price: number
  purchase_price: number | null
  current_stock: number
  min_stock_level: number
  status: string
  created_at: Date
  category_id: string | null
  category_name: string | null
  unit_id: string
  unit_name: string
  unit_symbol: string
}

async function listLowStockProducts(businessId: string, filters: LowStockFilters) {
  const { page, limit, skip, search, categoryId, status, sortBy, sortOrder } = filters

  const params: unknown[] = [businessId]
  const clauses: string[] = [
    `p."businessId" = $1`,
    `p."minStockLevel" > 0`,
    `p."currentStock" < p."minStockLevel"`,
  ]

  if (status) {
    params.push(status)
    clauses.push(`p.status = $${params.length}`)
  }
  if (categoryId) {
    params.push(categoryId)
    clauses.push(`p."categoryId" = $${params.length}`)
  }
  if (search) {
    params.push(`%${search}%`)
    const n = params.length
    clauses.push(`(p.name ILIKE $${n} OR p.sku ILIKE $${n} OR p.description ILIKE $${n})`)
  }

  const whereClause = clauses.join(' AND ')

  const allowedSortColumns: Record<string, string> = {
    name: 'p.name',
    createdAt: 'p."createdAt"',
    salePrice: 'p."salePrice"',
    currentStock: 'p."currentStock"',
  }
  const orderColumn = allowedSortColumns[sortBy] ?? 'p.name'
  const orderDir = sortOrder === 'desc' ? 'DESC' : 'ASC'

  const countParams = [...params]
  const dataParams = [...params, limit, skip]

  const [countResult, lowStockCountResult, totalActiveCount, stockValueResult] = await Promise.all([
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "Product" p WHERE ${whereClause}`,
      ...countParams
    ),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Product"
      WHERE "businessId" = ${businessId} AND status = 'ACTIVE'
      AND "minStockLevel" > 0 AND "currentStock" < "minStockLevel"`,
    prisma.product.count({ where: { businessId, status: 'ACTIVE' } }),
    prisma.$queryRaw<[{ value: number }]>`
      SELECT COALESCE(SUM("currentStock" * COALESCE("purchasePrice", "salePrice")), 0)::float as value
      FROM "Product" WHERE "businessId" = ${businessId} AND status = 'ACTIVE'`,
  ])

  const total = Number(countResult[0]?.count ?? 0)

  const rows = await prisma.$queryRawUnsafe<RawProductRow[]>(
    `SELECT
       p.id, p.name, p.sku, p."salePrice" as sale_price, p."purchasePrice" as purchase_price,
       p."currentStock" as current_stock, p."minStockLevel" as min_stock_level,
       p.status, p."createdAt" as created_at, p."categoryId" as category_id,
       c.name as category_name,
       u.id as unit_id, u.name as unit_name, u.symbol as unit_symbol
     FROM "Product" p
     LEFT JOIN "Category" c ON c.id = p."categoryId"
     JOIN "Unit" u ON u.id = p."unitId"
     WHERE ${whereClause}
     ORDER BY ${orderColumn} ${orderDir}
     LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    ...dataParams
  )

  const products = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    salePrice: r.sale_price,
    purchasePrice: r.purchase_price,
    currentStock: Number(r.current_stock),
    minStockLevel: Number(r.min_stock_level),
    status: r.status,
    createdAt: r.created_at,
    category: r.category_id ? { id: r.category_id, name: r.category_name! } : null,
    unit: { id: r.unit_id, name: r.unit_name, symbol: r.unit_symbol },
  }))

  return {
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalProducts: totalActiveCount,
      lowStockCount: Number(lowStockCountResult[0]?.count ?? 0),
      totalStockValue: Math.round(stockValueResult[0]?.value ?? 0),
    },
  }
}

export async function listProducts(businessId: string, filters: ListProductsQuery) {
  const { page, limit, search, categoryId, status, lowStockOnly, sortBy, sortOrder } = filters
  const skip = (page - 1) * limit

  if (lowStockOnly) {
    return listLowStockProducts(businessId, { page, limit, skip, search, categoryId, status, sortBy, sortOrder })
  }

  const where: Prisma.ProductWhereInput = { businessId }

  if (status) where.status = status
  if (categoryId) where.categoryId = categoryId

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortOrder }

  const [products, total, lowStockCountResult, totalActiveCount, stockValueResult] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip, take: limit, select: productListSelect }),
    prisma.product.count({ where }),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "Product"
      WHERE "businessId" = ${businessId} AND status = 'ACTIVE'
      AND "minStockLevel" > 0 AND "currentStock" < "minStockLevel"`,
    prisma.product.count({ where: { businessId, status: 'ACTIVE' } }),
    prisma.$queryRaw<[{ value: number }]>`
      SELECT COALESCE(SUM("currentStock" * COALESCE("purchasePrice", "salePrice")), 0)::float as value
      FROM "Product" WHERE "businessId" = ${businessId} AND status = 'ACTIVE'`,
  ])

  return {
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    summary: {
      totalProducts: totalActiveCount,
      lowStockCount: Number(lowStockCountResult[0]?.count ?? 0),
      totalStockValue: Math.round(stockValueResult[0]?.value ?? 0),
    },
  }
}
