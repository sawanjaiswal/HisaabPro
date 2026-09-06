/**
 * Token-billing webhook handlers.
 */

import { prisma } from '../../../lib/prisma.js'
import {
  bindConfirmedToken,
  markMandateStatus,
} from './token-mandate.service.js'
import { activateFromMandate } from './token-mandate.activate.js'
import { markAttemptCaptured, markAttemptFailed, reserveAttempt } from './token-charge.service.js'
import { nextAttemptAfterFailure } from './token-charge.ladder.js'
import { applySubscriptionEvent } from '../subscription.writer.js'
import type {
  ResolvedTokenContext,
  TokenWebhookPaymentEntity,
  TokenWebhookTokenEntity,
} from './token-engine.types.js'

export async function handleTokenConfirmed(
  ctx: ResolvedTokenContext,
  token: TokenWebhookTokenEntity,
): Promise<void> {
  const { bound } = await bindConfirmedToken(
    ctx.mandate.id,
    ctx.mandate.businessId,
    token as any,
  )

  if (bound || ctx.mandate.status === 'ACTIVE') {
    await activateFromMandate(ctx.mandate.id)
  }
}

export async function handleTokenStatusChange(
  ctx: ResolvedTokenContext,
  status: 'PAUSED' | 'REVOKED' | 'FAILED',
  reason: 'provider_declined' | 'user_cancelled',
): Promise<void> {
  await markMandateStatus(ctx.mandate.id, status, reason)
}

export async function settleCapturedAttempt(
  attempt: {
    id: string
    businessId: string
    userId: string
    subscriptionId: string
    cycleKey: string
    attemptNo: number
    amountPaise: number
  },
  paymentId?: string,
): Promise<void> {
  await markAttemptCaptured(attempt.id, paymentId)

  const sub = await prisma.subscription.findUnique({
    where: { id: attempt.subscriptionId },
    select: { id: true, businessId: true, nextBillingAt: true, expiresAt: true, planTier: true },
  })

  if (!sub) return

  const currentEnd = sub.nextBillingAt || sub.expiresAt || new Date()
  const nextEnd = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000)

  await applySubscriptionEvent({
    businessId: sub.businessId,
    subscriptionId: sub.id,
    trigger: 'payment.captured.recurring',
    actorType: 'WEBHOOK',
    amount: attempt.amountPaise,
    payload: {
      attemptId: attempt.id,
      paymentId,
      nextBillingAt: nextEnd.toISOString(),
    },
  })
}

export async function settleFailedAttempt(
  attempt: {
    id: string
    businessId: string
    userId: string
    subscriptionId: string
    mandateId?: string
    cycleKey: string
    attemptNo: number
    amountPaise: number
  },
  reason: string,
): Promise<void> {
  await markAttemptFailed(attempt.id, reason)

  const sub = await prisma.subscription.findUnique({
    where: { id: attempt.subscriptionId },
    select: { nextBillingAt: true, expiresAt: true },
  })
  const currentEnd = sub?.nextBillingAt || sub?.expiresAt || new Date()

  const next = nextAttemptAfterFailure(currentEnd, attempt.attemptNo)
  if (next && attempt.mandateId) {
    await reserveAttempt({
      businessId: attempt.businessId,
      userId: attempt.userId,
      subscriptionId: attempt.subscriptionId,
      mandateId: attempt.mandateId,
      cycleKey: attempt.cycleKey,
      attemptNo: next.attemptNo,
      amountPaise: attempt.amountPaise,
      chargeAt: next.callAt,
    })
  } else {
    // Ladder exhausted
    await applySubscriptionEvent({
      businessId: attempt.businessId,
      subscriptionId: attempt.subscriptionId,
      trigger: 'subscription.charged.failed',
      actorType: 'WEBHOOK',
      payload: { attemptId: attempt.id, reason },
    })
  }
}

export async function handleTokenPaymentCaptured(
  ctx: ResolvedTokenContext,
  payment: TokenWebhookPaymentEntity,
): Promise<void> {
  if (ctx.attempt) {
    await settleCapturedAttempt(ctx.attempt, payment.id)
  } else if (ctx.mandate) {
    await activateFromMandate(ctx.mandate.id)
  }
}

export async function handleTokenPaymentFailed(
  ctx: ResolvedTokenContext,
  payment: TokenWebhookPaymentEntity,
): Promise<void> {
  if (ctx.attempt) {
    await settleFailedAttempt(
      ctx.attempt,
      payment.error_description || 'provider_payment_failed',
    )
  }
}
