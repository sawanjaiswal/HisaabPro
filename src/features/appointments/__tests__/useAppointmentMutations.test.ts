/** Tests for useAppointmentMutations — focus on the 409 replay-rejection
 *  toast wiring (FE-1's only feature-aware error path). */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string
    status: number
    constructor(m: string, c: string, s: number) {
      super(m)
      this.code = c
      this.status = s
    }
  },
}))

const mockCreate = vi.fn()
const mockPatch = vi.fn()
vi.mock('../appointment.service', () => ({
  createAppointment: (...args: unknown[]) => mockCreate(...args),
  patchAppointmentStatus: (...args: unknown[]) => mockPatch(...args),
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      appointmentReplayRejected: "Couldn't update {party}'s appointment — status no longer valid",
      appointmentCreated: 'Appointment created',
      appointmentUpdated: 'Appointment updated',
      appointmentQueued: 'Saved — will sync when online',
      appointmentSaveFailed: 'Could not save appointment',
    },
  }),
}))

import { useAppointmentMutations } from '../hooks/useAppointmentMutations'
import { ApiError } from '@/lib/api'
import { createTestWrapper } from '@/test/query-wrapper'

const wrapper = createTestWrapper()

const BODY = {
  partyId: 'p1',
  employeeId: null,
  startAt: new Date(2026, 4, 30, 9, 30).toISOString(),
  endAt: new Date(2026, 4, 30, 10, 0).toISOString(),
}

describe('useAppointmentMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('create() — success toast + invalidation', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'a1' })
    const { result } = renderHook(() => useAppointmentMutations(), { wrapper })
    await result.current.create(BODY, 'Raju Traders')
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled())
  })

  it('create() — 409 fires replay-rejection toast keyed to party name', async () => {
    mockCreate.mockRejectedValueOnce(new ApiError('Conflict', 'CONFLICT', 409))
    const { result } = renderHook(() => useAppointmentMutations(), { wrapper })
    await expect(result.current.create(BODY, 'Raju Traders')).rejects.toBeTruthy()
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled())
    const arg = mockToast.error.mock.calls[0]?.[0] as string
    expect(arg).toContain('Raju Traders')
  })

  it('patchStatus() — 409 fires replay-rejection toast', async () => {
    mockPatch.mockRejectedValueOnce(new ApiError('Conflict', 'CONFLICT', 409))
    const { result } = renderHook(() => useAppointmentMutations(), { wrapper })
    await expect(
      result.current.patchStatus('a1', { toStatus: 'CHECKED_IN' }, 'Raju', BODY.startAt),
    ).rejects.toBeTruthy()
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled())
  })

  it('tolerates the optimistic {} offline return without dereferencing', async () => {
    mockCreate.mockResolvedValueOnce({})
    const { result } = renderHook(() => useAppointmentMutations(), { wrapper })
    const res = await result.current.create(BODY, 'Raju Traders')
    expect(res).toBeDefined()
    // No id field, but we don't try to deref it — success toast still fires.
    await waitFor(() => expect(mockToast.success).toHaveBeenCalled())
  })
})
