/**
 * Document Routes — CRUD, conversion, recycle bin, sharing stubs
 * All routes require auth. businessId resolved from user's active BusinessUser record.
 */

import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { validate } from '../middleware/validate.js'
import { auth } from '../middleware/auth.js'
import { sendSuccess } from '../lib/response.js'
import { idempotencyCheck } from '../middleware/idempotency.js'
import { replayProtection } from '../middleware/replay-protection.js'
import {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsSchema,
  convertDocumentSchema,
  recycleBinSchema,
  shareWhatsAppSchema,
  shareEmailSchema,
} from '../schemas/document.schemas.js'
import * as documentService from '../services/document.service.js'
import { validateStockForInvoice } from '../services/stock.service.js'

const router = Router()

router.use(auth)

// ============================================================
// Document CRUD
// ============================================================

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

/** POST /api/documents/validate-stock — Pre-save stock availability check */
router.post(
  '/validate-stock',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const items = (req.body.items ?? []) as Array<{ productId: string; quantity: number; unitId: string }>
    const result = await validateStockForInvoice(businessId, items)
    sendSuccess(res, result)
  })
)

/** POST /api/documents — Create document */
router.post(
  '/',
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

/** DELETE /api/documents/:id — Soft delete to recycle bin */
router.delete(
  '/:id',
  replayProtection,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await documentService.deleteDocument(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, result)
  })
)

// ============================================================
// Conversion
// ============================================================

/** POST /api/documents/:id/convert — Convert to target type */
router.post(
  '/:id/convert',
  replayProtection,
  idempotencyCheck(),
  validate(convertDocumentSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const doc = await documentService.convertDocument(
      businessId, String(req.params.id), req.user!.userId, req.body
    )
    sendSuccess(res, doc, 201)
  })
)

// ============================================================
// Recycle Bin Operations
// ============================================================

/** POST /api/documents/:id/restore — Restore from recycle bin */
router.post(
  '/:id/restore',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const doc = await documentService.restoreDocument(
      businessId, String(req.params.id), req.user!.userId
    )
    sendSuccess(res, doc)
  })
)

/** DELETE /api/documents/:id/permanent — Hard delete */
router.delete(
  '/:id/permanent',
  replayProtection,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    await documentService.permanentDeleteDocument(businessId, String(req.params.id))
    res.status(204).end()
  })
)

/** DELETE /api/documents/recycle-bin — Empty entire bin */
router.delete(
  '/recycle-bin',
  replayProtection,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const result = await documentService.emptyRecycleBin(businessId)
    sendSuccess(res, result)
  })
)

// ============================================================
// Sharing (stubs — full implementation in Phase 2 with PDF/image gen)
// ============================================================

/** POST /api/documents/:id/share/whatsapp */
router.post(
  '/:id/share/whatsapp',
  replayProtection,
  validate(shareWhatsAppSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.id)

    // Verify document exists
    const doc = await documentService.getDocument(businessId, documentId)

    // Create share log
    const { prisma } = await import('../lib/prisma.js')
    const shareLog = await prisma.documentShareLog.create({
      data: {
        documentId,
        channel: 'WHATSAPP',
        format: req.body.format === 'IMAGE' ? 'JPG' : 'PDF',
        recipientPhone: req.body.recipientPhone,
        message: req.body.message || null,
        sentBy: req.user!.userId,
      },
      select: { id: true, sentAt: true },
    })

    // Update document status to SHARED if currently SAVED
    if ((doc as { status: string }).status === 'SAVED') {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'SHARED' },
      })
    }

    sendSuccess(res, {
      shareLogId: shareLog.id,
      fileUrl: null, // PDF/image gen in Phase 2
      fileSize: null,
      whatsappDeepLink: `https://wa.me/${req.body.recipientPhone}?text=${encodeURIComponent(req.body.message || '')}`,
    })
  })
)

/** POST /api/documents/:id/share/email */
router.post(
  '/:id/share/email',
  replayProtection,
  validate(shareEmailSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.id)
    const doc = await documentService.getDocument(businessId, documentId)

    const { prisma } = await import('../lib/prisma.js')
    const shareLog = await prisma.documentShareLog.create({
      data: {
        documentId,
        channel: 'EMAIL',
        format: 'PDF',
        recipientEmail: req.body.recipientEmail,
        message: req.body.body || null,
        sentBy: req.user!.userId,
      },
      select: { id: true, sentAt: true },
    })

    if ((doc as { status: string }).status === 'SAVED') {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'SHARED' },
      })
    }

    sendSuccess(res, {
      shareLogId: shareLog.id,
      emailId: null, // Email sending in Phase 2
      sentAt: shareLog.sentAt,
    })
  })
)

export default router
