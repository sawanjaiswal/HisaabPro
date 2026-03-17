/**
 * Tax Schemas — Zod validation for tax categories, GSTIN, and HSN search
 * All schemas validate req.body directly (flat, no `body:` wrapper).
 * The validate middleware calls schema.parse(req.body).
 */

import { z } from 'zod'

// ─── Tax Categories ───────────────────────────────────────────────────────────

export const createTaxCategorySchema = z.object({
  name: z.string().min(1).max(100),
  rate: z.number().int().min(0).max(10000),       // basis points, max 100%
  cessRate: z.number().int().min(0).max(10000).default(0),
  cessType: z.enum(['PERCENTAGE', 'FIXED_PER_UNIT']).default('PERCENTAGE'),
  hsnCode: z.string().max(8).optional(),
  sacCode: z.string().max(8).optional(),
})

export const updateTaxCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rate: z.number().int().min(0).max(10000).optional(),
  cessRate: z.number().int().min(0).max(10000).optional(),
  cessType: z.enum(['PERCENTAGE', 'FIXED_PER_UNIT']).optional(),
  hsnCode: z.string().max(8).optional().nullable(),
  sacCode: z.string().max(8).optional().nullable(),
  isActive: z.boolean().optional(),
})

// ─── GSTIN ────────────────────────────────────────────────────────────────────

export const verifyGstinSchema = z.object({
  gstin: z.string().length(15),
})

// ─── HSN Search ───────────────────────────────────────────────────────────────

export const hsnSearchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateTaxCategoryInput = z.infer<typeof createTaxCategorySchema>
export type UpdateTaxCategoryInput = z.infer<typeof updateTaxCategorySchema>
export type VerifyGstinInput = z.infer<typeof verifyGstinSchema>
export type HsnSearchQuery = z.infer<typeof hsnSearchSchema>
