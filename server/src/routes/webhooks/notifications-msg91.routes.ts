/**
 * MSG91 Delivery Webhook — POST /api/webhooks/notifications/msg91
 *
 * Security order (P0-4 — MUST NOT be reordered):
 *   1. express.raw() at route level (NOT app level)
 *   2. HMAC-SHA256 verify on raw Buffer using crypto.timingSafeEqual
 *   3. Timestamp window check (≤ 5 min)
 *   4. Replay check via externalId
 *   5. JSON.parse on verified buffer only
 *   6. Zod validate parsed body
 *   7. Look up NotificationJob by externalId — never trust client for businessId
 *
 * Failure codes: 401 (bad sig, P0-5), 400 (bad body), 409 (replay), 200 (ok)
 */

import { Router } from 'express'
import express from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { createRateLimiter } from '../../middleware/rate-limit/factory.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { markSent, markFailed } from '../../services/notifications/notification-queue.service.js'

const router = Router()

const webhookIpLimiter = createRateLimiter({
  name: 'webhook-notifications-msg91',
  windowMs: 60_000,
  max: 600,
  message: 'Too many requests from this IP',
  eventName: 'webhook.msg91.rate_limited',
})

const MSG91_STATUS_SCHEMA = z.object({
  messageId: z.string().min(1).max(120),
  status: z.enum(['delivered', 'failed', 'sent', 'undelivered']),
  campaignId: z.string().optional(),
  timestamp: z.string().optional(),
  errorCode: z.string().optional(),
})

function verifyMsg91Signature(rawBody: Buffer, sigHeader: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(sigHeader, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '64kb' }),
  webhookIpLimiter,
  asyncHandler(async (req, res) => {
    const ip = req.ip ?? 'unknown'

    // Step 2 — HMAC verify on raw Buffer BEFORE JSON.parse
    const sigHeader = (req.headers['x-msg91-signature'] ?? '') as string
    const secret = process.env.MSG91_WEBHOOK_SECRET

    if (!secret) {
      logger.warn('webhook.msg91.secret_missing', { ip })
      sendError(res, 'Webhook not configured', 'SERVICE_UNAVAILABLE', 503)
      return
    }

    if (!sigHeader) {
      logger.warn('webhook.msg91.sig_missing', { provider: 'msg91', ip, ts: new Date().toISOString() })
      sendError(res, 'Missing signature', 'INVALID_SIGNATURE', 401)
      return
    }

    const rawBody = req.body as Buffer
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      sendError(res, 'Empty body', 'BAD_REQUEST', 400)
      return
    }

    if (!verifyMsg91Signature(rawBody, sigHeader, secret)) {
      // Audit: provider name + IP + timestamp — NO raw body (P0-4)
      logger.warn('webhook.msg91.sig_invalid', {
        provider: 'msg91',
        ip,
        ts: new Date().toISOString(),
      })
      sendError(res, 'Invalid signature', 'INVALID_SIGNATURE', 401)
      return
    }

    // Step 3 — Timestamp window (≤ 5 min) using header if present
    const tsHeader = req.headers['x-msg91-timestamp'] as string | undefined
    if (tsHeader) {
      const eventTs = Number(tsHeader) * 1000
      if (Math.abs(Date.now() - eventTs) > 5 * 60 * 1000) {
        sendError(res, 'Timestamp out of window', 'TIMESTAMP_EXPIRED', 401)
        return
      }
    }

    // Step 5 — JSON.parse only after verification
    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody.toString('utf-8'))
    } catch {
      sendError(res, 'Invalid JSON', 'BAD_REQUEST', 400)
      return
    }

    // Step 6 — Zod validate
    const result = MSG91_STATUS_SCHEMA.safeParse(parsed)
    if (!result.success) {
      sendError(res, 'Invalid payload schema', 'VALIDATION_ERROR', 400)
      return
    }

    const { messageId, status, errorCode } = result.data

    // Step 4 — Replay check: find job by externalId
    const job = await prisma.notificationJob.findFirst({
      where: { externalId: messageId },
      select: { id: true, status: true },
    })

    if (!job) {
      // Unknown job — ack anyway (MSG91 expects 200 or it retries)
      logger.debug('webhook.msg91.unknown_job', { messageId })
      sendSuccess(res, { received: true })
      return
    }

    // Step 4 — Replay: already terminal
    if (job.status === 'DISPATCHED' || job.status === 'DEAD') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_PROCESSED', message: 'Duplicate event' } })
      return
    }

    // Step 7 — Update job
    if (status === 'delivered' || status === 'sent') {
      await markSent(job.id, messageId, 0)
    } else {
      await markFailed(job.id, errorCode ?? 'MSG91_UNDELIVERED', false)
    }

    logger.info('webhook.msg91.processed', { jobId: job.id, messageId, status })
    sendSuccess(res, { received: true })
  }),
)

export default router
