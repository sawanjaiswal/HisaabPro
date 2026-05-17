-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "lastContactedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "accrualRateBps" INTEGER NOT NULL DEFAULT 100,
    "accrualMinSpendPaise" INTEGER NOT NULL DEFAULT 0,
    "redemptionUnit" INTEGER NOT NULL DEFAULT 1,
    "redemptionPaisePerUnit" INTEGER NOT NULL DEFAULT 100,
    "expiryMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLedger" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "delta" INTEGER NOT NULL,
    "posSaleId" TEXT,
    "documentId" TEXT,
    "expiryRunId" TEXT,
    "adjustedBy" TEXT,
    "note" VARCHAR(200),
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "scopeId" TEXT,
    "mode" VARCHAR(30) NOT NULL,
    "rateBps" INTEGER,
    "flatPerUnitPaise" INTEGER,
    "appliesTo" VARCHAR(10) NOT NULL,
    "staffUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLedger" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "ruleId" TEXT,
    "posSaleId" TEXT,
    "documentId" TEXT,
    "basisPaise" INTEGER NOT NULL,
    "commissionPaise" INTEGER NOT NULL,
    "periodYearMonth" VARCHAR(7) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_businessId_key" ON "LoyaltyProgram"("businessId");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_businessId_idx" ON "LoyaltyProgram"("businessId");

-- CreateIndex
CREATE INDEX "LoyaltyLedger_businessId_partyId_createdAt_idx" ON "LoyaltyLedger"("businessId", "partyId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyLedger_businessId_partyId_expiresAt_idx" ON "LoyaltyLedger"("businessId", "partyId", "expiresAt");

-- CreateIndex
CREATE INDEX "LoyaltyLedger_businessId_expiresAt_idx" ON "LoyaltyLedger"("businessId", "expiresAt");

-- CreateIndex
CREATE INDEX "LoyaltyLedger_posSaleId_idx" ON "LoyaltyLedger"("posSaleId");

-- CreateIndex
CREATE INDEX "LoyaltyLedger_documentId_idx" ON "LoyaltyLedger"("documentId");

-- CreateIndex
CREATE INDEX "CommissionRule_businessId_isActive_idx" ON "CommissionRule"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "CommissionRule_businessId_scope_scopeId_idx" ON "CommissionRule"("businessId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "CommissionLedger_businessId_staffUserId_periodYearMonth_idx" ON "CommissionLedger"("businessId", "staffUserId", "periodYearMonth");

-- CreateIndex
CREATE INDEX "CommissionLedger_businessId_periodYearMonth_idx" ON "CommissionLedger"("businessId", "periodYearMonth");

-- CreateIndex
CREATE INDEX "CommissionLedger_posSaleId_idx" ON "CommissionLedger"("posSaleId");

-- CreateIndex
CREATE INDEX "CommissionLedger_documentId_idx" ON "CommissionLedger"("documentId");

-- CreateIndex
CREATE INDEX "Party_businessId_followUpAt_idx" ON "Party"("businessId", "followUpAt");

-- CreateIndex
CREATE INDEX "Party_businessId_lastContactedAt_idx" ON "Party"("businessId", "lastContactedAt");

-- CreateIndex
CREATE INDEX "idx_party_business_lastcontact_active" ON "Party"("businessId", "lastContactedAt", "isActive");

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_posSaleId_fkey" FOREIGN KEY ("posSaleId") REFERENCES "PosSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedger" ADD CONSTRAINT "LoyaltyLedger_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_posSaleId_fkey" FOREIGN KEY ("posSaleId") REFERENCES "PosSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLedger" ADD CONSTRAINT "CommissionLedger_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

