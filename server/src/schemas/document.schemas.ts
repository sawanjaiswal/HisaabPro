/**
 * Document/Invoice Zod Schemas — validation for all document endpoints
 *
 * All schemas validate req.body directly (flat, no `body:` wrapper).
 * The validate middleware calls schema.parse(req.body).
 */

import { z } from 'zod'
import {
  lineItemSchema,
  additionalChargeSchema,
  transportDetailsSchema,
  customFieldValueInputSchema,
} from './document-parts.schemas.js'
import {
  DOCUMENT_TYPES,
  DOCUMENT_MUTATION_STATUSES as DOCUMENT_STATUSES,
  PAYMENT_TERMS,
  DOCUMENT_SORT_BY as SORT_BY,
  SORT_ORDER,
  SHARE_CHANNELS,
  EXPORT_FORMATS,
  ROUND_OFF_SETTINGS,
  PAYMENT_MODES,
} from '../../../shared/enums.js'

// === Create Document ===

export const createDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  status: z.enum(DOCUMENT_STATUSES).default('DRAFT'),
  partyId: z.string().min(1),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shippingAddressId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  termsAndConditions: z.string().max(5000).nullable().optional(),
  includeSignature: z.boolean().default(false),
  lineItems: z.array(lineItemSchema).min(1).max(100),
  additionalCharges: z.array(additionalChargeSchema).max(10).default([]),
  transportDetails: transportDetailsSchema.nullable().optional(),
  clientId: z.string().optional(), // offline sync
  // Phase 2 — GST document fields (optional, backward compatible)
  placeOfSupply: z.string().refine(v => /^\d{2}$/.test(v) || v === 'OOS', {
    message: 'placeOfSupply must be 2-digit state code or "OOS"',
  }).optional(),
  taxPricingMode: z.enum(['EXCLUSIVE', 'INCLUSIVE']).optional(),
  isReverseCharge: z.boolean().optional(),
  isComposite: z.boolean().optional(),
  // Credit/Debit Note — Phase 2
  originalDocumentId: z.string().optional(),
  creditDebitReason: z.string().max(500).optional(),
  // Phase 2B — TDS/TCS (optional, for B2B invoices)
  tdsRate: z.number().int().min(0).max(10000).optional(),   // basis points
  tdsAmount: z.number().int().min(0).optional(),             // paise
  tcsRate: z.number().int().min(0).max(10000).optional(),   // basis points
  tcsAmount: z.number().int().min(0).optional(),             // paise
  // #134 — invoice custom fields
  customFieldValues: z.array(customFieldValueInputSchema).max(50).optional(),
  // Epic B PR2 — per-invoice price-list tier override (security 2.2: .cuid() not .uuid())
  priceListId: z.string().cuid().nullable().optional(),
  // Gold-standard payment-at-creation — record money received against this
  // invoice in one shot. Honoured only for SAVED SALE_INVOICEs; the amount is
  // allocated (up to grandTotal) via the canonical createPayment service, any
  // excess becomes party advance. Ignored for drafts / non-sale docs.
  payment: z.object({
    amountReceived: z.number().int().min(1).max(9_999_999_900), // paise
    mode: z.enum(PAYMENT_MODES).default('CASH'),
    referenceNumber: z.string().max(100).optional(),
  }).optional(),
}).strict()

// === Update Document ===

export const updateDocumentSchema = z.object({
  status: z.enum(DOCUMENT_STATUSES).optional(),
  partyId: z.string().min(1).optional(),
  documentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentTerms: z.enum(PAYMENT_TERMS).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shippingAddressId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  termsAndConditions: z.string().max(5000).nullable().optional(),
  includeSignature: z.boolean().optional(),
  lineItems: z.array(lineItemSchema).min(1).max(100).optional(),
  additionalCharges: z.array(additionalChargeSchema).max(10).optional(),
  transportDetails: transportDetailsSchema.nullable().optional(),
  // Phase 2 — GST document fields (optional, backward compatible)
  placeOfSupply: z.string().refine(v => /^\d{2}$/.test(v) || v === 'OOS', {
    message: 'placeOfSupply must be 2-digit state code or "OOS"',
  }).optional(),
  taxPricingMode: z.enum(['EXCLUSIVE', 'INCLUSIVE']).optional(),
  isReverseCharge: z.boolean().optional(),
  isComposite: z.boolean().optional(),
  // Phase 2B — TDS/TCS (optional, for B2B invoices)
  tdsRate: z.number().int().min(0).max(10000).optional(),   // basis points
  tdsAmount: z.number().int().min(0).optional(),             // paise
  tcsRate: z.number().int().min(0).max(10000).optional(),   // basis points
  tcsAmount: z.number().int().min(0).optional(),             // paise
  // #134 — invoice custom fields
  customFieldValues: z.array(customFieldValueInputSchema).max(50).optional(),
  // Epic B PR2 — per-invoice price-list tier override (security 2.2: .cuid() not .uuid())
  priceListId: z.string().cuid().nullable().optional(),
}).strict()

