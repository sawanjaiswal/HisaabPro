/**
 * Period utilities for GST return builders.
 * period format: 'YYYY-MM'
 */

/** Returns [start, end) Date tuple for a YYYY-MM period (Asia/Kolkata, treated as UTC start-of-day) */
export function parsePeriod(period: string): [Date, Date] {
  const [y, m] = period.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))        // first day of month 00:00 UTC
  const end   = new Date(Date.UTC(y, m, 1))             // first day of NEXT month (exclusive)
  return [start, end]
}

/** Converts 'YYYY-MM' → 'MMYYYY' as required by NIC GSTR-1 envelope */
export function toNicFp(period: string): string {
  const [y, m] = period.split('-')
  return `${m}${y}`
}
