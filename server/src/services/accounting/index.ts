/**
 * Accounting Service — public API.
 *
 * Key invariants enforced here:
 *   - Every posted journal entry: total debit === total credit
 *   - Balance rules: ASSET/EXPENSE are debit-normal; LIABILITY/EQUITY/INCOME are credit-normal
 *   - Balance mutations only happen on post and void (not on draft create)
 *   - All balance mutations use $transaction for atomicity
 *   - Entry numbers are FY-scoped: "JE-2526-001" (April 2025–March 2026 = "2526")
 */

export {
  seedDefaultAccounts,
  createLedgerAccount,
  updateLedgerAccount,
  listLedgerAccounts,
  getLedgerAccount,
} from './chart-of-accounts.js'

export {
  generateEntryNumber,
  createJournalEntry,
  postJournalEntry,
  voidJournalEntry,
  getJournalEntry,
  listJournalEntries,
} from './journal-entries.js'

export {
  getTrialBalance,
  getLedgerReport,
  getDayBook,
} from './reports.js'
