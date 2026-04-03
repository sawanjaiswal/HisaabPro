/**
 * Payment creation
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { PAYMENT_DETAIL_SELECT } from './selects.js'
import type { CreatePaymentInput } from '../../schemas/payment.schemas.js'

export async function createPayment(
  businessId: string,
  userId: string,
  data: CreatePaymentInput
) {
  // Validate party
  const party = await prisma.party.findFirst({
    where: { id: data.partyId, businessId, isActive: true },
    select: { id: true },
  })
  if (!party) throw notFoundError('Party')

  // Validate allocations sum <= amount
  const allocTotal = data.allocations.reduce((sum, a) => sum + a.amount, 0)
  if (allocTotal > data.amount) {
    throw validationError('Total allocations exceed payment amount')
  }

  // Validate allocation invoices exist and belong to business
  if (data.allocations.length > 0) {
    const invoiceIds = data.allocations.map(a => a.invoiceId)
    const invoices = await prisma.document.findMany({
      where: { id: { in: invoiceIds }, businessId, status: { in: ['SAVED', 'SHARED'] } },
      select: { id: true },
    })
    const foundIds = new Set(invoices.map(i => i.id))
    for (const a of data.allocations) {
      if (!foundIds.has(a.invoiceId)) throw notFoundError(`Invoice ${a.invoiceId}`)
    }
  }

  // Calculate discount
  let discountAmount = 0
  if (data.discount) {
    discountAmount = data.discount.type === 'PERCENTAGE'
      ? Math.round(data.amount * data.discount.value / 100)
      : Math.round(data.discount.value)
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        businessId,
        type: data.type,
        partyId: data.partyId,
        amount: data.amount,
        date: new Date(data.date),
        mode: data.mode,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
        offlineId: data.offlineId || null,
        createdBy: userId,
      },
    })

    // Create allocations
    if (data.allocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: data.allocations.map(a => ({
          paymentId: payment.id,
          invoiceId: a.invoiceId,
          amount: a.amount,
        })),
      })

      // Update invoice balanceDue and paidAmount (parallel — each invoiceId is distinct)
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

    // Create discount
    if (data.discount) {
      await tx.paymentDiscount.create({
        data: {
          paymentId: payment.id,
          type: data.discount.type,
          value: data.discount.value,
          calculatedAmount: discountAmount,
          reason: data.discount.reason || null,
        },
      })
    }

    // Update party outstanding
    // PAYMENT_IN reduces receivable (outstanding goes down)
    // PAYMENT_OUT reduces payable (outstanding goes up)
    const effectiveAmount = data.amount + discountAmount
    const outstandingDelta = data.type === 'PAYMENT_IN'
      ? -effectiveAmount
      : effectiveAmount
    await tx.party.update({
      where: { id: data.partyId },
      data: {
        outstandingBalance: { increment: outstandingDelta },
        lastTransactionAt: new Date(),
      },
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}
