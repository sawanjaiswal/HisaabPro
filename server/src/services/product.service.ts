/**
 * Product Service
 * CRUD operations for products. Amounts in PAISE (integer). All queries scoped to businessId.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { notFoundError, conflictError } from '../lib/errors.js'
import { adjustStock } from './stock.service.js'
import logger from '../lib/logger.js'
import type {
  CreateProductInput,
  UpdateProductInput,
  ListProductsQuery,
  StockMovementQuery,
} from '../schemas/product.schemas.js'

// === Helpers ===

/** Verify product belongs to business, throw 404 if not */
async function requireProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
  })
  if (!product) throw notFoundError('Product')
  return product
}

/** Generate next SKU for a business — atomic via UPDATE ... RETURNING to prevent races */
async function generateSku(businessId: string): Promise<string> {
  // Ensure the row exists first (upsert with defaults), then atomically increment and fetch
  await prisma.inventorySetting.upsert({
    where: { businessId },
    create: { businessId },
    update: {},
  })

  const rows = await prisma.$queryRawUnsafe<Array<{ sku_prefix: string; sku_next_counter: number }>>(
    `UPDATE "InventorySetting"
     SET "skuNextCounter" = "skuNextCounter" + 1, "updatedAt" = NOW()
     WHERE "businessId" = $1
     RETURNING "skuPrefix" as sku_prefix, "skuNextCounter" as sku_next_counter`,
    businessId
  )

  // rows[0].sku_next_counter is the value AFTER increment; use counter - 1 as the claimed value
  const prefix = rows[0].sku_prefix ?? 'PRD'
  const counter = rows[0].sku_next_counter - 1
  return `${prefix}-${String(counter).padStart(4, '0')}`
}

// === CRUD ===

export async function createProduct(
  businessId: string,
  userId: string,
  data: CreateProductInput
) {
  logger.info('Creating product', { businessId, productName: data.name })

  // Validate categoryId if provided
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: data.categoryId, businessId },
    })
    if (!cat) throw notFoundError('Category')
  }

  // Validate unitId
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId, businessId },
  })
  if (!unit) throw notFoundError('Unit')

  // Generate or validate SKU
  let sku: string | null = null
  if (data.autoGenerateSku) {
    sku = await generateSku(businessId)
  } else if (data.sku) {
    // Check uniqueness
    const existing = await prisma.product.findFirst({
      where: { businessId, sku: data.sku },
    })
    if (existing) throw conflictError(`SKU "${data.sku}" already exists`)
    sku = data.sku
  }

  return prisma.$transaction(async (tx) => {
    // Create product with currentStock=0, then use adjustStock for opening
    const product = await tx.product.create({
      data: {
        businessId,
        name: data.name,
        sku,
        categoryId: data.categoryId ?? null,
        unitId: data.unitId,
        salePrice: data.salePrice,
        purchasePrice: data.purchasePrice ?? null,
        currentStock: 0,
        minStockLevel: data.minStockLevel,
        stockValidation: data.stockValidation,
        hsnCode: data.hsnCode ?? null,
        sacCode: data.sacCode ?? null,
        description: data.description ?? null,
        status: data.status,
      },
      select: productDetailSelect,
    })

    // Create custom field values
    if (data.customFields.length > 0) {
      await tx.productCustomFieldValue.createMany({
        data: data.customFields.map((cf) => ({
          productId: product.id,
          fieldId: cf.fieldId,
          value: cf.value,
        })),
      })
    }

    // Create opening stock movement — adjustStock handles the atomic update
    if (data.openingStock > 0) {
      await adjustStock(tx, {
        productId: product.id,
        businessId,
        quantity: data.openingStock,
        type: 'OPENING',
        userId,
      })
    }

    // Re-fetch with updated stock
    const result = await tx.product.findUniqueOrThrow({
      where: { id: product.id },
      select: productDetailSelect,
    })

    return result
  })
}

