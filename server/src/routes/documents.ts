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
  validateStockSchema,
} from '../schemas/document.schemas.js'
import { quickSaleSchema } from '../schemas/product.schemas.js'
import * as documentService from '../services/document.service.js'
import { validateStockForInvoice } from '../services/stock.service.js'
import { prisma } from '../lib/prisma.js'
import { notFoundError } from '../lib/errors.js'
import logger from '../lib/logger.js'
import { requirePermission } from '../middleware/permission.js'
import { requirePlan, requireQuota } from '../middleware/subscription-gate.js'
import { sendWhatsApp, sendEmail } from '../services/notification.service.js'
import { renderInvoiceShareEmail } from '../lib/email-templates.js'
import { generateInvoicePdf } from '../services/pdf.service.js'

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
  requirePermission('invoicing.view'),
  validate(validateStockSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { items } = req.body as { items: Array<{ productId: string; quantity: number; unitId: string }> }
    const result = await validateStockForInvoice(businessId, items)
    sendSuccess(res, result)
  })
)

/** POST /api/documents/quick-sale — Feature #110: POS one-shot sale + payment */
router.post(
  '/quick-sale',
  requirePlan('BUSINESS'),
  requirePermission('invoicing.create'),
  idempotencyCheck(),
  validate(quickSaleSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const userId = req.user!.userId
    const { items, paymentMode, amountPaid, partyId } = req.body as {
      items: Array<{ productId: string; quantity: number; price?: number }>
      paymentMode: string
      amountPaid: number
      partyId?: string
    }

    // Resolve party — use supplied or find/create walk-in customer
    let resolvedPartyId: string
    if (partyId) {
      const party = await prisma.party.findFirst({
        where: { id: partyId, businessId, isActive: true },
        select: { id: true },
      })
      if (!party) throw notFoundError('Party')
      resolvedPartyId = party.id
    } else {
      // Find or create a "Walk-in Customer" party for this business
      const walkinParty = await prisma.party.upsert({
        where: { businessId_phone: { businessId, phone: 'WALKIN' } },
        create: {
          businessId,
          name: 'Walk-in Customer',
          phone: 'WALKIN',
          type: 'CUSTOMER',
        },
        update: {},
        select: { id: true },
      })
      resolvedPartyId = walkinParty.id
    }

    // Resolve product prices for line items
    const productIds = items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId, status: 'ACTIVE' },
      select: { id: true, salePrice: true, name: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    // Build line items using product salePrice as fallback
    const lineItems = items.map((item) => {
      const product = productMap.get(item.productId)
      if (!product) throw notFoundError(`Product ${item.productId}`)
      return {
        productId: item.productId,
        quantity: item.quantity,
        rate: item.price ?? product.salePrice,
        discountType: 'AMOUNT' as const,
        discountValue: 0,
      }
    })

    // Create invoice (SAVED = auto generates number + deducts stock)
    const today = new Date().toISOString().split('T')[0]
    const invoice = await documentService.createDocument(businessId, userId, {
      type: 'SALE_INVOICE',
      status: 'SAVED',
      partyId: resolvedPartyId,
      documentDate: today,
      lineItems,
      additionalCharges: [],
      includeSignature: false,
    })

    const invoiceData = invoice as { id: string; grandTotal: number; balanceDue: number }

    // Create payment record in same business scope
    const payment = await prisma.$transaction(async (tx) => {
      const pmt = await tx.payment.create({
        data: {
          businessId,
          type: 'PAYMENT_IN',
          partyId: resolvedPartyId,
          amount: amountPaid,
          date: new Date(),
          mode: paymentMode,
          createdBy: userId,
        },
        select: { id: true, amount: true, mode: true, date: true },
      })

      // Allocate payment to invoice (capped at grandTotal)
      const allocationAmt = Math.min(amountPaid, invoiceData.grandTotal)
      if (allocationAmt > 0) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: pmt.id,
            invoiceId: invoiceData.id,
            amount: allocationAmt,
          },
        })

        // Update invoice paidAmount + balanceDue
        await tx.document.update({
          where: { id: invoiceData.id },
          data: {
            paidAmount: allocationAmt,
            balanceDue: Math.max(0, invoiceData.grandTotal - allocationAmt),
          },
        })
      }

      return pmt
    })

    const changeAmount = Math.max(0, amountPaid - invoiceData.grandTotal)

    sendSuccess(res, {
      invoice: {
        id: invoiceData.id,
        grandTotal: invoiceData.grandTotal,
      },
      payment: {
        id: payment.id,
        amount: payment.amount,
        mode: payment.mode,
        changeAmount,
      },
    }, 201)
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

