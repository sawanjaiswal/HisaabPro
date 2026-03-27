import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockApi = vi.fn()
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))

import { useTaxCategoryDetail } from '../useTaxCategoryDetail'

const MOCK_CATEGORY = { id: 'tc-1', name: 'GST 18%', rate: 1800 }

describe('useTaxCategoryDetail', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockApi.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useTaxCategoryDetail('tc-1'))
    expect(result.current.status).toBe('loading')
    expect(result.current.category).toBeNull()
  })

  it('fetches category on mount', async () => {
    mockApi.mockResolvedValue(MOCK_CATEGORY)
    const { result } = renderHook(() => useTaxCategoryDetail('tc-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.category).toEqual(MOCK_CATEGORY)
    expect(mockApi).toHaveBeenCalledWith('/tax-categories/tc-1', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('shows error toast on failure', async () => {
    mockApi.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useTaxCategoryDetail('tc-1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load tax category')
  })

  it('skips fetch for empty id', () => {
    renderHook(() => useTaxCategoryDetail(''))
    expect(mockApi).not.toHaveBeenCalled()
  })

  it('refresh triggers re-fetch', async () => {
    mockApi.mockResolvedValue(MOCK_CATEGORY)
    const { result } = renderHook(() => useTaxCategoryDetail('tc-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    result.current.refresh()
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2))
  })
})
