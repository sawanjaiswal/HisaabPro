import { describe, it, expect, vi } from 'vitest'
import {
  findNearDuplicates,
  levenshtein,
  nameSimilarity,
} from '../near-dedup.js'
import type { NormalizedPartyRow } from '../../../../types/import.types.js'

type Row = NormalizedPartyRow & { sourceIndex: number }

function row(partial: Partial<Row> & { sourceIndex: number }): Row {
  return { name: 'X', issues: [], ...partial }
}

describe('levenshtein', () => {
  it('zero for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0)
  })
  it('handles empty strings', () => {
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('abc', '')).toBe(3)
  })
  it('counts single substitution', () => {
    expect(levenshtein('kitten', 'sitten')).toBe(1)
  })
  it('classic kitten↔sitting = 3', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
  })
})

describe('nameSimilarity', () => {
  it('is 1.0 for identical (case/space insensitive)', () => {
    expect(nameSimilarity('Raju Traders', 'raju traders')).toBe(1)
  })
  it('crosses 0.85 for one-char drift', () => {
    expect(nameSimilarity('Raju Traders', 'Raju Trader')).toBeGreaterThanOrEqual(
      0.85,
    )
  })
  it('falls well below 0.85 for unrelated names', () => {
    expect(nameSimilarity('Raju Traders', 'Priya Shop')).toBeLessThan(0.5)
  })
})

describe('findNearDuplicates', () => {
  it('returns empty map when no rows have phones', async () => {
    const prisma = { party: { findMany: vi.fn(async () => []) } }
    const result = await findNearDuplicates({
      businessId: 'biz-1',
      rows: [row({ sourceIndex: 0, name: 'Raju' })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.size).toBe(0)
    expect(prisma.party.findMany).not.toHaveBeenCalled()
  })

  it('finds candidates by phone-suffix bucket and scores names', async () => {
    const prisma = {
      party: {
        findMany: vi.fn(async () => [
          { id: 'p1', name: 'Raju Trader', phone: '+919111111111' },
          { id: 'p2', name: 'Completely Different', phone: '+919999991111' },
        ]),
      },
    }
    const result = await findNearDuplicates({
      businessId: 'biz-1',
      rows: [row({ sourceIndex: 0, name: 'Raju Traders', phoneE164: '+919111111111' })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.get(0)?.[0]?.partyId).toBe('p1')
    expect(result.get(0)?.length).toBe(1) // p2 below threshold
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
    await findNearDuplicates({
      businessId: 'tenant-x',
      rows: [row({ sourceIndex: 0, name: 'Raju', phoneE164: '+919111111111' })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(captured?.where.businessId).toBe('tenant-x')
  })

  it('respects maxBuckets cap', async () => {
    const prisma = { party: { findMany: vi.fn(async () => []) } }
    const rows: Row[] = []
    // 10 unique phone suffixes
    for (let i = 0; i < 10; i += 1) {
      rows.push(
        row({
          sourceIndex: i,
          name: `P${i}`,
          phoneE164: `+91900000${String(i).padStart(4, '0')}`,
        }),
      )
    }
    await findNearDuplicates({
      businessId: 'biz-1',
      rows,
      maxBuckets: 3,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(prisma.party.findMany).toHaveBeenCalledTimes(3)
  })

  it('does not return matches below threshold', async () => {
    const prisma = {
      party: {
        findMany: vi.fn(async () => [
          { id: 'p1', name: 'Totally Unrelated', phone: '+919111111111' },
        ]),
      },
    }
    const result = await findNearDuplicates({
      businessId: 'biz-1',
      rows: [row({ sourceIndex: 0, name: 'Raju', phoneE164: '+919111111111' })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    expect(result.size).toBe(0)
  })

  it('returns top-5 matches sorted by score desc', async () => {
    const prisma = {
      party: {
        findMany: vi.fn(async () => [
          { id: 'a', name: 'Raju Traders', phone: '+919111111111' },
          { id: 'b', name: 'Raju Trader', phone: '+919222221111' },
          { id: 'c', name: 'Raju Tradrs', phone: '+919333331111' },
        ]),
      },
    }
    const result = await findNearDuplicates({
      businessId: 'biz-1',
      rows: [row({ sourceIndex: 0, name: 'Raju Traders', phoneE164: '+919111111111' })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
    })
    const matches = result.get(0)!
    expect(matches[0]!.partyId).toBe('a') // identical → score 1.0
    expect(matches[0]!.score).toBeGreaterThanOrEqual(matches[1]!.score)
  })
})
