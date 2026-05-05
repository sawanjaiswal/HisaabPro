/**
 * Bulk Reminder routes
 *
 * POST /api/payments/reminders/bulk — send bulk WhatsApp reminders
 *
 * Security gates:
 *   MB-3: template injection — customMessage never goes through render()
 *   MB-4: phone validation in service layer
 *   MB-6: rate limit 5/min/user, batch capped at 50
 */

import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../../middleware/auth.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { requirePermission } from '../../middleware/permission.js'
import { createRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { buildBulkReminderBatch, dispatchBulkReminders } from '../../services/collections/bulk-reminder.service.js'
import { isValidPhone } from '../../lib/wa-utils.js'
import { prisma } from '../../lib/prisma.js'

const router = Router()

const BATCH_LIMIT = 50

const bulkReminderSchema = z.object({
  partyIds: z
    .array(z.string().min(1))
    .min(1, 'At least one party required')
    .max(BATCH_LIMIT, `Batch limit is ${BATCH_LIMIT} parties`),
  channel: z.enum(['WHATSAPP', 'SMS']).default('WHATSAPP'),
  templateKey: z.enum(['POLITE', 'FIRM', 'URGENT']),
  customMessage: z.string().max(500).optional(),
})

// MB-6: 5 requests/min per user
const bulkReminderLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  message: 'Too many bulk reminder requests — try again in a minute',
  keyFn: (req) => `bulk-reminder:${req.user?.userId ?? req.ip}`,
  eventName: 'BULK_REMINDER_RATE_LIMITED',
})

router.post(
  '/bulk',
  auth,
  bulkReminderLimiter,
  requirePermission('collections.remind'),
  validate(bulkReminderSchema),
  asyncHandler(async (req, res) => {
    // Idempotency-Key required
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined
    if (!idempotencyKey) {
      sendError(res, 'Idempotency-Key header is required', 'MISSING_IDEMPOTENCY_KEY', 400)
      return
    }

    const { businessId, userId } = req.user!
    const { partyIds, templateKey, customMessage } = req.body as z.infer<typeof bulkReminderSchema>

    // MB-6: explicit batch size check (belt + suspenders over Zod)
    if (partyIds.length > BATCH_LIMIT) {
      sendError(
        res,
        `Batch size ${partyIds.length} exceeds limit of ${BATCH_LIMIT}`,
        'BATCH_LIMIT_EXCEEDED',
        400,
      )
      return
    }

    // Build batch: cross-tenant validation + template render (MB-3/MB-4 inside)
    const batch = await buildBulkReminderBatch(businessId, partyIds, templateKey, customMessage)

    // Collect validated phones for ReminderLog storage
    const partyPhoneMap = new Map<string, string>()
    if (batch.included.length > 0) {
      const parties = await prisma.party.findMany({
        where: { id: { in: batch.included.map((p) => p.partyId) }, businessId },
        select: { id: true, phone: true },
      })
      for (const p of parties) {
        if (p.phone) {
          const digits = p.phone.replace(/\D/g, '')
          if (isValidPhone(digits)) partyPhoneMap.set(p.id, digits)
        }
      }
    }

    const bulkBatchId = idempotencyKey.slice(0, 40) // cap to schema VarChar(40)

    const result = await dispatchBulkReminders(
      businessId,
      userId,
      batch,
      partyPhoneMap,
      templateKey,
      bulkBatchId,
    )

    sendSuccess(res, {
      sent: result.sent,
      excluded: result.excluded.length,
      excludedDetails: result.excluded,
      waLinks: batch.included.map((r) => ({ partyId: r.partyId, name: r.name, waLink: r.waLink })),
      bulkBatchId,
    })
  }),
)

export default router
