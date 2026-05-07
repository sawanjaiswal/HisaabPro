/**
 * Expense Budgets Routes
 * Mount: under /api/expenses (see expenses.ts)
 * All routes require auth + accounting permissions.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { requirePermission } from '../middleware/permission.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { sendSuccess } from '../lib/response.js'
import {
  setBudgetSchema,
  listBudgetsQuerySchema,
} from '../schemas/expenses-upgrade.schemas.js'
import {
  listBudgets,
  setBudget,
  deleteBudget,
} from '../services/expense/expense-budget.service.js'

const router = Router()

/**
 * POST /budgets — upsert budget for a month+category (200)
 * Idempotent: same month+category returns updated row.
 */
router.post(
  '/',
  idempotencyCheck(),
  requirePermission('accounting.create'),
  validate(setBudgetSchema),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const budget = await setBudget(businessId, userId, req.body)
    sendSuccess(res, budget)
  }),
)

/**
 * GET /budgets?month=YYYY-MM — list budgets with utilization (200)
 * Query param: month in YYYY-MM format (e.g. 2026-05).
 * Internally converted to YYYY-MM-01 for storage.
 */
router.get(
  '/',
  requirePermission('accounting.read'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!

    // Accept ?month=YYYY-MM and convert to YYYY-MM-01
    const monthRaw = String(req.query.month ?? '')
    const monthYmd = /^\d{4}-\d{2}$/.test(monthRaw)
      ? `${monthRaw}-01`
      : String(req.query.monthYmd ?? '')

    const parsed = listBudgetsQuerySchema.safeParse({ monthYmd })
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'month query param required (YYYY-MM)' },
      })
      return
    }

    const budgets = await listBudgets(businessId, parsed.data.monthYmd)
    sendSuccess(res, { budgets, utilization: budgets })
  }),
)

/** DELETE /budgets/:id — soft-delete a budget (200) */
router.delete(
  '/:id',
  requirePermission('accounting.create'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const result = await deleteBudget(businessId, String(req.params.id))
    sendSuccess(res, result)
  }),
)

export default router
