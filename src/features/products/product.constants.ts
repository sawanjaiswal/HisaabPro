/** Basic Inventory — Constants and configuration */

import type {
  ProductFilters,
  ProductSortBy,
  StockAdjustReason,
  StockMovementType,
  ProductStatus,
  StockValidationMode,
} from './product.types'

// ─── Predefined categories (PRD Flow 4) ──────────────────────────────────────
// These cannot be deleted; users can only hide them.

export interface PredefinedCategory {
  id: string   // stable client-side key used until server assigns real UUID
  name: string
  color: string
  sortOrder: number
}

export const PREDEFINED_CATEGORIES: PredefinedCategory[] = [
  { id: 'cat-general',       name: 'General',          color: 'var(--color-gray-400)',        sortOrder: 0 },
  { id: 'cat-electronics',   name: 'Electronics',      color: 'var(--color-info-500)',        sortOrder: 1 },
  { id: 'cat-grocery',       name: 'Grocery',          color: 'var(--color-success-600)',     sortOrder: 2 },
  { id: 'cat-clothing',      name: 'Clothing',         color: 'var(--color-secondary-500)',   sortOrder: 3 },
  { id: 'cat-hardware',      name: 'Hardware',         color: 'var(--color-warning-600)',     sortOrder: 4 },
  { id: 'cat-stationery',    name: 'Stationery',       color: 'var(--color-primary-400)',     sortOrder: 5 },
  { id: 'cat-fnb',           name: 'Food & Beverage',  color: 'var(--color-error-500)',       sortOrder: 6 },
  { id: 'cat-health',        name: 'Health & Beauty',  color: 'var(--color-secondary-300)',   sortOrder: 7 },
  { id: 'cat-auto',          name: 'Auto Parts',       color: 'var(--color-gray-600)',        sortOrder: 8 },
  { id: 'cat-other',         name: 'Other',            color: 'var(--color-gray-300)',        sortOrder: 9 },
]

export const DEFAULT_CATEGORY_ID = 'cat-general'

// ─── Predefined units (PRD Flow 5 — 19 units) ────────────────────────────────
// These cannot be deleted.

export interface PredefinedUnit {
  id: string   // stable client-side key
  name: string
  symbol: string
  sortOrder: number
}

export const PREDEFINED_UNITS: PredefinedUnit[] = [
  { id: 'unit-pcs',    name: 'Pieces',   symbol: 'pcs',    sortOrder: 0  },
  { id: 'unit-kg',     name: 'Kilogram', symbol: 'kg',     sortOrder: 1  },
  { id: 'unit-gm',     name: 'Gram',     symbol: 'gm',     sortOrder: 2  },
  { id: 'unit-ltr',    name: 'Litre',    symbol: 'ltr',    sortOrder: 3  },
  { id: 'unit-ml',     name: 'Millilitre', symbol: 'ml',   sortOrder: 4  },
  { id: 'unit-box',    name: 'Box',      symbol: 'box',    sortOrder: 5  },
  { id: 'unit-dozen',  name: 'Dozen',    symbol: 'dz',     sortOrder: 6  },
  { id: 'unit-meter',  name: 'Meter',    symbol: 'm',      sortOrder: 7  },
  { id: 'unit-cm',     name: 'Centimeter', symbol: 'cm',   sortOrder: 8  },
  { id: 'unit-ft',     name: 'Foot',     symbol: 'ft',     sortOrder: 9  },
  { id: 'unit-inch',   name: 'Inch',     symbol: 'in',     sortOrder: 10 },
  { id: 'unit-pair',   name: 'Pair',     symbol: 'pr',     sortOrder: 11 },
  { id: 'unit-set',    name: 'Set',      symbol: 'set',    sortOrder: 12 },
  { id: 'unit-bundle', name: 'Bundle',   symbol: 'bndl',   sortOrder: 13 },
  { id: 'unit-roll',   name: 'Roll',     symbol: 'roll',   sortOrder: 14 },
  { id: 'unit-bag',    name: 'Bag',      symbol: 'bag',    sortOrder: 15 },
  { id: 'unit-packet', name: 'Packet',   symbol: 'pkt',    sortOrder: 16 },
  { id: 'unit-bottle', name: 'Bottle',   symbol: 'btl',    sortOrder: 17 },
  { id: 'unit-can',    name: 'Can',      symbol: 'can',    sortOrder: 18 },
]

export const DEFAULT_UNIT_ID = 'unit-pcs'

// ─── SKU config ──────────────────────────────────────────────────────────────

