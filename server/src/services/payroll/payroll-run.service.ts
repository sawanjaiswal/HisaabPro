/**
 * Payroll run service — Phase 6 PR6 (architecture §8.1 + §18.7 row 149).
 *
 * Two operations:
 *
 *   previewPayrollRun(...)  — thin wrapper around computePayrollPreview;
 *                             no writes, no audit. The route enforces the
 *                             rate-limit; the service stays a pure delegator.
 *
 *   finalizePayrollRun(...) — the BIG $transaction (§8.1):
 *
 *       1. Detect period overlap → 409 PAYROLL_PERIOD_OVERLAP via the
 *          @@unique([businessId, fromDate, toDate]) on PayrollRun.
 *       2. Re-run computePayrollPreview INSIDE the tx so finalize numbers
 *          deterministically match the preview the user saw.
 *       3. Create PayrollRun (status=FINALIZED, totalNet aggregated).
 *       4. For each line: create Payment(PAYROLL_OUT) → Payroll → PayslipSnapshot.
 *       5. ONE AuditLog row for the whole run (entityType='PayrollRun',
 *          action='FINALIZE') containing aggregate stats. Per-payroll detail
 *          lives in the immutable PayslipSnapshot JSON — we do not need
 *          N rows of audit when the snapshot is the legal record.
 *
 * Reverse lives in payroll-run-reverse.ts so this file stays under the cap
 * AND the reverse codepath's P2002 catch + per-payroll audit + run-status
 * update stays focused on one responsibility.
 *
 * Audit-coverage SSOT: services/payroll/payroll-run.service.ts is listed in
 * server/src/lib/audit/audit-coverage.ts — every mutation here MUST write an
 * `auditLog.create` row inside its `$transaction`.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §8 + schema.prisma:4003-4072.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import {
  computePayrollPreview,
  type ComputePreviewInput,
  type PreviewResult,
} from './payroll-compute.js'
import { buildSnapshotPayload } from './payroll-snapshot.js'
import type { PayrollPaymentMode } from '../../schemas/payroll.schemas.js'

/** ─── Types ─────────────────────────────────────────────────────────────── */

export interface FinalizeActor {
  userId: string
  businessId: string
  businessName: string
  businessPhone?: string | null
}

export interface FinalizePayrollInput extends ComputePreviewInput {
  /** Defaults to 'CASH' if omitted. */
  mode?: PayrollPaymentMode
}

export interface FinalizeResult {
  payrollRunId: string
  status: 'FINALIZED'
  totalNetPaise: number
  count: number
}

/** ─── previewPayrollRun ─────────────────────────────────────────────────── */

/**
 * No-op wrapper so the route imports stay symmetric with finalize/reverse.
 * The pure-compute path is `payroll-compute.computePayrollPreview` — keep
 * the route from depending on the compute module directly so swapping the
 * orchestrator later doesn't churn route imports.
 */
export async function previewPayrollRun(
  input: ComputePreviewInput,
): Promise<PreviewResult> {
  return computePayrollPreview(input)
}

/** ─── finalizePayrollRun ────────────────────────────────────────────────── */

/**
 * Finalize a PayrollRun for the given period — writes everything in ONE tx
 * per architecture §8.1.
 *
 * @throws AppError(VALIDATION_ERROR, 409, 'PAYROLL_PERIOD_OVERLAP')
 *         on the @@unique([businessId, fromDate, toDate]) violation.
 * @throws AppError(VALIDATION_ERROR, 400, 'NO_PAYABLE_LINES')
 *         when computePayrollPreview returns zero lines — calling finalize
 *         on an empty period is almost always an UI bug; refuse rather than
 *         persist an empty PayrollRun.
 */
