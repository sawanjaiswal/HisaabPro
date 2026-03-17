/**
 * E-Way Bill Service — Generate, cancel, update Part-B, and retrieve EWB.
 * All amounts in paise. Sandbox/mock mode in development.
 */

import { prisma } from '../lib/prisma.js'
import { validationError, notFoundError, conflictError } from '../lib/errors.js'
import {
  callNicEwbGenerate,
  callNicEwbCancel,
} from '../lib/nic-api.js'
import type { GenerateEWayBillInput } from '../schemas/ecompliance.schemas.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours in ms
const EWB_THRESHOLD_PAISE = 5_000_000         // Rs 50,000 in paise

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEwbPayload(
  doc: {
    id: string
    documentNumber: string | null
    documentDate: Date
    grandTotal: number
    party: { gstin: string | null; name: string }
    business: { gstin: string | null; name: string }
  },
  transport: Omit<GenerateEWayBillInput, 'documentId'>
): Record<string, unknown> {
  return {
    supplyType: 'O', // Outward
    subSupplyType: '1',
    docType: 'INV',
    docNo: doc.documentNumber ?? doc.id,
    docDate: doc.documentDate.toISOString().slice(0, 10).split('-').reverse().join('/'),
    fromGstin: doc.business.gstin ?? '',
    fromTrdName: doc.business.name,
    toGstin: doc.party.gstin ?? 'URP', // URP = Unregistered Party
    toTrdName: doc.party.name,
    transMode: transport.transportMode,
    transDistance: transport.distance,
    transporterId: transport.transporterId ?? '',
    transporterName: transport.transporterName ?? '',
    transDocNo: '',
    transDocDate: '',
    vehicleNo: transport.vehicleNumber ?? '',
    vehicleType: transport.vehicleType ?? 'REGULAR',
    fromPincode: transport.fromPincode,
    toPincode: transport.toPincode,
    actFromStateCode: parseInt(transport.fromPincode.slice(0, 2), 10),
    actToStateCode: parseInt(transport.toPincode.slice(0, 2), 10),
    totalValue: doc.grandTotal,
  }
}

// ─── Service functions ───────────────────────────────────────────────────────

export async function generateEWayBill(
  businessId: string,
  documentId: string,
  transport: Omit<GenerateEWayBillInput, 'documentId'>
) {
  // 1. Load document
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    include: {
      party: { select: { gstin: true, name: true } },
      business: { select: { gstin: true, name: true } },
      eWayBill: true,
    },
  })
  if (!doc) throw notFoundError('Document')

  // 2. Validate: SAVED and grandTotal >= Rs 50,000
  if (doc.status !== 'SAVED') {
    throw validationError('E-Way Bill can only be generated for saved documents')
  }
  if (doc.grandTotal < EWB_THRESHOLD_PAISE) {
    throw validationError(
      `E-Way Bill is required only for invoices above Rs 50,000 (current: Rs ${doc.grandTotal / 100})`
    )
  }

  // 3. Check no active E-Way Bill exists
  if (doc.eWayBill && doc.eWayBill.status === 'ACTIVE') {
    throw conflictError('An active E-Way Bill already exists for this document')
  }

  // 4. Build payload and call NIC API
  const payload = buildEwbPayload(doc, transport)
  const nicResponse = await callNicEwbGenerate(payload)

  // 5. Upsert EWayBill record
  const eWayBill = await prisma.eWayBill.upsert({
    where: { documentId },
    create: {
      documentId,
      ewbNumber: nicResponse.ewbNumber,
      ewbDate: nicResponse.ewbDate,
      validUpto: nicResponse.validUpto,
      transportMode: transport.transportMode,
      transporterId: transport.transporterId,
      transporterName: transport.transporterName,
      vehicleNumber: transport.vehicleNumber,
      vehicleType: transport.vehicleType,
      distance: transport.distance,
      fromPincode: transport.fromPincode,
      toPincode: transport.toPincode,
      status: 'ACTIVE',
      partBUpdates: [],
    },
    update: {
      ewbNumber: nicResponse.ewbNumber,
      ewbDate: nicResponse.ewbDate,
      validUpto: nicResponse.validUpto,
      transportMode: transport.transportMode,
      transporterId: transport.transporterId,
      transporterName: transport.transporterName,
      vehicleNumber: transport.vehicleNumber,
      vehicleType: transport.vehicleType,
      distance: transport.distance,
      fromPincode: transport.fromPincode,
      toPincode: transport.toPincode,
      status: 'ACTIVE',
      cancelReason: null,
      cancelledAt: null,
      partBUpdates: [],
    },
  })

  return eWayBill
}

export async function cancelEWayBill(businessId: string, documentId: string, reason: string) {
  // 1. Confirm document ownership
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    select: { id: true },
  })
  if (!doc) throw notFoundError('Document')

  // 2. Find active EWayBill
  const eWayBill = await prisma.eWayBill.findUnique({ where: { documentId } })
  if (!eWayBill) throw notFoundError('E-Way Bill')
  if (eWayBill.status !== 'ACTIVE') {
    throw validationError('Only an active E-Way Bill can be cancelled')
  }

  // 3. Check 24-hour cancel window
  const elapsed = Date.now() - eWayBill.ewbDate.getTime()
  if (elapsed > CANCEL_WINDOW_MS) {
    throw validationError('E-Way Bill can only be cancelled within 24 hours of generation')
  }

  // 4. Call NIC cancel API
  const nicResponse = await callNicEwbCancel(eWayBill.ewbNumber, reason)

  // 5. Update record
  const updated = await prisma.eWayBill.update({
    where: { documentId },
    data: {
      status: 'CANCELLED',
      cancelReason: reason,
      cancelledAt: nicResponse.cancelledAt,
    },
  })

  return updated
}

export async function updatePartB(
  businessId: string,
  documentId: string,
  vehicleUpdate: { vehicleNumber: string; vehicleType?: string }
) {
  // 1. Confirm document ownership
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    select: { id: true },
  })
  if (!doc) throw notFoundError('Document')

  // 2. Find active EWayBill
  const eWayBill = await prisma.eWayBill.findUnique({ where: { documentId } })
  if (!eWayBill) throw notFoundError('E-Way Bill')
  if (eWayBill.status !== 'ACTIVE') {
    throw validationError('Part-B can only be updated on an active E-Way Bill')
  }

  // 3. Append to partBUpdates history
  const existingUpdates = Array.isArray(eWayBill.partBUpdates) ? eWayBill.partBUpdates : []
  const newEntry = {
    vehicleNumber: vehicleUpdate.vehicleNumber,
    vehicleType: vehicleUpdate.vehicleType ?? eWayBill.vehicleType,
    updatedAt: new Date().toISOString(),
  }

  const updated = await prisma.eWayBill.update({
    where: { documentId },
    data: {
      vehicleNumber: vehicleUpdate.vehicleNumber,
      vehicleType: vehicleUpdate.vehicleType ?? eWayBill.vehicleType,
      partBUpdates: [...existingUpdates, newEntry],
    },
  })

  return updated
}

export async function getEWayBill(businessId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    select: { id: true },
  })
  if (!doc) throw notFoundError('Document')

  const eWayBill = await prisma.eWayBill.findUnique({ where: { documentId } })
  if (!eWayBill) throw notFoundError('E-Way Bill')

  return eWayBill
}
