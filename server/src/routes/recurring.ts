/**
 * Recurring Invoice Routes
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createRecurringSchema,
  updateRecurringSchema,
  listRecurringSchema,
} from '../schemas/recurring.schemas.js'
import * as recurringService from '../services/recurring/index.js'
import { requirePermission } from '../middleware/permission.js'
import { requireFeature } from '../middleware/subscription-gate.js'

const router = Router()

router.use(auth)
router.use(requireFeature('recurringInvoices'))

/** POST /api/recurring — Create a new recurring invoice schedule */
router.post(
  '/',
  requirePermission('invoicing.create'),
  validate(createRecurringSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const recurring = await recurringService.createRecurring(businessId, req.user!.userId, req.body)
    sendSuccess(res, recurring, 201)
  })
)

/** GET /api/recurring — List recurring schedules (filterable by status, paginated) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listRecurringSchema.parse(req.query)
    const result = await recurringService.listRecurring(businessId, query)
    sendSuccess(res, result)
  })
)

/** POST /api/recurring/generate — Manually trigger generation of all due invoices */
router.post(
  '/generate',
  requirePermission('invoicing.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await recurringService.generateDueInvoices(businessId)
    sendSuccess(res, result)
  })
)

/** GET /api/recurring/:id — Get a single recurring schedule */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const recurring = await recurringService.getRecurring(businessId, String(req.params.id))
    sendSuccess(res, recurring)
  })
)

/** PUT /api/recurring/:id — Update frequency, dates, autoSend, or pause/resume */
router.put(
  '/:id',
  requirePermission('invoicing.edit'),
  validate(updateRecurringSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
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
  requirePermission('invoicing.delete'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await recurringService.deleteRecurring(businessId, String(req.params.id))
    sendSuccess(res, result)
  })
)

export default router
