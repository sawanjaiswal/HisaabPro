---
audit_of: ARCHITECTURE_PHASE7_IMPORT_7_1D.md
scope_ref: SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md (v2 PASS)
auditor: architecture-auditor
audited_at: 2026-05-19T16:02:00+05:30
verdict: PASS_v2
must_ship_gaps: 0
should_ship_gaps: 0
future_epic_recommendations: 1
scope_conformance_breaks: 0
revision: v2 (re-audit of v1 BLOCK — 2 MUST_SHIP + 3 SHOULD_SHIP)
---

# Architecture Audit v2 — Phase 7 #149 · Slice 7.1D · Payments Import

## Verdict

**PASS_v2.** All 5 prior gaps closed with verifiable artifacts (not just
acknowledgement). Architect cleared to begin Build PR sequence
(PR-D0 → PR-D5).

## Gap closure verification

### M1 — Σ-check BEFORE Payment INSERT, row-local continue (CLOSED)

ARCH §2.6 header (L201) explicitly tagged "v2: Σ-check BEFORE INSERT".
Re-ordered §6 per-row steps verified:
- L565 step 3a: SELECT FOR UPDATE Document
- L576-583 step 3b: Σ EXISTING (JOIN Payment for soft-delete filter)
- L585-595 step 3c: Σ-GUARD with `markRowError(OVER_ALLOCATION) + continue`
  — no throw, no chunk rollback
- L597-614 step 3d: INSERT Payment (only after guard passes)
- L616-633 step 3e: INSERT PaymentAllocation + P2002 catch
- L638-643 step 4: `committedRowCount++` only on full pass; Σ-skip rows
  DO NOT increment (comment explicit at L642-643)
- §2.6 code block L238-273 mirrors the same ordering at code level
- v2 step-order diagram L676-710 visualises the flow
- §13 Open Q #3 resolved/removed (changelog F1 at L1064)

Internal contradiction in v1 (throw at L546 vs continue at L532-538)
eliminated. Row-local continue now matches race-skip pattern.

### M2 — Integration test #4 expected output (CLOSED)

ARCH §11 row 3 (L733) rewritten with concrete fixture: 50 receipts × Rs 250
→ Document grandTotal Rs 10k. Asserts split 40 COMMITTED + 10
OVER_ALLOCATION continue, end-state `committedRowCount = 40`, 1 batched
audit row with `paymentIds.length = 40`, no chunk rollback. PR-D3 table
L914 carries the v2 expected output. Conformance Map L986, L1006, L1021,
L1032, L1033 all updated. Changelog F2 (L1065) cites File Plan #35 fixture
update.

### S1 — CI lint glob broadened (CLOSED)

L355-356, L382-384, L1021: lint now asserts no `Promise.all` "across the
entire `commit-payments/` directory" — directory glob, not single file.
PR-D3 row L914 reiterates "v2 CI lint asserts no `Promise.all` anywhere
under `commit-payments/`". Refactor-resistant.

### S2 — P2002 discriminator robust + dual-shape unit test (CLOSED)

§2.6 code L260-263 + §6 step 3e L622-625 use dual-shape discriminator
`key === 'PaymentAllocation_paymentId_invoiceId_key' || (key.includes('paymentId') && key.includes('invoiceId'))`.
Distinct P2002 targets explicitly enumerated at L457-458 (`Payment.offlineId`
@unique line 1272, `Payment.reversesPaymentId` @unique lines 1296-1298) —
fallthrough `throw e` at L631 routes those to system-bug path. File Plan
row 42b (referenced L839, L914) adds the v2 P2002 dual-shape unit test.

### S3 — Tail-truncation collision comment (CLOSED)

§2.4 L150-153 carries the comment: "tail-100 truncation can collide if two
refs share trailing 100 chars… would 500-error legitimate distinct
truncated refs. See AUDIT S3 (closed v2) + §13 Deviation #3." Prevents
future builder from adding `@@unique([businessId, referenceNumber])`.

## SCOPE Conformance Map

Unchanged from v1 — 49 rows, all OK. v2 edits preserved every prior row
and added M1/M2/S1 cross-references (L1032, L1033, L1037).

## What got right (v2 additions)

- v2 ordering rationale block (L710+) explains "why before, not after"
- §6 step-order ASCII diagram (L676-710) — visual safety net
- Changelog block F1/F2 (L1064-1065) makes the diff auditable
- File Plan #35 fixture spec aligned with test #4 rewrite
- Dead throw-text removed (no zombie references to old pattern)

## Future-epic

F1 — `Payment.referenceFingerprint` SHA256 column for collision-proof
dedup if reconciliation grows. Carried from v1; not blocking.

## Decision

**PASS_v2. Architect cleared to begin Build PR sequence (PR-D0 → PR-D5).**

No MUST_SHIP gaps. No SHOULD_SHIP gaps. No SCOPE conformance breaks. The
architecture is internally consistent, every SCOPE decision maps to a
concrete artifact with cited line numbers, and the v1 blockers are closed
with implementation-grade specifics (ordering, fixture, glob, dual-shape
catch, collision comment) — not papered over.
