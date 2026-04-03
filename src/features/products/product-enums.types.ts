/** Basic Inventory — Enum and type alias definitions
 *
 * Re-exports from @shared/enums (SSOT). All monetary amounts in PAISE (integer).
 */

// ─── Re-exports from SSOT ───────────────────────────────────────────────────

export type {
  StockValidationMode,
  StockMovementType,
  StockAdjustReason,
  StockAdjustType,
  StockStatus,
  StockValidationResult,
  LowStockAlertFrequency,
  BarcodeFormat,
  ProductSortBy,
  CustomFieldType,
  ReferenceType,
  ProductStatus,
} from '@shared/enums'

export {
  STOCK_VALIDATION_MODES,
  STOCK_MOVEMENT_TYPES,
  STOCK_ADJUST_REASONS,
  STOCK_ADJUST_TYPES,
  STOCK_STATUSES,
  STOCK_VALIDATION_RESULTS,
  LOW_STOCK_ALERT_FREQUENCIES,
  BARCODE_FORMATS,
  PRODUCT_SORT_BY,
  CUSTOM_FIELD_TYPES,
  REFERENCE_TYPES,
  PRODUCT_STATUSES,
} from '@shared/enums'

// ─── Feature-specific UI types ──────────────────────────────────────────────

export type CategoryType = 'PREDEFINED' | 'CUSTOM'

export type UnitType = 'PREDEFINED' | 'CUSTOM'
