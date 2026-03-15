import { z } from 'zod'

/** Indian phone: 10 digits starting with 6-9 */
export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian phone number')

/** Email */
export const emailSchema = z
  .string()
  .email('Enter a valid email address')

/** Amount in paise: positive integer */
export const paiseSchema = z
  .number()
  .int('Amount must be a whole number (paise)')
  .nonnegative('Amount cannot be negative')

/** Non-empty trimmed string */
export const requiredString = z
  .string()
  .trim()
  .min(1, 'This field is required')

/** PIN: 4-6 digits */
export const pinSchema = z
  .string()
  .regex(/^\d{4,6}$/, 'PIN must be 4-6 digits')

/** Cursor-based pagination params */
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(20),
})

export type PaginationParams = z.infer<typeof paginationSchema>
