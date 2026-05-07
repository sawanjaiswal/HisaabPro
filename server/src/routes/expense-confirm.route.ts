/**
 * Expense Confirm / Skip Routes
 * Mount: under /api/expenses (see expenses.ts)
 * Handles lifecycle transitions for PENDING_CONFIRMATION expenses.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { sendSuccess } from '../lib/response.js'
import {
  confirmExpense,
  skipExpense,
} from '../services/expense/expense-confirm.service.js'

const router = Router({ mergeParams: true })

/**
 * POST /:id/confirm — confirm a PENDING_CONFIRMATION expense (200)
 * Idempotent via X-Idempotency-Key.
 * 409 ALREADY_CONFIRMED on replay without idempotency key.
 */
router.post(
  '/:id/confirm',
  idempotencyCheck(),
  requirePermission('accounting.create'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const result = await confirmExpense(businessId, String(req.params.id), userId)
    sendSuccess(res, result)
  }),
)

/**
 * POST /:id/skip — skip (soft-delete) a PENDING_CONFIRMATION expense (200)
 * Idempotent via X-Idempotency-Key.
 */
router.post(
  '/:id/skip',
  idempotencyCheck(),
  requirePermission('accounting.create'),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const result = await skipExpense(businessId, String(req.params.id), userId)
    sendSuccess(res, result)
  }),
)

export default router
