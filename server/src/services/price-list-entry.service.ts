/**
 * Price List Entry service — CRUD + overlap validation.
 * Qty-range overlap check: no two active entries for the same
 * (priceListId, productId) may have overlapping [minQty, maxQty] ranges.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import type { CreateEntryInput, UpdateEntryInput } from '../validators/price-list.schema.js'

// ── Overlap detection ─────────────────────────────────────────────────────────

interface QtyRange { minQty: number; maxQty: number | null; id?: string }

function rangesOverlap(a: QtyRange, b: QtyRange): boolean {
  const aMax = a.maxQty ?? Infinity
  const bMax = b.maxQty ?? Infinity
  return a.minQty <= bMax && aMax >= b.minQty
}

async function assertNoOverlap(
  priceListId: string,
  productId: string,
  range: QtyRange,
  excludeId?: string
) {
  const existing = await prisma.priceListEntry.findMany({
    where: {
      priceListId,
      productId,
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, minQty: true, maxQty: true },
  })

  const conflict = existing.find((e) => rangesOverlap(e, range))
  if (conflict) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      400,
      `Qty range ${range.minQty}–${range.maxQty ?? '∞'} overlaps with an existing entry ` +
        `(${conflict.minQty}–${conflict.maxQty ?? '∞'})`
    )
  }
}

// ── Ownership guard ───────────────────────────────────────────────────────────

async function assertListOwnership(businessId: string, priceListId: string) {
  const list = await prisma.priceList.findFirst({
    where: { id: priceListId, businessId, isDeleted: false },
  })
  if (!list) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Price list not found')
  return list
}

async function assertEntryOwnership(businessId: string, priceListId: string, entryId: string) {
  await assertListOwnership(businessId, priceListId)
  const entry = await prisma.priceListEntry.findFirst({
    where: { id: entryId, priceListId, isDeleted: false },
  })
  if (!entry) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Price list entry not found')
  return entry
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEntry(
  businessId: string,
  priceListId: string,
  input: CreateEntryInput
) {
  await assertListOwnership(businessId, priceListId)

  // Verify product belongs to same business
  const product = await prisma.product.findFirst({
    where: { id: input.productId, businessId, isDeleted: false },
  })
  if (!product) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Product not found')

  await assertNoOverlap(priceListId, input.productId, {
    minQty: input.minQty,
    maxQty: input.maxQty ?? null,
  })

  const entry = await prisma.priceListEntry.create({
    data: {
      priceListId,
      productId: input.productId,
      mode: input.mode,
      valuePaise: input.valuePaise ?? null,
      percentBps: input.percentBps ?? null,
      fixedOffPaise: input.fixedOffPaise ?? null,
      minQty: input.minQty,
      maxQty: input.maxQty ?? null,
    },
  })

  logger.info('Created price list entry', { businessId, priceListId, entryId: entry.id })
  return entry
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEntry(
  businessId: string,
  priceListId: string,
  entryId: string,
  input: UpdateEntryInput
) {
  const existing = await assertEntryOwnership(businessId, priceListId, entryId)

  const newMinQty = input.minQty ?? existing.minQty
  const newMaxQty = input.maxQty !== undefined ? input.maxQty : existing.maxQty

  if (input.minQty !== undefined || input.maxQty !== undefined) {
    await assertNoOverlap(
      priceListId,
      existing.productId,
      { minQty: newMinQty, maxQty: newMaxQty },
      entryId
    )
  }

  const entry = await prisma.priceListEntry.update({
    where: { id: entryId },
    data: {
      ...(input.mode ? { mode: input.mode } : {}),
      ...(input.valuePaise !== undefined ? { valuePaise: input.valuePaise } : {}),
      ...(input.percentBps !== undefined ? { percentBps: input.percentBps } : {}),
      ...(input.fixedOffPaise !== undefined ? { fixedOffPaise: input.fixedOffPaise } : {}),
      ...(input.minQty !== undefined ? { minQty: input.minQty } : {}),
      ...(input.maxQty !== undefined ? { maxQty: input.maxQty } : {}),
    },
  })

  logger.info('Updated price list entry', { businessId, priceListId, entryId })
  return entry
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteEntry(
  businessId: string,
  priceListId: string,
  entryId: string
) {
  await assertEntryOwnership(businessId, priceListId, entryId)

  await prisma.priceListEntry.update({
    where: { id: entryId },
    data: { isDeleted: true, deletedAt: new Date() },
  })

  logger.info('Soft-deleted price list entry', { businessId, priceListId, entryId })
}
