/**
 * Reverse the POSTED JournalEntry for a source record (VOID-in-place).
 *
 * Used on void/delete of a source, and as the first half of edit-of-posted
 * (reverse, then re-post fresh). VOID-in-place preserves the original row for
 * audit and — because the partial unique idempotency index is scoped to
 * status='POSTED' — frees the (businessId, sourceType, sourceId) slot so a
 * re-post does not collide.
 */
import { postLedgerDeltas } from './ledger-deltas.js'
import type { Tx } from './posting.types.js'

export async function reverseSourceEntry(
  tx: Tx,
  businessId: string,
  sourceType: string,
  sourceId: string,
  reason = 'Source record changed',
): Promise<{ voidedJournalEntryId: string } | null> {
  const entry = await tx.journalEntry.findFirst({
    where: { businessId, sourceType, sourceId, status: 'POSTED' },
    select: {
      id: true,
      lines: { select: { debit: true, credit: true, account: { select: { id: true, type: true } } } },
    },
  })
  if (!entry) return null

  await postLedgerDeltas(
    tx,
    entry.lines.map((line) => ({
      accountId: line.account.id,
      accountType: line.account.type,
      debit: line.debit,
      credit: line.credit,
    })),
    { reverse: true },
  )

  await tx.journalEntry.update({
    where: { id: entry.id },
    data: { status: 'VOID', voidedAt: new Date(), voidReason: reason },
  })

  return { voidedJournalEntryId: entry.id }
}
