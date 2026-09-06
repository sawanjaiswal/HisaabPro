-- prisma:no-transaction
-- Phase 7 · Slice 7.1B · Migration B3 — Product trigram composite GIN
-- ARCHITECTURE_PHASE7_IMPORT_7_1B.md §4 Migration C.
--
-- Composite GIN trigram index over (businessId, name) for near-dedup queries
-- (SCOPE L228-237, Gap 4). Tenant-scoping happens at the planner level: any
-- near-dedup query MUST carry `businessId = $1` so the planner uses this
-- index — a missing predicate falls back to seq-scan and lights up the
-- slow-query log. Cross-tenant leak integration test (SCOPE L292) asserts.
--
-- `pg_trgm` was already CREATE EXTENSION'd by the parties trgm migration
-- in 7.1A. `IF NOT EXISTS` is defensive.
--
-- `CONCURRENTLY` is MANDATORY — a non-concurrent build takes ACCESS EXCLUSIVE
-- on Product for the duration (30s-5min on a >1M-row catalog) and freezes
-- invoicing. `CONCURRENTLY` runs outside a tx — hence the
-- `prisma:no-transaction` header on line 1.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Both columns need `gin_trgm_ops` — GIN access method requires an opclass
-- on every indexed column (no default opclass for text under GIN).
CREATE INDEX IF NOT EXISTS "product_business_name_trgm"
  ON "Product" USING gin ("businessId" gin_trgm_ops, "name" gin_trgm_ops);
