/**
 * GSTR-1 Reconciliation Routes
 * Base path: /api/gst/reconciliation
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  startReconciliationSchema,
  listReconciliationsSchema,
  reconciliationEntryFilterSchema,
} from '../schemas/reconciliation.schemas.js'
import * as reconService from '../services/reconciliation.service.js'

const router = Router()
router.use(auth)

/** POST /api/gst/reconciliation — Start a new reconciliation (upload GSTR data) */
router.post('/', validate(startReconciliationSchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const reconciliation = await reconService.startReconciliation(businessId, req.body)
  sendSuccess(res, reconciliation, 201)
}))

/** GET /api/gst/reconciliation — List all reconciliations */
router.get('/', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const filters = listReconciliationsSchema.parse(req.query)
  const result = await reconService.listReconciliations(businessId, filters)
  sendSuccess(res, result)
}))

/** GET /api/gst/reconciliation/:id — Get reconciliation summary */
router.get('/:id', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const reconciliation = await reconService.getReconciliation(businessId, String(req.params.id))
  sendSuccess(res, reconciliation)
}))

/** GET /api/gst/reconciliation/:id/entries — Get entries with optional matchStatus filter */
router.get('/:id/entries', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const filters = reconciliationEntryFilterSchema.parse(req.query)
  const result = await reconService.getReconciliationEntries(businessId, String(req.params.id), filters)
  sendSuccess(res, result)
}))

/** DELETE /api/gst/reconciliation/:id — Delete reconciliation + cascade entries */
router.delete('/:id', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  await reconService.deleteReconciliation(businessId, String(req.params.id))
  sendSuccess(res, { deleted: true })
}))

export default router
