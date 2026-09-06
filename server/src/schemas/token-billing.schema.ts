/**
 * Token-billing engine — request schemas.
 */

import { z } from 'zod'

export const tokenCheckoutSchema = z
  .object({
    tier: z.enum(['PRO', 'BUSINESS', 'PRO_MAX']).optional(),
    planTier: z.enum(['PRO', 'BUSINESS', 'PRO_MAX']).optional(),
    billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
    planId: z.string().optional(),
    pricingId: z.string().optional(),
    couponCode: z.string().optional(),
  })
  .strict()

export type TokenCheckoutRequest = z.infer<typeof tokenCheckoutSchema>

export const mandateCancelSchema = z
  .object({
    mandateId: z.string().min(1, 'Mandate ID is required'),
    reason: z.string().optional(),
  })
  .strict()

export type MandateCancelRequest = z.infer<typeof mandateCancelSchema>

export const mandateAbandonSchema = z
  .object({
    mandateId: z.string().min(1, 'Mandate ID is required'),
    source: z.string().optional(),
  })
  .strict()

export type MandateAbandonRequest = z.infer<typeof mandateAbandonSchema>
