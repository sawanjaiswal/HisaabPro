/**
 * V2 Appointments — Zod schemas.
 *
 * All `.strict()` so unknown keys fail closed. Times accept ISO-8601 strings
 * and coerce to Date. Money fields are not present on appointments themselves
 * (lives on Job/Invoice post-conversion).
 */

import { z } from 'zod'
import { MAX_RECURRENCE_OCCURRENCES, MAX_RECURRENCE_END_DAYS } from '../constants/appointment.constants.js'

const APPT_STATUS = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
])

const RECURRENCE_FREQ = z.enum(['DAILY', 'WEEKLY', 'MONTHLY'])

const ISO_DATETIME = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s))

const recurrenceSchema = z
  .object({
    frequency: RECURRENCE_FREQ,
    endAt: ISO_DATETIME,
    occurrences: z.number().int().min(1).max(MAX_RECURRENCE_OCCURRENCES),
  })
  .strict()

export const createAppointmentSchema = z
  .object({
    partyId: z.string().min(1),
    employeeId: z.string().min(1).nullable(),
    startAt: ISO_DATETIME,
    endAt: ISO_DATETIME,
    serviceId: z.string().min(1).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
    recurrence: recurrenceSchema.nullable().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.endAt.getTime() <= val.startAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endAt'],
        message: 'endAt must be > startAt',
      })
    }
    if (val.recurrence) {
      const horizonMs = MAX_RECURRENCE_END_DAYS * 24 * 60 * 60 * 1000
      if (val.recurrence.endAt.getTime() - val.startAt.getTime() > horizonMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recurrence', 'endAt'],
          message: `recurrence.endAt may not exceed ${MAX_RECURRENCE_END_DAYS} days from startAt`,
        })
      }
    }
  })

export const updateAppointmentSchema = z
  .object({
    startAt: ISO_DATETIME.optional(),
    endAt: ISO_DATETIME.optional(),
    employeeId: z.string().min(1).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    serviceId: z.string().min(1).nullable().optional(),
  })
  .strict()

export const patchStatusSchema = z
  .object({
    toStatus: APPT_STATUS,
    reason: z.string().max(500).nullable().optional(),
  })
  .strict()

export const availabilityQuerySchema = z
  .object({
    employeeId: z.string().min(1),
    date: ISO_DATETIME,
    serviceDurationMinutes: z.coerce.number().int().min(5).max(8 * 60),
    stepMinutes: z.coerce.number().int().min(5).max(120).optional(),
  })
  .strict()

export const convertToJobSchema = z
  .object({
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict()

export const convertToInvoiceSchema = convertToJobSchema

export type CreateAppointmentBody = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentBody = z.infer<typeof updateAppointmentSchema>
export type PatchStatusBody = z.infer<typeof patchStatusSchema>
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>
