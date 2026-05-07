/**
 * Cash Register Routes
 * Mount: /api/cash-entries
 * All routes require auth.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission, requireOwner } from '../middleware/permission.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { sendSuccess } from '../lib/response.js'
import { sendError } from '../lib/response.js'
import {
  createCashEntrySchema,
  editCashEntrySchema,
  voidCashEntrySchema,
  listCashEntriesQuerySchema,
  cashSummaryQuerySchema,
} from '../schemas/cash-register.schemas.js'
import { createCashEntry } from '../services/cash-register/cash-entry.create.js'
import { editCashEntry } from '../services/cash-register/cash-entry.update.js'
import { voidCashEntry } from '../services/cash-register/cash-entry.void.js'
import { restoreCashEntry } from '../services/cash-register/cash-entry.restore.js'
import { hardDeleteCashEntry } from '../services/cash-register/cash-entry.delete.js'
import {
  listCashEntries,
  getCashEntry,
  getCashSummary,
} from '../services/cash-register/cash-entry.queries.js'

const router = Router()

router.use(auth)

/** POST /api/cash-entries */
router.post(
  '/',
  idempotencyCheck(),
  requirePermission('cashRegister.create'),
  validate(createCashEntrySchema),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const { expression, direction, note } = req.body
    const idempotencyKey = (req.headers['x-idempotency-key'] as string) ?? null
    const entry = await createCashEntry({
      businessId,
      userId,
      direction,
      expression,
      note: note ?? null,
      idempotencyKey,
    })
    sendSuccess(res, entry, 201)
  }),
)

/** GET /api/cash-entries/summary — must be before /:id */
router.get(
  '/summary',
  requirePermission('cashRegister.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const query = cashSummaryQuerySchema.parse(req.query)
    const summary = await getCashSummary({
      businessId,
      tzOffsetMinutes: query.tzOffsetMinutes,
    })
    sendSuccess(res, summary)
  }),
)

/** GET /api/cash-entries */
router.get(
  '/',
  requirePermission('cashRegister.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const query = listCashEntriesQuerySchema.parse(req.query)
    const result = await listCashEntries({
      businessId,
      direction: query.direction,
      includeVoided: query.includeVoided ?? query.voided,
      cursor: query.cursor,
      limit: query.limit,
    })
    sendSuccess(res, result)
  }),
)

/** GET /api/cash-entries/:id */
router.get(
  '/:id',
  requirePermission('cashRegister.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const entry = await getCashEntry({ businessId, id: String(req.params.id) })
    sendSuccess(res, entry)
  }),
)

/** PATCH /api/cash-entries/:id */
router.patch(
  '/:id',
  idempotencyCheck(),
  requirePermission('cashRegister.edit'),
  validate(editCashEntrySchema),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const entry = await editCashEntry({
      businessId,
      userId,
      id: String(req.params.id),
      patch: req.body,
    })
    sendSuccess(res, entry)
  }),
)

/** POST /api/cash-entries/:id/void */
router.post(
  '/:id/void',
  idempotencyCheck(),
  requirePermission('cashRegister.edit'),
  validate(voidCashEntrySchema),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const entry = await voidCashEntry({
      businessId,
      userId,
      id: String(req.params.id),
      reason: req.body.reason ?? null,
    })
    sendSuccess(res, entry)
  }),
)

/** POST /api/cash-entries/:id/restore */
router.post(
  '/:id/restore',
  idempotencyCheck(),
  requirePermission('cashRegister.edit'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const entry = await restoreCashEntry({ businessId, userId, id: String(req.params.id) })
    sendSuccess(res, entry)
  }),
)

/** DELETE /api/cash-entries/:id — owner-only */
router.delete(
  '/:id',
  requirePermission('cashRegister.delete'),
  requireOwner(),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    await hardDeleteCashEntry({ businessId, userId, id: String(req.params.id) })
    sendSuccess(res, { deleted: true })
  }),
)

// Suppress unused import warning for sendError (used by middleware chain)
void sendError

export default router
