import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { PartyListResponse } from '../party.types'

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
  useGstinVerify: () => ({
    status: 'idle',
    result: null,
    error: null,
    onGstinChange: vi.fn(),
  }),
}))

import { usePartyForm } from '../usePartyForm'

// Seeded so we can assert the created party is inserted INSTANTLY (not just
// after a reload) — this is the regression the SSOT party-cache fix guards.
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

describe('usePartyForm — handleSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(queryKeys.parties.list(FILTERS), makeListCache())
  })

  it('calls createParty and navigates on success', async () => {
    mockCreateParty.mockResolvedValueOnce({ id: 'new-id', name: 'Raju Traders', type: 'CUSTOMER' })
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    act(() => {
      result.current.updateField('name', 'Raju Traders')
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(mockCreateParty).toHaveBeenCalledTimes(1)
    expect(mockToast.success).toHaveBeenCalledWith(
      'Raju Traders added successfully',
    )
    expect(mockNavigate).toHaveBeenCalledWith('/parties')
  })

  it('inserts the created party into the list cache instantly (regression)', async () => {
    mockCreateParty.mockResolvedValueOnce({ id: 'new-id', name: 'Raju Traders', type: 'CUSTOMER' })
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    act(() => {
      result.current.updateField('name', 'Raju Traders')
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    const cached = queryClient.getQueryData<PartyListResponse>(queryKeys.parties.list(FILTERS))
    expect(cached?.parties[0]?.id).toBe('new-id')
    expect(cached?.parties).toHaveLength(2)
    expect(cached?.pagination.total).toBe(2)
  })

  it('shows error toast on failure', async () => {
    mockCreateParty.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    act(() => {
      result.current.updateField('name', 'Raju Traders')
    })

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(mockToast.error).toHaveBeenCalledWith(
      'Failed to save party. Please try again.',
    )
  })

  it('does not submit when validation fails', async () => {
    const { result } = renderHook(() => usePartyForm(), { wrapper })

    await act(async () => {
      await result.current.handleSubmit()
    })

    expect(mockCreateParty).not.toHaveBeenCalled()
    expect(result.current.errors.name).toBeTruthy()
  })
})
