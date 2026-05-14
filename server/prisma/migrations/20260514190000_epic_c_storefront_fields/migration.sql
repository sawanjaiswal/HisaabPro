-- Epic C PR4 — Online Storefront fields (#121)
-- Applied via: npx prisma migrate resolve --applied 20260514190000_epic_c_storefront_fields
-- Reversible: see down section at bottom.

-- 1. Storefront scalar fields on Business (all nullable/defaulted — no existing row breaks)

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "storefrontSlug"      TEXT,
  ADD COLUMN IF NOT EXISTS "storefrontIsPublic"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "storefrontTagline"   TEXT,
  ADD COLUMN IF NOT EXISTS "storefrontTheme"     TEXT    NOT NULL DEFAULT 'LIGHT',
  ADD COLUMN IF NOT EXISTS "storefrontWhatsapp"  TEXT;

-- Unique constraint on slug (stored lowercase — single case form is sufficient)
CREATE UNIQUE INDEX IF NOT EXISTS "Business_storefrontSlug_key"
  ON "Business" ("storefrontSlug");

-- 2. StorefrontProduct join table

CREATE TABLE IF NOT EXISTS "StorefrontProduct" (
  "id"           TEXT    NOT NULL,
  "businessId"   TEXT    NOT NULL,
  "productId"    TEXT    NOT NULL,
  "priceVisible" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"    INTEGER NOT NULL DEFAULT 0,
  "visible"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StorefrontProduct_pkey" PRIMARY KEY ("id")
);

-- FK → Business
ALTER TABLE "StorefrontProduct"
  ADD CONSTRAINT "StorefrontProduct_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK → Product
ALTER TABLE "StorefrontProduct"
  ADD CONSTRAINT "StorefrontProduct_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique per-business product listing
CREATE UNIQUE INDEX IF NOT EXISTS "StorefrontProduct_businessId_productId_key"
  ON "StorefrontProduct" ("businessId", "productId");

-- Sort-order index (public store query)
CREATE INDEX IF NOT EXISTS "StorefrontProduct_businessId_sortOrder_idx"
  ON "StorefrontProduct" ("businessId", "sortOrder");

-- ============================================================
-- DOWN (reversible):
-- DROP INDEX IF EXISTS "StorefrontProduct_businessId_sortOrder_idx";
-- DROP INDEX IF EXISTS "StorefrontProduct_businessId_productId_key";
-- DROP TABLE IF EXISTS "StorefrontProduct";
-- DROP INDEX IF EXISTS "Business_storefrontSlug_key";
-- ALTER TABLE "Business"
--   DROP COLUMN IF EXISTS "storefrontWhatsapp",
--   DROP COLUMN IF EXISTS "storefrontTheme",
--   DROP COLUMN IF EXISTS "storefrontTagline",
--   DROP COLUMN IF EXISTS "storefrontIsPublic",
--   DROP COLUMN IF EXISTS "storefrontSlug";
-- ============================================================
