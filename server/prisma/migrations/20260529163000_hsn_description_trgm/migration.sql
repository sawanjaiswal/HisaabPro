-- prisma:no-transaction  (CREATE INDEX CONCURRENTLY cannot run inside a tx)
-- #76 — Replace the redundant B-tree on HsnCode.description (ILIKE '%q%' can't
-- use a B-tree) with a trigram GIN that accelerates description substring
-- search. HsnCode is a small (~12K target) read-only reference table;
-- CONCURRENTLY mirrors the product/parties trgm migrations and is harmless on
-- a tiny table.
--
-- ORDER MATTERS (architecture-critique MUST_FIX): under no-transaction there is
-- NO auto-rollback, so the new GIN must be CREATED and VALID before the old
-- B-tree is dropped. The DROP only executes after a successful create, so a
-- mid-flight CONCURRENTLY failure never leaves the table indexless.
--
-- ON FAILURE: if the CONCURRENTLY build aborts, an INVALID index named
-- "hsn_description_trgm" remains — the operator must
-- `DROP INDEX IF EXISTS "hsn_description_trgm";` and re-run before this
-- migration is considered applied.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "hsn_description_trgm"
  ON "HsnCode" USING gin ("description" gin_trgm_ops);

DROP INDEX IF EXISTS "HsnCode_description_idx";
