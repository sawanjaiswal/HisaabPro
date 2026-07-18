/**
 * Payment update, soft-delete, restore
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import { PAYMENT_DETAIL_SELECT, mapPaymentDiscount } from './selects.js'
import type { UpdatePaymentInput } from '../../schemas/payment.schemas.js'
import { paymentTypeDirection } from '../../lib/payment-types.js'
import type { PaymentType } from '../../../../shared/enums.js'
import { bumpVersionOrConflict } from '../../lib/optimistic-lock.js'
import { postPayment, reverseSourceEntry } from '../accounting/posting/index.js'


export async function updatePayment(
  businessId: string,
  paymentId: string,
  userId: string,
  data: UpdatePaymentInput,
  expectedVersion?: number
) {
  const existing = await prisma.payment.findFirst({
    where: { id: paymentId, businessId, isDeleted: false },
    select: { id: true, amount: true, partyId: true, type: true },
  })
  if (!existing) throw notFoundError('Payment')

  return prisma.$transaction(async (tx) => {
    // #150 optimistic lock — atomic version bump inside the same txn as the write.
    await bumpVersionOrConflict(tx, 'payment', paymentId, businessId, expectedVersion)

    // If amount changed, update party outstanding via paymentTypeDirection
    // (M6 v2.1). PAYROLL_* yields 0 → never touches customer outstanding.
    if (data.amount && data.amount !== existing.amount) {
      const amountDelta = data.amount - existing.amount
      // `existing.type` is Prisma `String` (not native enum) — narrow to the
      // literal union. Safe because writes are Zod-validated; reads inherit
      // the validated state.
      const outstandingDelta = paymentTypeDirection(existing.type as PaymentType) * amountDelta
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

    // S1 — GL: reverse the original JE and re-post fresh on any amount/mode change.
    await reverseSourceEntry(tx, businessId, 'PAYMENT', paymentId, 'Payment edited')
    const fresh = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { id: true, type: true, mode: true, amount: true, partyId: true, referenceNumber: true, date: true },
    })
    await postPayment(tx, { businessId, userId, payment: fresh })

    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'Payment',
        entityId: paymentId,
        entityLabel: (data.notes ?? '').slice(0, 120) || null,
        userId,
        action: 'UPDATE',
        changes: data as Record<string, unknown>,
      },
    })

    const detail = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
    return { ...detail, discount: mapPaymentDiscount(detail.discount) }
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

    // Reverse outstanding — apply NEGATIVE of original direction so the prior
    // delta is undone. PAYROLL_* yields 0 (untouched). M6 v2.1.
    const discountAmount = payment.discount?.calculatedAmount || 0
    const effectiveAmount = payment.amount + discountAmount
    const reverseDelta = -paymentTypeDirection(payment.type as PaymentType) * effectiveAmount
    await tx.party.update({
      where: { id: payment.partyId },
      data: { outstandingBalance: { increment: reverseDelta } },
    })

    // S1 — GL: VOID the payment's posted journal entry (reverses balances).
    await reverseSourceEntry(tx, businessId, 'PAYMENT', paymentId, 'Payment deleted')

    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: userId,
      },
      select: { id: true, deletedAt: true },
    })

    await tx.auditLog.create({
      data: {
        businessId,
        entityType: 'Payment',
        entityId: paymentId,
        entityLabel: null,
        userId,
        action: 'DELETE',
        changes: { type: payment.type, amount: payment.amount, partyId: payment.partyId, softDeleted: true },
      },
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

    // Re-apply outstanding via paymentTypeDirection (M6 v2.1). PAYROLL_*
    // yields 0 → never touches customer outstanding (symmetric with delete).
    const discountAmount = payment.discount?.calculatedAmount || 0
    const effectiveAmount = payment.amount + discountAmount
    const outstandingDelta = paymentTypeDirection(payment.type as PaymentType) * effectiveAmount
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

    // S1 — GL: re-post a fresh JE (the delete-time JE stays VOID).
    const fresh = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { id: true, type: true, mode: true, amount: true, partyId: true, referenceNumber: true, date: true },
    })
    await postPayment(tx, { businessId, userId, payment: fresh })

    return tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_DETAIL_SELECT,
    })
  })
}
