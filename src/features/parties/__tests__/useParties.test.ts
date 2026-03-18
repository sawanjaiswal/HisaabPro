import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; status: number; constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s } },
}))

const mockGetParties = vi.fn()
const mockCreateParty = vi.fn()
const mockDeleteParty = vi.fn()
vi.mock('../party.service', () => ({
  getParties: (...args: unknown[]) => mockGetParties(...args),
  createParty: (...args: unknown[]) => mockCreateParty(...args),
  deleteParty: (...args: unknown[]) => mockDeleteParty(...args),
}))

import { useParties } from '../useParties'

const MOCK_RESPONSE = {
  parties: [{ id: '1', name: 'Party A' }],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
}

describe('useParties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetParties.mockResolvedValue(MOCK_RESPONSE)
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useParties())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches parties on mount', async () => {
    const { result } = renderHook(() => useParties())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(MOCK_RESPONSE)
    expect(mockGetParties).toHaveBeenCalledTimes(1)
  })

  it('setFilter updates filter and resets page to 1', async () => {
    const { result } = renderHook(() => useParties())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setFilter('type', 'SUPPLIER'))
    expect(result.current.filters.type).toBe('SUPPLIER')
    expect(result.current.filters.page).toBe(1)
  })

  it('setPage changes page number', async () => {
    const { result } = renderHook(() => useParties())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setPage(2))
    expect(result.current.filters.page).toBe(2)
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useParties())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callsBefore = mockGetParties.mock.calls.length

    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetParties.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('handleDelete optimistically removes item from list', async () => {
    const { result } = renderHook(() => useParties())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.handleDelete('1', 'Party A'))
    expect(result.current.data?.parties).toHaveLength(0)
    expect(result.current.data?.pagination.total).toBe(0)
    expect(mockToast.success).toHaveBeenCalledWith('Party A deleted', expect.any(Object))
  })

  it('shows error toast on fetch failure', async () => {
    mockGetParties.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useParties())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load parties')
  })

  it('handleCreate calls createParty and refreshes', async () => {
    mockCreateParty.mockResolvedValue({ id: '2', name: 'New Party' })
    const { result } = renderHook(() => useParties())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callsBefore = mockGetParties.mock.calls.length

    await act(async () => {
      await result.current.handleCreate({ name: 'New Party' } as never)
    })
    expect(mockCreateParty).toHaveBeenCalledWith({ name: 'New Party' })
    expect(mockToast.success).toHaveBeenCalledWith('New Party added successfully')
    await waitFor(() => expect(mockGetParties.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})
