/**
 * Public-booking endpoint Zod schemas. Strict — unknown keys rejected.
 *
 * The token is the HMAC-signed link; signature payload is parsed/verified in
 * `public-booking-signature.ts`. We only validate the wire shape here.
 */

import { z } from 'zod'

const ISO_DATETIME = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s))

export const publicBookingCreateSchema = z
  .object({
    token: z.string().min(16).max(2048),
    partyName: z.string().min(1).max(200),
    partyPhone: z.string().min(7).max(15),
    startAt: ISO_DATETIME,
    durationMinutes: z.number().int().min(5).max(8 * 60),
    notes: z.string().max(2000).optional(),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict()

export const publicBookingAvailabilitySchema = z
  .object({
    token: z.string().min(16).max(2048),
    date: ISO_DATETIME,
    durationMinutes: z.coerce.number().int().min(5).max(8 * 60),
    stepMinutes: z.coerce.number().int().min(5).max(120).optional(),
  })
  .strict()

export type PublicBookingCreateBody = z.infer<typeof publicBookingCreateSchema>
export type PublicBookingAvailabilityQuery = z.infer<typeof publicBookingAvailabilitySchema>
