/**
 * Document convert + recycle-bin operations sub-router
 * POST :id/convert · POST :id/restore · DELETE :id/permanent
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { replayProtection } from '../../middleware/replay-protection.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { requirePermission } from '../../middleware/permission.js'
import { sendSuccess } from '../../lib/response.js'
import { convertDocumentSchema } from '../../schemas/document.schemas.js'
import * as documentService from '../../services/document.service.js'

const router = Router()

/** POST /api/documents/:id/convert — Convert to target type */
router.post(
  '/:id/convert',
  requirePermission('invoicing.create'),
  replayProtection,
  idempotencyCheck(),
  validate(convertDocumentSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const doc = await documentService.convertDocument(
      businessId, String(req.params.id), req.user!.userId, req.body
    )
    sendSuccess(res, doc, 201)
  })
)

/** POST /api/documents/:id/restore — Restore from recycle bin */
router.post(
  '/:id/restore',
  requirePermission('invoicing.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const doc = await documentService.restoreDocument(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, doc)
  })
)

/** DELETE /api/documents/:id/permanent — Hard delete */
router.delete(
  '/:id/permanent',
  requirePermission('invoicing.delete'),
  replayProtection,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    await documentService.permanentDeleteDocument(businessId, String(req.params.id))
    res.status(204).end()
  })
)

export default router
