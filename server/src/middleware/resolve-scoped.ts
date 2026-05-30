/**
 * Cross-tenant ID resolvers.
 *
 * Every appointment endpoint accepts client-supplied IDs (partyId, employeeId,
 * appointmentId, jobTemplateId). Before any further DB query, we JOIN those
 * IDs to `req.user.businessId` and throw `AppError(NOT_FOUND, 404)` on mismatch
 * — never 403, which would confirm the row exists in another tenant.
 *
 * Helpers (not middleware proper — called inside services) so the call-site
 * can mix multiple resolves into one Prisma roundtrip when needed.
 */

import { prisma } from '../lib/prisma.js'
import { AppError, ErrorCode } from '../lib/errors.js'

interface Scope {
  businessId: string
}

export async function resolveScopedParty(
  scope: Scope,
  partyId: string
): Promise<{ id: string; name: string; isActive: boolean }> {
  const row = await prisma.party.findFirst({
    where: { id: partyId, businessId: scope.businessId, isDeleted: false },
    select: { id: true, name: true, isActive: true },
  })
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')
  return row
}

export async function resolveScopedEmployee(
  scope: Scope,
  employeeId: string
): Promise<{ id: string; name: string; isDeleted: boolean }> {
  const row = await prisma.employee.findFirst({
    where: { id: employeeId, businessId: scope.businessId, isDeleted: false },
    select: { id: true, name: true, isDeleted: true },
  })
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')
  return row
}

export async function resolveScopedAppointment(
  scope: Scope,
  appointmentId: string
) {
  const row = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId: scope.businessId },
  })
  if (!row) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')
  return row
}

/**
 * Looks up a JobTemplate / Service definition within scope. Returns null if
 * the caller passes null (services are optional on appointments).
 */
export async function resolveScopedJobTemplate(
  scope: Scope,
  jobTemplateId: string | null | undefined
): Promise<{ id: string } | null> {
  if (!jobTemplateId) return null
  // JobTemplate model is feature-flagged elsewhere; we treat any matching
  // tenant-scoped row as valid. If the model doesn't exist in the active
  // schema, callers may skip the resolve entirely.
  // Defensive null guard until JobTemplate lands.
  const tpl = await (prisma as unknown as {
    jobTemplate?: { findFirst: (args: unknown) => Promise<{ id: string } | null> }
  }).jobTemplate?.findFirst({
    where: { id: jobTemplateId, businessId: scope.businessId },
    select: { id: true },
  })
  if (!tpl) throw new AppError(ErrorCode.NOT_FOUND, 404, 'Not found')
  return tpl
}
