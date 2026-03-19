import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useHomeDashboard } from '../useDashboard'

const mockGetHomeDashboard = vi.fn()

vi.mock('../dashboard.service', () => ({
  getHomeDashboard: (...args: unknown[]) => mockGetHomeDashboard(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_DATA = {
  outstanding: { receivable: { total: 120000, partyCount: 12 }, payable: { total: 0, partyCount: 0 } },
  today: { salesCount: 5, salesAmount: 50000, paymentsReceivedCount: 3, paymentsReceivedAmount: 30000, paymentsMadeAmount: 0, netCashFlow: 30000 },
  recentActivity: [],
  alerts: { lowStockCount: 0, overdueInvoiceCount: 0, overdueAmount: 0 },
  topDebtors: [],
}

describe('useHomeDashboard', () => {
  it('starts in loading state', () => {
    mockGetHomeDashboard.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useHomeDashboard())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches data on mount and sets success', async () => {
    mockGetHomeDashboard.mockResolvedValue(MOCK_DATA)
    const { result } = renderHook(() => useHomeDashboard())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(MOCK_DATA)
  })

  it('sets error status on fetch failure', async () => {
    mockGetHomeDashboard.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useHomeDashboard())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.data).toBeNull()
  })

  it('refresh triggers re-fetch', async () => {
    mockGetHomeDashboard.mockResolvedValue(MOCK_DATA)
    const { result } = renderHook(() => useHomeDashboard())

    await waitFor(() => expect(result.current.status).toBe('success'))
    const updatedData = { ...MOCK_DATA, outstanding: { ...MOCK_DATA.outstanding, receivable: { total: 200000, partyCount: 20 } } }
    mockGetHomeDashboard.mockResolvedValue(updatedData)

    result.current.refresh()
    await waitFor(() => expect(result.current.data?.outstanding.receivable.partyCount).toBe(20))
  })

  it('ignores AbortError', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    mockGetHomeDashboard.mockRejectedValue(abortError)
    const { result } = renderHook(() => useHomeDashboard())

    // Should stay loading (abort is ignored, not treated as error)
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.status).toBe('loading')
  })
})
