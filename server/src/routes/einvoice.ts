/**
 * E-Invoice Routes — Generate, cancel, and retrieve IRN
 *
 * POST /api/einvoice/generate   { documentId }
 * POST /api/einvoice/cancel     { documentId, reason }
 * GET  /api/einvoice/:documentId
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { sendSuccess } from '../lib/response.js'
import { generateEInvoiceSchema, cancelEInvoiceSchema } from '../schemas/ecompliance.schemas.js'
import * as einvoiceService from '../services/einvoice.service.js'

const router = Router()
router.use(auth)

/** POST /api/einvoice/generate — Generate IRN for a saved sale invoice */
router.post(
  '/generate',
  requirePermission('invoicing.edit'),
  validate(generateEInvoiceSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { documentId } = req.body as { documentId: string }
    const eInvoice = await einvoiceService.generateIrn(businessId, documentId)
    sendSuccess(res, eInvoice, 201)
  })
)

/** POST /api/einvoice/cancel — Cancel an IRN within 24 hours */
router.post(
  '/cancel',
  requirePermission('invoicing.edit'),
  validate(cancelEInvoiceSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { documentId, reason } = req.body as { documentId: string; reason: string }
    const eInvoice = await einvoiceService.cancelIrn(businessId, documentId, reason)
    sendSuccess(res, eInvoice)
  })
)

/** GET /api/einvoice/:documentId — Retrieve e-invoice record */
router.get(
  '/:documentId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const eInvoice = await einvoiceService.getEInvoice(businessId, String(req.params.documentId))
    sendSuccess(res, eInvoice)
  })
)

export default router
