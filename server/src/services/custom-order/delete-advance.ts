/**
 * Custom Order Service — deleteAdvance (hard delete, pre-invoice only)
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { CUSTOM_ORDER_DETAIL_SELECT } from './selects.js'
import { recomputeAdvanceAndBalance } from './helpers.js'

export async function deleteAdvance(
  businessId: string,
  orderId: string,
  advanceId: string,
  userId: string
) {
  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: false },
    select: { id: true, status: true },
  })
  if (!order) throw notFoundError('CustomOrder')

  if (order.status === 'INVOICED') {
    throw validationError(
      'Cannot delete advance on an invoiced order — it has been converted to a payment',
      { code: 'ORDER_ALREADY_INVOICED' }
    )
  }
  if (order.status === 'CANCELLED') {
    throw validationError('Cannot delete advance on a cancelled order')
  }

  const advance = await prisma.customOrderAdvance.findFirst({
    where: { id: advanceId, customOrderId: orderId },
    select: { id: true },
  })
  if (!advance) throw notFoundError('CustomOrderAdvance')

  // Suppress unused-variable warning — userId is used for audit trail in future
  void userId

  await prisma.$transaction(async (tx) => {
    await tx.customOrderAdvance.delete({ where: { id: advanceId } })
    await recomputeAdvanceAndBalance(orderId, tx)
  })

  const updated = await prisma.customOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: CUSTOM_ORDER_DETAIL_SELECT,
  })

  return updated
}
