/**
 * Downgrade Service — scheduled plan downgrade at period end.
 * Offline-queueable: sets pendingDowngradeTier in DB; no Razorpay call.
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import type { SubscriptionPlanTier } from './subscription.types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleDowngradeInput {
  businessId: string
  targetTier: SubscriptionPlanTier
  effectiveAt: 'period_end' | Date
}

export interface ScheduleDowngradeResult {
  subscriptionId: string
  pendingDowngradeTier: SubscriptionPlanTier
  scheduledFor: string
}

export interface CancelDowngradeResult {
  subscriptionId: string
  cleared: boolean
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Schedule a plan downgrade at period end.
 * Only sets a flag — actual downgrade applied by webhook or cron
 * when current period expires.
 */
export async function scheduleDowngrade(
  input: ScheduleDowngradeInput,
): Promise<ScheduleDowngradeResult> {
  const sub = await prisma.subscription.findUnique({
    where: { businessId: input.businessId },
    select: { id: true, planTier: true, subscriptionState: true, expiresAt: true },
  })

  if (!sub) {
    throw Object.assign(new Error('Subscription not found'), { code: 'NOT_FOUND', httpStatus: 404 })
  }

  if (sub.subscriptionState !== 'ACTIVE') {
    throw Object.assign(
      new Error(`Cannot schedule downgrade from state ${sub.subscriptionState}`),
      { code: 'INVALID_STATE', httpStatus: 409 },
    )
  }

  // Validate downgrade is actually a downgrade
  const tierRank: Record<string, number> = { FREE: 0, PRO: 1, BUSINESS: 2, PRO_MAX: 3 }
  const currentRank = tierRank[sub.planTier] ?? 0
  const targetRank = tierRank[input.targetTier] ?? 0
  if (targetRank >= currentRank) {
    throw Object.assign(
      new Error('Target tier must be lower than current tier for downgrade'),
      { code: 'INVALID_INPUT', httpStatus: 400 },
    )
  }

  const scheduledFor = input.effectiveAt === 'period_end'
    ? (sub.expiresAt?.toISOString() ?? 'period_end')
    : input.effectiveAt.toISOString()

  // Set pending downgrade (tenant-scoped)
  await prisma.subscription.update({
    where: { id: sub.id, businessId: input.businessId },
    data: { pendingDowngradeTier: input.targetTier },
  })

  logger.info('subscription.downgrade_scheduled', {
    businessId: input.businessId,
    subscriptionId: sub.id,
    from: sub.planTier,
    to: input.targetTier,
    scheduledFor,
  })

  return {
    subscriptionId: sub.id,
    pendingDowngradeTier: input.targetTier,
    scheduledFor,
  }
}

/**
 * Cancel a pending downgrade (revert to staying on current plan).
 */
export async function cancelScheduledDowngrade(
  businessId: string,
): Promise<CancelDowngradeResult> {
  const sub = await prisma.subscription.findUnique({
    where: { businessId },
    select: { id: true, pendingDowngradeTier: true },
  })

  if (!sub || !sub.pendingDowngradeTier) {
    return { subscriptionId: sub?.id ?? '', cleared: false }
  }

  await prisma.subscription.update({
    where: { id: sub.id, businessId },
    data: { pendingDowngradeTier: null },
  })

  logger.info('subscription.downgrade_cancelled', { businessId, subscriptionId: sub.id })
  return { subscriptionId: sub.id, cleared: true }
}
