import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTemplates } from '../useTemplates'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockGetTemplates = vi.fn()
vi.mock('../template.service', () => ({
  getTemplates: (...args: unknown[]) => mockGetTemplates(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_TEMPLATES = [
  { id: '1', name: 'Standard', isDefault: true },
  { id: '2', name: 'Modern', isDefault: false },
]

describe('useTemplates', () => {
  it('starts in loading state', () => {
    mockGetTemplates.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useTemplates())
    expect(result.current.status).toBe('loading')
    expect(result.current.templates).toEqual([])
  })

  it('fetches templates on mount', async () => {
    mockGetTemplates.mockResolvedValue(MOCK_TEMPLATES)
    const { result } = renderHook(() => useTemplates())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.templates).toEqual(MOCK_TEMPLATES)
  })

  it('shows toast on error', async () => {
    mockGetTemplates.mockRejectedValue(new Error('Server error'))
    const { result } = renderHook(() => useTemplates())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load templates')
  })

  it('shows ApiError message on error', async () => {
    const { ApiError } = await import('@/lib/api')
    mockGetTemplates.mockRejectedValue(new ApiError('Custom msg', 'ERR', 500))
    renderHook(() => useTemplates())

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Custom msg'))
  })

  it('refresh triggers re-fetch', async () => {
    mockGetTemplates.mockResolvedValue(MOCK_TEMPLATES)
    const { result } = renderHook(() => useTemplates())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockGetTemplates.mockResolvedValue([MOCK_TEMPLATES[0]])

    result.current.refresh()
    await waitFor(() => expect(result.current.templates).toHaveLength(1))
    expect(mockGetTemplates).toHaveBeenCalledTimes(2)
  })
})
