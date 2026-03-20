-- AddColumn barcode and barcodeFormat to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "barcodeFormat" TEXT;

-- Unique index: one barcode per business
CREATE UNIQUE INDEX IF NOT EXISTS "Product_businessId_barcode_key"
  ON "Product" ("businessId", "barcode")
  WHERE "barcode" IS NOT NULL;
