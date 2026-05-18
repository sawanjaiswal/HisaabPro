/**
 * Payroll reverse — Phase 6 PR6 (architecture §8.3 + §18.7 row 150).
 *
 * Split out of payroll-run.service.ts to keep both files under the 250L cap
 * and the reverse path's P2002 catch / per-payroll loop / state-machine
 * update isolated from finalize.
 *
 * Reverse never writes negative paise. Per §8.3:
 *
 *   For each finalized Payroll in the run, write an inverse-direction-
 *   same-amount Payment(PAYROLL_IN) with `reversesPaymentId` pointing back
 *   at the original PAYROLL_OUT Payment. The @unique on reversesPaymentId
 *   enforces "no reversal-of-reversal" at the DB level — Prisma surfaces
 *   P2002, the service catches it, and translates to AppError(409,
 *   'PAYMENT_ALREADY_REVERSED').
 *
 * One AuditLog row per Payroll (action='REVERSE'), plus ONE final audit row
 * for the PayrollRun itself (action='REVERSE'). That mirrors finalize's
 * "one summary row + immutable per-payroll snapshots" pattern.
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §8.3 + schema.prisma:1263.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'
import { AppError, ErrorCode } from '../../lib/errors.js'

/** ─── Types ─────────────────────────────────────────────────────────────── */

export interface ReverseActor {
  userId: string
  businessId: string
}

export interface ReverseInput {
  /** PayrollRun.id to reverse. */
  payrollRunId: string
}

export interface ReverseResult {
  payrollRunId: string
  status: 'REVERSED'
  reversedCount: number
  totalReversedPaise: number
}

/** ─── reversePayrollRun ─────────────────────────────────────────────────── */

/**
 * Reverse a FINALIZED PayrollRun.
 *
 * @throws AppError(NOT_FOUND, 404, 'PAYROLL_RUN_NOT_FOUND')
 *         on missing id or cross-tenant.
 * @throws AppError(VALIDATION_ERROR, 422, 'PAYROLL_NOT_FINALIZED')
 *         when run.status !== 'FINALIZED' (DRAFT or already REVERSED).
 * @throws AppError(PAYROLL_ALREADY_REVERSED, 409, 'PAYMENT_ALREADY_REVERSED')
 *         when ANY constituent payment was already reversed — DB enforces
 *         the invariant via the `Payment.reversesPaymentId @unique`, the
 *         service catches Prisma P2002 and re-throws as the typed AppError.
 */
export async function reversePayrollRun(
  input: ReverseInput,
  actor: ReverseActor,
): Promise<ReverseResult> {
  // Tenant-scoped lookup outside the tx — finish reading before opening the
  // write tx so we hold the lock for the shortest possible window.
  const run = await prisma.payrollRun.findFirst({
    where: { id: input.payrollRunId, businessId: actor.businessId },
    select: { id: true, status: true },
  })
  if (!run) {
    throw new AppError(ErrorCode.NOT_FOUND, 404, 'PAYROLL_RUN_NOT_FOUND')
  }
  if (run.status === 'REVERSED') {
    throw new AppError(
      ErrorCode.PAYROLL_ALREADY_REVERSED,
      409,
      'PAYROLL_ALREADY_REVERSED',
      { payrollRunId: run.id },
    )
  }
  if (run.status !== 'FINALIZED') {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      422,
      'PAYROLL_NOT_FINALIZED',
      { payrollRunId: run.id, status: run.status },
    )
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Re-read inside the tx with the payments joined; tenant-scoped.
      const fullRun = await tx.payrollRun.findFirst({
        where: { id: input.payrollRunId, businessId: actor.businessId },
        select: {
          id: true,
          status: true,
          payrolls: {
            select: {
              id: true,
              status: true,
              payment: {
                select: { id: true, partyId: true, amount: true, mode: true },
              },
            },
          },
        },
      })
      if (!fullRun) {
        throw new AppError(ErrorCode.NOT_FOUND, 404, 'PAYROLL_RUN_NOT_FOUND')
      }

      const now = new Date()
      let reversedCount = 0
      let totalReversedPaise = 0

      for (const payroll of fullRun.payrolls) {
        // Skip payrolls without a Payment (legacy / partial drafts — should be
        // impossible for a FINALIZED run, but defensive).
        if (!payroll.payment) continue
        // Skip already-reversed child rows (defense-in-depth; the run-level
        // status check above is the primary gate).
        if (payroll.status === 'REVERSED') continue

        const reversal = await tx.payment.create({
          data: {
            businessId: actor.businessId,
            type: 'PAYROLL_IN', // inverse direction
            partyId: payroll.payment.partyId, // SAME STAFF Party (§8.5)
            amount: payroll.payment.amount, // positive paise — same magnitude
            date: now,
            mode: payroll.payment.mode,
            reversesPaymentId: payroll.payment.id, // FK back to original
            notes: `Reversal of payroll #${payroll.id}`,
            createdBy: actor.userId,
          },
        })

        await tx.payroll.update({
          where: { id: payroll.id },
          data: { status: 'REVERSED' },
        })

        await tx.auditLog.create({
          data: {
            businessId: actor.businessId,
            entityType: 'Payroll',
            entityId: payroll.id,
            entityLabel: `payroll:${payroll.id}`,
            action: 'REVERSE',
            userId: actor.userId,
            changes: {
              reversalPaymentId: reversal.id,
              originalPaymentId: payroll.payment.id,
              amountPaise: payroll.payment.amount,
            },
          },
        })

        reversedCount += 1
        totalReversedPaise += payroll.payment.amount
      }

      await tx.payrollRun.update({
        where: { id: fullRun.id },
        data: { status: 'REVERSED' },
      })

      // ONE summary row for the run itself (matches finalize's pattern).
      await tx.auditLog.create({
        data: {
          businessId: actor.businessId,
          entityType: 'PayrollRun',
          entityId: fullRun.id,
          entityLabel: `payroll-run:${fullRun.id}`,
          action: 'REVERSE',
          userId: actor.userId,
          changes: {
            reversedCount,
            totalReversedPaise,
          },
        },
      })

      return {
        payrollRunId: fullRun.id,
        status: 'REVERSED' as const,
        reversedCount,
        totalReversedPaise,
      }
    })
  } catch (e: unknown) {
    // v2.3 A04.1 — second reverse of the same payment trips the
    // @unique(reversesPaymentId). Translate Prisma's P2002 to the
    // typed 409 the FE shows as "Already reversed".
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = ((e.meta?.target as readonly string[] | undefined) ?? []) as readonly string[]
      if (target.includes('reversesPaymentId')) {
        throw new AppError(
          ErrorCode.PAYROLL_ALREADY_REVERSED,
          409,
          'PAYMENT_ALREADY_REVERSED',
          { payrollRunId: input.payrollRunId },
        )
      }
    }
    throw e
  }
}
