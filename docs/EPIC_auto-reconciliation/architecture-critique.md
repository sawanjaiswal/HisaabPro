verdict: PASS

# Architecture Critique — #147 Auto-reconciliation (absorbs #89) — REV 2

Re-audited: 2026-05-28 · auditor: architecture-auditor · plan:
`.claude/design-plan-active--auto-reconciliation--bare-143115.md`
Supersedes rev-1 (REVISE, 3 MUST_FIX).

## Verdict rationale

All three rev-1 MUST_FIX items are genuinely resolved, verified against the
live schema and the existing GSTR-1 subsystem — not just reworded. The two
relevant SHOULD_FIX carry-overs (isDeleted filter, PAYROLL direction mapping)
are now in the query/engine spec. No new blocking issue exists. Verdict: PASS.

## Rev-1 MUST_FIX resolution check

| # | Rev-1 finding | Resolved? | Evidence |
|---|---------------|-----------|----------|
| 1 | Namespace collision with GSTR-1 `reconciliation` | **YES** | Verified: existing subsystem is `server/src/services/reconciliation/{index,matching.engine,queries,helpers}.ts`, `server/src/routes/reconciliation.ts`, `server/src/schemas/reconciliation.schemas.ts`, FE `src/features/gst-reconciliation/`. The revised `files_planned` and file-plan table use `bank-reconciliation` for EVERY server + FE path (service dir, schema, route, mount `/api/bank-reconciliation`, FE feature dir). Grep of `files_planned` shows zero non-bank `reconciliation.` paths. The `add_reconciliation` migration name is a DB label, not a file path — no collision. Clean. |
| 2 | Unbounded candidate pool / N+1 | **YES** | Plan §A-M2 now states the explicit single `prisma.payment.findMany` over `[min(txnDate)-14d, max(txnDate)+14d]`, filtered `businessId` + `isDeleted:false` + `id notIn <already-reconciled in window>`, `orderBy id asc`, `take: 5000` hard ceiling with a `poolTruncated` flag surfaced to the UI. Worst-case in-memory scoring is bounded 2000 × 5000. The query is index-backed: `@@index([businessId, type, isDeleted, date])` and `@@index([businessId, date])` both exist on Payment. Sound. |
| 3 | Non-deterministic tie-break | **YES** | Engine is now a pure `(lines, candidatePayments) => suggestions` — no DB, no clock. Pool pre-sorted `id asc` by the service before the call so Prisma's unstable order can't leak in. Ties broken by (1) smaller absolute date delta, then (2) `payment.id` asc, asserted in `match-engine.test.ts`. Total order is well-defined and testable. Sound. |

## Rev-1 SHOULD_FIX resolution check

| # | Rev-1 finding | Status |
|---|---------------|--------|
| 6 | `isDeleted:false` missing from candidate filter | **RESOLVED** — now explicit in the A-M2 query `where`. |
| 7 | PAYROLL_IN/OUT direction mapping omitted | **RESOLVED** — `scoreCandidate` now maps CREDIT ↔ PAYMENT_IN + PAYROLL_IN, DEBIT ↔ PAYMENT_OUT + PAYROLL_OUT; mismatch disqualifies. Matches the 4-value `Payment.type` String (PAYMENT_IN/OUT, PAYROLL_IN/OUT). |
| 4 | Re-upload dedupe | **ADEQUATE** — Q4: content-hash (bankAccountId+txnDate+amount+ref) soft-warning count, not a hard block; each import is its own batch; already-reconciled payments excluded so re-upload lines find no fresh matches. Correctly scoped as a soft v1 mitigation; no ledger-corruption path since reconciliation never mutates Payment rows. |
| 5 | `confidence Int` rationale cargo-culted | NON-BLOCKING — score is integer-by-construction (sum of integer band awards), so Int is exact. Cosmetic; not held. |

## Residual notes (non-blocking, carry to build/follow-up)

| Tier | Finding |
|------|---------|
| SHOULD_FIX | **Dangling match on later soft-delete.** A matched Payment soft-deleted *after* reconciliation leaves a `ReconciliationMatch` pointing at an `isDeleted` payment (the candidate filter only guards match *time*). `onDelete: Restrict` won't fire because Payment uses soft-delete. The review UI should surface "matched payment was deleted" on the matched tab. Not ledger-corrupting; resolve in FE build. |
| FUTURE_EPIC | "Create Payment from unmatched line" write-back is a ledger mutation — re-triggers scope-writer→architect→security. Correctly deferred. |
| FUTURE_EPIC | Expense matching (Expense also has `bankAccountId`) — design `scoreCandidate` generic over `{amount,date,direction,ref}` so v2 doesn't fork the engine. Correctly deferred. |

## Preserved strengths

- Additive create-table-only migration; instantly reversible by dropping three
  tables + back-relation fields. No backfill, no NOT-NULL retrofit, no lock on
  the hot Payment table. Verified against schema.
- Money discipline intact: `amount Int` paise, `confidence Int`, no float
  anywhere; v1 never mutates a Payment/ledger row — a bad match can only
  annotate the join table.
- Line-side `@unique` with documented payment-side non-unique rationale.
- S-M1..M6 security cuts integrated (businessId stamped from token + non-empty
  assert, TOCTOU re-scope in both lookup and mutation `where`, strict Zod +
  field allowlist, P2002→409 idempotency via `lineId @unique`, PII never logged).
- File plan: all rows ≤250 lines, 6-layer split honored, pure engine isolated
  and unit-tested.

## Gate

`must_ship_gaps = 0` · `scope_conformance_breaks = 0` · file plan + migration
sequence + dependency layering present. PASS.
