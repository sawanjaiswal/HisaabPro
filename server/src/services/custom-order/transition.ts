/**
 * Custom Order Service — transitionCustomOrder (server-enforced state machine)
 */

import { type CustomOrderStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { assertTransitionAllowed } from './helpers.js'
import { CUSTOM_ORDER_DETAIL_SELECT } from './selects.js'

export async function transitionCustomOrder(
  businessId: string,
  orderId: string,
  userId: string,
  toStatus: CustomOrderStatus,
  reason?: string
) {
  // INVOICED is only reachable via convert-to-invoice, not this endpoint
  if (toStatus === 'INVOICED') {
    throw validationError('Use convert-to-invoice to mark an order as INVOICED')
  }

  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: false },
    select: { id: true, status: true },
  })
  if (!order) throw notFoundError('CustomOrder')

  // No-op if already at target status
  if (order.status === toStatus) {
    const current = await prisma.customOrder.findUniqueOrThrow({
      where: { id: orderId },
      select: CUSTOM_ORDER_DETAIL_SELECT,
    })
    return current
  }

  assertTransitionAllowed(order.status as CustomOrderStatus, toStatus)

  const now = new Date()
  const updated = await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      status: toStatus,
      updatedBy: userId,
      ...(toStatus === 'IN_PRODUCTION' && { productionStartedAt: now }),
      ...(toStatus === 'READY' && { readyAt: now }),
      ...(toStatus === 'DELIVERED' && { deliveredAt: now }),
      ...(toStatus === 'CANCELLED' && {
        cancelledAt: now,
        cancelReason: reason ?? null,
      }),
    },
    select: CUSTOM_ORDER_DETAIL_SELECT,
  })

  return updated
}
