/**
 * Statement Balance Helpers — opening balance computation.
 * Split from statement.service.ts to keep file under 250 lines.
 *
 * F-16: computeOpeningBalance now aggregates at the DB layer with two
 * aggregate() calls instead of materialising the full history in memory.
 */

import { prisma } from '../../lib/prisma.js'

const DEBIT_DOC_TYPES: string[] = ['SALE_INVOICE', 'DEBIT_NOTE']
const ALL_DOC_TYPES:   string[] = ['SALE_INVOICE', 'DEBIT_NOTE', 'CREDIT_NOTE']

/**
 * Compute opening balance in paise for a party as of a given date.
 * positive = receivable (party owes us), negative = payable (we owe party).
 *
 * Uses DB-level aggregation to avoid materialising potentially thousands of
 * historical rows in Node memory for long-tenured parties.
 */
export async function computeOpeningBalance(
  businessId: string,
  partyId: string,
  before: Date
): Promise<number> {
  // Manual opening balance entry
  const ob = await prisma.openingBalance.findFirst({
    where: { partyId, isDeleted: false, asOfDate: { lt: before } },
  })
  let balance = 0
  if (ob) {
    balance = ob.type === 'RECEIVABLE' ? ob.amount : -ob.amount
  }

  // F-16: aggregate debit docs and credit docs separately at DB layer
  const [debitAgg, creditAgg] = await Promise.all([
    prisma.document.aggregate({
      _sum: { grandTotal: true },
      where: {
        businessId,
        partyId,
        isDeleted: false,
        type: { in: DEBIT_DOC_TYPES },
        documentDate: { lt: before },
      },
    }),
    prisma.document.aggregate({
      _sum: { grandTotal: true },
      where: {
        businessId,
        partyId,
        isDeleted: false,
        // CREDIT_NOTE is the only non-debit doc type in ALL_DOC_TYPES
        type: { in: ALL_DOC_TYPES.filter(t => !DEBIT_DOC_TYPES.includes(t)) },
        documentDate: { lt: before },
      },
    }),
  ])

  balance += debitAgg._sum.grandTotal ?? 0
  balance -= creditAgg._sum.grandTotal ?? 0

  // F-16: aggregate payments at DB layer — two groups by type
  const [payInAgg, payOutAgg] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        businessId, partyId, isDeleted: false,
        date: { lt: before },
        type: 'PAYMENT_IN',
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        businessId, partyId, isDeleted: false,
        date: { lt: before },
        type: 'PAYMENT_OUT',
      },
    }),
  ])

  // PAYMENT_IN = customer pays us → reduces receivable
  balance -= payInAgg._sum.amount ?? 0
  balance += payOutAgg._sum.amount ?? 0

  return balance
}

// Exported for use by statement.service.ts
export { DEBIT_DOC_TYPES, ALL_DOC_TYPES }
