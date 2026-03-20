/**
 * Razorpay Integration Service — Subscription & Billing
 *
 * Handles plan subscriptions, cancellations, status checks, and webhooks.
 * Gracefully degrades when Razorpay credentials are not configured.
 */

import Razorpay from 'razorpay'
import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import { validationError } from '../lib/errors.js'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateSubscriptionOpts {
  userId: string
  planId: string
  couponCode?: string
}

interface SubscriptionResult {
  success: boolean
  subscriptionId?: string
  shortUrl?: string
  error?: string
}

interface CancelResult {
  success: boolean
  error?: string
}

interface StatusResult {
  status: string
  currentEnd?: Date
  error?: string
}

interface WebhookPayload {
  event: string
  payload: {
    subscription?: { entity: { id: string; status: string; current_end?: number | null } }
    payment?: { entity: { id: string; status: string; subscription_id?: string } }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let instance: Razorpay | null = null

function getRazorpay(): Razorpay | null {
  if (instance) return instance

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    logger.warn('razorpay.not_configured', {
      message: 'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing — billing disabled',
    })
    return null
  }

  instance = new Razorpay({ key_id: keyId, key_secret: keySecret })
  return instance
}

// ─── Create Subscription ────────────────────────────────────────────────────

export async function createSubscription(
  opts: CreateSubscriptionOpts
): Promise<SubscriptionResult> {
  const rz = getRazorpay()
  if (!rz) return { success: false, error: 'Razorpay not configured' }

  const { userId, planId, couponCode } = opts

  // Look up coupon for offer_id if provided
  let offerId: string | undefined
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { code: couponCode.toUpperCase() },
      select: { razorpayOfferId: true },
    })
    if (coupon?.razorpayOfferId) {
      offerId = coupon.razorpayOfferId
    }
  }

  try {
    const subscription = await rz.subscriptions.create({
      plan_id: planId,
      total_count: 12, // 12 billing cycles (1 year for monthly)
      customer_notify: 1,
      ...(offerId ? { offer_id: offerId } : {}),
      notes: { userId, source: 'hisaabpro' },
    })

    logger.info('razorpay.subscription_created', {
      userId,
      subscriptionId: subscription.id,
      planId,
      offerId: offerId ?? null,
    })

    return {
      success: true,
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create subscription'
    logger.error('razorpay.subscription_create_failed', { userId, planId, error: message })
    return { success: false, error: message }
  }
}

// ─── Cancel Subscription ────────────────────────────────────────────────────

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtEnd = true
): Promise<CancelResult> {
  const rz = getRazorpay()
  if (!rz) return { success: false, error: 'Razorpay not configured' }

  try {
    await rz.subscriptions.cancel(subscriptionId, cancelAtEnd)

    logger.info('razorpay.subscription_cancelled', { subscriptionId, cancelAtEnd })
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to cancel subscription'
    logger.error('razorpay.subscription_cancel_failed', { subscriptionId, error: message })
    return { success: false, error: message }
  }
}

// ─── Get Subscription Status ────────────────────────────────────────────────

export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<StatusResult> {
  const rz = getRazorpay()
  if (!rz) return { status: 'unknown', error: 'Razorpay not configured' }

  try {
    const sub = await rz.subscriptions.fetch(subscriptionId)

    return {
      status: sub.status,
      currentEnd: sub.current_end ? new Date(sub.current_end * 1000) : undefined,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch subscription'
    logger.error('razorpay.subscription_fetch_failed', { subscriptionId, error: message })
    return { status: 'unknown', error: message }
  }
}

// ─── Webhook Handler ────────────────────────────────────────────────────────

export async function handleWebhook(
  rawBody: Buffer | string,
  signature: string
): Promise<void> {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw validationError('Webhook secret not configured')
  }

  // Verify signature using HMAC SHA256
  const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8')
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(bodyString)
    .digest('hex')

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    logger.warn('razorpay.webhook_signature_invalid')
    throw validationError('Invalid webhook signature')
  }

  const payload: WebhookPayload = JSON.parse(bodyString)
  const { event } = payload

  logger.info('razorpay.webhook_received', { event })

  switch (event) {
    case 'subscription.activated':
    case 'subscription.charged':
      await handleSubscriptionActive(payload)
      break

    case 'subscription.cancelled':
    case 'subscription.completed':
      await handleSubscriptionEnded(payload, event)
      break

    case 'payment.captured':
      await handlePaymentCaptured(payload)
      break

    case 'payment.failed':
      await handlePaymentFailed(payload)
      break

    default:
      logger.info('razorpay.webhook_unhandled', { event })
  }
}

// ─── Webhook Event Handlers (private) ───────────────────────────────────────

async function handleSubscriptionActive(payload: WebhookPayload): Promise<void> {
  const sub = payload.payload.subscription?.entity
  if (!sub) return

  const subscriptionId = sub.id
  const currentEnd = sub.current_end ? new Date(sub.current_end * 1000) : null

  // Find redemption linked to this subscription and update user status
  const redemption = await prisma.couponRedemption.findFirst({
    where: { razorpaySubscriptionId: subscriptionId },
    select: { userId: true },
  })

  if (redemption) {
    logger.info('razorpay.subscription_active', {
      subscriptionId,
      userId: redemption.userId,
      currentEnd: currentEnd?.toISOString(),
    })
  } else {
    logger.info('razorpay.subscription_active_no_user', { subscriptionId })
  }
}

async function handleSubscriptionEnded(
  payload: WebhookPayload,
  event: string
): Promise<void> {
  const sub = payload.payload.subscription?.entity
  if (!sub) return

  const subscriptionId = sub.id

  const redemption = await prisma.couponRedemption.findFirst({
    where: { razorpaySubscriptionId: subscriptionId },
    select: { userId: true },
  })

  logger.info('razorpay.subscription_ended', {
    subscriptionId,
    event,
    userId: redemption?.userId ?? null,
  })
}

async function handlePaymentCaptured(payload: WebhookPayload): Promise<void> {
  const payment = payload.payload.payment?.entity
  if (!payment) return

  logger.info('razorpay.payment_captured', {
    paymentId: payment.id,
    subscriptionId: payment.subscription_id ?? null,
  })
}

async function handlePaymentFailed(payload: WebhookPayload): Promise<void> {
  const payment = payload.payload.payment?.entity
  if (!payment) return

  logger.warn('razorpay.payment_failed', {
    paymentId: payment.id,
    subscriptionId: payment.subscription_id ?? null,
  })
}
