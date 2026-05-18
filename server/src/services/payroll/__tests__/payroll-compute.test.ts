/**
 * payroll-compute tests — Phase 6 PR6 (architecture §8 + §18.7 row 147).
 *
 * computePayrollLine is the PURE function — exhaustively assert every paise
 * column for every combination of:
 *   - PRESENT / ABSENT / HALF_DAY / LEAVE_PAID / LEAVE_UNPAID
 *   - overtimeMin gating (only counts on PRESENT / HALF_DAY / LEAVE_PAID)
 *   - advance filter (paidBackAt IS NULL AND grantedAt <= toDate)
 *   - deductions override
 *   - net clamping (Math.max(0, ...))
 *
 * If any paise here drifts, the snapshot pdf + the payroll-snapshot row +
 * the Payment.amount on the wire ALL drift together — these tests are the
 * SSOT for what FINALIZE persists.
 */

import { describe, it, expect } from 'vitest'
import {
  computePayrollLine,
  OVERTIME_HOURS_PER_DAY,
} from '../payroll-compute.js'

const TO_DATE = new Date('2026-05-31')
const TO_DATE_MS = TO_DATE.getTime()

function emp(dailyRate: number) {
  return { id: 'e1', name: 'Anil', dailyRate, partyId: 'party-1' }
}

function att(status: string, overtimeMin = 0) {
  return { status, overtimeMin }
}

function adv(amount: number, opts: { paidBack?: boolean; daysAfterTo?: number } = {}) {
  const granted = new Date(TO_DATE_MS + (opts.daysAfterTo ?? 0) * 86400_000)
  return {
    amount,
    grantedAt: granted,
    paidBackAt: opts.paidBack ? new Date() : null,
  }
}

// ─── Empty / no-op cases ────────────────────────────────────────────────────

describe('computePayrollLine — empty inputs', () => {
  it('zero attendance, zero advances → all paise zero', () => {
    const out = computePayrollLine({
      employee: emp(50000),
      attendances: [],
      advances: [],
      toDate: TO_DATE,
    })

    expect(out.presentDays).toBe(0)
    expect(out.halfDays).toBe(0)
    expect(out.overtimeMin).toBe(0)
    expect(out.basePaise).toBe(0)
    expect(out.halfPayPaise).toBe(0)
    expect(out.overtimePayPaise).toBe(0)
    expect(out.grossPaise).toBe(0)
    expect(out.advanceTotalPaise).toBe(0)
    expect(out.deductionsPaise).toBe(0)
    expect(out.netPaise).toBe(0)
  })

  it('carries identifying fields verbatim', () => {
    const out = computePayrollLine({
      employee: { id: 'e7', name: 'Sundar', dailyRate: 80000, partyId: 'pp-7' },
      attendances: [],
      advances: [],
      toDate: TO_DATE,
    })

    expect(out.employeeId).toBe('e7')
    expect(out.employeeName).toBe('Sundar')
    expect(out.partyId).toBe('pp-7')
  })
})

// ─── Day-class counting ─────────────────────────────────────────────────────

describe('computePayrollLine — day-class counting', () => {
  it('PRESENT + LEAVE_PAID both count as presentDays; HALF_DAY tracked separately', () => {
    const out = computePayrollLine({
      employee: emp(50000),
      attendances: [
        att('PRESENT'),
        att('PRESENT'),
        att('LEAVE_PAID'),
        att('HALF_DAY'),
        att('HALF_DAY'),
        att('ABSENT'),
        att('LEAVE_UNPAID'),
      ],
      advances: [],
      toDate: TO_DATE,
    })

    expect(out.presentDays).toBe(3) // 2 PRESENT + 1 LEAVE_PAID
    expect(out.halfDays).toBe(2)
    // basePaise = 3 * 50000 = 150_000
    expect(out.basePaise).toBe(150_000)
    // halfPay = 2 * floor(50_000 / 2) = 50_000
    expect(out.halfPayPaise).toBe(50_000)
    // overtimePay = 0
    expect(out.overtimePayPaise).toBe(0)
    expect(out.grossPaise).toBe(200_000)
  })

  it('overtimeMin from ABSENT or LEAVE_UNPAID does NOT count', () => {
    const out = computePayrollLine({
      employee: emp(50000),
      attendances: [
        att('PRESENT', 60), // counts
        att('HALF_DAY', 30), // counts
        att('LEAVE_PAID', 90), // counts
        att('ABSENT', 999), // ignored
        att('LEAVE_UNPAID', 999), // ignored
      ],
      advances: [],
      toDate: TO_DATE,
    })

    // overtimeMin = 60 + 30 + 90 = 180
    expect(out.overtimeMin).toBe(180)
    // overtimePay = floor((180 * 50_000) / (60 * 8))
    //             = floor(9_000_000 / 480)
    //             = floor(18750)
    //             = 18_750
    expect(out.overtimePayPaise).toBe(18_750)
  })
})

// ─── Money math precision ──────────────────────────────────────────────────

