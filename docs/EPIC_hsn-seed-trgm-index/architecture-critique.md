verdict: PASS

# Architecture Critique — HSN seed (curated) + trigram GIN index (#76)

Audited: 2026-05-29T16:16 · plan: design-plan-active--hsn-seed-trgm-index--bare-161310.md · revision 2

## Re-audit of the MUST_FIX (rev 1)

The migration-ordering foot-gun is resolved. The "## Migration SQL" section now:

1. **Create-then-drop ordering — fixed.** SQL is `CREATE EXTENSION IF NOT EXISTS pg_trgm` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS "hsn_description_trgm"` → `DROP INDEX IF EXISTS "HsnCode_description_idx"` (line 111-114). The B-tree drop is LAST, after a valid GIN exists, so a mid-flight `CONCURRENTLY` failure never leaves the table indexless.

2. **Failure-cleanup documented — fixed.** The header comment (line 106-110) explicitly states the no-tx migration has no auto-rollback and instructs the operator to `DROP INDEX IF EXISTS "hsn_description_trgm";` and re-run on CONCURRENTLY abort.

3. **Down-migration drift — fixed (rev-1 SHOULD_FIX).** Down is now `DROP INDEX IF EXISTS "hsn_description_trgm";` only (line 117-122). It no longer recreates the B-tree, so the removed `@@index([description])` won't read as drift on the next `migrate dev`. Reverting to a seq-scan on a tiny read-only table is correctly noted as acceptable.

## Remaining items (non-blocking)

The shadow-DB apply check is already a hard acceptance gate; the two FUTURE_EPIC items (similarity ranking, CI seed wiring) remain out of scope as agreed.

No scope conformance break, no data-loss risk, no auth/tenant gap. PASS.
