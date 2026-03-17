/** Invoice Formatting — Pure utility functions
 *
 * No hooks, no side effects. All functions: input → output.
 * Handles currency formatting, date formatting, and paise ↔ rupees conversion.
 */

// ─── Currency formatting ─────────────────────────────────────────────────────

/**
 * Format paise as Indian ₹ currency string.
 * 1550000 → "₹15,500.00"
 * 100000  → "₹1,000.00"
 * 10000000→ "₹1,00,000.00"
 */
export function formatInvoiceAmount(paise: number): string {
  const rupees = paise / 100
  return rupees.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// ─── Date formatting ─────────────────────────────────────────────────────────

/**
 * Format an ISO date string as a human-readable date.
 * "2026-03-14T00:00:00.000Z" → "14 Mar 2026"
 */
export function formatInvoiceDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Paise ↔ rupees helpers (shared across invoice forms) ────────────────────

/**
 * Convert paise integer to rupees float for form field display.
 * Use formatInvoiceAmount() for display — this is for form pre-population only.
 */
export function paiseToRupees(paise: number): number {
  return paise / 100
}

/**
 * Convert rupees float entered in a form to paise integer for storage.
 * Math.round prevents floating-point drift: 149.99 * 100 = 14998.999…
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}
