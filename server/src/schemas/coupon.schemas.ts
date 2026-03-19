/**
 * Coupon / Discount Code — Zod validation schemas
 * Feature #96
 */

import { z } from 'zod'
import {
  CODE_MIN_LENGTH,
  CODE_MAX_LENGTH,
  CODE_REGEX,
  CODE_REGEX_MSG,
  PREFIX_MIN_LENGTH,
  PREFIX_MAX_LENGTH,
  PREFIX_REGEX,
  PREFIX_REGEX_MSG,
  MAX_PERCENTAGE_BASIS_POINTS,
  PERCENTAGE_CAP_MSG,
  BULK_MAX_COUNT,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  DESCRIPTION_MAX_LENGTH,
  SEARCH_MAX_LENGTH,
  COUPON_STATUSES,
} from '../config/coupon.config.js'

// ─── Admin: create single coupon ─────────────────────────────────────────

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .min(CODE_MIN_LENGTH, `Code must be at least ${CODE_MIN_LENGTH} characters`)
      .max(CODE_MAX_LENGTH, `Code must be at most ${CODE_MAX_LENGTH} characters`)
      .transform((v) => v.trim().toUpperCase())
      .pipe(z.string().regex(CODE_REGEX, CODE_REGEX_MSG)),
    description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.number().int().min(1, 'Discount value must be at least 1'),
    maxUses: z.number().int().min(1).nullable().optional(),
    maxUsesPerUser: z.number().int().min(1).default(1),
    minPurchaseAmount: z.number().int().min(0).nullable().optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date().nullable().optional(),
    appliesTo: z.enum(['FIRST_CYCLE', 'ALL_CYCLES', 'ONE_TIME']),
    planFilter: z.array(z.string()).default([]),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()
  .refine(
    (d) => !(d.discountType === 'PERCENTAGE' && d.discountValue > MAX_PERCENTAGE_BASIS_POINTS),
    { message: PERCENTAGE_CAP_MSG }
  )
  .refine(
    (d) => !(d.validUntil && d.validUntil <= d.validFrom),
    { message: 'validUntil must be after validFrom' }
  )

export type CreateCouponInput = z.infer<typeof createCouponSchema>

// ─── Admin: update coupon ────────────────────────────────────────────────

export const updateCouponSchema = z
  .object({
    description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    discountValue: z.number().int().min(1).optional(),
    maxUses: z.number().int().min(1).nullable().optional(),
    maxUsesPerUser: z.number().int().min(1).optional(),
    minPurchaseAmount: z.number().int().min(0).nullable().optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().nullable().optional(),
    isActive: z.boolean().optional(),
    appliesTo: z.enum(['FIRST_CYCLE', 'ALL_CYCLES', 'ONE_TIME']).optional(),
    planFilter: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()

export type UpdateCouponInput = z.infer<typeof updateCouponSchema>

// ─── Admin: bulk generate ────────────────────────────────────────────────

export const bulkCreateCouponsSchema = z
  .object({
    prefix: z
      .string()
      .min(PREFIX_MIN_LENGTH, `Prefix must be at least ${PREFIX_MIN_LENGTH} characters`)
      .max(PREFIX_MAX_LENGTH, `Prefix must be at most ${PREFIX_MAX_LENGTH} characters`)
      .transform((v) => v.trim().toUpperCase())
      .pipe(z.string().regex(PREFIX_REGEX, PREFIX_REGEX_MSG)),
    count: z.number().int().min(1).max(BULK_MAX_COUNT, `Maximum ${BULK_MAX_COUNT} codes per request`),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.number().int().min(1),
    maxUses: z.number().int().min(1).nullable().optional().default(1),
    maxUsesPerUser: z.number().int().min(1).default(1),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date().nullable().optional(),
    appliesTo: z.enum(['FIRST_CYCLE', 'ALL_CYCLES', 'ONE_TIME']),
    planFilter: z.array(z.string()).default([]),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict()
  .refine(
    (d) => !(d.discountType === 'PERCENTAGE' && d.discountValue > MAX_PERCENTAGE_BASIS_POINTS),
    { message: PERCENTAGE_CAP_MSG }
  )

export type BulkCreateCouponsInput = z.infer<typeof bulkCreateCouponsSchema>

// ─── Admin: list query ───────────────────────────────────────────────────

export const listCouponsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  status: z.enum(COUPON_STATUSES).optional(),
  search: z.string().max(SEARCH_MAX_LENGTH).optional(),
})

export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>

// ─── User: validate coupon ───────────────────────────────────────────────

export const validateCouponSchema = z
  .object({
    code: z
      .string()
      .min(1, 'Code is required')
      .transform((v) => v.trim().toUpperCase()),
    planId: z.string().min(1).optional(),
    planAmountPaise: z.number().int().min(0).optional(),
  })
  .strict()

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>

// ─── User: apply coupon ──────────────────────────────────────────────────

export const applyCouponSchema = z
  .object({
    code: z
      .string()
      .min(1, 'Code is required')
      .transform((v) => v.trim().toUpperCase()),
    planId: z.string().min(1).optional(),
    planAmountPaise: z.number().int().min(0).optional(),
    razorpaySubscriptionId: z.string().optional(),
  })
  .strict()

export type ApplyCouponInput = z.infer<typeof applyCouponSchema>

// ─── User: remove coupon ─────────────────────────────────────────────────

export const removeCouponSchema = z
  .object({
    redemptionId: z.string().min(1, 'Redemption ID is required'),
  })
  .strict()

export type RemoveCouponInput = z.infer<typeof removeCouponSchema>
