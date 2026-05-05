/**
 * Zod schemas for GST Settings PATCH and GET validation.
 *
 * GSTIN format per CGST Rules 2017:
 *   2-digit state code + 10-char PAN + 1-digit entity sequence + Z + 1 checksum char
 * Composition rates per GST Composition Scheme: 1% (100bp), 5% (500bp), 6% (600bp)
 */

import { z } from 'zod'

// ─── GSTIN ─────────────────────────────────────────────────────────────────────

/** CGST-format GSTIN: 15 chars, specific character-position rules. */
const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/** Normalise to uppercase before validation — GSTIN is always uppercase. */
const gstinField = z
  .string()
  .trim()
  .transform(v => v.toUpperCase())
  .refine(v => GSTIN_REGEX.test(v), {
    message: 'GSTIN_FORMAT_INVALID: must be 15-char CGST format (e.g. 29ABCDE1234F1Z5)',
  })

// ─── Composition rates (basis points) ──────────────────────────────────────────
// compositionRate is not yet a DB column (added in a future migration).
// The schema is defined here so the route can validate it when the field lands.

const COMPOSITION_RATES = [100, 500, 600] as const

export const compositionRateField = z.union([
  z.literal(100),
  z.literal(500),
  z.literal(600),
], {
  errorMap: () => ({ message: `compositionRate must be one of ${COMPOSITION_RATES.join(', ')} basis points` }),
})

// ─── Tax pricing mode ───────────────────────────────────────────────────────────

const taxPricingModeField = z.enum(['EXCLUSIVE', 'INCLUSIVE'])

// ─── Turnover slab ──────────────────────────────────────────────────────────────

const turnoverSlabField = z.enum([
  'BELOW_40L',
  '40L_TO_1CR',
  '1CR_TO_5CR',
  'ABOVE_5CR',
]).optional()

// ─── PATCH schema ──────────────────────────────────────────────────────────────

/**
 * Partial schema for PATCH /api/gst/settings.
 * businessId is explicitly rejected (must come from session, never body).
 */
export const patchGstSettingsSchema = z
  .object({
    // Reject body-supplied businessId (security: must come from session)
    businessId: z.never({ message: 'businessId is not accepted in the request body' }).optional(),

    gstin: gstinField.nullable().optional(),
    gstEnabled: z.boolean().optional(),
    taxPricingMode: taxPricingModeField.optional(),
    compositionScheme: z.boolean().optional(),
    // compositionRate: future field — not yet in DB schema
    eInvoiceEnabled: z.boolean().optional(),
    eWayBillEnabled: z.boolean().optional(),
    gstDeclarationText: z.string().max(500, 'gstDeclarationText must be ≤ 500 chars').nullable().optional(),
    turnoverSlab: turnoverSlabField,
  })
  .strict() // reject any unknown keys
  .superRefine((data, ctx) => {
    // eInvoiceEnabled=true requires GSTIN set in this patch or presumably already saved.
    // Server service does the DB-aware check; here we only catch the obvious inline case.
    if (data.eInvoiceEnabled === true && data.gstin === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eInvoiceEnabled'],
        message: 'eInvoiceEnabled cannot be enabled when gstin is explicitly set to null',
      })
    }
  })

// ─── GET response shape (for documentation / typed callers) ────────────────────

export const gstSettingsResponseSchema = z.object({
  gstin: z.string().nullable(),
  stateCode: z.string().nullable(),
  gstEnabled: z.boolean(),
  taxPricingMode: taxPricingModeField,
  compositionScheme: z.boolean(),
  eInvoiceEnabled: z.boolean(),
  eWayBillEnabled: z.boolean(),
  gstDeclarationText: z.string().nullable().optional(),
  turnoverSlab: z.string().nullable().optional(),
})

// ─── Inferred types ─────────────────────────────────────────────────────────────

export type PatchGstSettingsInput = z.infer<typeof patchGstSettingsSchema>
export type GstSettingsResponse = z.infer<typeof gstSettingsResponseSchema>
