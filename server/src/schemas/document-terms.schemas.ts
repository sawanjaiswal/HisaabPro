/**
 * Terms & Conditions Template schemas — extracted from
 * document.schemas.ts to keep that file ≤250L. Used by the document
 * settings module to seed default T&C blocks per document type.
 */

import { z } from 'zod'
import { DOCUMENT_TYPES } from '../../../shared/enums.js'

export const createTermsTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(5000),
  isDefault: z.boolean().default(false),
  appliesTo: z.array(z.enum(DOCUMENT_TYPES)).default([]),
})

export const updateTermsTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).max(5000).optional(),
  isDefault: z.boolean().optional(),
  appliesTo: z.array(z.enum(DOCUMENT_TYPES)).optional(),
})

export type CreateTermsTemplateInput = z.infer<typeof createTermsTemplateSchema>
export type UpdateTermsTemplateInput = z.infer<typeof updateTermsTemplateSchema>
