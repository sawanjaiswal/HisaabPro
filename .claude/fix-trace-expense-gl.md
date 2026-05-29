---
symptom: Manually-created expenses never appear in the GL (P&L / Balance Sheet / Cash Flow); editing or deleting a posted expense strands ledger balances.
root_cause_file: server/src/services/expense.service.ts:89
root_cause_reason: GL posting was attached to the status-transition function (confirmExpense) instead of the create/update/delete lifecycle, so the direct-create path (status:'CONFIRMED' on insert) and edit/delete paths never post or reverse.
---
## 5-whys
1. Why are manual expenses missing from P&L/Balance Sheet? No JournalEntry is created for them.
2. Why no JournalEntry? createExpense never calls postExpense.
3. Why not? S1 wired postExpense only into the recurring confirm path (expense-confirm.service.ts), assuming every expense flows PENDING_CONFIRMATION → CONFIRMED.
4. Why does that miss the manual path? createExpense writes status:'CONFIRMED' directly, bypassing confirmExpense — so its posting hook never runs.
5. Root: posting/reversal was bound to a single status-transition site rather than the create/update/delete lifecycle. Edit and soft-delete of a posted expense likewise mutate without reverse/re-post, so LedgerAccount.balance diverges from the journal truth.

## Hypothesis
Wrapping createExpense / updateExpense / deleteExpense in a transaction and routing them through the existing single-writer posting layer (postExpense / reverseSourceEntry) — exactly as payments already do in payment/create.ts and payment/update-delete.ts — closes the gap. reverseSourceEntry is a no-op when no POSTED entry exists, so PENDING expenses are safe; re-post is guarded on status === 'CONFIRMED'.

## Failing test
server/src/services/expense/__tests__/expense-gl-posting.test.ts — asserts createExpense posts a balanced EXPENSE JournalEntry, updateExpense reverses+reposts, deleteExpense reverses; stored balance stays == derived.
