/** Invoicing & Documents — Enum and union type definitions
 *
 * Re-exports from @shared/enums (SSOT). Feature-specific UI types stay here.
 * PRD: invoicing-documents-PLAN.md
 */

// ─── Re-exports from SSOT ───────────────────────────────────────────────────

export type {
  DocumentType,
  DocumentStatus,
  DocumentDirection,
  PaymentStatus,
  PaymentTerms,
  DiscountType,
  ChargeType,
  RoundOffSetting,
  DocumentStockValidation,
  ShareChannel,
  ExportFormat,
  DocumentSortBy,
  FinancialYearFormat,
} from '@shared/enums'

export {
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_MUTATION_STATUSES,
  DOCUMENT_DIRECTIONS,
  PAYMENT_STATUSES,
  PAYMENT_TERMS,
  DISCOUNT_TYPES,
  CHARGE_TYPES,
  ROUND_OFF_SETTINGS,
  DOC_STOCK_VALIDATION_MODES,
  SHARE_CHANNELS,
  EXPORT_FORMATS,
  DOCUMENT_SORT_BY,
  FINANCIAL_YEAR_FORMATS,
} from '@shared/enums'
