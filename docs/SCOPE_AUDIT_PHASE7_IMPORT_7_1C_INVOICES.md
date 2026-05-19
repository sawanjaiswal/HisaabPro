---
audit_of: SCOPE_PHASE7_IMPORT_7_1C_INVOICES.md
auditor: scope-auditor
audited_at: 2026-05-19T13:04:00+05:30
verdict: PASS
must_ship_gaps: 0
should_ship_gaps: 5
future_epic_recommendations: 1
---

# SCOPE Audit — Phase 7 #149 Slice 7.1C Invoices Import

## Verdict

**PASS.** Scope is dense, derivative of 7.1A/B (the right move), and addresses the parent's 10 focus areas with explicit decisions, tests, error codes, and copy. No MUST_SHIP gap. Architect may proceed. Five SHOULD_SHIP defects below — scope-writer should patch v1.1 in parallel with architect kickoff; none block the technical design.

## Must-ship gaps

None.

## Should-ship gaps

### S1: `HEADER_MISMATCH_WITHIN_INVOICE` and `PARTY_NAME_ONLY_MATCH` referenced but missing from `InvoiceIssueCode` union
- **What's missing:** §Multi-line aggregation (line 352) and §FK Resolution (line 304) emit these codes; acceptance criterion line 694 tests for `HEADER_MISMATCH_WITHIN_INVOICE`. Neither appears in the `InvoiceIssueCode` union at lines 200-211.
- **Failure mode:** Compile-time type hole — service code emits a string the FE union doesn't know; chip rendering falls through to default.
- **Recommended fix:** Add both codes to `InvoiceIssueCode` union in §API Contract. Specify severity (`HEADER_MISMATCH_WITHIN_INVOICE` = ERROR; `PARTY_NAME_ONLY_MATCH` = WARNING).
- **Severity:** SHOULD_SHIP

### S2: `clientVersion` minimum contradicts itself
- **What's missing:** Line 115 says `clientVersion >= 7.1.0`. Line 162 says `>=7.1.2`. Acceptance criterion line 704 tests `7.1.1 → 426`.
- **Failure mode:** Server reads one constant, FE polyfill targets another; cohort sees the entity picker but the upload 426s, or vice versa.
- **Recommended fix:** Pick `7.1.2` (matches the tests). Edit line 115 to match.
- **Severity:** SHOULD_SHIP

### S3: Negative line totals overload `AMOUNT_OUT_OF_RANGE`
- **What's missing:** Line 531 says negative `lineTotal` → ERROR `AMOUNT_OUT_OF_RANGE`. UX copy at line 512 says `Total too large — split into smaller invoices` — wrong message for a negative.
- **Failure mode:** User imports a refund row mis-classified as an invoice, gets "split into smaller invoices" copy, has no idea he should be using credit-note flow.
- **Recommended fix:** Split codes — `AMOUNT_OUT_OF_RANGE` (>Int max) and `AMOUNT_NEGATIVE` (sign violation), with separate copy steering the user to credit-note flow.
- **Severity:** SHOULD_SHIP

### S4: Multi-line aggregation phase ordering not explicit
- **What's missing:** §Multi-line aggregation describes the algorithm but doesn't pin **when** it runs in the pipeline. Aggregation happens during normalize, producing one `ImportJobRow` per invoice — but the scope leaves the reader to infer this.
- **Failure mode:** Architect or builder misreads and runs aggregation inside the commit chunk loop, recreating a race.
- **Recommended fix:** One sentence at top of §Multi-line aggregation: *"Aggregation runs in the normalize phase, before staging. Each `ImportJobRow` corresponds to one aggregated invoice, not one source row. Commit chunks are over aggregated rows; line splits across chunk boundaries are impossible by construction."*
- **Severity:** SHOULD_SHIP

### S5: `Document.type='SALE_INVOICE'` literal — no boot-time enum/constant assertion
- **What's missing:** SCOPE references the literal `'SALE_INVOICE'` in 6+ places. 7.1A/B established a pattern of boot-time pg_enum assertions for entity discriminators. SCOPE doesn't say whether `Document.type` is a pg_enum or freeform text, nor whether a boot assertion enforces `'SALE_INVOICE'` is a valid value at server start.
- **Failure mode:** If `Document.type` is a pg_enum and a future migration drops/renames the `SALE_INVOICE` variant, commits start failing at runtime instead of at boot. Silent drift.
- **Recommended fix:** Add one §Schema preconditions bullet: *"If `Document.type` is pg_enum-backed, add boot-time assertion in `src/lib/enum-guard.ts` (per 7.1A pattern) verifying `'SALE_INVOICE'` is a present variant. If it's freeform text, this is moot — document the choice."*
- **Severity:** SHOULD_SHIP

## Future-epic recommendations

### F1: Document.totalAmount BigInt widening
The Rs 2.14 crore Int cap is real ceiling pain for Amit-persona distributors with consolidated B2B invoices. Already deferred (Resolved Decision #10). Cross-cutting migration — correct deferral. No action.

## What the SCOPE got right

- **Reuse discipline.** "Inherits 7.1A verbatim" + diff-only structure keeps the SCOPE at 749 lines.
- **Hand-rolled date parser + 32-char cap + NFKC + ASCII-only digit check + 8-case test suite.** Strongest defense against the DoS surface the parent flagged.
- **Fly-create routed through canonical `createParty()`** + integration test asserting duplicate-phone guard fires.
- **Commit-blocked sentinel on PRODUCT_NOT_FOUND** with per-invoice granularity.
- **No StockMovement / no PaymentAllocation / no DocumentNumberSeries advancement** — three correct "do nothing" decisions.
- **Per-row tx, not per-chunk tx** — smaller blast radius. Mid-tx crash test verifies it.
- **Tax math kept as-imported, never auto-corrected.** Source-of-record fidelity.

Verdict: **PASS** — proceed to architect. SHOULD_SHIP S1-S5 should be patched as v1.1 in parallel; not blocking.
