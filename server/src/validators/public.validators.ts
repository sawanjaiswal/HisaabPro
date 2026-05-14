/**
 * Zod validators for the public /api/p surface.
 *
 * PR1.2 — no body inputs on the shipped endpoints (health is GET, no body).
 * Stubs here for PR3+ handlers to extend.
 */

import { z } from 'zod'

/**
 * Token path param — base64url, 16–128 chars.
 * Used when a route handler wants to validate the :token param via Zod
 * in addition to the resolvePublicToken middleware check.
 */
export const publicTokenParamSchema = z.object({
  token: z
    .string()
    .min(16, 'Token too short')
    .max(128, 'Token too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Token must be base64url'),
})

/**
 * Stub for POST /api/p/invite/:token/claim — filled in PR5.
 */
export const claimInviteBodySchema = z
  .object({
    otpSessionId: z.string().min(1),
  })
  .strict()
