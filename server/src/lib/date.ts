/**
 * IST date utilities — direct copy from HisaabPro
 * Server runs in UTC; these helpers convert to IST for business logic
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

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
