---
audit_of: ARCHITECTURE_PHASE7_IMPORT_7_1C.md (v2, revised 2026-05-19T17:30+05:30)
scope_ref: SCOPE_PHASE7_IMPORT_7_1C_INVOICES.md
auditor: architecture-auditor
audited_at: 2026-05-19T13:28:00+05:30
verdict: PASS_v2
must_ship_gaps: 0
should_ship_gaps: 0
future_epic_recommendations: 1
scope_conformance_breaks: 0
prior_audit_version: v1 (BLOCK, 6 MUST_SHIP, 4 SHOULD_SHIP)
---

# Architecture Audit v2 — Phase 7 #149 · Slice 7.1C · Invoices Import

## Verdict

**PASS_v2.** All six MUST_SHIP gaps from v1 are resolved in artifact (not
just acknowledged). All four SHOULD_SHIP advisories folded. SCOPE-deviation
overrides (per-row→per-chunk tx, per-invoice→batched audit) are explicit,
justified, and recorded in §13 — not silent overrides.

**Architect cleared to begin Build PR sequence (PR-C0 → PR-C5).**

---

## MUST_SHIP resolution verification

### M1 — Nested `tx.$transaction` invalid → topology decision required

**RESOLVED.** §2.8 (arch L326-359) replaces the per-row-tx default with a
per-chunk tx and documents the trade-off in an explicit table (L338-341).
§6 (L569-668) is rewritten as a single outer `tx` with NO nested
`tx.$transaction` — verified at L586 (literal comment: *"within the same
chunk tx — NO nested tx.$transaction"*) and at L395 (in-loop call to
`commitOneInvoiceWithinChunkTx(tx, ...)` shares the parent `tx`). Dispatcher
contract symmetric with 7.1B `commitChunkProducts(tx, args)` — confirmed at
L362-366. Blast-radius reasoning (chunk pre-flight pre-validates everything
deterministic) is sound; 200×4=~800 statements fits Postgres
statement_timeout. Deviation recorded §13.3.

### M2 — `createParty()` path/signature mismatch

**RESOLVED.** File Plan row 22 (L759) creates `services/party/create-tx.ts`
(~80L) with signature `createPartyTx(tx, businessId, data, opts)`. File Plan
row 23 (L760) refactors existing `services/party/create.ts` (~25L) to
delegate via `prisma.$transaction((tx) => createPartyTx(tx, ...))`. §2.6
(L241-264) shows the refactor body. Public `createParty()` contract preserved
— legacy POST /api/parties callers untouched. Unit test row 40 (L777) asserts
both paths. Build-phase ordering note at L832-834 mandates rows 22+23 land
in same PR (PR-C1) to avoid compileless gap. Canonical create path SSOT
preserved.

### M3 — Migration A missing `Party.importJobId` + `importedBy`

**RESOLVED BY CITATION.** Re-grepped `server/prisma/schema.prisma:470-499`
— columns `importJobId String?` + `importedBy String?` (L474-475), FKs
`ImportJob onDelete: SetNull` + `User onDelete: SetNull` relation
`"ImportedParties"` (L476-477), and indexes `@@index([importJobId])` +
`@@index([businessId, importJobId])` (L497-498) are present. Live, shipped
by 7.1A party-import slice. §4 precondition #8 (arch L519) cites the line
range correctly. No Migration A change needed; integration test #12 (L960)
asserts `Party.importedBy` SetNull on DPDP erasure. Folds ARCH S4
automatically.

### M4 — `ImportEntity` union + `ChunkResult` field misnomer

**RESOLVED.** File Plan row 21 (L758) extends union to
`'parties' | 'product' | 'invoice'` (3-line dispatcher edit). §2.8 signature
(L362-366) is byte-identical to 7.1B `commitChunkProducts(tx, args) =>
ChunkResult`. `ChunkResult` reuse documented at L419-423 with JSDoc on
`createdPartyIds` carrying Document IDs (precedent cited:
`commit-products.service.ts:237-239` carries Product IDs in same field).
Acceptable — chasing a rename across 7.1A/B/C is more risk than the
JSDoc tradeoff.

### M5 — Fly-create race window

