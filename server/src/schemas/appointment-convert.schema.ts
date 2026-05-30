/**
 * V2 Appointments — convert-to-bill request schema.
 *
 * Body shape negotiated with FE (src/features/appointments/appointment.types.ts):
 *   - target: 'job' | 'invoice'
 *   - notes?: optional carry-over to the new Job/Document
 *   - items?: optional line items. When omitted, a single placeholder line is
 *     created from the appointment metadata (party + start time). Callers may
 *     supply items to pre-populate from the appointment's services.
 *
 * For target='invoice', each item MUST carry productId because
 * DocumentLineItem.productId is non-nullable in the current schema.
 * Schema change to relax that would require a new high-risk design plan.
 */

import { z } from 'zod'

const itemBaseSchema = z
  .object({
    description: z.string().min(1).max(500),
    quantity: z.coerce.number().positive().max(99_999),
    /** Per-unit price in paise (integer). */
    unitPricePaise: z.number().int().nonnegative().max(1_000_000_000),
    /** Optional product link — required for invoice target, optional for job. */
    productId: z.string().min(1).nullable().optional(),
  })
  .strict()

export const convertAppointmentSchema = z
  .object({
    target: z.enum(['job', 'invoice']),
    notes: z.string().max(2000).nullable().optional(),
    items: z.array(itemBaseSchema).max(200).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.target === 'invoice' && val.items) {
      val.items.forEach((it, i) => {
        if (!it.productId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', i, 'productId'],
            message: 'productId is required for invoice line items',
          })
        }
      })
    }
  })

export type ConvertAppointmentBody = z.infer<typeof convertAppointmentSchema>
export type ConvertItem = z.infer<typeof itemBaseSchema>
