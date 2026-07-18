---
symptom: Party ledger double-counts every sale/purchase/payment — each shows both its Document/Payment voucher row AND the auto-posted GL journal row, inflating the running/closing balance (test party showed -60000 instead of the correct -30000)
root_cause_file: server/src/services/party/ledger.service.ts:132
root_cause_reason: the ledger merges Document rows, Payment rows, AND party-tagged JournalEntryLine rows, but the GL journal lines are auto-posted FROM those same documents/payments (sourceType DOCUMENT/PAYMENT), so each transaction is counted twice
---

## 5-whys
1. Why is the closing balance wrong? — Each transaction contributes two dr/cr rows instead of one.
2. Why two rows? — The invoice appears as a DOCUMENT row and again as a JOURNAL row (JE "Accounts receivable").
3. Why a JOURNAL row for the same invoice? — GL auto-posting (S1) creates a JournalEntry with a party-tagged Accounts-Receivable line for every SALE_INVOICE; the ledger's journalEntryLine query picks it up.
4. Why does that double-count? — The Document row already represents that receivable; the auto-posted JE line is the accounting mirror of the same event.
5. Why wasn't it caught? — The JE merge predates GL auto-posting being wired to document/payment creation; before auto-posting, party-tagged JE lines were only manual adjustments, so there was nothing to double.

## Hypothesis
The party ledger must exclude JournalEntry lines whose entry was auto-posted from a Document or Payment (sourceType DOCUMENT/PAYMENT), since those are already represented by the Document/Payment rows. Manual, opening, FY-closure, and expense journal entries (which have no Document/Payment row) must still appear. Apply the filter to both the opening-balance query and the window query.

## Failing test
server/src/services/party/__tests__/ledger-no-double-count.test.ts — assert journalEntryLine.findMany is called with journalEntry.sourceType { notIn: ['DOCUMENT','PAYMENT'] } for both opening and window queries.
