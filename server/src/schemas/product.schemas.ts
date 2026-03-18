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
