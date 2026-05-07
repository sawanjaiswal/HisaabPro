/**
 * Expense Templates Routes
 * Mount: under /api/expenses (see expenses.ts)
 * All routes require auth + accounting permissions.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { requirePermission } from '../middleware/permission.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { sendSuccess } from '../lib/response.js'
import {
  createTemplateSchema,
  updateTemplateSchema,
} from '../schemas/expenses-upgrade.schemas.js'
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deactivateTemplate,
} from '../services/expense/expense-template.service.js'

const router = Router()

/** POST /templates — create recurring template (201) */
router.post(
  '/',
  idempotencyCheck(),
  requirePermission('accounting.create'),
  validate(createTemplateSchema),
  asyncHandler(async (req, res) => {
    const { businessId, userId } = req.user!
    const template = await createTemplate(businessId, userId, req.body)
    sendSuccess(res, template, 201)
  }),
)

/** GET /templates — list active templates (200) */
router.get(
  '/',
  requirePermission('accounting.read'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const templates = await listTemplates(businessId)
    sendSuccess(res, templates)
  }),
)

/** GET /templates/:id — single template (200) */
router.get(
  '/:id',
  requirePermission('accounting.read'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const template = await getTemplate(businessId, String(req.params.id))
    sendSuccess(res, template)
  }),
)

/** PATCH /templates/:id — partial update (200) */
router.patch(
  '/:id',
  idempotencyCheck(),
  requirePermission('accounting.create'),
  validate(updateTemplateSchema),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const template = await updateTemplate(businessId, String(req.params.id), req.body)
    sendSuccess(res, template)
  }),
)

/** DELETE /templates/:id — soft-deactivate (200) */
router.delete(
  '/:id',
  requirePermission('accounting.create'),
  asyncHandler(async (req, res) => {
    const { businessId } = req.user!
    const result = await deactivateTemplate(businessId, String(req.params.id))
    sendSuccess(res, result)
  }),
)

export default router