// ============================================================
// Conversion
// ============================================================

/** POST /api/documents/:id/convert — Convert to target type */
router.post(
  '/:id/convert',
  requirePermission('invoicing.create'),
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
  requirePermission('invoicing.edit'),
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
  requirePermission('invoicing.delete'),
  replayProtection,
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    await documentService.permanentDeleteDocument(businessId, String(req.params.id))
    res.status(204).end()
  })
)

// ============================================================
// Sharing — WhatsApp (Aisensy) + Email (Resend)
// ============================================================

/** POST /api/documents/:id/share/whatsapp */
router.post(
  '/:id/share/whatsapp',
  requirePermission('invoicing.share'),
  replayProtection,
  validate(shareWhatsAppSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.id)

    // Verify document exists and get details for notification
    const doc = await documentService.getDocument(businessId, documentId)
    const docData = doc as {
      status: string
      documentNumber: string
      grandTotal: number
      party: { name: string }
    }

    // Create share log + update status atomically
    const { prisma } = await import('../lib/prisma.js')
    const shareLog = await prisma.$transaction(async (tx) => {
      const log = await tx.documentShareLog.create({
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
      if (docData.status === 'SAVED') {
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'SHARED' },
        })
      }

      return log
    })

    // Attempt WhatsApp delivery — don't let failure crash the route
    let deliveryResult: { success: boolean; error?: string } = { success: false }
    try {
      const amountRupees = (docData.grandTotal / 100).toFixed(2)
      deliveryResult = await sendWhatsApp({
        phone: req.body.recipientPhone,
        templateName: 'invoice_share',
        templateParams: [
          docData.party.name,
          docData.documentNumber,
          amountRupees,
        ],
      })
    } catch (err) {
      logger.error('WhatsApp share delivery error', {
        documentId,
        error: err instanceof Error ? err.message : err,
      })
    }

    sendSuccess(res, {
      shareLogId: shareLog.id,
      fileUrl: null,
      fileSize: null,
      delivered: deliveryResult.success,
      whatsappDeepLink: `https://wa.me/${req.body.recipientPhone}?text=${encodeURIComponent(req.body.message || '')}`,
    })
  })
)

/** POST /api/documents/:id/share/email */
router.post(
  '/:id/share/email',
  requirePermission('invoicing.share'),
  replayProtection,
  validate(shareEmailSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.id)
    const doc = await documentService.getDocument(businessId, documentId)
    const docData = doc as {
      status: string
      documentNumber: string
      grandTotal: number
      party: { name: string }
    }

    // Fetch business name for email template
    const { prisma } = await import('../lib/prisma.js')
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true },
    })

    // Create share log + update status atomically
    const shareLog = await prisma.$transaction(async (tx) => {
      const log = await tx.documentShareLog.create({
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

      if (docData.status === 'SAVED') {
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'SHARED' },
        })
      }

      return log
    })

    // Attempt email delivery — don't let failure crash the route
    let emailId: string | undefined
    try {
      const amountRupees = (docData.grandTotal / 100).toFixed(2)
      const html = req.body.body
        ?? renderInvoiceShareEmail({
          businessName: business.name,
          partyName: docData.party.name,
          invoiceNumber: docData.documentNumber,
          amount: `Rs ${amountRupees}`,
        })

      // Attempt PDF attachment (returns null until server-side renderer is ready)
      const pdfBuffer = await generateInvoicePdf(documentId, businessId)
      const attachments = pdfBuffer
        ? [{ filename: `${docData.documentNumber}.pdf`, content: pdfBuffer }]
        : undefined

      const emailResult = await sendEmail({
        to: req.body.recipientEmail,
        subject: req.body.subject,
        html,
        attachments,
      })
      emailId = emailResult.id
    } catch (err) {
      logger.error('Email share delivery error', {
        documentId,
        error: err instanceof Error ? err.message : err,
      })
    }

    sendSuccess(res, {
      shareLogId: shareLog.id,
      emailId: emailId ?? null,
      sentAt: shareLog.sentAt,
    })
  })
)

export default router
