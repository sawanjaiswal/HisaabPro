/**
 * E-Way Bill public service API.
 * MB-1: EWayBill always loaded where: { id, businessId } — ewbNumber never from request.
 * MB-4: AuditLog uses maskGstin().
 * Threshold gate: in ewaybill.doc-loader.ts.
 */

import crypto from 'crypto'
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import logger from '../../lib/logger.js'
import { createAuditEntry } from '../settings/audit.js'
import { maskGstin, EWAYBILL_ERRORS } from './ewaybill.errors.js'
import { buildEwbEnvelope } from './ewaybill.envelope.js'
import * as nicClient from './ewaybill.nic-client.js'
import { isEwbStubMode } from './ewaybill.token-store.js'
import { loadEwbDocument, assertThreshold } from './ewaybill.doc-loader.js'
import type { Prisma } from '@prisma/client'

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000

type PartAInputs = {
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
  transporterId?: string
  transporterName?: string
  vehicleNumber?: string
  vehicleType?: 'REGULAR' | 'ODC'
  distance: number
  fromPincode: string
  toPincode: string
}

// ─── Generate E-Way Bill ──────────────────────────────────────────────────────

export async function generateEWayBill(
  documentId: string,
  businessId: string,
  userId: string,
  partAInputs: PartAInputs
) {
  const doc = await loadEwbDocument(documentId, businessId) // MB-1

  if (doc.eWayBill?.status === 'ACTIVE') {
    return { eWayBill: doc.eWayBill, isIdempotent: true }
  }

  const { interstate } = assertThreshold(doc)

  const envelope = buildEwbEnvelope({
    document: {
      id: doc.id, documentNumber: doc.documentNumber,
      documentDate: doc.documentDate, grandTotal: doc.grandTotal,
      totalTaxableValue: doc.totalTaxableValue, totalCgst: doc.totalCgst,
      totalSgst: doc.totalSgst, totalIgst: doc.totalIgst,
      totalCess: doc.totalCess, placeOfSupply: doc.placeOfSupply,
    },
    business: doc.business,
    party: doc.party,
    transporterDetails: {
      transportMode: partAInputs.transportMode,
      transporterId: partAInputs.transporterId,
      transporterName: partAInputs.transporterName,
      distance: partAInputs.distance,
    },
    vehicleDetails: {
      vehicleNumber: partAInputs.vehicleNumber,
      vehicleType: partAInputs.vehicleType,
      fromPincode: partAInputs.fromPincode,
      toPincode: partAInputs.toPincode,
    },
  })

  const reqId = crypto.randomUUID()
  if (isEwbStubMode()) logger.warn('EWAYBILL_STUB_MODE', { once: true })

  const nicResult = await nicClient.generate(envelope, businessId, reqId)

  const eWayBill = await prisma.eWayBill.upsert({
    where: { documentId },
    create: {
      documentId, ewbNumber: nicResult.ewbNumber, ewbDate: new Date(),
      validUpto: new Date(nicResult.validUpto),
      transportMode: partAInputs.transportMode,
      transporterId: partAInputs.transporterId,
      transporterName: partAInputs.transporterName,
      vehicleNumber: partAInputs.vehicleNumber,
      vehicleType: partAInputs.vehicleType,
      distance: partAInputs.distance,
      fromPincode: partAInputs.fromPincode,
      toPincode: partAInputs.toPincode,
      status: 'ACTIVE',
      partBUpdates: [] as unknown as Prisma.InputJsonValue,
    },
    update: {
      ewbNumber: nicResult.ewbNumber, ewbDate: new Date(),
      validUpto: new Date(nicResult.validUpto),
      status: 'ACTIVE', cancelReason: null, cancelledAt: null,
      partBUpdates: [] as unknown as Prisma.InputJsonValue,
    },
  })

  await createAuditEntry({
    businessId, action: 'EWAYBILL_GENERATED',
    entityType: 'EWayBill', entityId: eWayBill.id,
    entityLabel: nicResult.ewbNumber, userId,
    changes: {
      ewbNumber: nicResult.ewbNumber,
      sellerGstin: maskGstin(doc.business.gstin), // MB-4
      buyerGstin: maskGstin(doc.party.gstin),      // MB-4
      documentNumber: doc.documentNumber, interstate,
    },
  })

  logger.info('EWAYBILL_GENERATED', { businessId, documentId, ewbNumber: nicResult.ewbNumber, stub: isEwbStubMode() })
  return { eWayBill, isIdempotent: false }
}

