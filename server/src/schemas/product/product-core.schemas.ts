import { z } from 'zod'
import {
  STOCK_VALIDATION_MODES,
  BARCODE_FORMATS,
  PRODUCT_STATUSES,
  PRODUCT_SORT_BY,
  SORT_ORDER,
} from '../../../../shared/enums.js'

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
  stockValidation: z.enum(STOCK_VALIDATION_MODES).default('GLOBAL'),
  hsnCode: z.string().max(8).optional(),
  sacCode: z.string().max(6).optional(),
  taxCategoryId: z.string().nullable().optional(),
  description: z.string().max(500).optional(),
  barcode: z.string().max(128).optional(),
  barcodeFormat: z.enum(BARCODE_FORMATS).optional(),
  status: z.enum(PRODUCT_STATUSES).default('ACTIVE'),
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
  stockValidation: z.enum(STOCK_VALIDATION_MODES).optional(),
  hsnCode: z.string().max(8).nullable().optional(),
  sacCode: z.string().max(6).nullable().optional(),
  taxCategoryId: z.string().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  barcode: z.string().max(128).nullable().optional(),
  barcodeFormat: z.enum(BARCODE_FORMATS).nullable().optional(),
  // Feature #109 — MOQ
  moq: z.number().int().positive().nullable().optional(),
  // Feature #103 — Label template
  labelTemplate: z.enum(['standard', 'compact', 'barcode-only']).nullable().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  customFields: z.array(customFieldValueSchema).optional(),
})

export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  categoryId: z.string().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  sortBy: z.enum(PRODUCT_SORT_BY).default('name'),
  sortOrder: z.enum(SORT_ORDER).default('asc'),
})

// === Barcode lookup ===

export const barcodeSearchSchema = z.object({
  code: z.string().min(1, 'Barcode is required').max(128),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ListProductsQuery = z.infer<typeof listProductsSchema>
export type BarcodeSearchParams = z.infer<typeof barcodeSearchSchema>
