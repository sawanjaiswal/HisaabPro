/**
 * Price List bulk-assign + price-preview service.
 * All queries tenant-scoped by businessId.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import { resolvePrice } from './pricing-resolver.js'
import type { TierEntry } from './pricing-resolver.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertListOwnership(businessId: string, priceListId: string) {
  const list = await prisma.priceList.findFirst({
    where: { id: priceListId, businessId, isDeleted: false },
  })
  if (!list) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Price list not found')
  return list
}

// ── Bulk assign ───────────────────────────────────────────────────────────────

export async function bulkAssignParties(
  businessId: string,
  priceListId: string,
  partyIds: string[]
) {
  await assertListOwnership(businessId, priceListId)

  // Count how many selected parties have PartyPricing overrides
  const partyPricingOverlapCount = await prisma.partyPricing.count({
    where: { partyId: { in: partyIds }, party: { businessId } },
  })

  const result = await prisma.party.updateMany({
    where: {
      id: { in: partyIds },
      businessId,
    },
    data: { priceListId },
  })

  logger.info('Bulk-assigned parties to price list', {
    businessId,
    priceListId,
    count: result.count,
  })

  return { assigned: result.count, partyPricingOverlapCount }
}

// ── Price preview ─────────────────────────────────────────────────────────────

export async function getPricePreview(businessId: string, productId: string) {
  // Verify product belongs to business
  const product = await prisma.product.findFirst({
    where: { id: productId, businessId, isDeleted: false },
    select: { id: true, name: true, salePrice: true },
  })
  if (!product) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Product not found')

  // Fetch all non-deleted price lists with their entries for this product
  const lists = await prisma.priceList.findMany({
    where: { businessId, isDeleted: false },
    select: {
      id: true,
      name: true,
      isDefault: true,
      entries: {
        where: { productId, isDeleted: false },
        orderBy: { minQty: 'asc' },
        select: {
          id: true,
          mode: true,
          valuePaise: true,
          percentBps: true,
          fixedOffPaise: true,
          minQty: true,
          maxQty: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return lists.map((list) => {
    const tierEntries: TierEntry[] = list.entries.map((e) => ({
      id: e.id,
      mode: e.mode as TierEntry['mode'],
      valuePaise: e.valuePaise,
      percentBps: e.percentBps,
      fixedOffPaise: e.fixedOffPaise,
      minQty: e.minQty,
      maxQty: e.maxQty,
    }))

    // Resolve price at qty=1 for each entry (representative preview)
    const entries = list.entries.map((e) => {
      const resolved = resolvePrice({
        manualOverridePaise: null,
        partyPricing: null,
        tier: { entries: tierEntries },
        productSalePrice: product.salePrice,
        qty: 1,
      })
      return {
        entryId: e.id,
        minQty: e.minQty,
        maxQty: e.maxQty,
        mode: e.mode,
        valuePaise: e.valuePaise,
        percentBps: e.percentBps,
        fixedOffPaise: e.fixedOffPaise,
        resolvedPaiseAtQty1: resolved.resolvedPaise,
        source: resolved.source,
      }
    })

    return {
      priceListId: list.id,
      listName: list.name,
      isDefault: list.isDefault,
      entries,
    }
  })
}
