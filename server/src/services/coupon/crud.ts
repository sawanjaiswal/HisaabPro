/**
 * Coupon CRUD operations — admin-facing.
 * Create, bulk-generate, list, detail, update, deactivate.
 */

import { prisma } from '../../lib/prisma.js'
import { validationError, notFoundError, conflictError } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import {
  DETAIL_REDEMPTIONS_LIMIT,
  PERCENTAGE_CAP_MSG,
} from '../../config/coupon.config.js'
import { withStatus, generateSuffix, MAX_PERCENTAGE_BASIS_POINTS } from './helpers.js'
import type {
  CreateCouponInput,
  UpdateCouponInput,
  BulkCreateCouponsInput,
  ListCouponsQuery,
} from '../../schemas/coupon.schemas.js'

// ─── Create ───────────────────────────────────────────────────────────────

export async function createCoupon(adminId: string, data: CreateCouponInput) {
  const existing = await prisma.coupon.findUnique({ where: { code: data.code } })
  if (existing) throw conflictError('Coupon code already exists')

  const coupon = await prisma.coupon.create({
    data: {
      code: data.code,
      description: data.description ?? null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUses: data.maxUses ?? null,
      maxUsesPerUser: data.maxUsesPerUser,
      minPurchaseAmount: data.minPurchaseAmount ?? null,
      validFrom: data.validFrom,
      validUntil: data.validUntil ?? null,
      appliesTo: data.appliesTo,
      planFilter: data.planFilter,
      metadata: (data.metadata ?? {}) as object,
      createdBy: adminId,
    },
  })

  logger.info('coupon.created', { couponId: coupon.id, code: coupon.code, adminId })
  return withStatus(coupon)
}

// ─── Bulk Generate ────────────────────────────────────────────────────────

export async function bulkCreateCoupons(adminId: string, data: BulkCreateCouponsInput) {
  const candidateSet = new Set<string>()
  const maxAttempts = data.count * 3

  for (let attempt = 0; candidateSet.size < maxAttempts && candidateSet.size < data.count * 2; attempt++) {
    candidateSet.add(`${data.prefix}-${generateSuffix()}`)
    if (attempt >= maxAttempts) break
  }

  const candidates = Array.from(candidateSet)

  const existingCoupons = await prisma.coupon.findMany({
    where: { code: { in: candidates } },
    select: { code: true },
  })

  const existingCodes = new Set(existingCoupons.map((c) => c.code))
  const codes = candidates.filter((c) => !existingCodes.has(c)).slice(0, data.count)

  if (codes.length < data.count) {
    throw validationError(
      `Could only generate ${codes.length} unique codes out of ${data.count} requested. Try a different prefix.`
    )
  }

  const coupons = await prisma.$transaction(
    codes.map((code) =>
      prisma.coupon.create({
        data: {
          code,
          description: `Bulk: ${data.prefix} campaign`,
          discountType: data.discountType,
          discountValue: data.discountValue,
          maxUses: data.maxUses ?? null,
          maxUsesPerUser: data.maxUsesPerUser,
          minPurchaseAmount: null,
          validFrom: data.validFrom,
          validUntil: data.validUntil ?? null,
          appliesTo: data.appliesTo,
          planFilter: data.planFilter,
          metadata: (data.metadata ?? {}) as object,
          createdBy: adminId,
        },
      })
    )
  )

  logger.info('coupon.bulk_created', { count: coupons.length, prefix: data.prefix, adminId })
  return { created: coupons.length, codes }
}

// ─── List ─────────────────────────────────────────────────────────────────

export async function listCoupons(query: ListCouponsQuery) {
  const { cursor, limit, status, search } = query

  const where: Record<string, unknown> = {}
  const now = new Date()

  if (search) {
    where.code = { contains: search.toUpperCase(), mode: 'insensitive' }
  }

  if (status === 'DEACTIVATED') {
    where.isActive = false
  } else if (status === 'EXPIRED') {
    where.isActive = true
    where.validUntil = { not: null, lt: now }
  } else if (status === 'SCHEDULED') {
    where.isActive = true
    where.validFrom = { gt: now }
  } else if (status === 'ACTIVE') {
    where.isActive = true
    where.validFrom = { lte: now }
    where.OR = [{ validUntil: null }, { validUntil: { gte: now } }]
  } else if (status === 'EXHAUSTED') {
    where.isActive = true
  } else if (status) {
    where.isActive = true
  }

  const fetchLimit = status === 'ACTIVE' || status === 'EXHAUSTED' ? limit * 2 : limit + 1

  const coupons = await prisma.coupon.findMany({
    where,
    take: fetchLimit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
  })

  let filtered = coupons.map(withStatus)
  if (status === 'ACTIVE') {
    filtered = filtered.filter((c) => c.status === 'ACTIVE')
  } else if (status === 'EXHAUSTED') {
    filtered = filtered.filter((c) => c.status === 'EXHAUSTED')
  }

  const hasMore = filtered.length > limit
  const items = filtered.slice(0, limit)
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null

  const total = await prisma.coupon.count({ where })

  return { items, total, nextCursor }
}

// ─── Detail ───────────────────────────────────────────────────────────────

export async function getCouponDetail(couponId: string) {
  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    include: {
      redemptions: {
        orderBy: { redeemedAt: 'desc' },
        take: DETAIL_REDEMPTIONS_LIMIT,
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  })

  if (!coupon) throw notFoundError('Coupon')

  const stats = await prisma.couponRedemption.aggregate({
    where: { couponId },
    _count: true,
    _sum: { discountApplied: true },
  })

  return {
    coupon: withStatus(coupon),
    redemptions: coupon.redemptions,
    stats: {
      totalRedeemed: stats._count,
      totalDiscountGiven: stats._sum.discountApplied ?? 0,
    },
  }
}

// ─── Update ───────────────────────────────────────────────────────────────

export async function updateCoupon(couponId: string, data: UpdateCouponInput) {
  const existing = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!existing) throw notFoundError('Coupon')

  const newType = data.discountType ?? existing.discountType
  const newValue = data.discountValue ?? existing.discountValue
  if (newType === 'PERCENTAGE' && newValue > MAX_PERCENTAGE_BASIS_POINTS) {
    throw validationError(PERCENTAGE_CAP_MSG)
  }

  const coupon = await prisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.discountType !== undefined && { discountType: data.discountType }),
      ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
      ...(data.maxUses !== undefined && { maxUses: data.maxUses }),
      ...(data.maxUsesPerUser !== undefined && { maxUsesPerUser: data.maxUsesPerUser }),
      ...(data.minPurchaseAmount !== undefined && { minPurchaseAmount: data.minPurchaseAmount }),
      ...(data.validFrom !== undefined && { validFrom: data.validFrom }),
      ...(data.validUntil !== undefined && { validUntil: data.validUntil }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.appliesTo !== undefined && { appliesTo: data.appliesTo }),
      ...(data.planFilter !== undefined && { planFilter: data.planFilter }),
      ...(data.metadata !== undefined && { metadata: data.metadata as object }),
    },
  })

  logger.info('coupon.updated', { couponId, fields: Object.keys(data) })
  return withStatus(coupon)
}

// ─── Deactivate ───────────────────────────────────────────────────────────

export async function deactivateCoupon(couponId: string) {
  const existing = await prisma.coupon.findUnique({ where: { id: couponId } })
  if (!existing) throw notFoundError('Coupon')

  await prisma.coupon.update({
    where: { id: couponId },
    data: { isActive: false },
  })

  logger.info('coupon.deactivated', { couponId, code: existing.code })
  return { deactivated: true }
}

