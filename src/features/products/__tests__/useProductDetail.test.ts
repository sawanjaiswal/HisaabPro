import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockGetProduct = vi.fn()
vi.mock('../product.service', () => ({ getProduct: (...args: unknown[]) => mockGetProduct(...args) }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; constructor(m: string, c: string) { super(m); this.code = c } },
}))

import { useProductDetail } from '../useProductDetail'

const MOCK_PRODUCT = { id: 'prod-1', name: 'Widget', price: 5000 }

describe('useProductDetail', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('starts in loading state', () => {
    mockGetProduct.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useProductDetail('prod-1'))
    expect(result.current.status).toBe('loading')
    expect(result.current.product).toBeNull()
  })

  it('fetches product on mount and sets success', async () => {
    mockGetProduct.mockResolvedValue(MOCK_PRODUCT)
    const { result } = renderHook(() => useProductDetail('prod-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.product).toEqual(MOCK_PRODUCT)
    expect(mockGetProduct).toHaveBeenCalledWith('prod-1', expect.any(AbortSignal))
  })

  it('shows error toast on failure', async () => {
    mockGetProduct.mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useProductDetail('prod-1'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load product')
  })

  it('defaults activeTab to overview', () => {
    mockGetProduct.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useProductDetail('prod-1'))
    expect(result.current.activeTab).toBe('overview')
  })

  it('refresh triggers re-fetch', async () => {
    mockGetProduct.mockResolvedValue(MOCK_PRODUCT)
    const { result } = renderHook(() => useProductDetail('prod-1'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    result.current.refresh()
    await waitFor(() => expect(mockGetProduct).toHaveBeenCalledTimes(2))
  })
})
