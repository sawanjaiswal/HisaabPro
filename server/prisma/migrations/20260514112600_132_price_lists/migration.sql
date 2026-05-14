-- Applied via: psql $DATABASE_URL -f migration.sql
-- Resolved via: npx prisma migrate resolve --applied 20260514112600_132_price_lists

-- #132 Price Lists — Schema additions
-- New enum, two new tables, nullable FKs on Party + Business

-- CreateEnum
CREATE TYPE "PriceListMode" AS ENUM ('ABSOLUTE', 'PERCENT_OFF', 'FIXED_OFF');

-- CreateTable: PriceList
CREATE TABLE "PriceList" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PriceListEntry
CREATE TABLE "PriceListEntry" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mode" "PriceListMode" NOT NULL,
    "valuePaise" INTEGER,
    "percentBps" INTEGER,
    "fixedOffPaise" INTEGER,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "maxQty" INTEGER,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceList_businessId_isDeleted_idx" ON "PriceList"("businessId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "PriceList_businessId_name_key" ON "PriceList"("businessId", "name");

-- CreateIndex
CREATE INDEX "PriceListEntry_priceListId_productId_isDeleted_idx" ON "PriceListEntry"("priceListId", "productId", "isDeleted");

-- CreateIndex
CREATE INDEX "PriceListEntry_productId_idx" ON "PriceListEntry"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceListEntry_priceListId_productId_minQty_key" ON "PriceListEntry"("priceListId", "productId", "minQty");

-- AlterTable: Party — nullable FK
ALTER TABLE "Party" ADD COLUMN "priceListId" TEXT;

-- CreateIndex: Party composite index (must follow ADD COLUMN)
CREATE INDEX "Party_businessId_priceListId_idx" ON "Party"("businessId", "priceListId");

-- AlterTable: Business — nullable FK
ALTER TABLE "Business" ADD COLUMN "defaultPriceListId" TEXT;

-- AddForeignKey: PriceList → Business
ALTER TABLE "PriceList" ADD CONSTRAINT "PriceList_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: PriceListEntry → PriceList
ALTER TABLE "PriceListEntry" ADD CONSTRAINT "PriceListEntry_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PriceListEntry → Product
ALTER TABLE "PriceListEntry" ADD CONSTRAINT "PriceListEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Party → PriceList
ALTER TABLE "Party" ADD CONSTRAINT "Party_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Business → PriceList (default)
ALTER TABLE "Business" ADD CONSTRAINT "Business_defaultPriceListId_fkey" FOREIGN KEY ("defaultPriceListId") REFERENCES "PriceList"("id") ON DELETE SET NULL ON UPDATE CASCADE;
