/**
 * Recurring Expense — pure date math.
 * No I/O. Exhaustively tested (see __tests__/unit/recurring-dates.test.ts).
 */

export type ExpenseFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

/**
 * Compute the next run date given a frequency and the previous run date.
 *
 * - DAILY  : +1 day; dayOfMonth/dayOfWeek ignored.
 * - WEEKLY : +7 days; dayOfWeek serves as documentation only (base date
 *            already lands on the correct weekday after first creation).
 * - MONTHLY: +1 month; day clamped to last day of target month so that
 *            Jan-31 → Feb-28/29, Mar-31 → Apr-30, etc.
 * - YEARLY : +1 year; same day-of-month clamp (handles Feb-29 in leap years).
 *
 * All arithmetic is done in UTC to avoid DST shifts.
 */
export function computeNextRunDate(
  frequency: ExpenseFrequency,
  prev: Date,
  dayOfMonth?: number | null,
  _dayOfWeek?: number | null,
): Date {
  switch (frequency) {
    case 'DAILY': {
      const next = new Date(prev)
      next.setUTCDate(next.getUTCDate() + 1)
      return next
    }

    case 'WEEKLY': {
      const next = new Date(prev)
      next.setUTCDate(next.getUTCDate() + 7)
      return next
    }

    case 'MONTHLY': {
      const dom = dayOfMonth ?? prev.getUTCDate()
      const nextMonth = new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth() + 1, 1))
      const lastDayOfNextMonth = lastDayOfMonth(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth())
      const clampedDay = Math.min(dom, lastDayOfNextMonth)
      return new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), clampedDay))
    }

    case 'YEARLY': {
      const dom = dayOfMonth ?? prev.getUTCDate()
      const targetYear = prev.getUTCFullYear() + 1
      const targetMonth = prev.getUTCMonth()
      const lastDay = lastDayOfMonth(targetYear, targetMonth)
      const clampedDay = Math.min(dom, lastDay)
      return new Date(Date.UTC(targetYear, targetMonth, clampedDay))
    }
  }
}

/** Returns last calendar day (1-based) of a given year/month (0-based month). */
function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of next month = last day of current month
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/**
 * Return midnight UTC for today in IST (UTC+5:30).
 * Used by the worker to avoid timezone drift between cron fire time and date math.
 */
export function todayIST(): Date {
  const now = new Date()
  // IST offset = +330 minutes
  const istMs = now.getTime() + 330 * 60 * 1000
  const ist = new Date(istMs)
  // Floor to start of day in IST, then convert back to UTC
  const startOfDayIST = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()),
  )
  // Subtract IST offset to get the equivalent UTC midnight
  return new Date(startOfDayIST.getTime() - 330 * 60 * 1000)
}
