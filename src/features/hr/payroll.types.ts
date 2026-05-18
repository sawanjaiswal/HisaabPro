/** Payroll types — Phase 6 PR6 FE
 *
 * Wire shapes mirror the BE services:
 *   - server/src/services/payroll/payroll-compute.ts   (PayrollLine, fields)
 *   - server/src/services/payroll/payroll-preview.ts   (PreviewResult, totals)
 *   - server/src/services/payroll/payroll-run.service.ts (FinalizeResult)
 *   - server/src/services/payroll/payroll-run-reverse.ts (ReverseResult)
 *   - server/src/services/payroll/payroll-snapshot.ts  (SnapshotPayload)
 *
 * All money fields are PAISE (Int). ISO datetime strings on the wire.
 */

import type { PayrollPaymentMode, PayrollRunStatus } from './hr.constants'

// ─── Preview ─────────────────────────────────────────────────────────────────

export interface PayrollPreviewRequest {
  fromDate: string // yyyy-mm-dd
  toDate: string   // yyyy-mm-dd
  employeeIds?: string[]
}

/** One line of preview output — matches BE `PayrollLine` field-for-field. */
export interface PayrollLine {
  employeeId: string
  employeeName: string
  partyId: string
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

export interface PayrollPreviewTotals {
  grossPaise: number
  netPaise: number
  count: number
}

export interface PayrollPreviewResult {
  fromDate: string
  toDate: string
  lines: PayrollLine[]
  totals: PayrollPreviewTotals
}

// ─── Finalize ────────────────────────────────────────────────────────────────

export interface PayrollFinalizeRequest extends PayrollPreviewRequest {
  /** Defaults to 'CASH' on the BE when omitted. */
  mode?: PayrollPaymentMode
}

export interface PayrollFinalizeResult {
  payrollRunId: string
  status: 'FINALIZED'
  totalNetPaise: number
  count: number
}

// ─── Reverse ─────────────────────────────────────────────────────────────────

export interface PayrollReverseResult {
  payrollRunId: string
  status: 'REVERSED'
  reversedCount: number
  totalReversedPaise: number
}

// ─── Payslip snapshot (GET /payroll/:id/snapshot) ────────────────────────────

export interface PayslipSnapshotBusiness {
  id: string
  name: string
  phone?: string | null
}

export interface PayslipSnapshotEmployee {
  id: string
  name: string
  phone?: string | null
  designation?: string | null
  dailyRatePaise: number
}

export interface PayslipSnapshotPeriod {
  fromDate: string
  toDate: string
}

export interface PayslipSnapshotPayment {
  id: string
  mode: string
  date: string // ISO
}

export interface PayslipSnapshotFinalizedBy {
  userId: string
  name?: string | null
}

/** The denormalised line breakdown as persisted at FINALIZE time. */
export interface PayslipSnapshotLines {
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

/** Immutable JSON written to PayslipSnapshot.payload at finalize time. */
export interface PayslipSnapshotPayload {
  schemaVersion: number
  business: PayslipSnapshotBusiness
  employee: PayslipSnapshotEmployee
  period: PayslipSnapshotPeriod
  lines: PayslipSnapshotLines
  payment: PayslipSnapshotPayment
  finalizedAt: string // ISO
  finalizedBy: PayslipSnapshotFinalizedBy
}

/** GET /api/payroll/:id/snapshot — wrapped result. */
export interface PayslipSnapshotResponse {
  payroll: {
    id: string
    payrollRunId: string
    employeeId: string
    netPaise: number
    status: PayrollRunStatus
  }
  snapshot: PayslipSnapshotPayload
}

// ─── Wizard state ────────────────────────────────────────────────────────────

/** Lives only in component state — never persisted. */
export interface PayrollWizardState {
  fromDate: string
  toDate: string
  employeeIds: string[]   // empty = all employees
  mode: PayrollPaymentMode
}
