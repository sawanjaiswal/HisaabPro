/**
 * Payslip snapshot — Phase 6 PR6 (architecture §8.1 + §18.7 row 148).
 *
 * Builds + reads the immutable JSON record written to PayslipSnapshot at
 * Payroll FINALIZE time. The snapshot is the LEGAL payslip — once written it
 * MUST NOT be mutated by subsequent Employee/Business edits. Downstream PDF
 * generation + sharing read from the snapshot, never from live tables.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §8 + schema.prisma:4062.
 */

import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import type { PayrollLine } from './payroll-compute.js'

/** ─── Types ─────────────────────────────────────────────────────────────── */

export const PAYSLIP_SCHEMA_VERSION = 1

export interface SnapshotBusiness {
  id: string
  name: string
  phone?: string | null
}

export interface SnapshotEmployee {
  id: string
  name: string
  phone?: string | null
  designation?: string | null
  dailyRatePaise: number
}

export interface SnapshotPeriod {
  fromDate: string
  toDate: string
}

export interface SnapshotPayment {
  id: string
  mode: string
  date: string // ISO
}

export interface SnapshotFinalizedBy {
  userId: string
  name?: string | null
}

export interface BuildSnapshotInput {
  business: SnapshotBusiness
  employee: SnapshotEmployee
  period: SnapshotPeriod
  computedLine: PayrollLine
  payment: SnapshotPayment
  finalizedAt: Date
  finalizedBy: SnapshotFinalizedBy
}

export interface SnapshotPayload {
  schemaVersion: number
  business: SnapshotBusiness
  employee: SnapshotEmployee
  period: SnapshotPeriod
  lines: {
    presentDays: number
    halfDays: number
    overtimeMin: number
    basePaise: number
    halfPayPaise: number
    overtimePayPaise: number
    grossPaise: number
    advanceTotalPaise: number
    deductionsPaise: number
    netPaise: number
  }
  payment: SnapshotPayment
  finalizedAt: string // ISO
  finalizedBy: SnapshotFinalizedBy
}

/** ─── buildSnapshotPayload (PURE) ───────────────────────────────────────── */

/**
 * Compose the snapshot JSON. Pure — no I/O. Caller persists via
 * `tx.payslipSnapshot.create({ data: { businessId, payrollId, payload } })`.
 */
export function buildSnapshotPayload(input: BuildSnapshotInput): SnapshotPayload {
  const { computedLine } = input
  return {
    schemaVersion: PAYSLIP_SCHEMA_VERSION,
    business: input.business,
    employee: input.employee,
    period: input.period,
    lines: {
      presentDays: computedLine.presentDays,
      halfDays: computedLine.halfDays,
      overtimeMin: computedLine.overtimeMin,
      basePaise: computedLine.basePaise,
      halfPayPaise: computedLine.halfPayPaise,
      overtimePayPaise: computedLine.overtimePayPaise,
      grossPaise: computedLine.grossPaise,
      advanceTotalPaise: computedLine.advanceTotalPaise,
      deductionsPaise: computedLine.deductionsPaise,
      netPaise: computedLine.netPaise,
    },
    payment: input.payment,
    finalizedAt: input.finalizedAt.toISOString(),
    finalizedBy: input.finalizedBy,
  }
}

/** ─── getPayslipSnapshot ────────────────────────────────────────────────── */

export interface GetSnapshotInput {
  businessId: string
  /** Caller may pass either a Payroll.id (preferred) or a PayslipSnapshot.id. */
  payrollId: string
}

export interface GetSnapshotResult {
  payroll: {
    id: string
    payrollRunId: string
    employeeId: string
    netPaise: number
    status: string
  }
  snapshot: SnapshotPayload
}

/**
 * Load the snapshot for a given Payroll, tenant-scoped.
 *
 * Throws NOT_FOUND if:
 *   - the Payroll id does not exist
 *   - the Payroll belongs to another business (cross-tenant)
 *   - the snapshot was never written (Payroll still in DRAFT, no FINALIZE yet)
 */
export async function getPayslipSnapshot(
  input: GetSnapshotInput,
): Promise<GetSnapshotResult> {
  const payroll = await prisma.payroll.findFirst({
    where: { id: input.payrollId, businessId: input.businessId },
    select: {
      id: true,
      payrollRunId: true,
      employeeId: true,
      netPaise: true,
      status: true,
      snapshot: { select: { payload: true } },
    },
  })

  if (!payroll) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'PAYROLL_NOT_FOUND')
  }
  if (!payroll.snapshot) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'PAYSLIP_SNAPSHOT_NOT_FOUND')
  }

  return {
    payroll: {
      id: payroll.id,
      payrollRunId: payroll.payrollRunId,
      employeeId: payroll.employeeId,
      netPaise: payroll.netPaise,
      status: payroll.status,
    },
    snapshot: payroll.snapshot.payload as unknown as SnapshotPayload,
  }
}
