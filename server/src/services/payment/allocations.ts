/**
 * Payment allocation management
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { assertAllocationsPayable } from './allocation-guard.js'
import { PAYMENT_DETAIL_SELECT, mapPaymentDiscount } from './selects.js'
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

  // The rows below are reversed first, so what they hold is capacity this
  // payment gets back. Same guard as create: the old check here only compared
  // the total against the payment, so an allocation could overpay an invoice —
  // or land on another business's invoice entirely, since nothing scoped the id.
  await assertAllocationsPayable(
    businessId,
    data.allocations,
    payment.amount,
    new Map(payment.allocations.map(a => [a.invoiceId, a.amount])),
  )

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

    const detail = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
    return { ...detail, discount: mapPaymentDiscount(detail.discount) }
  })
}
