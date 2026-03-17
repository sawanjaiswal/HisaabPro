/**
 * Referral & Earn — Zod validation schemas
 * Adapted from DudhHisaab referral.schemas.ts
 */

import { z } from 'zod'

// POST /api/referral/apply
export const applyReferralCodeSchema = z
  .object({
    referralCode: z
      .string()
      .min(5, 'Referral code must be at least 5 characters')
      .max(15, 'Referral code must be at most 15 characters')
      .regex(/^[A-Z0-9]+$/i, 'Referral code can only contain letters and numbers'),
  })
  .strict()

// POST /api/referral/withdraw
export const withdrawReferralSchema = z
  .object({
    amount: z
      .number()
      .min(200, 'Minimum withdrawal amount is ₹200')
      .max(5000, 'Maximum withdrawal amount is ₹5000'),
    upiId: z
      .string()
      .regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g., username@paytm)'),
  })
  .strict()

// GET /api/referral/rewards — query params
export const referralRewardsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type ApplyReferralCodeInput = z.infer<typeof applyReferralCodeSchema>
export type WithdrawReferralInput = z.infer<typeof withdrawReferralSchema>
export type ReferralRewardsQuery = z.infer<typeof referralRewardsQuerySchema>
