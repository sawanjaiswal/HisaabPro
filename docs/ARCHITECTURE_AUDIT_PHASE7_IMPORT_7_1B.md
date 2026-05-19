---
audit_of: ARCHITECTURE_PHASE7_IMPORT_7_1B.md
scope_ref: SCOPE_PHASE7_IMPORT_7_1B_PRODUCTS.md (v2)
scope_audit_ref: SCOPE_AUDIT_PHASE7_IMPORT_7_1B_PRODUCTS.md (PASS_v2)
auditor: architecture-auditor
audited_at: 2026-05-19T10:51:00+05:30
verdict: PASS
must_ship_gaps: 0
should_ship_gaps: 3
future_epic_recommendations: 2
scope_conformance_breaks: 0
---

# Architecture Audit — Phase 7 #149 · 7.1B Products Import

## Verdict

**PASS.** Architecture maps every SCOPE v2 MUST_SHIP decision to a concrete
file, SQL block, or middleware site. Migration ordering is correct
(expand→backfill→contract, partial-unique split into its own file,
`CONCURRENTLY` isolated in a `prisma:no-transaction` migration). Idempotency
contract is reproduced verbatim and reinforced with a pathology table.
Every dedup SQL site carries the `WHERE businessId = $1` predicate and is
backed by a composite GIN that fails loudly on a missing tenant filter.
Money is BigInt(paise) end-to-end with `parseFloat` explicitly forbidden in
the price path. The one DEVIATED row (SCOPE L610 `?importJobId=` filter) is
documented and defensible — 5 LOC change to an existing route, no new file.

No MUST_SHIP gaps. Three SHOULD_SHIP gaps below are advisory and do not
block advance to backend build.

---

## SCOPE Conformance Map

Architect's own conformance table (lines 677-727) is faithful. Spot-checks:

| SCOPE Acceptance row | Architecture artifact | Status |
|---|---|---|
| `entity='product'` accepted (L634) | §3 Zod additions + File Plan #27 | OK |
| 4 fixture upload (L635) | File Plan #30-33 + §10 parser unit | OK |
| `MAPPING_REQUIRED` for generic w/o mapping (L636) | §5 generic-csv branch | OK |
| Auto-detected mapping (L637) | FE File Plan #44 `useColumnAutodetect` (Note: arch §9 still cites `useColumnAutodetect` but it's not a File Plan row — see SHOULD_SHIP #1) | DEVIATED |
| `UNIT_NOT_FOUND` w/ inline action (L638) | §6 unit-resolver + File Plan #46 UnitNotFoundAction | OK |
| Devanagari unit (L639) | §6 + File Plan #11 + §10 test 8 | OK |
| `TAX_RATE_FALLBACK` (L640) | §6 tax-resolver + File Plan #12 | OK |
| Negative opening stock ERROR (L641) | §6 product-normalizer | OK |
| `"9999999999999"` regex reject (L642) | §1 PRICE_REGEX + §6 toPaiseBigInt + §10 test 7 | OK |
| `"90071992547409.92"` BigInt safety-net (L643) | §6 PRICE_MAX_PAISE check | OK |
| `"1.2345"` precision-lost warning (L644) | §6 + ProductIssueCode union | OK |
| Product+StockMovement w/ importJobId+importJobRowId (L645) | §8.1 statement order steps 1-2 | OK |
| Mid-chunk crash test (L646) | §10 test 3 | OK |
| Cross-tenant trgm test (L647) | §10 test 2 incl. debug-build companion | OK |
| `products.imported` per product (L648) | §8.1 step 4 + File Plan #26 + #29 | OK |
| Double-POST commit (L649) | §3 M3 + §8.2 pathology row 1 | OK |
| Stale commitToken 409 (L650) | §3 M3 + §8.2 pathology row 2 | OK |
| Active-job cross-entity 409 (L651) | §3 active-job paragraph | OK |
| Cross-business 404 (L652) | §10 test 9 | OK |
| Auth gates (L653) | §3 middleware chain inherited | OK |
| 426 UPGRADE_REQUIRED (L654) | §3 inherited `requireMinClientVersion('7.1.0')` | OK |
| Malicious XXE/zip-bomb (L655) | §5 reused pre-scans | OK |
| Re-upload `previouslyUploadedAt` (L656) | Inherited from 7.1A; not re-stated | OK |
| Cleanup cron NULLs raw/normalized, preserves Product+SM (L657) | §10 test 11 + Failure-Mode #3 | OK |
| DPDP no-op on products (L658) | §10 test 10 | OK |
| Error CSV CSV-injection (L659) | 7.1A M4 inherited verbatim | OK |
| `enforce-audit-coverage.mjs --block` (L660) | File Plan #29 | OK |
| Migration C CONCURRENTLY + no-transaction (L661) | §4 Migration C + §10 shadow-DB step | OK |
| 7.1A parties dual-write (L662) | §8 PR1 + File Plan #22 commit-parties | OK |
| No raw fetch in import FE (L663) | §9 offline contract | OK |
| FE mutations `entityType/entityLabel/excludeFromOfflineQueue` (L664) | §9 + File Plan #42 | OK |
| Airplane-mode no-IDB-queue (L665) | §9 `excludeFromOfflineQueue:true` | OK |
| en+hi translations (L666) | File Plan #53, #54 | OK |
| 4-state screenshots (L667) | §10 acceptance gate inherits 7.1A §17 | OK |
| 320px no overflow (L668) | §9 + File Plan #52 | OK |
| tsc + enforce + enforce-offline clean (L669) | §10 acceptance | OK |

