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
import { notificationManager } from '../../services/notifications/notification-manager.js'
import { formatPaise } from '../../services/notifications/notification-template.service.js'
import { touchLastContacted } from '../../services/party/last-contacted.service.js'

const router = Router()

type DocMeta = {
  status: string
  documentNumber: string
  grandTotal: number
  party: { id: string; name: string; phone: string | null; email: string | null }
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

      // CRM #127 — touch lastContactedAt in the same tx (architecture §3.4).
      await touchLastContacted(businessId, docData.party.id, tx)

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

    try {
      await notificationManager.notify('INVOICE_SHARED', {
        businessId,
        userId: req.user!.userId,
        eventKey: 'INVOICE_SHARED',
        locale: 'en',
        vars: {
          invoiceNo: docData.documentNumber,
          partyName: docData.party.name,
          totalRs: formatPaise(Number(docData.grandTotal)),
          channel: 'whatsapp',
        },
        entityType: 'invoice',
        entityId: documentId,
      })
    } catch (err) {
      logger.warn('notify.failed', { eventKey: 'INVOICE_SHARED', err })
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

      // CRM #127 — touch lastContactedAt in the same tx (architecture §3.4).
      await touchLastContacted(businessId, docData.party.id, tx)

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

      // PDF is rendered client-side (React-PDF) and uploaded as base64 — the
      // server has no PDF renderer (#32). Falls back to a link-only email when
      // the client could not attach one.
      const attachments = req.body.pdfBase64
        ? [{ filename: `${docData.documentNumber}.pdf`, content: Buffer.from(req.body.pdfBase64, 'base64') }]
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

    try {
      await notificationManager.notify('INVOICE_SHARED', {
        businessId,
        userId: req.user!.userId,
        eventKey: 'INVOICE_SHARED',
        locale: 'en',
        vars: {
          invoiceNo: docData.documentNumber,
          partyName: docData.party.name,
          totalRs: formatPaise(Number(docData.grandTotal)),
          channel: 'email',
        },
        entityType: 'invoice',
        entityId: documentId,
      })
    } catch (err) {
      logger.warn('notify.failed', { eventKey: 'INVOICE_SHARED', err })
    }

    sendSuccess(res, {
      shareLogId: shareLog.id,
      emailId: emailId ?? null,
      sentAt: shareLog.sentAt,
    })
  })
)

export default router
