/**
 * Aging report row maths.
 *
 * The two decisions worth pinning: "worst" bucket means OLDEST, not largest
 * (₹200 at 90+ days is the collections call, not ₹80,000 still current), and a
 * bucket chip keeps every row holding money in that bucket rather than only
 * rows whose oldest bucket matches — filtering to 31-60 must not hide a party
 * who also has 90+ debt.
 */
import { describe, it, expect } from 'vitest'
import type { AgingRow } from '../finance.types'
import {
  bucketCounts,
  filterAgingRows,
  rowBadgeVariant,
  sumRows,
  worstBucket,
} from '../aging/aging.utils'

function row(partial: Partial<AgingRow> & { partyId: string; partyName: string }): AgingRow {
  const base = { current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0, ...partial }
  return {
    ...base,
    total: base.total || base.current + base.days31to60 + base.days61to90 + base.over90,
  }
}

const RAJU = row({ partyId: 'p1', partyName: 'Raju Traders', current: 80000, over90: 200 })
const PRIYA = row({ partyId: 'p2', partyName: 'Priya Wholesale', current: 50000 })
const AMIT = row({ partyId: 'p3', partyName: 'Amit Distributors', days31to60: 12000, over90: 4000 })
const ZERO = row({ partyId: 'p4', partyName: 'Settled Co' })

describe('worstBucket', () => {
  it('picks the oldest bucket holding money, not the largest', () => {
    expect(worstBucket(RAJU)).toBe('OVER_90')
  })

  it('picks the only bucket when there is one', () => {
    expect(worstBucket(PRIYA)).toBe('CURRENT')
  })

  it('returns null for a row with nothing owing', () => {
    expect(worstBucket(ZERO)).toBeNull()
  })
})

describe('rowBadgeVariant', () => {
  it('reads current money as neutral and 60+ as overdue', () => {
    expect(rowBadgeVariant(PRIYA)).toBe('draft')
    expect(rowBadgeVariant(AMIT)).toBe('overdue')
  })

  it('warns on 31-60 without calling it overdue', () => {
    expect(rowBadgeVariant(row({ partyId: 'x', partyName: 'X', days31to60: 900 }))).toBe('pending')
  })

  it('has no badge for a settled row', () => {
    expect(rowBadgeVariant(ZERO)).toBeNull()
  })
})

describe('filterAgingRows', () => {
  const rows = [RAJU, PRIYA, AMIT, ZERO]

  it('returns everything for ALL with no query', () => {
    expect(filterAgingRows(rows, 'ALL', '')).toHaveLength(4)
  })

  it('keeps every row holding money in the chosen bucket', () => {
    const over90 = filterAgingRows(rows, 'OVER_90', '').map((r) => r.partyId)
    expect(over90).toEqual(['p1', 'p3'])
  })

  it('does not hide a 90+ party when filtering to 31-60', () => {
    const mid = filterAgingRows(rows, 'D31_60', '').map((r) => r.partyId)
    expect(mid).toEqual(['p3']) // Amit has both 31-60 and 90+ money
  })

  it('matches the party name case-insensitively', () => {
    expect(filterAgingRows(rows, 'ALL', 'raju')).toEqual([RAJU])
    expect(filterAgingRows(rows, 'ALL', '  PRIYA ')).toEqual([PRIYA])
  })

  it('combines chip and search', () => {
    expect(filterAgingRows(rows, 'OVER_90', 'priya')).toEqual([])
  })
})

describe('sumRows', () => {
  it('totals only the rows it is given, so the footer matches the list', () => {
    const visible = filterAgingRows([RAJU, PRIYA, AMIT], 'OVER_90', '')
    expect(sumRows(visible).total).toBe(RAJU.total + AMIT.total)
  })

  it('is all zeroes for an empty list', () => {
    expect(sumRows([])).toEqual({
      current: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
      total: 0,
    })
  })
})

describe('bucketCounts', () => {
  it('counts a row once per bucket it holds money in', () => {
    expect(bucketCounts([RAJU, PRIYA, AMIT, ZERO])).toEqual({
      ALL: 4,
      CURRENT: 2,
      D31_60: 1,
      D61_90: 0,
      OVER_90: 2,
    })
  })
})
