/**
 * Stock Verification Routes — Feature #111
 * Create → count items → complete → apply adjustments.
 * All routes require auth + businessId scoped.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  createVerificationSchema,
  updateVerificationItemSchema,
  listVerificationsSchema,
  completeVerificationSchema,
} from '../schemas/stock-verification.schemas.js'
import * as verificationService from '../services/stock-verification.service.js'

const router = Router()

router.use(auth)

/** POST /api/stock-verification — Create new verification (snapshots all active products) */
router.post(
  '/',
  validate(createVerificationSchema),
  asyncHandler(async (req, res) => {
    const result = await verificationService.createVerification(
      req.user!.businessId,
      req.user!.userId,
      req.body
    )
    sendSuccess(res, result, 201)
  })
)

/** GET /api/stock-verification — List verifications (cursor paginated) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = listVerificationsSchema.parse(req.query)
    const result = await verificationService.listVerifications(req.user!.businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/stock-verification/:id — Get verification with all items */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await verificationService.getVerification(
      req.user!.businessId,
      String(req.params.id)
    )
    sendSuccess(res, result)
  })
)

/** PATCH /api/stock-verification/:id/items/:itemId — Record physical count */
router.patch(
  '/:id/items/:itemId',
  validate(updateVerificationItemSchema),
  asyncHandler(async (req, res) => {
    const result = await verificationService.updateItemCount(
      req.user!.businessId,
      String(req.params.id),
      String(req.params.itemId),
      req.body
    )
    sendSuccess(res, result)
  })
)

/** POST /api/stock-verification/:id/complete — Mark verification complete */
router.post(
  '/:id/complete',
  validate(completeVerificationSchema),
  asyncHandler(async (req, res) => {
    const result = await verificationService.completeVerification(
      req.user!.businessId,
      String(req.params.id),
      req.body
    )
    sendSuccess(res, result)
  })
)

/** POST /api/stock-verification/:id/adjust — Apply stock adjustments for discrepancies */
router.post(
  '/:id/adjust',
  asyncHandler(async (req, res) => {
    const result = await verificationService.applyAdjustments(
      req.user!.businessId,
      String(req.params.id),
      req.user!.userId
    )
    sendSuccess(res, result)
  })
)

export default router
