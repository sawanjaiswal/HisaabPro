/**
 * Marketing Template — Zod validators (PR2)
 * Strict shapes per SECURITY_AUDIT §1.2
 */

import { z } from 'zod'

const DLT_TEMPLATE_ID_RE = /^[A-Z0-9]{1,60}$/
const WA_TEMPLATE_NAME_RE = /^[a-z0-9_]{1,80}$/
const CHANNEL = z.enum(['WHATSAPP', 'SMS'])

export const createMarketingTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  channel: CHANNEL,
  bodyEn: z.string().min(1).max(1000),
  bodyHi: z.string().max(1000).optional(),
  dltTemplateId: z.string().regex(DLT_TEMPLATE_ID_RE).optional(),
  waTemplateName: z.string().regex(WA_TEMPLATE_NAME_RE).optional(),
  variables: z.array(z.string().max(60)).max(30).optional().default([]),
}).strict()

export const updateMarketingTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bodyEn: z.string().min(1).max(1000).optional(),
  bodyHi: z.string().max(1000).nullable().optional(),
  dltTemplateId: z.string().regex(DLT_TEMPLATE_ID_RE).nullable().optional(),
  dltRegistered: z.boolean().optional(),
  waTemplateName: z.string().regex(WA_TEMPLATE_NAME_RE).nullable().optional(),
  waTemplateStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  variables: z.array(z.string().max(60)).max(30).optional(),
  isActive: z.boolean().optional(),
}).strict()

export type CreateMarketingTemplateInput = z.infer<typeof createMarketingTemplateSchema>
export type UpdateMarketingTemplateInput = z.infer<typeof updateMarketingTemplateSchema>
