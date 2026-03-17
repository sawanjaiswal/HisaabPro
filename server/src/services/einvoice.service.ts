/**
 * E-Invoice Service — Generate, cancel, and retrieve IRN via NIC IRP.
 * All amounts in paise. Sandbox/mock mode in development.
 */

import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { validationError, notFoundError, conflictError } from '../lib/errors.js'
import {
  callNicIrpGenerate,
  callNicIrpCancel,
} from '../lib/nic-api.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours in ms

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a NIC-format JSON payload from the document and its relations.
 * In production this must conform to GST schema version 1.1.
 */
function buildNicPayload(doc: {
  id: string
  documentNumber: string | null
  documentDate: Date
  grandTotal: number
  totalTaxableValue: number
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalCess: number
  supplyType: string
  placeOfSupply: string | null
  isReverseCharge: boolean
  party: { gstin: string | null; name: string }
  business: { gstin: string | null; name: string }
}): Record<string, unknown> {
  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: doc.supplyType,
      RegRev: doc.isReverseCharge ? 'Y' : 'N',
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: doc.documentNumber ?? doc.id,
      Dt: doc.documentDate.toISOString().slice(0, 10).split('-').reverse().join('/'), // DD/MM/YYYY
    },
    SellerDtls: {
      Gstin: doc.business.gstin ?? '',
      LglNm: doc.business.name,
      Pos: doc.placeOfSupply ?? '',
    },
    BuyerDtls: {
      Gstin: doc.party.gstin ?? '',
      LglNm: doc.party.name,
      Pos: doc.placeOfSupply ?? '',
    },
    ValDtls: {
      AssVal: doc.totalTaxableValue,
      CgstVal: doc.totalCgst,
      SgstVal: doc.totalSgst,
      IgstVal: doc.totalIgst,
      CesVal: doc.totalCess,
      TotInvVal: doc.grandTotal,
    },
  }
}

// ─── Service functions ───────────────────────────────────────────────────────

export async function generateIrn(businessId: string, documentId: string) {
  // 1. Load document with party and business
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    include: {
      party: { select: { gstin: true, name: true } },
      business: { select: { gstin: true, name: true } },
      eInvoice: true,
    },
  })

  if (!doc) throw notFoundError('Document')

  // 2. Validate: SAVED, SALE_INVOICE, party has GSTIN (B2B only)
  if (doc.status !== 'SAVED') {
    throw validationError('E-Invoice can only be generated for saved documents')
  }
  if (doc.type !== 'SALE_INVOICE') {
    throw validationError('E-Invoice is only applicable to Sale Invoices')
  }
  if (!doc.party.gstin) {
    throw validationError('Party GSTIN is required for e-invoice generation (B2B only)')
  }
  if (!doc.business.gstin) {
    throw validationError('Business GSTIN must be configured before generating e-invoice')
  }

  // 3. Check not already generated
  if (doc.eInvoice && doc.eInvoice.status === 'GENERATED') {
    throw conflictError('E-Invoice has already been generated for this document')
  }

  // 4. Build NIC payload and call API
  const payload = buildNicPayload(doc)
  const nicResponse = await callNicIrpGenerate(payload)

  // 5. Upsert EInvoice record (handles the case where a previous cancelled record exists)
  const eInvoice = await prisma.eInvoice.upsert({
    where: { documentId },
    create: {
      documentId,
      irn: nicResponse.irn,
      ackNumber: nicResponse.ackNumber,
      ackDate: nicResponse.ackDate,
      qrCodeData: nicResponse.qrCodeData,
      signedInvoice: nicResponse.signedInvoice as unknown as Prisma.InputJsonValue,
      status: 'GENERATED',
      rawResponse: nicResponse.rawResponse as unknown as Prisma.InputJsonValue,
    },
    update: {
      irn: nicResponse.irn,
      ackNumber: nicResponse.ackNumber,
      ackDate: nicResponse.ackDate,
      qrCodeData: nicResponse.qrCodeData,
      signedInvoice: nicResponse.signedInvoice as unknown as Prisma.InputJsonValue,
      status: 'GENERATED',
      cancelReason: null,
      cancelledAt: null,
      rawResponse: nicResponse.rawResponse as unknown as Prisma.InputJsonValue,
    },
  })

  return eInvoice
}

export async function cancelIrn(businessId: string, documentId: string, reason: string) {
  // 1. Load document to confirm ownership
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    select: { id: true },
  })
  if (!doc) throw notFoundError('Document')

  // 2. Find active EInvoice
  const eInvoice = await prisma.eInvoice.findUnique({
    where: { documentId },
  })
  if (!eInvoice) throw notFoundError('E-Invoice')
  if (eInvoice.status !== 'GENERATED') {
    throw validationError('Only a generated e-invoice can be cancelled')
  }

  // 3. Check 24-hour cancel window
  const elapsed = Date.now() - eInvoice.ackDate.getTime()
  if (elapsed > CANCEL_WINDOW_MS) {
    throw validationError('E-Invoice can only be cancelled within 24 hours of acknowledgement')
  }

  // 4. Call NIC cancel API
  const nicResponse = await callNicIrpCancel(eInvoice.irn, reason)

  // 5. Update record
  const updated = await prisma.eInvoice.update({
    where: { documentId },
    data: {
      status: 'CANCELLED',
      cancelReason: reason,
      cancelledAt: nicResponse.cancelledAt,
    },
  })

  return updated
}

export async function getEInvoice(businessId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    select: { id: true },
  })
  if (!doc) throw notFoundError('Document')

  const eInvoice = await prisma.eInvoice.findUnique({
    where: { documentId },
  })
  if (!eInvoice) throw notFoundError('E-Invoice')

  return eInvoice
}
