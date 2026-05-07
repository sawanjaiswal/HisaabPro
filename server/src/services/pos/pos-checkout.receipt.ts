/**
 * POS Receipt Counter Service — atomic receipt number generation per business + financial year.
 * Uses SELECT ... FOR UPDATE + UPDATE ... RETURNING to prevent race conditions.
 * MUST be called within a Prisma $transaction.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { PosSetting } from '@prisma/client'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

/**
 * Derive the Indian financial year string for a given date.
 * FY starts April 1. E.g., April 2026 → "25-26", March 2026 → "25-26".
 * Format: 2-digit start + "-" + 2-digit end.
 */
export function getPosFinancialYear(date: Date): string {
  const month = date.getMonth() + 1 // 1-indexed
  const year = date.getFullYear()
  const fyStartYear = month >= 4 ? year : year - 1
  const fyEndYear = fyStartYear + 1
  return `${String(fyStartYear).slice(-2)}-${String(fyEndYear).slice(-2)}`
}

type CounterRow = {
  id: string
  lastNumber: number
  prefix: string
  separator: string
  paddingDigits: number
}

type AllocateResult = {
  receiptNumber: string
  receiptSeq: number
  financialYear: string
}

/**
 * Allocate the next POS receipt number atomically.
 * Creates the counter row if not present (lazy init), then increments.
 *
 * @param tx          - Prisma transaction client
 * @param businessId  - Business owning the counter
 * @param posSetting  - Optional PosSetting row for prefix / separator / paddingDigits defaults
 */
export async function allocateNumber(
  tx: TxClient,
  businessId: string,
  posSetting?: Pick<PosSetting, 'receiptPrefix' | 'receiptSeparator' | 'receiptPaddingDigits'> | null
): Promise<AllocateResult> {
  const financialYear = getPosFinancialYear(new Date())

  const defaultPrefix = posSetting?.receiptPrefix ?? 'POS'
  const defaultSeparator = posSetting?.receiptSeparator ?? '-'
  const defaultPadding = posSetting?.receiptPaddingDigits ?? 5

  // Lock existing row (or detect absence)
  const existing = await tx.$queryRaw<CounterRow[]>`
    SELECT id, "lastNumber", prefix, separator, "paddingDigits"
    FROM "PosReceiptCounter"
    WHERE "businessId" = ${businessId}
      AND "financialYear" = ${financialYear}
    FOR UPDATE`

  if (existing.length === 0) {
    // Lazy-init: insert default row, then increment atomically
    await tx.$queryRaw`
      INSERT INTO "PosReceiptCounter"
        (id, "businessId", "financialYear", prefix, separator, "paddingDigits", "lastNumber", "updatedAt")
      VALUES (
        gen_random_uuid(),
        ${businessId},
        ${financialYear},
        ${defaultPrefix},
        ${defaultSeparator},
        ${defaultPadding},
        0,
        NOW()
      )
      ON CONFLICT ("businessId", "financialYear") DO NOTHING`
  }

  // Atomic increment — works whether we just inserted or row pre-existed
  const incremented = await tx.$queryRaw<Array<{ lastNumber: number; prefix: string; separator: string; paddingDigits: number }>>`
    UPDATE "PosReceiptCounter"
    SET "lastNumber" = "lastNumber" + 1, "updatedAt" = NOW()
    WHERE "businessId" = ${businessId}
      AND "financialYear" = ${financialYear}
    RETURNING "lastNumber", prefix, separator, "paddingDigits"`

  const row = incremented[0]
  if (!row) {
    throw new Error(`PosReceiptCounter increment failed for business=${businessId} FY=${financialYear}`)
  }

  const fyCompact = financialYear.replace('-', '') // "2526"
  const padded = String(row.lastNumber).padStart(row.paddingDigits, '0')
  const receiptNumber = `${row.prefix}${row.separator}${fyCompact}${row.separator}${padded}`

  return { receiptNumber, receiptSeq: row.lastNumber, financialYear }
}
