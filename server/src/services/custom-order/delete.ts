/**
 * Custom Order Service — softDeleteCustomOrder
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'

export async function softDeleteCustomOrder(
  businessId: string,
  orderId: string,
  userId: string
) {
  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId },
    select: { id: true, status: true, invoiceId: true, isDeleted: true },
  })
  if (!order) throw notFoundError('CustomOrder')

  // Idempotent: already deleted → return success
  if (order.isDeleted) {
    return { id: orderId, isDeleted: true }
  }

  // Cannot delete an order that is invoiced (would strand the invoice link)
  if (order.status === 'INVOICED' && order.invoiceId !== null) {
    throw validationError('Cannot delete an invoiced order — cancel the invoice first')
  }

  await prisma.customOrder.update({
    where: { id: orderId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
    },
  })

  return { id: orderId, isDeleted: true }
}