export const SKU_PREFIX = 'PRD'
export const SKU_PADDING = 4           // "PRD-0001"
export const SKU_SEPARATOR = '-'
export const SKU_AUTO_GENERATE_DEFAULT = true

// ─── Stock adjustment reason labels ──────────────────────────────────────────

export const STOCK_ADJUST_REASON_LABELS: Record<StockAdjustReason, string> = {
  DAMAGE:  'Damage',
  THEFT:   'Theft',
  AUDIT:   'Audit correction',
  GIFT:    'Gift / Sample',
  RETURN:  'Return (unlinked)',
  OTHER:   'Other',
}

// ─── Stock movement type labels ───────────────────────────────────────────────

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  SALE:            'Sale',
  PURCHASE:        'Purchase',
  ADJUSTMENT_IN:   'Stock In',
  ADJUSTMENT_OUT:  'Stock Out',
  OPENING:         'Opening stock',
  RETURN_IN:       'Return In',
  RETURN_OUT:      'Return Out',
}

// ─── Product status labels ────────────────────────────────────────────────────

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE:   'Active',
  INACTIVE: 'Inactive',
}

// ─── Stock validation mode labels ─────────────────────────────────────────────

export const STOCK_VALIDATION_LABELS: Record<StockValidationMode, string> = {
  GLOBAL:     'Use global setting',
  WARN_ONLY:  'Warn only',
  HARD_BLOCK: 'Hard block',
}

// ─── Sort options (product list) ──────────────────────────────────────────────

export const PRODUCT_SORT_OPTIONS: { value: ProductSortBy; label: string }[] = [
  { value: 'name',          label: 'Name' },
  { value: 'salePrice',     label: 'Sale Price' },
  { value: 'purchasePrice', label: 'Purchase Price' },
  { value: 'currentStock',  label: 'Stock Level' },
  { value: 'createdAt',     label: 'Date Added' },
]

// ─── Default filter state ─────────────────────────────────────────────────────

export const DEFAULT_PRODUCT_FILTERS: ProductFilters = {
  page: 1,
  limit: 20,
  search: '',
  sortBy: 'name',
  sortOrder: 'asc',
}


// ─── Stock status color mapping (CSS var strings) ──────────────────────────────

export const STOCK_STATUS_COLORS = {
  ok:  'var(--color-success-600)',
  low: 'var(--color-warning-600)',
  out: 'var(--color-error-600)',
} as const

// ─── Pagination defaults ──────────────────────────────────────────────────────

export const PRODUCT_LIST_PAGE_SIZE = 20
export const STOCK_MOVEMENTS_PAGE_SIZE = 20

// ─── Barcode config ──────────────────────────────────────────────────────

import type { BarcodeFormat } from '@/lib/types/product.types'

export const BARCODE_FORMAT_DEFAULT: BarcodeFormat = 'CODE128'

export const BARCODE_FORMAT_OPTIONS: { value: BarcodeFormat; label: string; description: string }[] = [
  { value: 'CODE128', label: 'Code 128',  description: 'Any characters — most versatile' },
  { value: 'EAN13',   label: 'EAN-13',    description: '13 digits — retail standard (India)' },
  { value: 'EAN8',    label: 'EAN-8',     description: '8 digits — small packages' },
  { value: 'CODE39',  label: 'Code 39',   description: 'Alphanumeric — industrial use' },
  { value: 'UPC',     label: 'UPC-A',     description: '12 digits — North American retail' },
]

export const BARCODE_FORMAT_LABELS: Record<BarcodeFormat, string> = {
  CODE128: 'Code 128',
  EAN13:   'EAN-13',
  EAN8:    'EAN-8',
  CODE39:  'Code 39',
  UPC:     'UPC-A',
}

export const BARCODE_MAX_LENGTH = 48

// ─── Description and field limits ─────────────────────────────────────────────

export const PRODUCT_NAME_MAX = 200
export const PRODUCT_DESCRIPTION_MAX = 500
export const SKU_MAX = 50
export const HSN_CODE_MAX = 8
export const SAC_CODE_MAX = 6
export const CUSTOM_REASON_MAX = 200
export const NOTES_MAX = 500
export const CATEGORY_NAME_MAX = 100
export const UNIT_NAME_MAX = 50
export const UNIT_SYMBOL_MAX = 10

// ─── Form section tabs (shared by Create + Edit pages) ──────────────────────

export type ProductFormSectionId = 'basic' | 'stock' | 'extra'

export const PRODUCT_FORM_SECTIONS: { id: ProductFormSectionId; label: string }[] = [
  { id: 'basic', label: 'Basic Info' },
  { id: 'stock', label: 'Stock' },
  { id: 'extra', label: 'Extra' },
]
