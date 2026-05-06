/**
 * IST date utilities — direct copy from HisaabPro
 * Server runs in UTC; these helpers convert to IST for business logic
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/**
 * Returns a Date representing IST midnight expressed in UTC.
 *
 * India has no DST (always UTC+5:30), so midnight IST = 18:30 UTC of the
 * PREVIOUS calendar day. This is the single source of truth for "today"
 * used by expiry-policy, FEFO queries, and the batch-expiry cron (R2).
 *
 * Algorithm (no external deps):
 *   1. Shift d forward by IST offset → get IST wall-clock time.
 *   2. Truncate to midnight in that shifted Date.
 *   3. Shift back by the IST offset → midnight IST in UTC terms.
 *
 * @param d  Wall-clock now (defaults to new Date()). Inject in tests.
 */
export function istMidnightUtc(d: Date = new Date()): Date {
  // Step 1: IST wall-clock
  const istWall = new Date(d.getTime() + IST_OFFSET_MS)
  // Step 2: Truncate to midnight in IST-wall representation
  istWall.setUTCHours(0, 0, 0, 0)
  // Step 3: Convert midnight-IST back to UTC
  return new Date(istWall.getTime() - IST_OFFSET_MS)
}

/** Today's date as YYYY-MM-DD in IST */
export function getTodayIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().split('T')[0]
}

/** Current timestamp as ISO string in IST */
export function getNowIST(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().replace('Z', '+05:30')
}

/** Convert any Date to YYYY-MM-DD in IST */
export function toISTDateString(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().split('T')[0]
}
