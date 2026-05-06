/**
 * E-Invoice Routes — Generate (201/200 idempotent), Cancel, Get.
 * Auth + plan gate + nic-rate-limit + Zod validation.
 * MB-1: IRN always loaded from DB, never from request body.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { requirePermission } from '../middleware/permission.js'
import { requirePlan } from '../middleware/subscription-gate.js'
import { sendSuccess } from '../lib/response.js'
import { nicRateLimit } from '../middleware/nic-rate-limit.js'
import { generateEInvoiceSchema, cancelEInvoiceSchema } from '../schemas/ecompliance.schemas.js'
import * as svc from '../services/einvoice/einvoice.service.js'

const router = Router()
router.use(auth)
router.use(requirePlan('BUSINESS'))
router.use(nicRateLimit)

/** POST /api/einvoice/generate — 201 fresh, 200 idempotent */
router.post(
  '/generate',
  requirePermission('invoicing.edit'),
  validate(generateEInvoiceSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const { documentId } = req.body as { documentId: string }
    const { eInvoice, isIdempotent } = await svc.generateIrn(documentId, businessId, userId)
    sendSuccess(res, eInvoice, isIdempotent ? 200 : 201)
  })
)

/** POST /api/einvoice/cancel — reason: 1|2|3|4, remarks: string ≤100 */
router.post(
  '/cancel',
  requirePermission('invoicing.edit'),
  validate(cancelEInvoiceSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const { documentId, reason, remarks } = req.body as {
      documentId: string
      reason: 1 | 2 | 3 | 4
      remarks: string
    }
    const eInvoice = await svc.cancelIrn(documentId, businessId, userId, reason, remarks)
    sendSuccess(res, eInvoice)
  })
)

/** GET /api/einvoice/:documentId */
router.get(
  '/:documentId',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const eInvoice = await svc.getEInvoice(String(req.params.documentId), businessId)
    sendSuccess(res, eInvoice)
  })
)

export default router
