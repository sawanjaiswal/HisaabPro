/**
 * Payment creation
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { PAYMENT_DETAIL_SELECT } from './selects.js'
import type { CreatePaymentInput } from '../../schemas/payment.schemas.js'
import { notificationManager } from '../notifications/notification-manager.js'
import { formatPaise } from '../notifications/notification-template.service.js'
import logger from '../../lib/logger.js'
import { paymentTypeDirection } from '../../lib/payment-types.js'
import { postPayment } from '../accounting/posting/index.js'

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

  const result = await prisma.$transaction(async (tx) => {
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

    // Create discount — split storage by type: FIXED → valuePaise,
    // PERCENTAGE → percentBps (basis points, 0..10000). CHECK XOR enforced
    // by `payment_discount_value_xor`. Wire shape (req.body.discount.value)
    // stays backwards-compat with FE.
    if (data.discount) {
      const isPercent = data.discount.type === 'PERCENTAGE'
      await tx.paymentDiscount.create({
        data: {
          paymentId: payment.id,
          type: data.discount.type,
          valuePaise: isPercent ? null : Math.round(data.discount.value),
          percentBps: isPercent ? Math.round(data.discount.value * 100) : null,
          calculatedAmount: discountAmount,
          reason: data.discount.reason || null,
        },
      })
    }

    // Update party outstanding via paymentTypeDirection() helper (M6 v2.1).
    // +1 = PAYMENT_OUT (raises payable), -1 = PAYMENT_IN (lowers receivable),
    //  0 = PAYROLL_OUT / PAYROLL_IN (never touches customer outstanding).
    // Public create endpoint already rejects PAYROLL_* via Zod
    // (CUSTOMER_PAYMENT_TYPES) + assertCustomerPaymentType — the 0 branch is
    // exhaustiveness-only here.
    const effectiveAmount = data.amount + discountAmount
    const outstandingDelta = paymentTypeDirection(data.type) * effectiveAmount
    await tx.party.update({
      where: { id: data.partyId },
      data: {
        outstandingBalance: { increment: outstandingDelta },
        lastTransactionAt: new Date(),
      },
    })

    // S1 — GL auto-posting: Dr Cash/Bank Cr AR (in) / Dr AP Cr Cash/Bank (out).
    await postPayment(tx, {
      businessId,
      userId,
      payment: {
        id: payment.id,
        type: data.type,
        mode: data.mode,
        amount: data.amount,
        partyId: data.partyId,
        referenceNumber: data.referenceNumber ?? null,
        date: new Date(data.date),
      },
    })

    return tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: PAYMENT_DETAIL_SELECT,
    })
  })

  if (data.type === 'PAYMENT_IN') {
    try {
      const partyName = (result as { party: { name: string } }).party.name
      await notificationManager.notify('PAYMENT_RECEIVED', {
        businessId,
        userId,
        eventKey: 'PAYMENT_RECEIVED',
        locale: 'en',
        vars: {
          partyName,
          amountRs: formatPaise(data.amount),
          mode: data.mode,
        },
        entityType: 'payment',
        entityId: result.id,
      })
    } catch (err) {
      logger.warn('notify.failed', { eventKey: 'PAYMENT_RECEIVED', err })
    }
  }

  return result
}
