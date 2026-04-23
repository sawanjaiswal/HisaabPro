/**
 * FY Closure helpers — FY date parsing and entry number builder.
 */
import { prisma } from '../../lib/prisma.js'
import { validationError } from '../../lib/errors.js'

/** Parse a 4-digit FY string like "2526" into start (April 1 2025) and end (March 31 2026) */
export function fyDateRange(financialYear: string): { from: Date; to: Date } {
  if (!/^\d{4}$/.test(financialYear)) {
    throw validationError('financialYear must be a 4-digit string like "2526"')
  }

  const startYear = 2000 + parseInt(financialYear.slice(0, 2), 10)
  const endYear = 2000 + parseInt(financialYear.slice(2, 4), 10)

  if (endYear !== startYear + 1) {
    throw validationError('financialYear end year must be start year + 1 (e.g. "2526" = 2025-2026)')
  }

  // India FY: April 1 (start) → March 31 (end)
  const from = new Date(Date.UTC(startYear, 3, 1)) // April 1
  const to = new Date(Date.UTC(endYear, 2, 31, 23, 59, 59, 999)) // March 31 EOD

  return { from, to }
}

/** Build a unique journal entry number for FY closure */
export async function buildClosureEntryNumber(
  businessId: string,
  financialYear: string,
): Promise<string> {
  const count = await prisma.journalEntry.count({
    where: { businessId, type: 'FY_CLOSURE' },
  })
  return `FYCLOSE-${financialYear}-${String(count + 1).padStart(3, '0')}`
}
