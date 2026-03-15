/** Invoicing & Documents — Type definitions
 *
 * All monetary amounts stored in PAISE (integer).
 * Covers all 7 document types: Sale Invoice, Purchase Invoice, Estimate,
 * Proforma Invoice, Sale Order, Purchase Order, Delivery Challan.
 *
 * PRD: invoicing-documents-PLAN.md
 */

// ─── Enums / union types ────────────────────────────────────────────────────

export type DocumentType =
  | 'SALE_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'ESTIMATE'
  | 'PROFORMA'
  | 'SALE_ORDER'
  | 'PURCHASE_ORDER'
  | 'DELIVERY_CHALLAN'

export type DocumentStatus =
  | 'DRAFT'
  | 'SAVED'
  | 'SHARED'
  | 'CONVERTED'
  | 'DELETED'
  | 'PERMANENTLY_DELETED'

export type DocumentDirection = 'OUTWARD' | 'INWARD'

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID'

export type PaymentTerms =
  | 'COD'
  | 'NET_7'
  | 'NET_15'
  | 'NET_30'
  | 'NET_60'
  | 'NET_90'
  | 'CUSTOM'

export type DiscountType = 'AMOUNT' | 'PERCENTAGE'

export type ChargeType = 'FIXED' | 'PERCENTAGE'

export type RoundOffSetting =
  | 'NONE'
  | 'NEAREST_1'
  | 'NEAREST_050'
  | 'NEAREST_010'

/** Stock validation mode — also used in document settings */
export type DocumentStockValidation = 'OFF' | 'WARN' | 'BLOCK'

export type ShareChannel = 'WHATSAPP' | 'EMAIL' | 'PRINT'

export type ExportFormat = 'PDF' | 'JPG' | 'PNG'

export type DocumentSortBy =
  | 'documentDate'
  | 'createdAt'
  | 'total'
  | 'documentNumber'

/** Financial year format stored in number series, e.g. "2526" */
export type FinancialYearFormat = 'SHORT' | 'FULL'

// ─── Document Share Log ──────────────────────────────────────────────────────

export interface DocumentShareLog {
  id: string
  channel: ShareChannel
  format: ExportFormat
  sentAt: string
  /** Set for WHATSAPP channel */
  recipientPhone: string | null
  /** Set for EMAIL channel */
  recipientEmail: string | null
  /** URL of the generated file (image/PDF) */
  fileUrl: string | null
  /** File size in bytes */
  fileSize: number | null
  /** Custom message body (for email) */
  message: string | null
  sentBy: { id: string; name: string }
}

// ─── Transport Details (Delivery Challan) ────────────────────────────────────

export interface TransportDetails {
  vehicleNumber: string | null
  driverName: string | null
  transportNotes: string | null
}

// ─── Document Additional Charge ──────────────────────────────────────────────

export interface DocumentAdditionalCharge {
  id: string
  name: string
  type: ChargeType
  /** Entered value: absolute (FIXED) or percent (PERCENTAGE) */
  value: number
  /** Calculated amount in PAISE */
  amount: number
  sortOrder: number
}

// ─── Document Line Item ──────────────────────────────────────────────────────

export interface DocumentLineItem {
  id: string
  sortOrder: number
  product: {
    id: string
    name: string
    sku: string
    unit: string
    currentStock: number
  }
  quantity: number
  /** Rate in PAISE */
  rate: number
  discountType: DiscountType
  /** The value entered — absolute PAISE (AMOUNT) or percent 0-100 (PERCENTAGE) */
  discountValue: number
  /** Calculated discount in PAISE */
  discountAmount: number
  /** (qty × rate) - discountAmount, in PAISE */
  lineTotal: number
  /** Snapshot of product's purchase price at time of invoice, in PAISE */
  purchasePrice: number
  /** lineTotal - (qty × purchasePrice), in PAISE */
  profit: number
  /** Profit as percentage of lineTotal */
  profitPercent: number
}

// ─── Party snapshot (embedded in document responses) ─────────────────────────

export interface DocumentPartySnapshot {
  id: string
  name: string
  phone: string
}

export interface DocumentPartyDetail extends DocumentPartySnapshot {
  email: string | null
  gstin: string | null
  billingAddress: {
    street: string
    city: string
    state: string
    pincode: string
  } | null
  shippingAddress: {
    street: string
    city: string
    state: string
    pincode: string
  } | null
  /** Outstanding balance in PAISE */
  outstandingBalance: number
}

// ─── Source / conversion reference ───────────────────────────────────────────

export interface DocumentRef {
  id: string
  type: DocumentType
  documentNumber: string
}

// ─── Document Summary (list item) ────────────────────────────────────────────

export interface DocumentSummary {
  id: string
  type: DocumentType
  status: DocumentStatus
  documentNumber: string
  documentDate: string
  dueDate: string | null
  party: DocumentPartySnapshot
  /** Sum of (qty × rate) for all line items, in PAISE */
  subtotal: number
  /** Sum of all line-item discount amounts, in PAISE */
  totalDiscount: number
  /** Sum of all additional charges, in PAISE */
  totalAdditionalCharges: number
  /** Round-off adjustment applied (positive or negative), in PAISE */
  roundOff: number
  /** Final payable amount, in PAISE */
  grandTotal: number
  /** Total profit across all line items, in PAISE */
  totalProfit: number
  /** Amount paid so far (from Payment Tracking), in PAISE */
  paidAmount: number
  /** grandTotal - paidAmount, in PAISE */
  balanceDue: number
  lineItemCount: number
  createdAt: string
  updatedAt: string
}

// ─── Document Detail (single document) ──────────────────────────────────────

export interface DocumentDetail extends DocumentSummary {
  paymentTerms: PaymentTerms | null
  party: DocumentPartyDetail
  shippingAddressId: string | null
  lineItems: DocumentLineItem[]
  additionalCharges: DocumentAdditionalCharge[]
  notes: string | null
  termsAndConditions: string | null
  /** URL of the business's digital signature image, if includeSignature is true */
  signatureUrl: string | null
  includeSignature: boolean
  /** Source document this was converted from */
  sourceDocument: DocumentRef | null
  /** Document this was converted into */
  convertedTo: DocumentRef | null
  shareLogs: DocumentShareLog[]
  /** Only present for DELIVERY_CHALLAN */
  transportDetails: TransportDetails | null
  /** Overall profit percent across the document */
  profitPercent: number
  /** Sum of (qty × purchasePrice) across all line items, in PAISE */
  totalCost: number
  createdBy: { id: string; name: string }
}

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
