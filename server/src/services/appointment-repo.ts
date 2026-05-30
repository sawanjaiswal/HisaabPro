/**
 * Appointment repository — thin Prisma layer + select shapes.
 *
 * All writes that may overlap an existing booking are wrapped in
 * `withSlotConflictTranslation` so a 23P01 from the btree_gist EXCLUDE
 * constraint becomes a 409 APPT_SLOT_CONFLICT.
 */

import type { Prisma, AppointmentStatus } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { withSlotConflictTranslation, type PrismaLike } from './appointment-conflict.service.js'

export const APPOINTMENT_DETAIL_SELECT = {
  id: true,
  businessId: true,
  partyId: true,
  partyNameSnapshot: true,
  employeeId: true,
  employeeNameSnapshot: true,
  startAt: true,
  endAt: true,
  durationMinutes: true,
  status: true,
  notes: true,
  serviceId: true,
  vertical: true,
  idempotencyKey: true,
  createdById: true,
  parentRecurrenceId: true,
  createdAt: true,
  updatedAt: true,
} as const

export type AppointmentDetail = Prisma.AppointmentGetPayload<{
  select: typeof APPOINTMENT_DETAIL_SELECT
}>

export async function findByIdempotencyKey(
  businessId: string,
  idempotencyKey: string
): Promise<AppointmentDetail | null> {
  return prisma.appointment.findFirst({
    where: { businessId, idempotencyKey },
    select: APPOINTMENT_DETAIL_SELECT,
  })
}

export interface CreateAppointmentRow {
  businessId: string
  partyId: string | null
  partyNameSnapshot: string
  employeeId: string | null
  employeeNameSnapshot: string
  startAt: Date
  endAt: Date
  durationMinutes: number
  vertical: string
  notes: string | null
  serviceId: string | null
  idempotencyKey: string | null
  createdById: string
  parentRecurrenceId?: string | null
}

export async function insertAppointment(
  db: PrismaLike,
  row: CreateAppointmentRow
): Promise<AppointmentDetail> {
  return withSlotConflictTranslation(() =>
    db.appointment.create({
      data: {
        businessId: row.businessId,
        partyId: row.partyId,
        partyNameSnapshot: row.partyNameSnapshot,
        employeeId: row.employeeId,
        employeeNameSnapshot: row.employeeNameSnapshot,
        startAt: row.startAt,
        endAt: row.endAt,
        durationMinutes: row.durationMinutes,
        vertical: row.vertical,
        notes: row.notes,
        serviceId: row.serviceId,
        idempotencyKey: row.idempotencyKey,
        createdById: row.createdById,
        parentRecurrenceId: row.parentRecurrenceId ?? null,
      },
      select: APPOINTMENT_DETAIL_SELECT,
    })
  )
}

export async function findOverlapsInRange(
  businessId: string,
  employeeId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<Array<{ startAt: Date; endAt: Date }>> {
  const rows = await prisma.appointment.findMany({
    where: {
      businessId,
      employeeId,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN'] as AppointmentStatus[] },
      startAt: { lt: rangeEnd },
      endAt: { gt: rangeStart },
    },
    select: { startAt: true, endAt: true },
  })
  return rows
}

export async function findByIdInBusiness(
  businessId: string,
  appointmentId: string
): Promise<AppointmentDetail | null> {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    select: APPOINTMENT_DETAIL_SELECT,
  })
}

/** Conditional status update with optimistic guard (current-status check). */
export async function conditionalStatusUpdate(
  db: PrismaLike,
  appointmentId: string,
  fromStatus: AppointmentStatus,
  toStatus: AppointmentStatus
): Promise<number> {
  const result = await db.appointment.updateMany({
    where: { id: appointmentId, status: fromStatus },
    data: { status: toStatus },
  })
  return result.count
}

export async function countActiveByParty(
  db: PrismaLike,
  businessId: string,
  partyId: string
): Promise<number> {
  return db.appointment.count({
    where: {
      businessId,
      partyId,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] as AppointmentStatus[] },
    },
  })
}

export async function countActiveByEmployee(
  db: PrismaLike,
  businessId: string,
  employeeId: string
): Promise<number> {
  return db.appointment.count({
    where: {
      businessId,
      employeeId,
      status: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] as AppointmentStatus[] },
    },
  })
}
