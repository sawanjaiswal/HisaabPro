-- AlterTable: add documentTypes array to CustomFieldDefinition
ALTER TABLE "CustomFieldDefinition"
  ADD COLUMN "documentTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "DocumentCustomFieldValue" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldDefId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "valueJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentCustomFieldValue_documentId_fieldDefId_key" ON "DocumentCustomFieldValue"("documentId", "fieldDefId");
CREATE INDEX "DocumentCustomFieldValue_documentId_idx" ON "DocumentCustomFieldValue"("documentId");
CREATE INDEX "DocumentCustomFieldValue_businessId_fieldDefId_idx" ON "DocumentCustomFieldValue"("businessId", "fieldDefId");
CREATE INDEX "DocumentCustomFieldValue_fieldDefId_idx" ON "DocumentCustomFieldValue"("fieldDefId");

ALTER TABLE "DocumentCustomFieldValue" ADD CONSTRAINT "DocumentCustomFieldValue_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentCustomFieldValue" ADD CONSTRAINT "DocumentCustomFieldValue_fieldDefId_fkey"
  FOREIGN KEY ("fieldDefId") REFERENCES "CustomFieldDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentCustomFieldValue" ADD CONSTRAINT "DocumentCustomFieldValue_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
