import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../../../lib/prisma.js'
import {
  supersedePendingMandatesForBusiness,
  cancelPendingMandateAsAbandoned,
  expireStalePendingMandate,
} from '../token-mandate.lifecycle.js'

vi.mock('../../../../lib/prisma.js', () => ({
  prisma: {
    upiMandate: {
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

describe('token-mandate.lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('supersedes pending mandates for business', async () => {
    vi.mocked(prisma.upiMandate.updateMany).mockResolvedValue({ count: 2 })

    const count = await supersedePendingMandatesForBusiness('biz_1')
    expect(count).toBe(2)
    expect(prisma.upiMandate.updateMany).toHaveBeenCalledWith({
      where: {
        businessId: 'biz_1',
        status: 'PENDING',
        razorpayTokenId: null,
      },
      data: {
        status: 'CANCELLED',
        statusReason: 'superseded_by_retry',
      },
    })
  })

  it('cancels pending mandate as abandoned', async () => {
    vi.mocked(prisma.upiMandate.findFirst).mockResolvedValue({ id: 'man_1' } as any)
    vi.mocked(prisma.upiMandate.updateMany).mockResolvedValue({ count: 1 })

    const res = await cancelPendingMandateAsAbandoned('biz_1')
    expect(res.cancelled).toBe(true)
    expect(res.mandateId).toBe('man_1')
  })

  it('expires stale pending mandate', async () => {
    vi.mocked(prisma.upiMandate.updateMany).mockResolvedValue({ count: 1 })

    const ok = await expireStalePendingMandate('man_1')
    expect(ok).toBe(true)
    expect(prisma.upiMandate.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'man_1',
        status: 'PENDING',
        razorpayTokenId: null,
      },
      data: {
        status: 'EXPIRED',
        statusReason: 'ttl_expired',
      },
    })
  })
})
