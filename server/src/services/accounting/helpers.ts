/**
 * Shared constants and pure helper functions for the accounting module.
 */

/** Account types where debit increases balance (debit-normal accounts). */
export const DEBIT_NORMAL_TYPES = new Set(['ASSET', 'EXPENSE'])

/**
 * Compute the Indian FY suffix for a given date.
 * April 2025 – March 2026 → "2526"
 */
export function getFySuffix(date: Date): string {
  const month = date.getMonth() // 0-based; April = 3
  const year = date.getFullYear()
  const startYear = month >= 3 ? year : year - 1
  const endYear = startYear + 1
  return `${String(startYear).slice(-2)}${String(endYear).slice(-2)}`
}

/**
 * Calculate the net balance delta for a single line on a given account type.
 * Returns a positive number to increment, negative to decrement.
 */
export function balanceDelta(accountType: string, debit: number, credit: number): number {
  if (DEBIT_NORMAL_TYPES.has(accountType)) {
    return debit - credit
  }
  return credit - debit
}
