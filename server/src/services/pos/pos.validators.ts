/**
 * POS Checkout — Zod validation schemas
 * .strict() on all objects; no extra keys allowed from the client.
 *
 * Epic D PR3 additions:
 *   - paymentModeSchema gains 'loyalty_redemption' (lowercase per v3/M2)
 *   - posPaymentSchema gains `pointsRedeemed` (optional, REQUIRED when
 *     mode === 'loyalty_redemption')
 *   - Top-level superRefine performs BigInt cross-multiply for any loyalty
 *     payment to catch whale-tenant overflow (S1 / test 12.11) and verifies
 *     partyId belongs to the caller's tenant when a loyalty_redemption is
 *     present (NEW_S2 / test 12.17).
 *
 * Cross-tenant 400 lives here (NOT 403, per audit NEW_S2) so the idempotency
 * key is NOT consumed by `idempotencyCheck()` (which runs AFTER validation).
 */

import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { MAX_ITEMS_PER_SALE, MAX_DISCOUNT_BPS } from './pos.constants.js'
import { partyNotInTenantError, loyaltyRedemptionInvalidError } from '../loyalty/loyalty.errors.js'

// ─── Payment mode ──────────────────────────────────────────────────────────
// `loyalty_redemption` is lowercase to match wire format (M2).
export const paymentModeSchema = z.enum([
  'cash',
  'upi',
  'card',
  'bank_transfer',
  'other',
  'loyalty_redemption',
])

// ─── Single payment breakdown entry ────────────────────────────────────────
export const posPaymentSchema = z
  .object({
    mode: paymentModeSchema,
    amountPaise: z
      .number()
      .int('amountPaise must be an integer')
      .min(1, 'Payment amount must be at least 1 paise'),
    referenceNumber: z.string().max(80).optional(),
    note: z.string().max(120).optional(),
    // Loyalty-only — REQUIRED when mode === 'loyalty_redemption'; ignored
    // otherwise. Top-level superRefine enforces presence.
    pointsRedeemed: z.number().int().min(1).optional(),
  })
  .strict()

// ─── Single line item ──────────────────────────────────────────────────────
export const posItemSchema = z
  .object({
    productId: z.string().cuid('productId must be a valid cuid'),
    quantity: z
      .number()
      .positive('quantity must be positive')
      .max(1_000_000, 'quantity too large'),
    discountType: z.enum(['AMOUNT', 'PERCENTAGE']),
    discountValue: z
      .number()
      .int('discountValue must be an integer')
      .min(0, 'discountValue must be ≥ 0'),
    batchId: z.string().cuid().optional(),
    godownId: z.string().cuid().optional(),
    note: z.string().max(120).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.discountType === 'PERCENTAGE' && val.discountValue > MAX_DISCOUNT_BPS) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        type: 'number',
        maximum: MAX_DISCOUNT_BPS,
        inclusive: true,
        message: `Percentage discount cannot exceed ${MAX_DISCOUNT_BPS} bps (100 %)`,
        path: ['discountValue'],
      })
    }
  })

