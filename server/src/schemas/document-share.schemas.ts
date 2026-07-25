/**
 * Document Share Zod Schemas — WhatsApp / Email share endpoints.
 *
 * Split out of document.schemas.ts to keep each schema file within the
 * 250-line discipline; re-exported from document.schemas.ts so existing
 * `import { shareWhatsAppSchema } from './document.schemas.js'` keeps working.
 */

import { z } from 'zod'

export const shareWhatsAppSchema = z.object({
  format: z.enum(['IMAGE', 'PDF']),
  recipientPhone: z.string().min(10).max(15),
  message: z.string().max(1000).optional(),
})

export const shareEmailSchema = z.object({
  recipientEmail: z.string().email(),
  subject: z.string().max(200),
  body: z.string().max(5000).optional(),
  format: z.enum(['PDF']).default('PDF'),
  // Client-rendered invoice PDF (base64) — server has no renderer (#32); capped under the 2 MB json limit.
  pdfBase64: z.string().max(1_500_000).optional(),
})

export type ShareWhatsAppInput = z.infer<typeof shareWhatsAppSchema>
export type ShareEmailInput = z.infer<typeof shareEmailSchema>
