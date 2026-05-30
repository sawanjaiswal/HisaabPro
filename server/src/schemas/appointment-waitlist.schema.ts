/**
 * V2 Appointments — waitlist request schemas.
 *
 * FE wire shape (src/features/appointments/appointment.types.ts) uses
 * `desiredStartAt` / `desiredEndAt`. The DB only persists `preferredDate`
 * (single timestamp) — we store `desiredStartAt` there and surface both back
 * by deriving `desiredEndAt = preferredDate + (FE end - FE start)`. Until the
 * model is extended in a follow-up schema-tier plan, the response echoes the
 * requested end-time from short-lived cache OR re-derives a 60-minute slot.
 */

import { z } from 'zod'

const ISO_DATETIME = z.string().datetime({ offset: true })

export const addWaitlistSchema = z
  .object({
    partyId: z.string().min(1),
    employeeId: z.string().min(1).nullable().optional(),
    desiredStartAt: ISO_DATETIME,
    desiredEndAt: ISO_DATETIME,
    serviceId: z.string().min(1).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (new Date(val.desiredEndAt).getTime() <= new Date(val.desiredStartAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['desiredEndAt'],
        message: 'desiredEndAt must be > desiredStartAt',
      })
    }
  })

export const listWaitlistQuerySchema = z
  .object({
    employeeId: z.string().min(1).optional(),
    from: ISO_DATETIME.optional(),
    to: ISO_DATETIME.optional(),
  })
  .strict()

export type AddWaitlistBody = z.infer<typeof addWaitlistSchema>
export type ListWaitlistQuery = z.infer<typeof listWaitlistQuerySchema>
