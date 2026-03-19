import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockGenerateEWB = vi.fn()
const mockCancelEWB = vi.fn()
const mockUpdatePartB = vi.fn()
vi.mock('../ecompliance.service', () => ({
  generateEWayBill: (...args: unknown[]) => mockGenerateEWB(...args),
  cancelEWayBill: (...args: unknown[]) => mockCancelEWB(...args),
  updateEWayBillPartB: (...args: unknown[]) => mockUpdatePartB(...args),
}))

import { useEWayBillActions } from '../hooks/useEWayBillActions'

const MOCK_RESULT = { ewbNumber: 'EWB1', ewbDate: '2024-01-01', validUntil: '2024-01-02' }

describe('useEWayBillActions', () => {
  const onUpdate = vi.fn()
  beforeEach(() => { vi.clearAllMocks() })

  it('starts with all loading flags false', () => {
    const { result } = renderHook(() => useEWayBillActions('doc-1', onUpdate))
    expect(result.current.generatingEwb).toBe(false)
    expect(result.current.cancellingEwb).toBe(false)
    expect(result.current.updatingPartB).toBe(false)
  })

  it('generateEwb calls service and updates state', async () => {
    mockGenerateEWB.mockResolvedValue(MOCK_RESULT)
    const input = { vehicleNumber: 'MH12AB1234', vehicleType: 'REGULAR' as const, transportMode: 'ROAD' as const, distance: 150, fromPincode: '400001', toPincode: '411001' }
    const { result } = renderHook(() => useEWayBillActions('doc-1', onUpdate))
    await act(async () => { await result.current.generateEwb(input) })
    expect(mockGenerateEWB).toHaveBeenCalledWith({ ...input, documentId: 'doc-1' })
    expect(onUpdate).toHaveBeenCalled()
  })

  it('cancelEwb calls service with reason', async () => {
    mockCancelEWB.mockResolvedValue(undefined)
    const { result } = renderHook(() => useEWayBillActions('doc-1', onUpdate))
    await act(async () => { await result.current.cancelEwb('Wrong address') })
    expect(mockCancelEWB).toHaveBeenCalledWith('doc-1', 'Wrong address')
    expect(onUpdate).toHaveBeenCalled()
  })

  it('updatePartB calls service with vehicle info', async () => {
    mockUpdatePartB.mockResolvedValue(undefined)
    const { result } = renderHook(() => useEWayBillActions('doc-1', onUpdate))
    await act(async () => { await result.current.updatePartB('MH14CD5678', 'REGULAR' as never) })
    expect(mockUpdatePartB).toHaveBeenCalledWith('doc-1', 'MH14CD5678', 'REGULAR')
    expect(onUpdate).toHaveBeenCalled()
  })

  it('prevents concurrent cancel calls', async () => {
    let resolve: (v: unknown) => void
    mockCancelEWB.mockReturnValue(new Promise((r) => { resolve = r }))
    const { result } = renderHook(() => useEWayBillActions('doc-1', onUpdate))
    act(() => { result.current.cancelEwb('reason') })
    expect(result.current.cancellingEwb).toBe(true)
    await act(async () => { result.current.cancelEwb('reason2') })
    expect(mockCancelEWB).toHaveBeenCalledTimes(1)
    await act(async () => { resolve!(undefined) })
  })
})
