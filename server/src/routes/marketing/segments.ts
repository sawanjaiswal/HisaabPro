/**
 * Marketing Segments + Opt-out Router (PR3)
 * Mounted at /api/marketing via marketing.ts
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { auth } from '../../middleware/auth.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { segmentFilterSchema } from '../../services/marketing/campaign-segment.types.js'
import { previewSegment } from '../../services/marketing/campaign-segment.service.js'
import { optOutParty, optInParty } from '../../services/marketing/marketing-optout.service.js'
import { createRateLimiter } from '../../middleware/rate-limit/factory.js'
import { z } from 'zod'

const router = Router()
router.use(auth)

const previewLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  message: 'Too many segment preview requests',
  keyFn: (req) => `rl:seg:${req.user?.businessId ?? req.ip}`,
  eventName: 'marketing.segments.rate_limited',
})

const optOutLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many opt-out requests',
  keyFn: (req) => `rl:optout:${req.user?.userId ?? req.ip}`,
  eventName: 'marketing.optout.rate_limited',
})

const previewSchema = z.object({ filter: segmentFilterSchema }).strict()

// POST /api/marketing/segments/preview
router.post(
  '/segments/preview',
  previewLimiter,
  asyncHandler(async (req, res) => {
    const parsed = previewSchema.safeParse(req.body)
    if (!parsed.success) {
      return sendError(res, parsed.error.issues.map((i) => i.message).join(', '), 'VALIDATION_ERROR', 400)
    }
    const result = await previewSegment(req.user!.businessId, parsed.data.filter)
    sendSuccess(res, result)
  }),
)

// POST /api/marketing/opt-out/:partyId
router.post(
  '/opt-out/:partyId',
  optOutLimiter,
  asyncHandler(async (req, res) => {
    const party = await optOutParty(String(req.params['partyId']), req.user!.businessId, req.user!.userId)
    if (!party) return sendError(res, 'Party not found', 'NOT_FOUND', 404)
    sendSuccess(res, { partyId: req.params.partyId, marketingOptOut: true })
  }),
)

// DELETE /api/marketing/opt-out/:partyId (opt back in)
router.delete(
  '/opt-out/:partyId',
  optOutLimiter,
  asyncHandler(async (req, res) => {
    const party = await optInParty(String(req.params['partyId']), req.user!.businessId, req.user!.userId)
    if (!party) return sendError(res, 'Party not found', 'NOT_FOUND', 404)
    sendSuccess(res, { partyId: req.params.partyId, marketingOptOut: false })
  }),
)

export default router
