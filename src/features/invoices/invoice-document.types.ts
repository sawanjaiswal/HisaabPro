/** Invoicing & Documents — Document model interfaces
 *
 * All monetary amounts stored in PAISE (integer).
 * Covers document share logs, transport details, line items,
 * party snapshots, references, summaries, and detail views.
 *
 * PRD: invoicing-documents-PLAN.md
 */

import type {
  ChargeType,
  DiscountType,
  DocumentStatus,
  DocumentType,
  PaymentTerms,
  ShareChannel,
  ExportFormat,
} from './invoice-enums.types'

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
