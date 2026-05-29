/**
 * Allocate the next JournalEntry number inside a transaction.
 *
 * Format: JE-<fySuffix>-NNN (e.g. JE-2526-001), matching the existing manual
 * journal-entry numbering (journal-entries.ts:generateEntryNumber). Runs inside
 * the caller's tx; the @@unique([businessId, entryNumber]) constraint is the
 * backstop if two concurrent posts race on the same count (the loser's tx
 * aborts and is retried by the caller).
 */
import { getFySuffix } from '../helpers.js'
import type { Tx } from './posting.types.js'

export async function allocateEntryNumber(
  tx: Tx,
  businessId: string,
  date: Date,
): Promise<string> {
  const prefix = `JE-${getFySuffix(date)}-`
  const count = await tx.journalEntry.count({
    where: { businessId, entryNumber: { startsWith: prefix } },
  })
  return `${prefix}${String(count + 1).padStart(3, '0')}`
}
