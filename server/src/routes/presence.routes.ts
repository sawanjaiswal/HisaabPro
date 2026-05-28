/**
 * #150 Presence routes — ephemeral "who's here" for multi-user businesses.
 *   POST   /api/presence/heartbeat        — register/refresh my focus, get peers
 *   DELETE /api/presence                  — drop my presence (tab close / navigate away)
 *   GET    /api/presence/:entityType/:entityId — peers currently on an entity
 *
 * All routes require auth. businessId + userId come from the token, never the body.
 * Oracle-free: foreign/unknown ids return an identical empty-peers 200.
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createRateLimiter } from '../middleware/rate-limit.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendSuccess } from '../lib/response.js'
import { heartbeatSchema, presenceEntityTypeSchema } from '../schemas/presence.schemas.js'
import * as presence from '../services/presence/presence.service.js'

const router = Router()

// Heartbeat fires ~every 20s per open entity; cap at 60/min to absorb tab churn
// and retries while still bounding abuse (sec S2).
const heartbeatLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  message: 'Too many presence heartbeats. Slow down.',
  // Per-user, not per-IP — co-located teammates (one office NAT) must not collide.
  keyFn: (req) => `presence:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  eventName: 'presence.rate_limited',
})

router.post(
  '/heartbeat',
  auth,
  heartbeatLimiter,
  validate(heartbeatSchema),
  asyncHandler(async (req, res) => {
    const { entityType, entityId, mode } = req.body
    const peers = await presence.heartbeat(req.user!.businessId, req.user!.userId, entityType, entityId, mode)
    sendSuccess(res, { peers })
  }),
)

router.delete(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    await presence.leave(req.user!.businessId, req.user!.userId)
    sendSuccess(res, { ok: true })
  }),
)

router.get(
  '/:entityType/:entityId',
  auth,
  asyncHandler(async (req, res) => {
    const parsed = presenceEntityTypeSchema.safeParse(req.params.entityType)
    // Unknown entityType -> uniform empty peers (no oracle, no 400 leak).
    if (!parsed.success) {
      sendSuccess(res, { peers: [] })
      return
    }
    const peers = presence.getPeers(
      req.user!.businessId,
      parsed.data,
      String(req.params.entityId),
      req.user!.userId,
    )
    sendSuccess(res, { peers })
  }),
)

export default router