describe('computePayrollLine — paise precision (Math.floor at each division)', () => {
  it('halfPay floors when dailyRate is odd (501 paise = Rs 5.01)', () => {
    // dailyRate = 501 paise; halfRate = floor(501/2) = 250 paise
    const out = computePayrollLine({
      employee: emp(501),
      attendances: [att('HALF_DAY')],
      advances: [],
      toDate: TO_DATE,
    })

    expect(out.halfPayPaise).toBe(250)
    expect(out.grossPaise).toBe(250)
  })

  it('overtimePay floors at the last division', () => {
    // dailyRate=100, overtimeMin=1 → (1 * 100) / 480 = 0.208... → floor = 0
    const a = computePayrollLine({
      employee: emp(100),
      attendances: [att('PRESENT', 1)],
      advances: [],
      toDate: TO_DATE,
    })
    expect(a.overtimePayPaise).toBe(0)

    // dailyRate=100, overtimeMin=480 → (480 * 100) / 480 = 100 exactly → floor = 100
    const b = computePayrollLine({
      employee: emp(100),
      attendances: [att('PRESENT', 480)],
      advances: [],
      toDate: TO_DATE,
    })
    expect(b.overtimePayPaise).toBe(100)
  })

  it('the 8-hour day constant is the canonical 8', () => {
    expect(OVERTIME_HOURS_PER_DAY).toBe(8)
  })
})

// ─── Advance filter ─────────────────────────────────────────────────────────

describe('computePayrollLine — advance filter', () => {
  it('sums only advances with paidBackAt IS NULL AND grantedAt <= toDate', () => {
    const out = computePayrollLine({
      employee: emp(50000),
      attendances: [att('PRESENT'), att('PRESENT'), att('PRESENT')],
      advances: [
        adv(10_000), // outstanding, granted on toDate → counts
        adv(20_000, { daysAfterTo: -10 }), // outstanding, granted before → counts
        adv(50_000, { paidBack: true }), // already repaid → IGNORED
        adv(30_000, { daysAfterTo: 5 }), // granted AFTER toDate → IGNORED
      ],
      toDate: TO_DATE,
    })

    // gross = 3 * 50000 = 150_000; advances sum = 30_000
    expect(out.grossPaise).toBe(150_000)
    expect(out.advanceTotalPaise).toBe(30_000)
    expect(out.netPaise).toBe(120_000)
  })
})

// ─── Net clamping ───────────────────────────────────────────────────────────

describe('computePayrollLine — net clamping', () => {
  it('clamps net to 0 when advances exceed gross (never pay negative)', () => {
    const out = computePayrollLine({
      employee: emp(50000),
      attendances: [att('PRESENT')], // gross = 50_000
      advances: [adv(1_000_000)], // outstanding huge advance
      toDate: TO_DATE,
    })

    expect(out.grossPaise).toBe(50_000)
    expect(out.advanceTotalPaise).toBe(1_000_000)
    expect(out.netPaise).toBe(0) // clamped
  })

  it('applies deductionsPaise (default 0; override subtracts from net)', () => {
    const out = computePayrollLine({
      employee: emp(50000),
      attendances: [att('PRESENT'), att('PRESENT')], // gross = 100_000
      advances: [],
      deductionsPaise: 25_000,
      toDate: TO_DATE,
    })

    expect(out.deductionsPaise).toBe(25_000)
    expect(out.netPaise).toBe(75_000)
  })
})

// ─── Full mixed scenario ───────────────────────────────────────────────────

describe('computePayrollLine — full scenario', () => {
  it('20 PRESENT + 2 HALF_DAY + 3 LEAVE_PAID + 1 ABSENT + 1 LEAVE_UNPAID; 180 min OT; 1 advance', () => {
    const attendances = [
      ...Array(20).fill(att('PRESENT', 6)), // 120 min OT
      att('HALF_DAY', 30),
      att('HALF_DAY', 30),
      att('LEAVE_PAID', 0),
      att('LEAVE_PAID', 0),
      att('LEAVE_PAID', 0),
      att('ABSENT', 999),
      att('LEAVE_UNPAID', 999),
    ]
    const dailyRate = 60000 // Rs 600/day
    const out = computePayrollLine({
      employee: emp(dailyRate),
      attendances,
      advances: [adv(100_000)], // Rs 1000 advance, outstanding
      toDate: TO_DATE,
    })

    expect(out.presentDays).toBe(23) // 20 PRESENT + 3 LEAVE_PAID
    expect(out.halfDays).toBe(2)
    expect(out.overtimeMin).toBe(20 * 6 + 30 + 30) // 180

    // basePaise   = 23 * 60_000 = 1_380_000
    expect(out.basePaise).toBe(1_380_000)
    // halfPay     = 2 * floor(60_000 / 2) = 60_000
    expect(out.halfPayPaise).toBe(60_000)
    // overtimePay = floor((180 * 60_000) / 480) = floor(22500) = 22_500
    expect(out.overtimePayPaise).toBe(22_500)
    // gross       = 1_380_000 + 60_000 + 22_500 = 1_462_500
    expect(out.grossPaise).toBe(1_462_500)
    // advance = 100_000 → net = 1_462_500 - 100_000 = 1_362_500
    expect(out.advanceTotalPaise).toBe(100_000)
    expect(out.netPaise).toBe(1_362_500)
  })
})
