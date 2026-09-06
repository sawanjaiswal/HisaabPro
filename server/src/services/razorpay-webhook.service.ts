/**
 * Razorpay Webhook Event Handlers — routes events through state-machine writer.
 *
 * SECURITY P1-A: Replay-age check — created_at must be <= 5 min old.
 * SECURITY P1-F: businessId resolved from razorpaySubscriptionId DB lookup.
 * SECURITY P2-A: payload.id presence validated before idempotency insert.
 * SECURITY P2-I: amount parsed as Int paise; currency validated = INR.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import type { PlanTier } from '../config/plans.js'
import { applySubscriptionEvent } from './subscription/subscription.writer.js'
import type { StateTrigger, SubscriptionPlanTier } from './subscription/subscription.types.js'
import {
  resolveTokenPaymentContext,
  resolveTokenTokenContext,
} from './subscription/token-engine/token-webhook.resolve.js'
import {
  handleTokenConfirmed,
  handleTokenStatusChange,
  handleTokenPaymentCaptured,
  handleTokenPaymentFailed,
} from './subscription/token-engine/token-webhook.handlers.js'
import type {
  TokenWebhookPaymentEntity,
  TokenWebhookTokenEntity,
} from './subscription/token-engine/token-engine.types.js'

const MAX_EVENT_AGE_MS = 5 * 60 * 1000

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
  id?: string
  event: string
  created_at?: number
  payload: {
    subscription?: { entity: SubscriptionEntity }
    payment?: { entity: PaymentEntity }
    token?: { entity: TokenWebhookTokenEntity }
  }
}

export interface WebhookResult {
  handled: boolean
  idempotent?: boolean
  stale?: boolean
}

function isStale(createdAt: number | undefined): boolean {
  if (!createdAt) return false
  return Date.now() - createdAt * 1000 > MAX_EVENT_AGE_MS
}

function resolvePlanTier(razorpayPlanId: string | undefined): PlanTier {
  if (!razorpayPlanId) return 'FREE'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_PRO) return 'PRO'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_BUSINESS) return 'BUSINESS'
  if (razorpayPlanId === process.env.RAZORPAY_PLAN_PRO_MAX) return 'PRO_MAX'
  return 'FREE'
}

async function resolveSubscription(razorpaySubId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { razorpaySubId },
    select: { businessId: true, id: true },
  })
  if (!sub) return null
  return { businessId: sub.businessId, subscriptionId: sub.id }
}

function parsePaiseAmount(raw: number | undefined): number {
  if (!raw) return 0
  const parsed = parseInt(String(raw), 10)
  if (!Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Invalid paise amount: ${raw}`)
  }
  return parsed
}

export async function processWebhookEvent(payload: WebhookPayload): Promise<WebhookResult> {
  if (!payload.id || typeof payload.id !== 'string') {
    logger.warn('razorpay.webhook_missing_event_id', { event: payload.event })
    return { handled: false }
  }

  if (isStale(payload.created_at)) {
    logger.warn('razorpay.webhook_stale', { eventId: payload.id, event: payload.event })
    return { handled: true, stale: true }
  }

  const sub = payload.payload.subscription?.entity
  const payment = payload.payload.payment?.entity

  try {
    switch (payload.event) {
      case 'token.confirmed': {
        const token = payload.payload.token?.entity
        if (!token) return { handled: false }
        const ctx = await resolveTokenTokenContext(token)
        if (!ctx) return { handled: false }
        await handleTokenConfirmed(ctx, token)
        return { handled: true }
      }

      case 'token.rejected':
      case 'token.paused':
      case 'token.cancelled': {
        const token = payload.payload.token?.entity
        if (!token) return { handled: false }
        const ctx = await resolveTokenTokenContext(token)
        if (!ctx) return { handled: false }
        const status = payload.event === 'token.paused' ? 'PAUSED' : payload.event === 'token.cancelled' ? 'REVOKED' : 'FAILED'
        const reason = payload.event === 'token.cancelled' ? 'user_cancelled' : 'provider_declined'
        await handleTokenStatusChange(ctx, status, reason)
        return { handled: true }
      }

      case 'payment.captured':
      case 'payment.authorized':
      case 'order.paid': {
        if (payment) {
          const ctx = await resolveTokenPaymentContext(payment as TokenWebhookPaymentEntity)
          if (ctx) {
            await handleTokenPaymentCaptured(ctx, payment as TokenWebhookPaymentEntity)
            return { handled: true }
          }
        }
        return { handled: false }
      }

      case 'subscription.activated':
      case 'subscription.charged': {
        if (!sub) return { handled: false }
        const resolved = await resolveSubscription(sub.id)
        if (!resolved) return { handled: false }
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
          payload: { razorpaySubId: sub.id, currentEnd: sub.current_end },
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
        if (payment) {
          const tokenCtx = await resolveTokenPaymentContext(payment as TokenWebhookPaymentEntity)
          if (tokenCtx) {
            await handleTokenPaymentFailed(tokenCtx, payment as TokenWebhookPaymentEntity)
            return { handled: true }
          }
        }
        const subId = sub?.id ?? payment?.subscription_id
        if (!subId) return { handled: false }
        const resolved = await resolveSubscription(subId)
        if (!resolved) return { handled: false }

        if (payment?.currency && payment.currency !== 'INR') return { handled: false }
        parsePaiseAmount(payment?.amount)

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
        return { handled: false }
    }
  } catch (err) {
    const e = err as { code?: string }
    if (e.code === 'P2002') {
      logger.info('razorpay.webhook_idempotent', { eventId: payload.id, event: payload.event })
      return { handled: true, idempotent: true }
    }
    throw err
  }
}
