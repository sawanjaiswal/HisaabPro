import { z } from 'zod'

// === Sub-schemas ===

const customFieldValueSchema = z.object({
  fieldId: z.string().min(1),
  value: z.string().min(1, 'Custom field value is required'),
})

// === Product schemas ===

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().max(50).optional(),
  autoGenerateSku: z.boolean().default(true),
  categoryId: z.string().optional(),
  unitId: z.string().min(1, 'Unit is required'),
  salePrice: z.number().int().min(0, 'Sale price must be non-negative'), // in paise
  purchasePrice: z.number().int().min(0).optional(), // in paise
  openingStock: z.number().min(0).default(0),
  minStockLevel: z.number().min(0).default(0),
  stockValidation: z.enum(['GLOBAL', 'WARN_ONLY', 'HARD_BLOCK']).default('GLOBAL'),
  hsnCode: z.string().max(8).optional(),
  sacCode: z.string().max(6).optional(),
  taxCategoryId: z.string().nullable().optional(),
  description: z.string().max(500).optional(),
  barcode: z.string().max(128).optional(),
  barcodeFormat: z.enum(['CODE128', 'EAN13', 'EAN8', 'UPC', 'QR', 'CODE39']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  customFields: z.array(customFieldValueSchema).default([]),
})

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().max(50).optional(),
  categoryId: z.string().nullable().optional(),
  unitId: z.string().optional(),
  salePrice: z.number().int().min(0).optional(),
  purchasePrice: z.number().int().min(0).nullable().optional(),
  minStockLevel: z.number().min(0).optional(),
  stockValidation: z.enum(['GLOBAL', 'WARN_ONLY', 'HARD_BLOCK']).optional(),
  hsnCode: z.string().max(8).nullable().optional(),
  sacCode: z.string().max(6).nullable().optional(),
  taxCategoryId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  barcode: z.string().max(128).nullable().optional(),
  barcodeFormat: z.enum(['CODE128', 'EAN13', 'EAN8', 'UPC', 'QR', 'CODE39']).nullable().optional(),
  // Feature #109 — MOQ
  moq: z.number().int().positive().nullable().optional(),
  // Feature #103 — Label template
  labelTemplate: z.enum(['standard', 'compact', 'barcode-only']).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  customFields: z.array(customFieldValueSchema).optional(),
})

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  categoryId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'salePrice', 'purchasePrice', 'currentStock', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

// === Stock schemas ===

export const stockAdjustSchema = z.object({
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.enum(['DAMAGE', 'THEFT', 'AUDIT', 'GIFT', 'RETURN', 'OTHER']),
  customReason: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  date: z.string().datetime().optional(),
}).superRefine((data, ctx) => {
  if (data.reason === 'OTHER' && (!data.customReason || data.customReason.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Custom reason is required when reason is OTHER',
      path: ['customReason'],
    })
  }
})

export const stockMovementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum([
    'SALE', 'PURCHASE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
    'OPENING', 'RETURN_IN', 'RETURN_OUT', 'REVERSAL',
  ]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export const stockValidateSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive(),
    unitId: z.string().min(1),
  })).min(1, 'At least one item is required'),
})

// === Barcode lookup ===

export const barcodeSearchSchema = z.object({
  code: z.string().min(1, 'Barcode is required').max(128),
})

// === Stock history (cursor pagination) ===

export const stockHistorySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// === Bulk stock adjustment ===

const bulkAdjustItemSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.enum(['DAMAGE', 'THEFT', 'AUDIT', 'GIFT', 'RETURN', 'OTHER']),
  customReason: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
  if (data.reason === 'OTHER' && (!data.customReason || data.customReason.trim().length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Custom reason is required when reason is OTHER',
      path: ['customReason'],
    })
  }
})

export const bulkStockAdjustSchema = z.object({
  adjustments: z.array(bulkAdjustItemSchema)
    .min(1, 'At least one adjustment is required')
    .max(50, 'Maximum 50 adjustments per request'),
})

// === Category schemas ===

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code').optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code').optional(),
  sortOrder: z.number().int().min(0).optional(),
  isHidden: z.boolean().optional(),
})

export const deleteCategorySchema = z.object({
  reassignTo: z.string().min(1, 'Target category is required'),
})

// === Unit schemas ===

const unitCategoryEnum = z.enum([
  'WEIGHT', 'VOLUME', 'COUNT', 'LENGTH', 'AREA', 'SERVICE', 'PACKAGING', 'OTHER',
])

export const createUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required').max(50),
  symbol: z.string().min(1, 'Unit symbol is required').max(10),
  category: unitCategoryEnum.optional(),
  decimalAllowed: z.boolean().optional(),
  baseUnitId: z.string().optional(),
  baseUnitFactor: z.number().positive().optional(),
})

