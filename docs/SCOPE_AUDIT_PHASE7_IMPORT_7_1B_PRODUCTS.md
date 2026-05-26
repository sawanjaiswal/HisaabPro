---
audit_of: SCOPE_PHASE7_IMPORT_7_1B_PRODUCTS.md
auditor: scope-auditor
audited_at: 2026-05-19T09:32:03+0530
reaudited_at: 2026-05-19T12:47:00+0530
verdict: PASS_v2
verdict_v1: BLOCK
must_ship_gaps: 0
must_ship_gaps_v1: 8
should_ship_gaps: 7
future_epic_recommendations: 3
---

# SCOPE Audit — Phase 7 #149 · 7.1B Products Import

## Verdict (v2 re-audit, 2026-05-19)

**PASS_v2.** All 8 MUST_SHIP gaps from the v1 audit are closed with
concrete contract, SQL, and test additions — not hand-waving. The PRD
now meets the bar to advance to architect.

### v2 gap closure verification

| # | Gap (v1) | v2 closure evidence | Status |
|---|----------|---------------------|--------|
| 1 | Rename `createdPartyId` → `createdEntityId` lacked zero-downtime ordering | Resolved Decisions #14 + #15; §Data Model expand→backfill→contract across Migrations A (this slice, additive + backfill) and B (follow-up PR, DROP); 7.1A dual-writes both columns during overlap; `ImportJob.createdPartyIds` JSON kept via Prisma `@map` (no SQL rename); Risks #2; Acceptance row added | CLOSED |
| 2 | StockMovement insert had no explicit idempotency predicate | New §Idempotency section; partial UNIQUE `unique_stock_movement_import_row ON (importJobRowId) WHERE importJobRowId IS NOT NULL` (Migration B); `ON CONFLICT (importJobRowId) DO NOTHING`; documented statement order (Product RETURNING id → StockMovement ON CONFLICT → ImportJobRow UPDATE guard); single-tx, no savepoints; pre-scan on retry; mid-chunk-crash integration test in Acceptance + Test Infrastructure | CLOSED |
| 3 | Trigram dedup had no documented tenant scope | New §Dedup section with explicit `WHERE p.businessId = $1`; composite GIN `(business_id, name gin_trgm_ops)` in Migration C; cross-tenant isolation integration test; Failure Mode #7 + Security §Cross-tenant isolation + Risks #6 | CLOSED |
| 4 | GIN trgm index created without `CONCURRENTLY` | Migration C is a separate file with `-- prisma:no-transaction` directive on line 1; rationale documented in §Data Model and §Migrations; Acceptance row + Risks #7 | CLOSED |
| 5 | Price overflow guard validated post-parseFloat value | New §Price normalization section; `parseFloat` forbidden in money path; regex `^\d{1,12}(\.\d{0,2})?$` pre-validates raw string; BigInt-only arithmetic; 7-row boundary test suite (MAX_SAFE_INTEGER boundary, 12-digit max, 13-digit reject, comma-stripping, `"1.2345"` precision-lost, `"abc"`); new pure utils file `price.util.ts`; `NormalizedProduct.salePrice/purchasePrice/mrp` typed `bigint`; CLAUDE.md "no floating point money" preserved; Risks #8 | CLOSED |
| 6 | Unit-alias map was anglocentric, case-sensitive, lossy | New §Unit alias resolution section; pipeline `NFKC → trim → case-fold → strip trailing '.' → collapse whitespace → lookup`; alias map expanded to ~50 entries with devanagari (नग, किलो, किग्रा, ग्राम, लीटर, मीटर), plurals (pieces, kilograms, litres/liters, kilos, grams, meters/metres), US spellings, casings (`"PCS"`, `"Pcs."`, `"Pcs "`); `"no"` deliberately excluded with documented rationale; unit-alias integration test suite; Resolved Decisions #17 | CLOSED |
| 7 | `OPENING_BALANCE` enum + StockMovement schema preconditions unverified | New §Schema preconditions block (§Data Model §schema-prereq); explicitly asserts `StockMovementType` contains `OPENING_BALANCE` (separate `prisma:no-transaction` migration if absent); asserts `StockMovement.quantity` is `Decimal(18,3)` (NOT Float/Int); lists required columns `(id, businessId, productId, quantity, type, importJobId?, importJobRowId?, sourceIndex?, createdAt)`; FK semantics documented; Risks #9 | CLOSED |
| 8 | `ProductIssueCode` union missing `PRICE_PRECISION_LOST` | Added to union in §API Contract; surfaced in §UX Copy (warning copy), §Edge Cases (warning row), §Acceptance (`"1.2345"` test row), FE types file (File Plan #29 + #37 ProductRowCard renders chip) | CLOSED |

Failure Mode Walkthrough section is present (inherits 7.1A 1-7 with
product-specific additions to #3, #5, #6, #7). Template requirement met.

## Must-ship gaps (v2)

None. All 8 v1 gaps closed.

## Should-ship gaps (carried forward from v1, unaddressed in v2)

Author's accept/defer rationale is recorded in §Revision Log (S1-S7).
Reviewed and acceptable as follow-ups — none introduces a correctness
or security regression that the MUST_SHIP fixes don't already neutralise.
See v1 audit body above the verdict line for the original gap text if a
later revision wants to re-promote any of them.

## Cross-session learnings to record

Append the following to `~/.claude/learnings/scope-writer-blindspots-2026-05-19.md`
under a new "data-import" domain section so 7.1C/D/E inherit:

- Column-rename in any shipped table requires expand→backfill→contract
  across ≥2 migrations; never single-shot.
- Trigram (or any similarity) queries in multi-tenant schemas must
  carry the tenant predicate AND be backed by a composite index that
  forces the planner to fail loudly on a missing filter.
- `CREATE INDEX` on shipped tables must be `CONCURRENTLY` in a
  `prisma:no-transaction` migration; standard `CREATE INDEX` is a
  production-freeze waiting to happen.
- Money normalization regex-validates the raw string BEFORE any
  numeric conversion; `parseFloat` is forbidden in the path.
- Idempotency for fan-out inserts (Product + StockMovement) needs a
  partial UNIQUE on the source-row anchor + ON CONFLICT DO NOTHING +
  single-tx no-savepoints + retry pre-scan; documenting the statement
  order in the SCOPE prevents architect drift.
- Schema preconditions (enum values, column types) must be asserted in
  the SCOPE, not assumed; missing enum value = first-deploy failure.

---

## v1 audit (preserved for reference)

The original v1 audit body — 8 MUST_SHIP gaps with full reasoning, 7
SHOULD_SHIP gaps, 3 FUTURE_EPIC recommendations, and "what the SCOPE
got right" — is preserved below for traceability.

### v1 verdict

**BLOCK.** Eight MUST_SHIP gaps. The rename migration, the `StockMovement`
retry-idempotency contract, trigram cross-tenant scoping, and trigram index
creation under load are all under-specified or wrong. Each one is a
month-6 production incident waiting to happen.

### v1 must-ship gaps (now all closed in v2 — see verification table above)

1. Rename of `ImportJobRow.createdPartyId` → `createdEntityId` has no zero-downtime ordering plan
2. StockMovement insertion is not gated by an explicit idempotency predicate
3. Trigram dedup query has no documented tenant scope
4. GIN trgm index created without `CONCURRENTLY` — table lock on production-sized Product tables
5. Price overflow guard validates the wrong value (post-parseFloat)
6. Unit-alias map is anglocentric, case-sensitive, and lossy
7. `OPENING_BALANCE` StockMovement type and StockMovement schema preconditions are unverified
8. `ProductIssueCode` union is incomplete relative to Edge Cases table

### v1 should-ship gaps (S1-S7, carried forward; see Revision Log for accept/defer)

- S1: Trigram query performance on >100k product catalogs unmeasured
- S2: FE preview state lost on "Create unit" deep-link round-trip
- S3: Bulk-delete-by-importJobId blocks if products are referenced by invoices
- S4: `currentStock` Float arithmetic compounds across imports
- S5: Audit-row volume from `products.imported` not bounded
- S6: SKU dedup case-sensitivity unspecified
- S7: DudhHisaab reuse-check evidence missing

### v1 future-epic recommendations

- Decimal money type migration (`Decimal(18,4)` for price columns)
- Multi-language unit map as a DB table (promote when alias set grows)
- Resumable trigram dedup as background job (for >10k × >100k workloads)

### What the SCOPE got right (preserved through v2)

- Tight inheritance from 7.1A — "anything not redefined here is unchanged"
- File Plan with every row ≤ 250 lines + explicit `commit.service.ts` split
- Active-job stays 1-per-business across entities
- DPDP no-op for products with explicit rationale
- `pg_trgm` extension reused from 7.1A
- Re-upload hash detection + previously-uploaded warning inherited intact
- Generic CSV header auto-detect with mapping override
- Reused malicious fixtures (zip-bomb, XXE)

## Blocking action

None. SCOPE advances to architect. SHOULD_SHIP gaps S1-S7 are tracked in
the Revision Log with accept/defer rationale; revisit at pilot data.
