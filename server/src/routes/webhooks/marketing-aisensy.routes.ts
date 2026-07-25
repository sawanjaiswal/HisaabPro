/**
 * Aisensy Marketing Webhook — POST /api/webhooks/marketing/aisensy (PR6)
 *
 * Security order (P0-5):
 *   P0: express.raw() at route level
 *   P1: rate limit 600/min/IP
 *   P2: HMAC-SHA256 on raw Buffer, timingSafeEqual, try/catch length mismatch
 *   P3: 5-minute replay window on occurredAt
 *   P4: dedupe by externalId on NotificationJob
 *   P5: JSON.parse only after all checks pass
 *
 * Response: { success: true } only. Never echo payload.
 * CORS: off (no credentials, no origin match needed for provider callbacks)
 */

import { Router } from 'express'
import express from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { createRateLimiter } from '../../middleware/rate-limit/factory.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { verifyAisensySignature } from '../../services/marketing/aisensy-signature.js'
import { applyWebhookEvent } from '../../services/marketing/campaign-counter.service.js'
import { getAisensyWebhookSecret } from '../../lib/env.js'

const router = Router()

const ipLimiter = createRateLimiter({
  name: 'webhook-marketing-aisensy',
  windowMs: 60_000,
  max: 600,
  message: 'Too many requests',
  eventName: 'webhook.marketing.aisensy.rate_limited',
})

const REPLAY_WINDOW_MS = 5 * 60 * 1000

const payloadSchema = z.object({
  messageId: z.string().min(1).max(120),
  status: z.enum(['DELIVERED', 'READ', 'FAILED', 'SENT']),
  occurredAt: z.string().optional(),
  failureReason: z.string().optional(),
})

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '256kb' }),
  ipLimiter,
  asyncHandler(async (req, res) => {
    const ip = req.ip ?? 'unknown'
    const start = Date.now()

    // P2 — HMAC verify
    const secret = getAisensyWebhookSecret()
    if (!secret) {
      sendError(res, 'Webhook not configured', 'SERVICE_UNAVAILABLE', 503)
      return
    }

    const sigHeader = (req.headers['x-aisensy-signature'] ?? '') as string
    const rawBody = req.body as Buffer

    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      sendError(res, 'Invalid signature', 'WEBHOOK_BAD_SIGNATURE', 401)
      return
    }

    if (!sigHeader || !verifyAisensySignature(rawBody, sigHeader, secret)) {
      logger.warn('webhook.marketing.aisensy.sig_invalid', { provider: 'aisensy', ip, ts: new Date().toISOString() })
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

    const { messageId, status, occurredAt } = validated.data

    // P3 — 5-minute replay window
    if (occurredAt) {
      const eventTs = new Date(occurredAt).getTime()
      if (isNaN(eventTs) || Math.abs(Date.now() - eventTs) > REPLAY_WINDOW_MS) {
        logger.warn('webhook.marketing.aisensy.stale', { messageId, ip })
        sendError(res, 'Invalid signature', 'WEBHOOK_BAD_SIGNATURE', 401)
        return
      }
    }

    // P4 — dedupe by externalId (look up NotificationJob then linked recipient)
    const job = await prisma.notificationJob.findFirst({
      where: { externalId: messageId },
      select: { id: true, status: true },
    })

    if (!job) {
      // Unknown — ack to stop retries
      sendSuccess(res, { received: true })
      return
    }

    // Apply delivery event via campaign recipient linked by jobId
    const recipient = await prisma.marketingCampaignRecipient.findFirst({
      where: { jobId: job.id },
      select: { id: true },
    })
    if (recipient) {
      await applyWebhookEvent(recipient.id, status)
    }

    logger.info('webhook.marketing.aisensy.processed', {
      provider: 'aisensy',
      messageId,
      verified: true,
      latencyMs: Date.now() - start,
    })

    sendSuccess(res, {})
  }),
)

export default router
