/**
 * Recurring Invoice Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { resolveBusinessId } from '../lib/business.js'
import {
  createRecurringSchema,
  updateRecurringSchema,
  listRecurringSchema,
} from '../schemas/recurring.schemas.js'
import * as recurringService from '../services/recurring.service.js'

const router = Router()

router.use(auth)

/** POST /api/recurring — Create a new recurring invoice schedule */
router.post(
  '/',
  validate(createRecurringSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const recurring = await recurringService.createRecurring(businessId, req.user!.userId, req.body)
    sendSuccess(res, recurring, 201)
  })
)

/** GET /api/recurring — List recurring schedules (filterable by status, paginated) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const query = listRecurringSchema.parse(req.query)
    const result = await recurringService.listRecurring(businessId, query)
    sendSuccess(res, result)
  })
)

/** POST /api/recurring/generate — Manually trigger generation of all due invoices */
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const result = await recurringService.generateDueInvoices(businessId)
    sendSuccess(res, result)
  })
)

/** GET /api/recurring/:id — Get a single recurring schedule */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const recurring = await recurringService.getRecurring(businessId, String(req.params.id))
    sendSuccess(res, recurring)
  })
)

/** PUT /api/recurring/:id — Update frequency, dates, autoSend, or pause/resume */
router.put(
  '/:id',
  validate(updateRecurringSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const recurring = await recurringService.updateRecurring(
      businessId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, recurring)
  })
)

/** DELETE /api/recurring/:id — Hard delete if no docs generated, else mark COMPLETED */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const result = await recurringService.deleteRecurring(businessId, String(req.params.id))
    sendSuccess(res, result)
  })
)

export default router
