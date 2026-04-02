/**
 * Document Number Service — atomic number generation per document type + financial year
 * Uses UPDATE ... RETURNING to prevent race conditions (same pattern as SKU generation).
 */

import { prisma, type ExtendedPrismaClient } from '../lib/prisma.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

/** Default prefixes per document type */
const DEFAULT_PREFIXES: Record<string, string> = {
  SALE_INVOICE: 'INV',
  PURCHASE_INVOICE: 'PI',
  ESTIMATE: 'EST',
  PROFORMA: 'PRO',
  SALE_ORDER: 'SO',
  PURCHASE_ORDER: 'PO',
  DELIVERY_CHALLAN: 'DC',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
}

/**
 * Get the Indian financial year string for a given date.
 * Indian FY: April 1 to March 31. E.g., April 2025 → "2526"
 */
export function getFinancialYear(date: Date): string {
  const month = date.getMonth() + 1 // 1-indexed
  const year = date.getFullYear()
  const fyStartYear = month >= 4 ? year : year - 1
  const fyEndYear = fyStartYear + 1
  return `${String(fyStartYear).slice(-2)}${String(fyEndYear).slice(-2)}`
}

/**
 * Generate the next document number atomically. MUST be called within a $transaction.
 * Creates the series row if it doesn't exist (lazy init per business/type/FY).
 */
export async function generateNextNumber(
  tx: TxClient,
  businessId: string,
  documentType: string,
  documentDate: Date
): Promise<{ documentNumber: string; sequenceNumber: number; financialYear: string }> {
  const financialYear = getFinancialYear(documentDate)

  // Try atomic increment first
  const updated = await tx.$queryRaw<
    Array<{ current_sequence: number; prefix: string; separator: string; padding_digits: number; suffix: string }>
  >`
    UPDATE "DocumentNumberSeries"
    SET "currentSequence" = "currentSequence" + 1, "updatedAt" = NOW()
    WHERE "businessId" = ${businessId} AND "documentType" = ${documentType} AND "financialYear" = ${financialYear}
    RETURNING "currentSequence" as current_sequence, prefix, separator, "paddingDigits" as padding_digits, suffix`

  let sequence: number
  let prefix: string
  let separator: string
  let paddingDigits: number
  let suffix: string

  if (updated.length > 0) {
    sequence = updated[0].current_sequence
    prefix = updated[0].prefix
    separator = updated[0].separator
    paddingDigits = updated[0].padding_digits
    suffix = updated[0].suffix
  } else {
    // First document of this type in this FY — create series
    const defaultPrefix = DEFAULT_PREFIXES[documentType] || 'DOC'
    const created = await tx.documentNumberSeries.create({
      data: {
        businessId,
        documentType,
        financialYear,
        prefix: defaultPrefix,
        currentSequence: 1,
        startingNumber: 1,
        paddingDigits: 3,
        separator: '-',
        suffix: '',
      },
      select: {
        currentSequence: true,
        prefix: true,
        separator: true,
        paddingDigits: true,
        suffix: true,
      },
    })
    sequence = created.currentSequence
    prefix = created.prefix
    separator = created.separator
    paddingDigits = created.paddingDigits
    suffix = created.suffix
  }

  const paddedSeq = String(sequence).padStart(paddingDigits, '0')
  const parts = [prefix, financialYear, paddedSeq]
  let documentNumber = parts.join(separator)
  if (suffix) documentNumber += suffix

  return { documentNumber, sequenceNumber: sequence, financialYear }
}

/** Get next number preview (without incrementing) */
export async function getNextNumberPreview(
  businessId: string,
  documentType: string
): Promise<{ nextNumber: string; prefix: string; financialYear: string; sequence: number }> {
  const financialYear = getFinancialYear(new Date())
  const defaultPrefix = DEFAULT_PREFIXES[documentType] || 'DOC'

  const series = await prisma.documentNumberSeries.findUnique({
    where: {
      businessId_documentType_financialYear: {
        businessId,
        documentType,
        financialYear,
      },
    },
    select: {
      currentSequence: true,
      prefix: true,
      separator: true,
      paddingDigits: true,
      suffix: true,
    },
  })

  const nextSeq = series ? series.currentSequence + 1 : 1
  const prefix = series?.prefix || defaultPrefix
  const sep = series?.separator || '-'
  const padding = series?.paddingDigits || 3
  const suffix = series?.suffix || ''

  const paddedSeq = String(nextSeq).padStart(padding, '0')
  let nextNumber = [prefix, financialYear, paddedSeq].join(sep)
  if (suffix) nextNumber += suffix

  return { nextNumber, prefix, financialYear, sequence: nextSeq }
}
