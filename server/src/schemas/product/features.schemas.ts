import { z } from 'zod'

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

export type ProductImageInput = z.infer<typeof productImageSchema>
export type LabelDataInput = z.infer<typeof labelDataSchema>
export type QuickSaleInput = z.infer<typeof quickSaleSchema>
