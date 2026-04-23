import { z } from 'zod'
import {
  STOCK_ADJUST_TYPES,
  STOCK_ADJUST_REASONS,
  STOCK_MOVEMENT_TYPES,
} from '../../../../shared/enums.js'

// === Stock schemas ===

export const stockAdjustSchema = z.object({
  type: z.enum(STOCK_ADJUST_TYPES),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.enum(STOCK_ADJUST_REASONS),
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
  type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
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

// === Stock history (cursor pagination) ===

export const stockHistorySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// === Bulk stock adjustment ===

const bulkAdjustItemSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(STOCK_ADJUST_TYPES),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.enum(STOCK_ADJUST_REASONS),
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

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>
export type StockMovementQuery = z.infer<typeof stockMovementQuerySchema>
export type StockValidateInput = z.infer<typeof stockValidateSchema>
export type StockHistoryQuery = z.infer<typeof stockHistorySchema>
export type BulkStockAdjustInput = z.infer<typeof bulkStockAdjustSchema>
