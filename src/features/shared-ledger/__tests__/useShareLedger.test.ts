import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useShareLedger } from '../useShareLedger'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockListShares = vi.fn()
const mockCreateShare = vi.fn()
const mockRevokeShare = vi.fn()
vi.mock('../shared-ledger.service', () => ({
  listLedgerShares: (...args: unknown[]) => mockListShares(...args),
  createLedgerShare: (...args: unknown[]) => mockCreateShare(...args),
  revokeLedgerShare: (...args: unknown[]) => mockRevokeShare(...args),
}))

vi.mock('../shared-ledger.utils', () => ({
  buildShareUrl: (token: string) => `https://app.test/share/${token}`,
  copyToClipboard: vi.fn().mockResolvedValue(true),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_SHARES = [{ id: 's1', shareToken: 'tok1', partyId: 'p1' }]

describe('useShareLedger', () => {
  it('starts with empty shares and loading false after fetch', async () => {
    mockListShares.mockResolvedValue(MOCK_SHARES)
    const { result } = renderHook(() => useShareLedger('p1'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.shares).toEqual(MOCK_SHARES)
  })

  it('handles load failure silently', async () => {
    mockListShares.mockRejectedValue(new Error('not available'))
    const { result } = renderHook(() => useShareLedger('p1'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.shares).toEqual([])
    expect(mockToast.error).not.toHaveBeenCalled()
  })

  it('creates a share and copies link', async () => {
    mockListShares.mockResolvedValue([])
    const newShare = { id: 's2', shareToken: 'tok2', partyId: 'p1' }
    mockCreateShare.mockResolvedValue(newShare)

    const { result } = renderHook(() => useShareLedger('p1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const created = await act(() => result.current.createShare({ expiryDays: 7 }))
    expect(created).toEqual(newShare)
    expect(mockToast.success).toHaveBeenCalledWith('Share link copied!')
  })

  it('shows error toast on create failure', async () => {
    mockListShares.mockResolvedValue([])
    mockCreateShare.mockRejectedValue(new Error('fail'))

    const { result } = renderHook(() => useShareLedger('p1'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const created = await act(() => result.current.createShare({ expiryDays: 7 }))
    expect(created).toBeNull()
    expect(mockToast.error).toHaveBeenCalledWith('Failed to create share link')
  })

  it('revokes a share and removes from list', async () => {
    mockListShares.mockResolvedValue(MOCK_SHARES)
    mockRevokeShare.mockResolvedValue(undefined)

    const { result } = renderHook(() => useShareLedger('p1'))
    await waitFor(() => expect(result.current.shares).toHaveLength(1))

    await act(() => result.current.revokeShare('s1'))
    expect(result.current.shares).toHaveLength(0)
    expect(mockToast.success).toHaveBeenCalledWith('Share link revoked')
  })

  it('refresh re-loads shares', async () => {
    mockListShares.mockResolvedValue(MOCK_SHARES)
    const { result } = renderHook(() => useShareLedger('p1'))

    await waitFor(() => expect(result.current.shares).toHaveLength(1))
    mockListShares.mockResolvedValue([])

    await act(() => result.current.refresh())
    expect(result.current.shares).toEqual([])
  })
})
