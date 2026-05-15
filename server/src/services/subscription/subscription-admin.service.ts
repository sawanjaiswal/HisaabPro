/**
 * Subscription Admin Service — super-admin grants and revocations.
 *
 * SECURITY P1-B:
 *  - requireSuperAdmin enforced at route layer (not here)
 *  - self-grant guard: admin cannot grant their own business (enforced HERE)
 *  - reason min(8) max(500) enforced via Zod schema
 *  - months int 1–36 enforced via Zod schema
 * SECURITY P2-J: target businessId validated against DB before any write.
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import { applySubscriptionEvent } from './subscription.writer.js'
import type { SubscriptionPlanTier } from './subscription.types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminGrantInput {
  businessId: string
  tier: SubscriptionPlanTier
  months: number         // 1–36, Zod-validated upstream
  reason: string         // min(8) max(500), Zod-validated upstream
  adminId: string        // req.admin.adminId
}

export interface AdminGrantResult {
  subscriptionId: string
  tier: SubscriptionPlanTier
  expiresAt: Date
  grantedBy: string
}

export interface AdminRevokeResult {
  subscriptionId: string
  revoked: boolean
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Grant a comp subscription to a business.
 * Self-grant guard: rejects if admin is a BusinessUser of the target business.
 */
export async function grantComparable(input: AdminGrantInput): Promise<AdminGrantResult> {
  // P2-J: validate target business exists
  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { id: true, isActive: true },
  })

  if (!business) {
    throw Object.assign(
      new Error('Business not found'),
      { code: 'NOT_FOUND', httpStatus: 404 },
    )
  }

  if (!business.isActive) {
    throw Object.assign(
      new Error('Business is inactive'),
      { code: 'FORBIDDEN', httpStatus: 403 },
    )
  }

  // P1-B: Self-grant guard — check if admin is associated with this business
  const selfGrant = await prisma.businessUser.findFirst({
    where: { businessId: input.businessId, userId: input.adminId },
    select: { id: true },
  })

  if (selfGrant) {
    logger.warn('admin_grant.self_grant_blocked', {
      adminId: input.adminId,
      businessId: input.businessId,
    })
    throw Object.assign(
      new Error('Admins cannot grant subscriptions to their own businesses'),
      { code: 'FORBIDDEN_SELF_GRANT', httpStatus: 403 },
    )
  }

  // Ensure subscription row exists
  let sub = await prisma.subscription.findUnique({
    where: { businessId: input.businessId },
    select: { id: true, subscriptionState: true },
  })

  if (!sub) {
    // Create initial FREE subscription row
    sub = await prisma.subscription.create({
      data: {
        businessId: input.businessId,
        planTier: 'FREE',
        status: 'ACTIVE',
        startDate: new Date(),
        subscriptionState: 'NONE',
        autoRenew: false,
        paymentMethod: 'MANUAL',
      },
      select: { id: true, subscriptionState: true },
    })
  }

  const expiresAt = new Date()
  expiresAt.setMonth(expiresAt.getMonth() + input.months)

  // Apply state machine event
  await applySubscriptionEvent({
    businessId: input.businessId,
    subscriptionId: sub.id,
    trigger: 'admin.force_activate',
    actorType: 'ADMIN',
    actorUserId: input.adminId,
    planTier: input.tier,
    payload: {
      reason: input.reason,
      months: input.months,
      expiresAt: expiresAt.toISOString(),
      operatorId: input.adminId,
    },
  })

  // Set plan tier + expiry (tenant-scoped)
  await prisma.subscription.update({
    where: { id: sub.id, businessId: input.businessId },
    data: { planTier: input.tier, expiresAt },
  })

  logger.info('admin_grant.completed', {
    adminId: input.adminId,
    businessId: input.businessId,
    tier: input.tier,
    months: input.months,
    expiresAt: expiresAt.toISOString(),
    // reason intentionally NOT logged here (could contain PII/context)
  })

  return {
    subscriptionId: sub.id,
    tier: input.tier,
    expiresAt,
    grantedBy: input.adminId,
  }
}

/**
 * Revoke a granted subscription, resetting to FREE.
 */
export async function revokeGrant(
  businessId: string,
  adminId: string,
): Promise<AdminRevokeResult> {
  const sub = await prisma.subscription.findUnique({
    where: { businessId },
    select: { id: true },
  })

  if (!sub) {
    throw Object.assign(new Error('Subscription not found'), { code: 'NOT_FOUND', httpStatus: 404 })
  }

  await prisma.subscription.update({
    where: { id: sub.id, businessId },
    data: { planTier: 'FREE', expiresAt: null, subscriptionState: 'NONE' },
  })

  logger.info('admin_grant.revoked', { adminId, businessId, subscriptionId: sub.id })

  return { subscriptionId: sub.id, revoked: true }
}
