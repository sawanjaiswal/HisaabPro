/**
 * UPI Mandate Service — create and revoke UPI Autopay mandates.
 *
 * SECURITY P2-G: VPA is never logged in full — masked via maskVpa().
 * All UpiMandate rows store only vpaLast4 (masked), never full VPA.
 */

import logger from '../../lib/logger.js'
import { prisma } from '../../lib/prisma.js'
import { buildUpiMandateDeepLink, maskVpa } from './upi-intent.utils.js'
import { applySubscriptionEvent } from './subscription.writer.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateMandateInput {
  businessId: string
  subscriptionId: string
  maxAmountPaise: number  // Int paise — must be > 0
  frequency: 'MONTHLY' | 'YEARLY'
  upiVpa?: string         // Optional — if provided, build deep-link
}

export interface CreateMandateResult {
  mandateId: string
  upiIntentUrl: string | null
  status: 'PENDING'
}

export interface RevokeMandateResult {
  mandateId: string
  status: 'REVOKED'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMerchantVpa(): string {
  return process.env.RAZORPAY_MERCHANT_VPA ?? 'merchant@razorpay'
}

function getMerchantName(): string {
  return process.env.RAZORPAY_MERCHANT_NAME ?? 'HisaabPro'
}

/** Extract last 4 chars before @ for storage */
function extractLast4(vpa: string): string {
  const atIdx = vpa.indexOf('@')
  const local = atIdx >= 0 ? vpa.slice(0, atIdx) : vpa
  return local.slice(-4)
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Create a UPI mandate record and return intent URL.
 * Razorpay mandate token creation is async (webhook-confirmed).
 * Returns PENDING status immediately; ACTIVE comes via webhook.
 */
export async function createMandate(
  input: CreateMandateInput,
): Promise<CreateMandateResult> {
  if (input.maxAmountPaise <= 0) {
    throw new Error('maxAmountPaise must be a positive integer (paise)')
  }

  // Create mandate record in PENDING state (tenant-scoped)
  const mandate = await prisma.upiMandate.create({
    data: {
      businessId: input.businessId,
      subscriptionId: input.subscriptionId,
      status: 'PENDING',
      maxAmountPaise: input.maxAmountPaise,
      frequency: input.frequency,
      vpaLast4: input.upiVpa ? extractLast4(input.upiVpa) : null,
    },
  })

  logger.info('upi_mandate.created', {
    businessId: input.businessId,
    mandateId: mandate.id,
    frequency: input.frequency,
    vpaMasked: input.upiVpa ? maskVpa(input.upiVpa) : null,
    // NEVER log full VPA (P2-G)
  })

  // Build UPI deep-link if VPA provided
  let upiIntentUrl: string | null = null
  if (input.upiVpa) {
    upiIntentUrl = buildUpiMandateDeepLink({
      vpa: input.upiVpa,
      payerName: getMerchantName(),
      maxAmountPaise: input.maxAmountPaise,
      frequency: input.frequency,
      note: `HisaabPro subscription mandate`,
      merchantVpa: getMerchantVpa(),
      merchantName: getMerchantName(),
      transactionRef: mandate.id,
    })
  }

  // Trigger state machine: mandate.created
  await applySubscriptionEvent({
    businessId: input.businessId,
    subscriptionId: input.subscriptionId,
    trigger: 'mandate.created',
    actorType: 'USER',
    payload: { mandateId: mandate.id },
  })

  return {
    mandateId: mandate.id,
    upiIntentUrl,
    status: 'PENDING',
  }
}

/**
 * Revoke a UPI mandate — sets status to REVOKED.
 * Triggers state machine mandate.cancelled event.
 */
export async function revokeMandate(
  businessId: string,
  mandateId: string,
): Promise<RevokeMandateResult> {
  // Tenant-scoped lookup
  const mandate = await prisma.upiMandate.findFirst({
    where: { id: mandateId, businessId },
    select: { id: true, subscriptionId: true, status: true },
  })

  if (!mandate) {
    throw Object.assign(new Error('Mandate not found'), { code: 'NOT_FOUND', httpStatus: 404 })
  }

  if (mandate.status === 'REVOKED') {
    return { mandateId: mandate.id, status: 'REVOKED' }
  }

  // Update mandate to REVOKED (tenant-scoped)
  await prisma.upiMandate.update({
    where: { id: mandate.id, businessId },
    data: { status: 'REVOKED' },
  })

  logger.info('upi_mandate.revoked', { businessId, mandateId })

  // Trigger state machine: mandate.cancelled
  await applySubscriptionEvent({
    businessId,
    subscriptionId: mandate.subscriptionId,
    trigger: 'mandate.cancelled',
    actorType: 'USER',
    payload: { mandateId },
  })

  return { mandateId: mandate.id, status: 'REVOKED' }
}

/**
 * Get current mandate status for a business (tenant-scoped).
 */
export async function getMandateStatus(businessId: string) {
  const mandate = await prisma.upiMandate.findFirst({
    where: { businessId, status: { in: ['PENDING', 'ACTIVE'] } },
    select: { id: true, status: true, vpaLast4: true, frequency: true, nextChargeAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return mandate
    ? { mandateId: mandate.id, status: mandate.status, vpaLast4: mandate.vpaLast4, frequency: mandate.frequency, nextChargeAt: mandate.nextChargeAt }
    : { mandateId: null, status: null, vpaLast4: null, frequency: null, nextChargeAt: null }
}
