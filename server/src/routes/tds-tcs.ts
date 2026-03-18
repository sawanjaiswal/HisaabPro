/**
 * TDS/TCS Routes — Tax Deducted/Collected at Source summary report
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { tdsTcsSummarySchema } from '../schemas/report.schemas.js'
import { getTdsTcsReport } from '../services/tds-tcs.service.js'

const router = Router()

router.use(auth)

/** GET /api/reports/tds-tcs-summary?from=&to=&partyId=&type= — TDS/TCS summary report */
router.get(
  '/tds-tcs-summary',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = tdsTcsSummarySchema.parse(req.query)
    const result = await getTdsTcsReport(businessId, query)
    sendSuccess(res, result)
  }),
)

export default router
