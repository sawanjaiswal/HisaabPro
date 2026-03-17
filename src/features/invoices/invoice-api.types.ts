/** Invoicing & Documents — API, form, filter, settings, and conversion types
 *
 * All monetary amounts stored in PAISE (integer).
 * PRD: invoicing-documents-PLAN.md
 */

import type {
  ChargeType,
  DiscountType,
  DocumentSortBy,
  DocumentStatus,
  DocumentStockValidation,
  DocumentType,
  ExportFormat,
  FinancialYearFormat,
  PaymentTerms,
  RoundOffSetting,
  ShareChannel,
} from './invoice-enums.types'
import type {
  DocumentSummary,
  TransportDetails,
} from './invoice-document.types'

// ─── API Responses ────────────────────────────────────────────────────────────

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface DocumentListResponse {
  documents: DocumentSummary[]
  pagination: Pagination
  summary: {
    /** Sum of grandTotal for all matched documents, in PAISE */
    totalAmount: number
    /** Sum of paidAmount for all matched documents, in PAISE */
    totalPaid: number
    /** Sum of balanceDue for all matched documents, in PAISE */
    totalDue: number
  }
}

// ─── Soft-delete response ────────────────────────────────────────────────────

export interface DocumentDeleteResponse {
  id: string
  status: 'DELETED'
  deletedAt: string
  permanentDeleteAt: string
}

// ─── Share API responses ─────────────────────────────────────────────────────

export interface ShareWhatsAppResponse {
  shareLogId: string
  fileUrl: string
  fileSize: number
  whatsappDeepLink: string
}

export interface ShareEmailResponse {
  shareLogId: string
  emailId: string
  sentAt: string
}

// ─── Invoice Number Series ────────────────────────────────────────────────────

export interface DocumentNumberSeriesConfig {
  prefix: string
  suffix: string
  separator: string
  includeFinancialYear: boolean
  financialYearFormat: FinancialYearFormat
  startingNumber: number
  paddingDigits: number
  resetOnNewYear: boolean
}

export interface NextDocumentNumber {
  nextNumber: string
  prefix: string
  financialYear: string
  sequence: number
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface DocumentFilters {
  page: number
  limit: number
  /** Required — one document type per list */
  type: DocumentType
  /** Comma-separated statuses; default "SAVED,SHARED" */
  status?: string
  partyId?: string
  fromDate?: string
  toDate?: string
  search?: string
  sortBy: DocumentSortBy
  sortOrder: 'asc' | 'desc'
}

// ─── Form data ────────────────────────────────────────────────────────────────

/** Line item as entered in the form — computed fields (discountAmount, lineTotal, profit) added by the hook */
export interface LineItemFormData {
  productId: string
  quantity: number
  /** Rate in PAISE */
  rate: number
  discountType: DiscountType
  /** 0-100 for PERCENTAGE, paise for AMOUNT */
  discountValue: number
}

/** Additional charge as entered in the form — `amount` is calculated by the hook */
export interface AdditionalChargeFormData {
  name: string
  type: ChargeType
  /** Paise for FIXED, 0-100 for PERCENTAGE */
  value: number
}

/** Mirrors CreateDocumentSchema / UpdateDocumentSchema from PRD §5.2 */
export interface DocumentFormData {
  type: DocumentType
  /** DRAFT (auto-save) or SAVED (user taps Save) */
  status: DocumentStatus
  partyId: string
  /** ISO date string "YYYY-MM-DD" */
  documentDate: string
  paymentTerms?: PaymentTerms
  /** ISO date string; auto-calculated from paymentTerms but editable */
  dueDate?: string
  shippingAddressId?: string | null
  notes?: string
  termsAndConditions?: string
  includeSignature: boolean
  lineItems: LineItemFormData[]
  additionalCharges: AdditionalChargeFormData[]
  /** Only used for DELIVERY_CHALLAN */
  transportDetails?: TransportDetails | null
}

// ─── Document Conversion ──────────────────────────────────────────────────────

/** Maps each source type to the target types it can be converted to */
export interface AllowedConversions {
  ESTIMATE: ['SALE_ORDER', 'SALE_INVOICE']
  PROFORMA: ['SALE_INVOICE']
  SALE_ORDER: ['SALE_INVOICE', 'DELIVERY_CHALLAN']
  PURCHASE_ORDER: ['PURCHASE_INVOICE']
  DELIVERY_CHALLAN: ['SALE_INVOICE']
}

/** All document types that can serve as a conversion source */
export type ConvertibleDocumentType = keyof AllowedConversions

/** All possible target types across all conversion chains */
export type ConversionTargetType =
  AllowedConversions[ConvertibleDocumentType][number]

/** Payload for POST .../documents/:id/convert */
export interface ConvertDocumentRequest {
  targetType: ConversionTargetType
}

// ─── Document Settings ────────────────────────────────────────────────────────

export interface DocumentDefaultAdditionalCharge {
  name: string
  type: ChargeType
  /** Default value; 0 means no default amount pre-filled */
  value: number
}

/** Business-level document configuration — mirrors GET /settings/documents response */
export interface DocumentSettings {
  defaultPaymentTerms: PaymentTerms
  stockValidation: DocumentStockValidation
  roundOffTo: RoundOffSetting
  decimalPlaces: {
    quantity: number
    rate: number
    amount: number
  }
  defaultTermsAndConditions: string | null
  autoShareOnSave: boolean
  autoShareChannel: ShareChannel
  autoShareFormat: ExportFormat
  /** Whether to show profit margin to billing staff */
  showProfitDuringBilling: boolean
  allowFutureDates: boolean
  /** Days before a saved document is locked for editing (0 = no lock) */
  transactionLockDays: number
  recycleBinRetentionDays: number
  defaultAdditionalCharges: DocumentDefaultAdditionalCharge[]
}

// ─── Terms & Conditions Template ─────────────────────────────────────────────

export interface TermsTemplate {
  id: string
  name: string
  content: string
  isDefault: boolean
  appliesTo: DocumentType[]
  createdAt: string
  updatedAt: string
}

export interface TermsTemplateFormData {
  name: string
  content: string
  isDefault?: boolean
  appliesTo: DocumentType[]
}
