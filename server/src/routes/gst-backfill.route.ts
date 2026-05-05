/**
 * GST Backfill Routes — /api/gst/backfill
 *
 * POST /api/gst/backfill/preview   — read-only preview counts
 * POST /api/gst/backfill/execute   — start async backfill job (idempotent, rate-limited)
 * GET  /api/gst/backfill/status/:jobId — poll job progress
 *
 * Rate limit on /execute: 1 request per hour per businessId+userId composite.
 * Idempotency-Key header required on /execute (400 if missing).
 */

import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { createRateLimiter } from '../middleware/rate-limit/factory.js'
import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import { executeBackfillSchema } from '../schemas/gst-backfill.schemas.js'
import * as backfillService from '../services/gst/backfill.service.js'
import { loadJobIdByKey } from '../services/gst/backfill-store.js'

const router = Router()

// All routes require authentication
router.use(auth)

/**
 * Middleware: require Idempotency-Key header before rate-limit check.
 * This must run before the rate limiter so invalid requests don't consume quota.
 */
function requireIdempotencyKey(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const key = req.headers['idempotency-key']
  if (!key || Array.isArray(key)) {
    sendError(res, 'Idempotency-Key header is required', 'MISSING_IDEMPOTENCY_KEY', 400)
    return
  }
  next()
}

/**
 * Replay middleware: if Idempotency-Key was already used for this business,
 * short-circuit and return the cached jobId. This must run BEFORE the rate
 * limiter so replays never consume rate-limit quota.
 */
function backfillReplayCheck(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['idempotency-key'] as string
  const businessId = req.user?.businessId ?? ''
  loadJobIdByKey(key, businessId).then(jobId => {
    if (jobId) {
      logger.info('BACKFILL_REPLAY_HIT', { idempotencyKey: key, jobId })
      sendSuccess(res, { jobId, status: 'RUNNING' }, 200)
      return
    }
    next()
  }).catch(next)
}

// Rate limiter: 1 execute per hour per businessId+userId
const backfillRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1,
  message: 'Only one backfill can be run per hour. Please wait before starting another.',
  keyFn: (req) => `backfill-execute:${req.user?.businessId ?? 'unknown'}:${req.user?.userId ?? 'unknown'}`,
  eventName: 'BACKFILL_RATE_LIMITED',
})

/**
 * POST /api/gst/backfill/preview
 * Returns read-only counts of untagged products and null-POS documents.
 * No side effects.
 */
router.post(
  '/preview',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const data = await backfillService.previewBackfill(businessId)
    sendSuccess(res, data)
  }),
)

/**
 * POST /api/gst/backfill/execute
 * Starts an async backfill job. Non-blocking — job runs in background.
 * Requires Idempotency-Key header. Rate-limited to 1/hour per business+user.
 * Same key replays return cached response (no duplicate AuditLog).
 */
router.post(
  '/execute',
  requirePermission('settings.modify'),
  requireIdempotencyKey,
  backfillReplayCheck,
  backfillRateLimit,
  validate(executeBackfillSchema),
  asyncHandler(async (req, res) => {
    const { userId, businessId } = req.user!
    const idempotencyKey = req.headers['idempotency-key'] as string

    const body = req.body as import('../schemas/gst-backfill.schemas.js').ExecuteBackfillInput

    // Validate defaultTaxCategoryId belongs to this business and is active
    const taxCategory = await prisma.taxCategory.findFirst({
      where: {
        id: body.defaultTaxCategoryId,
        businessId,
        isActive: true,
        isDeleted: false,
      },
    })

    if (!taxCategory) {
      sendError(
        res,
        'defaultTaxCategoryId does not reference an active tax category in this business',
        'INVALID_TAX_CATEGORY',
        400,
      )
      return
    }

    logger.info('BACKFILL_EXECUTE_START', {
      userId,
      businessId,
      idempotencyKey,
      defaultTaxCategoryId: body.defaultTaxCategoryId,
    })

    const result = await backfillService.executeBackfill(
      businessId,
      {
        defaultTaxCategoryId: body.defaultTaxCategoryId,
        dateRange: body.dateRange,
        setPositionFromParty: body.setPositionFromParty,
      },
      userId,
      idempotencyKey,
    )

    sendSuccess(res, result, 201)
  }),
)

/**
 * GET /api/gst/backfill/status/:jobId
 * Returns current job progress. Marks INTERRUPTED if heartbeat is stale (>2h).
 */
router.get(
  '/status/:jobId',
  requirePermission('settings.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const jobId = req.params['jobId'] as string

    const status = await backfillService.getBackfillStatus(businessId, jobId)
    if (!status) {
      sendError(res, 'Job not found', 'JOB_NOT_FOUND', 404)
      return
    }

    sendSuccess(res, status)
  }),
)

export default router
