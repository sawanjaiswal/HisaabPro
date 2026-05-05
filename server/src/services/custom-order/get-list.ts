/**
 * Custom Order Service — getCustomOrder + listCustomOrders
 */

import { prisma } from '../../lib/prisma.js'
import type { ListCustomOrdersQuery } from '../../schemas/custom-order.schemas.js'
import { CUSTOM_ORDER_LIST_SELECT, CUSTOM_ORDER_DETAIL_SELECT } from './selects.js'
import { notFoundError } from '../../lib/errors.js'

export async function getCustomOrder(businessId: string, orderId: string) {
  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: false },
    select: CUSTOM_ORDER_DETAIL_SELECT,
  })
  if (!order) throw notFoundError('CustomOrder')
  return order
}

export async function listCustomOrders(businessId: string, query: ListCustomOrdersQuery) {
  const {
    status, partyId, q, deliveryFrom, deliveryTo, hasBalance, cursor, limit,
  } = query

  const where: Record<string, unknown> = {
    businessId,
    isDeleted: false,
  }

  if (status) where.status = status
  if (partyId) where.partyId = partyId

  if (hasBalance === true) {
    where.balancePaise = { gt: 0 }
  }

  if (deliveryFrom || deliveryTo) {
    where.deliveryAt = {
      ...(deliveryFrom && { gte: new Date(deliveryFrom) }),
      ...(deliveryTo && { lte: new Date(deliveryTo) }),
    }
  }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
      { party: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }

  // Cursor pagination on (updatedAt, id)
  if (cursor) {
    const [cursorUpdatedAt, cursorId] = cursor.split('_')
    where.AND = [
      {
        OR: [
          { updatedAt: { lt: new Date(cursorUpdatedAt) } },
          { updatedAt: new Date(cursorUpdatedAt), id: { lt: cursorId } },
        ],
      },
    ]
  }

  const items = await prisma.customOrder.findMany({
    where,
    select: CUSTOM_ORDER_LIST_SELECT,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  })

  let nextCursor: string | null = null
  if (items.length > limit) {
    const last = items[limit - 1]
    nextCursor = `${last.updatedAt.toISOString()}_${last.id}`
    items.splice(limit)
  }

  return { items, nextCursor }
}
