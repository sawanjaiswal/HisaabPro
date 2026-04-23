/**
 * Document CRUD sub-router
 * GET list · GET recycle-bin · GET :id · POST / · PUT :id · DELETE /recycle-bin · DELETE :id
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { replayProtection } from '../../middleware/replay-protection.js'
import { idempotencyCheck } from '../../middleware/idempotency.js'
import { requirePermission } from '../../middleware/permission.js'
import { requireQuota } from '../../middleware/subscription-gate.js'
import { sendSuccess } from '../../lib/response.js'
import {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsSchema,
  recycleBinSchema,
} from '../../schemas/document.schemas.js'
import * as documentService from '../../services/document.service.js'

const router = Router()

/** GET /api/documents — List documents (filtered by type) */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = listDocumentsSchema.parse(req.query)
    const result = await documentService.listDocuments(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/documents/recycle-bin — List deleted documents */
router.get(
  '/recycle-bin',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const query = recycleBinSchema.parse(req.query)
    const result = await documentService.listRecycleBin(businessId, query)
    sendSuccess(res, result)
  })
)

/** GET /api/documents/:id — Get document detail */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const doc = await documentService.getDocument(businessId, String(req.params.id))
    sendSuccess(res, doc)
  })
)

/** POST /api/documents — Create document */
router.post(
  '/',
  requireQuota('invoices'),
  requirePermission('invoicing.create'),
  replayProtection,
  idempotencyCheck(),
  validate(createDocumentSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const doc = await documentService.createDocument(businessId, req.user!.userId, req.body)
    sendSuccess(res, doc, 201)
  })
)

/** PUT /api/documents/:id — Update document */
router.put(
  '/:id',
  requirePermission('invoicing.edit'),
  replayProtection,
  validate(updateDocumentSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const doc = await documentService.updateDocument(
      businessId, String(req.params.id), req.user!.userId, req.body
    )
    sendSuccess(res, doc)
  })
)

/** DELETE /api/documents/recycle-bin — Empty entire bin (MUST be before /:id) */
router.delete(
  '/recycle-bin',
  requirePermission('invoicing.delete'),
  replayProtection,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await documentService.emptyRecycleBin(businessId)
    sendSuccess(res, result)
  })
)

/** DELETE /api/documents/:id — Soft delete to recycle bin */
router.delete(
  '/:id',
  requirePermission('invoicing.delete'),
  replayProtection,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await documentService.deleteDocument(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, result)
  })
)

export default router
