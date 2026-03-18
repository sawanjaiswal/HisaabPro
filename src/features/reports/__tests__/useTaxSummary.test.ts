import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockTaxData = { sales: { totalTax: 1000 }, purchases: { totalTax: 500 } }
const mockHsnData = { items: [{ hsn: '1234', taxableValue: 10000 }] }

const mockGetTaxSummary = vi.fn().mockResolvedValue(mockTaxData)
const mockGetHsnSummary = vi.fn().mockResolvedValue(mockHsnData)
vi.mock('../report.service', () => ({
  getTaxSummary: (...args: unknown[]) => mockGetTaxSummary(...args),
  getHsnSummary: (...args: unknown[]) => mockGetHsnSummary(...args),
}))
vi.mock('../report.utils', () => ({
  getDateRange: () => ({ from: '2025-04-01', to: '2026-03-31' }),
}))

import { useTaxSummary } from '../hooks/useTaxSummary'

describe('useTaxSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTaxSummary.mockResolvedValue(mockTaxData)
    mockGetHsnSummary.mockResolvedValue(mockHsnData)
  })

  it('starts in loading status', () => {
    const { result } = renderHook(() => useTaxSummary())
    expect(result.current.status).toBe('loading')
    expect(result.current.data.summary).toBeNull()
    expect(result.current.data.hsnSummary).toBeNull()
  })

  it('fetches both tax and HSN summary on mount', async () => {
    const { result } = renderHook(() => useTaxSummary())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data.summary).toEqual(mockTaxData)
    expect(result.current.data.hsnSummary).toEqual(mockHsnData)
    expect(mockGetTaxSummary).toHaveBeenCalledTimes(1)
    expect(mockGetHsnSummary).toHaveBeenCalledTimes(1)
  })

  it('setFilters updates filters and re-fetches', async () => {
    const { result } = renderHook(() => useTaxSummary())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const newFilters = { from: '2025-01-01', to: '2025-12-31' }
    act(() => result.current.setFilters(newFilters))
    await waitFor(() => expect(mockGetTaxSummary).toHaveBeenCalledWith(
      expect.objectContaining(newFilters),
      expect.any(AbortSignal),
    ))
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useTaxSummary())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callCount = mockGetTaxSummary.mock.calls.length
    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetTaxSummary.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('shows toast on error', async () => {
    mockGetTaxSummary.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useTaxSummary())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load tax summary')
  })
})
