/**
 * Phase 7 · 7.1C — Invoice import Zod schemas (skeleton).
 *
 * Mirrors `invoice.types.ts` shapes so the parser/normalizer outputs can
 * be validated at the staging boundary (`InvoiceJobRow.normalized` JSON)
 * and at the route boundary (the `partyResolutionMode` body field).
 *
 * Bodies stay light in PR-C1 — full refinements (intra-file dedup,
 * lines-cap, header-mismatch) land in PR-C2 alongside the normalizer.
 */

import { z } from 'zod'

export const partyResolutionModeSchema = z.enum([
  'MATCH_OR_FLY_CREATE',
  'REQUIRE_PARTIES_FIRST',
])

export const invoiceHeaderSchema = z.object({
  documentNumber: z.string().nullable(),
  documentDate: z.string().nullable(),
  partyNameRaw: z.string().nullable(),
  partyPhoneRaw: z.string().nullable(),
  partyGstinRaw: z.string().nullable(),
  subtotalRaw: z.string().nullable(),
  totalCgstRaw: z.string().nullable(),
  totalSgstRaw: z.string().nullable(),
  totalIgstRaw: z.string().nullable(),
  grandTotalRaw: z.string().nullable(),
  notes: z.string().nullable(),
})

export const invoiceLineSchema = z.object({
  sourceLineIndex: z.number().int().nonnegative(),
  skuRaw: z.string().nullable(),
  productNameRaw: z.string().nullable(),
  qtyRaw: z.string().nullable(),
  unitRaw: z.string().nullable(),
  rateRaw: z.string().nullable(),
  discountRaw: z.string().nullable(),
  taxableValueRaw: z.string().nullable(),
  cgstRaw: z.string().nullable(),
  sgstRaw: z.string().nullable(),
  igstRaw: z.string().nullable(),
  lineTotalRaw: z.string().nullable(),
})

export const invoiceIssueSchema = z.object({
  field: z.string().nullable(),
  code: z.string(),
  severity: z.enum(['ERROR', 'WARNING']),
  message: z.string(),
  sourceLineIndex: z.number().int().nonnegative().optional(),
})

export const stagedInvoiceRowSchema = z.object({
  sourceIndex: z.number().int().nonnegative(),
  header: invoiceHeaderSchema,
  lines: z.array(invoiceLineSchema),
  // `normalized` shape filled in PR-C2 — for now accept any JSON object.
  normalized: z.unknown().nullable(),
  issues: z.array(invoiceIssueSchema),
})

export type PartyResolutionMode = z.infer<typeof partyResolutionModeSchema>
