import { describe, it, expect, vi } from 'vitest'
import { findExactDuplicates } from '../exact-dedup.js'
import type { NormalizedPartyRow } from '../../../../types/import.types.js'

type Row = NormalizedPartyRow & { sourceIndex: number }

function row(partial: Partial<Row> & { sourceIndex: number }): Row {
  return {
    name: 'X',
    issues: [],
    ...partial,
  }
}

interface ExistingParty {
  id: string
  name: string
  phone: string | null
  gstin: string | null
}

function mockPrisma(existing: ExistingParty[], spy?: (args: unknown) => void) {
  return {
    party: {
      findMany: vi.fn(async (args: { where: { businessId: string } }) => {
        spy?.(args)
        return existing.filter((p) => true && args && p) // pass-through; filtering done below
      }),
    },
  }
}

describe('findExactDuplicates', () => {
  it('returns empty map for empty rows', async () => {
    const prisma = mockPrisma([])
    const result = await findExactDuplicates({
      businessId: 'biz-1',
      rows: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.size).toBe(0)
    expect(prisma.party.findMany).not.toHaveBeenCalled()
  })

  it('matches by phone (primary)', async () => {
    const prisma = {
      party: {
        findMany: vi.fn(async () => [
          { id: 'p1', name: 'Existing Raju', phone: '9111111111', gstin: null },
        ]),
      },
    }
    const rows: Row[] = [
      row({ sourceIndex: 0, name: 'Raju', phone: '9111111111' }),
      row({ sourceIndex: 1, name: 'Priya', phone: '9222222222' }),
    ]
    const result = await findExactDuplicates({
      businessId: 'biz-1',
      rows,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.get(0)).toMatchObject({
      partyId: 'p1',
      matchedField: 'phone',
    })
    expect(result.has(1)).toBe(false)
  })

  it('matches by gstin when phone absent', async () => {
    const prisma = {
      party: {
        findMany: vi.fn(async () => [
          { id: 'p2', name: 'GstinOnly', phone: null, gstin: '27AAPFU0939F1ZV' },
        ]),
      },
    }
    const rows: Row[] = [row({ sourceIndex: 5, gstin: '27AAPFU0939F1ZV' })]
    const result = await findExactDuplicates({
      businessId: 'biz-1',
      rows,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.get(5)?.matchedField).toBe('gstin')
  })

  it('phone match beats gstin match when both exist', async () => {
    const prisma = {
      party: {
        findMany: vi.fn(async () => [
          { id: 'pPhone', name: 'A', phone: '9111111111', gstin: null },
          { id: 'pGstin', name: 'B', phone: null, gstin: '27AAPFU0939F1ZV' },
        ]),
      },
    }
    const result = await findExactDuplicates({
      businessId: 'biz-1',
      rows: [
        row({
          sourceIndex: 0,
          phone: '9111111111',
          gstin: '27AAPFU0939F1ZV',
        }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.get(0)?.partyId).toBe('pPhone')
  })

  it('always scopes the Prisma query by businessId', async () => {
    let captured: { where: { businessId: string } } | undefined
    const prisma = {
      party: {
        findMany: vi.fn(async (args: { where: { businessId: string } }) => {
          captured = args
          return []
        }),
      },
    }
    await findExactDuplicates({
      businessId: 'biz-tenant',
      rows: [row({ sourceIndex: 0, phone: '9111111111' })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(captured?.where.businessId).toBe('biz-tenant')
  })

  it('skips Prisma entirely when no phone or gstin in any row', async () => {
    const prisma = {
      party: { findMany: vi.fn(async () => []) },
    }
    await findExactDuplicates({
      businessId: 'biz-1',
      rows: [row({ sourceIndex: 0, name: 'No phone, no gstin' })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(prisma.party.findMany).not.toHaveBeenCalled()
  })
})
