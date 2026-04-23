import { z } from 'zod'

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

// === Unit conversion query schema (#107) ===

export const unitConvertSchema = z.object({
  fromUnitId: z.string().min(1, 'fromUnitId is required'),
  toUnitId: z.string().min(1, 'toUnitId is required'),
  quantity: z.coerce.number().positive('quantity must be positive'),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>
export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
export type CreateConversionInput = z.infer<typeof createConversionSchema>
export type UpdateConversionInput = z.infer<typeof updateConversionSchema>
export type UnitConvertQuery = z.infer<typeof unitConvertSchema>
