/**
 * Webhook handler: payment_link.paid
 *
 * Implements MB-1 (replay dedupe), MB-2 (tenant trust), MB-5 (amount gate).
 * All writes happen in one Prisma transaction.
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { markPtpKept } from './promise-to-pay-eval.service.js'
import { invalidateAgingCache } from './aging.service.js'
import { notificationManager } from '../notifications/notification-manager.js'
import { formatPaise } from '../notifications/notification-template.service.js'

interface RazorpayPaymentLinkPaidEvent {
  id: string                        // Razorpay event id (used for MB-1 dedupe)
  event: string
  payload: {
    payment_link: {
      entity: {
        id: string                   // razorpayLinkId
        amount: number               // paise
        status: string
      }
    }
    payment: {
      entity: {
        id: string                   // razorpay_payment_id
        amount: number               // paise actually collected
        method: string
      }
    }
  }
}

/**
 * Process payment_link.paid webhook.
 *
 * Returns { noOp: true } on duplicate event id (MB-1).
 * Resolves tenant from PaymentLink row, never from payload notes (MB-2).
 */
export async function processWebhookPaymentLinkPaid(
  event: RazorpayPaymentLinkPaidEvent,
  rawPayload: unknown,
) {
  const rzLinkId = event.payload.payment_link.entity.id
  const rzPaymentId = event.payload.payment.entity.id
  const paidAmountPaise = event.payload.payment.entity.amount
  const rzMethod = event.payload.payment.entity.method

  // MB-2: Resolve businessId from our DB, not from payload notes
  const link = await prisma.paymentLink.findUnique({
    where: { razorpayLinkId: rzLinkId },
    select: {
      id: true,
      businessId: true,
      invoiceId: true,
      partyId: true,
      amountPaise: true,
      status: true,
      createdBy: true,   // use as payment.createdBy (system webhook proxy)
    },
  })

  if (!link) {
    logger.warn('payment_link.webhook.link_not_found', { rzLinkId, eventId: event.id })
    // Acknowledge to Razorpay; nothing to process
    return { noOp: true, reason: 'link_not_found' }
  }

  if (link.status === 'PAID') {
    logger.info('payment_link.webhook.already_paid', { linkId: link.id })
    return { noOp: true, reason: 'already_paid' }
  }

  const WEBHOOK_ACTOR = 'webhook:razorpay'
  // Use the payment link creator as the payment's createdBy (FK constraint).
  // The systemActor field in AuditLog records the true actor.
  const paymentCreatedBy = link.createdBy

  // Sentinel error class — caught below to translate into a 200 no-op
  class DuplicateEventError extends Error {
    constructor() { super('DUPLICATE_EVENT'); this.name = 'DuplicateEventError' }
  }

  let isDuplicate = false
  try {
    await prisma.$transaction(async (tx) => {
      // MB-1: Idempotency — INSERT WebhookEvent as first tx statement so a tx
      // rollback also rolls back the dedupe row, letting Razorpay retries land.
      const inserted = await tx.$executeRaw`
        INSERT INTO "WebhookEvent" ("id", "eventId", "source", "payload", "processedAt")
        VALUES (gen_random_uuid()::text, ${event.id}, 'razorpay', ${JSON.stringify(rawPayload)}::jsonb, NOW())
        ON CONFLICT ("eventId") DO NOTHING
      `
      if (inserted === 0) throw new DuplicateEventError()

      // Create Payment row — use actual paid amount (MB-5: don't trust link amount)
    const payment = await tx.payment.create({
      data: {
        businessId: link.businessId,
        type: 'PAYMENT_IN',
        partyId: link.partyId,
        amount: paidAmountPaise,
        date: new Date(),
        mode: normalizeMode(rzMethod),
        referenceNumber: rzPaymentId,
        notes: `Razorpay payment link ${rzLinkId}`,
        createdBy: paymentCreatedBy,
      },
    })

    // Allocate payment to invoice
    await tx.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceId: link.invoiceId,
        amount: paidAmountPaise,
      },
    })

    // Update invoice balanceDue + paidAmount
    await tx.document.update({
      where: { id: link.invoiceId },
      data: {
        paidAmount: { increment: paidAmountPaise },
        balanceDue: { decrement: paidAmountPaise },
      },
    })

    // Update party outstanding (payment in reduces receivable)
    // F-23: use decrement (idiomatic + avoids accidental sign bugs in review)
    await tx.party.update({
      where: { id: link.partyId },
      data: {
        outstandingBalance: { decrement: paidAmountPaise },
        lastTransactionAt: new Date(),
      },
    })

    // Mark link PAID
    await tx.paymentLink.update({
      where: { id: link.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidAmountPaise,
        lastWebhookEvent: event.id,
        lastWebhookAt: new Date(),
        updatedBy: WEBHOOK_ACTOR,
      },
    })

    // Audit log with systemActor
    await tx.auditLog.create({
      data: {
        businessId: link.businessId,
        action: 'PAYMENT_LINK_PAID',
        entityType: 'PaymentLink',
        entityId: link.id,
        entityLabel: rzLinkId,
        systemActor: WEBHOOK_ACTOR,
        changes: {
          rzPaymentId,
          paidAmountPaise,
          paymentId: payment.id,
        },
      },
    })
  })
  } catch (e) {
    if (e instanceof DuplicateEventError) {
      logger.info('payment_link.webhook.replay_skipped', { eventId: event.id })
      isDuplicate = true
    } else {
      throw e
    }
  }

  if (isDuplicate) return { noOp: true }

  logger.info('payment_link.webhook.processed', {
    linkId: link.id,
    rzPaymentId,
    paidAmountPaise,
  })

  // F-27: invalidate aging cache for this business after payment lands
  invalidateAgingCache(link.businessId)

  // Notify PAYMENT_LINK_PAID (swallowed — never blocks caller)
  notificationManager.notify('PAYMENT_LINK_PAID', {
    businessId: link.businessId, userId: link.createdBy,
    eventKey: 'PAYMENT_LINK_PAID', locale: 'en',
    vars: { amountRs: formatPaise(paidAmountPaise), rzLinkId, rzPaymentId },
    entityType: 'payment_link', entityId: link.id,
  }).catch((err) => logger.warn('notify.failed', { eventKey: 'PAYMENT_LINK_PAID', err }))

  // Hook: mark any OPEN PTP on this invoice as KEPT (MB-7 systemActor, non-blocking)
  if (link.invoiceId) {
    try {
      const openPtps = await prisma.promiseToPay.findMany({
        where: {
          businessId: link.businessId,
          invoiceId: link.invoiceId,
          status: 'OPEN',
          isDeleted: false,
        },
        select: { id: true },
      })
      // Resolve payment id once — no per-PTP lookup needed
      const newPayment = openPtps.length > 0
        ? await prisma.payment.findFirst({
            where: { businessId: link.businessId, referenceNumber: rzPaymentId },
            select: { id: true },
          })
        : null
      // F-32: run markPtpKept concurrently instead of sequentially
      if (newPayment) {
        await Promise.all(
          openPtps.map(ptp =>
            markPtpKept(link.businessId, ptp.id, newPayment.id, null, 'webhook:razorpay')
          )
        )
      }
    } catch (e) {
      logger.error('payment_link.webhook.ptp_hook_error', {
        linkId: link.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { noOp: false, linkId: link.id }
}

/** Map Razorpay method strings to our Payment.mode values (lowercase per spec). */
function normalizeMode(method: string): string {
  const m = method.toLowerCase()
  if (m === 'upi') return 'upi'
  if (m === 'card' || m === 'credit_card') return 'credit_card'
  if (m === 'netbanking') return 'bank_transfer'
  return 'other'
}
