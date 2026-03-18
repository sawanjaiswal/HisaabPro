import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useHomeDashboard } from '../useDashboard'

const mockGetHomeDashboard = vi.fn()

vi.mock('../dashboard.service', () => ({
  getHomeDashboard: (...args: unknown[]) => mockGetHomeDashboard(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_DATA = {
  todayCollection: 50000,
  totalOutstanding: 120000,
  activeCustomers: 12,
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
    mockGetHomeDashboard.mockResolvedValue({ ...MOCK_DATA, activeCustomers: 20 })

    result.current.refresh()
    await waitFor(() => expect(result.current.data?.activeCustomers).toBe(20))
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
