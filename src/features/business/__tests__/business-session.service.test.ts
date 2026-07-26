/**
 * Acquiring a business must also activate it in the session.
 *
 * Business-scoped routes read `businessId` from the JWT claim, not from the URL.
 * A token minted before the account had a business carries `''`, so a shop that
 * exists in the database is invisible to every endpoint until the session is
 * re-minted — the Roles list 400s, staff cannot be invited, and the owner sees
 * an app that renders but answers nothing.
 * See .claude/fix-trace-business-session-activation.md.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBusiness, joinBusinessWithCode } from '../business-session.service'
import { api } from '@/lib/api'
import * as authLib from '@/lib/auth'

vi.mock('@/lib/api', () => ({ api: vi.fn() }))
vi.mock('@/lib/auth', () => ({ switchBusiness: vi.fn(), joinBusiness: vi.fn() }))

const NEW_BUSINESS = { id: 'biz-new', name: 'Raju Traders', businessType: 'general' }

describe('business session — acquiring a business activates it', () => {
  beforeEach(() => vi.clearAllMocks())

  it('activates the business it just created', async () => {
    vi.mocked(api).mockResolvedValue({ business: NEW_BUSINESS })

    const created = await createBusiness({ name: 'Raju Traders', businessType: 'general' })

    expect(created).toEqual(NEW_BUSINESS)
    expect(authLib.switchBusiness).toHaveBeenCalledWith(NEW_BUSINESS.id)
  })

  it('activates the business it just joined', async () => {
    vi.mocked(authLib.joinBusiness).mockResolvedValue({
      business: NEW_BUSINESS,
      businessUser: { id: 'bu-1', role: 'staff', status: 'ACTIVE' },
    } as Awaited<ReturnType<typeof authLib.joinBusiness>>)

    const joined = await joinBusinessWithCode('A1B2C3')

    expect(joined.business).toEqual(NEW_BUSINESS)
    expect(authLib.switchBusiness).toHaveBeenCalledWith(NEW_BUSINESS.id)
  })

  it('still reports the business when activation fails', async () => {
    // The shop exists either way; a failed re-mint is recoverable on the next
    // request's 401/refresh, and losing the success would strand a user who has
    // in fact already joined — the invite code is single-use.
    vi.mocked(api).mockResolvedValue({ business: NEW_BUSINESS })
    vi.mocked(authLib.switchBusiness).mockRejectedValue(new Error('rate limited'))

    await expect(createBusiness({ name: 'Raju Traders', businessType: 'general' })).resolves.toEqual(
      NEW_BUSINESS,
    )
  })

  it('names the mutation for the offline queue', async () => {
    vi.mocked(api).mockResolvedValue({ business: NEW_BUSINESS })

    await createBusiness({ name: 'Raju Traders', businessType: 'general' })

    expect(api).toHaveBeenCalledWith(
      '/businesses',
      expect.objectContaining({ entityType: 'business', entityLabel: 'Raju Traders' }),
    )
  })
})
