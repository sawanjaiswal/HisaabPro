/**
 * Integration tests for dashboard routes + app-level health/404 handlers.
 * Dashboard has no mutations — read-only endpoints behind auth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../app.js'
import {
  authAgent,
  anonAgent,
  mockAuthPass,
  resetMocks,
  TEST_USER,
} from './helpers.js'

// Mock the dashboard service — all functions stubbed
vi.mock('../services/dashboard/index.js', () => ({
  getHomeDashboard: vi.fn(),
  getDashboardStats: vi.fn(),
}))
import * as dashboardService from '../services/dashboard/index.js'

const app = createApp()

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_HOME = {
  outstanding: {
    receivable: { total: 100000, partyCount: 5 },
    payable: { total: 50000, partyCount: 3 },
  },
  today: {
    salesCount: 4,
    salesAmount: 50000,
    paymentsReceivedCount: 2,
    paymentsReceivedAmount: 30000,
    paymentsMadeAmount: 10000,
    netCashFlow: 20000,
  },
  recentActivity: [],
  alerts: { lowStockCount: 3, overdueInvoiceCount: 1, overdueAmount: 15000 },
  topDebtors: [],
}

const MOCK_STATS = {
  range: { from: '2026-03-01', to: '2026-03-27', label: 'Custom' },
  sales: { count: 25, amount: 500000 },
  purchases: { count: 15, amount: 300000 },
  receivable: { total: 100000, partyCount: 5 },
  payable: { total: 50000, partyCount: 3 },
  topOutstandingCustomers: [],
  paymentsReceived: 200000,
  paymentsMade: 100000,
  netCashFlow: 100000,
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Dashboard Routes', () => {
  beforeEach(() => {
    resetMocks()
    vi.clearAllMocks()
  })

  // ─── GET /api/dashboard/home ──────────────────────────────────────────────

  describe('GET /api/dashboard/home', () => {
    it('returns home dashboard data for authenticated user', async () => {
      mockAuthPass()
      vi.mocked(dashboardService.getHomeDashboard).mockResolvedValue(MOCK_HOME)

      const res = await authAgent(app).get('/api/dashboard/home')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(MOCK_HOME)
      expect(dashboardService.getHomeDashboard).toHaveBeenCalledWith(TEST_USER.businessId)
    })

    it('returns 401 without auth token', async () => {
      const res = await anonAgent(app).get('/api/dashboard/home')

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
      expect(dashboardService.getHomeDashboard).not.toHaveBeenCalled()
    })
  })

  // ─── GET /api/dashboard/stats ─────────────────────────────────────────────

  describe('GET /api/dashboard/stats', () => {
    it('returns stats with query params for authenticated user', async () => {
      mockAuthPass()
      vi.mocked(dashboardService.getDashboardStats).mockResolvedValue(MOCK_STATS)

      const res = await authAgent(app)
        .get('/api/dashboard/stats?range=custom&from=2026-03-01&to=2026-03-27')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toEqual(MOCK_STATS)
      expect(dashboardService.getDashboardStats).toHaveBeenCalledWith(
        TEST_USER.businessId,
        { range: 'custom', from: '2026-03-01', to: '2026-03-27' }
      )
    })

    it('returns 401 without auth token', async () => {
      const res = await anonAgent(app).get('/api/dashboard/stats')

      expect(res.status).toBe(401)
      expect(res.body.success).toBe(false)
      expect(dashboardService.getDashboardStats).not.toHaveBeenCalled()
    })
  })
})

// ─── App-Level Endpoints ──────────────────────────────────────────────────────

describe('App-Level Routes', () => {
  describe('GET /api/health', () => {
    it('returns ok status without auth', async () => {
      const res = await anonAgent(app).get('/api/health')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('ok')
      expect(res.body.data.timestamp).toBeDefined()
    })
  })

  describe('GET /api/nonexistent', () => {
    it('returns 404 for unknown routes', async () => {
      mockAuthPass()
      const res = await authAgent(app).get('/api/nonexistent')

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })
  })
})
