---
symptom: A file with 3 customers previews as 2 rows — a row the parser dislikes is dropped before the preview, so the shop is never told a customer was not imported
root_cause_file: server/src/services/import/parsers/vyapar-csv.parser.ts:61
root_cause_reason: the parsers return null for a row whose name cell is empty, which removes it from the job entirely instead of letting the normalizer classify it as an ERROR row the preview can show
---

## 5-whys

1. Why does a 3-row file commit only 2 rows and report 0 errors? — The job has 2 ImportJobRows;
   the third was never created.
2. Why was it never created? — `vyaparCsvParser` returned `null` for it, and `runParseAndStage`
   only stages the rows a parser emits.
3. Why did the parser return null? — `rowToParty` has `if (!raw.name) return null`, a validity
   judgement made at parse time.
4. Why is that the wrong layer? — `party-normalizer.ts` already classifies a nameless row:
   `MISSING_NAME` is a fatal issue and the row becomes ERROR, which the preview shows as a chip and
   the error CSV exports. Its own header states the contract: "rows are never dropped here — even
   fully malformed rows pass through STAGED so the preview UI can show inline error chips". Two
   layers were deciding, and the earlier one deleted the evidence.
5. Why does it matter beyond tidiness? — Counts are the only reconciliation a shopkeeper has. "500
   rows in my file, 498 imported, 2 with errors" is recoverable; "498 imported" against a file they
   believe has 500 is a customer that quietly does not exist. Silent loss, discovered on a
   statement months later.

## Hypothesis

Row validity belongs to the normalizer alone. The parsers keep only the filters that decide whether
something is a party ROW AT ALL — Vyapar's `Type` column (customer/supplier/both) and Tally's
non-party ledger groups — and stop dropping rows for missing field values. A nameless row is then
staged as ERROR and appears in the preview count, the error CSV, and the committed/error totals.

## Failing test

server/src/services/import/parsers/__tests__/row-retention.test.ts — a Vyapar CSV, a Busy sheet and
a Tally ledger each carrying one nameless entry must emit that entry as a row, and normalizing it
must produce MISSING_NAME. Plus e2e/gold/import.spec.ts TC-IMP-02 end to end
(committed + skipped + errors must account for every line in the file).
