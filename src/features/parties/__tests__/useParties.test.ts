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
import { createTestWrapper } from '@/test/query-wrapper'


const MOCK_RESPONSE = {
  parties: [{ id: '1', name: 'Party A' }],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
}

// Per-test, not module-level: one shared QueryClient carries a test's cached
// pages into the next test under the same key, so a hook reading `hasMore`
// would answer from the previous test's data before its own fetch resolves.
let wrapper = createTestWrapper()

describe('useParties', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetParties.mockResolvedValue(MOCK_RESPONSE)
    wrapper = createTestWrapper()
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useParties(), { wrapper })
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches parties on mount', async () => {
    const { result } = renderHook(() => useParties(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(MOCK_RESPONSE)
    expect(mockGetParties).toHaveBeenCalledTimes(1)
  })

  it('setFilter updates filter and resets page to 1', async () => {
    const { result } = renderHook(() => useParties(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setFilter('type', 'SUPPLIER'))
    expect(result.current.filters.type).toBe('SUPPLIER')
    expect(result.current.filters.page).toBe(1)
  })

  it('loadMore appends the next page instead of replacing the current one', async () => {
    // Two pages of one row each. Replacing (the old single-page useQuery) would
    // leave `parties` at length 1 with Party B in it; accumulating gives both.
    const page1 = {
      parties: [{ id: '1', name: 'Party A' }],
      pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
      summary: { totalParties: 2 },
    }
    const page2 = {
      parties: [{ id: '2', name: 'Party B' }],
      pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
      summary: { totalParties: 2 },
    }
    mockGetParties.mockImplementation((filters: { page?: number }) =>
      Promise.resolve(filters?.page === 2 ? page2 : page1),
    )

    const { result } = renderHook(() => useParties(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.hasMore).toBe(true)

    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.data?.parties).toHaveLength(2))
    expect(result.current.data?.parties.map((p) => p.id)).toEqual(['1', '2'])
    expect(result.current.hasMore).toBe(false)
  })

  it('hasMore is false when everything fits on one page', async () => {
    const { result } = renderHook(() => useParties(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.hasMore).toBe(false)
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useParties(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callsBefore = mockGetParties.mock.calls.length

    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetParties.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('handleDelete optimistically removes item from list', async () => {
    const { result } = renderHook(() => useParties(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.handleDelete('1', 'Party A'))
    await waitFor(() => expect(result.current.data?.parties).toHaveLength(0))
    expect(result.current.data?.pagination.total).toBe(0)
    expect(mockToast.success).toHaveBeenCalledWith('Party A deleted', expect.any(Object))
  })

  it('shows error toast on fetch failure', async () => {
    mockGetParties.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useParties(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load parties')
  })

  it('handleCreate calls createParty and refreshes', async () => {
    mockCreateParty.mockResolvedValue({ id: '2', name: 'New Party' })
    const { result } = renderHook(() => useParties(), { wrapper })
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
