/**
 * Custom Order Service — recordAdvance
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { RecordAdvanceInput } from '../../schemas/custom-order.schemas.js'
import { CUSTOM_ORDER_DETAIL_SELECT } from './selects.js'
import { recomputeAdvanceAndBalance } from './helpers.js'

export async function recordAdvance(
  businessId: string,
  orderId: string,
  userId: string,
  input: RecordAdvanceInput
) {
  const order = await prisma.customOrder.findFirst({
    where: { id: orderId, businessId, isDeleted: false },
    select: { id: true, status: true },
  })
  if (!order) throw notFoundError('CustomOrder')

  if (order.status === 'INVOICED') {
    throw validationError(
      'Cannot record advance on an invoiced order — use payments on the invoice instead',
      { code: 'ORDER_ALREADY_INVOICED' }
    )
  }
  if (order.status === 'CANCELLED') {
    throw validationError('Cannot record advance on a cancelled order')
  }

  await prisma.$transaction(async (tx) => {
    await tx.customOrderAdvance.create({
      data: {
        customOrderId: orderId,
        amountPaise: input.amountPaise,
        method: input.method,
        reference: input.reference ?? null,
        receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
        notes: input.notes ?? null,
        createdBy: userId,
      },
    })

    await recomputeAdvanceAndBalance(orderId, tx)
  })

  const updated = await prisma.customOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: CUSTOM_ORDER_DETAIL_SELECT,
  })

  return updated
}
