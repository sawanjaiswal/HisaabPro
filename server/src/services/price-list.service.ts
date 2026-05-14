/**
 * Price List CRUD service.
 * All queries scoped to businessId. Soft-delete via isDeleted + deletedAt.
 * Default-list mutations run in a single Prisma transaction.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import type { CreatePriceListInput, UpdatePriceListInput } from '../validators/price-list.schema.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertOwnership(businessId: string, listId: string) {
  const list = await prisma.priceList.findFirst({
    where: { id: listId, businessId, isDeleted: false },
  })
  if (!list) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Price list not found')
  return list
}

/** Set default list — clears old flag + updates Business.defaultPriceListId in one tx. */
async function setDefaultInTx(businessId: string, newDefaultId: string | null) {
  return prisma.$transaction(async (tx) => {
    // Clear existing default flags on all lists
    await tx.priceList.updateMany({
      where: { businessId, isDefault: true, isDeleted: false },
      data: { isDefault: false },
    })
    // Set new default flag if a list is given
    if (newDefaultId) {
      await tx.priceList.update({ where: { id: newDefaultId }, data: { isDefault: true } })
    }
    // Update the SSOT FK on Business
    await tx.business.update({
      where: { id: businessId },
      data: { defaultPriceListId: newDefaultId },
    })
  })
}

// ── List all ──────────────────────────────────────────────────────────────────

export async function listPriceLists(businessId: string) {
  const lists = await prisma.priceList.findMany({
    where: { businessId, isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      isDefault: true,
      createdAt: true,
      _count: {
        select: {
          entries: { where: { isDeleted: false } },
          parties: true,
        },
      },
    },
  })
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    isDefault: l.isDefault,
    entryCount: l._count.entries,
    partyCount: l._count.parties,
    createdAt: l.createdAt,
  }))
}

// ── Get single ────────────────────────────────────────────────────────────────

export async function getPriceList(businessId: string, listId: string) {
  const list = await prisma.priceList.findFirst({
    where: { id: listId, businessId, isDeleted: false },
    include: {
      entries: {
        where: { isDeleted: false },
        orderBy: [{ productId: 'asc' }, { minQty: 'asc' }],
        include: { product: { select: { id: true, name: true, salePrice: true } } },
      },
      _count: { select: { parties: true } },
    },
  })
  if (!list) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Price list not found')
  return list
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPriceList(businessId: string, input: CreatePriceListInput) {
  logger.info('Creating price list', { businessId, name: input.name })

  const list = await prisma.priceList.create({
    data: { businessId, name: input.name, isDefault: false },
  })

  if (input.isDefault) {
    await setDefaultInTx(businessId, list.id)
    list.isDefault = true
  }

  return list
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updatePriceList(
  businessId: string,
  listId: string,
  input: UpdatePriceListInput
) {
  await assertOwnership(businessId, listId)
  logger.info('Updating price list', { businessId, listId })

  const updateData: { name?: string } = {}
  if (input.name) updateData.name = input.name

  const list = await prisma.priceList.update({
    where: { id: listId },
    data: updateData,
  })

  if (input.isDefault === true) {
    await setDefaultInTx(businessId, listId)
    list.isDefault = true
  } else if (input.isDefault === false) {
    // Explicitly un-set default
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { defaultPriceListId: true },
    })
    if (biz?.defaultPriceListId === listId) {
      await setDefaultInTx(businessId, null)
      list.isDefault = false
    }
  }

  return list
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deletePriceList(businessId: string, listId: string) {
  await assertOwnership(businessId, listId)

  // Reject if this is the business default
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { defaultPriceListId: true },
  })
  if (biz?.defaultPriceListId === listId) {
    throw new AppError(
      ErrorCode.DUPLICATE_ENTRY,
      409,
      'Cannot delete the default price list — set another list as default first'
    )
  }

  // Clear party references + soft-delete in one transaction
  await prisma.$transaction(async (tx) => {
    await tx.party.updateMany({
      where: { businessId, priceListId: listId },
      data: { priceListId: null },
    })
    await tx.priceList.update({
      where: { id: listId },
      data: { isDeleted: true, deletedAt: new Date() },
    })
  })

  logger.info('Soft-deleted price list', { businessId, listId })
}
