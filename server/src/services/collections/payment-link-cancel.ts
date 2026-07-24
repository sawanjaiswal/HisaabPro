/**
 * Payment Link — cancel helper.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, conflictError } from '../../lib/errors.js'
import { cancelLink } from '../razorpay/payment-link.client.js'
import logger from '../../lib/logger.js'
import { createAuditEntry } from '../settings/audit.js'

export async function cancelPaymentLink(
  businessId: string,
  linkId: string,
  userId: string,
) {
  const link = await prisma.paymentLink.findFirst({
    where: { id: linkId, businessId, isDeleted: false },
  })
  if (!link) throw notFoundError('PaymentLink')

  if (link.status !== 'CREATED') {
    throw conflictError(
      `Cannot cancel a payment link in status ${link.status}. Only CREATED links can be cancelled.`,
    )
  }

  // Cancel on Razorpay if we have a real link id
  if (link.razorpayLinkId) {
    await cancelLink(link.razorpayLinkId).catch((err: Error & { razorpayCode?: string }) => {
      // F-26: if Razorpay says the link was already paid, surface a 409 so the
      // caller knows — marking our row CANCELLED while customer already paid would
      // lose the payment from our records.
      if (err.razorpayCode === 'BAD_REQUEST_ERROR' && err.message.includes('already paid')) {
        throw conflictError(
          'Payment link has already been paid. Cancellation not allowed.',
        )
      }
      logger.warn('payment_link.cancel_rzp_error', {
        linkId,
        razorpayLinkId: link.razorpayLinkId,
        message: err.message,
      })
      // Non-fatal for other errors: Razorpay may have already expired/cancelled it
    })
  }

  const updated = await prisma.$transaction(async (tx) => {
    const upd = await tx.paymentLink.update({
      where: { id: linkId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        updatedBy: userId,
      },
    })

    await createAuditEntry({
      businessId,
      action: 'PAYMENT_LINK_CANCELLED',
      entityType: 'PaymentLink',
      entityId: linkId,
      entityLabel: link.razorpayLinkId ?? linkId,
      userId,
    }, tx)

    return upd
  })

  logger.info('payment_link.cancelled', { linkId })
  return updated
}
