/**
 * Custom Order Service — recycle bin: listDeletedOrders, restoreOrder, permanentDeleteOrder
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { CUSTOM_ORDER_LIST_SELECT } from './selects.js'

export async function listDeletedOrders(businessId: string) {
  const items = await prisma.customOrder.findMany({
    where: { businessId, isDeleted: true },
    select: CUSTOM_ORDER_LIST_SELECT,
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  return { items }
}

export async function restoreOrder(businessId: string, orderId: string) {
  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: true },
    select: { id: true },
  })
  if (!order) throw notFoundError('CustomOrder')

  await prisma.customOrder.update({
    where: { id: orderId },
    data: { isDeleted: false, deletedAt: null, deletedBy: null },
  })

  return { id: orderId, isDeleted: false }
}

export async function permanentDeleteOrder(businessId: string, orderId: string) {
  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId },
    select: { id: true, isDeleted: true, invoiceId: true },
  })
  if (!order) throw notFoundError('CustomOrder')
  if (!order.isDeleted) {
    throw validationError('Order must be soft-deleted before permanent deletion')
  }
  if (order.invoiceId) {
    throw validationError('Cannot permanently delete an invoiced order')
  }

  await prisma.customOrder.delete({ where: { id: orderId } })
  return { id: orderId, deleted: true }
}
