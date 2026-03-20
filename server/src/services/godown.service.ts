/**
 * Godown Service — Phase 4 (#101 Multi-Godown)
 * Warehouse/godown CRUD and stock queries. Scoped to businessId.
 * Transfer logic is in godown-transfer.service.ts.
 */

import { prisma } from '../lib/prisma.js'
import { notFoundError, conflictError, validationError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import type { CreateGodownInput, UpdateGodownInput, GodownStockQuery } from '../schemas/godown.schemas.js'

// === Helpers ===

export async function requireGodown(businessId: string, godownId: string) {
  const godown = await prisma.godown.findFirst({
    where: { id: godownId, businessId, isDeleted: false },
  })
  if (!godown) throw notFoundError('Godown')
  return godown
}

// === CRUD ===

export async function createGodown(businessId: string, data: CreateGodownInput) {
  // Enforce uniqueness by name within business
  const existing = await prisma.godown.findFirst({
    where: { businessId, name: data.name, isDeleted: false },
    select: { id: true },
  })
  if (existing) throw conflictError(`Godown "${data.name}" already exists`)

  logger.info('Creating godown', { businessId, name: data.name })

  return prisma.$transaction(async (tx) => {
    // If new godown is default, clear existing default first
    if (data.isDefault) {
      await tx.godown.updateMany({
        where: { businessId, isDefault: true, isDeleted: false },
        data: { isDefault: false },
      })
    }

    return tx.godown.create({
      data: {
        businessId,
        name: data.name,
        address: data.address ?? null,
        isDefault: data.isDefault,
      },
      select: godownDetailSelect,
    })
  })
}

export async function listGodowns(businessId: string) {
  // Godown list is small (typically < 20 per business) — no pagination needed
  return prisma.godown.findMany({
    where: { businessId, isDeleted: false },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: godownDetailSelect,
  })
}

export async function updateGodown(
  businessId: string,
  godownId: string,
  data: UpdateGodownInput
) {
  await requireGodown(businessId, godownId)

  // Validate name uniqueness if changing
  if (data.name) {
    const existing = await prisma.godown.findFirst({
      where: { businessId, name: data.name, isDeleted: false, id: { not: godownId } },
      select: { id: true },
    })
    if (existing) throw conflictError(`Godown "${data.name}" already exists`)
  }

  logger.info('Updating godown', { businessId, godownId })

  return prisma.$transaction(async (tx) => {
    // If setting as default, clear existing default
    if (data.isDefault === true) {
      await tx.godown.updateMany({
        where: { businessId, isDefault: true, isDeleted: false, id: { not: godownId } },
        data: { isDefault: false },
      })
    }

    return tx.godown.update({
      where: { id: godownId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
      select: godownDetailSelect,
    })
  })
}

export async function deleteGodown(businessId: string, godownId: string) {
  await requireGodown(businessId, godownId)

  // Block deletion if stock exists in the godown
  const stockCount = await prisma.godownStock.count({
    where: { godownId, businessId, quantity: { gt: 0 } },
  })
  if (stockCount > 0) {
    throw validationError('Cannot delete godown with existing stock. Transfer all stock out first.')
  }

  logger.info('Soft-deleting godown', { businessId, godownId })

  await prisma.godown.update({
    where: { id: godownId },
    data: { isDeleted: true, isDefault: false },
  })

  return { deleted: true, mode: 'soft' }
}

export async function getGodownStock(
  businessId: string,
  godownId: string,
  query: GodownStockQuery
) {
  await requireGodown(businessId, godownId)

  const { cursor, limit, search } = query

  const where = {
    businessId,
    godownId,
    quantity: { gt: 0 },
    ...(search
      ? { product: { name: { contains: search, mode: 'insensitive' as const } } }
      : {}),
  }

  const stocks = await prisma.godownStock.findMany({
    where,
    orderBy: { product: { name: 'asc' } },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      productId: true,
      godownId: true,
      batchId: true,
      quantity: true,
      product: { select: { id: true, name: true, sku: true, unit: { select: { name: true, symbol: true } } } },
      batch: { select: { id: true, batchNumber: true, expiryDate: true } },
    },
  })

  const hasMore = stocks.length > limit
  if (hasMore) stocks.pop()

  const total = await prisma.godownStock.count({ where })

  return {
    stocks,
    total,
    pagination: { nextCursor: hasMore ? stocks[stocks.length - 1]?.id ?? null : null },
  }
}

// === Select objects ===

const godownDetailSelect = {
  id: true,
  businessId: true,
  name: true,
  address: true,
  isDefault: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const
