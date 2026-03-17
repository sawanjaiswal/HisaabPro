/**
 * Composition Scheme Constants
 * Flat rates by business type per GST Composition Scheme rules.
 * All rates in BASIS POINTS (e.g. 100 = 1%).
 */

/** Flat composition rate by business type (basis points) */
export const COMPOSITION_RATES: Record<string, number> = {
  manufacturer: 100,   // 1% of turnover
  trader: 100,         // 1% of turnover
  restaurant: 500,     // 5% of turnover (food service businesses)
  default: 600,        // 6% for other service providers
}

/** Maximum annual turnover threshold for composition scheme eligibility (paise) */
export const COMPOSITION_TURNOVER_LIMIT_PAISE = 150_000_000_00 // Rs 1.5 Crore in paise

/** Display label for composition invoices (replaces "Tax Invoice") */
export const COMPOSITION_INVOICE_LABEL = 'Bill of Supply'

/** Warning text required on composition invoices by law */
export const COMPOSITION_DISCLAIMER =
  'Composition taxable person, not eligible to collect tax on supplies'
