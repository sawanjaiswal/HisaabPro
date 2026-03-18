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

const mockGstr1Data = { b2b: [], b2cs: [], totalTax: 5000 }
const mockExportData = { data: '{}', fileName: 'gstr1.json' }

const mockGetGstReturn = vi.fn().mockResolvedValue(mockGstr1Data)
const mockExportGstReturn = vi.fn().mockResolvedValue(mockExportData)
vi.mock('../report.service', () => ({
  getGstReturn: (...args: unknown[]) => mockGetGstReturn(...args),
  exportGstReturn: (...args: unknown[]) => mockExportGstReturn(...args),
}))

import { useGstReturns } from '../hooks/useGstReturns'

describe('useGstReturns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetGstReturn.mockResolvedValue(mockGstr1Data)
    mockExportGstReturn.mockResolvedValue(mockExportData)
  })

  it('starts in loading status', () => {
    const { result } = renderHook(() => useGstReturns())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
    expect(result.current.returnType).toBe('GSTR1')
  })

  it('fetches GSTR-1 data on mount', async () => {
    const { result } = renderHook(() => useGstReturns())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(mockGstr1Data)
    expect(mockGetGstReturn).toHaveBeenCalledWith('GSTR1', expect.any(String), expect.any(AbortSignal))
  })

  it('setReturnType changes type and re-fetches', async () => {
    const { result } = renderHook(() => useGstReturns())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setReturnType('GSTR3B'))
    await waitFor(() => expect(mockGetGstReturn).toHaveBeenCalledWith(
      'GSTR3B', expect.any(String), expect.any(AbortSignal),
    ))
  })

  it('setPeriod changes period and re-fetches', async () => {
    const { result } = renderHook(() => useGstReturns())
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.setPeriod('2026-01'))
    await waitFor(() => expect(mockGetGstReturn).toHaveBeenCalledWith(
      'GSTR1', '2026-01', expect.any(AbortSignal),
    ))
  })

  it('exportJson returns data for GSTR1', async () => {
    const { result } = renderHook(() => useGstReturns())
    await waitFor(() => expect(result.current.status).toBe('success'))
    let exportResult: unknown
    await act(async () => { exportResult = await result.current.exportJson() })
    expect(exportResult).toEqual(mockExportData)
    expect(mockToast.success).toHaveBeenCalledWith('GSTR-1 JSON exported successfully')
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useGstReturns())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callCount = mockGetGstReturn.mock.calls.length
    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetGstReturn.mock.calls.length).toBeGreaterThan(callCount))
  })

  it('shows toast on error', async () => {
    mockGetGstReturn.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useGstReturns())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load GST return')
  })
})
