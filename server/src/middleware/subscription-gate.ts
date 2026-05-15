/**
 * Subscription gating middleware — enforces plan limits per-request.
 *
 * Extended to support:
 *  - New subscriptionState machine (PAST_DUE grace, LOCKED blocking)
 *  - BusinessAddon feature overlays
 *  - Overflow grace period for quota resources
 *
 * SECURITY P1-H: all Prisma queries scope by businessId from authenticated session.
 * businessId is NEVER taken from request body.
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendError } from '../lib/response.js'
import { PLAN_LIMITS, PLAN_HIERARCHY, TRIAL_DAYS } from '../config/plans.js'
import type { PlanTier, PlanLimits } from '../config/plans.js'
import logger from '../lib/logger.js'

type BooleanFeatureFlag = {
  [K in keyof PlanLimits]: PlanLimits[K] extends boolean ? K : never
}[keyof PlanLimits]

// ─── State-aware plan resolution ──────────────────────────────────────────────

interface PlanResolution {
  plan: PlanTier
  isTrialing: boolean
  isGrace: boolean
  graceUntil: Date | null
  subscriptionState: string
  isLocked: boolean
}

async function resolveBusinessPlan(businessId: string): Promise<PlanResolution> {
  const [business, subscription] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { createdAt: true },
    }),
    prisma.subscription.findUnique({
      where: { businessId },
      select: {
        planTier: true,
        status: true,
        subscriptionState: true,
        gracePeriodEndsAt: true,
        expiresAt: true,
        overflowGraceUntil: true,
      },
    }),
  ])

  if (!business) {
    return { plan: 'FREE', isTrialing: false, isGrace: false, graceUntil: null, subscriptionState: 'NONE', isLocked: false }
  }

  const now = new Date()

  if (subscription) {
    const state = subscription.subscriptionState

    // LOCKED state: deny paid-tier access
    if (state === 'LOCKED') {
      return { plan: 'FREE', isTrialing: false, isGrace: false, graceUntil: null, subscriptionState: state, isLocked: true }
    }

    // PAST_DUE with active grace: grant paid-tier access during grace
    if (state === 'PAST_DUE' && subscription.gracePeriodEndsAt && subscription.gracePeriodEndsAt > now) {
      return {
        plan: subscription.planTier as PlanTier,
        isTrialing: false,
        isGrace: true,
        graceUntil: subscription.gracePeriodEndsAt,
        subscriptionState: state,
        isLocked: false,
      }
    }

    // PAST_DUE with expired grace: downgrade to FREE
    if (state === 'PAST_DUE') {
      return { plan: 'FREE', isTrialing: false, isGrace: false, graceUntil: null, subscriptionState: state, isLocked: false }
    }

    // ACTIVE | PROMO_ACTIVE | TRIAL_NO_AUTOPAY: grant plan access
    if (['ACTIVE', 'PROMO_ACTIVE', 'TRIAL_NO_AUTOPAY'].includes(state)) {
      return {
        plan: subscription.planTier as PlanTier,
        isTrialing: state === 'TRIAL_NO_AUTOPAY',
        isGrace: false,
        graceUntil: null,
        subscriptionState: state,
        isLocked: false,
      }
    }

    // CANCELLED | NONE: fallback to trial check
    const daysSince = (now.getTime() - business.createdAt.getTime()) / 86_400_000
    if (daysSince <= TRIAL_DAYS) {
      return { plan: 'PRO', isTrialing: true, isGrace: false, graceUntil: null, subscriptionState: state, isLocked: false }
    }

    return { plan: 'FREE', isTrialing: false, isGrace: false, graceUntil: null, subscriptionState: state, isLocked: false }
  }

  // No subscription row — trial check
  const daysSince = (now.getTime() - business.createdAt.getTime()) / 86_400_000
  if (daysSince <= TRIAL_DAYS) {
    return { plan: 'PRO', isTrialing: true, isGrace: false, graceUntil: null, subscriptionState: 'NONE', isLocked: false }
  }

  return { plan: 'FREE', isTrialing: false, isGrace: false, graceUntil: null, subscriptionState: 'NONE', isLocked: false }
}

// ─── Addon overlay ────────────────────────────────────────────────────────────

async function getAddonFeatureFlags(businessId: string): Promise<Record<string, boolean>> {
  const addons = await prisma.businessAddon.findMany({
    where: {
      businessId,
      status: 'ACTIVE',
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
    select: { featureAddon: { select: { code: true } } },
  })
  const flags: Record<string, boolean> = {}
  for (const a of addons) {
    flags[a.featureAddon.code] = true
  }
  return flags
}

// ─── requirePlan ─────────────────────────────────────────────────────────────

export function requirePlan(minPlan: PlanTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.businessId) return next()

    const resolution = await resolveBusinessPlan(req.user.businessId)

    if (resolution.isLocked) {
      sendError(res, 'Account locked due to unpaid subscription. Please renew to continue.', 'ACCOUNT_LOCKED', 402)
      return
    }

    if (PLAN_HIERARCHY[resolution.plan] >= PLAN_HIERARCHY[minPlan]) {
      return next()
    }

    logger.info('subscription.upgrade_required', {
      reason: 'plan_tier',
      currentPlan: resolution.plan,
      requiredPlan: minPlan,
      isGrace: resolution.isGrace,
      businessId: req.user.businessId,
      path: req.path,
    })

    sendError(
      res,
      `This feature requires the ${minPlan} plan. You are currently on ${resolution.plan}${resolution.isTrialing ? ' (trial)' : ''}${resolution.isGrace ? ' (grace period)' : ''}.`,
      'UPGRADE_REQUIRED',
      402,
    )
  }
}

// ─── requireFeature ───────────────────────────────────────────────────────────

export function requireFeature(flag: BooleanFeatureFlag) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.businessId) return next()

    const resolution = await resolveBusinessPlan(req.user.businessId)

    if (resolution.isLocked) {
      sendError(res, 'Account locked due to unpaid subscription.', 'ACCOUNT_LOCKED', 402)
      return
    }

    // Check plan feature + addon overlay
    const planHasFeature = PLAN_LIMITS[resolution.plan][flag]
    if (planHasFeature) return next()

    const addonFlags = await getAddonFeatureFlags(req.user.businessId)
    if (addonFlags[flag]) return next()

    sendError(res, 'This feature requires an upgraded plan.', 'UPGRADE_REQUIRED', 402)
  }
}

// ─── requireQuota ─────────────────────────────────────────────────────────────

export function requireQuota(resource: 'invoices' | 'users') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.businessId) return next()

    const { plan } = await resolveBusinessPlan(req.user.businessId)
    const limits = PLAN_LIMITS[plan]

    if (resource === 'invoices') {
      const limit = limits.maxInvoicesPerMonth
      if (limit === -1) return next()

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const count = await prisma.document.count({
        where: { businessId: req.user.businessId, createdAt: { gte: startOfMonth }, isDeleted: false },
      })

      if (count >= limit) {
        return sendError(res, `Monthly invoice limit reached (${count}/${limit}). Upgrade to create more.`, 'QUOTA_EXCEEDED', 402)
      }
    }

    if (resource === 'users') {
      const limit = limits.maxUsers
      if (limit === -1) return next()

      const count = await prisma.businessUser.count({
        where: { businessId: req.user.businessId, status: 'ACTIVE' },
      })

      if (count >= limit) {
        return sendError(res, `User limit reached (${count}/${limit}). Upgrade to add more.`, 'QUOTA_EXCEEDED', 402)
      }
    }

    next()
  }
}
