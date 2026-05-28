/**
 * checkout-session.service security proofs.
 *
 * MF-1 (money-out): a user-supplied couponCode must NEVER be forwarded to
 * Razorpay as a raw `offer_id`. Only a server-resolved `razorpayOfferId` from
 * an ACTIVE coupon may pass through; unknown/inactive/plan-mismatched/unlinked
 * codes are dropped.
 *
 * S3 (yearly-503): a YEARLY checkout with a missing `_YEARLY` plan env must
 * 503, never silently bill the monthly plan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCouponFindUnique,
  mockSubscriptionFindUnique,
  mockSubscriptionUpdate,
  mockSubscriptionsCreate,
} = vi.hoisted(() => ({
  mockCouponFindUnique: vi.fn(),
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionUpdate: vi.fn(),
  mockSubscriptionsCreate: vi.fn(),
}))

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    coupon: { findUnique: mockCouponFindUnique },
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      update: mockSubscriptionUpdate,
    },
  },
}))

vi.mock('razorpay', () => ({
  default: class {
    subscriptions = { create: mockSubscriptionsCreate }
  },
}))

import { createCheckoutSession } from '../checkout-session.service.js'

const ACTIVE_COUPON = {
  isActive: true,
  validFrom: new Date('2020-01-01'),
  validUntil: null,
  maxUses: null,
  usageCount: 0,
  planFilter: [] as string[],
  razorpayOfferId: 'offer_SERVER_TRUSTED',
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    businessId: 'biz_1',
    userId: 'user_1',
    tier: 'PRO' as const,
    billingCycle: 'MONTHLY' as const,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
  process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret'
  process.env.RAZORPAY_PLAN_PRO = 'plan_pro_monthly'
  delete process.env.RAZORPAY_PLAN_PRO_YEARLY
  mockSubscriptionFindUnique.mockResolvedValue({ id: 'sub_1' })
  mockSubscriptionUpdate.mockResolvedValue({})
  mockSubscriptionsCreate.mockResolvedValue({ id: 'rzp_sub_1', short_url: 'https://rzp.io/i/abc' })
})

describe('createCheckoutSession — MF-1 coupon resolution', () => {
  it('forwards the SERVER-resolved razorpayOfferId for an ACTIVE coupon (never the raw code)', async () => {
    mockCouponFindUnique.mockResolvedValue(ACTIVE_COUPON)

    await createCheckoutSession(baseInput({ couponCode: 'SAVE20' }))

    const opts = mockSubscriptionsCreate.mock.calls[0][0]
    expect(opts.offer_id).toBe('offer_SERVER_TRUSTED')
    expect(opts.offer_id).not.toBe('SAVE20')
  })

  it('drops an unknown couponCode — no offer_id forwarded', async () => {
    mockCouponFindUnique.mockResolvedValue(null)

    await createCheckoutSession(baseInput({ couponCode: 'offer_HARVESTED_90OFF' }))

    const opts = mockSubscriptionsCreate.mock.calls[0][0]
    expect(opts.offer_id).toBeUndefined()
  })

  it('drops an inactive (deactivated) coupon — no offer_id forwarded', async () => {
    mockCouponFindUnique.mockResolvedValue({ ...ACTIVE_COUPON, isActive: false })

    await createCheckoutSession(baseInput({ couponCode: 'DEAD' }))

    expect(mockSubscriptionsCreate.mock.calls[0][0].offer_id).toBeUndefined()
  })

  it('drops an expired coupon — no offer_id forwarded', async () => {
    mockCouponFindUnique.mockResolvedValue({ ...ACTIVE_COUPON, validUntil: new Date('2020-02-01') })

    await createCheckoutSession(baseInput({ couponCode: 'OLD' }))

    expect(mockSubscriptionsCreate.mock.calls[0][0].offer_id).toBeUndefined()
  })

  it('drops a plan-mismatched coupon — no offer_id forwarded', async () => {
    mockCouponFindUnique.mockResolvedValue({ ...ACTIVE_COUPON, planFilter: ['BUSINESS'] })

    await createCheckoutSession(baseInput({ tier: 'PRO', couponCode: 'BIZONLY' }))

    expect(mockSubscriptionsCreate.mock.calls[0][0].offer_id).toBeUndefined()
  })

  it('drops an active-but-unlinked coupon (no razorpayOfferId) — no offer_id forwarded', async () => {
    mockCouponFindUnique.mockResolvedValue({ ...ACTIVE_COUPON, razorpayOfferId: null })

    await createCheckoutSession(baseInput({ couponCode: 'NOTSYNCED' }))

    expect(mockSubscriptionsCreate.mock.calls[0][0].offer_id).toBeUndefined()
  })

  it('forwards no offer_id when no couponCode supplied', async () => {
    await createCheckoutSession(baseInput())

    expect(mockCouponFindUnique).not.toHaveBeenCalled()
    expect(mockSubscriptionsCreate.mock.calls[0][0].offer_id).toBeUndefined()
  })
})

describe('createCheckoutSession — result + S3 yearly-503', () => {
  it('returns the publishable razorpayKeyId in the result', async () => {
    const result = await createCheckoutSession(baseInput())
    expect(result.razorpayKeyId).toBe('rzp_test_key')
    expect(result.razorpaySubscriptionId).toBe('rzp_sub_1')
  })

  it('503s a YEARLY checkout when _YEARLY plan env is missing (no silent monthly charge)', async () => {
    await expect(
      createCheckoutSession(baseInput({ billingCycle: 'YEARLY' })),
    ).rejects.toMatchObject({ httpStatus: 503 })
    expect(mockSubscriptionsCreate).not.toHaveBeenCalled()
  })

  it('succeeds for YEARLY when the _YEARLY plan env is present', async () => {
    process.env.RAZORPAY_PLAN_PRO_YEARLY = 'plan_pro_yearly'
    const result = await createCheckoutSession(baseInput({ billingCycle: 'YEARLY' }))
    expect(mockSubscriptionsCreate.mock.calls[0][0].plan_id).toBe('plan_pro_yearly')
    expect(result.amountPaise).toBe(499900)
  })

  it('400s a FREE tier checkout', async () => {
    await expect(
      createCheckoutSession(baseInput({ tier: 'FREE' })),
    ).rejects.toMatchObject({ httpStatus: 400 })
  })
})
