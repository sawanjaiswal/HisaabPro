import { describe, it, expect } from 'vitest'
import { groupByDay, toDailyTotalsSeries } from '../day-groups.utils'

interface Row {
  id: string
  date: string
  paise: number
}

const rows = (...r: Row[]) => r
const group = (items: Row[], now: Date) =>
  groupByDay(items, (r) => r.date, (r) => r.paise, now)

describe('groupByDay', () => {
  const now = new Date(2026, 6, 19, 15, 0, 0) // 19 Jul 2026, local

  it('groups by local calendar day, newest day first', () => {
    const result = group(
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
    const result = group(
      rows(
        { id: 'a', date: '2026-07-17T10:00:00', paise: 100 },
        { id: 'c', date: '2026-07-17T18:00:00', paise: 300 },
      ),
      now,
    )
    expect(result[0].totalPaise).toBe(400)
  })

  it('flags today and yesterday', () => {
    const result = group(
      rows(
        { id: 'a', date: '2026-07-19T01:00:00', paise: 1 },
        { id: 'b', date: '2026-07-18T01:00:00', paise: 1 },
        { id: 'c', date: '2026-07-10T01:00:00', paise: 1 },
      ),
      now,
    )
    expect(result[0]).toMatchObject({ isToday: true, isYesterday: false })
    expect(result[1]).toMatchObject({ isToday: false, isYesterday: true })
    expect(result[2]).toMatchObject({ isToday: false, isYesterday: false })
    expect(result[2].label).toBe('10 Jul 2026')
  })

  /** toISOString() would shift a 23:30 IST timestamp back a day. */
  it('keys on the local day, not the UTC day', () => {
    const late = new Date(2026, 6, 19, 23, 30, 0)
    const result = groupByDay([{ id: 'a', date: late, paise: 1 }], (r) => r.date, (r) => r.paise, now)
    expect(result[0].key).toBe('2026-07-19')
    expect(result[0].isToday).toBe(true)
  })

  it('skips items with an unparseable date rather than making a NaN group', () => {
    const result = group(
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
    expect(group([], now)).toEqual([])
  })
})

describe('toDailyTotalsSeries', () => {
  it('reverses newest-first groups into an oldest-first series', () => {
    const now = new Date(2026, 6, 19, 15, 0, 0)
    const result = group(
      rows(
        { id: 'a', date: '2026-07-17T10:00:00', paise: 100 },
        { id: 'b', date: '2026-07-18T10:00:00', paise: 200 },
        { id: 'c', date: '2026-07-19T10:00:00', paise: 300 },
      ),
      now,
    )
    expect(toDailyTotalsSeries(result)).toEqual([100, 200, 300])
  })
})
