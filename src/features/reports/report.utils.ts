/** Reports — Pure utility functions
 *
 * All functions here are pure: same input → same output, no side effects,
 * no hooks, no state. Easy to unit-test.
 *
 * Currency: always accepts paise (integer), displays via Intl.NumberFormat.
 */

import type { DateRangePreset } from './report.types'

// ─── Formatter instances ──────────────────────────────────────────────────────

/** Reuse a single formatter instance across the module (allocation cost) */
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })

// ─── Currency ─────────────────────────────────────────────────────────────────

/**
 * Convert paise to a formatted INR string.
 *
 * @example formatAmount(150000) → "₹1,500.00"
 * @example formatAmount(0)      → "₹0.00"
 */
export function formatAmount(paise: number): string {
  return INR.format(paise / 100)
}

// ─── Date formatting ──────────────────────────────────────────────────────────

/**
 * Format an ISO date string as DD/MM/YYYY for use in report tables.
 *
 * @example formatReportDate("2026-03-15") → "15/03/2026"
 */
export function formatReportDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}

/**
 * Short date display: "14 Mar" — used in compact list rows and group headers.
 *
 * @example formatDateShort("2026-03-14") → "14 Mar"
 */
export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
  })
}

/**
 * Long day label used as the Day Book page heading.
 *
 * @example formatDayLabel("2026-03-15") → "Sunday, 15 March 2026"
 */
export function formatDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  })
}

// ─── Date range computation ───────────────────────────────────────────────────

/** Serialize a Date to an ISO date string: "YYYY-MM-DD" */
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Return the { from, to } ISO date boundaries for a given preset.
 *
 * The `custom` preset returns today → today so the caller can override
 * the returned values with a date picker.
 *
 * The `this_fy` preset uses the Indian financial year (April 1 – March 31).
 *
 * Exhaustive switch — TypeScript will error if a new preset is added without
 * handling it here.
 */
export function getDateRange(preset: DateRangePreset): { from: string; to: string } {
  const today = new Date()

  switch (preset) {
    case 'today':
      return { from: toISO(today), to: toISO(today) }

    case 'this_week': {
      const day = today.getDay() // 0 = Sunday
      const monday = new Date(today)
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
      return { from: toISO(monday), to: toISO(today) }
    }

    case 'this_month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toISO(first), to: toISO(today) }
    }

    case 'last_month': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const last  = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toISO(first), to: toISO(last) }
    }

    case 'this_fy': {
      // Indian FY: April 1 of current year if month >= April, else previous year
      const fyYear  = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
      const fyStart = new Date(fyYear, 3, 1) // month 3 = April
      return { from: toISO(fyStart), to: toISO(today) }
    }

    case 'custom':
      // Return today → today; caller renders a date picker to override
      return { from: toISO(today), to: toISO(today) }

    default: {
      // Exhaustive check: TypeScript errors here if a new DateRangePreset is added
      const _exhaustive: never = preset
      return _exhaustive
    }
  }
}

// ─── Day Book navigation helpers ─────────────────────────────────────────────

/**
 * Return today's date as an ISO string.
 *
 * @example getTodayISO() → "2026-03-15"
 */
export function getTodayISO(): string {
  return toISO(new Date())
}

/**
 * Return the ISO date of the day before the given date.
 *
 * @example getPrevDate("2026-03-15") → "2026-03-14"
 */
export function getPrevDate(iso: string): string {
  const d = new Date(iso)
  d.setDate(d.getDate() - 1)
  return toISO(d)
}

/**
 * Return the ISO date of the day after the given date, or null if the given
 * date is today or in the future (can't navigate to the future).
 *
 * @example getNextDate("2026-03-14") → "2026-03-15"  (assuming today is 2026-03-15)
 * @example getNextDate("2026-03-15") → null            (today — can't go forward)
 */
export function getNextDate(iso: string): string | null {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d >= today) return null
  d.setDate(d.getDate() + 1)
  return toISO(d)
}

// ─── Query string builder ─────────────────────────────────────────────────────

/**
 * Convert a flat filter object into a URLSearchParams query string.
 * Skips keys whose values are undefined, null, or empty string.
 *
 * @example
 * buildQueryString({ type: 'sale', limit: 20, status: undefined })
 * → "type=sale&limit=20"
 */
export function buildQueryString(filters: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  return params.toString()
}
