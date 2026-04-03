/**
 * Payment allocation management
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { PAYMENT_DETAIL_SELECT } from './selects.js'
import type { UpdateAllocationsInput } from '../../schemas/payment.schemas.js'

export async function updateAllocations(
  businessId: string,
  paymentId: string,
  data: UpdateAllocationsInput
) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: {
      id: true, amount: true,
      allocations: { select: { id: true, invoiceId: true, amount: true } },
    },
  })
  if (!payment) throw notFoundError('Payment')

  const newAllocTotal = data.allocations.reduce((sum, a) => sum + a.amount, 0)
  if (newAllocTotal > payment.amount) {
    throw validationError('Total allocations exceed payment amount')
  }

  return prisma.$transaction(async (tx) => {
    // Reverse existing allocations (parallel — each invoiceId is distinct)
    await Promise.all(payment.allocations.map(alloc =>
      tx.document.update({
        where: { id: alloc.invoiceId },
        data: {
          paidAmount: { decrement: alloc.amount },
          balanceDue: { increment: alloc.amount },
        },
      })
    ))
    await tx.paymentAllocation.deleteMany({ where: { paymentId } })

    // Apply new allocations
    if (data.allocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: data.allocations.map(a => ({
          paymentId,
          invoiceId: a.invoiceId,
          amount: a.amount,
        })),
      })

      // Update invoice balances (parallel — each invoiceId is distinct)
      await Promise.all(data.allocations.map(alloc =>
        tx.document.update({
          where: { id: alloc.invoiceId },
          data: {
            paidAmount: { increment: alloc.amount },
            balanceDue: { decrement: alloc.amount },
          },
        })
      ))
    }

    return tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}
