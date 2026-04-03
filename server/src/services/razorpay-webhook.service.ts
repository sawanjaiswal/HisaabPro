/**
 * Razorpay Webhook Event Handlers — Subscription model updates
 *
 * Handles all subscription lifecycle events and updates the local
 * Subscription model accordingly.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import type { PlanTier } from '../config/plans.js'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubscriptionEntity {
  id: string
  status: string
  plan_id?: string
  current_end?: number | null
  notes?: Record<string, string>
}

interface PaymentEntity {
  id: string
  status: string
  subscription_id?: string
}

export interface WebhookPayload {
  event: string
  payload: {
    subscription?: { entity: SubscriptionEntity }
    payment?: { entity: PaymentEntity }
  }
}

// ─── Plan Tier Mapping ───────────────────────────────────────────────────────

function resolvePlanTier(razorpayPlanId: string | undefined): PlanTier {
  if (!razorpayPlanId) return 'FREE'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_PRO) return 'PRO'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_BUSINESS) return 'BUSINESS'
  return 'FREE'
}

// ─── businessId Resolution ───────────────────────────────────────────────────

async function resolveBusinessId(
  sub: SubscriptionEntity
): Promise<string | null> {
  // 1. Try notes first (set at subscription creation time)
  if (sub.notes?.businessId) return sub.notes.businessId

  // 2. Fall back to looking up by razorpaySubId
  const existing = await prisma.subscription.findFirst({
    where: { razorpaySubId: sub.id },
    select: { businessId: true },
  })
  return existing?.businessId ?? null
}

// ─── subscription.activated ──────────────────────────────────────────────────

export async function handleSubscriptionActivated(
  payload: WebhookPayload
): Promise<void> {
  const sub = payload.payload.subscription?.entity
  if (!sub) return

  const businessId = await resolveBusinessId(sub)
  if (!businessId) {
    logger.warn('razorpay.webhook_no_business', { event: 'subscription.activated', subId: sub.id })
    return
  }

  const planTier = resolvePlanTier(sub.plan_id)

  await prisma.subscription.upsert({
    where: { businessId },
    create: {
      businessId,
      planTier,
      status: 'ACTIVE',
      razorpaySubId: sub.id,
      razorpayPlanId: sub.plan_id ?? null,
      startDate: new Date(),
      cancelledAt: null,
    },
    update: {
      planTier,
      status: 'ACTIVE',
      razorpaySubId: sub.id,
      razorpayPlanId: sub.plan_id ?? null,
      cancelledAt: null,
    },
  })

  logger.info('razorpay.subscription_activated', { businessId, planTier, subId: sub.id })
}

// ─── subscription.charged ────────────────────────────────────────────────────

export async function handleSubscriptionCharged(
  payload: WebhookPayload
): Promise<void> {
  const sub = payload.payload.subscription?.entity
  if (!sub) return

  const businessId = await resolveBusinessId(sub)
  if (!businessId) {
    logger.warn('razorpay.webhook_no_business', { event: 'subscription.charged', subId: sub.id })
    return
  }

  const expiresAt = sub.current_end ? new Date(sub.current_end * 1000) : null
  const planTier = resolvePlanTier(sub.plan_id)

  await prisma.subscription.upsert({
    where: { businessId },
    create: {
      businessId,
      planTier,
      status: 'ACTIVE',
      razorpaySubId: sub.id,
      razorpayPlanId: sub.plan_id ?? null,
      startDate: new Date(),
      expiresAt,
    },
    update: {
      status: 'ACTIVE',
      expiresAt,
      planTier,
    },
  })

  logger.info('razorpay.subscription_charged', {
    businessId,
    expiresAt: expiresAt?.toISOString(),
    subId: sub.id,
  })
}

// ─── subscription.cancelled ──────────────────────────────────────────────────

export async function handleSubscriptionCancelled(
  payload: WebhookPayload
): Promise<void> {
  const sub = payload.payload.subscription?.entity
  if (!sub) return

  const businessId = await resolveBusinessId(sub)
  if (!businessId) {
    logger.warn('razorpay.webhook_no_business', { event: 'subscription.cancelled', subId: sub.id })
    return
  }

  await prisma.subscription.updateMany({
    where: { businessId, razorpaySubId: sub.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  })

  logger.info('razorpay.subscription_cancelled_webhook', { businessId, subId: sub.id })
}

// ─── subscription.paused ─────────────────────────────────────────────────────

export async function handleSubscriptionPaused(
  payload: WebhookPayload
): Promise<void> {
  const sub = payload.payload.subscription?.entity
  if (!sub) return

  const businessId = await resolveBusinessId(sub)
  if (!businessId) {
    logger.warn('razorpay.webhook_no_business', { event: 'subscription.paused', subId: sub.id })
    return
  }

  await prisma.subscription.updateMany({
    where: { businessId, razorpaySubId: sub.id },
    data: { status: 'PAST_DUE' },
  })

  logger.info('razorpay.subscription_paused', { businessId, subId: sub.id })
}

// ─── payment.failed (subscription) ──────────────────────────────────────────

export async function handlePaymentFailedOnSubscription(
  payload: WebhookPayload
): Promise<void> {
  const payment = payload.payload.payment?.entity
  if (!payment?.subscription_id) return

  await prisma.subscription.updateMany({
    where: { razorpaySubId: payment.subscription_id },
    data: { status: 'PAST_DUE' },
  })

  logger.warn('razorpay.payment_failed_subscription', {
    paymentId: payment.id,
    subId: payment.subscription_id,
  })
}
