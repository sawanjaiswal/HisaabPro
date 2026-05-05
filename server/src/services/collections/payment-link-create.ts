/**
 * Payment Link — create + list helpers (MB-5: amount gate enforced here).
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import { createLink } from '../razorpay/payment-link.client.js'
import logger from '../../lib/logger.js'

const DEFAULT_EXPIRY_DAYS = 7
const ALLOWED_STATUSES = ['SAVED', 'SHARED'] as const

export interface CreatePaymentLinkOpts {
  amountPaise?: number
  expiryDays?: number
  idempotencyKey?: string
}

export async function createPaymentLink(
  businessId: string,
  invoiceId: string,
  userId: string,
  opts: CreatePaymentLinkOpts = {},
) {
  const { expiryDays = DEFAULT_EXPIRY_DAYS, idempotencyKey } = opts

  // Idempotency: return existing CREATED link if same key
  if (idempotencyKey) {
    const existing = await prisma.paymentLink.findFirst({
      where: { createIdempotencyKey: idempotencyKey, businessId, isDeleted: false },
    })
    if (existing) {
      logger.info('payment_link.idempotent_hit', { linkId: existing.id, invoiceId })
      return { link: existing, idempotent: true }
    }
  }

  // Validate invoice in transaction (MB-5: re-read outstanding inside tx)
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.document.findFirst({
      where: { id: invoiceId, businessId, isDeleted: false },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        balanceDue: true,
        partyId: true,
        party: { select: { name: true, phone: true } },
      },
    })
    if (!invoice) throw notFoundError('Invoice')

    if (!ALLOWED_STATUSES.includes(invoice.status as typeof ALLOWED_STATUSES[number])) {
      throw validationError(
        `Payment link can only be created for ${ALLOWED_STATUSES.join('/')} invoices (current: ${invoice.status})`,
      )
    }

    // MB-5: outstanding check inside transaction
    const outstanding = invoice.balanceDue
    if (outstanding <= 0) {
      throw validationError('Invoice has no outstanding balance')
    }

    const requestedAmount = opts.amountPaise ?? outstanding
    if (requestedAmount > outstanding) {
      throw Object.assign(
        validationError(`Requested amount (${requestedAmount} paise) exceeds outstanding balance (${outstanding} paise)`),
        { code: 'AMOUNT_EXCEEDS_OUTSTANDING' },
      )
    }
    if (requestedAmount <= 0) {
      throw validationError('Amount must be greater than zero')
    }

    // Check for an already-active (non-expired) CREATED link for this invoice
    const activeLink = await tx.paymentLink.findFirst({
      where: {
        businessId,
        invoiceId,
        status: 'CREATED',
        expireBy: { gt: new Date() },
        isDeleted: false,
      },
    })
    if (activeLink) {
      logger.info('payment_link.active_exists', { linkId: activeLink.id })
      return { link: activeLink, idempotent: true }
    }

    const expireBy = new Date(Date.now() + expiryDays * 86_400_000)

    // Call Razorpay API
    const rzResp = await createLink({
      amount: requestedAmount,
      currency: 'INR',
      description: `Invoice ${invoice.documentNumber}`,
      expire_by: Math.floor(expireBy.getTime() / 1000),
      notify: { sms: false, email: false },
      notes: {
        invoiceId,
        invoiceNumber: invoice.documentNumber ?? '',
        partyId: invoice.partyId,
      },
    })

    // Mask short URL for audit (keep domain + first/last 3 chars of path)
    const maskedUrl = maskShortUrl(rzResp.short_url)

    const link = await tx.paymentLink.create({
      data: {
        businessId,
        invoiceId,
        partyId: invoice.partyId,
        amountPaise: requestedAmount,
        razorpayLinkId: rzResp.id,
        shortUrl: rzResp.short_url,
        status: 'CREATED',
        expireBy,
        createIdempotencyKey: idempotencyKey ?? null,
        createdBy: userId,
      },
    })

    await tx.auditLog.create({
      data: {
        businessId,
        action: 'PAYMENT_LINK_CREATED',
        entityType: 'PaymentLink',
        entityId: link.id,
        entityLabel: invoice.documentNumber ?? invoiceId,
        userId,
        changes: {
          invoiceId,
          amountPaise: requestedAmount,
          expireBy: expireBy.toISOString(),
          shortUrl: maskedUrl,
        },
      },
    })

    logger.info('payment_link.created', { linkId: link.id, invoiceId, amountPaise: requestedAmount })
    return { link, idempotent: false }
  })
}

export async function getPaymentLinks(businessId: string, invoiceId: string) {
  return prisma.paymentLink.findMany({
    where: { businessId, invoiceId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
  })
}

function maskShortUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname
    if (path.length > 6) {
      return `${u.hostname}${path.slice(0, 4)}...${path.slice(-3)}`
    }
    return `${u.hostname}${path}`
  } catch {
    return url.slice(0, 20) + '...'
  }
}
