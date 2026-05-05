/**
 * Statement Routes
 *
 * GET /api/collections/statement/:partyId?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   Returns full statement data for one party over a date range.
 *   Requires: auth + collections.view permission.
 *   Rate limit: 30 req/min per user.
 */

import { Router } from 'express'
import { z } from 'zod'
import { auth } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permission.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { createRateLimiter } from '../../middleware/rate-limit.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { getStatementData } from '../../services/collections/statement.service.js'
import { AppError } from '../../lib/errors.js'

const router = Router()

router.use(auth)
router.use(requirePermission('collections.view'))

// ─── Rate limit: 30/min per authenticated user ────────────────────────────────
const statementLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  message: 'Too many statement requests. Please wait a minute.',
  keyFn: (req) => `rl:stmt:${req.user?.userId ?? req.ip ?? 'unknown'}`,
  eventName: 'statement.rate_limit',
})

// ─── Query validation schema ──────────────────────────────────────────────────
const querySchema = z.object({
  from: z.string().min(1, 'from is required'),
  to:   z.string().min(1, 'to is required'),
})

// ─── GET /api/collections/statement/:partyId ──────────────────────────────────
router.get(
  '/:partyId',
  statementLimiter,
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Invalid query', 'VALIDATION_ERROR', 400)
      return
    }

    const fromStr = String(parsed.data.from)
    const toStr = String(parsed.data.to)
    const partyId = String(req.params.partyId)
    const businessId = String(req.user!.businessId)

    try {
      const data = await getStatementData(businessId, partyId, fromStr, toStr)
      sendSuccess(res, data)
    } catch (err) {
      if (err instanceof AppError) {
        sendError(res, err.message, String(err.code), err.statusCode)
        return
      }
      throw err
    }
  })
)

export default router
