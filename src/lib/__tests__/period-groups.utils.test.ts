import { describe, it, expect } from 'vitest'
import { groupByPeriod, toPeriodTotalsSeries } from '../period-groups.utils'

interface Row {
  id: string
  date: string | Date
  paise: number
}

const rows = (...r: Row[]) => r
const byDay = (items: Row[], now: Date) =>
  groupByPeriod(items, (r) => r.date, (r) => r.paise, 'day', now)
const byMonth = (items: Row[], now: Date) =>
  groupByPeriod(items, (r) => r.date, (r) => r.paise, 'month', now)

describe('groupByPeriod — day', () => {
  const now = new Date(2026, 6, 19, 15, 0, 0) // 19 Jul 2026, local

  it('groups by local calendar day, newest day first', () => {
    const result = byDay(
      rows(
        { id: 'a', date: '2026-07-17T10:00:00', paise: 100 },
        { id: 'b', date: '2026-07-19T09:00:00', paise: 200 },
        { id: 'c', date: '2026-07-17T18:00:00', paise: 300 },
      ),
      now,
    )

    expect(result.map((g) => g.key)).toEqual(['2026-07-19', '2026-07-17'])
    expect(result[0].items.map((r) => r.id)).toEqual(['b'])
    expect(result[1].items.map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('sums each day total in paise', () => {
    const result = byDay(
      rows(
        { id: 'a', date: '2026-07-17T10:00:00', paise: 100 },
        { id: 'c', date: '2026-07-17T18:00:00', paise: 300 },
      ),
      now,
    )
    expect(result[0].totalPaise).toBe(400)
  })

  it('flags today and yesterday', () => {
    const result = byDay(
      rows(
        { id: 'a', date: '2026-07-19T01:00:00', paise: 1 },
        { id: 'b', date: '2026-07-18T01:00:00', paise: 1 },
        { id: 'c', date: '2026-07-10T01:00:00', paise: 1 },
      ),
      now,
    )
    expect(result[0]).toMatchObject({ isCurrent: true, isPrevious: false })
    expect(result[1]).toMatchObject({ isCurrent: false, isPrevious: true })
    expect(result[2]).toMatchObject({ isCurrent: false, isPrevious: false })
    expect(result[2].label).toBe('10 Jul 2026')
  })

  /** toISOString() would shift a 23:30 IST timestamp back a day. */
  it('keys on the local day, not the UTC day', () => {
    const late = new Date(2026, 6, 19, 23, 30, 0)
    const result = byDay(rows({ id: 'a', date: late, paise: 1 }), now)
    expect(result[0].key).toBe('2026-07-19')
    expect(result[0].isCurrent).toBe(true)
  })

  it('skips items with an unparseable date rather than making a NaN group', () => {
    const result = byDay(
      rows(
        { id: 'a', date: 'not-a-date', paise: 100 },
        { id: 'b', date: '2026-07-19T09:00:00', paise: 200 },
      ),
      now,
    )
    expect(result).toHaveLength(1)
    expect(result[0].items.map((r) => r.id)).toEqual(['b'])
  })

  it('returns no groups for no items', () => {
    expect(byDay([], now)).toEqual([])
  })

  it('defaults to day granularity', () => {
    const result = groupByPeriod(
      rows({ id: 'a', date: '2026-07-19T09:00:00', paise: 1 }),
      (r) => r.date,
      (r) => r.paise,
    )
    expect(result[0].granularity).toBe('day')
    expect(result[0].key).toHaveLength(10)
  })
})

describe('groupByPeriod — month', () => {
  const now = new Date(2026, 6, 19, 15, 0, 0) // 19 Jul 2026, local

  it('collapses days into calendar months, newest month first', () => {
    const result = byMonth(
      rows(
        { id: 'a', date: '2026-06-02T10:00:00', paise: 100 },
        { id: 'b', date: '2026-07-19T09:00:00', paise: 200 },
        { id: 'c', date: '2026-06-28T18:00:00', paise: 300 },
      ),
      now,
    )
    expect(result.map((g) => g.key)).toEqual(['2026-07', '2026-06'])
    expect(result[1].totalPaise).toBe(400)
    expect(result[1].items.map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('flags this month and last month, and labels older months absolutely', () => {
    const result = byMonth(
      rows(
        { id: 'a', date: '2026-07-01T10:00:00', paise: 1 },
        { id: 'b', date: '2026-06-30T10:00:00', paise: 1 },
        { id: 'c', date: '2026-05-10T10:00:00', paise: 1 },
      ),
      now,
    )
    expect(result[0]).toMatchObject({ isCurrent: true, isPrevious: false, granularity: 'month' })
    expect(result[1]).toMatchObject({ isCurrent: false, isPrevious: true })
    expect(result[2].label).toBe('May 2026')
  })

  /** 31 Mar minus one month lands on 3 Mar unless the day is anchored first. */
  it('resolves the previous month from a 31-day date', () => {
    const endOfMarch = new Date(2026, 2, 31, 12, 0, 0)
    const result = byMonth(rows({ id: 'a', date: '2026-02-14T10:00:00', paise: 1 }), endOfMarch)
    expect(result[0].isPrevious).toBe(true)
  })

  it('rolls the previous month across a year boundary', () => {
    const jan = new Date(2026, 0, 15, 12, 0, 0)
    const result = byMonth(rows({ id: 'a', date: '2025-12-20T10:00:00', paise: 1 }), jan)
    expect(result[0]).toMatchObject({ key: '2025-12', isPrevious: true })
  })
})

describe('toPeriodTotalsSeries', () => {
  it('reverses newest-first groups into an oldest-first series', () => {
    const now = new Date(2026, 6, 19, 15, 0, 0)
    const result = byDay(
      rows(
        { id: 'a', date: '2026-07-17T10:00:00', paise: 100 },
        { id: 'b', date: '2026-07-18T10:00:00', paise: 200 },
        { id: 'c', date: '2026-07-19T10:00:00', paise: 300 },
      ),
      now,
    )
    expect(toPeriodTotalsSeries(result)).toEqual([100, 200, 300])
  })
})
