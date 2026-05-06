/**
 * E-Way Bill Routes — Generate (201/200 idempotent), Update Part-B, Cancel, Get.
 * Auth + plan gate + nic-rate-limit + Idempotency-Key (POST/PUT) + Zod.
 * MB-1: ewbNumber never read from request body — always from DB.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { requirePlan } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import { nicRateLimit } from '../middleware/nic-rate-limit.js'
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
import * as svc from '../services/ewaybill/ewaybill.service.js'

const router = Router()
router.use(auth)
router.use(requirePlan('BUSINESS'))
router.use(nicRateLimit)

/** POST /api/ewaybill/generate — 201 fresh, 200 idempotent */
router.post(
  '/generate',
  requirePermission('invoicing.edit'),
  validate(generateEWayBillSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const { documentId, ...partAInputs } = req.body as GenerateEWayBillInput
    const { eWayBill, isIdempotent } = await svc.generateEWayBill(
      documentId, businessId, userId,
      {
        transportMode: partAInputs.transportMode,
        transporterId: partAInputs.transporterId,
        transporterName: partAInputs.transporterName,
        vehicleNumber: partAInputs.vehicleNumber,
        vehicleType: partAInputs.vehicleType,
        distance: partAInputs.distance,
        fromPincode: partAInputs.fromPincode,
        toPincode: partAInputs.toPincode,
      }
    )
    sendSuccess(res, eWayBill, isIdempotent ? 200 : 201)
  })
)

/** PUT /api/ewaybill/update-partb — Update vehicle details */
router.put(
  '/update-partb',
  requirePermission('invoicing.edit'),
  validate(updatePartBSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const { documentId, vehicleNumber, vehicleType } = req.body as UpdatePartBInput
    const eWayBill = await svc.updatePartB(documentId, businessId, userId, {
      vehicleNumber,
      vehicleType,
    })
    sendSuccess(res, eWayBill)
  })
)

/** POST /api/ewaybill/cancel */
router.post(
  '/cancel',
  requirePermission('invoicing.edit'),
  validate(cancelEWayBillSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const { documentId, reason } = req.body as CancelEWayBillInput
    const eWayBill = await svc.cancelEWayBill(documentId, businessId, userId, reason)
    sendSuccess(res, eWayBill)
  })
)

/** GET /api/ewaybill/:documentId */
router.get(
  '/:documentId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const eWayBill = await svc.getEWayBill(String(req.params.documentId), businessId)
    sendSuccess(res, eWayBill)
  })
)

export default router
