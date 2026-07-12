-- Invoice Templates & Settings — add-only migration.
-- See docs/ARCHITECTURE_invoice-templates.md §12. Every new column is on a
-- brand-new table or nullable (Document.templateId) — no backfill, no NOT-NULL
-- step, no destructive change.

-- CreateEnum
CREATE TYPE "RoundOffPrecision" AS ENUM ('ONE', 'HALF', 'TEN_PAISE', 'NONE');

-- CreateEnum
CREATE TYPE "RoundOffMethod" AS ENUM ('ROUND', 'FLOOR', 'CEIL');

-- AlterTable ([SHOULD_SHIP] §3.4 — nullable forever; legacy docs = null)
ALTER TABLE "Document" ADD COLUMN "templateId" TEXT;

-- CreateTable
CREATE TABLE "invoice_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "baseTemplate" VARCHAR(40) NOT NULL,
    "config" JSONB NOT NULL,
    "printSettings" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_defaults" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "documentType" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "roundOffEnabled" BOOLEAN NOT NULL DEFAULT true,
    "roundOffPrecision" "RoundOffPrecision" NOT NULL DEFAULT 'ONE',
    "roundOffMethod" "RoundOffMethod" NOT NULL DEFAULT 'ROUND',
    "roundOffShowOnInvoice" BOOLEAN NOT NULL DEFAULT true,
    "quantityDecimals" SMALLINT NOT NULL DEFAULT 2,
    "rateDecimals" SMALLINT NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_templates_businessId_isActive_idx" ON "invoice_templates"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "invoice_templates_businessId_isDeleted_idx" ON "invoice_templates"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "invoice_templates_deletedAt_idx" ON "invoice_templates"("deletedAt");

-- CreateIndex
CREATE INDEX "template_defaults_businessId_idx" ON "template_defaults"("businessId");

-- CreateIndex
CREATE INDEX "template_defaults_templateId_idx" ON "template_defaults"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_defaults_businessId_documentType_key" ON "template_defaults"("businessId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_settings_businessId_key" ON "invoice_settings"("businessId");

-- CreateIndex
CREATE INDEX "Document_templateId_idx" ON "Document"("templateId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "invoice_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_templates" ADD CONSTRAINT "invoice_templates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_defaults" ADD CONSTRAINT "template_defaults_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_defaults" ADD CONSTRAINT "template_defaults_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "invoice_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_settings" ADD CONSTRAINT "invoice_settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
