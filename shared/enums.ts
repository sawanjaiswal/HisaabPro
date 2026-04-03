/**
 * SHARED ENUMS — Single Source of Truth
 *
 * Both frontend and backend import from here.
 * NEVER define these values in FE or BE separately.
 *
 * Usage:
 *   Frontend: import { DOCUMENT_TYPES } from '@shared/enums'
 *   Backend:  import { DOCUMENT_TYPES } from '../../shared/enums.js'
 */

// ─── Documents ──────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  'SALE_INVOICE', 'PURCHASE_INVOICE', 'ESTIMATE', 'PROFORMA',
  'SALE_ORDER', 'PURCHASE_ORDER', 'DELIVERY_CHALLAN',
  'CREDIT_NOTE', 'DEBIT_NOTE',
] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

/** Only these statuses are valid for create/update. Full lifecycle includes more. */
export const DOCUMENT_MUTATION_STATUSES = ['DRAFT', 'SAVED'] as const
export type DocumentMutationStatus = (typeof DOCUMENT_MUTATION_STATUSES)[number]

/** Full document lifecycle statuses (includes UI-only states) */
export const DOCUMENT_STATUSES = [
  'DRAFT', 'SAVED', 'SHARED', 'CONVERTED', 'DELETED', 'PERMANENTLY_DELETED',
] as const
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const DOCUMENT_DIRECTIONS = ['OUTWARD', 'INWARD'] as const
export type DocumentDirection = (typeof DOCUMENT_DIRECTIONS)[number]

export const PAYMENT_STATUSES = ['PAID', 'PARTIAL', 'UNPAID'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_TERMS = [
  'COD', 'NET_7', 'NET_15', 'NET_30', 'NET_60', 'NET_90', 'CUSTOM',
] as const
export type PaymentTerms = (typeof PAYMENT_TERMS)[number]

export const DISCOUNT_TYPES = ['AMOUNT', 'PERCENTAGE'] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]

export const CHARGE_TYPES = ['FIXED', 'PERCENTAGE'] as const
export type ChargeType = (typeof CHARGE_TYPES)[number]

export const ROUND_OFF_SETTINGS = ['NONE', 'NEAREST_1', 'NEAREST_050', 'NEAREST_010'] as const
export type RoundOffSetting = (typeof ROUND_OFF_SETTINGS)[number]

export const SHARE_CHANNELS = ['WHATSAPP', 'EMAIL', 'PRINT'] as const
export type ShareChannel = (typeof SHARE_CHANNELS)[number]

export const EXPORT_FORMATS = ['PDF', 'JPG', 'PNG'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const DOCUMENT_SORT_BY = ['documentDate', 'createdAt', 'grandTotal', 'documentNumber'] as const
export type DocumentSortBy = (typeof DOCUMENT_SORT_BY)[number]

export const SORT_ORDER = ['asc', 'desc'] as const
export type SortOrder = (typeof SORT_ORDER)[number]

export const FINANCIAL_YEAR_FORMATS = ['SHORT', 'FULL'] as const
export type FinancialYearFormat = (typeof FINANCIAL_YEAR_FORMATS)[number]

// ─── Parties ────────────────────────────────────────────────────────────────

export const PARTY_TYPES = ['CUSTOMER', 'SUPPLIER', 'BOTH'] as const
export type PartyType = (typeof PARTY_TYPES)[number]

export const ADDRESS_TYPES = ['BILLING', 'SHIPPING'] as const
export type AddressType = (typeof ADDRESS_TYPES)[number]

export const CREDIT_LIMIT_MODES = ['WARN', 'BLOCK'] as const
export type CreditLimitMode = (typeof CREDIT_LIMIT_MODES)[number]

export const OPENING_BALANCE_TYPES = ['RECEIVABLE', 'PAYABLE'] as const
export type OpeningBalanceType = (typeof OPENING_BALANCE_TYPES)[number]

// ─── Payments ───────────────────────────────────────────────────────────────

export const PAYMENT_TYPES = ['PAYMENT_IN', 'PAYMENT_OUT'] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const PAYMENT_MODES = [
  'CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'NEFT_RTGS_IMPS', 'CREDIT_CARD', 'OTHER',
] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export const PAYMENT_DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED'] as const
export type PaymentDiscountType = (typeof PAYMENT_DISCOUNT_TYPES)[number]

export const PAYMENT_SORT_BY = ['date', 'amount', 'createdAt'] as const
export type PaymentSortBy = (typeof PAYMENT_SORT_BY)[number]

export const PAYMENT_RECORD_STATUSES = ['RECORDED', 'DELETED'] as const
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number]

