/**
 * Custom Order Zod Schemas — validation for all custom-order endpoints
 */

import { z } from 'zod'

export const CUSTOM_ORDER_STATUSES = [
  'RECEIVED', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'INVOICED', 'CANCELLED',
] as const

export const ADVANCE_METHODS = ['cash', 'upi', 'bank', 'cheque', 'card', 'other'] as const

const customOrderItemSchema = z.object({
  productId: z.string().cuid().nullable().optional(),
  description: z.string().min(1).max(500),
  spec: z.record(z.string(), z.unknown()).nullable().optional(),
  // Decimal qty: accept string or number, coerce to string for Prisma Decimal
  quantity: z.union([z.string(), z.number()]).transform(v => String(v)).pipe(
    z.string().refine(v => {
      const n = parseFloat(v)
      return !isNaN(n) && n >= 0
    }, 'Quantity must be >= 0')
  ),
  ratePaise: z.number().int().nonnegative(),
  discountPaise: z.number().int().nonnegative().optional().default(0),
}).strict()

export const createCustomOrderSchema = z.object({
  partyId: z.string().cuid(),
  title: z.string().min(1).max(200),
  notes: z.string().max(5000).nullable().optional(),
  deliveryAt: z.string().datetime().nullable().optional(),
  deliverySlot: z.string().max(40).nullable().optional(),
  deliveryAddress: z.string().max(500).nullable().optional(),
  discountPaise: z.number().int().nonnegative().optional().default(0),
  items: z.array(customOrderItemSchema).min(1).max(200),
  clientId: z.string().min(1).max(64).optional(),
}).strict()

export const updateCustomOrderSchema = createCustomOrderSchema.partial().omit({ clientId: true })

export const transitionCustomOrderSchema = z.object({
  toStatus: z.enum(['RECEIVED', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'CANCELLED']),
  reason: z.string().max(500).optional(),
}).strict().refine(
  data => data.toStatus !== 'CANCELLED' || (data.reason !== undefined && data.reason.length > 0),
  { message: 'reason is required when cancelling an order', path: ['reason'] }
)

export const recordAdvanceSchema = z.object({
  amountPaise: z.number().int().positive('Amount must be positive'),
  method: z.enum(ADVANCE_METHODS),
  reference: z.string().max(120).nullable().optional(),
  receivedAt: z.string().datetime().optional(),
  notes: z.string().max(500).nullable().optional(),
}).strict()

export const listCustomOrdersSchema = z.object({
  status: z.enum(CUSTOM_ORDER_STATUSES).optional(),
  partyId: z.string().cuid().optional(),
  q: z.string().max(120).optional(),
  deliveryFrom: z.string().datetime().optional(),
  deliveryTo: z.string().datetime().optional(),
  hasBalance: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict()

export type CreateCustomOrderInput = z.infer<typeof createCustomOrderSchema>
export type UpdateCustomOrderInput = z.infer<typeof updateCustomOrderSchema>
export type TransitionCustomOrderInput = z.infer<typeof transitionCustomOrderSchema>
export type RecordAdvanceInput = z.infer<typeof recordAdvanceSchema>
export type ListCustomOrdersQuery = z.infer<typeof listCustomOrdersSchema>
