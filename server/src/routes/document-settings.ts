/**
 * Document Settings Routes — document config, signatures, T&C templates, number series
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import {
  updateDocumentSettingsSchema,
  createTermsTemplateSchema,
  updateTermsTemplateSchema,
  updateNumberSeriesSchema,
} from '../schemas/document.schemas.js'
import * as settingsService from '../services/document-settings.service.js'
import { getNextNumberPreview } from '../services/document-number.service.js'

const router = Router()

router.use(auth)

// ============================================================
// Document Settings
// ============================================================

/** GET /api/settings/documents — Get document settings */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const settings = await settingsService.getDocumentSettings(businessId)
    sendSuccess(res, settings)
  })
)

/** PUT /api/settings/documents — Update document settings */
router.put(
  '/',
  validate(updateDocumentSettingsSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const settings = await settingsService.updateDocumentSettings(businessId, req.body)
    sendSuccess(res, settings)
  })
)

// ============================================================
// Digital Signature
// ============================================================

/** GET /api/settings/documents/signature — Get signature */
router.get(
  '/signature',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const signature = await settingsService.getSignature(businessId)
    sendSuccess(res, signature)
  })
)

/** POST /api/settings/documents/signature — Upload/update signature */
router.post(
  '/signature',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const signature = await settingsService.upsertSignature(businessId, req.body)
    sendSuccess(res, signature, 201)
  })
)

/** DELETE /api/settings/documents/signature — Delete signature */
router.delete(
  '/signature',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    await settingsService.deleteSignature(businessId)
    res.status(204).end()
  })
)

// ============================================================
// Terms & Conditions Templates
// ============================================================

/** GET /api/settings/documents/terms-templates — List all templates */
router.get(
  '/terms-templates',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const templates = await settingsService.listTermsTemplates(businessId)
    sendSuccess(res, templates)
  })
)

/** POST /api/settings/documents/terms-templates — Create template */
router.post(
  '/terms-templates',
  validate(createTermsTemplateSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const template = await settingsService.createTermsTemplate(businessId, req.body)
    sendSuccess(res, template, 201)
  })
)

/** PUT /api/settings/documents/terms-templates/:id — Update template */
router.put(
  '/terms-templates/:id',
  validate(updateTermsTemplateSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const template = await settingsService.updateTermsTemplate(
      businessId, String(req.params.id), req.body
    )
    sendSuccess(res, template)
  })
)

/** DELETE /api/settings/documents/terms-templates/:id — Delete template */
router.delete(
  '/terms-templates/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    await settingsService.deleteTermsTemplate(businessId, String(req.params.id))
    res.status(204).end()
  })
)

// ============================================================
// Document Number Series
// ============================================================

/** GET /api/settings/documents/number-series/:type/next — Preview next number */
router.get(
  '/number-series/:type/next',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const preview = await getNextNumberPreview(businessId, String(req.params.type))
    sendSuccess(res, preview)
  })
)

/** PUT /api/settings/documents/number-series/:type — Configure number series */
router.put(
  '/number-series/:type',
  validate(updateNumberSeriesSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const series = await settingsService.updateNumberSeries(
      businessId, String(req.params.type), req.body
    )
    sendSuccess(res, series)
  })
)

export default router