export const OUTSTANDING_TYPES = ['RECEIVABLE', 'PAYABLE', 'ALL'] as const
export type OutstandingType = (typeof OUTSTANDING_TYPES)[number]

export const OUTSTANDING_SORT_BY = ['amount', 'name', 'daysOverdue'] as const
export type OutstandingSortBy = (typeof OUTSTANDING_SORT_BY)[number]

export const REMINDER_CHANNELS = ['WHATSAPP', 'SMS', 'PUSH'] as const
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number]

export const REMINDER_STATUSES = [
  'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'PERMANENTLY_FAILED', 'ACKNOWLEDGED',
] as const
export type ReminderStatus = (typeof REMINDER_STATUSES)[number]

// ─── Products & Inventory ───────────────────────────────────────────────────

export const PRODUCT_STATUSES = ['ACTIVE', 'INACTIVE'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

export const STOCK_VALIDATION_MODES = ['GLOBAL', 'WARN_ONLY', 'HARD_BLOCK'] as const
export type StockValidationMode = (typeof STOCK_VALIDATION_MODES)[number]

/** Document-level stock validation (simplified version) */
export const DOC_STOCK_VALIDATION_MODES = ['OFF', 'WARN', 'BLOCK'] as const
export type DocumentStockValidation = (typeof DOC_STOCK_VALIDATION_MODES)[number]

export const STOCK_MOVEMENT_TYPES = [
  'SALE', 'PURCHASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
  'OPENING', 'RETURN_IN', 'RETURN_OUT', 'REVERSAL',
] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export const STOCK_ADJUST_REASONS = [
  'DAMAGE', 'THEFT', 'AUDIT', 'GIFT', 'RETURN', 'OTHER',
] as const
export type StockAdjustReason = (typeof STOCK_ADJUST_REASONS)[number]

export const STOCK_ADJUST_TYPES = ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT'] as const
export type StockAdjustType = (typeof STOCK_ADJUST_TYPES)[number]

export const STOCK_STATUSES = ['ok', 'low', 'out'] as const
export type StockStatus = (typeof STOCK_STATUSES)[number]

export const STOCK_VALIDATION_RESULTS = ['OK', 'WARN', 'BLOCK'] as const
export type StockValidationResult = (typeof STOCK_VALIDATION_RESULTS)[number]

export const LOW_STOCK_ALERT_FREQUENCIES = ['ONCE', 'DAILY', 'EVERY_TIME'] as const
export type LowStockAlertFrequency = (typeof LOW_STOCK_ALERT_FREQUENCIES)[number]

export const BARCODE_FORMATS = ['CODE128', 'EAN13', 'EAN8', 'UPC', 'QR', 'CODE39'] as const
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number]

export const PRODUCT_SORT_BY = [
  'name', 'salePrice', 'purchasePrice', 'currentStock', 'createdAt',
] as const
export type ProductSortBy = (typeof PRODUCT_SORT_BY)[number]

export const CUSTOM_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN'] as const
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]

export const REFERENCE_TYPES = [
  'INVOICE', 'PURCHASE_ORDER', 'CREDIT_NOTE', 'DEBIT_NOTE', 'MANUAL',
] as const
export type ReferenceType = (typeof REFERENCE_TYPES)[number]

// ─── Sync ───────────────────────────────────────────────────────────────────

export const SYNC_STATUSES = ['SYNCED', 'PENDING', 'CONFLICT', 'FAILED'] as const
export type SyncStatus = (typeof SYNC_STATUSES)[number]

// ─── Roles & Permissions ────────────────────────────────────────────────────

export const BUSINESS_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER'] as const
export type BusinessRole = (typeof BUSINESS_ROLES)[number]

// ─── Accounting ─────────────────────────────────────────────────────────────

export const ENTRY_STATUSES = ['DRAFT', 'POSTED', 'VOID'] as const
export type EntryStatus = (typeof ENTRY_STATUSES)[number]

// ─── Constants ──────────────────────────────────────────────────────────────

/** Basis points divisor for tax rate calculations (rate * amount / PAISE_BASIS_POINTS) */
export const PAISE_BASIS_POINTS = 10_000
