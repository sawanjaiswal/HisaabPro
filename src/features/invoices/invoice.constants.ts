/** Invoicing & Documents — Constants and configuration
 *
 * All label maps, defaults, and config values for the invoicing system.
 * No business logic here — pure data.
 */

import type {
  DocumentType,
  DocumentStatus,
  PaymentTerms,
  DiscountType,
  ChargeType,
  RoundOffSetting,
  ShareChannel,
  DocumentSortBy,
  DocumentFilters,
  DocumentDirection,
  PaymentStatus,
} from './invoice.types'

// ─── Invoice detail page tabs ────────────────────────────────────────────────

export type DetailTab = 'overview' | 'items' | 'share' | 'compliance'

export const DETAIL_TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'items', label: 'Items' },
  { id: 'share', label: 'Share' },
  { id: 'compliance', label: 'Compliance' },
]

/** Document types that support e-compliance (e-invoice + e-way bill) */
export const ECOMPLIANCE_DOCUMENT_TYPES = new Set(['SALE_INVOICE', 'PURCHASE_INVOICE'])

// ─── Invoice form section tabs ───────────────────────────────────────────────

export const FORM_SECTIONS: { id: 'items' | 'details' | 'charges'; label: string }[] = [
  { id: 'items', label: 'Items' },
  { id: 'details', label: 'Details' },
  { id: 'charges', label: 'Charges' },
]

// ─── Document type display labels ─────────────────────────────────────────────

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SALE_INVOICE:      'Sale Invoice',
  PURCHASE_INVOICE:  'Purchase Invoice',
  ESTIMATE:          'Estimate',
  PROFORMA:          'Proforma Invoice',
  SALE_ORDER:        'Sale Order',
  PURCHASE_ORDER:    'Purchase Order',
  DELIVERY_CHALLAN:  'Delivery Challan',
}

// ─── Document type short codes ────────────────────────────────────────────────
// Used in auto-generated document numbers: e.g. INV-2526-001

export const DOCUMENT_TYPE_CODES: Record<DocumentType, string> = {
  SALE_INVOICE:      'INV',
  PURCHASE_INVOICE:  'PI',
  ESTIMATE:          'EST',
  PROFORMA:          'PRO',
  SALE_ORDER:        'SO',
  PURCHASE_ORDER:    'PO',
  DELIVERY_CHALLAN:  'DC',
}

// ─── Document status display labels ───────────────────────────────────────────

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT:               'Draft',
  SAVED:               'Saved',
  SHARED:              'Shared',
  CONVERTED:           'Converted',
  DELETED:             'Deleted',
  PERMANENTLY_DELETED: 'Permanently Deleted',
}

// ─── Payment terms display labels ─────────────────────────────────────────────

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  COD:    'Cash on Delivery',
  NET_7:  'Net 7 Days',
  NET_15: 'Net 15 Days',
  NET_30: 'Net 30 Days',
  NET_60: 'Net 60 Days',
  NET_90: 'Net 90 Days',
  CUSTOM: 'Custom',
}

// ─── Payment terms days mapping ────────────────────────────────────────────────
// Number of calendar days from document date to due date.
// COD = 0 (due immediately). CUSTOM requires explicit dueDate from user.

export const PAYMENT_TERMS_DAYS: Record<PaymentTerms, number> = {
  COD:    0,
  NET_7:  7,
  NET_15: 15,
  NET_30: 30,
  NET_60: 60,
  NET_90: 90,
  CUSTOM: 0,   // UI must prompt for explicit due date when CUSTOM
}

// ─── Discount type labels ─────────────────────────────────────────────────────

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  AMOUNT:     '₹',
  PERCENTAGE: '%',
}

// ─── Additional charge type labels ────────────────────────────────────────────

export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  FIXED:      '₹',
  PERCENTAGE: '%',
}

// ─── Predefined additional charge names ───────────────────────────────────────
// Shown as quick-select in the additional charges section.
// Users can also type a custom name.

export const DEFAULT_ADDITIONAL_CHARGES: string[] = [
  'Shipping',
  'Packaging',
  'Freight',
  'Loading',
  'Insurance',
]

// ─── Round-off setting labels ─────────────────────────────────────────────────

export const ROUND_OFF_LABELS: Record<RoundOffSetting, string> = {
  NONE:         'No rounding',
  NEAREST_010:  'Nearest ₹0.10',
  NEAREST_050:  'Nearest ₹0.50',
  NEAREST_1:    'Nearest ₹1',
}

// ─── Share channel labels ─────────────────────────────────────────────────────

