/**
 * Mandate Lifecycle SSOT.
 *
 * Deterministic terminal transitions and status reasons for UpiMandate.
 */

import { prisma } from '../../../lib/prisma.js'
import logger from '../../../lib/logger.js'
import type { MandateStatusReason, TokenMandateStatus } from './token-engine.types.js'

export async function transitionMandateTerminal(
  mandateId: string,
  status: TokenMandateStatus,
  statusReason: MandateStatusReason,
  opts: { expectedBusinessId?: string } = {},
): Promise<boolean> {
  const whereClause: { id: string; businessId?: string } = { id: mandateId }
  if (opts.expectedBusinessId) {
    whereClause.businessId = opts.expectedBusinessId
  }

  const res = await prisma.upiMandate.updateMany({
    where: whereClause,
    data: { status, statusReason },
  })

  if (res.count > 0) {
    logger.info('Mandate transitioned to terminal status', {
      mandateId,
      status,
      statusReason,
      businessId: opts.expectedBusinessId,
    })
    return true
  }
  return false
}

export async function supersedePendingMandatesForBusiness(
  businessId: string,
  excludeMandateId?: string,
): Promise<number> {
  const whereClause: {
    businessId: string
    status: string
    razorpayTokenId: null
    id?: { not: string }
  } = {
    businessId,
    status: 'PENDING',
    razorpayTokenId: null,
  }

  if (excludeMandateId) {
    whereClause.id = { not: excludeMandateId }
  }

  const res = await prisma.upiMandate.updateMany({
    where: whereClause,
    data: {
      status: 'CANCELLED',
      statusReason: 'superseded_by_retry',
    },
  })

  if (res.count > 0) {
    logger.info('Superseded pending mandate(s) for business', {
      businessId,
      excludeMandateId,
      supersededCount: res.count,
    })
  }

  return res.count
}

export async function cancelPendingMandateAsAbandoned(
  businessId: string,
): Promise<{ cancelled: boolean; mandateId?: string }> {
  const existing = await prisma.upiMandate.findFirst({
    where: { businessId, status: 'PENDING', razorpayTokenId: null },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!existing) {
    return { cancelled: false }
  }

  const res = await prisma.upiMandate.updateMany({
    where: { id: existing.id, businessId, status: 'PENDING', razorpayTokenId: null },
    data: {
      status: 'EXPIRED',
      statusReason: 'user_abandoned',
    },
  })

  const cancelled = res.count === 1
  if (cancelled) {
    logger.info('Mandate abandoned by business user', { mandateId: existing.id, businessId })
  }

  return { cancelled, mandateId: existing.id }
}

export async function expireStalePendingMandate(mandateId: string): Promise<boolean> {
  const res = await prisma.upiMandate.updateMany({
    where: { id: mandateId, status: 'PENDING', razorpayTokenId: null },
    data: {
      status: 'EXPIRED',
      statusReason: 'ttl_expired',
    },
  })

  if (res.count > 0) {
    logger.info('Aged out stale pending mandate via TTL sweep', { mandateId })
    return true
  }
  return false
}
