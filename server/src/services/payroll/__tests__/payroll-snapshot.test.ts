/**
 * payroll-snapshot tests — Phase 6 PR6 (architecture §8.1 + §18.7 row 148).
 *
 * Covers:
 *   - buildSnapshotPayload — pure JSON shape; schemaVersion + every field
 *   - buildSnapshotPayload — paise integers preserved verbatim from PayrollLine
 *   - getPayslipSnapshot   — happy: returns payroll + decoded payload
 *   - getPayslipSnapshot   — 404 PAYROLL_NOT_FOUND on missing id / cross-tenant
 *   - getPayslipSnapshot   — 404 PAYSLIP_SNAPSHOT_NOT_FOUND when run is in DRAFT
 *     (Payroll exists but PayslipSnapshot has not been written yet)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildSnapshotPayload,
  getPayslipSnapshot,
  PAYSLIP_SCHEMA_VERSION,
} from '../payroll-snapshot.js'
import { prisma } from '../../../lib/prisma.js'
import type { PayrollLine } from '../payroll-compute.js'

const mockPrisma = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>

const BUSINESS_ID = 'biz-test-1'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── buildSnapshotPayload (PURE) ────────────────────────────────────────────

const LINE: PayrollLine = {
  employeeId: 'emp-1',
  employeeName: 'Anil',
  partyId: 'party-1',
  presentDays: 22,
  halfDays: 1,
  overtimeMin: 120,
  basePaise: 1_100_000,
  halfPayPaise: 25_000,
  overtimePayPaise: 12_500,
  grossPaise: 1_137_500,
  advanceTotalPaise: 100_000,
  deductionsPaise: 0,
  netPaise: 1_037_500,
}

const FINALIZED_AT = new Date('2026-05-31T10:00:00Z')

describe('buildSnapshotPayload — pure builder', () => {
  it('emits the canonical shape with paise integers and the current schemaVersion', () => {
    const payload = buildSnapshotPayload({
      business: { id: BUSINESS_ID, name: 'Anil Traders', phone: '+919876543210' },
      employee: {
        id: 'emp-1',
        name: 'Anil',
        phone: '+919999999999',
        designation: 'Driver',
        dailyRatePaise: 50_000,
      },
      period: { fromDate: '2026-05-01', toDate: '2026-05-31' },
      computedLine: LINE,
      payment: { id: 'pay-1', mode: 'CASH', date: FINALIZED_AT.toISOString() },
      finalizedAt: FINALIZED_AT,
      finalizedBy: { userId: 'user-actor-1', name: null },
    })

    expect(payload.schemaVersion).toBe(PAYSLIP_SCHEMA_VERSION)
    expect(payload.business).toEqual({
      id: BUSINESS_ID,
      name: 'Anil Traders',
      phone: '+919876543210',
    })
    expect(payload.employee).toEqual({
      id: 'emp-1',
      name: 'Anil',
      phone: '+919999999999',
      designation: 'Driver',
      dailyRatePaise: 50_000,
    })
    expect(payload.period).toEqual({ fromDate: '2026-05-01', toDate: '2026-05-31' })
    expect(payload.payment).toEqual({
      id: 'pay-1',
      mode: 'CASH',
      date: FINALIZED_AT.toISOString(),
    })
    expect(payload.finalizedAt).toBe(FINALIZED_AT.toISOString())
    expect(payload.finalizedBy).toEqual({ userId: 'user-actor-1', name: null })
  })

  it('lines mirror PayrollLine paise verbatim — no rounding, no scaling', () => {
    const payload = buildSnapshotPayload({
      business: { id: BUSINESS_ID, name: 'X' },
      employee: { id: 'e1', name: 'X', dailyRatePaise: 1 },
      period: { fromDate: '2026-05-01', toDate: '2026-05-31' },
      computedLine: LINE,
      payment: { id: 'pay-1', mode: 'CASH', date: FINALIZED_AT.toISOString() },
      finalizedAt: FINALIZED_AT,
      finalizedBy: { userId: 'u', name: null },
    })

    expect(payload.lines).toEqual({
      presentDays: 22,
      halfDays: 1,
      overtimeMin: 120,
      basePaise: 1_100_000,
      halfPayPaise: 25_000,
      overtimePayPaise: 12_500,
      grossPaise: 1_137_500,
      advanceTotalPaise: 100_000,
      deductionsPaise: 0,
      netPaise: 1_037_500,
    })
  })

  it('handles optional/null phone+designation cleanly', () => {
    const payload = buildSnapshotPayload({
      business: { id: BUSINESS_ID, name: 'X' },
      employee: { id: 'e1', name: 'X', dailyRatePaise: 1 },
      period: { fromDate: '2026-05-01', toDate: '2026-05-31' },
      computedLine: LINE,
      payment: { id: 'pay-1', mode: 'CASH', date: FINALIZED_AT.toISOString() },
      finalizedAt: FINALIZED_AT,
      finalizedBy: { userId: 'u', name: null },
    })

    expect(payload.business.phone).toBeUndefined()
    expect(payload.employee.phone).toBeUndefined()
    expect(payload.employee.designation).toBeUndefined()
  })
})

// ─── getPayslipSnapshot ─────────────────────────────────────────────────────

describe('getPayslipSnapshot', () => {
  it('returns payroll + decoded snapshot.payload when tenant matches', async () => {
    const payload = {
      schemaVersion: PAYSLIP_SCHEMA_VERSION,
      business: { id: BUSINESS_ID, name: 'X' },
      employee: { id: 'emp-1', name: 'Anil', dailyRatePaise: 50_000 },
      period: { fromDate: '2026-05-01', toDate: '2026-05-31' },
      lines: {
        presentDays: 22,
        halfDays: 0,
        overtimeMin: 0,
        basePaise: 1_100_000,
        halfPayPaise: 0,
        overtimePayPaise: 0,
        grossPaise: 1_100_000,
        advanceTotalPaise: 0,
        deductionsPaise: 0,
        netPaise: 1_100_000,
      },
      payment: { id: 'pay-1', mode: 'CASH', date: FINALIZED_AT.toISOString() },
      finalizedAt: FINALIZED_AT.toISOString(),
      finalizedBy: { userId: 'u1', name: null },
    }

    mockPrisma.payroll.findFirst.mockResolvedValue({
      id: 'payroll-1',
      payrollRunId: 'run-1',
      employeeId: 'emp-1',
      netPaise: 1_100_000,
      status: 'FINALIZED',
      snapshot: { payload },
    })

    const out = await getPayslipSnapshot({
      businessId: BUSINESS_ID,
      payrollId: 'payroll-1',
    })

    expect(out.payroll.id).toBe('payroll-1')
    expect(out.payroll.netPaise).toBe(1_100_000)
    expect(out.snapshot.lines.netPaise).toBe(1_100_000)
    expect(out.snapshot.schemaVersion).toBe(PAYSLIP_SCHEMA_VERSION)

    // Tenant-scoped findFirst
    const call = mockPrisma.payroll.findFirst.mock.calls[0]![0] as {
      where: { id: string; businessId: string }
    }
    expect(call.where.id).toBe('payroll-1')
    expect(call.where.businessId).toBe(BUSINESS_ID)
  })

  it('throws 404 PAYROLL_NOT_FOUND on missing OR cross-tenant', async () => {
    mockPrisma.payroll.findFirst.mockResolvedValue(null)

    await expect(
      getPayslipSnapshot({ businessId: BUSINESS_ID, payrollId: 'payroll-other' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'PAYROLL_NOT_FOUND',
    })
  })

  it('throws 404 PAYSLIP_SNAPSHOT_NOT_FOUND when Payroll exists but snapshot is null (DRAFT)', async () => {
    mockPrisma.payroll.findFirst.mockResolvedValue({
      id: 'payroll-draft',
      payrollRunId: 'run-1',
      employeeId: 'emp-1',
      netPaise: 0,
      status: 'DRAFT',
      snapshot: null,
    })

    await expect(
      getPayslipSnapshot({ businessId: BUSINESS_ID, payrollId: 'payroll-draft' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'PAYSLIP_SNAPSHOT_NOT_FOUND',
    })
  })
})
