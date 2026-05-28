-- #147 Bank reconciliation (absorbs #89): additive create-table-only.
-- No existing column or index is altered; reversible by dropping these tables.

-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "importedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "description" VARCHAR(500),
    "referenceNumber" VARCHAR(100),
    "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationMatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "matchedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankStatementImport_businessId_createdAt_idx" ON "BankStatementImport"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "BankStatementImport_businessId_bankAccountId_idx" ON "BankStatementImport"("businessId", "bankAccountId");

-- CreateIndex
CREATE INDEX "BankStatementLine_businessId_bankAccountId_status_idx" ON "BankStatementLine"("businessId", "bankAccountId", "status");

-- CreateIndex
CREATE INDEX "BankStatementLine_importId_idx" ON "BankStatementLine"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationMatch_lineId_key" ON "ReconciliationMatch"("lineId");

-- CreateIndex
CREATE INDEX "ReconciliationMatch_businessId_paymentId_idx" ON "ReconciliationMatch"("businessId", "paymentId");

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "BankStatementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationMatch" ADD CONSTRAINT "ReconciliationMatch_matchedBy_fkey" FOREIGN KEY ("matchedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
