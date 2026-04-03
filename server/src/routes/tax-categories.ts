/**
 * Tax Category Routes — thin layer, delegates to service
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { createTaxCategorySchema, updateTaxCategorySchema } from '../schemas/tax.schemas.js'
import * as svc from '../services/tax-category.service.js'

const router = Router()
router.use(auth)

/** GET / — List all tax categories for business */
router.get('/', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const categories = await svc.listCategories(businessId, req.query.showInactive === 'true')
  sendSuccess(res, { categories })
}))

/** GET /:id — Get single tax category */
router.get('/:id', asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const category = await svc.getCategory(String(req.params.id), businessId)
  if (!category) return sendError(res, 'Tax category not found', 'NOT_FOUND', 404)
  sendSuccess(res, { category })
}))

/** POST /seed-defaults — Seed default GST categories if none exist */
router.post('/seed-defaults', requirePermission('settings.modify'), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const result = await svc.seedDefaults(businessId)
  sendSuccess(res, result, result.seeded ? 201 : 200)
}))

/** POST / — Create tax category */
router.post('/', requirePermission('settings.modify'), validate(createTaxCategorySchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const category = await svc.createCategory(businessId, req.body)
  sendSuccess(res, { category }, 201)
}))

/** PUT /:id — Update tax category */
router.put('/:id', requirePermission('settings.modify'), validate(updateTaxCategorySchema), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const category = await svc.updateCategory(String(req.params.id), businessId, req.body)
  if (!category) return sendError(res, 'Tax category not found', 'NOT_FOUND', 404)
  sendSuccess(res, { category })
}))

/** DELETE /:id — Soft-delete (set isActive = false) */
router.delete('/:id', requirePermission('settings.modify'), asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId
  const deleted = await svc.softDeleteCategory(String(req.params.id), businessId)
  if (!deleted) return sendError(res, 'Tax category not found', 'NOT_FOUND', 404)
  sendSuccess(res, { deleted: true })
}))

export default router
