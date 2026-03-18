import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error { code: string; status: number; constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s } },
}))

const mockGetProducts = vi.fn()
const mockCreateProduct = vi.fn()
const mockDeleteProduct = vi.fn()
vi.mock('../product.service', () => ({
  getProducts: (...args: unknown[]) => mockGetProducts(...args),
  createProduct: (...args: unknown[]) => mockCreateProduct(...args),
  deleteProduct: (...args: unknown[]) => mockDeleteProduct(...args),
}))

import { useProducts } from '../useProducts'

const MOCK_RESPONSE = {
  products: [{ id: '1', name: 'Product A' }],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
}

describe('useProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetProducts.mockResolvedValue(MOCK_RESPONSE)
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => useProducts())
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
  })

  it('fetches products on mount', async () => {
    const { result } = renderHook(() => useProducts())
    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.data).toEqual(MOCK_RESPONSE)
    expect(mockGetProducts).toHaveBeenCalledTimes(1)
  })

  it('setFilter updates filter and resets page to 1', async () => {
    const { result } = renderHook(() => useProducts())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setFilter('status', 'INACTIVE'))
    expect(result.current.filters.status).toBe('INACTIVE')
    expect(result.current.filters.page).toBe(1)
  })

  it('setPage changes page number', async () => {
    const { result } = renderHook(() => useProducts())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.setPage(3))
    expect(result.current.filters.page).toBe(3)
  })

  it('refresh triggers re-fetch', async () => {
    const { result } = renderHook(() => useProducts())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callsBefore = mockGetProducts.mock.calls.length

    act(() => result.current.refresh())
    await waitFor(() => expect(mockGetProducts.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('handleDelete optimistically removes item from list', async () => {
    const { result } = renderHook(() => useProducts())
    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => result.current.handleDelete('1', 'Product A'))
    expect(result.current.data?.products).toHaveLength(0)
    expect(result.current.data?.pagination.total).toBe(0)
    expect(mockToast.success).toHaveBeenCalledWith('Product A deleted', expect.any(Object))
  })

  it('shows error toast on fetch failure', async () => {
    mockGetProducts.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useProducts())
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load products')
  })

  it('handleCreate calls createProduct and refreshes', async () => {
    mockCreateProduct.mockResolvedValue({ id: '2', name: 'New Product' })
    const { result } = renderHook(() => useProducts())
    await waitFor(() => expect(result.current.status).toBe('success'))
    const callsBefore = mockGetProducts.mock.calls.length

    await act(async () => {
      await result.current.handleCreate({ name: 'New Product' } as never)
    })
    expect(mockCreateProduct).toHaveBeenCalledWith({ name: 'New Product' })
    expect(mockToast.success).toHaveBeenCalledWith('New Product added successfully')
    await waitFor(() => expect(mockGetProducts.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})
