/**
 * Employee read paths — Phase 6 PR6 (architecture §4 + §18.7).
 *
 * Split out of employee.service.ts to keep that file under the 250L cap and
 * its responsibility focused on the audit-writing mutations (createEmployee /
 * updateEmployee / deleteEmployee — the trio enumerated in audit-coverage
 * SSOT). Pure-read paths live here.
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type {
  EmployeeActor,
  EmployeeListResult,
  ListEmployeesInput,
} from './employee.types.js'
import type { Employee } from '@prisma/client'

/**
 * Cursor-paginated list, tenant-scoped. Default hides soft-deleted rows.
 *
 * Cursor is an Employee.id — we fetch `limit + 1` and pop the spillover for
 * `nextCursor`. Sort is `name asc, id asc` for stable ordering.
 */
export async function listEmployees(
  input: ListEmployeesInput,
  actor: EmployeeActor,
): Promise<EmployeeListResult> {
  const limit = input.limit ?? 20
  const isDeleted = input.isDeleted ?? false

  const where: Record<string, unknown> = {
    businessId: actor.businessId,
    isDeleted,
  }
  if (input.q) {
    where.name = { contains: input.q, mode: 'insensitive' }
  }

  const rows = await prisma.employee.findMany({
    where,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  })

  let nextCursor: string | null = null
  if (rows.length > limit) {
    const spill = rows.pop()!
    nextCursor = spill.id
  }
  return { rows, nextCursor }
}

/**
 * Find one Employee by id, tenant-scoped.
 *
 * @throws AppError(NOT_FOUND, 404, 'EMPLOYEE_NOT_FOUND') if missing or cross-tenant.
 */
export async function getEmployee(
  id: string,
  actor: EmployeeActor,
): Promise<Employee> {
  const employee = await prisma.employee.findFirst({
    where: { id, businessId: actor.businessId },
  })
  if (!employee) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'EMPLOYEE_NOT_FOUND')
  }
  return employee
}
