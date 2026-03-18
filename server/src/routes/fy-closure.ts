/**
 * Financial Year Closure Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import * as fyClosureService from '../services/fy-closure.service.js'

const router = Router()

router.use(auth)

const closeFYSchema = z.object({
  financialYear: z
    .string()
    .regex(/^\d{4}$/, 'financialYear must be a 4-digit string like "2526"'),
})

/** POST /api/fy-closure — Close a financial year */
router.post(
  '/',
  validate(closeFYSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { financialYear } = req.body as z.infer<typeof closeFYSchema>
    const result = await fyClosureService.closeFY(businessId, req.user!.userId, financialYear)
    sendSuccess(res, result, 201)
  }),
)

/** GET /api/fy-closure — List all FY closures for the business */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const closures = await fyClosureService.getFYClosures(businessId)
    sendSuccess(res, closures)
  }),
)

/** POST /api/fy-closure/:financialYear/reopen — Reopen a previously closed FY */
router.post(
  '/:financialYear/reopen',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const financialYear = String(req.params.financialYear)
    const result = await fyClosureService.reopenFY(businessId, financialYear)
    sendSuccess(res, result)
  }),
)

export default router
