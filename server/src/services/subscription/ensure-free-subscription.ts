/**
 * Ensure Free Subscription — guarantee every business has a Subscription row.
 * Called at business-create time and as a fallback guard in routes.
 *
 * Idempotent: if row already exists, returns existing without modification.
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'

export interface EnsureResult {
  subscriptionId: string
  created: boolean
  planTier: string
}

/**
 * Ensure the business has a Subscription row.
 * If missing, creates FREE tier with NONE state.
 */
export async function ensureFreeSubscription(businessId: string): Promise<EnsureResult> {
  const existing = await prisma.subscription.findUnique({
    where: { businessId },
    select: { id: true, planTier: true },
  })

  if (existing) {
    return { subscriptionId: existing.id, created: false, planTier: existing.planTier }
  }

  const created = await prisma.subscription.create({
    data: {
      businessId,
      planTier: 'FREE',
      status: 'ACTIVE',
      startDate: new Date(),
      subscriptionState: 'NONE',
      autoRenew: false,
      paymentMethod: 'MANUAL',
    },
    select: { id: true, planTier: true },
  })

  logger.info('subscription.free_created', { businessId, subscriptionId: created.id })

  return { subscriptionId: created.id, created: true, planTier: created.planTier }
}
