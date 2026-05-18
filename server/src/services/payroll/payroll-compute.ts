/**
 * Payroll compute — Phase 6 PR6 (architecture §8 + §18.7 row 147).
 *
 *   computePayrollLine(...) — PURE FUNCTION. No Prisma, no I/O. Takes an
 *     Employee, its Attendance rows, and its outstanding EmployeeAdvance
 *     rows, returns the deterministic Payroll line item (presentDays,
 *     halfDays, overtimeMin, advance/deductions/gross/net, all paise).
 *     Tested exhaustively in payroll-compute.test.ts — every paise must
 *     reproduce exactly.
 *
 * The Prisma orchestrator (computePayrollPreview) lives in payroll-preview.ts
 * to keep this file's pure-math surface under the 250L cap and untainted by
 * I/O imports.
 *
 * ────────────────────────────────────────────────────────────────────────
 *  FORMULA (architecture §8):
 *
 *    presentDays   = count(PRESENT) + count(LEAVE_PAID)
 *    halfDays      = count(HALF_DAY)
 *    overtimeMin   = SUM(overtimeMin) for PRESENT/HALF_DAY/LEAVE_PAID
 *    basePaise     = presentDays * dailyRate
 *    halfPayPaise  = halfDays   * floor(dailyRate / 2)
 *    overtimePay   = floor((overtimeMin / 60) * (dailyRate / 8))   // 8-hour day
 *    grossPaise    = basePaise + halfPayPaise + overtimePay
 *    advanceTotal  = SUM(advance.amount) for advances WHERE paidBackAt IS NULL
 *                   AND grantedAt <= toDate
 *    netPaise      = max(0, grossPaise - advanceTotal - deductionsPaise)
 *
 *  Everything in PAISE (Int). Math.floor at each division to stay integer-
 *  safe — JavaScript floating-point is never trusted with money. The net
 *  is clamped to 0 (we never pay a negative payroll line — a too-large
 *  advance is surfaced via the advanceTotal field).
 * ────────────────────────────────────────────────────────────────────────
 */

import type { Employee, Attendance, EmployeeAdvance } from '@prisma/client'

/** Standard 8-hour day for overtime-per-minute math (architecture §8 formula). */
export const OVERTIME_HOURS_PER_DAY = 8

/** ─── Types ─────────────────────────────────────────────────────────────── */

export interface ComputeLineInput {
  employee: Pick<Employee, 'id' | 'name' | 'dailyRate' | 'partyId'>
  attendances: ReadonlyArray<Pick<Attendance, 'status' | 'overtimeMin'>>
  advances: ReadonlyArray<Pick<EmployeeAdvance, 'amount' | 'grantedAt' | 'paidBackAt'>>
  /** Defaults to 0 — caller can override for manual adjustments. */
  deductionsPaise?: number
  /** Inclusive upper bound used to filter advances by grantedAt. */
  toDate: Date
}

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

/** ─── computePayrollLine (PURE) ─────────────────────────────────────────── */

/**
 * Deterministic per-employee payroll line. Pure function — no I/O.
 *
 * Inputs MUST be tenant-scoped by the caller; this function does not validate
 * that attendances/advances belong to the supplied employee or business.
 */
export function computePayrollLine(input: ComputeLineInput): PayrollLine {
  const { employee, attendances, advances, toDate } = input
  const deductionsPaise = input.deductionsPaise ?? 0

  let presentDays = 0
  let halfDays = 0
  let overtimeMin = 0

  for (const a of attendances) {
    if (a.status === 'PRESENT' || a.status === 'LEAVE_PAID') {
      presentDays += 1
    } else if (a.status === 'HALF_DAY') {
      halfDays += 1
    }
    // ABSENT and LEAVE_UNPAID contribute zero — including their overtimeMin
    // would be a footgun (an "absent" with 60 minutes of overtime makes no
    // physical sense). Only count overtimeMin from days actually worked.
    if (a.status === 'PRESENT' || a.status === 'HALF_DAY' || a.status === 'LEAVE_PAID') {
      overtimeMin += a.overtimeMin
    }
  }

  const dailyRate = employee.dailyRate
  const basePaise = presentDays * dailyRate
  const halfPayPaise = halfDays * Math.floor(dailyRate / 2)
  // overtimePay = (overtimeMin / 60h) * (dailyRate / 8h). Single floor at the
  // end to keep integer math; ordering matters for exact reproducibility.
  const overtimePayPaise = Math.floor(
    (overtimeMin * dailyRate) / (60 * OVERTIME_HOURS_PER_DAY),
  )
  const grossPaise = basePaise + halfPayPaise + overtimePayPaise

  const toDateMs = toDate.getTime()
  let advanceTotalPaise = 0
  for (const adv of advances) {
    if (adv.paidBackAt !== null) continue
    if (adv.grantedAt.getTime() > toDateMs) continue
    advanceTotalPaise += adv.amount
  }

  const netPaise = Math.max(0, grossPaise - advanceTotalPaise - deductionsPaise)

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    partyId: employee.partyId,
    presentDays,
    halfDays,
    overtimeMin,
    basePaise,
    halfPayPaise,
    overtimePayPaise,
    grossPaise,
    advanceTotalPaise,
    deductionsPaise,
    netPaise,
  }
}

/** Re-export the orchestrator so callers have a single import surface. */
export {
  computePayrollPreview,
  type ComputePreviewInput,
  type PreviewResult,
} from './payroll-preview.js'
