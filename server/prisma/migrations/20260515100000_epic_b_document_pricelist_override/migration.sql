-- Epic B PR2: Add Document.priceListId nullable FK for per-invoice price-list tier override.
-- Resolver order: Document.priceListId (override) → Party.priceListId (default) → Business.defaultPriceListId → null.
-- Additive nullable — zero downtime. onDelete: SetNull preserves historical docs when a price list is deleted.

-- 1. Add nullable column
ALTER TABLE "Document" ADD COLUMN "priceListId" TEXT;

-- 2. Foreign-key constraint (NOT VALID — avoids full table scan lock; validate separately if table is large)
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_priceListId_fkey"
  FOREIGN KEY ("priceListId")
  REFERENCES "PriceList"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE
  NOT VALID;

-- 3. Index for FK lookup + override-by-list queries
CREATE INDEX "Document_priceListId_idx" ON "Document"("priceListId");
