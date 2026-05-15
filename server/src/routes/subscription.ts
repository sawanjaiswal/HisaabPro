/**
 * Subscription Routes — core subscription management endpoints.
 *
 * GET  /api/businesses/:businessId/subscription — plan info + state + usage
 * POST /api/subscription/checkout  — create Razorpay checkout session
 * PATCH /api/subscription/plan     — upgrade or downgrade
 * DELETE /api/subscription         — cancel subscription
 * POST /api/subscription/reactivate — reactivate cancelled subscription
 * GET  /api/subscription/entitlement — return entitlement JWT
 *
 * SECURITY P1-E: idempotencyCheck() on all mutations.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { replayProtection } from '../middleware/replay-protection.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { PLAN_LIMITS } from '../config/plans.js'
import type { PlanTier } from '../config/plans.js'
import {
  CheckoutReqSchema,
  PlanChangeReqSchema,
  ReactivateReqSchema,
} from '../schemas/subscription.schemas.js'
import { createCheckoutSession } from '../services/subscription/checkout-session.service.js'
import { scheduleDowngrade } from '../services/subscription/downgrade.service.js'
import { applySubscriptionEvent } from '../services/subscription/subscription.writer.js'
import { signEntitlementToken } from '../services/subscription/entitlement-jwt.service.js'
import { getActiveAddonCodes } from '../services/subscription/addon.queries.js'
import type { SubscriptionState } from '../services/subscription/subscription.types.js'

export const subscriptionRouter = Router()
subscriptionRouter.use(auth)

// GET /:businessId/subscription — plan info + state + usage + JWT
subscriptionRouter.get(
  '/:businessId/subscription',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId

    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
      select: {
        id: true,
        planTier: true,
        status: true,
        expiresAt: true,
        startDate: true,
        subscriptionState: true,
        gracePeriodEndsAt: true,
        overflowGraceUntil: true,
        mandateId: true,
      },
    })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [invoiceCount, userCount, addonCodes] = await Promise.all([
      prisma.document.count({ where: { businessId, createdAt: { gte: startOfMonth }, isDeleted: false } }),
      prisma.businessUser.count({ where: { businessId, status: 'ACTIVE' } }),
      getActiveAddonCodes(businessId),
    ])

    const plan = (subscription?.planTier ?? 'FREE') as PlanTier
    const state = (subscription?.subscriptionState ?? 'NONE') as SubscriptionState
    const limits = PLAN_LIMITS[plan]

    // Issue entitlement JWT (24h, RS256) — null if keys not configured
    const offlineToken = subscription
      ? signEntitlementToken({
          subscriptionId: subscription.id,
          businessId,
          tier: plan as import('../services/subscription/subscription.types.js').SubscriptionPlanTier,
          state,
          graceUntil: subscription.gracePeriodEndsAt,
          addonCodes,
        })
      : null

    const mandateStatus = subscription?.mandateId ? 'ACTIVE' : null

    sendSuccess(res, {
      plan,
      state,
      status: subscription?.status ?? 'NONE',
      expiresAt: subscription?.expiresAt ?? null,
      startDate: subscription?.startDate ?? null,
      graceUntil: subscription?.gracePeriodEndsAt ?? null,
      overflowGraceUntil: subscription?.overflowGraceUntil ?? null,
      mandateStatus,
      addons: addonCodes,
      offlineToken,
      isTrialing: !subscription,
      usage: {
        invoices: { used: invoiceCount, limit: limits.maxInvoicesPerMonth },
        users: { used: userCount, limit: limits.maxUsers },
      },
    })
  }),
)

// POST /subscription/checkout — create Razorpay checkout (online-only)
subscriptionRouter.post(
  '/subscription/checkout',
  idempotencyCheck(),
  replayProtection,
  validate(CheckoutReqSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId

    const result = await createCheckoutSession({
      businessId,
      userId,
      tier: req.body.tier,
      billingCycle: req.body.billingCycle,
      couponCode: req.body.couponCode,
    })

    sendSuccess(res, result, 201)
  }),
)

// PATCH /subscription/plan — upgrade or downgrade
subscriptionRouter.patch(
  '/subscription/plan',
  idempotencyCheck(),
  validate(PlanChangeReqSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId

    const sub = await prisma.subscription.findUnique({
      where: { businessId },
      select: { id: true, planTier: true },
    })

    if (!sub) {
      sendError(res, 'No subscription found', 'NOT_FOUND', 404)
      return
    }

    const result = await scheduleDowngrade({
      businessId,
      targetTier: req.body.tier,
      effectiveAt: req.body.effectiveAt ?? 'period_end',
    })

    sendSuccess(res, result)
  }),
)

// DELETE /subscription — cancel subscription
subscriptionRouter.delete(
  '/subscription',
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId

    const sub = await prisma.subscription.findUnique({
      where: { businessId },
      select: { id: true, subscriptionState: true },
    })

    if (!sub) {
      sendError(res, 'No subscription found', 'NOT_FOUND', 404)
      return
    }

    await applySubscriptionEvent({
      businessId,
      subscriptionId: sub.id,
      trigger: 'user.cancel',
      actorType: 'USER',
      actorUserId: req.user!.userId,
    })

    sendSuccess(res, { cancelled: true })
  }),
)

// POST /subscription/reactivate — requires online (Razorpay needed)
subscriptionRouter.post(
  '/subscription/reactivate',
  idempotencyCheck(),
  validate(ReactivateReqSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId

    const result = await createCheckoutSession({
      businessId,
      userId,
      tier: req.body.tier,
      billingCycle: req.body.billingCycle,
    })

    sendSuccess(res, result, 201)
  }),
)
