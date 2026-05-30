/**
 * Convert service — happy path + idempotency replay + status guard +
 * cross-tenant 404.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '../lib/prisma.js'
import {
  convertAppointmentToJob,
  convertAppointmentToInvoice,
} from '../services/appointment-convert.service.js'

const apptCompleted = {
  id: 'a1',
  status: 'COMPLETED',
  businessId: 'biz1',
  partyId: 'p1',
  partyNameSnapshot: 'Acme',
  startAt: new Date('2026-05-20T10:00:00Z'),
}

describe('convertAppointmentToJob', () => {
  beforeEach(() => vi.clearAllMocks())

  it('404 when appointment not found in scope', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    await expect(
      convertAppointmentToJob({ businessId: 'biz1', userId: 'u1' }, 'a1')
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('replays existing Job when appointmentId already linked', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      apptCompleted as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>
    )
    vi.mocked(prisma.job.findFirst).mockResolvedValue({
      id: 'job-1',
    } as unknown as Awaited<ReturnType<typeof prisma.job.findFirst>>)

    const result = await convertAppointmentToJob(
      { businessId: 'biz1', userId: 'u1' },
      'a1'
    )
    expect(result).toEqual({ jobId: 'job-1', replayed: true })
  })

  it('409 when status not IN_PROGRESS or COMPLETED', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue({
      ...apptCompleted,
      status: 'SCHEDULED',
    } as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>)
    vi.mocked(prisma.job.findFirst).mockResolvedValue(null)

    await expect(
      convertAppointmentToJob({ businessId: 'biz1', userId: 'u1' }, 'a1')
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('creates Job with appointmentId FK and default placeholder line', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      apptCompleted as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>
    )
    vi.mocked(prisma.job.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.job.create).mockResolvedValue({
      id: 'job-new',
    } as unknown as Awaited<ReturnType<typeof prisma.job.create>>)

    const result = await convertAppointmentToJob(
      { businessId: 'biz1', userId: 'u1' },
      'a1'
    )
    expect(result).toEqual({ jobId: 'job-new', replayed: false })

    const args = vi.mocked(prisma.job.create).mock.calls[0]?.[0] as
      | { data: { appointmentId: string; businessId: string; partyId: string } }
      | undefined
    expect(args?.data.appointmentId).toBe('a1')
    expect(args?.data.businessId).toBe('biz1')
    expect(args?.data.partyId).toBe('p1')
  })

  it('creates Job with supplied items (paise math)', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      apptCompleted as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>
    )
    vi.mocked(prisma.job.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.job.create).mockResolvedValue({
      id: 'job-x',
    } as unknown as Awaited<ReturnType<typeof prisma.job.create>>)

    await convertAppointmentToJob({ businessId: 'biz1', userId: 'u1' }, 'a1', {
      items: [
        { description: 'Haircut', quantity: 1, unitPricePaise: 50_000 },
        { description: 'Shave', quantity: 2, unitPricePaise: 30_000 },
      ],
    })
    const args = vi.mocked(prisma.job.create).mock.calls[0]?.[0] as
      | { data: { subtotalPaise: number; totalPaise: number } }
      | undefined
    // 50_000 + 2*30_000 = 110_000 paise
    expect(args?.data.subtotalPaise).toBe(110_000)
    expect(args?.data.totalPaise).toBe(110_000)
  })
})

describe('convertAppointmentToInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replays existing Document when appointmentId already linked', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      apptCompleted as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>
    )
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: 'doc-1',
    } as unknown as Awaited<ReturnType<typeof prisma.document.findFirst>>)

    const result = await convertAppointmentToInvoice(
      { businessId: 'biz1', userId: 'u1' },
      'a1'
    )
    expect(result).toEqual({ documentId: 'doc-1', replayed: true })
  })

  it('creates DRAFT Document with appointmentId FK', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(
      apptCompleted as unknown as Awaited<ReturnType<typeof prisma.appointment.findFirst>>
    )
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.document.create).mockResolvedValue({
      id: 'doc-new',
    } as unknown as Awaited<ReturnType<typeof prisma.document.create>>)

    const result = await convertAppointmentToInvoice(
      { businessId: 'biz1', userId: 'u1' },
      'a1'
    )
    expect(result).toEqual({ documentId: 'doc-new', replayed: false })

    const args = vi.mocked(prisma.document.create).mock.calls[0]?.[0] as
      | { data: { appointmentId: string; status: string; type: string } }
      | undefined
    expect(args?.data.appointmentId).toBe('a1')
    expect(args?.data.status).toBe('DRAFT')
    expect(args?.data.type).toBe('SALE_INVOICE')
  })

  it('404 when appointment not in scope', async () => {
    vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null)
    await expect(
      convertAppointmentToInvoice({ businessId: 'biz1', userId: 'u1' }, 'a1')
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
