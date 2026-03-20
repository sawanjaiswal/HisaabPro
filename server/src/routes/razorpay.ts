/**
 * Razorpay Routes — Subscription & Billing
 *
 * POST /api/razorpay/webhook    — Razorpay webhook (NO auth, raw body)
 * POST /api/razorpay/subscribe  — Create subscription (authenticated)
 * POST /api/razorpay/cancel     — Cancel subscription (authenticated)
 * GET  /api/razorpay/status     — Get subscription status (authenticated)
 */

import { Router } from 'express'
import express from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import {
  subscribeSchema,
  cancelSubscriptionSchema,
  subscriptionStatusSchema,
} from '../schemas/razorpay.schemas.js'
import {
  createSubscription,
  cancelSubscription,
  getSubscriptionStatus,
  handleWebhook,
} from '../services/razorpay.service.js'
import { sendSuccess, sendError } from '../lib/response.js'

// ─── Webhook Router — mounted BEFORE express.json() in index.ts ─────────────

export const razorpayWebhookRouter = Router()

razorpayWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined
    if (!signature) {
      sendError(res, 'Missing webhook signature', 'INVALID_SIGNATURE', 400)
      return
    }

    await handleWebhook(req.body as Buffer, signature)
    res.json({ status: 'ok' })
  })
)

// ─── Main Router — authenticated routes ─────────────────────────────────────

const router = Router()

// POST /subscribe — Create a new Razorpay subscription
router.post(
  '/subscribe',
  auth,
  validate(subscribeSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const { planId, couponCode } = req.body as { planId: string; couponCode?: string }

    const result = await createSubscription({ userId, planId, couponCode })

    if (!result.success) {
      sendError(res, result.error ?? 'Subscription creation failed', 'SUBSCRIPTION_FAILED', 502)
      return
    }

    sendSuccess(res, {
      subscriptionId: result.subscriptionId,
      shortUrl: result.shortUrl,
    }, 201)
  })
)

// POST /cancel — Cancel an existing subscription
router.post(
  '/cancel',
  auth,
  validate(cancelSubscriptionSchema),
  asyncHandler(async (req, res) => {
    const { subscriptionId, cancelAtEnd } = req.body as {
      subscriptionId: string
      cancelAtEnd: boolean
    }

    const result = await cancelSubscription(subscriptionId, cancelAtEnd)

    if (!result.success) {
      sendError(res, result.error ?? 'Cancellation failed', 'CANCEL_FAILED', 502)
      return
    }

    sendSuccess(res, { cancelled: true })
  })
)

// GET /status — Get subscription status
router.get(
  '/status',
  auth,
  asyncHandler(async (req, res) => {
    const parsed = subscriptionStatusSchema.safeParse(req.query)
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      sendError(res, message, 'VALIDATION_ERROR', 400)
      return
    }

    const { subscriptionId } = parsed.data

    const result = await getSubscriptionStatus(subscriptionId)

    if (result.error) {
      sendError(res, result.error, 'STATUS_FETCH_FAILED', 502)
      return
    }

    sendSuccess(res, {
      status: result.status,
      currentEnd: result.currentEnd,
    })
  })
)

export default router
