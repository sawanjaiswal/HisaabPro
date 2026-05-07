/**
 * Admin Broadcast Route (PR8)
 * POST /api/admin/notifications/broadcast
 *
 * Auth: SUPER_ADMIN only.
 * Enqueues NotificationJobs for every active user on the target subscription tier.
 * Enforces: Zod strict schema, Idempotency-Key header, 2 broadcasts/admin/24h.
 */

import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { requireAdmin, requireSuperAdmin } from '../../middleware/admin-auth.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import {
  checkBroadcastRateLimit,
  consumeBroadcastRateLimit,
  hashBody,
  checkIdempotency,
  storeIdempotency,
  executeBroadcast,
} from '../../services/admin/broadcast.service.js'

const router = Router()

// ─── Zod schema ───────────────────────────────────────────────────────────────

const broadcastSchema = z
  .object({
    title: z.string().min(1).max(160),
    body: z.string().min(1).max(1000),
    deepLinkUrl: z
      .string()
      .url()
      .max(255)
      .refine((u) => u.startsWith('https://'), { message: 'deepLinkUrl must use https' })
      .refine((u) => !u.startsWith('javascript:') && !u.startsWith('data:'), {
        message: 'deepLinkUrl scheme not allowed',
      })
      .optional(),
    targetTier: z.enum(['free', 'pro', 'business']),
  })
  .strict()

// ─── POST /notifications/broadcast ────────────────────────────────────────────

router.post(
  '/broadcast',
  requireAdmin,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    // 1. Parse + validate body
    const parsed = broadcastSchema.safeParse(req.body)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Invalid input', 'VALIDATION_ERROR', 400)
      return
    }
    const data = parsed.data

    // 2. Idempotency-Key header required
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      sendError(
        res,
        'Idempotency-Key header required (16–128 chars)',
        'IDEMPOTENCY_KEY_REQUIRED',
        400,
      )
      return
    }

    const adminId = req.admin!.adminId
    const bodyHash = hashBody(req.body as Record<string, unknown>)

    // 3. Idempotency check
    const idem = checkIdempotency(adminId, idempotencyKey, bodyHash)
    if (idem.status === 'replay') {
      sendSuccess(res, idem.response)
      return
    }
    if (idem.status === 'conflict') {
      sendError(
        res,
        'Idempotency-Key already used with a different request body',
        'IDEMPOTENCY_CONFLICT',
        409,
      )
      return
    }

    // 4. Rate limit: max 2 broadcasts per super-admin per 24h
    const { allowed } = checkBroadcastRateLimit(adminId)
    if (!allowed) {
      sendError(
        res,
        'Broadcast rate limit exceeded: max 2 per 24 hours',
        'BROADCAST_RATE_LIMIT',
        429,
      )
      return
    }

    // 5. Execute broadcast
    const result = await executeBroadcast({
      adminId,
      title: data.title,
      body: data.body,
      deepLinkUrl: data.deepLinkUrl,
      targetTier: data.targetTier,
      idempotencyKey,
    })

    // 6. Consume rate limit slot and store idempotency cache
    consumeBroadcastRateLimit(adminId)
    storeIdempotency(adminId, idempotencyKey, bodyHash, result)

    sendSuccess(res, result)
  }),
)

export default router
