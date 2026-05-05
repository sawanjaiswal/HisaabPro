-- Phase 4 — Custom Orders (bakery / tailor verticals)

-- CreateEnum
CREATE TYPE "CustomOrderStatus" AS ENUM ('RECEIVED', 'IN_PRODUCTION', 'READY', 'DELIVERED', 'INVOICED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CustomOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "orderNumber" TEXT,
    "sequenceNumber" INTEGER,
    "financialYear" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "notes" TEXT,
    "status" "CustomOrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "deliveryAt" TIMESTAMP(3),
    "deliverySlot" VARCHAR(40),
    "deliveryAddress" VARCHAR(500),
    "deliveredAt" TIMESTAMP(3),
    "productionStartedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" VARCHAR(500),
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "advancePaise" INTEGER NOT NULL DEFAULT 0,
    "balancePaise" INTEGER NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "clientId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrderItem" (
    "id" TEXT NOT NULL,
    "customOrderId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "description" VARCHAR(500) NOT NULL,
    "spec" JSONB,
    "quantity" DECIMAL(12,3) NOT NULL,
    "ratePaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrderAdvance" (
    "id" TEXT NOT NULL,
    "customOrderId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" VARCHAR(40) NOT NULL,
    "reference" VARCHAR(120),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" VARCHAR(500),
    "paymentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomOrderAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrder_invoiceId_key" ON "CustomOrder"("invoiceId");
CREATE UNIQUE INDEX "CustomOrder_clientId_key" ON "CustomOrder"("clientId");
CREATE UNIQUE INDEX "CustomOrder_businessId_orderNumber_key" ON "CustomOrder"("businessId", "orderNumber");
CREATE INDEX "CustomOrder_businessId_status_idx" ON "CustomOrder"("businessId", "status");
CREATE INDEX "CustomOrder_businessId_partyId_idx" ON "CustomOrder"("businessId", "partyId");
CREATE INDEX "CustomOrder_businessId_deliveryAt_idx" ON "CustomOrder"("businessId", "deliveryAt");
CREATE INDEX "CustomOrder_businessId_isDeleted_idx" ON "CustomOrder"("businessId", "isDeleted");
CREATE INDEX "CustomOrder_clientId_idx" ON "CustomOrder"("clientId");
CREATE INDEX "CustomOrderItem_customOrderId_idx" ON "CustomOrderItem"("customOrderId");
CREATE INDEX "CustomOrderItem_productId_idx" ON "CustomOrderItem"("productId");
CREATE INDEX "CustomOrderAdvance_customOrderId_idx" ON "CustomOrderAdvance"("customOrderId");

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomOrderAdvance" ADD CONSTRAINT "CustomOrderAdvance_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
