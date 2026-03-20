/**
 * Stock Alert Routes — Feature #47
 *
 * List, acknowledge, and dismiss low-stock / out-of-stock alerts.
 * Mounted at /api/stock-alerts
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import * as stockAlertService from '../services/stock-alert.service.js'

const router = Router()

/**
 * GET /api/stock-alerts
 * List alerts for the user's active business.
 * Query: ?status=ACTIVE&cursor=xxx&limit=50
 */
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    if (!businessId) {
      sendError(res, 'No active business', 'NO_BUSINESS', 400)
      return
    }

    const status = req.query.status as string | undefined
    const cursor = req.query.cursor as string | undefined
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined

    const result = await stockAlertService.listAlerts(businessId, { status, cursor, limit })

    sendSuccess(res, {
      alerts: result.alerts,
      total: result.total,
      pagination: { nextCursor: result.nextCursor },
    })
  })
)

/**
 * GET /api/stock-alerts/count
 * Get active alert count (for dashboard badge).
 */
router.get(
  '/count',
  auth,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    if (!businessId) {
      sendError(res, 'No active business', 'NO_BUSINESS', 400)
      return
    }

    const count = await stockAlertService.getActiveAlertCount(businessId)
    sendSuccess(res, { count })
  })
)

/**
 * POST /api/stock-alerts/:id/acknowledge
 * Mark an alert as acknowledged.
 */
router.post(
  '/:id/acknowledge',
  auth,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    if (!businessId) {
      sendError(res, 'No active business', 'NO_BUSINESS', 400)
      return
    }

    await stockAlertService.acknowledgeAlert(String(req.params.id), req.user!.userId, businessId)
    sendSuccess(res, { message: 'Alert acknowledged' })
  })
)

/**
 * POST /api/stock-alerts/:id/dismiss
 * Dismiss (resolve) an alert.
 */
router.post(
  '/:id/dismiss',
  auth,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    if (!businessId) {
      sendError(res, 'No active business', 'NO_BUSINESS', 400)
      return
    }

    await stockAlertService.dismissAlert(String(req.params.id), businessId)
    sendSuccess(res, { message: 'Alert dismissed' })
  })
)

export default router
