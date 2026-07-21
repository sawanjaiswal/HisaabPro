/**
 * Reminder triggers — pure date-window and dedup helpers.
 *
 * Split out of `reminder-trigger.service.ts`, where the same day-window and
 * dedupe-by-party blocks were repeated across every trigger. Centralising them
 * means a fix to the window semantics lands once instead of seven times.
 *
 * No Prisma, no I/O — pure functions over dates and plain rows.
 */

export interface Candidate {
  partyId: string
  fireDate: Date
}

/** One UTC day in milliseconds. */
export const DAY_MS = 86_400_000

/** Normalise a date to UTC midnight (for idempotency-key comparison). */
export function normaliseToUtcMidnight(d: Date): Date {
  const out = new Date(d)
  out.setUTCHours(0, 0, 0, 0)
  return out
}

/**
 * Half-open UTC day window `[start, end)` containing `date`.
 *
 * Half-open, not inclusive-end: an inclusive end would double-match a row
 * landing exactly on midnight against both the current and the next day.
 */
export function dayWindow(date: Date): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  return { startOfDay, endOfDay: new Date(startOfDay.getTime() + DAY_MS) }
}

/** `now` shifted by `offsetDays` (negative shifts into the past). */
export function shiftDays(now: Date, offsetDays: number): Date {
  return new Date(now.getTime() + offsetDays * DAY_MS)
}

/**
 * Collapse rows to one Candidate per party, preserving first-seen order.
 *
 * A party with three invoices due the same day should get one reminder, not
 * three. Rows with a null `partyId` are dropped — the dispatcher always needs
 * a recipient.
 */
export function dedupeByParty(
  rows: { partyId: string | null }[],
  fireDate: Date,
): Candidate[] {
  const seen = new Set<string>()
  const results: Candidate[] = []
  for (const row of rows) {
    if (!row.partyId || seen.has(row.partyId)) continue
    seen.add(row.partyId)
    results.push({ partyId: row.partyId, fireDate: normaliseToUtcMidnight(fireDate) })
  }
  return results
}

/** Shared `where` fragment: parties eligible to receive marketing reminders. */
export const CONTACTABLE_PARTY = {
  isDeleted: false,
  isActive: true,
  marketingOptOut: false,
  phone: { not: null },
} as const
