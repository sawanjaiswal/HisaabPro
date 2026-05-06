/**
 * Recurring Invoice Action Sub-Router
 * Mounted at: /api/recurring/:id
 *
 * POST /pause        — pause schedule    [recurring.pause]
 * POST /resume       — resume schedule   [recurring.pause]
 * POST /generate-now — manual generate   [recurring.manage + Idempotency-Key]
 */

import { Router } from 'express'
import { requirePermission } from '../../middleware/permission.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import logger from '../../lib/logger.js'
import { generateInvoiceForSchedule, computeNextRunDate } from '../../services/recurring/index.js'
import { prisma } from '../../lib/prisma.js'

const router = Router({ mergeParams: true })

// ─── POST /:id/pause ──────────────────────────────────────────────────────────

router.post(
  '/pause',
  requirePermission('recurring.pause'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const scheduleId = String(req.params.id)

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id: scheduleId, businessId, isDeleted: false },
      select: { id: true, status: true },
    })
    if (!existing) {
      sendError(res, 'Recurring schedule not found', 'NOT_FOUND', 404)
      return
    }
    if (existing.status !== 'ACTIVE') {
      sendError(res, `Cannot pause a schedule with status ${existing.status}`, 'INVALID_TRANSITION', 422)
      return
    }

    const updated = await prisma.recurringInvoice.update({
      where: { id: scheduleId },
      data: { status: 'PAUSED', updatedBy: userId },
      select: { id: true, status: true, nextRunDate: true },
    })

    logger.info('recurring.paused', { scheduleId, userId, businessId })
    sendSuccess(res, updated)
  }),
)

// ─── POST /:id/resume ─────────────────────────────────────────────────────────

router.post(
  '/resume',
  requirePermission('recurring.pause'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const scheduleId = String(req.params.id)

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id: scheduleId, businessId, isDeleted: false },
      select: {
        id: true, status: true, frequency: true,
        dayOfMonth: true, dayOfWeek: true, endDate: true,
      },
    })
    if (!existing) {
      sendError(res, 'Recurring schedule not found', 'NOT_FOUND', 404)
      return
    }
    if (existing.status === 'COMPLETED') {
      sendError(res, 'Cannot resume a completed recurring schedule', 'INVALID_TRANSITION', 422)
      return
    }
    if (existing.status !== 'PAUSED') {
      sendError(res, `Schedule is already ${existing.status}`, 'INVALID_TRANSITION', 422)
      return
    }

    const anchorDay = existing.frequency === 'WEEKLY' ? existing.dayOfWeek : existing.dayOfMonth
    const now = new Date()
    const nextRunDate = computeNextRunDate(now, existing.frequency, anchorDay)

    const isExpired = existing.endDate != null && nextRunDate > existing.endDate
    const newStatus = isExpired ? 'COMPLETED' : 'ACTIVE'

    const updated = await prisma.recurringInvoice.update({
      where: { id: scheduleId },
      data: { status: newStatus, nextRunDate, claimedAt: null, claimedBy: null, updatedBy: userId },
      select: { id: true, status: true, nextRunDate: true },
    })

    logger.info('recurring.resumed', { scheduleId, userId, businessId, nextRunDate, newStatus })
    sendSuccess(res, updated)
  }),
)

// ─── POST /:id/generate-now ───────────────────────────────────────────────────

router.post(
  '/generate-now',
  requirePermission('recurring.manage'),
  asyncHandler(async (req, res) => {
    const idempKey = req.headers['x-idempotency-key'] as string | undefined
    if (!idempKey) {
      sendError(res, 'X-Idempotency-Key header is required', 'MISSING_IDEMPOTENCY_KEY', 400)
      return
    }

    const { businessId, userId } = req.user!
    const scheduleId = String(req.params.id)

    const existing = await prisma.recurringInvoice.findFirst({
      where: { id: scheduleId, businessId, isDeleted: false },
      select: { id: true, status: true },
    })
    if (!existing) {
      sendError(res, 'Recurring schedule not found', 'NOT_FOUND', 404)
      return
    }
    if (existing.status !== 'ACTIVE') {
      sendError(res, `Cannot generate for a schedule with status ${existing.status}`, 'INVALID_TRANSITION', 422)
      return
    }

    const result = await generateInvoiceForSchedule(scheduleId, { manual: true, actorUserId: userId })

    if (result.status === 'FAILED') {
      sendError(res, result.error ?? 'Generation failed', 'GENERATION_FAILED', 500)
      return
    }

    const updated = await prisma.recurringInvoice.findUnique({
      where: { id: scheduleId },
      select: { nextRunDate: true },
    })

    sendSuccess(res, {
      documentId: result.documentId,
      runId: result.runId,
      status: result.status,
      warning: result.warning ?? null,
      nextRunDate: updated?.nextRunDate ?? null,
    })
  }),
)

export default router
