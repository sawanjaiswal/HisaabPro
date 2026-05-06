/**
 * E-Invoice public service API.
 * MB-1: EInvoice always scoped by businessId — 404 if cross-tenant.
 * MB-4: AuditLog writes use maskGstin().
 * Quota: 1000/day soft-warn at 950.
 * 24h cancel window enforced.
 */

import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { createAuditEntry } from '../settings/audit.js'
import { maskGstin, EINVOICE_ERRORS } from './einvoice.errors.js'
import { buildIrnEnvelope } from './einvoice.envelope.js'
import { generateViaClient, cancelViaClient } from './einvoice.nic-client.js'
import { isStubMode } from './einvoice.token-store.js'
import type { Prisma } from '@prisma/client'

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000
const QUOTA_HARD = 1000
const QUOTA_WARN = 950

// ─── Quota check (daily count via Prisma aggregate) ──────────────────────────

async function checkDailyQuota(businessId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const count = await prisma.eInvoice.count({
    where: { document: { businessId }, createdAt: { gte: today } },
  })
  if (count >= QUOTA_HARD) {
    throw new AppError(ErrorCode.RATE_LIMITED, 429, 'Daily e-invoice quota (1000) exceeded', {
      code: EINVOICE_ERRORS.QUOTA_EXCEEDED,
    })
  }
  if (count >= QUOTA_WARN) {
    logger.warn('EINVOICE_QUOTA_WARN', { businessId, count })
  }
}

// ─── Generate IRN ─────────────────────────────────────────────────────────────

export async function generateIrn(
  documentId: string,
  businessId: string,
  userId: string
): Promise<{ eInvoice: Awaited<ReturnType<typeof prisma.eInvoice.upsert>>; isIdempotent: boolean }> {
  // Load document with full relations (businessId scoped)
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    include: {
      party: { select: { gstin: true, name: true, stateCode: true } },
      business: { select: { gstin: true, name: true, address: true, stateCode: true } },
      eInvoice: true,
      lineItems: {
        select: {
          productId: true, quantity: true, rate: true, lineTotal: true,
          taxableValue: true, cgstRate: true, cgstAmount: true,
          sgstRate: true, sgstAmount: true, igstRate: true, igstAmount: true,
          cessRate: true, cessAmount: true,
          product: { select: { name: true, hsnCode: true } },
        },
      },
    },
  })

  if (!doc) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Document not found')

  if (doc.type !== 'SALE_INVOICE') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'E-Invoice only for SALE_INVOICE', {
      code: EINVOICE_ERRORS.DOCUMENT_NOT_ELIGIBLE,
    })
  }
  if (doc.status !== 'SAVED' && doc.status !== 'SHARED') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Document must be in SAVED or SHARED status')
  }

  // Idempotent — already generated
  if (doc.eInvoice?.status === 'GENERATED') {
    return { eInvoice: doc.eInvoice, isIdempotent: true }
  }

  await checkDailyQuota(businessId)

  const envelope = buildIrnEnvelope({
    documentId: doc.id,
    documentNumber: doc.documentNumber ?? doc.id,
    documentDate: doc.documentDate,
    supplyType: doc.supplyType,
    isReverseCharge: doc.isReverseCharge,
    placeOfSupply: doc.placeOfSupply,
    grandTotal: doc.grandTotal,
    totalTaxableValue: doc.totalTaxableValue,
    totalCgst: doc.totalCgst,
    totalSgst: doc.totalSgst,
    totalIgst: doc.totalIgst,
    totalCess: doc.totalCess,
    business: doc.business,
    party: doc.party,
    lines: doc.lineItems.map((li) => ({
      productName: li.product.name,
      hsnCode: li.product.hsnCode,
      quantity: li.quantity,
      rate: li.rate,
      taxableValue: li.taxableValue,
      cgstRate: li.cgstRate,
      cgstAmount: li.cgstAmount,
      sgstRate: li.sgstRate,
      sgstAmount: li.sgstAmount,
      igstRate: li.igstRate,
      igstAmount: li.igstAmount,
      cessRate: li.cessRate,
      cessAmount: li.cessAmount,
      lineTotal: li.lineTotal,
    })),
  })

  const reqId = crypto.randomUUID()
  if (isStubMode()) logger.warn('EINVOICE_STUB_MODE', { once: true })

  const nicResult = await generateViaClient(businessId, envelope, reqId)

  const eInvoice = await prisma.eInvoice.upsert({
    where: { documentId },
    create: {
      documentId,
      irn: nicResult.irn,
      ackNumber: nicResult.ackNumber,
      ackDate: new Date(nicResult.ackDate),
      qrCodeData: nicResult.signedQrCode,
      signedInvoice: nicResult.signedInvoice as unknown as Prisma.InputJsonValue,
      status: 'GENERATED',
    },
    update: {
      irn: nicResult.irn,
      ackNumber: nicResult.ackNumber,
      ackDate: new Date(nicResult.ackDate),
      qrCodeData: nicResult.signedQrCode,
      signedInvoice: nicResult.signedInvoice as unknown as Prisma.InputJsonValue,
      status: 'GENERATED',
      cancelReason: null,
      cancelledAt: null,
    },
  })

  await createAuditEntry({
    businessId,
    action: 'EINVOICE_GENERATED',
    entityType: 'EInvoice',
    entityId: eInvoice.id,
    entityLabel: nicResult.irn,
    userId,
    changes: {
      irn: nicResult.irn,
      sellerGstin: maskGstin(doc.business.gstin), // MB-4
      buyerGstin: maskGstin(doc.party.gstin),     // MB-4
      documentNumber: doc.documentNumber,
    },
  })

  logger.info('EINVOICE_GENERATED', { businessId, documentId, irn: nicResult.irn, stub: isStubMode() })
  return { eInvoice, isIdempotent: false }
}

