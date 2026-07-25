/**
 * MSG91 Marketing Webhook — POST /api/webhooks/marketing/msg91 (PR6)
 *
 * Security order (P0-5):
 *   P0: express.raw() at route level
 *   P1: rate limit 600/min/IP
 *   P2: static token timingSafeEqual, try/catch length mismatch
 *   P3: 5-minute replay window
 *   P4: dedupe by externalId
 *   P5: JSON.parse after all checks
 *
 * Response: { success: true } only. Never echo payload.
 */

import { Router } from 'express'
import express from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { createRateLimiter } from '../../middleware/rate-limit/factory.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { verifyMsg91Token } from '../../services/marketing/msg91-marketing-signature.js'
import { applyWebhookEvent } from '../../services/marketing/campaign-counter.service.js'
import { getMsg91MarketingWebhookToken } from '../../lib/env.js'

const router = Router()

const ipLimiter = createRateLimiter({
  name: 'webhook-marketing-msg91',
  windowMs: 60_000,
  max: 600,
  message: 'Too many requests',
  eventName: 'webhook.marketing.msg91.rate_limited',
})

const REPLAY_WINDOW_MS = 5 * 60 * 1000

const payloadSchema = z.object({
  messageId: z.string().min(1).max(120),
  status: z.enum(['DELIVERED', 'READ', 'FAILED', 'SENT', 'delivered', 'failed', 'sent']),
  occurredAt: z.string().optional(),
  timestamp: z.string().optional(),
  failureReason: z.string().optional(),
})

function normaliseStatus(s: string): 'DELIVERED' | 'READ' | 'FAILED' | 'SENT' {
  const u = s.toUpperCase()
  if (u === 'DELIVERED') return 'DELIVERED'
  if (u === 'READ') return 'READ'
  if (u === 'FAILED') return 'FAILED'
  return 'SENT'
}

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '256kb' }),
  ipLimiter,
  asyncHandler(async (req, res) => {
    const ip = req.ip ?? 'unknown'
    const start = Date.now()

    // P2 — static token compare
    const expectedToken = getMsg91MarketingWebhookToken()
    if (!expectedToken) {
      sendError(res, 'Webhook not configured', 'SERVICE_UNAVAILABLE', 503)
      return
    }

    const authHeader = (req.headers['authorization'] ?? '') as string
    // MSG91 sends token directly or with 'Bearer ' prefix — normalise
    const incomingToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const rawBody = req.body as Buffer

    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      sendError(res, 'Invalid signature', 'WEBHOOK_BAD_SIGNATURE', 401)
      return
    }

    if (!incomingToken || !verifyMsg91Token(incomingToken, expectedToken)) {
      logger.warn('webhook.marketing.msg91.sig_invalid', { provider: 'msg91', ip, ts: new Date().toISOString() })
      sendError(res, 'Invalid signature', 'WEBHOOK_BAD_SIGNATURE', 401)
      return
    }

    // P5 — parse after verification
    let parsed: unknown
    try {
      parsed = JSON.parse(rawBody.toString('utf-8'))
    } catch {
      sendError(res, 'Invalid signature', 'WEBHOOK_BAD_SIGNATURE', 401)
      return
    }

    const validated = payloadSchema.safeParse(parsed)
    if (!validated.success) {
      sendError(res, 'Invalid signature', 'WEBHOOK_BAD_SIGNATURE', 401)
      return
    }

    const { messageId, status: rawStatus, occurredAt, timestamp } = validated.data
    const status = normaliseStatus(rawStatus)

    // P3 — 5-minute replay window
    const tsStr = occurredAt ?? timestamp
    if (tsStr) {
      const eventTs = new Date(tsStr).getTime()
      if (!isNaN(eventTs) && Math.abs(Date.now() - eventTs) > REPLAY_WINDOW_MS) {
        logger.warn('webhook.marketing.msg91.stale', { messageId, ip })
        sendError(res, 'Invalid signature', 'WEBHOOK_BAD_SIGNATURE', 401)
        return
      }
    }

    // P4 — dedupe by externalId
    const job = await prisma.notificationJob.findFirst({
      where: { externalId: messageId },
      select: { id: true, status: true },
    })

    if (!job) {
      sendSuccess(res, { received: true })
      return
    }

    const recipient = await prisma.marketingCampaignRecipient.findFirst({
      where: { jobId: job.id },
      select: { id: true },
    })
    if (recipient) {
      await applyWebhookEvent(recipient.id, status)
    }

    logger.info('webhook.marketing.msg91.processed', {
      provider: 'msg91',
      messageId,
      verified: true,
      latencyMs: Date.now() - start,
    })

    sendSuccess(res, {})
  }),
)

export default router