**RESOLVED.** §2.6 (L277-280) + §6 step 1a (L590-595) acquire
`pg_advisory_xact_lock(hashtextextended('party-fly-create', 0),
hashtextextended(businessId|lower(name)|phone, 0))` BEFORE the post-lock
`findFirst` (L596). Lock is xact-scoped — held until chunk COMMIT/ROLLBACK
— serialises concurrent fly-creates for the same triple. Pathology row #13
(L726) + integration test #13 (L961) assert exactly 1 Party row under 2
parallel POST /commit. Two-step pattern (lock → findFirst → insert-if-absent)
correctly defeats the read-write race window. Note: `hashtextextended` is
correct PG 11+ API — verified, no fictional function name.

### M6 — Stale product resolution snapshot

**RESOLVED.** §6 P2.5 (L575-582) added — re-resolves `line.resolved` from
fresh `productSnapshot` for any `matchedBy === 'NOT_FOUND'` line by SKU or
lower(name). Mutates `row.normalized` in-memory ONLY (correct — staged DB
state stays canonical). P3 (L583-584) reads post-mutation state. File Plan
row 17 (L754) names `reResolveProductsInPlace` explicitly; unit test row 39
(L776) covers (a) stale→BY_SKU, (b) still-missing→NOT_FOUND, (c) BY_NAME
re-resolution. Closes the "user imports products mid-preview, then commits
invoices" gap.

---

## SHOULD_SHIP resolution

- **S1** (per-row audit amplification) — `invoices.imported_batch` with
  parallel arrays (§6.4, L687-707; File Plan #25, #29; integration #1).
  Recorded as Deviation §13.4. SCOPE override is justified, symmetric with
  7.1B.
- **S2** (`committedRowCount` serialisation) — inline comment at §6 step 4
  (L632-635) documents single-row-write + one-job-per-business upstream cap.
- **S3** (CommitBlockedBanner deep-link) — `?resumeImportJobId=` round-trip
  spec at §9 (L870-893); File Plan #52, #56; PR-C5 manual gate.
- **S4** (Party `importedBy` SetNull integration assertion) — folded into
  integration #12 (L960).

---

## SCOPE conformance map

Verified §12 (L975-1039). Two DEVIATED rows are both documented in §13
(per-chunk tx; batched audit) — these are deliberate, justified overrides
with reverse-decision analysis. The third DEVIATED row (`?importJobId=`
filter — L1029) is a 5-line mechanical edit intentionally not file-planned;
acceptable, but build agent must remember it. No silent overrides.

`scope_conformance_breaks: 0` — all DEVIATIONs have explicit §13 entries.

---

## Future-epic recommendations

1. **Convert `Document.type` to a pg_enum in a hardening epic.** §4 (L488-509)
   correctly chose "freeform String + no-op assertion + defensive unit test
   that fails when the column converts" — but the long-term hardening play is
   pg_enum conversion so the boot assertion activates. Architect's Open
   Question #2 is the right call for 7.1C; do not block on it here.

---

## What the architecture got right

- Trade-off table at §2.8 (L338-341) shows both topologies considered, not
  just the chosen one.
- ARCH M3 resolution by citation (rather than fabricating a duplicate
  migration) — auditor verified schema line numbers and confirms.
- Build-phase ordering note at L832-834 prevents a compileless PR window
  during the `createParty()` refactor.
- Largest file estimate 240L (under 250L cap); test-file split candidate
  flagged at L812-815 with natural split point.
- Per-entity `requireMinClientVersion('7.1.2')` (L44) cleanly resolves
  AUDIT S2 without a global bump.

---

## Cross-session learnings applied

- `feedback_auth_req_user_shape.md` — verified §6 step 2 uses `userId` from
  resolved `args` not `req.user.id`; commit signatures take `userId` through
  `CommitChunkArgs`.
- 7.1B precedent on `ChunkResult.createdPartyIds` carrying Product IDs —
  cited in §2.8 to justify Document ID reuse of the same field.

---

## Blocking-rule check

- `must_ship_gaps = 0` → no block from M-gaps.
- `scope_conformance_breaks = 0` → all deviations in §13 explicit.
- File Plan present (57 rows), dependency graph implicit via build phases
  API.0→FE.3, migration sequence single-additive (no contract phase needed).

→ **PASS_v2. Architect cleared to begin Build PR sequence.**
