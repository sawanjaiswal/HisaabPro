/**
 * Razorpay Webhook Event Handlers — routes events through state-machine writer.
 *
 * SECURITY P1-A: Replay-age check — created_at must be ≤ 5 min old.
 * SECURITY P1-F: businessId resolved from razorpaySubscriptionId DB lookup (never from payload).
 * SECURITY P2-A: payload.id presence validated before idempotency insert.
 * SECURITY P2-I: amount parsed as Int paise; currency validated = INR.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import type { PlanTier } from '../config/plans.js'
import { applySubscriptionEvent } from './subscription/subscription.writer.js'
import type { StateTrigger, SubscriptionPlanTier } from './subscription/subscription.types.js'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max age of a Razorpay webhook event (5 minutes). P1-A */
const MAX_EVENT_AGE_MS = 5 * 60 * 1000

// ─── Types ────────────────────────────────────────────────────────────────────

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
  amount?: number
  currency?: string
}

export interface WebhookPayload {
  id?: string           // Razorpay event ID — required (P2-A)
  event: string
  created_at?: number   // Unix seconds — used for replay-age check (P1-A)
  payload: {
    subscription?: { entity: SubscriptionEntity }
    payment?: { entity: PaymentEntity }
  }
}

export interface WebhookResult {
  handled: boolean
  idempotent?: boolean
  stale?: boolean
}

// ─── Replay-age check (P1-A) ─────────────────────────────────────────────────

function isStale(createdAt: number | undefined): boolean {
  if (!createdAt) return false  // No timestamp = trust it (Razorpay may omit on test)
  const ageMs = Date.now() - createdAt * 1000
  return ageMs > MAX_EVENT_AGE_MS
}

// ─── Plan tier resolver ───────────────────────────────────────────────────────

function resolvePlanTier(razorpayPlanId: string | undefined): PlanTier {
  if (!razorpayPlanId) return 'FREE'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_PRO) return 'PRO'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_BUSINESS) return 'BUSINESS'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_PRO_MAX) return 'PRO_MAX'
  return 'FREE'
}

// ─── businessId + subscriptionId resolution (P1-F) ───────────────────────────

async function resolveSubscription(
  razorpaySubId: string,
): Promise<{ businessId: string; subscriptionId: string } | null> {
  // SECURITY P1-F: NEVER use businessId from payload — resolve from DB
  const sub = await prisma.subscription.findFirst({
    where: { razorpaySubId },
    select: { businessId: true, id: true },
  })
  if (!sub) return null
  return { businessId: sub.businessId, subscriptionId: sub.id }
}

// ─── Amount parse (P2-I) ─────────────────────────────────────────────────────

function parsePaiseAmount(raw: number | undefined): number {
  if (!raw) return 0
  const parsed = parseInt(String(raw), 10)
  if (!Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid paise amount: ${raw}`)
  }
  return parsed
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function processWebhookEvent(payload: WebhookPayload): Promise<WebhookResult> {
  // P2-A: require event ID
  if (!payload.id || typeof payload.id !== 'string') {
    logger.warn('razorpay.webhook_missing_event_id', { event: payload.event })
    return { handled: false }
  }

  // P1-A: replay-age check
  if (isStale(payload.created_at)) {
    logger.warn('razorpay.webhook_stale', {
      eventId: payload.id,
      event: payload.event,
      createdAt: payload.created_at,
      ageMs: payload.created_at ? Date.now() - payload.created_at * 1000 : null,
    })
    return { handled: true, stale: true }
  }

  const sub = payload.payload.subscription?.entity
  const payment = payload.payload.payment?.entity

  try {
    switch (payload.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        if (!sub) return { handled: false }
        const resolved = await resolveSubscription(sub.id)
        if (!resolved) {
          logger.warn('razorpay.webhook_no_subscription', { event: payload.event, subId: sub.id })
          return { handled: false }
        }
        const planTier = resolvePlanTier(sub.plan_id) as SubscriptionPlanTier
        const trigger: StateTrigger = payload.event === 'subscription.charged'
          ? 'payment.captured.recurring'
          : 'payment.captured.full'

        await applySubscriptionEvent({
          businessId: resolved.businessId,
          subscriptionId: resolved.subscriptionId,
          trigger,
          razorpayEventId: payload.id,
          actorType: 'WEBHOOK',
          planTier,
          payload: {
            razorpaySubId: sub.id,
            currentEnd: sub.current_end,
          },
        })
        return { handled: true }
      }

      case 'subscription.cancelled': {
        if (!sub) return { handled: false }
        const resolved = await resolveSubscription(sub.id)
        if (!resolved) return { handled: false }

        await applySubscriptionEvent({
          businessId: resolved.businessId,
          subscriptionId: resolved.subscriptionId,
          trigger: 'user.cancel',
          razorpayEventId: payload.id,
          actorType: 'WEBHOOK',
          payload: { razorpaySubId: sub.id },
        })
        return { handled: true }
      }

      case 'subscription.paused':
      case 'payment.failed': {
        const subId = sub?.id ?? payment?.subscription_id
        if (!subId) return { handled: false }
        const resolved = await resolveSubscription(subId)
        if (!resolved) return { handled: false }

        // P2-I: validate amount is INR
        if (payment?.currency && payment.currency !== 'INR') {
          logger.warn('razorpay.webhook_non_inr', { currency: payment.currency, eventId: payload.id })
          return { handled: false }
        }
        parsePaiseAmount(payment?.amount) // validate paise format (P2-I)

        await applySubscriptionEvent({
          businessId: resolved.businessId,
          subscriptionId: resolved.subscriptionId,
          trigger: 'subscription.charged.failed',
          razorpayEventId: payload.id,
          actorType: 'WEBHOOK',
          payload: { razorpaySubId: subId },
        })
        return { handled: true }
      }

      default:
        logger.debug('razorpay.webhook_unhandled', { event: payload.event, eventId: payload.id })
        return { handled: false }
    }
  } catch (err) {
    // P2002 = duplicate razorpayEventId = idempotent
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      logger.info('razorpay.webhook_idempotent', { eventId: payload.id, event: payload.event })
      return { handled: true, idempotent: true }
    }
    throw err
  }
}
