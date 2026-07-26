---
symptom: Every party row from a Tally, Vyapar or Busy file imports as an error — "Name is required" — so the three exporters the import feature exists for import nothing
root_cause_file: server/src/services/import/normalizers/normalize-mappings.ts:31
root_cause_reason: the default mappings name the SOURCE headers, but they are applied downstream of a parser that has already renamed those headers to canonical keys, so every lookup misses
---

## 5-whys

1. Why does a clean Vyapar export produce 100% error rows? — Every row is classified ERROR, and the
   only fatal issue is `MISSING_NAME`.
2. Why is the name missing when the file has a "Party Name" column? — The normalizer looks up the
   header `'Party Name'` in the row it was handed, and that row has no such key.
3. Why not? — `vyaparCsvParser` already mapped `'Party Name' → name` (its own `COLUMN_MAP`), so the
   raw row it emits is `{ name, phone, email, gstin, address, openingBalance }`.
4. Why does the mapping still describe source headers then? — `VYAPAR_DEFAULT_MAPPING` was written as
   "what Vyapar's file looks like", but it is consumed *after* the parser, where the only shape that
   exists is the parser's canonical one. Same for Tally and Busy.
5. Why did no test catch it? — The normalizer's unit tests feed it hand-written source-header rows
   (`{'Party Name': 'Raju Traders'}`) — rows no parser ever produces. Both sides were tested; the
   seam between them was not.

## Hypothesis

There is exactly one place source headers belong: each parser's own `COLUMN_MAP`, which is what
reads the file. Everything downstream of a parser sees canonical keys, so the mapping handed to the
normalizer for a known format must be the identity mapping over those keys. `GENERIC_CSV` keeps
returning `null` — it preserves the file's own headers on purpose and the mapping screen supplies
one.

## Failing test

server/src/services/import/normalizers/__tests__/party-mapping-seam.test.ts — parses a real Vyapar /
Busy CSV buffer through the actual parser and normalizes the row it emits, asserting no
`MISSING_NAME`. Plus e2e/gold/import.spec.ts TC-IMP-01 end to end.
