/** Currency — Pure utility functions
 *
 * No React, no hooks, no side effects.
 * All calculations operate on integer rate values (rate * RATE_PRECISION).
 */

import { RATE_PRECISION, BASE_CURRENCY_LABEL } from './currency.constants'

/**
 * Format a stored rate integer for display.
 * 845000 → "84.5000" but we show up to 4 decimal places trimmed.
 * e.g. 845000 → "84.50", 840000 → "84.00"
 */
export function formatRate(rawRate: number): string {
  const value = rawRate / RATE_PRECISION
  return value.toFixed(2)
}

/**
 * Format a rate as a full label.
 * e.g. formatRateLabel('USD', 845000) → "1 USD = Rs 84.50"
 */
export function formatRateLabel(currencyCode: string, rawRate: number): string {
  return `1 ${currencyCode} = ${BASE_CURRENCY_LABEL} ${formatRate(rawRate)}`
}

/**
 * Convert a display rate string (e.g. "84.50") to the stored integer.
 * Returns NaN if the input is not a valid positive number.
 */
export function parseRateInput(displayValue: string): number {
  const parsed = parseFloat(displayValue)
  if (isNaN(parsed) || parsed <= 0) return NaN
  return Math.round(parsed * RATE_PRECISION)
}

/**
 * Format an ISO date string for display (DD/MM/YYYY).
 */
export function formatEffectiveDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}/${year}`
}

/**
 * Returns today's date in YYYY-MM-DD format (for default date inputs).
 */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
