---
audit_of: SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md
auditor: scope-auditor
audited_at: 2026-05-19T15:42:00Z
audit_version: v2
verdict: PASS_v2
must_ship_gaps: 0
should_ship_gaps: 0
future_epic_recommendations: 2
---

# SCOPE Audit v2 — Phase 7 #149 · 7.1D Payments Import

## Verdict

**PASS_v2 — Cleared for architect.**

All 3 prior MUST_SHIP gaps and all 4 prior SHOULD_SHIP gaps are fully
closed in the revision (not merely acknowledged). Verification below.

---

## Closure verification

### MUST_SHIP #1 — Intra-chunk sequential allocation — CLOSED

- §4 row #26 declares "Intra-chunk allocation is SEQUENTIAL — `for…of`,
  NEVER `Promise.all`".
- §9 pseudo-code (line 450) shows `for (const row of chunk)` with a code
  comment "SEQUENTIAL — never Promise.all".
- File Plan row #15 (`commit-payments.service.ts`) explicitly notes "CI
  lint asserts no `Promise.all` in this file" — mechanical enforcement,
  not just prose.
- §11 acceptance: 50-row→1-invoice fixture asserts "first-N succeed,
  remainder ERROR `OVER_ALLOCATION`; NEVER all-pass" (line 636, 812).
- §EdgeCases line 812 reiterates the invariant.

Sequential serialisation + `SELECT FOR UPDATE` correctly closes both
inter-job AND intra-chunk races. Defect class eliminated.

### MUST_SHIP #2 — P2002 → ALLOCATION_INTERNAL_CONFLICT distinct from OVER_ALLOCATION — CLOSED

- §4 row #27 forces non-collapse: "The two MUST NOT be collapsed".
- §6 error-code union (lines 280-281) carries both codes with explicit
  4xx vs 5xx routing and inline rationale.
- §6 catch-block snippet (lines 290-292) shows the exact mapping:
  `if (e.code === 'P2002' && e.meta.target.includes('paymentId_invoiceId'))
  throw new ImportError('ALLOCATION_INTERNAL_CONFLICT', 500)`.
- §11 acceptance "Σ-guard vs P2002 distinction" (line 637) synthesises
  a P2002 by code path and asserts 500 response + Sentry alert, NOT 4xx.
- 500 response envelope shown (line 357-361).

Observability preserved; real bugs surface as 5xx + Sentry, not silent
4xx.

### MUST_SHIP #3 — Reference tail-truncation — CLOSED

- §4 row #25 mandates "truncate the LAST 100 chars (Razorpay/cheque-
  serial pattern — uniqueness lives in the tail)".
- Constants row #4 in File Plan declares
  `REFERENCE_TRUNCATE_FROM='tail'` as a SSOT.
- §11 acceptance includes a 150-char Razorpay-style ref test asserting
  "stored value is the LAST 100 chars (uniqueness tail preserved)"
  (line 607-608) plus a discriminating-test (line 807): two refs that
  differ only in the last digit at >100 chars must store as DISTINCT
  values.
- UI copy (line 530, 563) names "last 100 chars" so users understand
  the serial-preserving behaviour.

Reconciliation collisions eliminated.

### SHOULD_SHIP #4 — NFKC + lowercase + trim + ws-collapse on mode lookup — CLOSED

§4 row #4, row #19, line 406, line 798, line 847 all consistently
specify the four-step normalisation pipeline and confirm Devanagari
fixtures (`नकद`, `यूपीआई`, `बैंक A/c`) in the seed dictionary. Fixture
files (rows #22, #23, #25) include Devanagari rows.

### SHOULD_SHIP #5 — `strictMode` opt-in — CLOSED

§4 row #13 adds `?strictMode=true`. Zod schema row #5, route row #18,
error code `MODE_UNKNOWN_STRICT` (line 283), §11 acceptance line 604,
useCommitBlockSentinel coverage (FE row #31), and translations row #39
all carry the flag through. End-to-end coverage clean.

### SHOULD_SHIP #6 — Tally 8-digit `YYYYMMDD` pre-format — CLOSED

§4 row #28 mandates parser-adapter pre-format `/^\d{8}$/`. §8 (line 412)
reiterates. §11 acceptance line 586 asserts `DATE="20250315"` →
`Payment.date = 2025-03-15`. Tally fixture row #22 includes the case.

### SHOULD_SHIP #7 — Busy XLSX `cellDates: true` — CLOSED

§4 row #29 + line 434 + File Plan row #13 all specify
`{ cellDates: true, dateNF: 'yyyy-mm-dd' }`. Edge-case line 800 and §11
line 580 cover Excel serial `45291` → ISO conversion.

---

## What the SCOPE got right (preserve)

- Schema-derived paid-state correction (no `Document.amountReceived`).
- Two-tier error semantics (4xx Σ-guard vs 5xx P2002) is now textbook.
- CI-asserted "no `Promise.all` in commit-payments" — mechanical, not
  hopeful.
- Tail-truncation rationale tied to Razorpay/cheque-serial reality, not
  abstract uniqueness theory.
- Devanagari coverage end-to-end through fixtures + dictionary + UI.

## Future-epic recommendations (unchanged from v1)

- Partial allocation with residual advance — deferred §12, documented.
- Allocation recompute job — not needed; derivation is its own SSOT.

## Cross-session learnings written

Logging the intra-chunk-parallelism blindspot to
`~/.claude/learnings/scope-writer-blindspots-2026-05-19.md` under
`data-import/concurrency` for future scope-writer + auditor runs.

---

**Cleared for architect.**
