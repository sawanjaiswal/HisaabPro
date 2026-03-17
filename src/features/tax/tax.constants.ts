/** GST & Tax — Constants and configuration
 *
 * All label maps, thresholds, and config values for GST.
 * No business logic here — pure data.
 *
 * Rates are in BASIS POINTS (1800 = 18.00%).
 * Thresholds are in PAISE.
 */

import type { SupplyType } from './tax.types'

// ─── GST rate slabs ────────────────────────────────────────────────────────────

/** Default GST rate slabs in basis points */
export const DEFAULT_GST_RATES = [0, 500, 1200, 1800, 2800] as const

/** GST rate labels for display */
export const GST_RATE_LABELS: Record<number, string> = {
  0:    'GST 0%',
  25:   'GST 0.25%',
  500:  'GST 5%',
  1200: 'GST 12%',
  1800: 'GST 18%',
  2800: 'GST 28%',
}

/** Format basis points as a percentage string for display */
export function formatRate(basisPoints: number): string {
  const pct = basisPoints / 100
  return pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(2)}%`
}

// ─── Indian state codes ────────────────────────────────────────────────────────

/** Indian state codes (2-digit) for Place of Supply */
export const INDIAN_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
}

// ─── Supply type labels ────────────────────────────────────────────────────────

/** Supply type labels for display */
export const SUPPLY_TYPE_LABELS: Record<SupplyType, string> = {
  B2B:       'Business to Business',
  B2C_LARGE: 'B2C (Large)',
  B2C_SMALL: 'B2C (Small)',
  EXPORT:    'Export',
  SEZ:       'SEZ Supply',
}

// ─── Monetary thresholds ───────────────────────────────────────────────────────

/** B2C Large threshold in paise (Rs 2,50,000) */
export const B2C_LARGE_THRESHOLD_PAISE = 25_000_000

/** E-Way Bill value threshold in paise (Rs 50,000) */
export const EWAY_BILL_THRESHOLD_PAISE = 5_000_000

// ─── Time windows ──────────────────────────────────────────────────────────────

/** E-Invoice cancel window (24 hours in milliseconds) */
export const EINVOICE_CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000

// ─── Default seeded categories ────────────────────────────────────────────────

/** Default tax categories seeded on GST setup */
export const DEFAULT_TAX_CATEGORIES = [
  { name: 'Exempt',    rate: 0,    cessRate: 0 },
  { name: 'GST 0%',   rate: 0,    cessRate: 0 },
  { name: 'GST 0.25%', rate: 25,  cessRate: 0 },
  { name: 'GST 5%',   rate: 500,  cessRate: 0 },
  { name: 'GST 12%',  rate: 1200, cessRate: 0 },
  { name: 'GST 18%',  rate: 1800, cessRate: 0 },
  { name: 'GST 28%',  rate: 2800, cessRate: 0 },
] as const
