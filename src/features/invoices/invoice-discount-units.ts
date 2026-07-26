/** Invoice discounts — percent (form) ↔ basis points (wire).
 *
 * The document columns hold percentage discounts in basis points: the server's
 * `calculateLineDiscount` / `calculateChargeAmount` divide by 10,000, and the
 * POS checkout writes the same columns that way. The invoice form, on the other
 * hand, holds what the seller typed — `10` means 10% — because that is what the
 * field renders and what the on-screen totals are computed from.
 *
 * Those two are the same units for AMOUNT / FIXED (paise both sides), and 100×
 * apart for PERCENTAGE. Converting anywhere other than the wire crossing would
 * leave the displayed total and the saved total disagreeing, which for a
 * 10% discount means billing the customer 9.9% too much.
 */

import { PAISE_BASIS_POINTS } from '@shared/enums'

/** 100% expressed in the percent units the form uses. */
const PERCENT_MAX = 100

const PERCENT_TO_BASIS_POINTS = PAISE_BASIS_POINTS / PERCENT_MAX

/** Form → wire. Percentages become basis points; absolute values pass through. */
export function discountToWire(type: string, value: number): number {
  if (type !== 'PERCENTAGE') return value
  return Math.round(Math.min(value, PERCENT_MAX) * PERCENT_TO_BASIS_POINTS)
}

/** Wire → form. Inverse of {@link discountToWire}, for editing a saved document. */
export function discountFromWire(type: string, value: number): number {
  if (type !== 'PERCENTAGE') return value
  return value / PERCENT_TO_BASIS_POINTS
}
