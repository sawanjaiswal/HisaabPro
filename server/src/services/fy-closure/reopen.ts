/**
 * Reopen FY — voids the closing journal entry, restores income/expense balances,
 * reverses Retained Earnings adjustment, marks closure as REOPENED.
 */
import { prisma } from '../../lib/prisma.js'
import { validationError, notFoundError } from '../../lib/errors.js'

export async function reopenFY(businessId: string, financialYear: string) {
  const closure = await prisma.financialYearClosure.findUnique({
    where: { businessId_financialYear: { businessId, financialYear } },
    select: { id: true, status: true, journalEntryId: true, retainedEarnings: true },
  })
  if (!closure) throw notFoundError(`Financial year closure for ${financialYear}`)
  if (closure.status !== 'CLOSED') {
    throw validationError(`Financial year ${financialYear} is not in CLOSED status`)
  }

  return prisma.$transaction(async (tx) => {
    // Void the closing journal entry
    if (closure.journalEntryId) {
      const closingEntry = await tx.journalEntry.findUnique({
        where: { id: closure.journalEntryId },
        select: {
          id: true,
          status: true,
          lines: {
            select: {
              accountId: true,
              debit: true,
              credit: true,
              account: { select: { type: true } },
            },
          },
        },
      })

      if (closingEntry && closingEntry.status === 'POSTED') {
        // Reverse balance changes: undo the balance resets and RE adjustments
        for (const line of closingEntry.lines) {
          if (line.account.type === 'INCOME') {
            // Was debited to close — restore by crediting back (increase balance)
            await tx.ledgerAccount.update({
              where: { id: line.accountId },
              data: { balance: { increment: line.debit } },
            })
          } else if (line.account.type === 'EXPENSE') {
            // Was credited to close — restore by debiting back (increase balance)
            await tx.ledgerAccount.update({
              where: { id: line.accountId },
              data: { balance: { increment: line.credit } },
            })
          } else if (line.account.type === 'EQUITY') {
            // Retained earnings: reverse the credit/debit
            const delta = line.credit - line.debit
            await tx.ledgerAccount.update({
              where: { id: line.accountId },
              data: { balance: { decrement: delta } },
            })
          }
        }

        // Void the entry
        await tx.journalEntry.update({
          where: { id: closure.journalEntryId },
          data: {
            status: 'VOID',
            voidedAt: new Date(),
            voidedBy: 'system',
            voidReason: `FY ${financialYear} reopened`,
          },
        })
      }
    }

    // Mark closure as reopened
    return tx.financialYearClosure.update({
      where: { id: closure.id },
      data: { status: 'REOPENED' },
    })
  })
}