export const updateUnitSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  symbol: z.string().min(1).max(10).optional(),
  category: unitCategoryEnum.optional(),
  decimalAllowed: z.boolean().optional(),
  baseUnitId: z.string().nullable().optional(),
  baseUnitFactor: z.number().positive().nullable().optional(),
})

// === Unit Conversion schemas ===

export const createConversionSchema = z.object({
  fromUnitId: z.string().min(1, 'From unit is required'),
  toUnitId: z.string().min(1, 'To unit is required'),
  factor: z.number().positive('Factor must be positive'),
})

export const updateConversionSchema = z.object({
  factor: z.number().positive('Factor must be positive'),
})

// === Inventory Settings schemas ===

export const updateInventorySettingsSchema = z.object({
  stockValidationMode: z.enum(['WARN_ONLY', 'HARD_BLOCK']).optional(),
  skuPrefix: z.string().max(10).optional(),
  skuAutoGenerate: z.boolean().optional(),
  lowStockAlertFrequency: z.enum(['ONCE', 'DAILY', 'EVERY_TIME']).optional(),
  lowStockAlertEnabled: z.boolean().optional(),
  decimalPrecisionQty: z.number().int().min(0).max(3).optional(),
  defaultCategoryId: z.string().nullable().optional(),
  defaultUnitId: z.string().nullable().optional(),
})

// === Bulk Import / Export schemas (#104) ===

/** One product row in a bulk import request. */
const bulkImportProductItemSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(100).optional(),
  categoryId: z.string().optional(),
  unitId: z.string().min(1, 'Unit is required'),
  salePrice: z.number().int().min(0, 'Sale price must be non-negative'), // in paise
  purchasePrice: z.number().int().min(0).optional(), // in paise
  openingStock: z.number().min(0).default(0),
  minStockLevel: z.number().min(0).default(0),
  hsnCode: z.string().max(8).optional(),
})

export const bulkImportProductSchema = z.object({
  products: z
    .array(bulkImportProductItemSchema)
    .min(1, 'At least one product is required')
    .max(500, 'Maximum 500 products per import'),
})

export const exportProductsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(1000),
})

// === Reorder list schema (#106) ===

export const reorderListSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// === Unit conversion query schema (#107) ===

export const unitConvertSchema = z.object({
  fromUnitId: z.string().min(1, 'fromUnitId is required'),
  toUnitId: z.string().min(1, 'toUnitId is required'),
  quantity: z.coerce.number().positive('quantity must be positive'),
})

// === Feature #108 — Item Images ===

export const productImageSchema = z.object({
  imageUrl: z.string().url('imageUrl must be a valid URL').optional(),
  images: z.array(z.string().url('Each image must be a valid URL')).max(5, 'Maximum 5 images allowed').optional(),
}).refine(
  (d) => d.imageUrl !== undefined || (d.images !== undefined && d.images.length > 0),
  { message: 'Provide imageUrl or at least one image URL' }
)

// === Feature #103 — Label Printing (batch label data) ===

export const labelDataSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(200, 'Maximum 200 products per request'),
  template: z.enum(['standard', 'compact', 'barcode-only']).optional(),
})

// === Feature #110 — POS Quick Sale ===

const quickSaleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  price: z.number().int().min(0).optional(), // override price in paise; defaults to product salePrice
})

export const quickSaleSchema = z.object({
  items: z.array(quickSaleItemSchema).min(1, 'At least one item is required').max(50),
  paymentMode: z.enum(['cash', 'upi', 'card']),
  amountPaid: z.number().int().min(0),
  partyId: z.string().min(1).optional(), // if absent → walk-in customer
})

// === Inferred types ===

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ListProductsQuery = z.infer<typeof listProductsSchema>
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>
export type StockMovementQuery = z.infer<typeof stockMovementQuerySchema>
export type StockValidateInput = z.infer<typeof stockValidateSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>
export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
export type CreateConversionInput = z.infer<typeof createConversionSchema>
export type UpdateConversionInput = z.infer<typeof updateConversionSchema>
export type UpdateInventorySettingsInput = z.infer<typeof updateInventorySettingsSchema>
export type BulkImportProductInput = z.infer<typeof bulkImportProductSchema>
export type ExportProductsQuery = z.infer<typeof exportProductsSchema>
export type ReorderListQuery = z.infer<typeof reorderListSchema>
export type UnitConvertQuery = z.infer<typeof unitConvertSchema>
export type BarcodeSearchParams = z.infer<typeof barcodeSearchSchema>
export type StockHistoryQuery = z.infer<typeof stockHistorySchema>
export type BulkStockAdjustInput = z.infer<typeof bulkStockAdjustSchema>
export type ProductImageInput = z.infer<typeof productImageSchema>
export type LabelDataInput = z.infer<typeof labelDataSchema>
export type QuickSaleInput = z.infer<typeof quickSaleSchema>
