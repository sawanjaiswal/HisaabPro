-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CustomFieldDefinition" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DocumentNumberSeries" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Godown" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LedgerAccount" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LoanAccount" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OpeningBalance" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PartyAddress" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PartyGroup" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PartyPricing" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RecurringInvoice" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SerialNumber" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "StaffInvite" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TaxCategory" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TermsAndConditionsTemplate" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UnitConversion" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "BankAccount_businessId_isDeleted_idx" ON "BankAccount"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "Category_businessId_isDeleted_idx" ON "Category"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "Cheque_businessId_isDeleted_idx" ON "Cheque"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_businessId_isDeleted_idx" ON "CustomFieldDefinition"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "Document_businessId_isDeleted_idx" ON "Document"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "DocumentNumberSeries_businessId_isDeleted_idx" ON "DocumentNumberSeries"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "ExpenseCategory_businessId_isDeleted_idx" ON "ExpenseCategory"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "LedgerAccount_businessId_isDeleted_idx" ON "LedgerAccount"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "LoanAccount_businessId_isDeleted_idx" ON "LoanAccount"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "Party_businessId_isDeleted_idx" ON "Party"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "PartyAddress_partyId_isDeleted_idx" ON "PartyAddress"("partyId", "isDeleted");

-- CreateIndex
CREATE INDEX "PartyGroup_businessId_isDeleted_idx" ON "PartyGroup"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "PartyPricing_partyId_isDeleted_idx" ON "PartyPricing"("partyId", "isDeleted");

-- CreateIndex
CREATE INDEX "Product_businessId_isDeleted_idx" ON "Product"("businessId", "isDeleted");

-- CreateIndex (Product_businessId_barcode_key already exists, skipped)

-- CreateIndex
CREATE INDEX "RecurringInvoice_businessId_isDeleted_idx" ON "RecurringInvoice"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "Role_businessId_isDeleted_idx" ON "Role"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "SerialNumber_businessId_isDeleted_idx" ON "SerialNumber"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "StaffInvite_businessId_isDeleted_idx" ON "StaffInvite"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "TaxCategory_businessId_isDeleted_idx" ON "TaxCategory"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "TermsAndConditionsTemplate_businessId_isDeleted_idx" ON "TermsAndConditionsTemplate"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "Unit_businessId_isDeleted_idx" ON "Unit"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "UnitConversion_businessId_isDeleted_idx" ON "UnitConversion"("businessId", "isDeleted");
