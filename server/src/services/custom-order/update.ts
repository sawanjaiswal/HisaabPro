/**
 * Custom Order Service — updateCustomOrder
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { UpdateCustomOrderInput } from '../../schemas/custom-order.schemas.js'
import { CUSTOM_ORDER_DETAIL_SELECT } from './selects.js'
import { recomputeTotals } from './helpers.js'

export async function updateCustomOrder(
  businessId: string,
  orderId: string,
  userId: string,
  data: UpdateCustomOrderInput
) {
  const existing = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: false },
    select: { id: true, status: true, discountPaise: true },
  })
  if (!existing) throw notFoundError('CustomOrder')

  if (existing.status === 'INVOICED') {
    throw validationError('Cannot edit an invoiced order')
  }
  if (existing.status === 'CANCELLED') {
    throw validationError('Cannot edit a cancelled order')
  }

  if (data.partyId) {
    const party = await prisma.party.findFirst({
      where: { id: data.partyId, businessId, isActive: true },
      select: { id: true },
    })
    if (!party) throw notFoundError('Party')
  }

  const result = await prisma.$transaction(async (tx) => {
    let subtotalPaise: number | undefined
    let totalPaise: number | undefined
    let balancePaise: number | undefined

    if (data.items) {
      const orderDiscount = data.discountPaise ?? existing.discountPaise
      const itemsWithTotals = data.items.map((item, i) => {
        const qty = parseFloat(item.quantity!)
        const itemDiscount = item.discountPaise ?? 0
        const itemTotal = Math.max(0, Math.round(qty * item.ratePaise!) - itemDiscount)
        return {
          sortOrder: i,
          productId: item.productId ?? null,
          description: item.description!,
          spec: item.spec ?? Prisma.JsonNull,
          quantity: item.quantity!,
          ratePaise: item.ratePaise!,
          discountPaise: itemDiscount,
          totalPaise: itemTotal,
        }
      })

      const totals = recomputeTotals(
        itemsWithTotals.map(it => ({
          quantity: it.quantity,
          ratePaise: it.ratePaise,
          discountPaise: it.discountPaise,
        })),
        orderDiscount
      )
      subtotalPaise = totals.subtotalPaise
      totalPaise = totals.totalPaise

      // Recompute balance: totalPaise - current advancePaise
      const orderRow = await tx.customOrder.findUniqueOrThrow({
        where: { id: orderId },
        select: { advancePaise: true },
      })
      balancePaise = Math.max(0, totalPaise - orderRow.advancePaise)

      await tx.customOrderItem.deleteMany({ where: { customOrderId: orderId } })
      await tx.customOrderItem.createMany({
        data: itemsWithTotals.map(it => ({ ...it, customOrderId: orderId })),
      })
    }

    const updated = await tx.customOrder.update({
      where: { id: orderId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.partyId !== undefined && { partyId: data.partyId }),
        ...(data.deliveryAt !== undefined && {
          deliveryAt: data.deliveryAt ? new Date(data.deliveryAt) : null,
        }),
        ...(data.deliverySlot !== undefined && { deliverySlot: data.deliverySlot }),
        ...(data.deliveryAddress !== undefined && { deliveryAddress: data.deliveryAddress }),
        ...(data.discountPaise !== undefined && { discountPaise: data.discountPaise }),
        ...(subtotalPaise !== undefined && { subtotalPaise }),
        ...(totalPaise !== undefined && { totalPaise }),
        ...(balancePaise !== undefined && { balancePaise }),
        updatedBy: userId,
      },
      select: CUSTOM_ORDER_DETAIL_SELECT,
    })

    return updated
  })

  return result
}
