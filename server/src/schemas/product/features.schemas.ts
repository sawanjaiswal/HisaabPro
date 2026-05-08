import { z } from 'zod'

// Max 1 MB per entry after base64 decode (base64 length × 0.75 ≤ 1_048_576)
const MAX_IMAGE_BYTES = 1_048_576
const DATA_URL_REGEX = /^data:image\/(jpeg|png|webp);base64,/

/** Validate a single image entry: data-URL or https URL */
const imageEntrySchema = z.string().superRefine((val, ctx) => {
  if (DATA_URL_REGEX.test(val)) {
    // base64 data URL — check size
    const b64 = val.split(',')[1] ?? ''
    const approxBytes = Math.floor(b64.length * 0.75)
    if (approxBytes > MAX_IMAGE_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `IMAGE_TOO_LARGE:${approxBytes}`,
      })
    }
    return
  }
  // Must be an https URL if not a data URL
  try {
    const url = new URL(val)
    if (url.protocol !== 'https:') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Image must be a data:image/... URL or an https URL' })
    }
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Image must be a data:image/... URL or an https URL' })
  }
})

// === Feature #108 — Item Images ===

export const productImageSchema = z.object({
  imageUrl: imageEntrySchema.optional(),
  images: z.array(imageEntrySchema).max(5, 'Maximum 5 images allowed').optional(),
}).refine(
  (d) => d.imageUrl !== undefined || (d.images !== undefined && d.images.length > 0),
  { message: 'Provide imageUrl or at least one image entry (URL or base64 data-URL)' }
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
