import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockGetEInvoiceStatus = vi.fn()
const mockGetEWayBillStatus = vi.fn()
vi.mock('../hooks/useEInvoiceActions', () => ({
  useEInvoiceActions: () => ({ generatingInvoice: false, cancellingInvoice: false, generateInvoice: vi.fn(), cancelInvoice: vi.fn() }),
}))
vi.mock('../hooks/useEWayBillActions', () => ({
  useEWayBillActions: () => ({ generatingEwb: false, cancellingEwb: false, updatingPartB: false, generateEwb: vi.fn(), cancelEwb: vi.fn(), updatePartB: vi.fn() }),
}))
vi.mock('../ecompliance.service', () => ({
  getEInvoiceStatus: (...args: unknown[]) => mockGetEInvoiceStatus(...args),
  getEWayBillStatus: (...args: unknown[]) => mockGetEWayBillStatus(...args),
}))

import { useECompliance } from '../hooks/useECompliance'

const MOCK_EINVOICE = { irn: 'IRN123', status: 'GENERATED' }
const MOCK_EWAYBILL = { ewbNumber: 'EWB456', status: 'GENERATED' }

describe('useECompliance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockGetEInvoiceStatus.mockReturnValue(new Promise(() => {}))
    mockGetEWayBillStatus.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useECompliance('doc-1'))
    expect(result.current.fetchState).toBe('loading')
    expect(result.current.eInvoice).toBeNull()
    expect(result.current.eWayBill).toBeNull()
  })

  it('fetches both statuses in parallel on mount', async () => {
    mockGetEInvoiceStatus.mockResolvedValue(MOCK_EINVOICE)
    mockGetEWayBillStatus.mockResolvedValue(MOCK_EWAYBILL)
    const { result } = renderHook(() => useECompliance('doc-1'))
    await waitFor(() => expect(result.current.fetchState).toBe('success'))
    expect(result.current.eInvoice).toEqual(MOCK_EINVOICE)
    expect(result.current.eWayBill).toEqual(MOCK_EWAYBILL)
  })

  it('sets error state on failure', async () => {
    mockGetEInvoiceStatus.mockRejectedValue(new Error('Network error'))
    mockGetEWayBillStatus.mockResolvedValue(MOCK_EWAYBILL)
    const { result } = renderHook(() => useECompliance('doc-1'))
    await waitFor(() => expect(result.current.fetchState).toBe('error'))
    expect(result.current.fetchError).toBe('Network error')
  })

  it('refresh triggers re-fetch', async () => {
    mockGetEInvoiceStatus.mockResolvedValue(MOCK_EINVOICE)
    mockGetEWayBillStatus.mockResolvedValue(MOCK_EWAYBILL)
    const { result } = renderHook(() => useECompliance('doc-1'))
    await waitFor(() => expect(result.current.fetchState).toBe('success'))
    result.current.refresh()
    await waitFor(() => expect(mockGetEInvoiceStatus).toHaveBeenCalledTimes(2))
  })
})