// ─── Update Part B ────────────────────────────────────────────────────────────

export async function updatePartB(
  documentId: string,
  businessId: string,
  userId: string,
  partBInputs: { vehicleNumber: string; vehicleType?: 'REGULAR' | 'ODC' }
) {
  // MB-1: scope by businessId
  const record = await prisma.eWayBill.findFirst({
    where: { document: { id: documentId, businessId } },
  })
  if (!record) throw new AppError(ErrorCode.NOT_FOUND, 404, 'E-Way Bill not found')
  if (record.status !== 'ACTIVE') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Part-B only updatable on ACTIVE EWB', {
      code: EWAYBILL_ERRORS.PART_B_REQUIRED,
    })
  }

  const reqId = crypto.randomUUID()
  const nicResult = await nicClient.updatePartB( // ewbNumber from DB — MB-1
    record.ewbNumber, businessId,
    partBInputs.vehicleNumber,
    partBInputs.vehicleType ?? record.vehicleType ?? 'REGULAR',
    reqId
  )

  const existing = Array.isArray(record.partBUpdates) ? record.partBUpdates as object[] : []
  const updated = await prisma.eWayBill.update({
    where: { id: record.id },
    data: {
      vehicleNumber: partBInputs.vehicleNumber,
      vehicleType: partBInputs.vehicleType ?? record.vehicleType,
      partBUpdates: [...existing, {
        vehicleNumber: partBInputs.vehicleNumber,
        vehicleType: partBInputs.vehicleType ?? record.vehicleType,
        updatedAt: nicResult.updatedAt,
      }] as unknown as Prisma.InputJsonValue,
    },
  })

  await createAuditEntry({
    businessId, action: 'EWAYBILL_PARTB_UPDATED',
    entityType: 'EWayBill', entityId: record.id,
    entityLabel: record.ewbNumber, userId,
    changes: { vehicleNumber: partBInputs.vehicleNumber, vehicleType: partBInputs.vehicleType },
  })

  logger.info('EWAYBILL_PARTB_UPDATED', { businessId, documentId, vehicleNumber: partBInputs.vehicleNumber })
  return updated
}

// ─── Cancel E-Way Bill ────────────────────────────────────────────────────────

export async function cancelEWayBill(
  documentId: string,
  businessId: string,
  userId: string,
  reason: string
) {
  // MB-1: scope by businessId
  const record = await prisma.eWayBill.findFirst({
    where: { document: { id: documentId, businessId } },
  })
  if (!record) throw new AppError(ErrorCode.NOT_FOUND, 404, 'E-Way Bill not found')

  if (record.status === 'CANCELLED') {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'E-Way Bill already cancelled', {
      code: EWAYBILL_ERRORS.ALREADY_CANCELLED,
    })
  }
  if (Date.now() - record.ewbDate.getTime() > CANCEL_WINDOW_MS) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Cancel window expired (24h)', {
      code: EWAYBILL_ERRORS.CANCEL_WINDOW_EXPIRED,
    })
  }

  const reqId = crypto.randomUUID()
  await nicClient.cancel(record.ewbNumber, businessId, reason, reqId) // ewbNumber from DB — MB-1

  const updated = await prisma.eWayBill.update({
    where: { id: record.id },
    data: { status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() },
  })

  const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { gstin: true } })

  await createAuditEntry({
    businessId, action: 'EWAYBILL_CANCELLED',
    entityType: 'EWayBill', entityId: record.id,
    entityLabel: record.ewbNumber, userId,
    changes: { reason, sellerGstin: maskGstin(biz?.gstin) }, // MB-4
  })

  logger.info('EWAYBILL_CANCELLED', { businessId, documentId, ewbNumber: record.ewbNumber })
  return updated
}

// ─── Get E-Way Bill ───────────────────────────────────────────────────────────

export async function getEWayBill(documentId: string, businessId: string) {
  const record = await prisma.eWayBill.findFirst({
    where: { document: { id: documentId, businessId } },
  })
  if (!record) throw new AppError(ErrorCode.NOT_FOUND, 404, 'E-Way Bill not found')
  return record
}
