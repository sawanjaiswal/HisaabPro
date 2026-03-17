/** Invoicing & Documents — Enum and union type definitions
 *
 * All enum-like union types used across the invoicing feature.
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
