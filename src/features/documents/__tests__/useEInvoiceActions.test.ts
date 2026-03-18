import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockGenerateEInvoice = vi.fn()
const mockCancelEInvoice = vi.fn()
vi.mock('../ecompliance.service', () => ({
  generateEInvoice: (...args: unknown[]) => mockGenerateEInvoice(...args),
  cancelEInvoice: (...args: unknown[]) => mockCancelEInvoice(...args),
}))

import { useEInvoiceActions } from '../hooks/useEInvoiceActions'

const MOCK_RESULT = { irn: 'IRN123', ackNumber: 'ACK1', ackDate: '2024-01-01', qrCode: 'QR' }

describe('useEInvoiceActions', () => {
  const onUpdate = vi.fn()
  beforeEach(() => { vi.clearAllMocks() })

  it('starts with loading flags false', () => {
    const { result } = renderHook(() => useEInvoiceActions('doc-1', onUpdate))
    expect(result.current.generatingInvoice).toBe(false)
    expect(result.current.cancellingInvoice).toBe(false)
  })

  it('generateInvoice calls service and updates state', async () => {
    mockGenerateEInvoice.mockResolvedValue(MOCK_RESULT)
    const { result } = renderHook(() => useEInvoiceActions('doc-1', onUpdate))
    await act(async () => { await result.current.generateInvoice() })
    expect(mockGenerateEInvoice).toHaveBeenCalledWith('doc-1')
    expect(onUpdate).toHaveBeenCalled()
    expect(result.current.generatingInvoice).toBe(false)
  })

  it('cancelInvoice calls service with reason', async () => {
    mockCancelEInvoice.mockResolvedValue(undefined)
    const { result } = renderHook(() => useEInvoiceActions('doc-1', onUpdate))
    await act(async () => { await result.current.cancelInvoice('Duplicate') })
    expect(mockCancelEInvoice).toHaveBeenCalledWith('doc-1', 'Duplicate')
    expect(onUpdate).toHaveBeenCalled()
  })

  it('prevents concurrent generate calls', async () => {
    let resolve: (v: unknown) => void
    mockGenerateEInvoice.mockReturnValue(new Promise((r) => { resolve = r }))
    const { result } = renderHook(() => useEInvoiceActions('doc-1', onUpdate))
    act(() => { result.current.generateInvoice() })
    expect(result.current.generatingInvoice).toBe(true)
    // second call is a no-op while first is in flight
    await act(async () => { result.current.generateInvoice() })
    expect(mockGenerateEInvoice).toHaveBeenCalledTimes(1)
    await act(async () => { resolve!(MOCK_RESULT) })
  })
})
