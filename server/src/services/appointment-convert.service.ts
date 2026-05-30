/**
 * Convert an appointment to a Job (services verticals) or Invoice/Document
 * (clinic vertical).
 *
 * Idempotency: a successful convert sets `Job.appointmentId` /
 * `Document.appointmentId`; replays return the existing row by joining on
 * that FK. The route layer ALSO honours the `X-Idempotency-Key` header via
 * `idempotencyCheck()` middleware for mid-flight retries before the first
 * row lands.
 *
 * Wiring note (Phase 1B handoff): direct Prisma inserts here, NOT through
 * createJob()/createDocument(). Rationale:
 *   - createJob() doesn't accept appointmentId in its CreateJobInput shape.
 *   - createDocument() runs a heavy GST/stock/posting pipeline; the convert
 *     flow ships placeholder line items that the user will edit pre-save.
 *   - Both downstream pipelines assume numbered + saved state, while the
 *     convert flow drops the user into a QUOTED Job / DRAFT Document.
 * A future "deep-wire" plan can route through them once the schema admits
 * appointmentId in the input contracts.
 */

import { prisma } from '../lib/prisma.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import { APPT_ERR } from '../constants/appointment.constants.js'
import logger from '../lib/logger.js'
import type { ConvertItem } from '../schemas/appointment-convert.schema.js'

interface Scope {
  businessId: string
  userId: string
}

interface ConvertOptions {
  notes?: string | null
  items?: ConvertItem[]
}

interface AppointmentRow {
  id: string
  status: string
  businessId: string
  partyId: string | null
  partyNameSnapshot: string
  startAt: Date
}

function assertConvertibleStatus(appointment: AppointmentRow): void {
  if (appointment.status !== 'COMPLETED' && appointment.status !== 'IN_PROGRESS') {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      409,
      'Only IN_PROGRESS or COMPLETED appointments can be converted',
      { code: APPT_ERR.INVALID_STATUS_TRANSITION }
    )
  }
}

function defaultLineDescription(appointment: AppointmentRow): string {
  const dateStr = appointment.startAt.toISOString().slice(0, 10)
  return `Appointment ${dateStr} — ${appointment.partyNameSnapshot}`.slice(0, 500)
}

export async function convertAppointmentToJob(
  scope: Scope,
  appointmentId: string,
  opts: ConvertOptions = {}
): Promise<{ jobId: string; replayed: boolean }> {
  const appointment = (await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId: scope.businessId },
  })) as AppointmentRow | null
  if (!appointment) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')

  // Idempotency: an existing Job already linked to this appointment? Replay.
  const existing = await prisma.job.findFirst({
    where: { appointmentId, businessId: scope.businessId, isDeleted: false },
    select: { id: true },
  })
  if (existing) {
    logger.info('[appointment] convert-to-job replay', {
      appointmentId,
      jobId: existing.id,
    })
    return { jobId: existing.id, replayed: true }
  }

  assertConvertibleStatus(appointment)

  if (!appointment.partyId) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      409,
      'Appointment is not linked to a party — cannot convert'
    )
  }

  const items = (opts.items && opts.items.length > 0
    ? opts.items
    : [
        {
          description: defaultLineDescription(appointment),
          quantity: 1,
          unitPricePaise: 0,
        },
      ]) as ConvertItem[]

  const itemRows = items.map((it, i) => ({
    sortOrder: i,
    productId: it.productId ?? null,
    kind: 'ITEM' as const,
    description: it.description,
    quantity: it.quantity.toString(),
    ratePaise: it.unitPricePaise,
    discountPaise: 0,
    totalPaise: Math.round(it.quantity * it.unitPricePaise),
  }))
  const subtotalPaise = itemRows.reduce((s, r) => s + r.totalPaise, 0)
  const totalPaise = Math.max(0, subtotalPaise)

  const job = await prisma.$transaction(async (tx) => {
    return tx.job.create({
      data: {
        businessId: scope.businessId,
        partyId: appointment.partyId!,
        title: `Appointment — ${appointment.partyNameSnapshot}`.slice(0, 200),
        description: opts.notes ?? null,
        status: 'QUOTED',
        scheduledAt: appointment.startAt,
        subtotalPaise,
        discountPaise: 0,
        totalPaise,
        appointmentId,
        createdBy: scope.userId,
        items: { createMany: { data: itemRows } },
      },
      select: { id: true },
    })
  })

  logger.info('[appointment] convert-to-job created', {
    appointmentId,
    jobId: job.id,
  })
  return { jobId: job.id, replayed: false }
}

export async function convertAppointmentToInvoice(
  scope: Scope,
  appointmentId: string,
  opts: ConvertOptions = {}
): Promise<{ documentId: string; replayed: boolean }> {
  const appointment = (await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId: scope.businessId },
  })) as AppointmentRow | null
  if (!appointment) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')

  const existing = await prisma.document.findFirst({
    where: { appointmentId, businessId: scope.businessId, isDeleted: false },
    select: { id: true },
  })
  if (existing) {
    logger.info('[appointment] convert-to-invoice replay', {
      appointmentId,
      documentId: existing.id,
    })
    return { documentId: existing.id, replayed: true }
  }

  assertConvertibleStatus(appointment)

  if (!appointment.partyId) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      409,
      'Appointment is not linked to a party — cannot convert'
    )
  }

  // Invoice line items REQUIRE productId (DocumentLineItem.productId is NOT
  // NULL). If items omitted, create a header-only DRAFT — the user fills
  // lines in the document editor before SAVE. This is the right UX: the
  // convert flow drops the user into a half-populated DRAFT, not a posted
  // invoice.
  const lineItemRows = (opts.items ?? []).map((it, i) => ({
    productId: it.productId as string, // Zod guarantees non-null for invoice
    sortOrder: i,
    quantity: it.quantity,
    rate: it.unitPricePaise,
    discountType: 'AMOUNT',
    discountValue: 0,
    discountAmount: 0,
    lineTotal: Math.round(it.quantity * it.unitPricePaise),
    taxableValue: Math.round(it.quantity * it.unitPricePaise),
  }))
  const subtotal = lineItemRows.reduce((s, r) => s + r.lineTotal, 0)

  const doc = await prisma.$transaction(async (tx) => {
    return tx.document.create({
      data: {
        businessId: scope.businessId,
        type: 'SALE_INVOICE',
        status: 'DRAFT',
        partyId: appointment.partyId!,
        documentDate: new Date(),
        subtotal,
        grandTotal: subtotal,
        notes: opts.notes ?? null,
        appointmentId,
        createdBy: scope.userId,
        ...(lineItemRows.length > 0
          ? { lineItems: { createMany: { data: lineItemRows } } }
          : {}),
      },
      select: { id: true },
    })
  })

  logger.info('[appointment] convert-to-invoice created', {
    appointmentId,
    documentId: doc.id,
  })
  return { documentId: doc.id, replayed: false }
}
