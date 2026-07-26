/**
 * Document schema parts — the pieces a document is built from.
 *
 * Split out of document.schemas.ts so the create/update/query schemas that
 * compose them stay readable: one file describes a line, a charge, a transport
 * block and a custom-field value; the other describes the documents that carry
 * them.
 */

import { z } from 'zod'
import { DISCOUNT_TYPES, CHARGE_TYPES } from '../../../shared/enums.js'

// === Line Item ===

export const lineItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive().max(999999),
  rate: z.number().int().min(0), // paise
  discountType: z.enum(DISCOUNT_TYPES).default('AMOUNT'),
  discountValue: z.number().int().min(0).default(0),
  // Optional: when omitted, server falls back to the product's base unit
  unitId: z.string().min(1).optional(),
  // Phase 2 — GST fields (optional, backward compatible). Nullable because the
  // columns are, and because "untagged" is a real state the form holds as null
  // (same shape the product schemas accept); the builder already stores
  // `taxCategoryId ?? null`.
  taxCategoryId: z.string().nullable().optional(),
  hsnCode: z.string().max(8).nullable().optional(),
  sacCode: z.string().max(8).nullable().optional(),
  gstRate: z.number().int().min(0).max(10000).optional(), // basis points
  // #133 BOGO — when true, line contributes 0 to totals; stock still decrements
  isFreeItem: z.boolean().optional(),
})

// === Additional Charge ===

export const additionalChargeSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(CHARGE_TYPES).default('FIXED'),
  value: z.number().int().min(0),
})

// === Transport Details ===

export const transportDetailsSchema = z.object({
  vehicleNumber: z.string().max(20).nullable().optional(),
  driverName: z.string().max(100).nullable().optional(),
  transportNotes: z.string().max(500).nullable().optional(),
})

// === Custom Field Values (#134) ===

export const customFieldValueInputSchema = z.object({
  fieldDefId: z.string().min(1),
  valueJson: z.unknown(),
})
