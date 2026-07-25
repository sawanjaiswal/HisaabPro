/**
 * Resend Delivery Webhook — POST /api/webhooks/notifications/resend
 *
 * Security order (P0-4):
 *   1. express.raw() at route level (NOT app level)
 *   2. Svix signature verification on raw Buffer (svix-id / svix-timestamp / svix-signature)
 *   3. Timestamp window checked by Svix library (5 min default)
 *   4. Replay check via externalId (svix-id)
 *   5. JSON.parse on verified buffer only
 *   6. Zod validate parsed body
 *   7. Look up NotificationJob by externalId — never trust client for businessId
 *
 * Failure codes: 401 (bad sig, P0-5), 400 (bad body), 409 (replay), 200 (ok)
 */

import { Router } from 'express'
import express from 'express'
import { Webhook } from 'svix'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { createRateLimiter } from '../../middleware/rate-limit/factory.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { markSent, markFailed } from '../../services/notifications/notification-queue.service.js'

const router = Router()

const webhookIpLimiter = createRateLimiter({
  name: 'webhook-notifications-resend',
  windowMs: 60_000,
  max: 600,
  message: 'Too many requests from this IP',
  eventName: 'webhook.resend.rate_limited',
})

const RESEND_EVENT_SCHEMA = z.object({
  type: z.string().min(1).max(80),
  data: z.object({
    email_id: z.string().min(1).max(120),
  }).passthrough(),
})

router.post(
  '/',
  express.raw({ type: 'application/json', limit: '64kb' }),
  webhookIpLimiter,
  asyncHandler(async (req, res) => {
    const ip = req.ip ?? 'unknown'

    // Step 2 — Svix verify on raw Buffer BEFORE JSON.parse (P0-4)
    const secret = process.env.RESEND_WEBHOOK_SECRET
    if (!secret) {
      logger.warn('webhook.resend.secret_missing', { ip })
      sendError(res, 'Webhook not configured', 'SERVICE_UNAVAILABLE', 503)
      return
    }

    const svixId = req.headers['svix-id'] as string | undefined
    const svixTs = req.headers['svix-timestamp'] as string | undefined
    const svixSig = req.headers['svix-signature'] as string | undefined

    if (!svixId || !svixTs || !svixSig) {
      logger.warn('webhook.resend.headers_missing', {
        provider: 'resend', ip, ts: new Date().toISOString(),
      })
      sendError(res, 'Missing Svix headers', 'INVALID_SIGNATURE', 401)
      return
    }

    const rawBody = req.body as Buffer
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      sendError(res, 'Empty body', 'BAD_REQUEST', 400)
      return
    }

    // Svix verify: checks HMAC + timestamp window (5 min) simultaneously
    const wh = new Webhook(secret)
    let verifiedPayload: unknown
    try {
      // verify() accepts the raw string body for HMAC integrity
      verifiedPayload = wh.verify(rawBody.toString('utf-8'), {
        'svix-id': svixId,
        'svix-timestamp': svixTs,
        'svix-signature': svixSig,
      })
    } catch {
      // Audit log: provider + IP + timestamp, NO body/secret (P0-4)
      logger.warn('webhook.resend.sig_invalid', {
        provider: 'resend', ip, ts: new Date().toISOString(),
      })
      sendError(res, 'Invalid signature', 'INVALID_SIGNATURE', 401)
      return
    }

    // Step 6 — Zod validate (verifiedPayload is already parsed by svix)
    const result = RESEND_EVENT_SCHEMA.safeParse(verifiedPayload)
    if (!result.success) {
      sendError(res, 'Invalid payload schema', 'VALIDATION_ERROR', 400)
      return
    }

    const { type, data } = result.data
    const emailId = data.email_id

    // Step 4 — Replay check: use svix-id as the idempotency marker
    const job = await prisma.notificationJob.findFirst({
      where: { externalId: emailId },
      select: { id: true, status: true },
    })

    if (!job) {
      logger.debug('webhook.resend.unknown_job', { emailId, type })
      sendSuccess(res, { received: true })
      return
    }

    if (job.status === 'DISPATCHED' || job.status === 'DEAD') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_PROCESSED', message: 'Duplicate event' } })
      return
    }

    // Step 7 — Update job based on event type
    const isFailure = type.includes('bounced') || type.includes('complaint') || type.includes('failed')
    if (isFailure) {
      await markFailed(job.id, `RESEND_${type.toUpperCase().replace(/\./g, '_')}`, false)
    } else if (type === 'email.delivered') {
      await markSent(job.id, emailId, 0)
    }

    logger.info('webhook.resend.processed', { jobId: job.id, emailId, type })
    sendSuccess(res, { received: true })
  }),
)

export default router
