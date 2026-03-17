/**
 * Document/Invoice Zod Schemas — validation for all document endpoints
 *
 * All schemas validate req.body directly (flat, no `body:` wrapper).
 * The validate middleware calls schema.parse(req.body).
 */

import { z } from 'zod'

// === Enums ===

const DOCUMENT_TYPES = [
  'SALE_INVOICE', 'PURCHASE_INVOICE', 'ESTIMATE', 'PROFORMA',
  'SALE_ORDER', 'PURCHASE_ORDER', 'DELIVERY_CHALLAN',
  'CREDIT_NOTE', 'DEBIT_NOTE',
] as const

const DOCUMENT_STATUSES = ['DRAFT', 'SAVED'] as const // Only these two are valid for create/update
const PAYMENT_TERMS = ['COD', 'NET_7', 'NET_15', 'NET_30', 'NET_60', 'NET_90', 'CUSTOM'] as const
const DISCOUNT_TYPES = ['AMOUNT', 'PERCENTAGE'] as const
const CHARGE_TYPES = ['FIXED', 'PERCENTAGE'] as const
const SORT_BY = ['documentDate', 'createdAt', 'grandTotal', 'documentNumber'] as const
const SORT_ORDER = ['asc', 'desc'] as const
const SHARE_CHANNELS = ['WHATSAPP', 'EMAIL', 'PRINT'] as const
const EXPORT_FORMATS = ['PDF', 'JPG', 'PNG'] as const
const ROUND_OFF_SETTINGS = ['NONE', 'NEAREST_1', 'NEAREST_050', 'NEAREST_010'] as const

// === Line Item ===

const lineItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive().max(999999),
  rate: z.number().int().min(0), // paise
  discountType: z.enum(DISCOUNT_TYPES).default('AMOUNT'),
  discountValue: z.number().int().min(0).default(0),
  // Phase 2 — GST fields (optional, backward compatible)
  taxCategoryId: z.string().optional(),
  hsnCode: z.string().max(8).optional(),
  sacCode: z.string().max(8).optional(),
  gstRate: z.number().int().min(0).max(10000).optional(), // basis points
})

// === Additional Charge ===

const additionalChargeSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(CHARGE_TYPES).default('FIXED'),
  value: z.number().int().min(0),
})

// === Transport Details ===

const transportDetailsSchema = z.object({
  vehicleNumber: z.string().max(20).nullable().optional(),
  driverName: z.string().max(100).nullable().optional(),
  transportNotes: z.string().max(500).nullable().optional(),
})

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
  placeOfSupply: z.string().length(2).optional(),
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
})

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
  placeOfSupply: z.string().length(2).optional(),
  isReverseCharge: z.boolean().optional(),
  isComposite: z.boolean().optional(),
  // Phase 2B — TDS/TCS (optional, for B2B invoices)
  tdsRate: z.number().int().min(0).max(10000).optional(),   // basis points
  tdsAmount: z.number().int().min(0).optional(),             // paise
  tcsRate: z.number().int().min(0).max(10000).optional(),   // basis points
  tcsAmount: z.number().int().min(0).optional(),             // paise
})

// === List Documents (query params) ===

export const listDocumentsSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  status: z.string().optional(), // comma-separated
  partyId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
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

// === Share ===

export const shareWhatsAppSchema = z.object({
  format: z.enum(['IMAGE', 'PDF']),
  recipientPhone: z.string().min(10).max(15),
  message: z.string().max(1000).optional(),
})

export const shareEmailSchema = z.object({
  recipientEmail: z.string().email(),
  subject: z.string().max(200),
  body: z.string().max(5000).optional(),
  format: z.enum(['PDF']).default('PDF'),
})

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
})

// === Terms & Conditions Template ===

export const createTermsTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  isDefault: z.boolean().default(false),
  appliesTo: z.array(z.enum(DOCUMENT_TYPES)).default([]),
})

export const updateTermsTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(5000).optional(),
  isDefault: z.boolean().optional(),
  appliesTo: z.array(z.enum(DOCUMENT_TYPES)).optional(),
})

// === Inferred types ===

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type ListDocumentsQuery = z.infer<typeof listDocumentsSchema>
export type ConvertDocumentInput = z.infer<typeof convertDocumentSchema>
export type ShareWhatsAppInput = z.infer<typeof shareWhatsAppSchema>
export type ShareEmailInput = z.infer<typeof shareEmailSchema>
export type UpdateNumberSeriesInput = z.infer<typeof updateNumberSeriesSchema>
export type UpdateDocumentSettingsInput = z.infer<typeof updateDocumentSettingsSchema>
export type CreateTermsTemplateInput = z.infer<typeof createTermsTemplateSchema>
export type UpdateTermsTemplateInput = z.infer<typeof updateTermsTemplateSchema>
