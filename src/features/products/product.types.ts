/** Basic Inventory — Type definitions (barrel re-export)
 *
 * All types split into:
 *   product-enums.types.ts   — type aliases and enums
 *   product-models.types.ts  — entity/model interfaces
 *   product-api.types.ts     — API responses, filters, forms, settings
 *
 * This barrel preserves backward compatibility — all consumers
 * can continue importing from './product.types'.
 */

// Shared types re-exported from lib for backward compatibility within this feature
export type { ProductSummary, ProductStatus } from '@/lib/types/product.types'

// ─── Enums & type aliases ────────────────────────────────────────────────────
export type {
  StockValidationMode,
  StockMovementType,
  StockAdjustReason,
  CategoryType,
  UnitType,
  CustomFieldType,
  StockStatus,
  ProductSortBy,
  StockAdjustType,
  ReferenceType,
  StockValidationResult,
  LowStockAlertFrequency,
} from './product-enums.types'

// ─── Models & entities ───────────────────────────────────────────────────────
export type {
  Category,
  CreateCategoryData,
  DeleteCategoryData,
  Unit,
  CreateUnitData,
  UnitConversion,
  CreateUnitConversionData,
  CustomFieldDef,
  CustomFieldValue,
  CreateCustomFieldDefData,
  ProductDetail,
  StockMovement,
  StockValidationItem,
  StockValidationResponse,
} from './product-models.types'

// ─── API responses, filters, forms, settings ─────────────────────────────────
export type {
  Pagination,
  ProductListResponse,
  StockMovementListResponse,
  StockAdjustResponse,
  ProductFilters,
  StockMovementFilters,
  ProductFormData,
  StockAdjustFormData,
  CategoryFormData,
  UnitFormData,
  InventorySettings,
} from './product-api.types'
