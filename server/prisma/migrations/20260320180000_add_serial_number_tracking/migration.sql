-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "godownId" TEXT;

-- AlterTable
ALTER TABLE "StockVerification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SerialNumber" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "batchId" TEXT,
    "godownId" TEXT,
    "soldInDocumentId" TEXT,
    "soldAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SerialNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "costPrice" INTEGER,
    "salePrice" INTEGER,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Godown" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Godown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GodownStock" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "godownId" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "GodownStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GodownTransfer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "fromGodownId" TEXT NOT NULL,
    "toGodownId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "transferredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GodownTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SerialNumber_businessId_productId_status_idx" ON "SerialNumber"("businessId", "productId", "status");

-- CreateIndex
CREATE INDEX "SerialNumber_businessId_status_idx" ON "SerialNumber"("businessId", "status");

-- CreateIndex
CREATE INDEX "SerialNumber_productId_idx" ON "SerialNumber"("productId");

-- CreateIndex
CREATE INDEX "SerialNumber_soldInDocumentId_idx" ON "SerialNumber"("soldInDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "SerialNumber_businessId_serialNumber_key" ON "SerialNumber"("businessId", "serialNumber");

-- CreateIndex
CREATE INDEX "Batch_businessId_productId_idx" ON "Batch"("businessId", "productId");

-- CreateIndex
CREATE INDEX "Batch_businessId_expiryDate_idx" ON "Batch"("businessId", "expiryDate");

-- CreateIndex
CREATE INDEX "Batch_productId_isDeleted_idx" ON "Batch"("productId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_businessId_productId_batchNumber_key" ON "Batch"("businessId", "productId", "batchNumber");

-- CreateIndex
CREATE INDEX "Godown_businessId_isDeleted_idx" ON "Godown"("businessId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "Godown_businessId_name_key" ON "Godown"("businessId", "name");

-- CreateIndex
CREATE INDEX "GodownStock_businessId_godownId_idx" ON "GodownStock"("businessId", "godownId");

-- CreateIndex
CREATE INDEX "GodownStock_productId_godownId_idx" ON "GodownStock"("productId", "godownId");

-- CreateIndex
CREATE UNIQUE INDEX "GodownStock_productId_godownId_batchId_key" ON "GodownStock"("productId", "godownId", "batchId");

-- CreateIndex
CREATE INDEX "GodownTransfer_businessId_createdAt_idx" ON "GodownTransfer"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "GodownTransfer_productId_idx" ON "GodownTransfer"("productId");

-- CreateIndex
CREATE INDEX "GodownTransfer_fromGodownId_idx" ON "GodownTransfer"("fromGodownId");

-- CreateIndex
CREATE INDEX "GodownTransfer_toGodownId_idx" ON "GodownTransfer"("toGodownId");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_idx" ON "StockMovement"("batchId");

-- CreateIndex
CREATE INDEX "StockMovement_godownId_idx" ON "StockMovement"("godownId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerialNumber" ADD CONSTRAINT "SerialNumber_soldInDocumentId_fkey" FOREIGN KEY ("soldInDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Godown" ADD CONSTRAINT "Godown_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownStock" ADD CONSTRAINT "GodownStock_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownStock" ADD CONSTRAINT "GodownStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownStock" ADD CONSTRAINT "GodownStock_godownId_fkey" FOREIGN KEY ("godownId") REFERENCES "Godown"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownStock" ADD CONSTRAINT "GodownStock_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownTransfer" ADD CONSTRAINT "GodownTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownTransfer" ADD CONSTRAINT "GodownTransfer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownTransfer" ADD CONSTRAINT "GodownTransfer_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownTransfer" ADD CONSTRAINT "GodownTransfer_fromGodownId_fkey" FOREIGN KEY ("fromGodownId") REFERENCES "Godown"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownTransfer" ADD CONSTRAINT "GodownTransfer_toGodownId_fkey" FOREIGN KEY ("toGodownId") REFERENCES "Godown"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GodownTransfer" ADD CONSTRAINT "GodownTransfer_transferredBy_fkey" FOREIGN KEY ("transferredBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

