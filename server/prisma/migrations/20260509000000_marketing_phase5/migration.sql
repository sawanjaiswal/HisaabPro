-- Phase 5 Marketing Communications — Additive migration
-- Party: add birthday, marketingOptOut, marketingOptOutAt
-- New models: MarketingTemplate, MarketingCampaign, MarketingCampaignRecipient, ReminderRule, ReminderInstance

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecipientDispatchStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ReminderRuleTrigger" AS ENUM ('BIRTHDAY', 'PAYMENT_DUE', 'PAYMENT_OVERDUE', 'FOLLOWUP', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ReminderInstanceStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED', 'SKIPPED');

-- AlterTable Party — additive; NOT NULL DEFAULT false is safe (PG applies default to existing rows)
ALTER TABLE "Party"
  ADD COLUMN "birthday" TIMESTAMP(3),
  ADD COLUMN "marketingOptOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketingOptOutAt" TIMESTAMP(3);

-- CreateTable MarketingTemplate
CREATE TABLE "MarketingTemplate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "channel" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "bodyHi" TEXT,
    "dltTemplateId" VARCHAR(60),
    "dltRegistered" BOOLEAN NOT NULL DEFAULT false,
    "waTemplateName" VARCHAR(80),
    "waTemplateStatus" TEXT DEFAULT 'PENDING',
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable MarketingCampaign
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "channel" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "segmentFilter" JSONB NOT NULL DEFAULT '{}',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCostPaise" INTEGER NOT NULL DEFAULT 0,
    "defaultVars" JSONB NOT NULL DEFAULT '{}',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable MarketingCampaignRecipient
CREATE TABLE "MarketingCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "phone" VARCHAR(20),
    "status" "RecipientDispatchStatus" NOT NULL DEFAULT 'QUEUED',
    "jobId" TEXT,
    "skipReason" VARCHAR(80),
    "dispatchedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable ReminderRule
CREATE TABLE "ReminderRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "trigger" "ReminderRuleTrigger" NOT NULL,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "segmentFilter" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" VARCHAR(5),
    "quietHoursEnd" VARCHAR(5),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable ReminderInstance
CREATE TABLE "ReminderInstance" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "fireDate" TIMESTAMP(3) NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "jobId" TEXT,
    "skipReason" VARCHAR(80),
    "dispatchedAt" TIMESTAMP(3),
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderInstance_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "MarketingTemplate_businessId_name_channel_key" ON "MarketingTemplate"("businessId", "name", "channel");

-- CreateIndex
CREATE INDEX "MarketingTemplate_businessId_channel_isActive_idx" ON "MarketingTemplate"("businessId", "channel", "isActive");
CREATE INDEX "MarketingTemplate_businessId_isDeleted_idx" ON "MarketingTemplate"("businessId", "isDeleted");

-- CreateIndex
CREATE INDEX "MarketingCampaign_businessId_status_scheduledAt_idx" ON "MarketingCampaign"("businessId", "status", "scheduledAt");
CREATE INDEX "MarketingCampaign_businessId_isDeleted_idx" ON "MarketingCampaign"("businessId", "isDeleted");
CREATE INDEX "MarketingCampaign_businessId_createdAt_idx" ON "MarketingCampaign"("businessId", "createdAt");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "MarketingCampaignRecipient_campaignId_partyId_key" ON "MarketingCampaignRecipient"("campaignId", "partyId");

-- CreateIndex
CREATE INDEX "MarketingCampaignRecipient_campaignId_status_idx" ON "MarketingCampaignRecipient"("campaignId", "status");
CREATE INDEX "MarketingCampaignRecipient_campaignId_createdAt_idx" ON "MarketingCampaignRecipient"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "ReminderRule_businessId_enabled_idx" ON "ReminderRule"("businessId", "enabled");
CREATE INDEX "ReminderRule_businessId_trigger_enabled_idx" ON "ReminderRule"("businessId", "trigger", "enabled");
CREATE INDEX "ReminderRule_businessId_isDeleted_idx" ON "ReminderRule"("businessId", "isDeleted");

-- CreateUniqueIndex (idempotency key)
CREATE UNIQUE INDEX "ReminderInstance_ruleId_partyId_fireDate_key" ON "ReminderInstance"("ruleId", "partyId", "fireDate");

-- CreateIndex
CREATE INDEX "ReminderInstance_status_scheduledAt_idx" ON "ReminderInstance"("status", "scheduledAt");
CREATE INDEX "ReminderInstance_ruleId_status_idx" ON "ReminderInstance"("ruleId", "status");
CREATE INDEX "ReminderInstance_partyId_idx" ON "ReminderInstance"("partyId");

-- CreateIndex (Party)
CREATE INDEX "Party_businessId_marketingOptOut_idx" ON "Party"("businessId", "marketingOptOut");

-- AddForeignKey
ALTER TABLE "MarketingTemplate" ADD CONSTRAINT "MarketingTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketingCampaignRecipient" ADD CONSTRAINT "MarketingCampaignRecipient_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MarketingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderInstance" ADD CONSTRAINT "ReminderInstance_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReminderRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderInstance" ADD CONSTRAINT "ReminderInstance_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
