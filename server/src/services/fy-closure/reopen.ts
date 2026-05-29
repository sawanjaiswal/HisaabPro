/**
 * Reopen FY — voids the closing journal entry, restores income/expense balances,
 * reverses Retained Earnings adjustment, marks closure as REOPENED.
 */
import { prisma } from '../../lib/prisma.js'
import { validationError, notFoundError } from '../../lib/errors.js'
import { postLedgerDeltas } from '../accounting/posting/ledger-deltas.js'

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
        // Reverse the closing entry through the single balance writer: applying
        // −balanceDelta to each closing line exactly undoes what close.ts applied
        // (restores income/expense balances and reverses the RE adjustment),
        // regardless of each account's sign. Kills the old per-type ad-hoc
        // branches — one convention, no contra-account blind spot.
        await postLedgerDeltas(
          tx,
          closingEntry.lines.map((line) => ({
            accountId: line.accountId,
            accountType: line.account.type,
            debit: line.debit,
            credit: line.credit,
          })),
          { reverse: true },
        )

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
