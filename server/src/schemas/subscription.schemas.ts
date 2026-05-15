/**
 * Subscription Zod Schemas — validate all subscription mutation inputs.
 * All schemas use .strict() to reject unknown fields.
 *
 * SECURITY P2-E: AdminGrantReqSchema enforces reason min(8) max(500), months int 1–36.
 */

import { z } from 'zod'

const PLAN_TIERS = ['FREE', 'PRO', 'BUSINESS', 'PRO_MAX'] as const
const BILLING_CYCLES = ['MONTHLY', 'YEARLY'] as const
const UPI_FREQUENCIES = ['MONTHLY', 'YEARLY'] as const

// ─── Checkout ─────────────────────────────────────────────────────────────────

export const CheckoutReqSchema = z
  .object({
    tier: z.enum(PLAN_TIERS).refine((t) => t !== 'FREE', {
      message: 'Cannot checkout FREE tier',
    }),
    billingCycle: z.enum(BILLING_CYCLES),
    couponCode: z.string().min(1).max(50).optional(),
  })
  .strict()

export type CheckoutReq = z.infer<typeof CheckoutReqSchema>

// ─── Plan change (upgrade / downgrade) ────────────────────────────────────────

export const PlanChangeReqSchema = z
  .object({
    tier: z.enum(PLAN_TIERS),
    billingCycle: z.enum(BILLING_CYCLES).optional(),
    effectiveAt: z.enum(['period_end', 'immediate']).optional().default('period_end'),
  })
  .strict()

export type PlanChangeReq = z.infer<typeof PlanChangeReqSchema>

// ─── Cancel ──────────────────────────────────────────────────────────────────

export const CancelReqSchema = z
  .object({
    reason: z.string().min(1).max(500).optional(),
    cancelImmediately: z.boolean().optional().default(false),
  })
  .strict()

export type CancelReq = z.infer<typeof CancelReqSchema>

// ─── Reactivate ──────────────────────────────────────────────────────────────

export const ReactivateReqSchema = z
  .object({
    tier: z.enum(PLAN_TIERS).refine((t) => t !== 'FREE', {
      message: 'Reactivation requires a paid tier',
    }),
    billingCycle: z.enum(BILLING_CYCLES),
  })
  .strict()

export type ReactivateReq = z.infer<typeof ReactivateReqSchema>

// ─── Mandate create ───────────────────────────────────────────────────────────

export const MandateCreateReqSchema = z
  .object({
    maxAmountPaise: z.number().int().min(100).max(50_000_000), // max 5 lakh
    frequency: z.enum(UPI_FREQUENCIES),
    upiVpa: z.string().min(5).max(100).optional(),  // optional — FE may provide
  })
  .strict()

export type MandateCreateReq = z.infer<typeof MandateCreateReqSchema>

// ─── Addon purchase ───────────────────────────────────────────────────────────

export const AddonPurchaseReqSchema = z
  .object({
    billingCycle: z.enum(BILLING_CYCLES).optional(),
  })
  .strict()

export type AddonPurchaseReq = z.infer<typeof AddonPurchaseReqSchema>

// ─── Admin grant ──────────────────────────────────────────────────────────────

export const AdminGrantReqSchema = z
  .object({
    tier: z.enum(PLAN_TIERS).refine((t) => t !== 'FREE', {
      message: 'Admin grant must specify a paid tier',
    }),
    months: z.number().int().min(1).max(36),
    reason: z.string().min(8).max(500),
  })
  .strict()

export type AdminGrantReq = z.infer<typeof AdminGrantReqSchema>

// ─── Admin revoke ─────────────────────────────────────────────────────────────

export const AdminRevokeReqSchema = z
  .object({
    reason: z.string().min(8).max(500),
  })
  .strict()

export type AdminRevokeReq = z.infer<typeof AdminRevokeReqSchema>
