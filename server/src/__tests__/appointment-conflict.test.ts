/**
 * Conflict primitive tests — pre-check shape + PG exclusion-violation
 * translation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import {
  hasOverlappingAppointment,
  withSlotConflictTranslation,
} from '../services/appointment-conflict.service.js'
import { PG_EXCLUSION_VIOLATION } from '../constants/appointment.constants.js'

describe('hasOverlappingAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when employeeId is null (any-staff slot)', async () => {
    const result = await hasOverlappingAppointment(prisma, {
      businessId: 'biz1',
      employeeId: null,
      startAt: new Date('2026-06-01T10:00:00Z'),
      endAt: new Date('2026-06-01T10:30:00Z'),
    })
    expect(result).toBe(false)
  })

  it('returns true when a conflicting row exists', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'a-other' } as unknown as Awaited<
      ReturnType<typeof prisma.appointment.findFirst>
    >)
    const result = await hasOverlappingAppointment(prisma, {
      businessId: 'biz1',
      employeeId: 'e1',
      startAt: new Date('2026-06-01T10:00:00Z'),
      endAt: new Date('2026-06-01T10:30:00Z'),
    })
    expect(result).toBe(true)
  })
})

describe('withSlotConflictTranslation', () => {
  it('passes through success values', async () => {
    const result = await withSlotConflictTranslation(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('translates PG 23P01 into 409 AppError', async () => {
    const err = Object.assign(new Error('exclusion violation'), {
      code: PG_EXCLUSION_VIOLATION,
    })
    await expect(
      withSlotConflictTranslation(async () => {
        throw err
      })
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('re-throws unrelated errors untouched', async () => {
    const err = new Error('boom')
    await expect(
      withSlotConflictTranslation(async () => {
        throw err
      })
    ).rejects.toBe(err)
  })

  it('detects 23P01 from Prisma meta.code envelope', async () => {
    const err = Object.assign(new Error('Prisma error'), {
      meta: { code: PG_EXCLUSION_VIOLATION },
    })
    await expect(
      withSlotConflictTranslation(async () => {
        throw err
      })
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})
