/**
 * Unit & Unit Conversion Routes
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import { notFoundError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import {
  createUnitSchema,
  updateUnitSchema,
  createConversionSchema,
  updateConversionSchema,
  unitConvertSchema,
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
    const businessId = req.user!.businessId
    const units = await unitService.listUnits(businessId)
    sendSuccess(res, units)
  })
)

/** POST /api/units — Create custom unit */
router.post(
  '/',
  requirePermission('inventory.edit'),
  validate(createUnitSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const unit = await unitService.createUnit(businessId, req.body)
    sendSuccess(res, { unit }, 201)
  })
)

// ============================================================
// Unit Conversion Calculator (#107)
// Static routes MUST come before /:id to avoid shadowing
// ============================================================

/**
 * GET /api/units/convert?fromUnitId=X&toUnitId=Y&quantity=Z
 * Convert a quantity between two units using stored UnitConversion records.
 * Tries direct conversion first, then reverse (bidirectional).
 */
router.get(
  '/convert',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { fromUnitId, toUnitId, quantity } = unitConvertSchema.parse(req.query)

    if (fromUnitId === toUnitId) {
      // Same unit — trivial conversion
      const unit = await prisma.unit.findFirst({
        where: { id: fromUnitId, businessId },
        select: { id: true, name: true, symbol: true },
      })
      if (!unit) throw notFoundError('Unit')
      sendSuccess(res, {
        fromQuantity: quantity,
        toQuantity: quantity,
        conversionRate: 1,
        fromUnit: unit,
        toUnit: unit,
      })
      return
    }

    // Try direct conversion, then reverse
    const conversion = await prisma.unitConversion.findFirst({
      where: {
        businessId,
        OR: [
          { fromUnitId, toUnitId },
          { fromUnitId: toUnitId, toUnitId: fromUnitId },
        ],
      },
      include: {
        fromUnit: { select: { id: true, name: true, symbol: true } },
        toUnit: { select: { id: true, name: true, symbol: true } },
      },
    })

    if (!conversion) throw notFoundError('No conversion exists between these units')

    // Determine orientation: if the stored record is reversed, invert factor
    const isReversed = conversion.fromUnitId === toUnitId
    const factor = isReversed ? 1 / conversion.factor : conversion.factor
    const fromUnit = isReversed ? conversion.toUnit : conversion.fromUnit
    const toUnit = isReversed ? conversion.fromUnit : conversion.toUnit

    sendSuccess(res, {
      fromQuantity: quantity,
      toQuantity: quantity * factor,
      conversionRate: factor,
      fromUnit,
      toUnit,
    })
  })
)

// ============================================================
// Unit Conversions
// ============================================================

/** PUT /api/units/:id — Update custom unit */
router.put(
  '/:id',
  requirePermission('inventory.edit'),
  validate(updateUnitSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const unitId = String(req.params.id)
    const unit = await unitService.updateUnit(businessId, unitId, req.body)
    sendSuccess(res, { unit })
  })
)

/** DELETE /api/units/:id — Delete custom unit */
router.delete(
  '/:id',
  requirePermission('inventory.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
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
    const businessId = req.user!.businessId
    const conversions = await unitService.listConversions(businessId)
    sendSuccess(res, conversions)
  })
)

/** POST /api/unit-conversions — Create conversion (both directions) */
router.post(
  '/conversions',
  requirePermission('inventory.edit'),
  validate(createConversionSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const conversion = await unitService.createConversion(businessId, req.body)
    sendSuccess(res, { conversion }, 201)
  })
)

/** PUT /api/unit-conversions/:id — Update conversion factor */
router.put(
  '/conversions/:id',
  requirePermission('inventory.edit'),
  validate(updateConversionSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const conversionId = String(req.params.id)
    const conversion = await unitService.updateConversion(businessId, conversionId, req.body)
    sendSuccess(res, { conversion })
  })
)

/** DELETE /api/unit-conversions/:id — Delete conversion (both directions) */
router.delete(
  '/conversions/:id',
  requirePermission('inventory.edit'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const conversionId = String(req.params.id)
    const result = await unitService.deleteConversion(businessId, conversionId)
    sendSuccess(res, result)
  })
)

export default router
