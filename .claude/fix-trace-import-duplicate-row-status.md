---
symptom: Importing a file that contains a customer the shop already has fails the WHOLE commit with 409 DUPLICATE_ENTRY and writes nothing — every other row in the file is lost too
root_cause_file: server/src/services/import/party-parse.helper.ts:34
root_cause_reason: classifyRow decides a row's status from its normalization issues alone and never looks at the dedup result, so an exact phone/GSTIN match is staged as a brand-new party; the commit then calls party.create and Postgres rejects it on the (businessId, phone) unique index, aborting the whole transaction
---

## 5-whys

1. Why does `POST /imports/:id/commit` answer 409 DUPLICATE_ENTRY? — `tx.party.create()` in
   commit-parties.service.ts:50 hit `Unique constraint failed on (businessId, phone)`.
2. Why is a party with that phone created twice? — the row was in status `STAGED`, and the STAGED
   pass creates unconditionally. Only `DUPLICATE_EXACT` / `DUPLICATE_NEAR` rows are excluded from
   that pass.
3. Why was a row whose phone already exists staged as new? — `classifyRow(n)` in
   party-parse.helper.ts takes only the normalized row. `buildStagedPartyRows` does run
   `findExactDuplicates`, but it uses the hit for `matchedPartyId` only; the status stays STAGED.
4. Why did the exact-dedup result never reach the status? — the two were written as separate
   concerns: "which party did we match" and "is this row committable". Status is the field the
   commit reads, so a match that does not change the status changes nothing.
5. Why did no test catch it? — parse.service.test.ts asserted `expect(dupRow?.status).toBe('STAGED')`
   for a row with a matched party. The test encoded the defect as the contract.

Two more consequences of the same cause, both invisible until the commit crashes:
   - the preview never shows "this customer already exists", so the shopkeeper is never asked;
   - `applyDedupResolutions` rejects any decision with 400 INVALID_RESOLUTION because it only accepts
     `DUPLICATE_*` rows — the whole SKIP / OVERWRITE / CREATE_NEW feature was unreachable.

And a sibling case with the identical crash: two rows *inside the same file* carrying one phone.
`findExactDuplicates` only looks at the database, so the second row is staged as new and the commit
dies the same way. Real exports repeat a number constantly (a shop and its owner, a re-entered
customer), so this is not an edge case.

## Hypothesis

Row status is the single field the commit reads, so it must be the single place every judgement
about a row lands. `classifyRow` becomes that place: fatal issue → ERROR, exact match (in the
database OR earlier in the same file) → DUPLICATE_EXACT, otherwise STAGED. Near matches stay STAGED
with their advisory `NEAR_DUPLICATE` issue — a fuzzy name match is a warning, and turning it into a
blocking status would silently drop real customers (it also carries no `matchedPartyId`, so
OVERWRITE could not resolve it anyway).

Unresolved `DUPLICATE_*` rows must then be reported as skipped, or `committed + skipped + errors`
stops reconciling to the file's row count — the shopkeeper's only way to check nothing vanished.

## Failing test

server/src/services/import/__tests__/parse-dedup-status.test.ts — a row matching an existing party
must be staged `DUPLICATE_EXACT`; a phone repeated inside one file must mark the later row
`DUPLICATE_EXACT`; a near match must stay `STAGED`. All three fail before the fix.
server/src/services/import/__tests__/commit.service.test.ts gains the reconciliation case.
e2e/gold/import.spec.ts TC-IMP-03 covers it end to end.

## Did I fix the symptom or the cause?

The cause. The symptom was a unique-constraint 409; suppressing it (catch P2002, skip the row) would
have left the preview still lying about duplicates and the resolution feature still unreachable. The
fix is at the one function that decides what a row is.
