/**
 * Activate subscription from confirmed mandate.
 */

import { prisma } from '../../../lib/prisma.js'
import logger from '../../../lib/logger.js'
import { applySubscriptionEvent } from '../subscription.writer.js'
import type { SubscriptionPlanTier } from '../subscription.types.js'
import { PROMO_FIRST_PERIOD_DAYS } from './token-engine.constants.js'

export async function activateFromMandate(mandateId: string): Promise<void> {
  const mandate = await prisma.upiMandate.findUnique({
    where: { id: mandateId },
    include: { subscription: true },
  })
  if (!mandate || mandate.status !== 'ACTIVE') return

  const businessId = mandate.businessId
  const subscriptionId = mandate.subscriptionId
  const planTier = (mandate.planTier || mandate.subscription.planTier || 'PRO') as SubscriptionPlanTier

  const now = new Date()
  const periodEnd = new Date(now.getTime() + PROMO_FIRST_PERIOD_DAYS * 24 * 60 * 60 * 1000)

  try {
    await applySubscriptionEvent({
      businessId,
      subscriptionId,
      trigger: 'payment.captured.promo',
      actorType: 'WEBHOOK',
      planTier,
      payload: {
        mandateId: mandate.id,
        autoRenew: true,
        paymentMethod: 'UPI_AUTOPAY',
        nextBillingAt: periodEnd.toISOString(),
      },
    })

    logger.info('Subscription activated from confirmed token mandate', {
      businessId,
      mandateId,
      subscriptionId,
      planTier,
    })
  } catch (err) {
    logger.error('Failed to activate subscription from mandate', {
      businessId,
      mandateId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