// === List Documents (query params) ===

export const listDocumentsSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  status: z.string().optional(), // comma-separated
  partyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
  /**
   * Phase 7 · 7.1C (ARCH §13 deviation #3) — scope the list to a single
   * import job's documents. Used by the FE "Imported invoices" link
   * on the import summary page. cuid (Prisma default) so we accept any
   * non-empty bounded string rather than `.uuid()`.
   */
  importJobId: z.string().min(1).max(64).optional(),
  sortBy: z.enum(SORT_BY).default('documentDate'),
  sortOrder: z.enum(SORT_ORDER).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
})

// === Convert Document ===

export const convertDocumentSchema = z.object({
  targetType: z.enum(DOCUMENT_TYPES),
})

// === Recycle Bin ===

export const recycleBinSchema = z.object({
  type: z.enum(DOCUMENT_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
})

// === Share (schemas + inferred types re-exported from document-share.schemas) ===
export {
  shareWhatsAppSchema,
  shareEmailSchema,
} from './document-share.schemas.js'
export type {
  ShareWhatsAppInput,
  ShareEmailInput,
} from './document-share.schemas.js'

// === Number Series ===

export const updateNumberSeriesSchema = z.object({
  prefix: z.string().max(10).optional(),
  suffix: z.string().max(10).optional(),
  separator: z.string().max(3).optional(),
  paddingDigits: z.number().int().min(1).max(6).optional(),
  startingNumber: z.number().int().min(1).optional(),
  resetOnNewYear: z.boolean().optional(),
})

// === Document Settings ===

export const updateDocumentSettingsSchema = z.object({
  defaultPaymentTerms: z.enum(PAYMENT_TERMS).optional(),
  roundOffTo: z.enum(ROUND_OFF_SETTINGS).optional(),
  showProfitDuringBilling: z.boolean().optional(),
  allowFutureDates: z.boolean().optional(),
  transactionLockDays: z.number().int().min(0).max(365).optional(),
  recycleBinRetentionDays: z.number().int().min(1).max(90).optional(),
  autoShareOnSave: z.boolean().optional(),
  autoShareChannel: z.enum(SHARE_CHANNELS).optional(),
  autoShareFormat: z.enum(EXPORT_FORMATS).optional(),
  // Catalog Enrichment Phase 4
  enforceMoq: z.boolean().optional(),
  showLineItemImages: z.boolean().optional(),
})

// === Terms & Conditions Template (re-exported from document-terms.schemas.ts) ===
export {
  createTermsTemplateSchema,
  updateTermsTemplateSchema,
} from './document-terms.schemas.js'
export type {
  CreateTermsTemplateInput,
  UpdateTermsTemplateInput,
} from './document-terms.schemas.js'

// === Validate Stock ===

export const validateStockSchema = z.object({
  items: z.array(z.object({
    // IDs are cuid (Prisma default), not uuid — accept any non-empty string
    productId: z.string().min(1),
    quantity: z.number().positive(),
    // Optional: when omitted, server falls back to the product's base unit
    unitId: z.string().min(1).optional(),
  })).min(1).max(100),
})

// === Inferred types ===

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type ListDocumentsQuery = z.infer<typeof listDocumentsSchema>
export type ConvertDocumentInput = z.infer<typeof convertDocumentSchema>
// ShareWhatsAppInput / ShareEmailInput re-exported above from document-share.schemas
export type UpdateNumberSeriesInput = z.infer<typeof updateNumberSeriesSchema>
export type UpdateDocumentSettingsInput = z.infer<typeof updateDocumentSettingsSchema>
