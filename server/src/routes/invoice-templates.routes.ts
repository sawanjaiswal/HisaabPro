/**
 * Invoice Templates Routes — /api/templates
 *
 * All routes behind `auth`. Writes gated by requirePermission('settings.modify')
 * + userMutationLimiter (per-user). create/duplicate carry idempotencyCheck()
 * for offline-replay safety. Responses use sendSuccess → { success, data }; the
 * shipped FE `template.service.ts` unwraps `data` directly.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { userMutationLimiter } from '../middleware/rate-limit/index.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { FEATURES } from '../config/features.js'
import {
  createTemplateSchema,
  updateTemplateSchema,
  setDefaultSchema,
} from '../schemas/invoice-template.schema.js'
import * as crud from '../services/invoice-template/template-crud.service.js'
import { setDefaultTemplate } from '../services/invoice-template/template-default.service.js'

const router = Router()

router.use(auth)

/** Feature gate — dark-launch off returns 404 (route effectively absent). */
router.use((_req, res, next) => {
  if (!FEATURES.INVOICE_TEMPLATES.enabled) {
    sendError(res, 'Not found.', 'NOT_FOUND', 404)
    return
  }
  next()
})

/** GET /api/templates — summaries (no config). */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const data = await crud.listTemplates(req.user!.businessId)
    sendSuccess(res, data)
  }),
)

/** GET /api/templates/:id — full entity. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await crud.getTemplate(req.user!.businessId, String(req.params.id))
    sendSuccess(res, data)
  }),
)

/** POST /api/templates — create (idempotent, capped). */
router.post(
  '/',
  requirePermission('settings.modify'),
  userMutationLimiter,
  idempotencyCheck(),
  validate(createTemplateSchema),
  asyncHandler(async (req, res) => {
    const data = await crud.createTemplate(req.user!.businessId, req.user!.userId, req.body)
    sendSuccess(res, data, 201)
  }),
)

/** PUT /api/templates/:id — partial merge. */
router.put(
  '/:id',
  requirePermission('settings.modify'),
  userMutationLimiter,
  validate(updateTemplateSchema),
  asyncHandler(async (req, res) => {
    const data = await crud.updateTemplate(
      req.user!.businessId,
      req.user!.userId,
      String(req.params.id),
      req.body,
    )
    sendSuccess(res, data)
  }),
)

/** DELETE /api/templates/:id — soft-delete. */
router.delete(
  '/:id',
  requirePermission('settings.modify'),
  userMutationLimiter,
  asyncHandler(async (req, res) => {
    const data = await crud.softDeleteTemplate(
      req.user!.businessId,
      req.user!.userId,
      String(req.params.id),
    )
    sendSuccess(res, data)
  }),
)

/** POST /api/templates/:id/duplicate — clone (idempotent). */
router.post(
  '/:id/duplicate',
  requirePermission('settings.modify'),
  userMutationLimiter,
  idempotencyCheck(),
  asyncHandler(async (req, res) => {
    const data = await crud.duplicateTemplate(
      req.user!.businessId,
      req.user!.userId,
      String(req.params.id),
    )
    sendSuccess(res, data, 201)
  }),
)

/** POST /api/templates/:id/set-default — per-document-type default. */
router.post(
  '/:id/set-default',
  requirePermission('settings.modify'),
  userMutationLimiter,
  validate(setDefaultSchema),
  asyncHandler(async (req, res) => {
    const data = await setDefaultTemplate(
      req.user!.businessId,
      req.user!.userId,
      String(req.params.id),
      req.body.documentTypes,
    )
    sendSuccess(res, data)
  }),
)

export default router
