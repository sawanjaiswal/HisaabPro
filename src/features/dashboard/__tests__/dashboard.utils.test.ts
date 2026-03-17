import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatAmount,
  formatCompactAmount,
  timeAgo,
  formatDate,
  isHomeDashboardEmpty,
} from '../dashboard.utils'
import type { HomeDashboardData } from '../dashboard.types'

// ─── Currency formatting ─────────────────────────────────────────────────────

describe('formatAmount', () => {
  it('formats paise as INR', () => {
    expect(formatAmount(150000)).toContain('1,500.00')
  })

  it('formats zero', () => {
    expect(formatAmount(0)).toContain('0.00')
  })
})

describe('formatCompactAmount', () => {
  it('formats crores', () => {
    // ₹1.5Cr = 1,50,00,000 rupees = 1,50,00,00,000 paise
    expect(formatCompactAmount(1500000000)).toBe('₹1.5Cr')
  })

  it('formats lakhs', () => {
    // ₹1.5L = 1,50,000 rupees = 1,50,00,000 paise
    expect(formatCompactAmount(15000000)).toBe('₹1.5L')
  })

  it('formats thousands', () => {
    // 1.5K rupees = 1,500 rupees = 1,50,000 paise
    expect(formatCompactAmount(150000)).toBe('₹1.5K')
  })

  it('formats small amounts normally', () => {
    expect(formatCompactAmount(1500)).toContain('15.00')
  })
})

// ─── Time formatting ─────────────────────────────────────────────────────────

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-17T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Just now" for < 60s', () => {
    expect(timeAgo('2026-03-17T11:59:30.000Z')).toBe('Just now')
  })

  it('returns hours ago', () => {
    expect(timeAgo('2026-03-17T09:00:00.000Z')).toBe('3h ago')
  })
})

describe('formatDate', () => {
  it('formats ISO string', () => {
    const result = formatDate('2025-03-15')
    expect(result).toMatch(/15/)
    expect(result).toMatch(/Mar/)
    expect(result).toMatch(/2025/)
  })

  it('returns empty for empty input', () => {
    expect(formatDate('')).toBe('')
  })

  it('returns empty for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('')
  })
})

// ─── Empty state detection ───────────────────────────────────────────────────

describe('isHomeDashboardEmpty', () => {
  const emptyData: HomeDashboardData = {
    outstanding: {
      receivable: { total: 0, partyCount: 0 },
      payable: { total: 0, partyCount: 0 },
    },
    today: {
      salesCount: 0,
      salesAmount: 0,
      paymentsReceivedCount: 0,
      paymentsReceivedAmount: 0,
      paymentsMadeAmount: 0,
      netCashFlow: 0,
    },
    recentActivity: [],
    alerts: { lowStockCount: 0, overdueInvoiceCount: 0, overdueAmount: 0 },
    topDebtors: [],
  }

  it('returns true when all data is zero/empty', () => {
    expect(isHomeDashboardEmpty(emptyData)).toBe(true)
  })

  it('returns false when there are sales', () => {
    expect(isHomeDashboardEmpty({
      ...emptyData,
      today: { ...emptyData.today, salesCount: 1 },
    })).toBe(false)
  })

  it('returns false when there is outstanding', () => {
    expect(isHomeDashboardEmpty({
      ...emptyData,
      outstanding: {
        ...emptyData.outstanding,
        receivable: { total: 50000, partyCount: 1 },
      },
    })).toBe(false)
  })
})
