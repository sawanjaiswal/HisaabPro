/**
 * Employee service — Phase 6 PR6 (architecture §8.5 + §18.7 row 146).
 *
 * Five operations:
 *
 *   createEmployee(...)  — Party (type=STAFF) + Employee + audit, ONE tx.
 *                          Paired-Party invariant (§8.5) — neither row can
 *                          exist without the other.
 *
 *   updateEmployee(...)  — patches Employee fields only. `partyId` is
 *                          IMMUTABLE. If name/phone change, the paired Party
 *                          row is updated in the SAME tx so STAFF party stays
 *                          in sync.
 *
 *   deleteEmployee(...)  — soft-delete (`isDeleted=true, deletedAt=now`).
 *                          Also soft-deletes the paired Party row
 *                          (`isActive=false, isDeleted=true`) in ONE tx.
 *
 *   listEmployees(...)   — cursor-paginated list, tenant-scoped, default
 *                          hides soft-deleted rows. Substring filter on name.
 *
 *   getEmployee(...)     — single by id, tenant-scoped; throws
 *                          AppError(NOT_FOUND, 404, EMPLOYEE_NOT_FOUND).
 *
 * ────────────────────────────────────────────────────────────────────────
 *  CROSS-TENANT INVARIANT (HARD):
 *
 *  Every read + write filters by `businessId === actor.businessId`. The
 *  route layer is responsible for handing us the resolved active business
 *  (req.activeBusiness!.id). NEVER trust req.body.businessId — there isn't
 *  one in the schema, but defense-in-depth at every layer is the rule.
 * ────────────────────────────────────────────────────────────────────────
 *
 * Audit-coverage SSOT: services/hr/employee.service.ts is listed in
 * server/src/lib/audit/audit-coverage.ts — every mutation here MUST write an
 * `auditLog.create` row inside its `$transaction`.
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type {
  CreateEmployeeInput,
  EmployeeActor,
  EmployeeWithParty,
  UpdateEmployeeInput,
} from './employee.types.js'
import type { Employee } from '@prisma/client'

/** ─── createEmployee ────────────────────────────────────────────────────── */

/**
 * Create an Employee + paired STAFF Party in ONE $transaction (architecture §8.5).
 *
 * Sequence:
 *   1. Party.create { type: 'STAFF', ... } — pairing source-of-truth
 *   2. Employee.create { partyId: party.id, ... }
 *   3. AuditLog.create { entityType: 'Employee', action: 'CREATE',
 *                        changes: { partyId, dailyRate } }
 *
 * @returns { employee, party }
 */
export async function createEmployee(
  input: CreateEmployeeInput,
  actor: EmployeeActor,
): Promise<EmployeeWithParty> {
  return prisma.$transaction(async (tx) => {
    const party = await tx.party.create({
      data: {
        businessId: actor.businessId,
        name: input.name,
        type: 'STAFF',
        phone: input.phone ?? null,
      },
    })

    const employee = await tx.employee.create({
      data: {
        businessId: actor.businessId,
        partyId: party.id,
        userId: input.userId ?? null,
        name: input.name,
        phone: input.phone ?? null,
        designation: input.designation ?? null,
        dailyRate: input.dailyRatePaise,
        createdById: actor.userId,
      },
    })

    await tx.auditLog.create({
      data: {
        businessId: actor.businessId,
        entityType: 'Employee',
        entityId: employee.id,
        entityLabel: employee.name,
        action: 'CREATE',
        userId: actor.userId,
        changes: { partyId: party.id, dailyRatePaise: input.dailyRatePaise },
      },
    })

    return { employee, party }
  })
}

/** ─── updateEmployee ────────────────────────────────────────────────────── */

/**
 * Patch an Employee. `partyId` is IMMUTABLE (architecture §8.5 invariant).
 *
 * If `name` or `phone` change, the paired Party row is updated in the SAME
 * tx so the STAFF party row stays in sync with the Employee (otherwise the
 * party-ledger view would surface stale names).
 *
 * @throws AppError(NOT_FOUND, 404, 'EMPLOYEE_NOT_FOUND') — id missing or cross-tenant.
 */
