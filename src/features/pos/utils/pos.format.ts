/** POS — Formatting utilities (pure, no side effects) */

/** Convert paise (integer) to INR string e.g. 150050 → "₹1,500.50" */
export function paiseToInr(paise: number): string {
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees)
}

/** Compact INR e.g. 150050 → "1,500.50" (no symbol) */
export function paiseToInrNumeric(paise: number): string {
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

/** Truncate string to maxLen, appending "…" if needed */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/**
 * Format a receipt line for monospace display.
 * Left column padded, right column right-aligned.
 * Total width = lineWidth chars.
 */
export function formatReceiptLine(
  left: string,
  right: string,
  lineWidth: number,
): string {
  const leftTruncated = truncate(left, lineWidth - right.length - 1)
  const padding = lineWidth - leftTruncated.length - right.length
  return leftTruncated + ' '.repeat(Math.max(1, padding)) + right
}

/** Format date as DD/MM/YY HH:MM */
export function formatReceiptDate(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  const yr  = String(d.getFullYear()).slice(2)
  const hrs = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${mon}/${yr} ${hrs}:${min}`
}

/** Format date as "8 May 2026" */
export function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
  })
}

/** Format time as "1:08 AM" */
export function formatDisplayTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