**Scope conformance breaks: 0.** The one row marked DEVIATED is the
`useColumnAutodetect` hook — see SHOULD_SHIP #1. It is an under-specification,
not a contradiction.

---

## Must-ship gaps

**None.** Every SCOPE v2 MUST_SHIP decision is bound to an architecture
artifact. The four highest-risk areas (column rename, StockMovement
idempotency, trgm tenant scope, CONCURRENTLY) all have correct migration
ordering, correct SQL, correct test sites.

Specific correctness checks (all pass):

1. **Migration ordering** — Migration 0 (enum) → A (expand + backfill in
   tx) → B (partial unique in tx) → C (CONCURRENTLY out of tx). Order is
   correct; DROP COLUMN deferred to PR-followup. `prisma:no-transaction`
   directive is on **line 1** of Migrations 0 and C (required by Prisma's
   parser). ✓
2. **Partial UNIQUE on StockMovement(importJobRowId)** — split into its
   own Migration B file. Correctly partial (`WHERE importJobRowId IS NOT
   NULL`) so existing non-import StockMovements aren't constrained. ✓
3. **CONCURRENTLY** — Migration C creates composite GIN
   `(businessId, name gin_trgm_ops)` outside a transaction, with
   `CREATE EXTENSION IF NOT EXISTS pg_trgm` guard. ✓
4. **Idempotency-on-retry contract** — §8.1 reproduces SCOPE L258-269
   verbatim: pre-scan STAGED → INSERT Product RETURNING → INSERT
   StockMovement ON CONFLICT DO NOTHING → UPDATE ImportJobRow guarded by
   `status='STAGED' AND createdEntityId IS NULL`. Single-tx, no savepoints,
   chunk size 500. Pathology table §8.2 covers all six retry modes
   (mid-tx crash, post-SM-pre-update crash, post-commit-pre-response,
   double-commit, stale token, concurrent commits). ✓
5. **Cross-tenant scoping** — every dedup query in §7 explicitly carries
   `WHERE p.businessId = $1`. Composite GIN forces the planner to seq-scan
   on a missing tenant filter (loud failure). §10 test 2 has a debug-build
   companion that asserts the test fails when the predicate is removed —
   proving the filter is load-bearing. ✓
6. **Money-as-BigInt invariant** — `parseFloat` forbidden in money path
   (only allowed on GST rate, explicitly called out §6). `NormalizedProduct
   .{salePrice,purchasePrice,mrp}` typed `bigint`. JSON serialization via
   `String(b)`. FE `BigInt(str)` for arithmetic. `Number()` only inside
   `formatCurrency()` where regex bounds keep us inside MAX_SAFE_INTEGER. ✓
7. **`OPENING_BALANCE` enum precondition** — Migration 0 is conditional,
   architect verifies via `\dT+` before generating PR2. `ADD VALUE IF NOT
   EXISTS` is idempotent. ✓
8. **`StockMovement.quantity` Decimal(18,3) precondition** — asserted in
   §Schema preconditions (architect-side, not a new migration). Architect
   judgement call is documented as an Open Question. ✓
