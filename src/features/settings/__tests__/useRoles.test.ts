import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRoles } from '../useRoles'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockGetRoles = vi.fn()
vi.mock('../role.service', () => ({
  getRoles: (...args: unknown[]) => mockGetRoles(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_ROLES = [{ id: 'r1', name: 'Admin' }, { id: 'r2', name: 'Staff' }]

describe('useRoles', () => {
  it('starts in loading state', () => {
    mockGetRoles.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useRoles('biz-1'))
    expect(result.current.status).toBe('loading')
    expect(result.current.roles).toEqual([])
  })

  it('does not fetch when businessId is empty', async () => {
    renderHook(() => useRoles(''))
    await new Promise((r) => setTimeout(r, 50))
    expect(mockGetRoles).not.toHaveBeenCalled()
  })

  it('fetches roles on mount', async () => {
    mockGetRoles.mockResolvedValue({ data: { roles: MOCK_ROLES } })
    const { result } = renderHook(() => useRoles('biz-1'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.roles).toEqual(MOCK_ROLES)
    expect(mockGetRoles).toHaveBeenCalledWith('biz-1', expect.any(AbortSignal))
  })

  it('shows toast on error', async () => {
    mockGetRoles.mockRejectedValue(new Error('Server error'))
    const { result } = renderHook(() => useRoles('biz-1'))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load roles')
  })

  it('shows ApiError message on error', async () => {
    const { ApiError } = await import('@/lib/api')
    mockGetRoles.mockRejectedValue(new ApiError('Forbidden', 'FORBIDDEN', 403))
    renderHook(() => useRoles('biz-1'))

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Forbidden'))
  })

  it('refresh triggers re-fetch', async () => {
    mockGetRoles.mockResolvedValue({ data: { roles: MOCK_ROLES } })
    const { result } = renderHook(() => useRoles('biz-1'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockGetRoles.mockResolvedValue({ data: { roles: [MOCK_ROLES[0]] } })

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.roles).toHaveLength(1))
    expect(mockGetRoles).toHaveBeenCalledTimes(2)
  })
})
