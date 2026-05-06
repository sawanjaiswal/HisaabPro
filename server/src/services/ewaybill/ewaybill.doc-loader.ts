/**
 * EWB document loader — fetches document with all relations needed for generation.
 * MB-1: always scoped by businessId.
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { EWAYBILL_ERRORS } from './ewaybill.errors.js'
import { getEwbThreshold, isInterState } from '../../lib/nic-thresholds.js'

export type EwbDocumentRow = NonNullable<Awaited<ReturnType<typeof loadEwbDocument>>>

export async function loadEwbDocument(documentId: string, businessId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId, deletedAt: null },
    include: {
      party: { select: { gstin: true, name: true, stateCode: true } },
      business: { select: { gstin: true, name: true, address: true, stateCode: true } },
      eWayBill: true,
    },
  })
  if (!doc) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Document not found')
  return doc
}

export function assertThreshold(doc: EwbDocumentRow): { interstate: boolean } {
  const bizState = doc.business.stateCode ?? ''
  const partyState = doc.party.stateCode ?? ''
  const interstate = isInterState(bizState, partyState)
  const threshold = getEwbThreshold(bizState, interstate)

  if (doc.grandTotal < threshold) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR, 400,
      `E-Way Bill not required below Rs ${threshold / 100} (current: Rs ${doc.grandTotal / 100})`,
      { code: EWAYBILL_ERRORS.BELOW_THRESHOLD }
    )
  }
  return { interstate }
}