export async function finalizePayrollRun(
  input: FinalizePayrollInput,
  actor: FinalizeActor,
): Promise<FinalizeResult> {
  const mode: PayrollPaymentMode = input.mode ?? 'CASH'

  // Compute OUTSIDE the tx — read load is the same as preview (heavy), no
  // reason to hold a write tx open while we aggregate. The same query runs
  // again on the next preview call; only the WRITE portion needs atomicity.
  const preview = await computePayrollPreview(input)
  if (preview.lines.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'NO_PAYABLE_LINES')
  }

  const totalNetPaise = preview.totals.netPaise
  const finalizedAt = new Date()
  const fromDate = new Date(input.fromDate)
  const toDate = new Date(input.toDate)

  try {
    return await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          businessId: actor.businessId,
          fromDate,
          toDate,
          status: 'FINALIZED',
          totalNet: totalNetPaise,
          finalizedAt,
          finalizedById: actor.userId,
          createdById: actor.userId,
        },
      })

      // Fetch employees once for snapshot payload (party + designation fields).
      const employeeIds = preview.lines.map((l) => l.employeeId)
      const employees = await tx.employee.findMany({
        where: { businessId: actor.businessId, id: { in: employeeIds } },
        select: { id: true, name: true, phone: true, designation: true, partyId: true, dailyRate: true },
      })
      const empById = new Map(employees.map((e) => [e.id, e]))

      for (const line of preview.lines) {
        const emp = empById.get(line.employeeId)
        if (!emp) {
          // Defensive — preview already filtered to live employees; if a row
          // vanished between preview + finalize the tx must abort.
          throw new AppError(ErrorCode.VALIDATION_ERROR, 400, 'EMPLOYEE_VANISHED_DURING_FINALIZE')
        }

        const payment = await tx.payment.create({
          data: {
            businessId: actor.businessId,
            type: 'PAYROLL_OUT',
            partyId: emp.partyId, // §8.5 — paired STAFF Party
            amount: line.netPaise,
            date: finalizedAt,
            mode,
            notes: `Payroll for ${emp.name}, ${input.fromDate} to ${input.toDate}`,
            createdBy: actor.userId,
          },
        })

        const payroll = await tx.payroll.create({
          data: {
            businessId: actor.businessId,
            payrollRunId: run.id,
            employeeId: emp.id,
            presentDays: line.presentDays,
            halfDays: line.halfDays,
            overtimeMin: line.overtimeMin,
            advanceTotalPaise: line.advanceTotalPaise,
            deductionsPaise: line.deductionsPaise,
            grossPaise: line.grossPaise,
            netPaise: line.netPaise,
            paymentId: payment.id,
            status: 'FINALIZED',
          },
        })

        const snapshotPayload = buildSnapshotPayload({
          business: { id: actor.businessId, name: actor.businessName, phone: actor.businessPhone },
          employee: {
            id: emp.id,
            name: emp.name,
            phone: emp.phone,
            designation: emp.designation,
            dailyRatePaise: emp.dailyRate,
          },
          period: { fromDate: input.fromDate, toDate: input.toDate },
          computedLine: line,
          payment: { id: payment.id, mode, date: finalizedAt.toISOString() },
          finalizedAt,
          finalizedBy: { userId: actor.userId, name: null },
        })

        await tx.payslipSnapshot.create({
          data: {
            businessId: actor.businessId,
            payrollId: payroll.id,
            payload: snapshotPayload as unknown as Prisma.InputJsonValue,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          businessId: actor.businessId,
          entityType: 'PayrollRun',
          entityId: run.id,
          entityLabel: `${input.fromDate}..${input.toDate}`,
          action: 'FINALIZE',
          userId: actor.userId,
          changes: {
            fromDate: input.fromDate,
            toDate: input.toDate,
            totalNetPaise,
            employeeCount: preview.lines.length,
            mode,
          },
        },
      })

      return {
        payrollRunId: run.id,
        status: 'FINALIZED' as const,
        totalNetPaise,
        count: preview.lines.length,
      }
    })
  } catch (e: unknown) {
    // P2002 on the @@unique([businessId, fromDate, toDate]) → 409 overlap.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = ((e.meta?.target as readonly string[] | undefined) ?? []) as readonly string[]
      if (target.includes('fromDate') || target.includes('toDate')) {
        throw new AppError(
          ErrorCode.PAYROLL_PERIOD_OVERLAP,
          409,
          'PAYROLL_PERIOD_OVERLAP',
          { fromDate: input.fromDate, toDate: input.toDate },
        )
      }
    }
    throw e
  }
}

/** Re-export reverse so callers have a single import surface. */
export { reversePayrollRun } from './payroll-run-reverse.js'