// ─── Cancel IRN ───────────────────────────────────────────────────────────────

export async function cancelIrn(
  documentId: string,
  businessId: string,
  userId: string,
  reason: 1 | 2 | 3 | 4,
  remarks: string
): Promise<ReturnType<typeof prisma.eInvoice.update>> {
  // MB-1: Load EInvoice through Document scoped by businessId — NEVER read IRN from body
  const record = await prisma.eInvoice.findFirst({
    where: { document: { id: documentId, businessId } },
  })
  if (!record) throw new AppError(ErrorCode.NOT_FOUND, 404, 'E-Invoice not found')

  if (record.status === 'CANCELLED') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'E-Invoice already cancelled', {
      code: EINVOICE_ERRORS.ALREADY_CANCELLED,
    })
  }

  // 24h cancel window
  if (Date.now() - record.ackDate.getTime() > CANCEL_WINDOW_MS) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Cancel window expired (24h)', {
      code: EINVOICE_ERRORS.CANCEL_WINDOW_EXPIRED,
    })
  }

  const reqId = crypto.randomUUID()
  // IRN comes from DB (MB-1), never from request
  await cancelViaClient(businessId, record.irn, reason, remarks, reqId)

  const updated = await prisma.eInvoice.update({
    where: { id: record.id },
    data: { status: 'CANCELLED', cancelReason: String(reason), cancelledAt: new Date() },
  })

  // Load business GSTIN for audit masking
  const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { gstin: true } })

  await createAuditEntry({
    businessId,
    action: 'EINVOICE_CANCELLED',
    entityType: 'EInvoice',
    entityId: record.id,
    entityLabel: record.irn,
    userId,
    changes: {
      irn: record.irn,
      reason,
      remarks,
      sellerGstin: maskGstin(biz?.gstin), // MB-4
    },
  })

  logger.info('EINVOICE_CANCELLED', { businessId, documentId, irn: record.irn })
  return updated
}

// ─── Get E-Invoice ────────────────────────────────────────────────────────────

export async function getEInvoice(documentId: string, businessId: string) {
  const record = await prisma.eInvoice.findFirst({
    where: { document: { id: documentId, businessId } },
  })
  if (!record) throw new AppError(ErrorCode.NOT_FOUND, 404, 'E-Invoice not found')
  return record
}
