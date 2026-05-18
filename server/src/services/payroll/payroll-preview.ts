/**
 * Payroll preview orchestrator — Phase 6 PR6 (architecture §8).
 *
 * Split out of payroll-compute.ts so that file's pure-function surface
 * (computePayrollLine) stays focused on the deterministic math, and the
 * Prisma-touching orchestrator lives here. The split also keeps both files
 * under the 250L cap.
 *
 * computePayrollPreview is used by:
 *   - the /api/payroll/run/preview route (dry run, no writes)
 *   - finalizePayrollRun (re-runs preview inside the FINALIZE tx so the
 *     persisted lines reproduce exactly what the user previewed)
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { computePayrollLine, type PayrollLine } from './payroll-compute.js'
import type { Attendance, EmployeeAdvance } from '@prisma/client'

export interface ComputePreviewInput {
  businessId: string
  fromDate: string // yyyy-mm-dd
  toDate: string // yyyy-mm-dd
  employeeIds?: string[]
}

export interface PreviewResult {
  fromDate: string
  toDate: string
  lines: PayrollLine[]
  totals: {
    grossPaise: number
    netPaise: number
    count: number
  }
}

/**
 * Fetch + compute preview for a date range, tenant-scoped.
 *
 * NO WRITES — used by the preview route AND internally by finalize to compute
 * the lines that get persisted as Payroll rows. The lines returned here
 * deterministically reproduce when finalize re-runs, so a preview-then-finalize
 * call with the same period yields identical numbers.
 *
 * @throws AppError(VALIDATION_ERROR, 400) on inverted range / bad date string.
 */
export async function computePayrollPreview(
  input: ComputePreviewInput,
): Promise<PreviewResult> {
  const fromDate = new Date(input.fromDate)
  const toDate = new Date(input.toDate)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'Invalid date format')
  }
  if (fromDate > toDate) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'fromDate must be on or before toDate')
  }

  // Tenant-scoped employee fetch; optional id filter narrows further.
  const employees = await prisma.employee.findMany({
    where: {
      businessId: input.businessId,
      isDeleted: false,
      ...(input.employeeIds && input.employeeIds.length > 0
        ? { id: { in: input.employeeIds } }
        : {}),
    },
    select: { id: true, name: true, dailyRate: true, partyId: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })

  if (employees.length === 0) {
    return {
      fromDate: input.fromDate,
      toDate: input.toDate,
      lines: [],
      totals: { grossPaise: 0, netPaise: 0, count: 0 },
    }
  }

  const employeeIds = employees.map((e) => e.id)

  // Fetch attendance + advances for the date window. Both tenant-scoped via
  // businessId AND filtered to employeeIds for an extra defense layer.
  const [attendances, advances] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        businessId: input.businessId,
        employeeId: { in: employeeIds },
        date: { gte: fromDate, lte: toDate },
      },
      select: { employeeId: true, status: true, overtimeMin: true },
    }),
    prisma.employeeAdvance.findMany({
      where: {
        businessId: input.businessId,
        employeeId: { in: employeeIds },
        paidBackAt: null,
        grantedAt: { lte: toDate },
      },
      select: { employeeId: true, amount: true, grantedAt: true, paidBackAt: true },
    }),
  ])

  // Index by employeeId for O(N) fold.
  const attByEmployee = new Map<string, Array<Pick<Attendance, 'status' | 'overtimeMin'>>>()
  for (const a of attendances) {
    const arr = attByEmployee.get(a.employeeId) ?? []
    arr.push({ status: a.status, overtimeMin: a.overtimeMin })
    attByEmployee.set(a.employeeId, arr)
  }
  const advByEmployee = new Map<
    string,
    Array<Pick<EmployeeAdvance, 'amount' | 'grantedAt' | 'paidBackAt'>>
  >()
  for (const a of advances) {
    const arr = advByEmployee.get(a.employeeId) ?? []
    arr.push({ amount: a.amount, grantedAt: a.grantedAt, paidBackAt: a.paidBackAt })
    advByEmployee.set(a.employeeId, arr)
  }

  const lines: PayrollLine[] = []
  let totalGross = 0
  let totalNet = 0
  for (const e of employees) {
    const line = computePayrollLine({
      employee: e,
      attendances: attByEmployee.get(e.id) ?? [],
      advances: advByEmployee.get(e.id) ?? [],
      toDate,
    })
    lines.push(line)
    totalGross += line.grossPaise
    totalNet += line.netPaise
  }

  return {
    fromDate: input.fromDate,
    toDate: input.toDate,
    lines,
    totals: { grossPaise: totalGross, netPaise: totalNet, count: lines.length },
  }
}
