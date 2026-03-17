/**
 * E-Way Bill Routes — Generate, cancel, update Part-B, retrieve EWB
 *
 * POST /api/ewaybill/generate      { documentId, transportMode, ... }
 * POST /api/ewaybill/cancel        { documentId, reason }
 * PUT  /api/ewaybill/update-partb  { documentId, vehicleNumber, vehicleType? }
 * GET  /api/ewaybill/:documentId
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { resolveBusinessId } from '../lib/business.js'
import {
  generateEWayBillSchema,
  cancelEWayBillSchema,
  updatePartBSchema,
} from '../schemas/ecompliance.schemas.js'
import type {
  GenerateEWayBillInput,
  CancelEWayBillInput,
  UpdatePartBInput,
} from '../schemas/ecompliance.schemas.js'
import * as ewaybillService from '../services/ewaybill.service.js'

const router = Router()
router.use(auth)

/** POST /api/ewaybill/generate — Generate E-Way Bill for a saved invoice */
router.post(
  '/generate',
  validate(generateEWayBillSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const { documentId, ...transport } = req.body as GenerateEWayBillInput
    const eWayBill = await ewaybillService.generateEWayBill(businessId, documentId, transport)
    sendSuccess(res, eWayBill, 201)
  })
)

/** POST /api/ewaybill/cancel — Cancel an E-Way Bill within 24 hours */
router.post(
  '/cancel',
  validate(cancelEWayBillSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const { documentId, reason } = req.body as CancelEWayBillInput
    const eWayBill = await ewaybillService.cancelEWayBill(businessId, documentId, reason)
    sendSuccess(res, eWayBill)
  })
)

/** PUT /api/ewaybill/update-partb — Update vehicle details on an active E-Way Bill */
router.put(
  '/update-partb',
  validate(updatePartBSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const { documentId, vehicleNumber, vehicleType } = req.body as UpdatePartBInput
    const eWayBill = await ewaybillService.updatePartB(businessId, documentId, {
      vehicleNumber,
      vehicleType,
    })
    sendSuccess(res, eWayBill)
  })
)

/** GET /api/ewaybill/:documentId — Retrieve E-Way Bill record */
router.get(
  '/:documentId',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const eWayBill = await ewaybillService.getEWayBill(businessId, String(req.params.documentId))
    sendSuccess(res, eWayBill)
  })
)

export default router
