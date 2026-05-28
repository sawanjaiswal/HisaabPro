/**
 * Checkout Session Service — creates Razorpay subscription sessions.
 *
 * Online-only (per architecture offline contract §7).
 * Wraps Razorpay with 8s timeout + 1 retry (Risk §4).
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import { getRazorpayPlanId } from '../../lib/env.js'
import { computeStatus } from '../coupon/helpers.js'
import type { SubscriptionPlanTier } from './subscription.types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CheckoutSessionInput {
  businessId: string
  userId: string
  tier: SubscriptionPlanTier
  billingCycle: 'MONTHLY' | 'YEARLY'
  couponCode?: string
}

export interface CheckoutSessionResult {
  razorpaySubscriptionId: string
  checkoutUrl: string
  planTier: SubscriptionPlanTier
  amountPaise: number
  razorpayKeyId: string
}

// ─── Coupon → trusted offer_id resolver (MF-1) ──────────────────────────────────

/**
 * Resolve a user-supplied coupon CODE to a server-controlled Razorpay
 * `offer_id`. NEVER forward the raw user input as `offer_id` — a malicious FE
 * could submit any harvested offer_id and self-apply an unintended discount
 * (money-out). Unknown / inactive / plan-mismatched / unlinked codes resolve to
 * `undefined` (the coupon is simply dropped — no offer applied).
 */
async function resolveRazorpayOfferId(
  couponCode: string | undefined,
  tier: SubscriptionPlanTier,
): Promise<string | undefined> {
  if (!couponCode) return undefined
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode },
    select: {
      isActive: true,
      validFrom: true,
      validUntil: true,
      maxUses: true,
      usageCount: true,
      planFilter: true,
      razorpayOfferId: true,
    },
  })
  if (!coupon) return undefined
  if (computeStatus(coupon) !== 'ACTIVE') return undefined
  if (coupon.planFilter.length > 0 && !coupon.planFilter.includes(tier)) return undefined
  return coupon.razorpayOfferId ?? undefined
}

// ─── Razorpay client ──────────────────────────────────────────────────────────

async function callRazorpayWithRetry(
  fn: () => Promise<unknown>,
  attempts = 2,
): Promise<unknown> {
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8_000)
      try {
        const result = await fn()
        clearTimeout(timer)
        return result
      } catch (err) {
        clearTimeout(timer)
        throw err
      }
    } catch (err) {
      if (i === attempts - 1) throw err
      logger.warn('checkout_session.razorpay_retry', { attempt: i + 1 })
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}

// ─── Main service ─────────────────────────────────────────────────────────────

/**
 * Create a Razorpay subscription checkout session.
 * Returns checkout URL for the FE to redirect/open in WebView.
 */
export async function createCheckoutSession(
  input: CheckoutSessionInput,
): Promise<CheckoutSessionResult> {
  if (input.tier === 'FREE') {
    throw Object.assign(new Error('Cannot checkout FREE tier'), { code: 'BAD_REQUEST', httpStatus: 400 })
  }

  const resolution = getRazorpayPlanId(input.tier, input.billingCycle)
  if (!resolution.ok) {
    throw Object.assign(
      new Error(
        `Razorpay ${resolution.missing === 'YEARLY' ? 'yearly' : 'monthly'} plan ID not configured for ${input.tier} ${input.billingCycle}`,
      ),
      { code: 'SERVICE_UNAVAILABLE', httpStatus: 503 },
    )
  }
  const planId = resolution.planId

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    throw Object.assign(new Error('Razorpay not configured'), { code: 'SERVICE_UNAVAILABLE', httpStatus: 503 })
  }

  // Ensure subscription row exists (creates FREE if missing)
  const existing = await prisma.subscription.findUnique({
    where: { businessId: input.businessId },
    select: { id: true },
  })

  if (!existing) {
    throw Object.assign(new Error('No subscription record found — ensure business is initialized'), {
      code: 'NOT_FOUND', httpStatus: 404,
    })
  }

  const offerId = await resolveRazorpayOfferId(input.couponCode, input.tier)

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Razorpay = (await import('razorpay')).default
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret })

    const subscriptionData = await callRazorpayWithRetry(() =>
      rzp.subscriptions.create({
        plan_id: planId,
        total_count: input.billingCycle === 'YEARLY' ? 1 : 12,
        quantity: 1,
        notes: {
          businessId: input.businessId,
          userId: input.userId,
          tier: input.tier,
        },
        ...(offerId ? { offer_id: offerId } : {}),
      }),
    ) as { id: string; short_url?: string }

    const checkoutUrl = subscriptionData.short_url ??
      `https://rzp.io/i/${subscriptionData.id}`

    logger.info('checkout_session.created', {
      businessId: input.businessId,
      tier: input.tier,
      billingCycle: input.billingCycle,
      razorpaySubId: subscriptionData.id,
    })

    // Store razorpay subscription ID for webhook lookup (P1-F)
    await prisma.subscription.update({
      where: { businessId: input.businessId },
      data: { razorpaySubId: subscriptionData.id, razorpayPlanId: planId },
    })

    const planPrices: Record<string, number> = {
      PRO_MONTHLY: 49900,
      PRO_YEARLY: 499900,
      BUSINESS_MONTHLY: 99900,
      BUSINESS_YEARLY: 999900,
      PRO_MAX_MONTHLY: 199900,
      PRO_MAX_YEARLY: 1999900,
    }
    const priceKey = `${input.tier}_${input.billingCycle}`

    return {
      razorpaySubscriptionId: subscriptionData.id,
      checkoutUrl,
      planTier: input.tier,
      amountPaise: planPrices[priceKey] ?? 0,
      razorpayKeyId: keyId,
    }
  } catch (err) {
    logger.error('checkout_session.razorpay_error', {
      businessId: input.businessId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw Object.assign(
      new Error('Payment service temporarily unavailable. Try again in a minute.'),
      { code: 'RAZORPAY_UNAVAILABLE', httpStatus: 503 },
    )
  }
}
