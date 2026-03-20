-- Phase 4: Item Images (#108), MOQ (#109), Label Printing (#103), Stock Verification (#111)

-- Feature #108 — Item Images
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Feature #109 — MOQ (minimum order quantity)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "moq" INTEGER;

-- Feature #103 — Label Printing template
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "labelTemplate" TEXT DEFAULT 'standard';

-- Feature #111 — Stock Verification

CREATE TABLE IF NOT EXISTS "StockVerification" (
  "id"          TEXT NOT NULL,
  "businessId"  TEXT NOT NULL,
  "verifiedBy"  TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'DRAFT',
  "notes"       TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockVerificationItem" (
  "id"               TEXT NOT NULL,
  "verificationId"   TEXT NOT NULL,
  "productId"        TEXT NOT NULL,
  "systemQuantity"   DOUBLE PRECISION NOT NULL,
  "actualQuantity"   DOUBLE PRECISION,
  "discrepancy"      DOUBLE PRECISION,
  "adjusted"         BOOLEAN NOT NULL DEFAULT false,
  "notes"            TEXT,

  CONSTRAINT "StockVerificationItem_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockVerification_businessId_fkey'
  ) THEN
    ALTER TABLE "StockVerification"
      ADD CONSTRAINT "StockVerification_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockVerification_verifiedBy_fkey'
  ) THEN
    ALTER TABLE "StockVerification"
      ADD CONSTRAINT "StockVerification_verifiedBy_fkey"
      FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockVerificationItem_verificationId_fkey'
  ) THEN
    ALTER TABLE "StockVerificationItem"
      ADD CONSTRAINT "StockVerificationItem_verificationId_fkey"
      FOREIGN KEY ("verificationId") REFERENCES "StockVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockVerificationItem_productId_fkey'
  ) THEN
    ALTER TABLE "StockVerificationItem"
      ADD CONSTRAINT "StockVerificationItem_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "StockVerification_businessId_status_idx" ON "StockVerification"("businessId", "status");
CREATE INDEX IF NOT EXISTS "StockVerification_businessId_createdAt_idx" ON "StockVerification"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockVerificationItem_verificationId_idx" ON "StockVerificationItem"("verificationId");
CREATE INDEX IF NOT EXISTS "StockVerificationItem_productId_idx" ON "StockVerificationItem"("productId");
