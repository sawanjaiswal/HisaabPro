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
import { requireOwner } from '../middleware/permission.js'
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
import { verifyRazorpaySignature, getWebhookSecret } from '../lib/razorpay.js'
import { processWebhookPaymentLinkPaid } from '../services/collections/payment-link-webhook.js'
import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'

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

    const rawBody = req.body as Buffer
    const bodyStr = rawBody.toString('utf-8')

    // Verify signature before any processing (MB-1/MB-2/MB-5 security gate)
    const secret = getWebhookSecret()
    if (secret) {
      const valid = verifyRazorpaySignature(rawBody, signature, secret)
      if (!valid) {
        logger.warn('razorpay.webhook_rejected', { ip: req.ip })
        // Log without businessId FK (system-level event) — best-effort
        prisma.$executeRawUnsafe(
          `INSERT INTO "WebhookEvent" (id, "eventId", source, payload, "processedAt")
           VALUES (gen_random_uuid()::text, $1, 'razorpay_rejected', $2::jsonb, NOW())
           ON CONFLICT DO NOTHING`,
          `rejected-${Date.now()}`,
          JSON.stringify({ reason: 'invalid_signature', ip: req.ip }),
        ).catch(() => {/* non-fatal */})
        sendError(res, 'Invalid webhook signature', 'INVALID_SIGNATURE', 400)
        return
      }
    } else {
      // No secret configured — stub/dev mode: log warning, allow through
      logger.warn('razorpay.webhook_secret_missing', {
        message: 'RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification (dev/stub mode)',
      })
    }

    const payload = JSON.parse(bodyStr) as { event?: string; id?: string }

    // Dispatch payment_link.paid to dedicated handler
    if (payload.event === 'payment_link.paid') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await processWebhookPaymentLinkPaid(payload as any, payload)
      res.json({ status: 'ok' })
      return
    }

    // Delegate subscription events to existing handler
    await handleWebhook(rawBody, signature)
    res.json({ status: 'ok' })
  })
)

// ─── Main Router — authenticated routes ─────────────────────────────────────

const router = Router()

// POST /subscribe — Create a new Razorpay subscription
router.post(
  '/subscribe',
  auth,
  requireOwner(),
  validate(subscribeSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId
    const businessId = req.user!.businessId
    const { planId, couponCode } = req.body as { planId: string; couponCode?: string }

    const result = await createSubscription({ userId, businessId, planId, couponCode })

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
  requireOwner(),
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
