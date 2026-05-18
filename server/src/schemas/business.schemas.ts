import { z } from 'zod'

const BUSINESS_TYPES = [
  'general', 'retail', 'wholesale', 'manufacturing', 'services',
  'restaurant', 'pharmacy', 'bakery', 'salon', 'clinic',
  'tailor', 'freelancer', 'other',
] as const

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
  // Inventory settings (BAT-07)
  expiryAlertDays: z.number().int().min(1).max(365).optional(),
  expiredBatchPolicy: z.enum(['WARN_ONLY', 'HARD_BLOCK']).optional(),
  // Epic C PR2 — #129 UPI QR: VPA field (nullable to allow clearing)
  upiVpa: z
    .string()
    .max(320)
    .regex(
      /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z]{1,64}$/,
      'UPI ID format: name@bank'
    )
    .nullable()
    .optional(),
}).strict()

// Phase 6 #138 — firm suspend/reactivate (PR2). `reason` is required on suspend
// (lands in AuditLog.reason for the trail) and absent on reactivate.
export const suspendBusinessSchema = z.object({
  reason: z.string().trim().min(1, 'Reason is required').max(500, 'Reason must be under 500 characters'),
}).strict()

export const reactivateBusinessSchema = z.object({}).strict()

// Inferred types
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>
export type SuspendBusinessInput = z.infer<typeof suspendBusinessSchema>
export type BusinessType = (typeof BUSINESS_TYPES)[number]
