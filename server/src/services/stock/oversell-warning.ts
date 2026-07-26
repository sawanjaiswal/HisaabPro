/**
 * The one sentence the app uses to say "you just sold stock you do not have".
 *
 * WARN_ONLY is a policy with two halves: allow the sale (a queue at the counter
 * is worse than a negative number) and tell someone. The allow half lives in
 * `adjustStock`; this is the tell half, kept in one place so the POS receipt,
 * the invoice response and anything added later say it identically instead of
 * each inventing a phrasing.
 */

/**
 * The warning for a movement that has already been applied, or `null` when
 * there is nothing to say. Callers append it to whatever `warnings[]` they
 * already return.
 *
 * @param productName - as the shopkeeper knows it, not an id
 * @param newStock    - the balance AFTER the movement; ≥ 0 means no oversell
 */
export function oversellWarning(productName: string, newStock: number): string | null {
  if (newStock >= 0) return null
  return `"${productName}" is now ${newStock} in stock — sold under WARN_ONLY policy`
}
