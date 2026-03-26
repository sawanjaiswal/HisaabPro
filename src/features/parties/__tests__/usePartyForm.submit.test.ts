import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

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

const wrapper = ({ children }: { children: ReactNode }) =>
  MemoryRouter({ children })

describe('usePartyForm — handleSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls createParty and navigates on success', async () => {
    mockCreateParty.mockResolvedValueOnce({ id: 'new-id' })
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
