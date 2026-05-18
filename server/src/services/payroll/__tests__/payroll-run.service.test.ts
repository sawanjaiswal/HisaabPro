/**
 * payroll-run.service tests — Phase 6 PR6 (architecture §8.1 + §8.3 + §18.7).
 *
 * Covers:
 *   - finalizePayrollRun — happy path writes PayrollRun + Payment(PAYROLL_OUT)
 *                          + Payroll + PayslipSnapshot + AuditLog per line
 *   - finalizePayrollRun — empty preview → 400 NO_PAYABLE_LINES (no writes)
 *   - finalizePayrollRun — P2002 on (businessId, fromDate, toDate) → 409
 *                          PAYROLL_PERIOD_OVERLAP
 *   - finalizePayrollRun — mode defaults to CASH when omitted
 *   - finalizePayrollRun — every write tenant-scoped to actor.businessId
 *
 *   - reversePayrollRun  — happy path writes inverse PAYROLL_IN Payment per
 *                          finalized Payroll + audit row + flips PayrollRun status
 *   - reversePayrollRun  — DRAFT run → 422 PAYROLL_NOT_FINALIZED (no writes)
 *   - reversePayrollRun  — already REVERSED → 409 PAYROLL_ALREADY_REVERSED
 *   - reversePayrollRun  — P2002 on Payment.reversesPaymentId → 409
 *                          PAYMENT_ALREADY_REVERSED
 *   - reversePayrollRun  — 404 PAYROLL_RUN_NOT_FOUND on missing / cross-tenant
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  finalizePayrollRun,
  reversePayrollRun,
} from '../payroll-run.service.js'
import { prisma } from '../../../lib/prisma.js'

const mockPrisma = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>

const BUSINESS_ID = 'biz-test-1'
const ACTOR = 'user-actor-1'

const ACTOR_CTX = {
  userId: ACTOR,
  businessId: BUSINESS_ID,
  businessName: 'Anil Traders',
  businessPhone: '+919876543210',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── finalizePayrollRun — happy + writes ────────────────────────────────────

describe('finalizePayrollRun — happy path', () => {
  function setupHappyMocks() {
    // computePayrollPreview reads: employee + attendance + advance
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'Anil', dailyRate: 50_000, partyId: 'party-1' },
    ])
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'emp-1', status: 'PRESENT', overtimeMin: 0 },
      { employeeId: 'emp-1', status: 'PRESENT', overtimeMin: 0 },
    ])
    mockPrisma.employeeAdvance.findMany.mockResolvedValue([])

    // FINALIZE tx writes
    mockPrisma.payrollRun.create.mockResolvedValue({ id: 'run-1' })
    // employee-by-ids fetched again inside the tx for snapshot payload
    mockPrisma.employee.findMany.mockResolvedValueOnce([
      { id: 'emp-1', name: 'Anil', dailyRate: 50_000, partyId: 'party-1' },
    ])
    mockPrisma.employee.findMany.mockResolvedValueOnce([
      {
        id: 'emp-1',
        name: 'Anil',
        phone: '+919999999999',
        designation: 'Driver',
        partyId: 'party-1',
        dailyRate: 50_000,
      },
    ])
    mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1' })
    mockPrisma.payroll.create.mockResolvedValue({ id: 'payroll-1' })
    mockPrisma.payslipSnapshot.create.mockResolvedValue({ id: 'snap-1' })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' })
  }

  it('writes PayrollRun + N Payment(PAYROLL_OUT) + N Payroll + N PayslipSnapshot + 1 AuditLog', async () => {
    setupHappyMocks()

    const out = await finalizePayrollRun(
      { businessId: BUSINESS_ID, fromDate: '2026-05-01', toDate: '2026-05-31' },
      ACTOR_CTX,
    )

    expect(out.payrollRunId).toBe('run-1')
    expect(out.status).toBe('FINALIZED')
    expect(out.count).toBe(1)
    expect(out.totalNetPaise).toBe(100_000) // 2 PRESENT * 50_000 paise

    // PayrollRun.create tenant-scoped, FINALIZED, totalNet wired
    expect(mockPrisma.payrollRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        status: 'FINALIZED',
        totalNet: 100_000,
        createdById: ACTOR,
        finalizedById: ACTOR,
      }),
    })

    // Payment.create — type=PAYROLL_OUT, partyId=paired STAFF, positive paise
    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        type: 'PAYROLL_OUT',
        partyId: 'party-1',
        amount: 100_000,
        mode: 'CASH',
        createdBy: ACTOR,
      }),
    })

    // Payroll.create wires paymentId, status=FINALIZED, paise mirrored
    expect(mockPrisma.payroll.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        payrollRunId: 'run-1',
        employeeId: 'emp-1',
        paymentId: 'pay-1',
        netPaise: 100_000,
        grossPaise: 100_000,
        status: 'FINALIZED',
      }),
    })

    // PayslipSnapshot.create on payrollId
    expect(mockPrisma.payslipSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        payrollId: 'payroll-1',
        payload: expect.any(Object),
      }),
    })

    // ONE summary audit row on the PayrollRun
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        entityType: 'PayrollRun',
        entityId: 'run-1',
        action: 'FINALIZE',
        userId: ACTOR,
        changes: expect.objectContaining({
          totalNetPaise: 100_000,
          employeeCount: 1,
          mode: 'CASH',
        }),
      }),
    })
  })

  it('defaults mode to CASH when omitted', async () => {
    setupHappyMocks()
    await finalizePayrollRun(
      { businessId: BUSINESS_ID, fromDate: '2026-05-01', toDate: '2026-05-31' },
      ACTOR_CTX,
    )
    const call = mockPrisma.payment.create.mock.calls[0]![0] as { data: { mode: string } }
    expect(call.data.mode).toBe('CASH')
  })

  it('uses caller-supplied mode when present', async () => {
    setupHappyMocks()
    await finalizePayrollRun(
      {
        businessId: BUSINESS_ID,
        fromDate: '2026-05-01',
        toDate: '2026-05-31',
        mode: 'UPI',
      },
      ACTOR_CTX,
    )
    const call = mockPrisma.payment.create.mock.calls[0]![0] as { data: { mode: string } }
    expect(call.data.mode).toBe('UPI')
  })
})

// ─── finalizePayrollRun — refusal paths ─────────────────────────────────────

describe('finalizePayrollRun — refusal paths', () => {
  it('empty preview → 400 NO_PAYABLE_LINES, no writes', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([]) // no employees, no lines

    await expect(
      finalizePayrollRun(
        { businessId: BUSINESS_ID, fromDate: '2026-05-01', toDate: '2026-05-31' },
        ACTOR_CTX,
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'NO_PAYABLE_LINES',
    })

    expect(mockPrisma.payrollRun.create).not.toHaveBeenCalled()
    expect(mockPrisma.payment.create).not.toHaveBeenCalled()
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('P2002 on (businessId, fromDate, toDate) → 409 PAYROLL_PERIOD_OVERLAP', async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 'emp-1', name: 'X', dailyRate: 1, partyId: 'p1' },
    ])
    mockPrisma.attendance.findMany.mockResolvedValue([
      { employeeId: 'emp-1', status: 'PRESENT', overtimeMin: 0 },
    ])
    mockPrisma.employeeAdvance.findMany.mockResolvedValue([])

    // PayrollRun.create throws P2002 on the @@unique
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test', meta: { target: ['businessId', 'fromDate', 'toDate'] } },
    )
    mockPrisma.payrollRun.create.mockRejectedValue(p2002)

    await expect(
      finalizePayrollRun(
        { businessId: BUSINESS_ID, fromDate: '2026-05-01', toDate: '2026-05-31' },
        ACTOR_CTX,
      ),
    ).rejects.toMatchObject({
      code: 'PAYROLL_PERIOD_OVERLAP',
      statusCode: 409,
      message: 'PAYROLL_PERIOD_OVERLAP',
    })
  })
})

// ─── reversePayrollRun — happy ──────────────────────────────────────────────

describe('reversePayrollRun — happy path', () => {
  it('writes inverse PAYROLL_IN Payment per finalized Payroll + audit + flips run', async () => {
    // Outside-tx existence check
    mockPrisma.payrollRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      status: 'FINALIZED',
    })
    // In-tx re-read with payments joined
    mockPrisma.payrollRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      status: 'FINALIZED',
      payrolls: [
        {
          id: 'payroll-1',
          status: 'FINALIZED',
          payment: { id: 'pay-1', partyId: 'party-1', amount: 100_000, mode: 'CASH' },
        },
      ],
    })

    mockPrisma.payment.create.mockResolvedValue({ id: 'pay-rev-1' })
    mockPrisma.payroll.update.mockResolvedValue({ id: 'payroll-1', status: 'REVERSED' })
    mockPrisma.payrollRun.update.mockResolvedValue({ id: 'run-1', status: 'REVERSED' })
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'a1' })

    const out = await reversePayrollRun(
      { payrollRunId: 'run-1' },
      { userId: ACTOR, businessId: BUSINESS_ID },
    )

    expect(out.status).toBe('REVERSED')
    expect(out.reversedCount).toBe(1)
    expect(out.totalReversedPaise).toBe(100_000)

    // Reversal Payment is PAYROLL_IN, SAME partyId, SAME positive amount,
    // reversesPaymentId pointing at original.
    expect(mockPrisma.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: BUSINESS_ID,
        type: 'PAYROLL_IN',
        partyId: 'party-1',
        amount: 100_000, // positive
        mode: 'CASH',
        reversesPaymentId: 'pay-1',
        createdBy: ACTOR,
      }),
    })

    // Child payroll flipped
    expect(mockPrisma.payroll.update).toHaveBeenCalledWith({
      where: { id: 'payroll-1' },
      data: { status: 'REVERSED' },
    })

    // Run flipped LAST
    expect(mockPrisma.payrollRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'REVERSED' },
    })

    // 2 audit rows: per-payroll + run summary
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2)
  })
})

// ─── reversePayrollRun — refusal paths ──────────────────────────────────────

describe('reversePayrollRun — refusal paths', () => {
  it('404 PAYROLL_RUN_NOT_FOUND on missing / cross-tenant', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue(null)

    await expect(
      reversePayrollRun(
        { payrollRunId: 'run-other' },
        { userId: ACTOR, businessId: BUSINESS_ID },
      ),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'PAYROLL_RUN_NOT_FOUND',
    })

    expect(mockPrisma.payment.create).not.toHaveBeenCalled()
  })

  it('409 PAYROLL_ALREADY_REVERSED when run.status === "REVERSED"', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: 'REVERSED',
    })

    await expect(
      reversePayrollRun(
        { payrollRunId: 'run-1' },
        { userId: ACTOR, businessId: BUSINESS_ID },
      ),
    ).rejects.toMatchObject({
      code: 'PAYROLL_ALREADY_REVERSED',
      statusCode: 409,
      message: 'PAYROLL_ALREADY_REVERSED',
    })

    expect(mockPrisma.payment.create).not.toHaveBeenCalled()
  })

  it('422 PAYROLL_NOT_FINALIZED on DRAFT run', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: 'DRAFT',
    })

    await expect(
      reversePayrollRun(
        { payrollRunId: 'run-1' },
        { userId: ACTOR, businessId: BUSINESS_ID },
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      message: 'PAYROLL_NOT_FINALIZED',
    })

    expect(mockPrisma.payment.create).not.toHaveBeenCalled()
  })

  it('P2002 on Payment.reversesPaymentId → 409 PAYMENT_ALREADY_REVERSED', async () => {
    mockPrisma.payrollRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      status: 'FINALIZED',
    })
    mockPrisma.payrollRun.findFirst.mockResolvedValueOnce({
      id: 'run-1',
      status: 'FINALIZED',
      payrolls: [
        {
          id: 'payroll-1',
          status: 'FINALIZED',
          payment: { id: 'pay-1', partyId: 'party-1', amount: 100_000, mode: 'CASH' },
        },
      ],
    })

    const p2002 = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test', meta: { target: ['reversesPaymentId'] } },
    )
    mockPrisma.payment.create.mockRejectedValue(p2002)

    await expect(
      reversePayrollRun(
        { payrollRunId: 'run-1' },
        { userId: ACTOR, businessId: BUSINESS_ID },
      ),
    ).rejects.toMatchObject({
      code: 'PAYROLL_ALREADY_REVERSED',
      statusCode: 409,
      message: 'PAYMENT_ALREADY_REVERSED',
    })
  })
})
