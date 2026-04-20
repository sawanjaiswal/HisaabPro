/**
 * Subscription Status Routes
 *
 * GET /api/businesses/:businessId/subscription — current plan + usage
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { PLAN_LIMITS } from '../config/plans.js'
import type { PlanTier } from '../config/plans.js'

export const subscriptionRouter = Router()
subscriptionRouter.use(auth)

// GET /:businessId/subscription — plan info + usage metrics
subscriptionRouter.get(
  '/:businessId/subscription',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      select: {
        planTier: true,
        status: true,
        expiresAt: true,
        startDate: true,
      },
    })

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [invoiceCount, userCount] = await Promise.all([
      prisma.document.count({
        where: {
          businessId,
          createdAt: { gte: startOfMonth },
          isDeleted: false,
        },
      }),
      prisma.businessUser.count({
        where: { businessId, status: 'ACTIVE' },
      }),
    ])

    const plan = (subscription?.planTier ?? 'FREE') as PlanTier
    const limits = PLAN_LIMITS[plan]

    sendSuccess(res, {
      plan,
      status: subscription?.status ?? 'NONE',
      expiresAt: subscription?.expiresAt ?? null,
      startDate: subscription?.startDate ?? null,
      usage: {
        invoices: { used: invoiceCount, limit: limits.maxInvoicesPerMonth },
        users: { used: userCount, limit: limits.maxUsers },
      },
      isTrialing: !subscription,
    })
  })
)
