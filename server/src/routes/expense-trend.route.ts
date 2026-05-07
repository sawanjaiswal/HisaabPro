/**
 * Expense Trend Routes
 * Mount: under /api/expenses (see expenses.ts)
 * Returns monthly aggregation of CONFIRMED expenses.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import { getMonthlyTrend } from '../services/expense/expense-trend.service.js'

const router = Router()

/**
 * GET /trend?months=6 — monthly trend for last N months (200)
 * months: 1–24 (default 6)
 * CONFIRMED expenses only.
 */
router.get(
  '/',
  requirePermission('accounting.read'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const months = Math.min(24, Math.max(1, parseInt(String(req.query.months ?? '6'), 10) || 6))
    const trend = await getMonthlyTrend(businessId, months)
    sendSuccess(res, trend)
  }),
)

export default router
