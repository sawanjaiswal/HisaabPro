/**
 * Saving a party with no signal must read as saved.
 *
 * api() queues the mutation and resolves `{}`, so the service has no party to
 * return. A handler that dereferences it throws before the toast and the
 * navigation — leaving the shopkeeper on a filled form with no confirmation,
 * where the only sensible thing to do is press Save again and queue a
 * duplicate. See .claude/fix-trace-offline-party-save-no-feedback.md.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockCreateParty = vi.fn()
const mockUpdateParty = vi.fn()
vi.mock('../party.service', () => ({
  createParty: (...args: unknown[]) => mockCreateParty(...args),
  updateParty: (...args: unknown[]) => mockUpdateParty(...args),
}))

vi.mock('../useGstinVerify', () => ({
  useGstinVerify: () => ({ status: 'idle', result: null, error: null, onGstinChange: vi.fn() }),
}))

import { usePartyForm } from '../usePartyForm'
import { queryKeys } from '@/lib/query-keys'
import type { PartyListResponse } from '../party.types'

// A cached list is what turns the missing record into a thrown TypeError:
// reconcilePartyCreated only reads `created.id` when there is a page to insert
// into. Without it the bug hides.
const FILTERS = { page: 1, limit: 20, search: '', type: 'ALL', isActive: true, sortBy: 'name', sortOrder: 'asc' }

function makeListCache(): PartyListResponse {
  return {
    parties: [{ id: 'existing', name: 'Old Party', type: 'CUSTOMER' } as PartyListResponse['parties'][number]],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    summary: {
      totalReceivable: 0, totalPayable: 0, netOutstanding: 0,
      totalParties: 1, customersCount: 1, suppliersCount: 0, bothCount: 0,
    },
  }
}

let queryClient: QueryClient

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient },
    createElement(MemoryRouter, null, children))

describe('usePartyForm — saving while offline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(queryKeys.parties.list(FILTERS), makeListCache())
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('confirms the queued save and leaves the form', async () => {
    // What createParty resolves once api() has queued the POST: no record yet.
    mockCreateParty.mockResolvedValueOnce(null)
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    act(() => {
      result.current.updateField('name', 'Raju Traders')
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(mockToast.error, 'a queued save is not a failure').not.toHaveBeenCalled()
    expect(mockToast.success).toHaveBeenCalledTimes(1)
    expect(String(mockToast.success.mock.calls[0]?.[0])).toMatch(/will sync when online/i)
    expect(mockNavigate).toHaveBeenCalledWith('/parties')
  })

  it('still reports a plain success when the save reached the server', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    mockCreateParty.mockResolvedValueOnce({ id: 'new-id', name: 'Raju Traders', type: 'CUSTOMER' })
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    act(() => {
      result.current.updateField('name', 'Raju Traders')
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(mockToast.success).toHaveBeenCalledWith('Raju Traders added successfully')
    expect(mockNavigate).toHaveBeenCalledWith('/parties')
  })
})
