-- GST Phase 2 — additive schema changes
-- Architecture §1.1: six new columns across Business, DocumentSettings, Document, HsnCode
-- All six use NOT NULL with safe literal defaults (PostgreSQL 11+ metadata-only lock, no table rewrite).
-- Single backfill UPDATE for Business.gstEnabled (flip rows that already have a GSTIN).
-- DocumentSettings.taxPricingMode backfilled from parent Business.taxPricingMode after its column lands.

-- ============================================================
-- 1. Business.gstEnabled  BOOLEAN NOT NULL DEFAULT false
-- ============================================================
ALTER TABLE "Business"
  ADD COLUMN "gstEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: tenants that already have a GSTIN saved are de facto GST-registered.
UPDATE "Business"
  SET "gstEnabled" = true
  WHERE "gstin" IS NOT NULL;

-- ============================================================
-- 2. Business.taxPricingMode  VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE'
-- ============================================================
ALTER TABLE "Business"
  ADD COLUMN "taxPricingMode" VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE';

-- ============================================================
-- 3. Business.gstDeclarationText  TEXT  NULL
--    (nullable — NULL means use the in-code standard declaration from SCOPE §8.4)
-- ============================================================
ALTER TABLE "Business"
  ADD COLUMN "gstDeclarationText" TEXT;

-- ============================================================
-- 4. DocumentSettings.taxPricingMode  VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE'
-- ============================================================
ALTER TABLE "DocumentSettings"
  ADD COLUMN "taxPricingMode" VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE';

-- Backfill: sync to parent business's pricing mode (step 2 must land first).
UPDATE "DocumentSettings" ds
  SET "taxPricingMode" = b."taxPricingMode"
  FROM "Business" b
  WHERE ds."businessId" = b.id;

-- ============================================================
-- 5. Document.taxPricingMode  VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE'
--    Historical documents were exclusive; backfill wizard (Section 7) handles re-classification.
-- ============================================================
ALTER TABLE "Document"
  ADD COLUMN "taxPricingMode" VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE';

-- ============================================================
-- 6. HsnCode.uqc  VARCHAR(10) NOT NULL DEFAULT 'NOS'
--    Unit Quantity Code per CGST rules. Fine-grained per-chapter patches applied via seed.gst.uqc.ts.
-- ============================================================
ALTER TABLE "HsnCode"
  ADD COLUMN "uqc" VARCHAR(10) NOT NULL DEFAULT 'NOS';

-- ============================================================
-- DOWN (manual rollback reference — Prisma does not run this block)
-- ============================================================
-- ALTER TABLE "HsnCode"         DROP COLUMN "uqc";
-- ALTER TABLE "Document"        DROP COLUMN "taxPricingMode";
-- ALTER TABLE "DocumentSettings" DROP COLUMN "taxPricingMode";
-- ALTER TABLE "Business"        DROP COLUMN "gstDeclarationText";
-- ALTER TABLE "Business"        DROP COLUMN "taxPricingMode";
-- ALTER TABLE "Business"        DROP COLUMN "gstEnabled";
