/**
 * State machine unit tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import { isValidTransition, patchAppointmentStatus } from '../services/appointment-status.service.js'
import { STATUS_TRANSITIONS } from '../constants/appointment.constants.js'

describe('isValidTransition', () => {
  it('allows every transition declared in STATUS_TRANSITIONS', () => {
    for (const [from, allowed] of Object.entries(STATUS_TRANSITIONS)) {
      for (const to of allowed) {
        expect(isValidTransition(from as never, to)).toBe(true)
      }
    }
  })

  it('rejects COMPLETED → anything', () => {
    expect(isValidTransition('COMPLETED', 'SCHEDULED')).toBe(false)
    expect(isValidTransition('COMPLETED', 'CONFIRMED')).toBe(false)
    expect(isValidTransition('COMPLETED', 'CANCELLED')).toBe(false)
  })

  it('rejects SCHEDULED → IN_PROGRESS (must go through CHECKED_IN)', () => {
    expect(isValidTransition('SCHEDULED', 'IN_PROGRESS')).toBe(false)
  })
})

describe('patchAppointmentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an invalid transition with 400', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      id: 'a1',
      businessId: 'biz1',
      status: 'COMPLETED',
    } as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>)

    await expect(
      patchAppointmentStatus({
        businessId: 'biz1',
        actorUserId: 'user1',
        appointmentId: 'a1',
        toStatus: 'SCHEDULED',
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('is a no-op when toStatus equals current status', async () => {
    const row = { id: 'a1', businessId: 'biz1', status: 'SCHEDULED' }
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      row as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>
    )
    const result = await patchAppointmentStatus({
      businessId: 'biz1',
      actorUserId: 'user1',
      appointmentId: 'a1',
      toStatus: 'SCHEDULED',
    })
    expect(result).toMatchObject({ status: 'SCHEDULED' })
  })

  it('returns 404 when appointment not found in scope', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    await expect(
      patchAppointmentStatus({
        businessId: 'biz1',
        actorUserId: 'user1',
        appointmentId: 'a-not-mine',
        toStatus: 'CONFIRMED',
      })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
