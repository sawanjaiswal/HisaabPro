/**
 * Subscription gating middleware — enforces plan limits per-request.
 * Applied at route level for features that require paid plans.
 *
 * Until Subscription model is deployed, defaults to FREE with trial grace period.
 */

import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { sendError } from '../lib/response.js'
import { PLAN_LIMITS, PLAN_HIERARCHY, TRIAL_DAYS } from '../config/plans.js'
import type { PlanTier } from '../config/plans.js'

/** Get business plan tier — reads from Business.planTier or defaults to FREE */
async function getBusinessPlan(businessId: string): Promise<{ plan: PlanTier; isTrialing: boolean }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      createdAt: true,
      // planTier will be added in future migration — use fallback for now
    },
  })

  if (!business) return { plan: 'FREE', isTrialing: false }

  // Trial: businesses created within TRIAL_DAYS get PRO features free
  const daysSinceCreation = (Date.now() - business.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceCreation <= TRIAL_DAYS) {
    return { plan: 'PRO', isTrialing: true }
  }

  // TODO: Read from Subscription model once deployed
  // const sub = await prisma.subscription.findFirst({ where: { businessId, status: 'ACTIVE' } })
  // if (sub) return { plan: sub.planTier as PlanTier, isTrialing: false }

  return { plan: 'FREE', isTrialing: false }
}

/**
 * Require minimum plan tier.
 * Returns 402 with upgrade info if plan doesn't meet requirement.
 */
export function requirePlan(minPlan: PlanTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.businessId) return next() // Let auth middleware handle unauthenticated

    const { plan, isTrialing } = await getBusinessPlan(req.user.businessId)

    if (PLAN_HIERARCHY[plan] >= PLAN_HIERARCHY[minPlan]) {
      return next()
    }

    sendError(
      res,
      `This feature requires the ${minPlan} plan. You are currently on ${plan}${isTrialing ? ' (trial)' : ''}.`,
      'UPGRADE_REQUIRED',
      402
    )
  }
}

/**
 * Enforce monthly quota (e.g., invoices per month).
 * Returns 402 with usage info when quota exceeded.
 */
export function requireQuota(resource: 'invoices' | 'users') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.businessId) return next()

    const { plan } = await getBusinessPlan(req.user.businessId)
    const limits = PLAN_LIMITS[plan]

    if (resource === 'invoices') {
      const limit = limits.maxInvoicesPerMonth
      if (limit === -1) return next()

      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const count = await prisma.document.count({
        where: {
          businessId: req.user.businessId,
          createdAt: { gte: startOfMonth },
          isDeleted: false,
        },
      })

      if (count >= limit) {
        return sendError(
          res,
          `Monthly invoice limit reached (${count}/${limit}). Upgrade to create more.`,
          'QUOTA_EXCEEDED',
          402
        )
      }
    }

    if (resource === 'users') {
      const limit = limits.maxUsers
      if (limit === -1) return next()

      const count = await prisma.businessUser.count({
        where: {
          businessId: req.user.businessId,
          status: 'ACTIVE',
        },
      })

      if (count >= limit) {
        return sendError(
          res,
          `User limit reached (${count}/${limit}). Upgrade to add more team members.`,
          'QUOTA_EXCEEDED',
          402
        )
      }
    }

    next()
  }
}
