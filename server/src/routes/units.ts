/**
 * Unit & Unit Conversion Routes
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { resolveBusinessId } from '../lib/business.js'
import {
  createUnitSchema,
  updateUnitSchema,
  createConversionSchema,
  updateConversionSchema,
} from '../schemas/product.schemas.js'
import * as unitService from '../services/unit.service.js'

const router = Router()

router.use(auth)

// ============================================================
// Units
// ============================================================

/** GET /api/units — List all units */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const units = await unitService.listUnits(businessId)
    sendSuccess(res, units)
  })
)

/** POST /api/units — Create custom unit */
router.post(
  '/',
  validate(createUnitSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const unit = await unitService.createUnit(businessId, req.body)
    sendSuccess(res, { unit }, 201)
  })
)

/** PUT /api/units/:id — Update custom unit */
router.put(
  '/:id',
  validate(updateUnitSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const unitId = String(req.params.id)
    const unit = await unitService.updateUnit(businessId, unitId, req.body)
    sendSuccess(res, { unit })
  })
)

/** DELETE /api/units/:id — Delete custom unit */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const unitId = String(req.params.id)
    const result = await unitService.deleteUnit(businessId, unitId)
    sendSuccess(res, result)
  })
)

// ============================================================
// Unit Conversions
// ============================================================

/** GET /api/unit-conversions — List all conversions */
router.get(
  '/conversions',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const conversions = await unitService.listConversions(businessId)
    sendSuccess(res, conversions)
  })
)

/** POST /api/unit-conversions — Create conversion (both directions) */
router.post(
  '/conversions',
  validate(createConversionSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const conversion = await unitService.createConversion(businessId, req.body)
    sendSuccess(res, { conversion }, 201)
  })
)

/** PUT /api/unit-conversions/:id — Update conversion factor */
router.put(
  '/conversions/:id',
  validate(updateConversionSchema),
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const conversionId = String(req.params.id)
    const conversion = await unitService.updateConversion(businessId, conversionId, req.body)
    sendSuccess(res, { conversion })
  })
)

/** DELETE /api/unit-conversions/:id — Delete conversion (both directions) */
router.delete(
  '/conversions/:id',
  asyncHandler(async (req, res) => {
    const businessId = await resolveBusinessId(req.user!.userId)
    const conversionId = String(req.params.id)
    const result = await unitService.deleteConversion(businessId, conversionId)
    sendSuccess(res, result)
  })
)

export default router
