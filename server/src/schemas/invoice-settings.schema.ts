/**
 * Invoice Settings — Zod validation for the singleton PUT body (wire shape).
 *
 * Round-off is exchanged as wire strings ('1' | '0.50' | '0.10' | 'none' and
 * 'round' | 'floor' | 'ceil'); the service maps these to DB enums (R4).
 * `decimalPrecision.amount` is fixed at 2 — accepted for completeness but the
 * server always echoes 2 regardless of the submitted value.
 */

import { z } from 'zod'

const decimalPlaces = z
  .number()
  .int('must be a whole number')
  .min(0, 'must be 0..3')
  .max(3, 'must be 0..3')

export const updateInvoiceSettingsSchema = z
  .object({
    roundOff: z
      .object({
        enabled: z.boolean(),
        precision: z.enum(['1', '0.50', '0.10', 'none']),
        showOnInvoice: z.boolean(),
        method: z.enum(['round', 'floor', 'ceil']),
      })
      .strict(),
    decimalPrecision: z
      .object({
        quantity: decimalPlaces,
        rate: decimalPlaces,
        // amount is fixed at 2; accept any number so a full round-tripped body
        // (which includes amount:2) validates, but the service ignores it.
        amount: z.number().optional(),
      })
      .strict(),
  })
  .strict()

export type UpdateInvoiceSettingsInput = z.infer<typeof updateInvoiceSettingsSchema>
