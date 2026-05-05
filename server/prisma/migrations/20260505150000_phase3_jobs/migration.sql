-- Phase 3 — Jobs (services vertical)

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUOTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "jobNumber" TEXT,
    "sequenceNumber" INTEGER,
    "financialYear" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUOTED',
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" VARCHAR(500),
    "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "clientId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "ratePaise" INTEGER NOT NULL DEFAULT 0,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JobItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_invoiceId_key" ON "Job"("invoiceId");
CREATE UNIQUE INDEX "Job_clientId_key" ON "Job"("clientId");
CREATE UNIQUE INDEX "Job_businessId_jobNumber_key" ON "Job"("businessId", "jobNumber");
CREATE INDEX "Job_businessId_status_idx" ON "Job"("businessId", "status");
CREATE INDEX "Job_businessId_partyId_idx" ON "Job"("businessId", "partyId");
CREATE INDEX "Job_businessId_scheduledAt_idx" ON "Job"("businessId", "scheduledAt");
CREATE INDEX "Job_businessId_isDeleted_idx" ON "Job"("businessId", "isDeleted");
CREATE INDEX "Job_clientId_idx" ON "Job"("clientId");
CREATE INDEX "JobItem_jobId_idx" ON "JobItem"("jobId");
CREATE INDEX "JobItem_productId_idx" ON "JobItem"("productId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobItem" ADD CONSTRAINT "JobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobItem" ADD CONSTRAINT "JobItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
