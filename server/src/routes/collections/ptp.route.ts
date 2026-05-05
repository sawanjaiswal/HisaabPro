/**
 * Promise-to-Pay routes
 *
 * POST   /api/collections/ptp             — create (requires X-Idempotency-Key)
 * GET    /api/collections/ptp             — list (?partyId=&status=&cursor=&limit=)
 * PATCH  /api/collections/ptp/:id         — update (requires X-Idempotency-Key)
 * DELETE /api/collections/ptp/:id         — soft delete
 * POST   /api/collections/ptp/:id/mark-kept — manually mark KEPT
 */

import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { auth } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permission.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { createRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import {
  createPtp,
  updatePtp,
  deletePtp,
} from '../../services/collections/promise-to-pay.service.js'
import {
  listPtps,
  markPtpKept,
} from '../../services/collections/promise-to-pay-eval.service.js'

const router = Router()

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const ptpWriteLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many PTP requests — try again in a minute',
  keyFn: (req) => `ptp:${req.user?.userId ?? req.ip}`,
  eventName: 'PTP_RATE_LIMITED',
})

// ─── Validation schemas ───────────────────────────────────────────────────────

const createSchema = z.object({
  partyId: z.string().min(1),
  invoiceId: z.string().min(1).optional(),
  amountPaise: z.number().int().positive(),
  promiseDate: z.string().datetime({ offset: true }).or(z.string().date()),
  notes: z.string().max(500).optional(),
})

const updateSchema = z.object({
  promiseDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  amountPaise: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' })

const listSchema = z.object({
  partyId: z.string().optional(),
  status: z.enum(['OPEN', 'KEPT', 'BROKEN', 'CANCELLED']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const markKeptSchema = z.object({
  paymentId: z.string().min(1),
})

// ─── Error mapper ─────────────────────────────────────────────────────────────

function handleServiceError(
  res: Response,
  err: unknown,
) {
  const code = (err as NodeJS.ErrnoException).code
  const msg = err instanceof Error ? err.message : 'Unknown error'

  if (code === 'PTP_NOT_FOUND') { sendError(res, msg, code, 404); return }
  if (code === 'PARTY_NOT_FOUND' || code === 'INVOICE_NOT_FOUND') { sendError(res, msg, code, 404); return }
  if (code === 'AMOUNT_INVALID') { sendError(res, msg, code, 400); return }
  if (code === 'PROMISED_DATE_INVALID') { sendError(res, 'promiseDate must be a future date', code, 400); return }
  if (code === 'PTP_NOT_EDITABLE') { sendError(res, msg, code, 409); return }
  if (code === 'PTP_NOT_DELETABLE') { sendError(res, msg, code, 409); return }

  throw err // let errorHandler handle
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST — create
router.post(
  '/',
  auth,
  ptpWriteLimiter,
  requirePermission('collections.ptp'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const idempKey = req.headers['x-idempotency-key'] as string | undefined
    if (!idempKey) {
      sendError(res, 'X-Idempotency-Key header is required', 'MISSING_IDEMPOTENCY_KEY', 400)
      return
    }

    const { businessId, userId } = req.user!
    const body = req.body as z.infer<typeof createSchema>

    try {
      const ptp = await createPtp(businessId, userId, {
        ...body,
        promiseDate: new Date(body.promiseDate),
      })
      sendSuccess(res, ptp, 201)
    } catch (err) {
      handleServiceError(res, err)
    }
  }),
)

// GET — list
router.get(
  '/',
  auth,
  requirePermission('collections.view'),
  asyncHandler(async (req, res) => {
    const parsed = listSchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Invalid query', 'VALIDATION_ERROR', 400)
      return
    }

    const { businessId } = req.user!
    const result = await listPtps(businessId, parsed.data)
    sendSuccess(res, result)
  }),
)

// PATCH — update
router.patch(
  '/:id',
  auth,
  ptpWriteLimiter,
  requirePermission('collections.ptp'),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const idempKey = req.headers['x-idempotency-key'] as string | undefined
    if (!idempKey) {
      sendError(res, 'X-Idempotency-Key header is required', 'MISSING_IDEMPOTENCY_KEY', 400)
      return
    }

    const { businessId, userId } = req.user!
    const body = req.body as z.infer<typeof updateSchema>
    const patch = {
      ...(body.amountPaise !== undefined ? { amountPaise: body.amountPaise } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.promiseDate ? { promiseDate: new Date(body.promiseDate) } : {}),
    }

    try {
      const updated = await updatePtp(businessId, String(req.params.id), userId, patch)
      sendSuccess(res, updated)
    } catch (err) {
      handleServiceError(res, err)
    }
  }),
)

// DELETE — soft delete
router.delete(
  '/:id',
  auth,
  requirePermission('collections.ptp'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!

    try {
      await deletePtp(businessId, String(req.params.id), userId)
      sendSuccess(res, { deleted: true })
    } catch (err) {
      handleServiceError(res, err)
    }
  }),
)

// POST — mark-kept
router.post(
  '/:id/mark-kept',
  auth,
  requirePermission('collections.ptp'),
  validate(markKeptSchema),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const { paymentId } = req.body as z.infer<typeof markKeptSchema>

    try {
      const updated = await markPtpKept(businessId, String(req.params.id), paymentId, userId)
      sendSuccess(res, updated)
    } catch (err) {
      handleServiceError(res, err)
    }
  }),
)

export default router
