/**
 * Custom Order Service — createCustomOrder
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { generateNextNumber } from '../document-number.service.js'
import type { CreateCustomOrderInput } from '../../schemas/custom-order.schemas.js'
import { CUSTOM_ORDER_DETAIL_SELECT } from './selects.js'
import { recomputeTotals } from './helpers.js'
import logger from '../../lib/logger.js'

export async function createCustomOrder(
  businessId: string,
  userId: string,
  data: CreateCustomOrderInput
) {
  // Idempotency: if clientId already exists for this business, return existing
  if (data.clientId) {
    const existing = await prisma.customOrder.findFirst({
      where: { clientId: data.clientId, businessId, isDeleted: false },
      select: CUSTOM_ORDER_DETAIL_SELECT,
    })
    if (existing) {
      logger.info('CustomOrder clientId replay — returning existing', {
        clientId: data.clientId, businessId,
      })
      return existing
    }
  }

  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId, isActive: true },
    select: { id: true },
  })
  if (!party) throw notFoundError('Party')

  const orderDiscountPaise = data.discountPaise ?? 0
  const itemsWithTotals = data.items.map((item, i) => {
    const qty = parseFloat(item.quantity)
    const itemDiscount = item.discountPaise ?? 0
    const totalPaise = Math.max(0, Math.round(qty * item.ratePaise) - itemDiscount)
    return {
      sortOrder: i,
      productId: item.productId ?? null,
      description: item.description,
      spec: item.spec ?? Prisma.JsonNull,
      quantity: item.quantity,
      ratePaise: item.ratePaise,
      discountPaise: itemDiscount,
      totalPaise,
    }
  })

  const { subtotalPaise, totalPaise } = recomputeTotals(
    itemsWithTotals.map(it => ({
      quantity: it.quantity,
      ratePaise: it.ratePaise,
      discountPaise: it.discountPaise,
    })),
    orderDiscountPaise
  )

  const result = await prisma.$transaction(async (tx) => {
    const numberData = await generateNextNumber(tx, businessId, 'CUSTOM_ORDER', new Date())

    const order = await tx.customOrder.create({
      data: {
        businessId,
        partyId: data.partyId,
        title: data.title,
        notes: data.notes ?? null,
        deliveryAt: data.deliveryAt ? new Date(data.deliveryAt) : null,
        deliverySlot: data.deliverySlot ?? null,
        deliveryAddress: data.deliveryAddress ?? null,
        subtotalPaise,
        discountPaise: orderDiscountPaise,
        totalPaise,
        balancePaise: totalPaise,
        orderNumber: numberData.documentNumber,
        sequenceNumber: numberData.sequenceNumber,
        financialYear: numberData.financialYear,
        clientId: data.clientId ?? null,
        createdBy: userId,
        items: {
          createMany: { data: itemsWithTotals },
        },
      },
      select: CUSTOM_ORDER_DETAIL_SELECT,
    })

    return order
  })

  return result
}
