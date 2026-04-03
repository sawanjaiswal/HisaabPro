/**
 * Recycle Bin API — list, restore, and permanently delete soft-deleted records.
 *
 * GET    /api/recycle-bin?entityType=Party&limit=20&cursor=xxx
 * POST   /api/recycle-bin/:entityType/:id/restore
 * DELETE /api/recycle-bin/:entityType/:id/permanent
 */

import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { sendSuccess, sendError } from '../lib/response.js'
import {
  recycleBinQuerySchema,
  recycleBinParamsSchema,
} from '../schemas/recycle-bin.schema.js'
import {
  listDeleted,
  restoreRecord,
  permanentDelete,
} from '../services/recycle-bin.service.js'

const router = Router()

// All recycle bin routes require auth
router.use(auth)

/** List deleted records of a given entity type */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = recycleBinQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0].message, 'VALIDATION_ERROR', 400)
      return
    }
    const { entityType, cursor, limit } = parsed.data
    const businessId = req.user!.businessId

    const result = await listDeleted(businessId, entityType, cursor, limit)
    sendSuccess(res, result)
  }),
)

/** Restore a soft-deleted record */
router.post(
  '/:entityType/:id/restore',
  asyncHandler(async (req, res) => {
    const parsed = recycleBinParamsSchema.safeParse(req.params)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0].message, 'VALIDATION_ERROR', 400)
      return
    }
    const { entityType, id } = parsed.data
    const businessId = req.user!.businessId
    const result = await restoreRecord(entityType, id, businessId)
    sendSuccess(res, result)
  }),
)

/** Permanently delete a record (irreversible) */
router.delete(
  '/:entityType/:id/permanent',
  asyncHandler(async (req, res) => {
    const parsed = recycleBinParamsSchema.safeParse(req.params)
    if (!parsed.success) {
      sendError(res, parsed.error.errors[0].message, 'VALIDATION_ERROR', 400)
      return
    }
    const { entityType, id } = parsed.data
    const businessId = req.user!.businessId
    await permanentDelete(entityType, id, businessId)
    sendSuccess(res, { deleted: true, entityType, id })
  }),
)

export default router
