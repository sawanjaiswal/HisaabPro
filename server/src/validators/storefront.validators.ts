/**
 * Storefront Zod validators — Epic C PR4 (#121).
 *
 * ARCHITECTURE §H.3: slug transform → regex → reserved-list.
 * All schemas are .strict() (no passthrough).
 */

import { z } from 'zod'
import { SLUG_REGEX, isReservedSlug } from '../lib/storefront-slug.js'

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

export const storefrontSlugSchema = z
  .string()
  .min(3, 'INVALID_SLUG')
  .max(32, 'INVALID_SLUG')
  .transform((s) => s.trim().toLowerCase())
  .refine((s) => SLUG_REGEX.test(s), { message: 'INVALID_SLUG' })
  .refine((s) => !isReservedSlug(s), { message: 'RESERVED_SLUG' })

// ---------------------------------------------------------------------------
// E.164 WhatsApp number (digits only, no +)
// ---------------------------------------------------------------------------

const e164DigitsSchema = z
  .string()
  .regex(/^\d{7,15}$/, 'Must be 7–15 digits (E.164 without leading +)')
  .optional()
  .nullable()

// ---------------------------------------------------------------------------
// PATCH /api/businesses/me/storefront
// ---------------------------------------------------------------------------

export const patchStorefrontSchema = z
  .object({
    slug: storefrontSlugSchema.optional(),
    isPublic: z.boolean().optional(),
    tagline: z.string().max(80).optional().nullable(),
    theme: z.enum(['LIGHT', 'DARK']).optional(),
    whatsapp: e164DigitsSchema,
  })
  .strict()

export type PatchStorefrontBody = z.infer<typeof patchStorefrontSchema>

// ---------------------------------------------------------------------------
// POST /api/businesses/me/storefront/products
// ---------------------------------------------------------------------------

export const addStorefrontProductsSchema = z
  .object({
    productIds: z
      .array(z.string().min(1))
      .min(1, 'At least one productId required')
      .max(100, 'Maximum 100 products per request'),
  })
  .strict()

export type AddStorefrontProductsBody = z.infer<typeof addStorefrontProductsSchema>

// ---------------------------------------------------------------------------
// PATCH /api/businesses/me/storefront/products/:productId
// ---------------------------------------------------------------------------

export const patchStorefrontProductSchema = z
  .object({
    sortOrder: z.number().int().min(0).optional(),
    visible: z.boolean().optional(),
    priceVisible: z.boolean().optional(),
  })
  .strict()
  .refine(
    (d) => d.sortOrder !== undefined || d.visible !== undefined || d.priceVisible !== undefined,
    { message: 'At least one field required (sortOrder, visible, or priceVisible)' }
  )

export type PatchStorefrontProductBody = z.infer<typeof patchStorefrontProductSchema>