export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
  actor: EmployeeActor,
): Promise<Employee> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.employee.findFirst({
      where: { id, businessId: actor.businessId },
      select: { id: true, partyId: true, name: true, phone: true, designation: true, dailyRate: true, userId: true, leftAt: true },
    })
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, 'EMPLOYEE_NOT_FOUND')
    }

    // Build patch — only present keys; null === "clear field".
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.phone !== undefined) data.phone = input.phone
    if (input.designation !== undefined) data.designation = input.designation
    if (input.dailyRatePaise !== undefined) data.dailyRate = input.dailyRatePaise
    if (input.userId !== undefined) data.userId = input.userId
    if (input.leftAt !== undefined) {
      data.leftAt = input.leftAt === null ? null : new Date(input.leftAt)
    }

    const employee = await tx.employee.update({
      where: { id },
      data,
    })

    // Mirror name/phone to paired Party so the STAFF row stays in sync.
    const partyPatch: Record<string, unknown> = {}
    if (input.name !== undefined) partyPatch.name = input.name
    if (input.phone !== undefined) partyPatch.phone = input.phone
    if (Object.keys(partyPatch).length > 0) {
      await tx.party.update({ where: { id: existing.partyId }, data: partyPatch })
    }

    // Audit: diff old vs new for the changed fields only.
    const diff: Record<string, { old: unknown; new: unknown }> = {}
    if (input.name !== undefined && input.name !== existing.name) {
      diff.name = { old: existing.name, new: input.name }
    }
    if (input.phone !== undefined && input.phone !== existing.phone) {
      diff.phone = { old: existing.phone, new: input.phone }
    }
    if (input.designation !== undefined && input.designation !== existing.designation) {
      diff.designation = { old: existing.designation, new: input.designation }
    }
    if (input.dailyRatePaise !== undefined && input.dailyRatePaise !== existing.dailyRate) {
      diff.dailyRate = { old: existing.dailyRate, new: input.dailyRatePaise }
    }
    if (input.userId !== undefined && input.userId !== existing.userId) {
      diff.userId = { old: existing.userId, new: input.userId }
    }
    if (input.leftAt !== undefined) {
      diff.leftAt = { old: existing.leftAt, new: input.leftAt }
    }

    await tx.auditLog.create({
      data: {
        businessId: actor.businessId,
        entityType: 'Employee',
        entityId: employee.id,
        entityLabel: employee.name,
        action: 'UPDATE',
        userId: actor.userId,
        changes: diff,
      },
    })

    return employee
  })
}

/** ─── deleteEmployee ────────────────────────────────────────────────────── */

/**
 * Soft-delete an Employee + its paired STAFF Party (architecture §8.5).
 *
 * Sets:
 *   Employee.isDeleted = true, deletedAt = now
 *   Party.isActive = false, isDeleted = true, deletedAt = now
 *
 * ONE tx — partial soft-delete forbidden.
 *
 * @throws AppError(NOT_FOUND, 404, 'EMPLOYEE_NOT_FOUND') — id missing or cross-tenant.
 */
export async function deleteEmployee(
  id: string,
  actor: EmployeeActor,
): Promise<Employee> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.employee.findFirst({
      where: { id, businessId: actor.businessId },
      select: { id: true, partyId: true, name: true, isDeleted: true },
    })
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 404, 'EMPLOYEE_NOT_FOUND')
    }

    const now = new Date()
    const employee = await tx.employee.update({
      where: { id },
      data: { isDeleted: true, deletedAt: now },
    })

    await tx.party.update({
      where: { id: existing.partyId },
      data: { isActive: false, isDeleted: true, deletedAt: now },
    })

    await tx.auditLog.create({
      data: {
        businessId: actor.businessId,
        entityType: 'Employee',
        entityId: id,
        entityLabel: existing.name,
        action: 'DELETE',
        userId: actor.userId,
        changes: { partyId: existing.partyId, softDeleted: true },
      },
    })

    return employee
  })
}

/** Re-export the read paths so callers have a single import surface. */
export { listEmployees, getEmployee } from './employee-list-get.js'
