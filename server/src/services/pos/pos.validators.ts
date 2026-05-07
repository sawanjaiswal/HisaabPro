/**
 * POS Checkout — Zod validation schemas
 * .strict() on all objects; no extra keys allowed from the client.
 */

import { z } from 'zod'
import { MAX_ITEMS_PER_SALE, MAX_DISCOUNT_BPS } from './pos.constants.js'

// ─── Payment mode ──────────────────────────────────────────────────────────
export const paymentModeSchema = z.enum(['cash', 'upi', 'card', 'bank_transfer', 'other'])

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
  })

export type CreatePosSaleInput = z.infer<typeof createPosSaleSchema>

// ─── Validation helper ─────────────────────────────────────────────────────
export function validateCreatePosSale(body: unknown): CreatePosSaleInput {
  return createPosSaleSchema.parse(body)
}
