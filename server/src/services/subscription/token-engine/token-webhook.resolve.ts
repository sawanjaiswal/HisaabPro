/**
 * Webhook -> local-row resolution chain.
 */

import { prisma } from '../../../lib/prisma.js'
import type {
  ResolvedTokenContext,
  TokenWebhookPaymentEntity,
  TokenWebhookTokenEntity,
} from './token-engine.types.js'

function notesOf(e: { notes?: Record<string, string> | string[] } | null | undefined): Record<string, string> {
  const n = e?.notes
  return n && !Array.isArray(n) ? n : {}
}

const mandateSelect = {
  id: true,
  businessId: true,
  userId: true,
  subscriptionId: true,
  razorpayCustomerId: true,
  razorpayTokenId: true,
  status: true,
  maxAmountPaise: true,
} as const

const attemptSelect = {
  id: true,
  businessId: true,
  userId: true,
  subscriptionId: true,
  cycleKey: true,
  attemptNo: true,
  amountPaise: true,
  receiptKey: true,
  status: true,
  mandateId: true,
} as const

export async function resolveTokenPaymentContext(
  payment: TokenWebhookPaymentEntity,
): Promise<ResolvedTokenContext | null> {
  const notes = notesOf(payment)

  let attempt = payment.order_id
    ? await prisma.tokenChargeAttempt.findFirst({
        where: { razorpayOrderId: payment.order_id },
        select: attemptSelect,
      })
    : null

  if (!attempt && notes.cycleKey && notes.subscriptionId) {
    attempt = await prisma.tokenChargeAttempt.findFirst({
      where: { subscriptionId: notes.subscriptionId, cycleKey: notes.cycleKey, status: { not: 'ABANDONED' } },
      orderBy: { attemptNo: 'desc' },
      select: attemptSelect,
    })
  }

  if (attempt) {
    const mandate = await prisma.upiMandate.findUnique({
      where: { id: attempt.mandateId },
      select: mandateSelect,
    })
    if (!mandate) return null
    return { mandate, attempt }
  }

  if (payment.token_id) {
    const mandate = await prisma.upiMandate.findUnique({
      where: { razorpayTokenId: payment.token_id },
      select: mandateSelect,
    })
    if (mandate) {
      return { mandate, attempt: null }
    }
  }

  if (notes.mandateRegistrationId) {
    const mandate = await prisma.upiMandate.findUnique({
      where: { id: notes.mandateRegistrationId },
      select: mandateSelect,
    })
    if (mandate) {
      return { mandate, attempt: null }
    }
  }

  return null
}

export async function resolveTokenTokenContext(
  token: TokenWebhookTokenEntity,
): Promise<ResolvedTokenContext | null> {
  const notes = notesOf(token)

  if (token.id) {
    const mandate = await prisma.upiMandate.findUnique({
      where: { razorpayTokenId: token.id },
      select: mandateSelect,
    })
    if (mandate) return { mandate, attempt: null }
  }

  if (notes.mandateRegistrationId) {
    const mandate = await prisma.upiMandate.findUnique({
      where: { id: notes.mandateRegistrationId },
      select: mandateSelect,
    })
    if (mandate) return { mandate, attempt: null }
  }

  if (token.customer_id) {
    const mandate = await prisma.upiMandate.findFirst({
      where: { razorpayCustomerId: token.customer_id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: mandateSelect,
    })
    if (mandate) return { mandate, attempt: null }
  }

  return null
}
