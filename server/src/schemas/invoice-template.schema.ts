/**
 * Invoice Template — Zod validation (create / update / set-default).
 *
 * - `baseTemplate` validated against BASE_TEMPLATE_ALLOWLIST (R1).
 * - `config` / `printSettings` are opaque objects, guarded ONLY for serialized
 *   size (≤10KB) — never per-key validated (R3).
 * - Top level `.strict()` so unknown top-level keys are rejected; the JSON
 *   blobs themselves passthrough freely.
 */

import { z } from 'zod'
import { DOCUMENT_TYPES } from '../../../shared/enums.js'
import {
  BASE_TEMPLATE_ALLOWLIST,
  MAX_CONFIG_BYTES,
} from '../services/invoice-template/template.constants.js'

/** Opaque JSON object, size-capped by serialized byte length. */
const jsonBlob = (label: string) =>
  z
    .record(z.unknown())
    .refine(
      (obj) => Buffer.byteLength(JSON.stringify(obj), 'utf8') <= MAX_CONFIG_BYTES,
      { message: `${label} exceeds the ${MAX_CONFIG_BYTES / 1024}KB limit` },
    )

const nameSchema = z
  .string()
  .trim()
  .min(1, 'name is required')
  .max(100, 'name must be at most 100 characters')

const baseTemplateSchema = z.enum(BASE_TEMPLATE_ALLOWLIST, {
  errorMap: () => ({ message: 'unknown baseTemplate' }),
})

/** POST /api/templates — full create body. */
export const createTemplateSchema = z
  .object({
    name: nameSchema,
    baseTemplate: baseTemplateSchema,
    config: jsonBlob('config'),
    printSettings: jsonBlob('printSettings'),
  })
  .strict()

/** PUT /api/templates/:id — partial merge; every field optional. */
export const updateTemplateSchema = z
  .object({
    name: nameSchema.optional(),
    baseTemplate: baseTemplateSchema.optional(),
    config: jsonBlob('config').optional(),
    printSettings: jsonBlob('printSettings').optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'at least one field is required',
  })

/** POST /api/templates/:id/set-default — [] clears this template's defaults. */
export const setDefaultSchema = z
  .object({
    documentTypes: z
      .array(z.enum(DOCUMENT_TYPES, { errorMap: () => ({ message: 'unknown documentType' }) }))
      .max(DOCUMENT_TYPES.length, 'too many documentTypes'),
  })
  .strict()

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>
export type SetDefaultInput = z.infer<typeof setDefaultSchema>