9. **`ProductIssueCode` union** — `PRICE_PRECISION_LOST` present (§1) and
   rendered as a chip on `ProductRowCard.tsx` (File Plan #45 + §9). ✓

---

## Should-ship gaps (advisory, not blocking)

### SS1 — `useColumnAutodetect` hook not in File Plan

§9 and §3 both reference `useColumnAutodetect` as the auto-detect site for
generic CSV product column mapping (SCOPE L48, L73). The FE File Plan (#40-54)
lists `import.service.ts` and `import.types.ts` edits but no hook row. The
existing hook from 7.1A presumably gains a product header dictionary, but
the architecture should either:

- Add an explicit row "`src/features/import/useColumnAutodetect.ts` edit ~30L
  add product header dictionary" — mirrors the SCOPE File Plan row #32, OR
- Document inline (one line under §9) that the hook is edited in-place with
  a ~20L diff and is too small for a File Plan row.

Currently the SCOPE has it as row #32 but the ARCHITECTURE File Plan drops
it without noting why. Trivial 5-min fix; build agent will notice.

**Recommended fix:** Insert a row #43.5 in FE File Plan
(`src/features/import/hooks/useColumnAutodetect.ts` edit ~30L hook).

### SS2 — Migration D follow-up not pinned to a release window

§4 names Migration D (DROP `createdPartyId`) and PR1 §11 calls it
"`PR-followup` — a release later". "A release later" is hand-wavy when the
expand→backfill→contract guarantee depends on the contract phase actually
landing. Without a tracked issue/milestone, the dual-write code in
`commit-parties.service.ts` will hang around for months.

**Recommended fix:** Add to §11 — "Open follow-up issue
`#149-followup-drop-createdPartyId` at PR2 merge with target window = first
release ≥7d after PR6 prod rollout completes." Or land Migration D in PR7
with an explicit "must merge ≥1 deploy after PR6" gate.

### SS3 — Mid-chunk crash test mechanism not specified

§10 test 3 says "kill `pg` connection after row 250's Product INSERT,
before its StockMovement INSERT". The how isn't pinned. Options:

- Postgres `pg_terminate_backend` from a side channel
- A test-only `THROW_AFTER_PRODUCT_INSERT` env hook in `commit-products.service.ts`
- jest mock on `tx.stockMovement.createMany`

The first is realistic but flaky; the second adds production code paths
gated by env; the third doesn't actually exercise the rollback. Build agent
will pick one and you may not like the choice.

**Recommended fix:** §10 names the mechanism explicitly. Recommended:
`pg_terminate_backend` against the test session's pg pid, captured by
postgres-test-utils. Document the flake-recovery (re-run once, fail on
second).

---

## Future-epic recommendations

### FE1 — Test fixture binary commit (busy-sample.xlsx)

File Plan #32 commits a `.xlsx` binary to git. Worth a one-line note that
the fixture is generated from a check-in `.script` (or json source) rather
than a binary that drifts silently. Not blocking; can be retrofitted.

### FE2 — Unit alias map as DB table

Already in SCOPE Out-of-Scope (L603) and architect notes 50-entry constant
is the current SSOT. Promote when the alias set exceeds 100 entries or
when pilot data shows ≥3 unique misses/week.

---

## What the architecture got right

- **File Plan is exhaustive** (54 rows; every estimate ≤ 250L). Largest
  file (integration test) capped at 250L exactly.
- **`commit.service.ts` split is in PR1, before any product code lands** —
  reviewable in isolation; 7.1A tests pass unchanged.
- **PR sequence (6 + 1 follow-up)** is sized for ≤30min review each. PR1
  ships with `if ('createdEntityId' in fields)` runtime guard so it's safe
  to deploy alone before PR2 lands the column.
- **Failure-Mode table** correctly extends 7.1A §16 with the new
  cross-tenant trgm vector (#7) and StockMovement permanent-ledger note
  (#3).
- **Pathology table §8.2** is the kind of table that catches bugs at
  review time. Six retry modes × concrete defence each.
- **Tenant-scope load-bearing test** — §10 test 2's "remove the filter,
  assert this test fails" companion is the right paranoia.
- **Architect Open Questions §** explicitly flags the two judgement
  calls (conditional Migration 0; PR1-before-PR2) so reviewers don't have
  to infer them.
- **SCOPE Conformance Map (§Conformance)** with one explicit DEVIATED row
  + rationale is honest reporting, not theatre.

---

## Cross-session learnings applied

From `SCOPE_AUDIT_PHASE7_IMPORT_7_1B_PRODUCTS.md` "learnings to record"
section, all six were verified against the architecture:

| Learning | Architecture check | Result |
|---|---|---|
| Column-rename = expand→backfill→contract across ≥2 migrations | Migration A this slice + D follow-up PR | OK |
| Trigram queries need tenant predicate + composite index | §7 + Migration C composite GIN | OK |
| `CREATE INDEX` on shipped tables must be `CONCURRENTLY` in `prisma:no-transaction` | Migration C line 1 directive | OK |
| Money normalization regex-validates raw string before any numeric conversion | §6 toPaiseBigInt + §1 PRICE_REGEX | OK |
| Idempotency for fan-out inserts needs partial UNIQUE + ON CONFLICT + single-tx no-savepoints + retry pre-scan + documented statement order | Migration B + §8.1 statement-order block + §8.2 pathology | OK |
| Schema preconditions (enum values, column types) must be asserted in SCOPE, not assumed | §Schema preconditions §4 Migration 0 conditional | OK |

No new architecture blindspot found in this audit. No append to
`~/.claude/learnings/architecture-blindspots-*.md` required.

---

## Blocking action

**None. Architecture advances to backend build (API.0).**

SS1-SS3 are advisory. Recommend the architect spend ~10 min adding the
`useColumnAutodetect` row, pinning Migration D's release window, and
naming the mid-chunk-crash mechanism, then ship. Build agent can absorb
all three on the fly if not done.

**[10:51 AM]**
