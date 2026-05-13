/**
 * #134 — Document Custom Field values sub-router
 * GET  /api/documents/:id/custom-fields  — list values + field defs
 * PUT  /api/documents/:id/custom-fields  — bulk upsert values
 */

import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { replayProtection } from '../../middleware/replay-protection.js'
import { requirePermission } from '../../middleware/permission.js'
import { sendSuccess } from '../../lib/response.js'
import { prisma } from '../../lib/prisma.js'
import { notFoundError } from '../../lib/errors.js'
import {
  listDocumentCustomFields,
  persistDocumentCustomFieldValues,
} from '../../services/document/custom-fields.js'

const router = Router()

const putDocumentCustomFieldsSchema = z.object({
  values: z.array(z.object({
    fieldDefId: z.string().min(1),
    valueJson: z.unknown(),
  })).max(50),
})

router.get(
  '/:id/custom-fields',
  requirePermission('invoicing.view'),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.id)
    const values = await listDocumentCustomFields(businessId, documentId)
    sendSuccess(res, { values })
  }),
)

router.put(
  '/:id/custom-fields',
  requirePermission('invoicing.edit'),
  replayProtection,
  validate(putDocumentCustomFieldsSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.id)

    const doc = await prisma.document.findFirst({
      where: { id: documentId, businessId },
      select: { id: true, type: true },
    })
    if (!doc) throw notFoundError('Document')

    await prisma.$transaction(async (tx) => {
      await persistDocumentCustomFieldValues(tx, {
        businessId,
        documentId,
        documentType: doc.type,
        values: req.body.values,
      })
    })

    const values = await listDocumentCustomFields(businessId, documentId)
    sendSuccess(res, { values })
  }),
)

export default router
