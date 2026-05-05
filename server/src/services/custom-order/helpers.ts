/**
 * Custom Order Service — STATUS_TRANSITIONS, assertTransitionAllowed,
 * requireCustomOrder, recomputeTotals, recomputeAdvanceAndBalance
 */

import { type CustomOrderStatus } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { CUSTOM_ORDER_DETAIL_SELECT } from './selects.js'

/** Valid status transitions: Map<from, Set<to>> */
export const STATUS_TRANSITIONS = new Map<CustomOrderStatus, Set<CustomOrderStatus>>([
  ['RECEIVED',     new Set<CustomOrderStatus>(['IN_PRODUCTION', 'READY', 'CANCELLED'])],
  ['IN_PRODUCTION', new Set<CustomOrderStatus>(['RECEIVED', 'READY', 'CANCELLED'])],
  ['READY',        new Set<CustomOrderStatus>(['IN_PRODUCTION', 'DELIVERED', 'CANCELLED'])],
  ['DELIVERED',    new Set<CustomOrderStatus>(['READY', 'CANCELLED'])],
  ['INVOICED',     new Set<CustomOrderStatus>()],
  ['CANCELLED',    new Set<CustomOrderStatus>()],
])

export function assertTransitionAllowed(from: CustomOrderStatus, to: CustomOrderStatus): void {
  const allowed = STATUS_TRANSITIONS.get(from)
  if (!allowed || !allowed.has(to)) {
    throw validationError(
      `Invalid transition from ${from} to ${to}`,
      { code: 'INVALID_TRANSITION', from, to }
    )
  }
}

export async function requireCustomOrder(
  businessId: string,
  orderId: string,
  extraSelect?: Record<string, unknown>
) {
  const select = extraSelect
    ? { ...CUSTOM_ORDER_DETAIL_SELECT, ...extraSelect }
    : CUSTOM_ORDER_DETAIL_SELECT

  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: false },
    select,
  })
  if (!order) throw notFoundError('CustomOrder')
  return order
}

/** Compute subtotal + total from items (discount applied per-item, not order-level). */
export function recomputeTotals(
  items: Array<{ quantity: string; ratePaise: number; discountPaise: number }>,
  orderDiscountPaise: number
): { subtotalPaise: number; totalPaise: number } {
  const subtotalPaise = items.reduce((sum, it) => {
    const qty = parseFloat(it.quantity)
    const itemTotal = Math.round(qty * it.ratePaise) - it.discountPaise
    return sum + Math.max(0, itemTotal)
  }, 0)
  const totalPaise = Math.max(0, subtotalPaise - orderDiscountPaise)
  return { subtotalPaise, totalPaise }
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Recompute advancePaise + balancePaise from advance rows inside a transaction. */
export async function recomputeAdvanceAndBalance(
  orderId: string,
  tx: TxClient
): Promise<void> {
  const agg = await tx.customOrderAdvance.aggregate({
    where: { customOrderId: orderId },
    _sum: { amountPaise: true },
  })
  const advancePaise = agg._sum.amountPaise ?? 0

  const order = await tx.customOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { totalPaise: true },
  })
  const balancePaise = Math.max(0, order.totalPaise - advancePaise)

  await tx.customOrder.update({
    where: { id: orderId },
    data: { advancePaise, balancePaise },
  })
}