// ─── Main create-sale schema ───────────────────────────────────────────────
export const createPosSaleSchema = z
  .object({
    idempotencyKey: z
      .string()
      .uuid('idempotencyKey must be a valid UUID v4'),
    clientId: z.string().uuid().optional(),
    items: z
      .array(posItemSchema)
      .min(1, 'Cart must have at least 1 item')
      .max(MAX_ITEMS_PER_SALE, `Cart cannot exceed ${MAX_ITEMS_PER_SALE} items`),
    payments: z
      .array(posPaymentSchema)
      .min(1, 'At least one payment entry is required'),
    partyId: z.string().cuid().optional(),
    walkInName: z.string().max(60).optional(),
    walkInPhone: z
      .string()
      .regex(/^\d{10}$/, 'walkInPhone must be a 10-digit number')
      .optional(),
    clientGrandTotal: z
      .number()
      .int('clientGrandTotal must be an integer paise amount')
      .min(0, 'clientGrandTotal must be ≥ 0'),
    saleDate: z.string().datetime({ offset: true }).optional(),
    taxPricingMode: z.enum(['EXCLUSIVE', 'INCLUSIVE']).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    // partyId and walkInName/Phone are mutually exclusive
    if (val.partyId && (val.walkInName ?? val.walkInPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either partyId OR walkIn* fields, not both',
        path: ['partyId'],
      })
    }
    // No duplicate productIds in cart
    const seen = new Set<string>()
    val.items.forEach((item, idx) => {
      if (seen.has(item.productId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate productId "${item.productId}" at index ${idx}. Merge quantities on the client.`,
          path: ['items', idx, 'productId'],
        })
      }
      seen.add(item.productId)
    })

    // Loyalty redemption presence-check — pointsRedeemed required if mode is
    // loyalty_redemption. (Cross-tenant + BigInt-math checks run later because
    // they need DB and async.)
    val.payments.forEach((p, idx) => {
      if (p.mode === 'loyalty_redemption' && (p.pointsRedeemed ?? 0) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'pointsRedeemed is required (>0) when mode is loyalty_redemption',
          path: ['payments', idx, 'pointsRedeemed'],
        })
      }
    })
  })

export type CreatePosSaleInput = z.infer<typeof createPosSaleSchema>

// ─── Validation helper ─────────────────────────────────────────────────────
export function validateCreatePosSale(body: unknown): CreatePosSaleInput {
  return createPosSaleSchema.parse(body)
}

// ─── Loyalty-aware async validation (runs AFTER Zod, BEFORE tx open) ──────
/**
 * Async pass executed by the route handler — checks that:
 *
 *  1. (NEW_S2 / test 12.17) Any loyalty_redemption payment requires a
 *     `partyId` AND that party belongs to the caller's tenant. Cross-tenant
 *     hit → 400 PARTY_NOT_IN_TENANT (NOT 403; that would also imply the
 *     party EXISTS but caller is unauthorized — we don't want to leak that).
 *
 *  2. (S1 / test 12.11) Verify `amountPaise` cross-multiplies BigInt-correctly
 *     against the program's redemptionUnit / redemptionPaisePerUnit, so a
 *     malicious client cannot craft (points, paise) pairs that bypass the
 *     program's stated conversion rate at whale magnitudes.
 *
 * Throws AppError on failure; returns void on success.
 */
export async function validateLoyaltyOnCheckout(
  businessId: string,
  input: CreatePosSaleInput
): Promise<void> {
  const loyaltyPayments = input.payments.filter(p => p.mode === 'loyalty_redemption')
  if (loyaltyPayments.length === 0) return

  // 1. Tenant guard on partyId — cross-tenant or missing party → 400.
  if (!input.partyId) {
    throw loyaltyRedemptionInvalidError('partyId is required when redeeming loyalty points')
  }
  const party = await prisma.party.findUnique({
    where: { id: input.partyId },
    select: { businessId: true },
  })
  if (!party || party.businessId !== businessId) {
    throw partyNotInTenantError(input.partyId)
  }

  // 2. Program math guard — BigInt cross-multiply (S1).
  const program = await prisma.loyaltyProgram.findUnique({
    where: { businessId },
    select: { enabled: true, redemptionUnit: true, redemptionPaisePerUnit: true },
  })
  if (!program || !program.enabled) {
    throw loyaltyRedemptionInvalidError('Loyalty program is not enabled')
  }

  for (const p of loyaltyPayments) {
    const points = p.pointsRedeemed ?? 0
    // expectedPaise = floor(points * redemptionPaisePerUnit / redemptionUnit)
    const expectedPaise = Number(
      (BigInt(points) * BigInt(program.redemptionPaisePerUnit)) /
        BigInt(program.redemptionUnit)
    )
    if (expectedPaise !== p.amountPaise) {
      throw loyaltyRedemptionInvalidError(
        `amountPaise=${p.amountPaise} does not match ${points} points × ${program.redemptionPaisePerUnit}/${program.redemptionUnit} (expected ${expectedPaise})`
      )
    }
  }
}
