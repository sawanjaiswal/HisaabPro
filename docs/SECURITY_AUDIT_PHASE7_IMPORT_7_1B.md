# Security Audit — Phase 7 #149 Slice 7.1B (Products Import)

**Auditor:** security agent · **Date:** 2026-05-19 · **Verdict:** `SHIP_WITH_CONDITIONS`

**Inputs reviewed:**
- SCOPE v2: `docs/SCOPE_PHASE7_IMPORT_7_1B_PRODUCTS.md`
- ARCH v1: `docs/ARCHITECTURE_PHASE7_IMPORT_7_1B.md`
- 7.1A audit: `docs/SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md`

**Surface inspected:** product-specific additions only. 7.1A M1-M4 directives are inherited verbatim via shared middleware.

---

## Verdict — SHIP_WITH_CONDITIONS

5 MUST_FIX (M5-M9), 8 SHOULD_FIX (S14-S21), 4 FUTURE_EPIC (F6-F9). M5-M9 must land before merge to `hisaabpro`.

## MUST_FIX

- **M5 — BigInt JSON serialisation**: add `bigintReplacer` + `serializeNormalizedProduct`; never install global `BigInt.prototype.toJSON`. FE asserts `<= MAX_SAFE_INTEGER` before `Number()`. Unit test for synthetic overflow.
- **M6 — Unit-alias DoS / bidi injection**: `UNIT_MAX_LEN=64`; strip bidi/zero-width before NFKC; shared `sanitizeControlChars` consumed by filename + unit + name + sku + description.
- **M7 — HSN charset**: `HSN_CHARSET_REGEX=/^[0-9]+$/`; invalid → strip + WARNING. PII-safe audit emitters (jobId/productId/sourceIndex only).
- **M8 — Dual-write window**: schema-introspection probe (`information_schema.columns`) gates `createdEntityId` write — NOT input-shape check. Alternative: ship PR1+PR2 as one PR. Integration test `dual-write-rollout.test.ts` against pre-Migration-A schema.
- **M9 — `OPENING_BALANCE` enum precondition**: boot-time `pg_enum` assertion on first call; surfaces 503 `IMPORT_PRECONDITION_MISSING` (not 500). Add to enforce-audit-coverage expected keys.

## SHOULD_FIX

S14 (xxe-prescan full-buffer — inherits 7.1A S1), S15 (OVERWRITE WHERE businessId), S16 (lockJobWithEntity WHERE businessId TOCTOU), S17 (DESCRIPTION_MAX_LEN=2000), S18 (NFKC placeholder check), S19 (CI tenant-leak job), S20 (Winston PII redaction structured-only), S21 (commitToken → crypto.randomBytes hex).

## FUTURE_EPIC

F6 (description sanitisation policy), F7 (polyglot detection — inherits 7.1A F1), F8 (signed-event commitToken — inherits 7.1A F2), F9 (bulk-delete-by-importJobId rollback).

## What ARCH got RIGHT

BigInt(paise) string-math (no parseFloat); composite GIN `(businessId, name gin_trgm_ops)` planner-enforced tenant scoping; partial-unique on `StockMovement.importJobRowId`; statement order INSERT Product → ON CONFLICT StockMovement → UPDATE row-guard inside one chunk tx; CREATE INDEX CONCURRENTLY with prisma:no-transaction; expand→backfill→contract rename split across PRs; 7.1A M1-M4 reused verbatim; Tally `<STOCKITEM>` uses processEntities:false + xxe-prescan + 10s race timeout; audit coverage `products.imported` block-listed.

## Sign-off

**Cleared to build** with M5-M9 folded into ARCH §3.1 (NEW) as pre-build amendments alongside inherited 7.1A M1-M4. S14-S21 must land before merge.