export async function listProducts(businessId: string, filters: ListProductsQuery) {
  const { page, limit, search, categoryId, status, lowStockOnly, sortBy, sortOrder } = filters
  const skip = (page - 1) * limit

  // Low-stock path: use raw SQL for accurate column comparison + correct pagination
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

  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  }

  const [products, total, lowStockCountResult, totalActiveCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: productListSelect,
    }),
    prisma.product.count({ where }),
    // Use raw SQL for accurate low-stock count (column comparison)
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "Product"
       WHERE "businessId" = $1 AND status = 'ACTIVE'
       AND "minStockLevel" > 0 AND "currentStock" < "minStockLevel"`,
      businessId
    ),
    prisma.product.count({ where: { businessId, status: 'ACTIVE' } }),
  ])

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalProducts: totalActiveCount,
      lowStockCount: Number(lowStockCountResult[0]?.count ?? 0),
    },
  }
}

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

/**
 * Low-stock product list using raw SQL throughout so the WHERE clause can compare
 * two columns ("currentStock" < "minStockLevel"). This gives accurate pagination
 * without fetching an over-sized result set and post-filtering in memory.
 */
async function listLowStockProducts(businessId: string, filters: LowStockFilters) {
  const { page, limit, skip, search, categoryId, status, sortBy, sortOrder } = filters

  // Build dynamic WHERE clauses — parameterised to prevent injection
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

  // Allowed columns for ORDER BY — whitelist to prevent injection
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

  const [countResult, lowStockCountResult, totalActiveCount] = await Promise.all([
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "Product" p WHERE ${whereClause}`,
      ...countParams
    ),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "Product"
       WHERE "businessId" = $1 AND status = 'ACTIVE'
       AND "minStockLevel" > 0 AND "currentStock" < "minStockLevel"`,
      businessId
    ),
    prisma.product.count({ where: { businessId, status: 'ACTIVE' } }),
  ])

  const total = Number(countResult[0]?.count ?? 0)

  // Fetch paginated rows with joins for category + unit
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalProducts: totalActiveCount,
      lowStockCount: Number(lowStockCountResult[0]?.count ?? 0),
    },
  }
}

export async function getProduct(businessId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId },
    select: {
      ...productDetailSelect,
      customFieldValues: {
        select: {
          id: true,
          fieldId: true,
          value: true,
          field: {
            select: {
              name: true,
              fieldType: true,
              showOnInvoice: true,
              sortOrder: true,
            },
          },
        },
        orderBy: { field: { sortOrder: 'asc' } },
      },
    },
  })

  if (!product) throw notFoundError('Product')

  // Fetch recent stock movements
  const recentMovements = await prisma.stockMovement.findMany({
    where: { productId, businessId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: stockMovementSelect,
  })

  return { ...product, recentMovements }
}

export async function updateProduct(
  businessId: string,
  productId: string,
  data: UpdateProductInput
) {
  await requireProduct(businessId, productId)

  // Validate categoryId if provided
  if (data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: data.categoryId, businessId },
    })
    if (!cat) throw notFoundError('Category')
  }

  // Validate unitId if provided
  if (data.unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, businessId },
    })
    if (!unit) throw notFoundError('Unit')
  }

  // Validate SKU uniqueness if changing
  if (data.sku) {
    const existing = await prisma.product.findFirst({
      where: { businessId, sku: data.sku, id: { not: productId } },
    })
    if (existing) throw conflictError(`SKU "${data.sku}" already exists`)
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.unitId !== undefined && { unitId: data.unitId }),
        ...(data.salePrice !== undefined && { salePrice: data.salePrice }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
        ...(data.minStockLevel !== undefined && { minStockLevel: data.minStockLevel }),
        ...(data.stockValidation !== undefined && { stockValidation: data.stockValidation }),
        ...(data.hsnCode !== undefined && { hsnCode: data.hsnCode }),
        ...(data.sacCode !== undefined && { sacCode: data.sacCode }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
      },
      select: productDetailSelect,
    })

    // Upsert custom field values if provided
    if (data.customFields && data.customFields.length > 0) {
      for (const cf of data.customFields) {
        await tx.productCustomFieldValue.upsert({
          where: { productId_fieldId: { productId, fieldId: cf.fieldId } },
          create: { productId, fieldId: cf.fieldId, value: cf.value },
          update: { value: cf.value },
        })
      }
    }

    return updated
  })
}

export async function deleteProduct(businessId: string, productId: string) {
  await requireProduct(businessId, productId)

  // Soft delete — set status to INACTIVE
  await prisma.product.update({
    where: { id: productId },
    data: { status: 'INACTIVE' },
  })

  return { deleted: true, mode: 'soft' }
}

// === Stock movements list ===

export async function listStockMovements(
  businessId: string,
  productId: string,
  filters: StockMovementQuery
) {
  await requireProduct(businessId, productId)

  const { page, limit, type, startDate, endDate } = filters
  const skip = (page - 1) * limit

  const where: Prisma.StockMovementWhereInput = {
    productId,
    businessId,
  }

  if (type) where.type = type
  if (startDate || endDate) {
    where.movementDate = {}
    if (startDate) where.movementDate.gte = new Date(startDate)
    if (endDate) where.movementDate.lte = new Date(endDate)
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: stockMovementSelect,
    }),
    prisma.stockMovement.count({ where }),
  ])

  return {
    movements,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

// === Select objects ===

const productListSelect = {
  id: true,
  name: true,
  sku: true,
  salePrice: true,
  purchasePrice: true,
  currentStock: true,
  minStockLevel: true,
  status: true,
  createdAt: true,
  category: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, symbol: true } },
} as const

const productDetailSelect = {
  id: true,
  businessId: true,
  name: true,
  sku: true,
  categoryId: true,
  unitId: true,
  salePrice: true,
  purchasePrice: true,
  currentStock: true,
  minStockLevel: true,
  stockValidation: true,
  hsnCode: true,
  sacCode: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, symbol: true } },
} as const

const stockMovementSelect = {
  id: true,
  productId: true,
  type: true,
  quantity: true,
  balanceAfter: true,
  reason: true,
  customReason: true,
  notes: true,
  referenceType: true,
  referenceId: true,
  referenceNumber: true,
  movementDate: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} as const
