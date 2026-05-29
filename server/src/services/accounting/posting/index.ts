/**
 * GL auto-posting — persistence core + public barrel.
 *
 * persistPosting writes ONE balanced POSTED JournalEntry (with lines) and
 * updates the denormalised LedgerAccount.balance for every leg, all inside the
 * caller's transaction. Hard-atomic: a throw here rolls back the whole mutation
 * (invoice/payment/expense + this entry) as one unit.
 *
 * Idempotency is enforced at the DB by the partial unique index on
 * (businessId, sourceType, sourceId) WHERE sourceType/sourceId not null AND
 * status='POSTED' (migration 20260529062430_gl_source_idempotency_unique).
 */
import { validationError } from '../../../lib/errors.js'
import { balanceDelta } from '../helpers.js'
import { resolveAccounts } from './account-resolver.js'
import { allocateEntryNumber } from './entry-number.js'
import type { PostingContext, PostingMap, Tx } from './posting.types.js'

export async function persistPosting(
  tx: Tx,
  ctx: PostingContext,
  map: PostingMap,
): Promise<{ journalEntryId: string } | null> {
  const lines = map.lines.filter((l) => l.debit !== 0 || l.credit !== 0)
  if (lines.length === 0) return null

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  if (totalDebit !== totalCredit) {
    throw validationError(
      `GL posting: unbalanced entry for ${ctx.sourceType} ${ctx.sourceId} ` +
        `(debit ${totalDebit} ≠ credit ${totalCredit})`,
    )
  }

  const accounts = await resolveAccounts(tx, ctx.businessId, lines.map((l) => l.code))
  const entryNumber = await allocateEntryNumber(tx, ctx.businessId, ctx.date)

  const entry = await tx.journalEntry.create({
    data: {
      businessId: ctx.businessId,
      entryNumber,
      date: ctx.date,
      narration: ctx.narration,
      type: map.type,
      status: 'POSTED',
      sourceType: ctx.sourceType,
      sourceId: ctx.sourceId,
      sourceNumber: ctx.sourceNumber,
      totalDebit,
      totalCredit,
      createdBy: ctx.userId,
      postedAt: new Date(),
      lines: {
        create: lines.map((l, idx) => ({
          accountId: accounts.get(l.code)!.id,
          debit: l.debit,
          credit: l.credit,
          narration: l.narration ?? null,
          partyId: l.partyId ?? null,
          sortOrder: idx,
        })),
      },
    },
    select: { id: true },
  })

  for (const l of lines) {
    const acct = accounts.get(l.code)!
    const delta = balanceDelta(acct.type, l.debit, l.credit)
    if (delta !== 0) {
      await tx.ledgerAccount.update({ where: { id: acct.id }, data: { balance: { increment: delta } } })
    }
  }

  return { journalEntryId: entry.id }
}

export { postDocument } from './post-document.js'
export { postPayment } from './post-payment.js'
export { postExpense } from './post-expense.js'
export { reverseSourceEntry } from './reverse-entry.js'
