import { z } from 'zod'
import {
  STOCK_VALIDATION_MODES,
  LOW_STOCK_ALERT_FREQUENCIES,
} from '../../../../shared/enums.js'

// === Inventory Settings schemas ===

export const updateInventorySettingsSchema = z.object({
  stockValidationMode: z.enum(STOCK_VALIDATION_MODES).optional(),
  skuPrefix: z.string().max(10).optional(),
  skuAutoGenerate: z.boolean().optional(),
  lowStockAlertFrequency: z.enum(LOW_STOCK_ALERT_FREQUENCIES).optional(),
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

export type UpdateInventorySettingsInput = z.infer<typeof updateInventorySettingsSchema>
export type BulkImportProductInput = z.infer<typeof bulkImportProductSchema>
export type ExportProductsQuery = z.infer<typeof exportProductsSchema>
export type ReorderListQuery = z.infer<typeof reorderListSchema>
