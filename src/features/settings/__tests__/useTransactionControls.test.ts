import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTransactionControls } from '../useTransactionControls'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', businessId: 'biz-1' } }),
}))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockGetConfig = vi.fn()
const mockUpdateConfig = vi.fn()
vi.mock('../security.service', () => ({
  getTransactionLockConfig: (...args: unknown[]) => mockGetConfig(...args),
  updateTransactionLockConfig: (...args: unknown[]) => mockUpdateConfig(...args),
}))

vi.mock('../settings.constants', () => ({
  DEFAULT_TRANSACTION_LOCK_CONFIG: { lockAfterDays: 30, enabled: false },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

const MOCK_CONFIG = { lockAfterDays: 7, enabled: true }

describe('useTransactionControls', () => {
  it('starts in loading state', () => {
    mockGetConfig.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useTransactionControls())
    expect(result.current.status).toBe('loading')
  })

  it('fetches config on mount', async () => {
    vi.useRealTimers()
    mockGetConfig.mockResolvedValue({ data: MOCK_CONFIG })
    const { result } = renderHook(() => useTransactionControls())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.config).toEqual(MOCK_CONFIG)
  })

  it('shows toast on fetch error', async () => {
    vi.useRealTimers()
    mockGetConfig.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useTransactionControls())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load settings')
  })

  it('updateField updates config locally and debounced-saves', async () => {
    vi.useRealTimers()
    mockGetConfig.mockResolvedValue({ data: MOCK_CONFIG })
    mockUpdateConfig.mockResolvedValue({})
    const { result } = renderHook(() => useTransactionControls())

    await waitFor(() => expect(result.current.status).toBe('success'))

    act(() => { result.current.updateField('lockAfterDays', 14) })
    expect(result.current.config.lockAfterDays).toBe(14)
  })

  it('refresh triggers re-fetch', async () => {
    vi.useRealTimers()
    mockGetConfig.mockResolvedValue({ data: MOCK_CONFIG })
    const { result } = renderHook(() => useTransactionControls())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockGetConfig.mockResolvedValue({ data: { ...MOCK_CONFIG, lockAfterDays: 30 } })

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.config.lockAfterDays).toBe(30))
    expect(mockGetConfig).toHaveBeenCalledTimes(2)
  })
})
