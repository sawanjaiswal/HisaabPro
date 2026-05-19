-- prisma:no-transaction
-- Phase 7 · Slice 7.1B · Migration B0 — OPENING_BALANCE precondition
--
-- ARCHITECTURE_PHASE7_IMPORT_7_1B.md §4 Migration 0 mandates an
--   `ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE'`
-- when (and ONLY when) `StockMovementType` exists as a Postgres ENUM type.
--
-- 7.1A models `StockMovement.type` as a TEXT column (schema.prisma:867 —
-- "type String"). There is NO Postgres enum named "StockMovementType" in
-- the current shadow / dev / prod schemas. Therefore the ALTER TYPE is a
-- no-op against today's database.
--
-- This file is committed as a SENTINEL so that:
--   (a) the migration sequence is reviewable end-to-end,
--   (b) commit-products.service.ts can call `assertOpeningBalanceEnum()`
--       which probes `pg_enum` and short-circuits when no enum exists,
--   (c) if a future refactor promotes `type` to a Postgres enum, this
--       file is the canonical patch — flip the DO-block guard back ON
--       in a follow-up migration.
--
-- The DO-block below is idempotent and safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'StockMovementType' AND typtype = 'e'
  ) THEN
    -- Only adds the label if the enum type AND the label are NOT already present.
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'StockMovementType' AND e.enumlabel = 'OPENING_BALANCE'
    ) THEN
      EXECUTE 'ALTER TYPE "StockMovementType" ADD VALUE ''OPENING_BALANCE''';
    END IF;
  END IF;
END
$$;
