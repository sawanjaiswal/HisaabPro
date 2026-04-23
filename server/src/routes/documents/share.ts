/**
 * Document sharing sub-router — WhatsApp (Aisensy) + Email (Resend)
 * POST :id/share/whatsapp · POST :id/share/email
 */

import { Router } from 'express'
import { asyncHandler } from '../../middleware/asyncHandler.js'
import { validate } from '../../middleware/validate.js'
import { replayProtection } from '../../middleware/replay-protection.js'
import { requirePermission } from '../../middleware/permission.js'
import { sendSuccess } from '../../lib/response.js'
import { shareWhatsAppSchema, shareEmailSchema } from '../../schemas/document.schemas.js'
import * as documentService from '../../services/document.service.js'
import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { sendWhatsApp, sendEmail } from '../../services/notification.service.js'
import { renderInvoiceShareEmail } from '../../lib/email-templates.js'
import { generateInvoicePdf } from '../../services/pdf.service.js'

const router = Router()

type DocMeta = {
  status: string
  documentNumber: string
  grandTotal: number
  party: { name: string }
}

/** POST /api/documents/:id/share/whatsapp */
router.post(
  '/:id/share/whatsapp',
  requirePermission('invoicing.share'),
  replayProtection,
  validate(shareWhatsAppSchema),
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const documentId = String(req.params.id)

    const doc = await documentService.getDocument(businessId, documentId)
    const docData = doc as DocMeta

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

      if (docData.status === 'SAVED') {
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'SHARED' },
        })
      }

      return log
    })

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
    const docData = doc as DocMeta

    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { name: true },
    })

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
