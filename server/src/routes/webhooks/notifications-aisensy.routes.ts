/**
 * Aisensy (WhatsApp) Delivery Webhook — POST /api/webhooks/notifications/aisensy
 *
 * STUB: WhatsApp webhook channel deferred to a future sprint.
 * Returns 501 NOT_IMPLEMENTED until Aisensy HMAC scheme and payload
 * contract are finalised in the architecture document.
 *
 * TODO (future PR): implement following the same P0-4 order as MSG91:
 *   1. express.raw() route-level
 *   2. HMAC verify on raw Buffer BEFORE JSON.parse
 *   3. Timestamp window check
 *   4. Replay guard
 *   5. JSON.parse + Zod validate
 *   6. markSent / markFailed
 */

import { Router } from 'express'
import express from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { sendError } from '../../lib/response.js'

const router = Router()

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '64kb' }),
  asyncHandler(async (_req, res) => {
    sendError(
      res,
      'WhatsApp webhook deferred',
      'NOT_IMPLEMENTED',
      501,
    )
  }),
)

export default router
