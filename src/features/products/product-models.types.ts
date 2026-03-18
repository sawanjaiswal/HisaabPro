/** Basic Inventory — Model/entity interfaces */

import type { ProductSummary } from '@/lib/types/product.types'
import type {
  CategoryType,
  UnitType,
  CustomFieldType,
  StockValidationMode,
  StockMovementType,
  StockAdjustReason,
  ReferenceType,
  StockValidationResult,
} from './product-enums.types'

// ─── Category ───────────────────────────────────────────────────────────────

export interface Category {
  id: string
  name: string
  type: CategoryType
  color: string
  productCount: number
  sortOrder: number
}

export interface CreateCategoryData {
  name: string
  color?: string
  sortOrder?: number
}

export interface DeleteCategoryData {
  reassignTo: string // target category id — required before deleting
}

// ─── Unit ───────────────────────────────────────────────────────────────────

export type UnitCategory =
  | 'WEIGHT' | 'VOLUME' | 'COUNT' | 'LENGTH'
  | 'AREA' | 'SERVICE' | 'PACKAGING' | 'OTHER'

export interface Unit {
  id: string
  name: string
  symbol: string
  type: UnitType
  category: UnitCategory
  decimalAllowed: boolean
  baseUnitId: string | null
  baseUnitFactor: number | null
  baseUnit: { id: string; name: string; symbol: string } | null
  productCount: number
}

export interface CreateUnitData {
  name: string
  symbol: string
  category?: UnitCategory
  decimalAllowed?: boolean
  baseUnitId?: string
  baseUnitFactor?: number
}

export interface UnitConversion {
  id: string
  fromUnitId: string
  fromUnit: { name: string; symbol: string }
  toUnitId: string
  toUnit: { name: string; symbol: string }
  factor: number   // 1 fromUnit = factor toUnits  e.g. 1 box = 12 pcs
  businessId: string
}

export interface CreateUnitConversionData {
  fromUnitId: string
  toUnitId: string
  factor: number
}

// ─── Custom fields ───────────────────────────────────────────────────────────

export interface CustomFieldDef {
  id: string
  name: string
  fieldType: CustomFieldType
  isRequired: boolean
  showOnInvoice: boolean
  isSearchable: boolean
  options: string[] | null  // only for DROPDOWN type
  sortOrder: number
}

export interface CustomFieldValue {
  fieldDefId: string
  fieldName: string
  fieldType: CustomFieldType
  value: string  // all stored as string, parsed by type
}

export interface CreateCustomFieldDefData {
  name: string
  fieldType: CustomFieldType
  isRequired?: boolean
  showOnInvoice?: boolean
  isSearchable?: boolean
  options?: string[]  // required when fieldType === 'DROPDOWN'
}

// ─── Product (full detail) ───────────────────────────────────────────────────

export interface ProductDetail extends ProductSummary {
  description: string | null
  hsnCode: string | null    // HSN for goods  (Phase 2 GST)
  sacCode: string | null    // SAC for services (Phase 2 GST)
  stockValidation: StockValidationMode
  customFields: CustomFieldValue[]
  recentMovements: StockMovement[]  // last 10
  updatedAt: string
}

// Re-export BarcodeFormat for convenience
export type { BarcodeFormat } from '@/lib/types/product.types'

// ─── Stock movement ──────────────────────────────────────────────────────────

export interface StockMovement {
  id: string
  productId: string
  type: StockMovementType
  /** Positive = in, negative = out */
  quantity: number
  /** Running balance after this movement */
  balanceAfter: number
  reason: StockAdjustReason | null
  customReason: string | null
  notes: string | null
  referenceType: ReferenceType | null
  referenceId: string | null
  referenceNumber: string | null
  createdBy: { id: string; name: string }
  createdAt: string
}

// ─── Stock validation ─────────────────────────────────────────────────────────

export interface StockValidationItem {
  productId: string
  productName: string
  requestedQty: number     // in base units after conversion
  requestedUnit: string
  currentStock: number
  deficit: number
  validation: StockValidationResult
  message: string
}

export interface StockValidationResponse {
  valid: boolean
  items: StockValidationItem[]
}
