/**
 * Razorpay — Zod validation schemas
 */

import { z } from 'zod'

// ─── Subscribe ──────────────────────────────────────────────────────────────

export const subscribeSchema = z
  .object({
    planId: z.string().min(1, 'Plan ID is required'),
    couponCode: z.string().optional(),
  })
  .strict()

export type SubscribeInput = z.infer<typeof subscribeSchema>

// ─── Cancel ─────────────────────────────────────────────────────────────────

export const cancelSubscriptionSchema = z
  .object({
    subscriptionId: z.string().min(1, 'Subscription ID is required'),
    cancelAtEnd: z.boolean().optional().default(true),
  })
  .strict()

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>

// ─── Status ─────────────────────────────────────────────────────────────────

export const subscriptionStatusSchema = z
  .object({
    subscriptionId: z.string().min(1, 'Subscription ID is required'),
  })
  .strict()

export type SubscriptionStatusInput = z.infer<typeof subscriptionStatusSchema>
