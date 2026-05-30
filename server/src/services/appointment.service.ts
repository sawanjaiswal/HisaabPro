/**
 * Appointment create orchestration.
 *
 * Order of operations (do NOT reorder — security):
 *   1. resolveScopedParty + resolveScopedEmployee  ← cross-tenant 404 BEFORE
 *      any insert. NEVER trust client-supplied IDs.
 *   2. Idempotency replay check by `(businessId, idempotencyKey)`.
 *   3. Vertical resolve from business.
 *   4. Insert wrapped in withSlotConflictTranslation → 409 on btree_gist
 *      EXCLUDE violation.
 *
 * Recurrence expansion is delegated to `appointment-recurrence.service.ts`.
 */

import { prisma } from '../lib/prisma.js'
import { AppError, ErrorCode } from '../lib/errors.js'
import {
  resolveScopedParty,
  resolveScopedEmployee,
} from '../middleware/resolve-scoped.js'
import {
  findByIdempotencyKey,
  insertAppointment,
  type AppointmentDetail,
} from './appointment-repo.js'
import { minutesBetween } from '../utils/appointment.utils.js'
import { redactAppointmentLog } from '../lib/log-redact.js'
import logger from '../lib/logger.js'
import type { CreateAppointmentInput } from '../types/appointment.types.js'

interface Scope {
  businessId: string
  userId: string
}

export async function createAppointment(
  scope: Scope,
  input: CreateAppointmentInput
): Promise<AppointmentDetail> {
  // 1. Idempotency: returns existing row if the key was used before.
  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(scope.businessId, input.idempotencyKey)
    if (existing) {
      logger.info('[appointment] idempotent replay — returning existing', {
        businessId: scope.businessId,
        idempotencyKey: input.idempotencyKey,
        existingId: existing.id,
      })
      return existing
    }
  }

  // 2. Cross-tenant guards — 404 on any mismatch.
  const party = await resolveScopedParty({ businessId: scope.businessId }, input.partyId)
  const employee = input.employeeId
    ? await resolveScopedEmployee({ businessId: scope.businessId }, input.employeeId)
    : null

  // 3. Resolve vertical from business (snapshot).
  const business = await prisma.business.findUnique({
    where: { id: scope.businessId },
    select: { businessType: true },
  })
  if (!business) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Business not found')
  const vertical = input.vertical ?? business.businessType ?? 'general'

  // 4. Insert. Slot-conflict translated to 409 by repo.
  const created = await insertAppointment(prisma, {
    businessId: scope.businessId,
    partyId: party.id,
    partyNameSnapshot: party.name,
    employeeId: employee?.id ?? null,
    employeeNameSnapshot: employee?.name ?? '',
    startAt: input.startAt,
    endAt: input.endAt,
    durationMinutes: minutesBetween(input.startAt, input.endAt),
    vertical,
    notes: input.notes ?? null,
    serviceId: input.serviceId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    createdById: scope.userId,
  })

  logger.info(
    '[appointment] created',
    redactAppointmentLog({
      appointmentId: created.id,
      businessId: scope.businessId,
      partyId: party.id,
      employeeId: employee?.id ?? null,
      startAt: created.startAt,
      vertical,
      notes: created.notes,
    })
  )

  return created
}

export async function getAppointment(
  scope: Scope,
  appointmentId: string
): Promise<AppointmentDetail> {
  const row = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId: scope.businessId },
  })
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')
  return row
}

export async function listAppointments(
  scope: Scope,
  range: { from: Date; to: Date; employeeId?: string }
): Promise<AppointmentDetail[]> {
  return prisma.appointment.findMany({
    where: {
      businessId: scope.businessId,
      ...(range.employeeId ? { employeeId: range.employeeId } : {}),
      startAt: { gte: range.from, lt: range.to },
    },
    orderBy: [{ startAt: 'asc' }],
  })
}
