/** Smart inventory (#148) — pure presentation helpers. */

/** "in 5 days" style label, or a fallback when stock isn't moving. */
export function daysToStockOutLabel(
  days: number | null,
  notMovingLabel: string,
  daysWord: string,
): string {
  if (days === null) return notMovingLabel
  return `${days} ${daysWord}`
}

/** Format a sales rate, e.g. "10/day" — velocity is already rounded server-side. */
export function velocityLabel(velocity: number, perDay: string): string {
  return `${velocity}${perDay}`
}
