/**
 * Recurring Invoice Run History Sub-Router
 * Mounted at: /api/recurring/:id/runs
 *
 * GET / — paginated run history for a schedule  [recurring.view]
 */

import { Router } from 'express'
import { requirePermission } from '../../middleware/permission.js'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { sendSuccess, sendError } from '../../lib/response.js'
import { runsListSchema } from '../../schemas/recurring.schemas.js'
import { listRuns } from '../../services/recurring/index.js'
import { prisma } from '../../lib/prisma.js'

// mergeParams: true is required so :id from the parent router is accessible
const router = Router({ mergeParams: true })

/**
 * GET /api/recurring/:id/runs
 * Returns cursor-paginated run history for the given recurring schedule.
 */
router.get(
  '/',
  requirePermission('recurring.view'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const scheduleId = String(req.params.id)

    // Verify the schedule belongs to this business
    const schedule = await prisma.recurringInvoice.findFirst({
      where: { id: scheduleId, businessId, isDeleted: false },
      select: { id: true },
    })
    if (!schedule) {
      sendError(res, 'Recurring schedule not found', 'NOT_FOUND', 404)
      return
    }

    const parsed = runsListSchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0]?.message ?? 'Invalid query', 'VALIDATION_ERROR', 400)
      return
    }

    const result = await listRuns(businessId, scheduleId, parsed.data)
    sendSuccess(res, result)
  }),
)

export default router
