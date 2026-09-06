/**
 * Token-mandate lifecycle service.
 *
 * Row-first registration: the pending UpiMandate row is committed
 * BEFORE any provider call. Binding a confirmed token happens ONLY on
 * positive resolution (webhook or sweep) with businessId/userId equality.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import logger from '../../../lib/logger.js'
import {
  createCustomer,
  deleteCustomerToken,
} from './razorpay-token.client.js'
import {
  MANDATE_EXPIRE_YEARS,
  mandateCeilingPaise,
} from './token-engine.constants.js'
import type {
  MandateStatusReason,
  RazorpayTokenEntity,
  TokenRegistrationClientPayload,
} from './token-engine.types.js'
import { getRegistrationAdapter } from './token-registration.adapter.js'
import {
  supersedePendingMandatesForBusiness,
  cancelPendingMandateAsAbandoned,
} from './token-mandate.lifecycle.js'
import type { SubscriptionPlanTier } from '../subscription.types.js'

export class MandateExistsError extends Error {
  override readonly name = 'MandateExistsError'
  constructor(public readonly businessId: string) {
    super(`Business ${businessId} already has a live token mandate`)
  }
}

function isP2002(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

const TIER_PRICES: Record<string, number> = {
  PRO_MONTHLY: 49900,
  PRO_YEARLY: 499900,
  BUSINESS_MONTHLY: 99900,
  BUSINESS_YEARLY: 999900,
  PRO_MAX_MONTHLY: 199900,
  PRO_MAX_YEARLY: 1999900,
}

export async function startTokenRegistration(
  businessId: string,
  userId: string,
  tier: SubscriptionPlanTier,
  billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY',
): Promise<{ mandateId: string; client: TokenRegistrationClientPayload }> {
  if (tier === 'FREE') {
    throw new Error('Cannot register token mandate for FREE tier')
  }

  const confirmedMandate = await prisma.upiMandate.findFirst({
    where: { businessId, status: 'ACTIVE', razorpayTokenId: { not: null } },
    select: { id: true },
  })
  if (confirmedMandate) {
    throw new MandateExistsError(businessId)
  }

  await supersedePendingMandatesForBusiness(businessId)

  const priceKey = `${tier}_${billingCycle}`
  const pricePaise = TIER_PRICES[priceKey] ?? 49900
  const maxAmountPaise = mandateCeilingPaise(pricePaise)

  const [business, user] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true, phone: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, phone: true, email: true } }),
  ])

  const customerName = user?.name || business?.name || 'HisaabPro Merchant'
  const customerPhone = user?.phone || business?.phone || '9999999999'
  const customerEmail = user?.email || `${userId}@hisaabpro.local`

  const customer = await createCustomer({
    name: customerName,
    contact: customerPhone,
    email: customerEmail,
  })

  const expireAt = new Date()
  expireAt.setFullYear(expireAt.getFullYear() + MANDATE_EXPIRE_YEARS)

  const sub = await prisma.subscription.findUnique({
    where: { businessId },
    select: { id: true },
  })
  if (!sub) {
    throw new Error(`Subscription not found for business ${businessId}`)
  }

  const pendingMandate = await prisma.upiMandate.create({
    data: {
      businessId,
      userId,
      subscriptionId: sub.id,
      razorpayCustomerId: customer.id,
      status: 'PENDING',
      planTier: tier,
      billingCycle,
      maxAmountPaise,
      frequency: 'as_presented',
      expireAt,
      registrationMode: 'checkout_order',
    },
  })

  try {
    const adapter = getRegistrationAdapter()
    const client = await adapter({
      businessId,
      userId,
      mandateRegistrationId: pendingMandate.id,
      razorpayCustomerId: customer.id,
      maxAmountPaise,
      expireAtUnix: Math.floor(expireAt.getTime() / 1000),
      receipt: pendingMandate.id.slice(0, 40),
      customer: {
        name: customerName,
        contact: customerPhone,
        email: customerEmail,
      },
    })
    return { mandateId: pendingMandate.id, client }
  } catch (err) {
    await prisma.upiMandate.update({
      where: { id: pendingMandate.id },
      data: { status: 'FAILED', statusReason: 'provider_declined' },
    })
    throw err
  }
}

export async function bindConfirmedToken(
  mandateId: string,
  expectedBusinessId: string,
  token: RazorpayTokenEntity,
): Promise<{ bound: boolean }> {
  const row = await prisma.upiMandate.findUnique({ where: { id: mandateId } })
  if (!row) throw new Error(`Mandate ${mandateId} not found for token bind`)
  if (row.businessId !== expectedBusinessId) {
    logger.error('Token bind businessId mismatch', {
      mandateId,
      rowBusinessId: row.businessId,
      claimedBusinessId: expectedBusinessId,
      tokenId: token.id,
    })
    throw new Error(`Token bind refused: businessId mismatch on mandate ${mandateId}`)
  }

  if (row.razorpayTokenId === token.id && row.status === 'ACTIVE') {
    return { bound: false }
  }

  const vpa = token.vpa ? [token.vpa.username, token.vpa.handle].filter(Boolean).join('@') : null
  const vpaLast4 = vpa ? vpa.slice(0, vpa.indexOf('@') >= 0 ? vpa.indexOf('@') : undefined).slice(-4) : null

  try {
    await prisma.upiMandate.update({
      where: { id: mandateId },
      data: {
        razorpayTokenId: token.id,
        status: 'ACTIVE',
        statusReason: 'provider_confirmed',
        vpaLast4: vpaLast4 ?? row.vpaLast4,
        vpa: vpa ?? row.vpa,
        ...(token.expired_at ? { expireAt: new Date(token.expired_at * 1000) } : {}),
      },
    })
    return { bound: true }
  } catch (e) {
    if (isP2002(e)) {
      await prisma.upiMandate.update({
        where: { id: mandateId },
        data: { status: 'FAILED', statusReason: 'provider_declined' },
      })
      return { bound: false }
    }
    throw e
  }
}

export async function attachSubscriptionToMandate(mandateId: string, subscriptionId: string): Promise<void> {
  await prisma.upiMandate.update({
    where: { id: mandateId },
    data: { subscriptionId },
  })
}

export async function markMandateStatus(
  mandateId: string,
  status: string,
  statusReason?: MandateStatusReason,
): Promise<void> {
  await prisma.upiMandate.update({
    where: { id: mandateId },
    data: { status, statusReason },
  })
}

export async function cancelMandate(
  mandateId: string,
  businessId: string,
  reason: MandateStatusReason = 'user_cancelled',
): Promise<void> {
  const mandate = await prisma.upiMandate.findFirst({
    where: { id: mandateId, businessId },
  })
  if (!mandate) return

  if (mandate.razorpayCustomerId && mandate.razorpayTokenId) {
    try {
      await deleteCustomerToken(mandate.razorpayCustomerId, mandate.razorpayTokenId)
    } catch (e) {
      logger.warn('Failed to delete customer token at provider', { error: e, mandateId })
    }
  }

  await prisma.upiMandate.update({
    where: { id: mandateId },
    data: { status: 'REVOKED', statusReason: reason },
  })
}

export async function cancelPendingMandateForBusiness(businessId: string): Promise<{ cancelled: boolean }> {
  return cancelPendingMandateAsAbandoned(businessId)
}
