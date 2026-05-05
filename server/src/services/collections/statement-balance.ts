/**
 * Statement Balance Helpers — opening balance computation.
 * Split from statement.service.ts to keep file under 250 lines.
 */

import { prisma } from '../../lib/prisma.js'

const DEBIT_DOC_TYPES: string[] = ['SALE_INVOICE', 'DEBIT_NOTE']
const ALL_DOC_TYPES:   string[] = ['SALE_INVOICE', 'DEBIT_NOTE', 'CREDIT_NOTE']

/**
 * Compute opening balance in paise for a party as of a given date.
 * positive = receivable (party owes us), negative = payable (we owe party).
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

  // Documents before `from`
  const docs = await prisma.document.findMany({
    where: {
      businessId,
      partyId,
      isDeleted: false,
      type: { in: ALL_DOC_TYPES },
      documentDate: { lt: before },
    },
    select: { type: true, grandTotal: true },
  })
  for (const doc of docs) {
    if (DEBIT_DOC_TYPES.includes(doc.type)) {
      balance += doc.grandTotal
    } else {
      balance -= doc.grandTotal
    }
  }

  // Payments before `from`
  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      partyId,
      isDeleted: false,
      date: { lt: before },
    },
    select: { type: true, amount: true },
  })
  for (const p of payments) {
    // PAYMENT_IN = customer pays us → reduces receivable
    if (p.type === 'PAYMENT_IN') {
      balance -= p.amount
    } else {
      balance += p.amount
    }
  }

  return balance
}

// Exported for use by statement.service.ts
export { DEBIT_DOC_TYPES, ALL_DOC_TYPES }
