/** Aging report — pure row maths. No React, no fetch: all of it is testable. */

import type { AgingRow } from '../finance.types'
import {
  AGING_BUCKETS,
  BUCKET_BADGE,
  BUCKET_FIELD,
  type AgingBucket,
  type RealAgingBucket,
} from './aging.types'

/**
 * The oldest bucket carrying money — that is what the row's status pill and
 * sub-line report. "Oldest", not "largest": ₹200 sitting 90+ days out is the
 * number a collections call is about, even when ₹80,000 is still current.
 * Returns null for a row with nothing owing (the API can emit a zero row).
 */
export function worstBucket(row: AgingRow): RealAgingBucket | null {
  for (let i = AGING_BUCKETS.length - 1; i >= 0; i--) {
    const bucket = AGING_BUCKETS[i]!
    if (row[BUCKET_FIELD[bucket]] > 0) return bucket
  }
  return null
}

/** Paise held in one bucket. */
export function bucketAmount(row: AgingRow, bucket: RealAgingBucket): number {
  return row[BUCKET_FIELD[bucket]]
}

/** Badge variant for a row, or null when nothing is owing. */
export function rowBadgeVariant(row: AgingRow) {
  const bucket = worstBucket(row)
  return bucket ? BUCKET_BADGE[bucket] : null
}

/**
 * Chip + search filter.
 *
 * A bucket chip keeps rows that hold money in THAT bucket (not rows whose
 * worst bucket is that one) — picking "31-60" to chase that slice should not
 * hide a party who also has 90+ debt, they are the first party to call.
 * Search matches the party name, case- and space-insensitively.
 */
export function filterAgingRows(
  rows: AgingRow[],
  bucket: AgingBucket,
  query: string,
): AgingRow[] {
  const needle = query.trim().toLowerCase()
  return rows.filter((row) => {
    if (bucket !== 'ALL' && bucketAmount(row, bucket) <= 0) return false
    if (needle && !row.partyName.toLowerCase().includes(needle)) return false
    return true
  })
}

/**
 * Column totals for whatever subset is on screen. The API's own `totals` cover
 * the full report; once a chip or search narrows the list, showing those would
 * be a footer that does not add up to the rows above it.
 */
export function sumRows(rows: AgingRow[]): Omit<AgingRow, 'partyId' | 'partyName'> {
  return rows.reduce(
    (acc, row) => ({
      current: acc.current + row.current,
      days31to60: acc.days31to60 + row.days31to60,
      days61to90: acc.days61to90 + row.days61to90,
      over90: acc.over90 + row.over90,
      total: acc.total + row.total,
    }),
    { current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 },
  )
}

/** How many rows hold money in each bucket — the chip counts. */
export function bucketCounts(rows: AgingRow[]): Record<AgingBucket, number> {
  const counts = { ALL: rows.length, CURRENT: 0, D31_60: 0, D61_90: 0, OVER_90: 0 }
  for (const row of rows) {
    for (const bucket of AGING_BUCKETS) {
      if (bucketAmount(row, bucket) > 0) counts[bucket] += 1
    }
  }
  return counts
}
