/** Cash Register — Utility functions */

import type { CashEntryDTO, DayBucket, CashHistoryFilter, CashHistorySort } from './cashRegister.types'

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Converts paise to Indian Rupee format: ₹1,23,456.78
 * Handles Indian number system (lakh, crore).
 */
export function formatPaise(paise: number): string {
  const rupees = paise / 100
  const isNegative = rupees < 0
  const abs = Math.abs(rupees)

  // Format the integer part with Indian grouping (2-2-3 from right)
  const [intPart, decPart] = abs.toFixed(2).split('.')
  const formatted = formatIndianNumber(intPart)

  const result = `₹${formatted}.${decPart}`
  return isNegative ? `-${result}` : result
}

function formatIndianNumber(s: string): string {
  if (s.length <= 3) return s
  // Last 3 digits are hundreds
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3)
  // Remaining digits grouped by 2
  const groups: string[] = []
  let r = rest
  while (r.length > 0) {
    groups.unshift(r.slice(-2))
    r = r.slice(0, -2)
  }
  return groups.join(',') + ',' + last3
}

/**
 * Compact format for tight spaces: ₹1.2L, ₹5.3Cr
 */
export function formatPaiseCompact(paise: number): string {
  const rupees = Math.abs(paise / 100)
  if (rupees >= 10_000_000) {
    return `₹${(rupees / 10_000_000).toFixed(1)}Cr`
  }
  if (rupees >= 100_000) {
    return `₹${(rupees / 100_000).toFixed(1)}L`
  }
  if (rupees >= 1_000) {
    return `₹${(rupees / 1_000).toFixed(1)}K`
  }
  return formatPaise(paise)
}

// ─── Bucketing ────────────────────────────────────────────────────────────────

/**
 * Groups entries by local date (YYYY-MM-DD from createdAt ISO string).
 * Computes per-bucket totals.
 */
export function buildDayBuckets(entries: CashEntryDTO[]): DayBucket[] {
  const bucketMap = new Map<string, DayBucket>()

  for (const entry of entries) {
    const date = entry.createdAt.slice(0, 10) // YYYY-MM-DD from ISO
    let bucket = bucketMap.get(date)
    if (!bucket) {
      bucket = { date, entries: [], inPaise: 0, outPaise: 0, netPaise: 0 }
      bucketMap.set(date, bucket)
    }
    bucket.entries.push(entry)
    if (entry.direction === 'IN') {
      bucket.inPaise += entry.amountPaise
      bucket.netPaise += entry.amountPaise
    } else {
      bucket.outPaise += entry.amountPaise
      bucket.netPaise -= entry.amountPaise
    }
  }

  return Array.from(bucketMap.values())
}

/**
 * Applies filter + sort, then builds day buckets.
 */
export function applyHistoryView(
  entries: CashEntryDTO[],
  filter: CashHistoryFilter,
  sort: CashHistorySort,
): DayBucket[] {
  let filtered = entries.filter((e) => {
    if (!filter.includeVoided && e.voidedAt !== null) return false
    if (filter.direction && e.direction !== filter.direction) return false
    return true
  })

  filtered = [...filtered].sort((a, b) => {
    switch (sort.by) {
      case 'newest':  return b.createdAt.localeCompare(a.createdAt)
      case 'oldest':  return a.createdAt.localeCompare(b.createdAt)
      case 'highest': return b.amountPaise - a.amountPaise
      case 'lowest':  return a.amountPaise - b.amountPaise
    }
  })

  return buildDayBuckets(filtered)
}

// ─── Timezone ─────────────────────────────────────────────────────────────────

/**
 * Returns device UTC offset in minutes (positive = ahead of UTC).
 * e.g. IST = +330 (UTC+5:30)
 */
export function getTzOffsetMinutes(): number {
  // getTimezoneOffset() returns minutes BEHIND UTC for most timezones
  // e.g. IST returns -330; we negate for the API convention (+330)
  return -new Date().getTimezoneOffset()
}
