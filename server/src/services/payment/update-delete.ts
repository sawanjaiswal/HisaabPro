/**
 * Payment update, soft-delete, restore
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { PAYMENT_DETAIL_SELECT } from './selects.js'
import type { UpdatePaymentInput } from '../../schemas/payment.schemas.js'

export async function updatePayment(
  businessId: string,
  paymentId: string,
  userId: string,
  data: UpdatePaymentInput
) {
  const existing = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: { id: true, amount: true, partyId: true, type: true },
  })
  if (!existing) throw notFoundError('Payment')

  return prisma.$transaction(async (tx) => {
    // If amount changed, update party outstanding
    if (data.amount && data.amount !== existing.amount) {
      const amountDelta = data.amount - existing.amount
      const outstandingDelta = existing.type === 'PAYMENT_IN'
        ? -amountDelta
        : amountDelta
      await tx.party.update({
        where: { id: existing.partyId },
        data: { outstandingBalance: { increment: outstandingDelta } },
      })
    }

    const updateData: Record<string, unknown> = { updatedBy: userId }
    if (data.amount !== undefined) updateData.amount = data.amount
    if (data.date) updateData.date = new Date(data.date)
    if (data.mode) updateData.mode = data.mode
    if (data.referenceNumber !== undefined) updateData.referenceNumber = data.referenceNumber
    if (data.notes !== undefined) updateData.notes = data.notes

    await tx.payment.update({
      where: { id: paymentId },
      data: updateData,
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}

export async function deletePayment(businessId: string, paymentId: string, userId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: {
      id: true, type: true, partyId: true, amount: true,
      allocations: { select: { invoiceId: true, amount: true } },
      discount: { select: { calculatedAmount: true } },
    },
  })
  if (!payment) throw notFoundError('Payment')

  return prisma.$transaction(async (tx) => {
    // Reverse allocations (parallel — each invoiceId is distinct)
    await Promise.all(payment.allocations.map(alloc =>
      tx.document.update({
        where: { id: alloc.invoiceId },
        data: {
          paidAmount: { decrement: alloc.amount },
          balanceDue: { increment: alloc.amount },
        },
      })
    ))

    // Reverse outstanding
    const discountAmount = payment.discount?.calculatedAmount || 0
    const effectiveAmount = payment.amount + discountAmount
    const reverseDelta = payment.type === 'PAYMENT_IN'
      ? effectiveAmount
      : -effectiveAmount
    await tx.party.update({
      where: { id: payment.partyId },
      data: { outstandingBalance: { increment: reverseDelta } },
    })

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: userId,
      },
      select: { id: true, deletedAt: true },
    })

    return { id: updated.id, deletedAt: updated.deletedAt }
  })
}

export async function restorePayment(businessId: string, paymentId: string, userId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: true },
    select: {
      id: true, type: true, partyId: true, amount: true,
      allocations: { select: { invoiceId: true, amount: true } },
      discount: { select: { calculatedAmount: true } },
    },
  })
  if (!payment) throw notFoundError('Payment')

  return prisma.$transaction(async (tx) => {
    // Re-apply allocations (parallel — each invoiceId is distinct)
    await Promise.all(payment.allocations.map(alloc =>
      tx.document.update({
        where: { id: alloc.invoiceId },
        data: {
          paidAmount: { increment: alloc.amount },
          balanceDue: { decrement: alloc.amount },
        },
      })
    ))

    // Re-apply outstanding
    const discountAmount = payment.discount?.calculatedAmount || 0
    const effectiveAmount = payment.amount + discountAmount
    const outstandingDelta = payment.type === 'PAYMENT_IN'
      ? -effectiveAmount
      : effectiveAmount
    await tx.party.update({
      where: { id: payment.partyId },
      data: { outstandingBalance: { increment: outstandingDelta } },
    })

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        isDeleted: false,
        deletedAt: null,
        updatedBy: userId,
      },
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}
