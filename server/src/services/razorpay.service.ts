/**
 * Razorpay Integration Service — Subscription & Billing
 *
 * Handles plan subscriptions, cancellations, status checks, and webhooks.
 * Gracefully degrades when Razorpay credentials are not configured.
 */

import Razorpay from 'razorpay'
import crypto from 'node:crypto'
import logger from '../lib/logger.js'
import { validationError } from '../lib/errors.js'
import type { WebhookPayload } from './razorpay-webhook.service.js'
import {
  handleSubscriptionActivated,
  handleSubscriptionCharged,
  handleSubscriptionCancelled,
  handleSubscriptionPaused,
  handlePaymentFailedOnSubscription,
} from './razorpay-webhook.service.js'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CreateSubscriptionOpts {
  userId: string
  businessId: string
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

  const { userId, businessId, planId, couponCode } = opts

  // Look up coupon for offer_id if provided
  let offerId: string | undefined
  if (couponCode) {
    const { prisma } = await import('../lib/prisma.js')
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
      notes: { userId, businessId, source: 'hisaabpro' },
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
      await handleSubscriptionActivated(payload)
      break

    case 'subscription.charged':
      await handleSubscriptionCharged(payload)
      break

    case 'subscription.cancelled':
    case 'subscription.completed':
      await handleSubscriptionCancelled(payload)
      break

    case 'subscription.paused':
      await handleSubscriptionPaused(payload)
      break

    case 'payment.failed':
      await handlePaymentFailedOnSubscription(payload)
      break

    case 'payment.captured':
      logger.info('razorpay.payment_captured', {
        paymentId: payload.payload.payment?.entity.id,
        subscriptionId: payload.payload.payment?.entity.subscription_id ?? null,
      })
      break

    default:
      logger.info('razorpay.webhook_unhandled', { event })
  }
}
