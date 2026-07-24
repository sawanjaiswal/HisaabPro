/** Promise-to-Pay CRUD. MB-8: non-OPEN → 409. */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { createAuditEntry } from '../settings/audit.js'

export interface CreatePtpInput {
  partyId: string
  invoiceId?: string
  amountPaise: number
  promiseDate: Date
  notes?: string
}

export interface UpdatePtpInput {
  promiseDate?: Date
  amountPaise?: number
  notes?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

async function fetchPtp(businessId: string, ptpId: string) {
  const ptp = await prisma.promiseToPay.findFirst({
    where: { id: ptpId, businessId, isDeleted: false },
  })
  return ptp
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createPtp(
  businessId: string,
  userId: string,
  input: CreatePtpInput,
) {
  const { partyId, invoiceId, amountPaise, promiseDate, notes } = input

  // Validate amount
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    const err = new Error('AMOUNT_INVALID')
    ;(err as NodeJS.ErrnoException).code = 'AMOUNT_INVALID'
    throw err
  }

  // promiseDate must be today or later (aligned with client min={todayStr})
  const today = todayStart()
  const pDate = new Date(promiseDate)
  pDate.setHours(0, 0, 0, 0)
  if (pDate < today) {
    const err = new Error('PROMISED_DATE_INVALID')
    ;(err as NodeJS.ErrnoException).code = 'PROMISED_DATE_INVALID'
    throw err
  }

  // Validate party scope
  const party = await prisma.party.findFirst({
    where: { id: partyId, businessId, isDeleted: false },
    select: { id: true },
  })
  if (!party) {
    const err = new Error('Party not found')
    ;(err as NodeJS.ErrnoException).code = 'PARTY_NOT_FOUND'
    throw err
  }

  // Validate invoice scope if provided
  if (invoiceId) {
    const inv = await prisma.document.findFirst({
      where: { id: invoiceId, businessId, isDeleted: false },
      select: { id: true },
    })
    if (!inv) {
      const err = new Error('Invoice not found')
      ;(err as NodeJS.ErrnoException).code = 'INVOICE_NOT_FOUND'
      throw err
    }
  }

  const ptp = await prisma.$transaction(async (tx) => {
    const created = await tx.promiseToPay.create({
      data: {
        businessId,
        partyId,
        invoiceId,
        amountPaise,
        promiseDate: promiseDate,
        status: 'OPEN',
        notes,
        createdBy: userId,
      },
    })

    await createAuditEntry({
      businessId,
      action: 'PTP_CREATED',
      entityType: 'PromiseToPay',
      entityId: created.id,
      // F-25: replace newlines before truncation so multi-line notes don't
      // break audit table layout in admin UI.
      entityLabel: notes ? notes.replace(/\n/g, ' ').substring(0, 200) : `PTP ${created.id}`,
      userId,
      changes: { amountPaise, promiseDate, partyId, invoiceId },
    }, tx)

    return created
  })

  logger.info('ptp.created', { ptpId: ptp.id, businessId, partyId })
  return ptp
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updatePtp(
  businessId: string,
  ptpId: string,
  userId: string,
  patch: UpdatePtpInput,
) {
  const ptp = await fetchPtp(businessId, ptpId)
  if (!ptp) {
    const err = new Error('PTP not found')
    ;(err as NodeJS.ErrnoException).code = 'PTP_NOT_FOUND'
    throw err
  }

  // MB-8: immutability gate
  if (ptp.status !== 'OPEN') {
    const err = new Error('PTP is not editable in its current state')
    ;(err as NodeJS.ErrnoException).code = 'PTP_NOT_EDITABLE'
    throw err
  }

  // Validate new date if provided — today or later (aligned with client)
  if (patch.promiseDate !== undefined) {
    const today = todayStart()
    const pDate = new Date(patch.promiseDate)
    pDate.setHours(0, 0, 0, 0)
    if (pDate < today) {
      const err = new Error('PROMISED_DATE_INVALID')
      ;(err as NodeJS.ErrnoException).code = 'PROMISED_DATE_INVALID'
      throw err
    }
  }

  // Validate new amount if provided
  if (patch.amountPaise !== undefined) {
    if (!Number.isInteger(patch.amountPaise) || patch.amountPaise <= 0) {
      const err = new Error('AMOUNT_INVALID')
      ;(err as NodeJS.ErrnoException).code = 'AMOUNT_INVALID'
      throw err
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.promiseToPay.update({
      where: { id: ptpId },
      data: {
        ...patch,
        updatedBy: userId,
      },
    })

    await createAuditEntry({
      businessId,
      action: 'PTP_UPDATED',
      entityType: 'PromiseToPay',
      entityId: ptpId,
      entityLabel: `PTP ${ptpId}`,
      userId,
      changes: patch as Record<string, unknown>,
    }, tx)

    return result
  })

  logger.info('ptp.updated', { ptpId, businessId })
  return updated
}

// ─── Delete (soft) ───────────────────────────────────────────────────────────

export async function deletePtp(
  businessId: string,
  ptpId: string,
  userId: string,
) {
  const ptp = await fetchPtp(businessId, ptpId)
  if (!ptp) {
    const err = new Error('PTP not found')
    ;(err as NodeJS.ErrnoException).code = 'PTP_NOT_FOUND'
    throw err
  }

  // MB-8: immutability gate
  if (ptp.status !== 'OPEN') {
    const err = new Error('PTP is not deletable in its current state')
    ;(err as NodeJS.ErrnoException).code = 'PTP_NOT_DELETABLE'
    throw err
  }

  await prisma.$transaction(async (tx) => {
    await tx.promiseToPay.update({
      where: { id: ptpId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: userId,
        status: 'CANCELLED',
        cancelledAt: new Date(),
        updatedBy: userId,
      },
    })

    await createAuditEntry({
      businessId,
      action: 'PTP_CANCELLED',
      entityType: 'PromiseToPay',
      entityId: ptpId,
      entityLabel: `PTP ${ptpId}`,
      userId,
      changes: { reason: 'user_deleted' },
    }, tx)
  })

  logger.info('ptp.deleted', { ptpId, businessId })
}
