/**
 * Date calculation helpers for recurring invoice schedules.
 * dayOfMonth (1-28) used for MONTHLY/QUARTERLY/YEARLY.
 * dayOfWeek (0-6, 0 = Sunday) used for WEEKLY.
 */

/**
 * Calculate the next run date after `current` for a given frequency.
 */
export function calculateNextRunDate(
  current: Date,
  frequency: string,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): Date {
  const next = new Date(current)

  switch (frequency) {
    case 'WEEKLY': {
      const target = dayOfWeek ?? current.getDay()
      // Advance by 7 days from current, then snap to target weekday if different
      next.setDate(next.getDate() + 7)
      const diff = (target - next.getDay() + 7) % 7
      next.setDate(next.getDate() + diff)
      break
    }
    case 'MONTHLY': {
      next.setMonth(next.getMonth() + 1)
      if (dayOfMonth) {
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, lastDay))
      }
      break
    }
    case 'QUARTERLY': {
      next.setMonth(next.getMonth() + 3)
      if (dayOfMonth) {
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, lastDay))
      }
      break
    }
    case 'YEARLY': {
      next.setFullYear(next.getFullYear() + 1)
      if (dayOfMonth) {
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(dayOfMonth, lastDay))
      }
      break
    }
  }

  // Normalize to start-of-day UTC
  next.setUTCHours(0, 0, 0, 0)
  return next
}

/** Compute first nextRunDate from startDate for a new schedule */
export function initialNextRunDate(
  startDate: Date,
  frequency: string,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): Date {
  const d = new Date(startDate)
  d.setUTCHours(0, 0, 0, 0)

  // For MONTHLY+/YEARLY: snap to requested dayOfMonth if provided
  if (dayOfMonth && ['MONTHLY', 'QUARTERLY', 'YEARLY'].includes(frequency)) {
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(dayOfMonth, lastDay))
  }

  // For WEEKLY: snap to requested dayOfWeek if provided
  if (dayOfWeek != null && frequency === 'WEEKLY') {
    const diff = (dayOfWeek - d.getDay() + 7) % 7
    d.setDate(d.getDate() + diff)
    // If that snapped to today or the past, advance one week
    if (d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 7)
    }
  }

  return d
}
