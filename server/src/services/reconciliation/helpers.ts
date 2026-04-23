/**
 * Pure utility functions for GST reconciliation.
 * No Prisma, no I/O — safe to unit-test in isolation.
 */

export const MATCH_TOLERANCE_PAISE = 1 // 1 paisa tolerance for floating-point artefacts

export function parsePeriodRange(period: string): { gte: Date; lte: Date } {
  const [year, month] = period.split('-').map(Number)
  return {
    gte: new Date(year, month - 1, 1),
    lte: new Date(year, month, 0, 23, 59, 59, 999),
  }
}

/** Convert rupees (float) to paise (integer) — round to nearest paisa */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/** Normalise invoice numbers for matching (uppercase, strip whitespace) */
export function normaliseInvoiceNumber(num: string): string {
  return num.trim().toUpperCase()
}
