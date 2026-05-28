/**
 * POST /api/jobs — V1 hourly-billing route proofs.
 *
 * Coverage:
 *   - 401 anon
 *   - 400 invalid kind (not ITEM|HOURLY)
 *   - 400 negative estimatedHours
 *   - 400 estimatedHours over the 100000 cap
 *   - 201 create with an HOURLY line → asserts the service persists
 *     item.kind='HOURLY', job.estimatedHours/actualHours, and that the
 *     money math is unchanged (totalPaise = round(hours*ratePerHr) − discount,
 *     grand total clamped to ≥ 0 to match FE jobs.utils.ts).
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

const numberSvc = vi.hoisted(() => ({
  generateNextNumber: vi.fn(),
}))
vi.mock('../../services/document-number.service.js', () => ({
  generateNextNumber: numberSvc.generateNextNumber,
}))

import { createApp } from '../../app.js'
import {
  anonAgent,
  authAgent,
  mockOwnerPermission,
  resetMocks,
  getMockPrisma,
} from '../../__tests__/helpers.js'

let app: ReturnType<typeof createApp>

beforeAll(() => {
  app = createApp()
})

beforeEach(() => {
  resetMocks()
  vi.clearAllMocks()
  mockOwnerPermission()
  numberSvc.generateNextNumber.mockResolvedValue({
    documentNumber: 'JOB-001',
    sequenceNumber: 1,
    financialYear: '2025-26',
  })
  const mp = getMockPrisma()
  // party.findFirst must return a truthy party (createJob throws 404 otherwise)
  mp.party.findFirst.mockResolvedValue({ id: 'party-1' })
  // clientId replay lookup → none
  mp.job.findFirst.mockResolvedValue(null)
  mp.job.create.mockResolvedValue({ id: 'job-1' })
})

const hourlyLine = {
  kind: 'HOURLY',
  description: 'Plumbing labour',
  quantity: 2.5,        // hours
  ratePaise: 50000,     // ₹500 / hr
  discountPaise: 0,
}

describe('POST /api/jobs — hourly billing', () => {
  it('401 anon', async () => {
    const res = await anonAgent(app).post('/api/jobs').send({
      partyId: 'clxtestparty00000000000001',
      title: 'X',
      items: [hourlyLine],
    })
    expect(res.status).toBe(401)
  })

  it('400 invalid kind', async () => {
    const res = await authAgent(app).post('/api/jobs').send({
      partyId: 'clxtestparty00000000000001',
      title: 'Job',
      items: [{ ...hourlyLine, kind: 'WEEKLY' }],
    })
    expect(res.status).toBe(400)
  })

  it('400 negative estimatedHours', async () => {
    const res = await authAgent(app).post('/api/jobs').send({
      partyId: 'clxtestparty00000000000001',
      title: 'Job',
      estimatedHours: -1,
      items: [hourlyLine],
    })
    expect(res.status).toBe(400)
  })

  it('400 estimatedHours over cap', async () => {
    const res = await authAgent(app).post('/api/jobs').send({
      partyId: 'clxtestparty00000000000001',
      title: 'Job',
      estimatedHours: 100001,
      items: [hourlyLine],
    })
    expect(res.status).toBe(400)
  })

  it('201 create with HOURLY line — persists kind + hours, money unchanged', async () => {
    const mp = getMockPrisma()
    const res = await authAgent(app).post('/api/jobs').send({
      partyId: 'clxtestparty00000000000001',
      title: 'Bathroom repair',
      estimatedHours: 3,
      actualHours: 2.5,
      items: [hourlyLine],
    })

    expect(res.status).toBe(201)
    expect(mp.job.create).toHaveBeenCalledTimes(1)
    const payload = mp.job.create.mock.calls[0][0].data

    // job-level hours stored (tracking-only)
    expect(payload.estimatedHours).toBe(3)
    expect(payload.actualHours).toBe(2.5)

    // money: 2.5h × ₹500/hr = ₹1250 = 125000 paise, discount 0
    expect(payload.subtotalPaise).toBe(125000)
    expect(payload.totalPaise).toBe(125000)
    expect(payload.discountPaise).toBe(0)

    // line carries kind=HOURLY and the same line total
    const line = payload.items.createMany.data[0]
    expect(line.kind).toBe('HOURLY')
    expect(line.totalPaise).toBe(125000)
  })

  it('grand total clamps to 0 when discount exceeds line base', async () => {
    const mp = getMockPrisma()
    const res = await authAgent(app).post('/api/jobs').send({
      partyId: 'clxtestparty00000000000001',
      title: 'Discounted',
      items: [{ ...hourlyLine, discountPaise: 200000 }], // discount > 125000 base
    })

    expect(res.status).toBe(201)
    const payload = mp.job.create.mock.calls[0][0].data
    // per-line stays unclamped (−75000) but grand total floors at 0
    expect(payload.totalPaise).toBe(0)
  })
})
