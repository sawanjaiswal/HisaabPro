import { z } from 'zod'

const BUSINESS_TYPES = ['general', 'retail', 'wholesale', 'manufacturing', 'services', 'restaurant', 'pharmacy', 'other'] as const

export const createBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters').max(100, 'Business name must be under 100 characters'),
  businessType: z.enum(BUSINESS_TYPES).default('general'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  cloneFromBusinessId: z.string().cuid().optional(),
})

export const updateBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters').max(100, 'Business name must be under 100 characters').optional(),
  businessType: z.enum(BUSINESS_TYPES).optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email address').nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  pincode: z.string().max(20).nullable().optional(),
})

// Inferred types
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>
export type BusinessType = (typeof BUSINESS_TYPES)[number]
