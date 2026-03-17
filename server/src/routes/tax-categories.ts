/**
 * Tax Category Routes — thin layer, delegates to service
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { resolveBusinessId } from '../lib/business.js'
import { createTaxCategorySchema, updateTaxCategorySchema } from '../schemas/tax.schemas.js'
import * as svc from '../services/tax-category.service.js'

const router = Router()
router.use(auth)

/** GET / — List all tax categories for business */
router.get('/', asyncHandler(async (req, res) => {
  const businessId = await resolveBusinessId(req.user!.userId)
  const categories = await svc.listCategories(businessId, req.query.showInactive === 'true')
  sendSuccess(res, { categories })
}))

/** GET /:id — Get single tax category */
router.get('/:id', asyncHandler(async (req, res) => {
  const businessId = await resolveBusinessId(req.user!.userId)
  const category = await svc.getCategory(String(req.params.id), businessId)
  if (!category) return sendSuccess(res, null, 404)
  sendSuccess(res, { category })
}))

/** POST /seed-defaults — Seed default GST categories if none exist */
router.post('/seed-defaults', asyncHandler(async (req, res) => {
  const businessId = await resolveBusinessId(req.user!.userId)
  const result = await svc.seedDefaults(businessId)
  sendSuccess(res, result, result.seeded ? 201 : 200)
}))

/** POST / — Create tax category */
router.post('/', validate(createTaxCategorySchema), asyncHandler(async (req, res) => {
  const businessId = await resolveBusinessId(req.user!.userId)
  const category = await svc.createCategory(businessId, req.body)
  sendSuccess(res, { category }, 201)
}))

/** PUT /:id — Update tax category */
router.put('/:id', validate(updateTaxCategorySchema), asyncHandler(async (req, res) => {
  const businessId = await resolveBusinessId(req.user!.userId)
  const category = await svc.updateCategory(String(req.params.id), businessId, req.body)
  if (!category) return sendSuccess(res, null, 404)
  sendSuccess(res, { category })
}))

/** DELETE /:id — Soft-delete (set isActive = false) */
router.delete('/:id', asyncHandler(async (req, res) => {
  const businessId = await resolveBusinessId(req.user!.userId)
  const deleted = await svc.softDeleteCategory(String(req.params.id), businessId)
  if (!deleted) return sendSuccess(res, null, 404)
  sendSuccess(res, { deleted: true })
}))

export default router
