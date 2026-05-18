/**
 * Recurring Invoice Routes
 *
 * GET    /api/recurring              — list [recurring.view]
 * POST   /api/recurring              — create [recurring.manage + X-Idempotency-Key]
 * GET    /api/recurring/:id          — detail [recurring.view]
 * PATCH  /api/recurring/:id          — update [recurring.manage]
 * DELETE /api/recurring/:id          — delete [recurring.manage]
 * POST   /api/recurring/generate     — legacy bulk trigger [recurring.manage]
 *
 * Action sub-routes (pause/resume/generate-now) are in recurring-actions.route.ts.
 * Run history is in recurring-runs.route.ts.
 */

import { Router } from 'express'
import type { Response } from 'express'
import { auth } from '../../middleware/auth.js'
import { requirePermission } from '../../middleware/permission.js'
import { requireFeature } from '../../middleware/subscription-gate.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { validate } from '../../middleware/validate.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import {
  createRecurringSchema,
  updateRecurringSchema,
  listRecurringSchema,
} from '../../schemas/recurring.schemas.js'
import {
  createRecurring,
  getRecurring,
  listRecurring,
  updateRecurring,
  deleteRecurring,
  generateDueInvoices,
} from '../../services/recurring/index.js'
import recurringActionsRouter from './recurring-actions.route.js'
import recurringRunsRouter from './recurring-runs.route.js'

const router = Router()

router.use(auth)
router.use(requireFeature('recurringInvoices'))

// ─── Error mapper ─────────────────────────────────────────────────────────────

function handleServiceError(res: Response, err: unknown): void {
  const code = (err as NodeJS.ErrnoException).code
  const msg = err instanceof Error ? err.message : 'Unknown error'

  if (code === 'NOT_FOUND') { sendError(res, msg, code, 404); return }
  if (code === 'VALIDATION_ERROR') { sendError(res, msg, code, 400); return }
  if (code === 'CONFLICT') { sendError(res, msg, code, 409); return }

  throw err
}

// ─── POST /api/recurring — create ────────────────────────────────────────────

router.post(
  '/',
  idempotencyCheck(),
  requirePermission('recurring.manage'),
  validate(createRecurringSchema),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    try {
      const recurring = await createRecurring(businessId, userId, req.body)
      sendSuccess(res, recurring, 201)
    } catch (err) {
      handleServiceError(res, err)
    }
  }),
)

// ─── GET /api/recurring — list ────────────────────────────────────────────────

router.get(
  '/',
  requirePermission('recurring.view'),
  asyncHandler(async (req, res) => {
    const parsed = listRecurringSchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Invalid query', 'VALIDATION_ERROR', 400)
      return
    }
    const { businessId } = req.user!
    const result = await listRecurring(businessId, parsed.data)
    sendSuccess(res, result)
  }),
)

// ─── POST /api/recurring/generate — legacy bulk trigger ──────────────────────
// NOTE: must be registered BEFORE /:id routes to avoid Express interpreting
// "generate" as an :id parameter.

router.post(
  '/generate',
  requirePermission('recurring.manage'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const result = await generateDueInvoices(businessId)
    sendSuccess(res, result)
  }),
)

// ─── Action sub-router (pause / resume / generate-now) ───────────────────────

router.use('/:id', recurringActionsRouter)

// ─── Run history sub-router ───────────────────────────────────────────────────

router.use('/:id/runs', recurringRunsRouter)

// ─── GET /api/recurring/:id — detail ─────────────────────────────────────────

router.get(
  '/:id',
  requirePermission('recurring.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    try {
      const recurring = await getRecurring(businessId, String(req.params.id))
      sendSuccess(res, recurring)
    } catch (err) {
      handleServiceError(res, err)
    }
  }),
)

// ─── PATCH /api/recurring/:id — update ───────────────────────────────────────

router.patch(
  '/:id',
  requirePermission('recurring.manage'),
  validate(updateRecurringSchema),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    try {
      const recurring = await updateRecurring(businessId, String(req.params.id), userId, req.body)
      sendSuccess(res, recurring)
    } catch (err) {
      handleServiceError(res, err)
    }
  }),
)

// ─── DELETE /api/recurring/:id ────────────────────────────────────────────────

router.delete(
  '/:id',
  requirePermission('recurring.manage'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    try {
      const result = await deleteRecurring(businessId, String(req.params.id), userId)
      sendSuccess(res, result)
    } catch (err) {
      handleServiceError(res, err)
    }
  }),
)

export default router
