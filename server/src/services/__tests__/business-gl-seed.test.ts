/**
 * createBusiness — seeds the default chart of accounts.
 *
 * Regression guard: a business created without ledger accounts cannot save its
 * first invoice (GL auto-posting can't resolve system accounts 1200/1300/4000/
 * 5050). createBusiness must call seedDefaultAccounts for the new business.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '../../lib/prisma.js'
import { createBusiness } from '../business.service.js'
import { seedDefaultAccounts } from '../accounting/chart-of-accounts.js'
import { ensureSystemRoles } from '../settings.service.js'
import { applyVerticalDefaults } from '../verticals/defaults.js'

vi.mock('../accounting/chart-of-accounts.js', () => ({
  seedDefaultAccounts: vi.fn().mockResolvedValue({ seeded: true, accounts: 19 }),
}))
vi.mock('../settings.service.js', () => ({ ensureSystemRoles: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../verticals/defaults.js', () => ({ applyVerticalDefaults: vi.fn().mockResolvedValue(undefined) }))

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>

const NEW_BIZ_ID = 'biz-new-1'

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.businessUser.count.mockResolvedValue(0)
  mockPrisma.business.create.mockResolvedValue({ id: NEW_BIZ_ID, name: 'Acme', businessType: 'general' })
  mockPrisma.businessUser.create.mockResolvedValue({})
  mockPrisma.category.createMany.mockResolvedValue({ count: 0 })
})

describe('createBusiness — GL seeding', () => {
  it('seeds the default chart of accounts for the new business', async () => {
    await createBusiness('user-1', { name: 'Acme' } as never)
    expect(seedDefaultAccounts).toHaveBeenCalledWith(NEW_BIZ_ID)
  })

  it('also seeds roles and vertical defaults', async () => {
    await createBusiness('user-1', { name: 'Acme' } as never)
    expect(ensureSystemRoles).toHaveBeenCalledWith(NEW_BIZ_ID)
    expect(applyVerticalDefaults).toHaveBeenCalledWith(NEW_BIZ_ID, 'general')
  })
})
