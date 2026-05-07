-- POS Billing Mode — Migration A (pos_checkout_additive)
-- Additive only: 5 CREATE TABLE, 1 ADD COLUMN, 2 CREATE INDEX
-- No DROP, no NOT NULL backfill on existing columns.
-- Document.status is a plain VARCHAR — no enum DDL needed.

-- 1. Add isWalkIn to Party (nullable boolean with default false)
ALTER TABLE "Party" ADD COLUMN IF NOT EXISTS "isWalkIn" BOOLEAN NOT NULL DEFAULT false;

-- 2. Walk-in sentinel uniqueness per business (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS "Party_business_walkin_singleton_idx"
  ON "Party" ("businessId") WHERE "isWalkIn" = true;

-- 3. Standard index for isWalkIn queries
CREATE INDEX IF NOT EXISTS "Party_businessId_isWalkIn_idx"
  ON "Party" ("businessId", "isWalkIn");

-- 4. PosSale table
CREATE TABLE "PosSale" (
  "id"               TEXT NOT NULL,
  "businessId"       TEXT NOT NULL,
  "documentId"       TEXT NOT NULL,
  "receiptNumber"    TEXT NOT NULL,
  "receiptSeq"       INTEGER NOT NULL,
  "financialYear"    TEXT NOT NULL,
  "partyId"          TEXT,
  "walkInName"       VARCHAR(60),
  "walkInPhone"      VARCHAR(15),
  "subtotal"         INTEGER NOT NULL DEFAULT 0,
  "totalDiscount"    INTEGER NOT NULL DEFAULT 0,
  "totalTaxableValue" INTEGER NOT NULL DEFAULT 0,
  "totalCgst"        INTEGER NOT NULL DEFAULT 0,
  "totalSgst"        INTEGER NOT NULL DEFAULT 0,
  "totalIgst"        INTEGER NOT NULL DEFAULT 0,
  "totalCess"        INTEGER NOT NULL DEFAULT 0,
  "grandTotal"       INTEGER NOT NULL DEFAULT 0,
  "taxPricingMode"   VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE',
  "placeOfSupply"    VARCHAR(2),
  "supplyType"       VARCHAR(20) NOT NULL DEFAULT 'B2C_SMALL',
  "paymentBreakdown" JSONB NOT NULL DEFAULT '[]',
  "cashierId"        TEXT NOT NULL,
  "status"           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "voidedAt"         TIMESTAMP(3),
  "voidedBy"         TEXT,
  "voidReason"       VARCHAR(200),
  "restoredAt"       TIMESTAMP(3),
  "restoredBy"       TEXT,
  "idempotencyKey"   TEXT NOT NULL,
  "clientId"         TEXT,
  "saleDate"         TIMESTAMP(3) NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

-- 5. PosSaleItem table
CREATE TABLE "PosSaleItem" (
  "id"             TEXT NOT NULL,
  "posSaleId"      TEXT NOT NULL,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "productId"      TEXT NOT NULL,
  "productName"    VARCHAR(200) NOT NULL,
  "sku"            VARCHAR(60),
  "hsnCode"        VARCHAR(10),
  "unitSymbol"     VARCHAR(20) NOT NULL,
  "quantity"       DOUBLE PRECISION NOT NULL,
  "ratePaise"      INTEGER NOT NULL,
  "discountType"   VARCHAR(20) NOT NULL DEFAULT 'AMOUNT',
  "discountValue"  INTEGER NOT NULL DEFAULT 0,
  "discountAmount" INTEGER NOT NULL DEFAULT 0,
  "lineTotal"      INTEGER NOT NULL DEFAULT 0,
  "taxableValue"   INTEGER NOT NULL DEFAULT 0,
  "cgstRate"       INTEGER NOT NULL DEFAULT 0,
  "cgstAmount"     INTEGER NOT NULL DEFAULT 0,
  "sgstRate"       INTEGER NOT NULL DEFAULT 0,
  "sgstAmount"     INTEGER NOT NULL DEFAULT 0,
  "igstRate"       INTEGER NOT NULL DEFAULT 0,
  "igstAmount"     INTEGER NOT NULL DEFAULT 0,
  "cessRate"       INTEGER NOT NULL DEFAULT 0,
  "cessAmount"     INTEGER NOT NULL DEFAULT 0,
  "batchId"        TEXT,
  "batchNumber"    VARCHAR(60),
  "godownId"       TEXT,
  "note"           VARCHAR(120),

  CONSTRAINT "PosSaleItem_pkey" PRIMARY KEY ("id")
);

-- 6. PosReceiptCounter table
CREATE TABLE "PosReceiptCounter" (
  "id"            TEXT NOT NULL,
  "businessId"    TEXT NOT NULL,
  "financialYear" TEXT NOT NULL,
  "prefix"        TEXT NOT NULL DEFAULT 'POS',
  "separator"     TEXT NOT NULL DEFAULT '-',
  "paddingDigits" INTEGER NOT NULL DEFAULT 5,
  "lastNumber"    INTEGER NOT NULL DEFAULT 0,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PosReceiptCounter_pkey" PRIMARY KEY ("id")
);

-- 7. PosSaleEvent table
CREATE TABLE "PosSaleEvent" (
  "id"        TEXT NOT NULL,
  "posSaleId" TEXT NOT NULL,
  "type"      VARCHAR(40) NOT NULL,
  "actorId"   TEXT,
  "payload"   JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PosSaleEvent_pkey" PRIMARY KEY ("id")
);

-- 8. PosSetting table
CREATE TABLE "PosSetting" (
  "id"                    TEXT NOT NULL,
  "businessId"            TEXT NOT NULL,
  "receiptPrefix"         TEXT NOT NULL DEFAULT 'POS',
  "receiptSeparator"      TEXT NOT NULL DEFAULT '-',
  "receiptPaddingDigits"  INTEGER NOT NULL DEFAULT 5,
  "defaultPaymentMode"    VARCHAR(20) NOT NULL DEFAULT 'CASH',
  "voidWindowHours"       INTEGER NOT NULL DEFAULT 24,
  "defaultThermalWidth"   VARCHAR(8) NOT NULL DEFAULT '58MM',
  "autoShareOnCheckout"   BOOLEAN NOT NULL DEFAULT false,
  "autoShareChannel"      VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
  "showProfitOnGrid"      BOOLEAN NOT NULL DEFAULT false,
  "cashierMustSelectParty" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PosSetting_pkey" PRIMARY KEY ("id")
);

-- 9. Unique and FK constraints

-- PosSale
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_documentId_key" UNIQUE ("documentId");
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_idempotencyKey_key" UNIQUE ("idempotencyKey");
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_clientId_key" UNIQUE ("clientId");
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_businessId_receiptNumber_key" UNIQUE ("businessId", "receiptNumber");

ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_cashierId_fkey"
  FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_voidedBy_fkey"
  FOREIGN KEY ("voidedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_restoredBy_fkey"
  FOREIGN KEY ("restoredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PosSaleItem
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_posSaleId_fkey"
  FOREIGN KEY ("posSaleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_godownId_fkey"
  FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PosReceiptCounter
ALTER TABLE "PosReceiptCounter" ADD CONSTRAINT "PosReceiptCounter_businessId_financialYear_key"
  UNIQUE ("businessId", "financialYear");
ALTER TABLE "PosReceiptCounter" ADD CONSTRAINT "PosReceiptCounter_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PosSaleEvent
ALTER TABLE "PosSaleEvent" ADD CONSTRAINT "PosSaleEvent_posSaleId_fkey"
  FOREIGN KEY ("posSaleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PosSetting
ALTER TABLE "PosSetting" ADD CONSTRAINT "PosSetting_businessId_key" UNIQUE ("businessId");
ALTER TABLE "PosSetting" ADD CONSTRAINT "PosSetting_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10. Indexes

CREATE INDEX "PosSale_businessId_saleDate_idx" ON "PosSale" ("businessId", "saleDate");
CREATE INDEX "PosSale_businessId_status_idx" ON "PosSale" ("businessId", "status");
CREATE INDEX "PosSale_businessId_cashierId_idx" ON "PosSale" ("businessId", "cashierId");
CREATE INDEX "PosSale_businessId_partyId_idx" ON "PosSale" ("businessId", "partyId");
CREATE INDEX "PosSale_businessId_financialYear_receiptSeq_idx"
  ON "PosSale" ("businessId", "financialYear", "receiptSeq");

CREATE INDEX "PosSaleItem_posSaleId_idx" ON "PosSaleItem" ("posSaleId");
CREATE INDEX "PosSaleItem_productId_idx" ON "PosSaleItem" ("productId");
CREATE INDEX "PosSaleItem_batchId_idx" ON "PosSaleItem" ("batchId");

CREATE INDEX "PosReceiptCounter_businessId_idx" ON "PosReceiptCounter" ("businessId");

CREATE INDEX "PosSaleEvent_posSaleId_createdAt_idx" ON "PosSaleEvent" ("posSaleId", "createdAt");
CREATE INDEX "PosSaleEvent_posSaleId_type_idx" ON "PosSaleEvent" ("posSaleId", "type");
