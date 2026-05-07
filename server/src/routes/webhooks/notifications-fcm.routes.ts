/**
 * FCM Delivery Webhook — POST /api/webhooks/notifications/fcm
 *
 * TODO (P1-8): FCM direct send is fire-and-forget; it does not provide a
 * real-time delivery webhook endpoint to third-party servers. Upstream
 * delivery reporting can only come from the mobile client calling back
 * to our own API (e.g. POST /api/notifications/ack).
 *
 * This stub returns 501 until a server-side reporting integration is
 * scoped and the architecture document is updated with the exact flow.
 * Do NOT remove this route — it prevents accidental 404s from any
 * partner that may attempt to POST to this path.
 *
 * When implementing (requires architect agent sign-off per HIGH_RISK_PATHS):
 *   1. express.raw() at route level (NOT app level)
 *   2. Verify Google JWT (Authorization: Bearer) against Google public certs
 *      — use https://www.googleapis.com/oauth2/v3/certs, cache with max-age
 *      — fail closed: if cert fetch fails → 503 (not 200)
 *   3. Verify iss === 'https://accounts.google.com' and aud === your project_id
 *   4. Then JSON.parse, Zod validate, update job
 */

import { Router } from 'express'
import express from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { sendError } from '../../lib/response.js'

const router = Router()

router.post(
  '/',
  // Keep raw parser here even for the stub so the correct Content-Type
  // is consumed and the global JSON parser does not interfere.
  express.raw({ type: 'application/json', limit: '64kb' }),
  asyncHandler(async (_req, res) => {
    sendError(
      res,
      'FCM delivery webhooks are not yet implemented. Client-side ACK is used instead.',
      'NOT_IMPLEMENTED',
      501,
    )
  }),
)

export default router
