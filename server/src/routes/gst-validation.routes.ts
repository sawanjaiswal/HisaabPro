/**
 * GST filing-readiness route (#144).
 * GET /api/gst/filing-readiness?period=YYYY-MM&returnType=GSTR1
 * Read-only pre-filing validation. Same auth/plan/permission gate as GST returns.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { requirePlan } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import { filingReadinessSchema } from '../schemas/gst-validation.schemas.js'
import { getFilingReadiness } from '../services/gst-validation/gst-validation.service.js'

const router = Router()

router.use(auth)
router.use(requirePlan('PRO'))

router.get(
  '/',
  requirePermission('reports.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { period, returnType } = filingReadinessSchema.parse(req.query)

    const result = await getFilingReadiness(businessId, period, returnType)
    sendSuccess(res, result)
  }),
)

export default router
