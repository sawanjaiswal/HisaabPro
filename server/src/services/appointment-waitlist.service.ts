/**
 * Waitlist service. Lightweight CRUD around `AppointmentWaitlist`.
 *
 * Cross-tenant safety: partyId/employeeId are resolved scoped before any
 * waitlist mutation.
 *
 * Wire shape note: FE sends `desiredStartAt` + `desiredEndAt`, but the DB
 * model only persists `preferredDate` (single timestamp). We store
 * desiredStartAt as preferredDate and stash the requested duration in the
 * `notes` field as a `__dur:<minutes>__\n` prefix so the response can echo
 * `desiredEndAt` consistently. Extending the model to first-class start/end
 * columns is a schema-tier change — separate design plan.
 */

import { prisma } from '../lib/prisma.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import {
  resolveScopedParty,
  resolveScopedEmployee,
} from '../middleware/resolve-scoped.js'

interface Scope {
  businessId: string
  userId: string
}

interface AddWaitlistInput {
  partyId: string
  employeeId: string | null
  desiredStartAt: Date
  desiredEndAt: Date
  notes?: string | null
}

interface WaitlistResponseRow {
  id: string
  partyId: string
  partyNameSnapshot: string
  employeeId: string | null
  desiredStartAt: string
  desiredEndAt: string
  createdAt: string
}

const DUR_PREFIX = /^__dur:(\d+)__\n?/

function packNotes(durationMinutes: number, notes?: string | null): string {
  return `__dur:${durationMinutes}__\n${notes ?? ''}`
}

function unpackNotes(raw: string | null): { durationMinutes: number; notes: string | null } {
  if (!raw) return { durationMinutes: 60, notes: null }
  const m = raw.match(DUR_PREFIX)
  if (!m) return { durationMinutes: 60, notes: raw }
  return {
    durationMinutes: parseInt(m[1] ?? '60', 10),
    notes: raw.slice(m[0].length) || null,
  }
}

async function presentRow(row: {
  id: string
  partyId: string
  employeeId: string | null
  preferredDate: Date
  notes: string | null
  createdAt: Date
}): Promise<WaitlistResponseRow> {
  const party = await prisma.party.findUnique({
    where: { id: row.partyId },
    select: { name: true },
  })
  const { durationMinutes } = unpackNotes(row.notes)
  const start = row.preferredDate
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return {
    id: row.id,
    partyId: row.partyId,
    partyNameSnapshot: party?.name ?? '',
    employeeId: row.employeeId,
    desiredStartAt: start.toISOString(),
    desiredEndAt: end.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function addToWaitlist(scope: Scope, input: AddWaitlistInput): Promise<WaitlistResponseRow> {
  await resolveScopedParty({ businessId: scope.businessId }, input.partyId)
  if (input.employeeId) {
    await resolveScopedEmployee({ businessId: scope.businessId }, input.employeeId)
  }
  const durationMinutes = Math.max(
    1,
    Math.round((input.desiredEndAt.getTime() - input.desiredStartAt.getTime()) / 60_000)
  )
  const row = await prisma.appointmentWaitlist.create({
    data: {
      businessId: scope.businessId,
      partyId: input.partyId,
      employeeId: input.employeeId,
      preferredDate: input.desiredStartAt,
      notes: packNotes(durationMinutes, input.notes),
    },
  })
  return presentRow(row)
}

export async function listWaitlist(
  scope: Scope,
  opts: { from?: Date; to?: Date; employeeId?: string } = {}
): Promise<WaitlistResponseRow[]> {
  const rows = await prisma.appointmentWaitlist.findMany({
    where: {
      businessId: scope.businessId,
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
      ...(opts.from || opts.to
        ? {
            preferredDate: {
              ...(opts.from ? { gte: opts.from } : {}),
              ...(opts.to ? { lt: opts.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { preferredDate: 'asc' },
  })
  return Promise.all(rows.map(presentRow))
}

export async function removeFromWaitlist(scope: Scope, waitlistId: string): Promise<void> {
  const row = await prisma.appointmentWaitlist.findFirst({
    where: { id: waitlistId, businessId: scope.businessId },
  })
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')
  await prisma.appointmentWaitlist.delete({ where: { id: waitlistId } })
}
