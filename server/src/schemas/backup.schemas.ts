/**
 * Audit #5 — Zod schemas for the Google Drive backup OAuth callback.
 */

import { z } from 'zod'

/** OAuth callback query: ?code=...&state=... (Google may also send ?error=...). */
export const driveCallbackQuerySchema = z.object({
  code: z.string().min(1).max(2048).optional(),
  state: z.string().min(1).max(512).optional(),
  error: z.string().max(256).optional(),
})

export type DriveCallbackQuery = z.infer<typeof driveCallbackQuerySchema>
