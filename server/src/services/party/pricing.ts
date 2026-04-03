/**
 * Party pricing services.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import type { SetPricingInput } from '../../schemas/party.schemas.js'
import { requireParty } from './helpers.js'

export async function setPricing(
  businessId: string,
  partyId: string,
  data: SetPricingInput
) {
  await requireParty(businessId, partyId)

  // Upsert all pricing entries in a transaction
  const results = await prisma.$transaction(
    data.pricing.map((item) =>
      prisma.partyPricing.upsert({
        where: { partyId_productId: { partyId, productId: item.productId } },
        create: {
          partyId,
          productId: item.productId,
          price: item.price,
          minQty: item.minQty,
        },
        update: {
          price: item.price,
          minQty: item.minQty,
        },
        select: {
          id: true,
          productId: true,
          price: true,
          minQty: true,
          updatedAt: true,
        },
      })
    )
  )

  return results
}

export async function getPartyPricing(
  businessId: string,
  partyId: string,
  search?: string,
  page = 1,
  limit = 50
) {
  await requireParty(businessId, partyId)

  const skip = (page - 1) * limit

  const where: Prisma.PartyPricingWhereInput = {
    partyId,
  }

  if (search) {
    where.productId = { contains: search, mode: 'insensitive' }
  }

  const [pricing, total] = await Promise.all([
    prisma.partyPricing.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        productId: true,
        price: true,
        minQty: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.partyPricing.count({ where }),
  ])

  return {
    pricing,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
