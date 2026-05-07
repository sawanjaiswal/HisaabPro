/**
 * Notification Engine — Quiet Hours Service (PR6)
 *
 * Pure function — no Prisma, no side effects.
 *
 * computeScheduledAt(now, prefs) → Date
 *   - If `now` (IST) falls within [quietHoursStart, quietHoursEnd),
 *     returns the next occurrence of quietHoursEnd as a UTC Date.
 *   - Otherwise returns `now` unchanged.
 *
 * Default quiet window: 22:00 – 07:00 IST (wraps midnight).
 * IN_APP channel is exempt — callers must skip for IN_APP.
 *
 * Times are always interpreted in Asia/Kolkata.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuietHoursPrefs {
  /** HH:MM 24-hour string in IST, e.g. "22:00". Default: "22:00". */
  quietHoursStart?: string | null
  /** HH:MM 24-hour string in IST, e.g. "07:00". Default: "07:00". */
  quietHoursEnd?: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_START = '22:00'
const DEFAULT_END = '07:00'
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000 // +05:30

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "HH:MM" → { hours, minutes } */
function parseHHMM(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { hours: h ?? 0, minutes: m ?? 0 }
}

/** Return total minutes from midnight for a HH:MM string. */
function toMinutes(hhmm: string): number {
  const { hours, minutes } = parseHHMM(hhmm)
  return hours * 60 + minutes
}

/** Convert a UTC Date to IST total minutes since midnight. */
function utcToISTMinutes(date: Date): number {
  const istMs = date.getTime() + IST_OFFSET_MS
  const istDate = new Date(istMs)
  return istDate.getUTCHours() * 60 + istDate.getUTCMinutes()
}

/**
 * Build a UTC Date representing the next occurrence of `hhmm` IST
 * at or after `reference`.
 */
function nextISTOccurrence(reference: Date, hhmm: string): Date {
  const { hours, minutes } = parseHHMM(hhmm)

  // Work in IST: find IST midnight for reference date
  const refISTMs = reference.getTime() + IST_OFFSET_MS
  const refIST = new Date(refISTMs)

  // IST midnight (UTC)
  const istMidnightUTC = new Date(
    Date.UTC(
      refIST.getUTCFullYear(),
      refIST.getUTCMonth(),
      refIST.getUTCDate(),
      0, 0, 0, 0,
    ) - IST_OFFSET_MS,
  )

  // Target: istMidnightUTC + hhmm offset (still in UTC)
  const candidate = new Date(
    istMidnightUTC.getTime() + (hours * 60 + minutes) * 60 * 1000,
  )

  // If candidate is already in the past, add one day
  if (candidate.getTime() <= reference.getTime()) {
    return new Date(candidate.getTime() + 24 * 60 * 60 * 1000)
  }

  return candidate
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the scheduled send time for a notification.
 *
 * @param now   Current time (UTC Date). Default: new Date()
 * @param prefs User quiet-hour preferences (may have nulls → use defaults)
 * @returns     UTC Date: either `now` or the next quiet-hours-end time.
 */
export function computeScheduledAt(
  now: Date = new Date(),
  prefs: QuietHoursPrefs = {},
): Date {
  const startStr = prefs.quietHoursStart ?? DEFAULT_START
  const endStr = prefs.quietHoursEnd ?? DEFAULT_END

  const nowMinutes = utcToISTMinutes(now)
  const startMinutes = toMinutes(startStr)
  const endMinutes = toMinutes(endStr)

  let inQuietHours: boolean

  if (startMinutes < endMinutes) {
    // Non-wrapping window (e.g. 01:00–06:00)
    inQuietHours = nowMinutes >= startMinutes && nowMinutes < endMinutes
  } else {
    // Wrapping window (e.g. 22:00–07:00 — crosses midnight)
    inQuietHours = nowMinutes >= startMinutes || nowMinutes < endMinutes
  }

  if (!inQuietHours) return now

  return nextISTOccurrence(now, endStr)
}
