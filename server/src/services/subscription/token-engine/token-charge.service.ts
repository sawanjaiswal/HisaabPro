/**
 * Reserve-then-charge token billing service.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import logger from '../../../lib/logger.js'
import {
  createDebitOrder,
  createRecurringPayment,
} from './razorpay-token.client.js'
import { generateReceiptKey } from './token-engine.constants.js'

function isP2002(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

export interface ReserveAttemptInput {
  businessId: string
  userId: string
  subscriptionId: string
  mandateId: string
  cycleKey: string
  attemptNo: number
  amountPaise: number
  chargeAt: Date
}

export async function reserveAttempt(input: ReserveAttemptInput) {
  try {
    return await prisma.tokenChargeAttempt.create({
      data: {
        businessId: input.businessId,
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        mandateId: input.mandateId,
        cycleKey: input.cycleKey,
        attemptNo: input.attemptNo,
        amountPaise: input.amountPaise,
        receiptKey: generateReceiptKey(),
        status: 'SCHEDULED',
        chargeAt: input.chargeAt,
      },
    })
  } catch (e) {
    if (isP2002(e)) return null
    throw e
  }
}

export type AttemptRow = NonNullable<Awaited<ReturnType<typeof prisma.tokenChargeAttempt.findUnique>>>

export async function executeAttempt(attempt: AttemptRow): Promise<void> {
  const [mandate, user, business] = await Promise.all([
    prisma.upiMandate.findUnique({ where: { id: attempt.mandateId } }),
    prisma.user.findUnique({ where: { id: attempt.userId }, select: { phone: true, email: true } }),
    prisma.business.findUnique({ where: { id: attempt.businessId }, select: { name: true, phone: true } }),
  ])

  if (!mandate || mandate.status !== 'ACTIVE' || !mandate.razorpayTokenId) {
    await prisma.tokenChargeAttempt.update({
      where: { id: attempt.id },
      data: { status: 'FAILED', failureReason: 'mandate_not_active' },
    })
    return
  }

  if (attempt.amountPaise > mandate.maxAmountPaise) {
    await prisma.tokenChargeAttempt.update({
      where: { id: attempt.id },
      data: { status: 'FAILED', failureReason: 'amount_exceeds_mandate_ceiling' },
    })
    return
  }

  const order = await createDebitOrder({
    amountPaise: attempt.amountPaise,
    receipt: attempt.receiptKey,
    notes: {
      businessId: attempt.businessId,
      attemptId: attempt.id,
      cycleKey: attempt.cycleKey,
    },
  })

  await prisma.tokenChargeAttempt.update({
    where: { id: attempt.id },
    data: {
      razorpayOrderId: order.id,
      status: 'CALLED',
      calledAt: new Date(),
    },
  })

  try {
    const payment = await createRecurringPayment({
      amountPaise: attempt.amountPaise,
      orderId: order.id,
      customerId: mandate.razorpayCustomerId || '',
      tokenId: mandate.razorpayTokenId,
      email: user?.email || `${attempt.userId}@hisaabpro.local`,
      contact: user?.phone || business?.phone || '9999999999',
      description: `HisaabPro Subscription Renewal (Attempt ${attempt.attemptNo})`,
      notes: {
        businessId: attempt.businessId,
        attemptId: attempt.id,
        mandateId: mandate.id,
      },
    })

    await prisma.tokenChargeAttempt.update({
      where: { id: attempt.id },
      data: { razorpayPaymentId: payment.razorpay_payment_id },
    })

    logger.info('Recurring token charge initiated', {
      attemptId: attempt.id,
      paymentId: payment.razorpay_payment_id,
      orderId: order.id,
      businessId: attempt.businessId,
    })
  } catch (err) {
    logger.error('Failed to create recurring payment with provider', {
      attemptId: attempt.id,
      orderId: order.id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export async function markAttemptCaptured(attemptId: string, paymentId?: string): Promise<void> {
  await prisma.tokenChargeAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'CAPTURED',
      settledAt: new Date(),
      ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
    },
  })
}

export async function markAttemptFailed(attemptId: string, reason: string): Promise<void> {
  await prisma.tokenChargeAttempt.update({
    where: { id: attemptId },
    data: {
      status: 'FAILED',
      failureReason: reason,
      settledAt: new Date(),
    },
  })
}
