import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  suspendBusiness,
  reactivateBusiness,
  deriveSuspendState,
} from '../suspend.service'

const mockApi = vi.fn()
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.mockResolvedValue({
    business: { id: 'biz-1', name: 'Raju Traders', suspendedAt: null },
  })
})

describe('deriveSuspendState', () => {
  it('returns active when business is null', () => {
    expect(deriveSuspendState(null)).toBe('active')
  })

  it('returns active when both suspendedAt fields are null', () => {
    expect(
      deriveSuspendState({ suspendedAt: null, businessSuspendedAt: null }),
    ).toBe('active')
  })

  it('returns active when both suspendedAt fields are undefined', () => {
    expect(deriveSuspendState({})).toBe('active')
  })

  it('returns firm-suspended when businessSuspendedAt is set (highest priority)', () => {
    expect(
      deriveSuspendState({
        suspendedAt: '2026-05-17T10:00:00Z',
        businessSuspendedAt: '2026-05-17T11:00:00Z',
      }),
    ).toBe('firm-suspended')
  })

  it('returns member-suspended when only member suspendedAt is set', () => {
    expect(
      deriveSuspendState({
        suspendedAt: '2026-05-17T10:00:00Z',
        businessSuspendedAt: null,
      }),
    ).toBe('member-suspended')
  })

  it('returns firm-suspended even when member is active', () => {
    expect(
      deriveSuspendState({
        suspendedAt: null,
        businessSuspendedAt: '2026-05-17T11:00:00Z',
      }),
    ).toBe('firm-suspended')
  })
})

describe('suspendBusiness', () => {
  it('posts to /businesses/:id/suspend with reason + entityType + entityLabel', async () => {
    await suspendBusiness({
      businessId: 'biz-abc',
      businessName: 'Raju Traders',
      reason: 'Tax filing pause',
    })

    expect(mockApi).toHaveBeenCalledOnce()
    expect(mockApi).toHaveBeenCalledWith(
      '/businesses/biz-abc/suspend',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Tax filing pause' }),
        entityType: 'business',
        entityLabel: 'Raju Traders',
      }),
    )
  })

  it('strips empty reason to undefined (no audit "  " trim leak)', async () => {
    await suspendBusiness({
      businessId: 'biz-abc',
      businessName: 'Raju Traders',
      reason: '   ',
    })

    expect(mockApi).toHaveBeenCalledWith(
      '/businesses/biz-abc/suspend',
      expect.objectContaining({
        body: JSON.stringify({ reason: undefined }),
      }),
    )
  })

  it('omits reason field cleanly when not provided', async () => {
    await suspendBusiness({
      businessId: 'biz-abc',
      businessName: 'Raju Traders',
    })

    expect(mockApi).toHaveBeenCalledWith(
      '/businesses/biz-abc/suspend',
      expect.objectContaining({
        body: JSON.stringify({ reason: undefined }),
      }),
    )
  })
})

describe('reactivateBusiness', () => {
  it('posts to /businesses/:id/reactivate with entityType=business', async () => {
    await reactivateBusiness({
      businessId: 'biz-xyz',
      businessName: 'Priya Wholesale',
      reason: 'Tax filing done',
    })

    expect(mockApi).toHaveBeenCalledOnce()
    expect(mockApi).toHaveBeenCalledWith(
      '/businesses/biz-xyz/reactivate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'Tax filing done' }),
        entityType: 'business',
        entityLabel: 'Priya Wholesale',
      }),
    )
  })

  it('returns the updated business payload', async () => {
    mockApi.mockResolvedValue({
      business: { id: 'biz-xyz', name: 'Priya Wholesale', suspendedAt: null },
    })

    const result = await reactivateBusiness({
      businessId: 'biz-xyz',
      businessName: 'Priya Wholesale',
    })

    expect(result.business.suspendedAt).toBeNull()
    expect(result.business.id).toBe('biz-xyz')
  })

  it('propagates API errors (caller renders toast)', async () => {
    mockApi.mockRejectedValue(new Error('NOT_OWNER'))

    await expect(
      reactivateBusiness({ businessId: 'biz-x', businessName: 'X' }),
    ).rejects.toThrow('NOT_OWNER')
  })
})