export const SHARE_CHANNEL_LABELS: Record<ShareChannel, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL:    'Email',
  PRINT:    'Print',
}

// ─── Document list sort options ───────────────────────────────────────────────

export const DOCUMENT_SORT_OPTIONS: { value: DocumentSortBy; label: string }[] = [
  { value: 'documentDate',    label: 'Invoice Date' },
  { value: 'createdAt',       label: 'Date Created' },
  { value: 'total',           label: 'Amount' },
  { value: 'documentNumber',  label: 'Document Number' },
]

// ─── Default document list filter state ───────────────────────────────────────
// `type` is intentionally omitted — each document list supplies its own type.
// Spread this into a full DocumentFilters object: { ...DEFAULT_DOCUMENT_FILTERS, type: 'SALE_INVOICE' }

export const DEFAULT_DOCUMENT_FILTERS: Omit<DocumentFilters, 'type'> = {
  page:      1,
  limit:     20,
  sortBy:    'documentDate',
  sortOrder: 'desc',
}

// ─── Line item and charge limits ──────────────────────────────────────────────

export const MAX_LINE_ITEMS = 100
export const MAX_ADDITIONAL_CHARGES = 10

// ─── Allowed document conversions ─────────────────────────────────────────────
// Maps source type → array of valid target types.
// Types not listed here (SALE_INVOICE, PURCHASE_INVOICE) are terminal — no conversion.

export const ALLOWED_CONVERSIONS: Partial<Record<DocumentType, DocumentType[]>> = {
  ESTIMATE:          ['SALE_ORDER', 'SALE_INVOICE'],
  PROFORMA:          ['SALE_INVOICE'],
  SALE_ORDER:        ['SALE_INVOICE', 'DELIVERY_CHALLAN'],
  PURCHASE_ORDER:    ['PURCHASE_INVOICE'],
  DELIVERY_CHALLAN:  ['SALE_INVOICE'],
}

// ─── Document direction ────────────────────────────────────────────────────────
// OUTWARD = sale-side documents (leaving the business)
// INWARD  = purchase-side documents (coming into the business)

export const DOCUMENT_DIRECTION: Record<DocumentType, DocumentDirection> = {
  SALE_INVOICE:      'OUTWARD',
  PURCHASE_INVOICE:  'INWARD',
  ESTIMATE:          'OUTWARD',
  PROFORMA:          'OUTWARD',
  SALE_ORDER:        'OUTWARD',
  PURCHASE_ORDER:    'INWARD',
  DELIVERY_CHALLAN:  'OUTWARD',
}

// ─── Stock effect flags ────────────────────────────────────────────────────────
// true = document affects inventory when saved

export const AFFECTS_STOCK: Record<DocumentType, boolean> = {
  SALE_INVOICE:      true,   // decreases stock
  PURCHASE_INVOICE:  true,   // increases stock
  ESTIMATE:          false,
  PROFORMA:          false,
  SALE_ORDER:        false,
  PURCHASE_ORDER:    false,
  DELIVERY_CHALLAN:  true,   // decreases stock
}

// ─── Outstanding effect flags ─────────────────────────────────────────────────
// true = document updates party outstanding balance when saved

export const AFFECTS_OUTSTANDING: Record<DocumentType, boolean> = {
  SALE_INVOICE:      true,   // receivable — party owes us
  PURCHASE_INVOICE:  true,   // payable   — we owe party
  ESTIMATE:          false,
  PROFORMA:          false,
  SALE_ORDER:        false,
  PURCHASE_ORDER:    false,
  DELIVERY_CHALLAN:  false,
}

// ─── Invoice number config ────────────────────────────────────────────────────

export const INVOICE_NUMBER_PADDING = 3         // "INV-2526-001"
export const INVOICE_NUMBER_SEPARATOR = '-'
export const FINANCIAL_YEAR_FORMAT = 'SHORT' as const  // "2526" for FY 2025-26

// ─── Status badge CSS class variants ─────────────────────────────────────────
// CSS classes defined in the design system. No raw colors here.

export const STATUS_BADGE_VARIANTS: Record<DocumentStatus, string> = {
  DRAFT:               'badge-info',
  SAVED:               'badge-paid',
  SHARED:              'badge-pending',
  CONVERTED:           'badge-converted',
  DELETED:             'badge-error',
  PERMANENTLY_DELETED: 'badge-error',
}

// ─── Payment status badge CSS class variants ──────────────────────────────────

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, string> = {
  PAID:    'badge-paid',
  PARTIAL: 'badge-pending',
  UNPAID:  'badge-overdue',
}
