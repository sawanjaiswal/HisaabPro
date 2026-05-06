/**
 * Date math for recurring invoice schedules — all arithmetic in UTC.
 *
 * Anchor-day snapping rules (§7 of ARCHITECTURE.md):
 *  - Schema caps dayOfMonth ≤ 28, so Feb always has the day available.
 *  - For MONTHLY/QUARTERLY/YEARLY, after advancing the month we snap to
 *    min(anchorDay, lastDayOfMonth) using UTC helpers to avoid JS Date
 *    local-timezone skew bugs.
 *  - Month-end safety: Jan 31 + 1mo → Feb 28/29 (snapped), but the
 *    anchorDay (31) is preserved in the schedule row so the NEXT iteration
 *    uses 31 again (e.g. Feb→Mar 31, not Feb→Mar 28).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

// ---------------------------------------------------------------------------
// Private UTC helpers
// ---------------------------------------------------------------------------

/** Last day of the UTC month for (year, 0-based month). */
function lastDayOfUTCMonth(year: number, month: number): number {
  // Day 0 of next month = last day of this month
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/**
 * Build a UTC midnight Date for (year, 0-based month, day).
 * Day is clamped to lastDayOfMonth to handle month-end safely.
 */
function utcDate(year: number, month: number, day: number): Date {
  const last = lastDayOfUTCMonth(year, month)
  return new Date(Date.UTC(year, month, Math.min(day, last)))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the next run date after `currentDate` for a given frequency.
 *
 * @param currentDate  - The date from which to advance (typically schedule.nextRunDate).
 * @param frequency    - DAILY | WEEKLY | MONTHLY | QUARTERLY | YEARLY.
 * @param anchorDay    - dayOfMonth (1-28) or dayOfWeek (0-6) depending on frequency.
 * @param intervalCount - Number of intervals to advance (always 1 in Phase 1).
 *
 * All output is normalised to UTC midnight.
 */
export function computeNextRunDate(
  currentDate: Date,
  frequency: string,
  anchorDay?: number | null,
  intervalCount = 1,
): Date {
  const y = currentDate.getUTCFullYear()
  const m = currentDate.getUTCMonth()
  const d = currentDate.getUTCDate()

  switch (frequency as RecurringFrequency) {
    case 'DAILY': {
      return new Date(Date.UTC(y, m, d + intervalCount))
    }

    case 'WEEKLY': {
      // Advance by 7 * intervalCount days; no weekday snap needed (anchorDay is the
      // target weekday, but WEEKLY schedules advance by exact 7-day periods).
      const target = anchorDay ?? currentDate.getUTCDay()
      const base = new Date(Date.UTC(y, m, d + 7 * intervalCount))
      const diff = ((target - base.getUTCDay()) + 7) % 7
      return new Date(Date.UTC(
        base.getUTCFullYear(),
        base.getUTCMonth(),
        base.getUTCDate() + diff,
      ))
    }

    case 'MONTHLY': {
      const newMonth = m + intervalCount
      const snap = anchorDay ?? d
      return utcDate(y + Math.floor(newMonth / 12), newMonth % 12, snap)
    }

    case 'QUARTERLY': {
      const newMonth = m + 3 * intervalCount
      const snap = anchorDay ?? d
      return utcDate(y + Math.floor(newMonth / 12), newMonth % 12, snap)
    }

    case 'YEARLY': {
      const newYear = y + intervalCount
      const snap = anchorDay ?? d
      return utcDate(newYear, m, snap)
    }

    default:
      throw new Error(`Unsupported frequency: ${frequency}`)
  }
}

/**
 * Compute the first nextRunDate for a brand-new schedule.
 * Snaps the startDate to the requested anchorDay then returns startDate itself
 * (no advancement — the first run fires on the start date).
 */
export function computeInitialRunDate(
  startDate: Date,
  frequency: string,
  anchorDay?: number | null,
): Date {
  const y = startDate.getUTCFullYear()
  const m = startDate.getUTCMonth()
  const d = startDate.getUTCDate()

  if (anchorDay == null) return new Date(Date.UTC(y, m, d))

  if (['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(frequency)) {
    return utcDate(y, m, anchorDay)
  }

  if (frequency === 'WEEKLY') {
    const base = new Date(Date.UTC(y, m, d))
    const diff = ((anchorDay - base.getUTCDay()) + 7) % 7
    const snapped = new Date(Date.UTC(y, m, d + diff))
    // If snapped is in the past (or today == startDate), advance one week
    if (snapped <= base) {
      return new Date(Date.UTC(snapped.getUTCFullYear(), snapped.getUTCMonth(), snapped.getUTCDate() + 7))
    }
    return snapped
  }

  // DAILY: no anchor snap needed
  return new Date(Date.UTC(y, m, d))
}

/**
 * Returns true when a schedule's nextRunDate has arrived.
 * Uses `<= now` — IST midnight is stored as UTC 18:30 of the prior day;
 * the 15-min cron tick after that point will see it as due.
 */
export function isDueNow(nextRunDate: Date, now: Date = new Date()): boolean {
  return nextRunDate <= now
}

/**
 * Parse an IST date string like '2026-05-07' to the UTC instant that
 * represents midnight IST (+05:30) = 2026-05-06T18:30:00.000Z.
 */
export function parseIstDate(dateStr: string): Date {
  // IST = UTC+05:30; midnight IST = previous day 18:30 UTC
  const [year, month, day] = dateStr.split('-').map(Number)
  // month is 1-based in input, 0-based in Date.UTC
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000)
}
