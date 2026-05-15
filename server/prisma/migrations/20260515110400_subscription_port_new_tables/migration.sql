-- Step 5: Create new subscription-port tables.
-- Migration: subscription_port_new_tables
-- Part of: subscription-port mission, Gate 1.
-- Down: DROP TABLE IF EXISTS "UpiMandate", "BusinessAddon", "FeatureAddon", "SubscriptionEvent" CASCADE;

-- CreateTable: SubscriptionEvent (immutable audit ledger)
CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "razorpayEventId" TEXT,
    "actorUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FeatureAddon (catalog)
CREATE TABLE IF NOT EXISTS "FeatureAddon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "priceMonthlyPaise" INTEGER NOT NULL,
    "priceYearlyPaise" INTEGER,
    "razorpayPlanId" TEXT,
    "requiresPlanTier" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BusinessAddon (join table)
CREATE TABLE IF NOT EXISTS "BusinessAddon" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "featureAddonId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "razorpaySubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UpiMandate
CREATE TABLE IF NOT EXISTS "UpiMandate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "razorpayMandateId" TEXT,
    "razorpayTokenId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "maxAmountPaise" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "nextChargeAt" TIMESTAMP(3),
    "lastChargeAt" TIMESTAMP(3),
    "vpaLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpiMandate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SubscriptionEvent
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionEvent_razorpayEventId_key" ON "SubscriptionEvent"("razorpayEventId");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_businessId_createdAt_idx" ON "SubscriptionEvent"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_subscriptionId_createdAt_idx" ON "SubscriptionEvent"("subscriptionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_eventType_idx" ON "SubscriptionEvent"("eventType");

-- CreateIndex: FeatureAddon
CREATE UNIQUE INDEX IF NOT EXISTS "FeatureAddon_code_key" ON "FeatureAddon"("code");

-- CreateIndex: BusinessAddon
CREATE INDEX IF NOT EXISTS "BusinessAddon_businessId_status_idx" ON "BusinessAddon"("businessId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "BusinessAddon_businessId_featureAddonId_startDate_key" ON "BusinessAddon"("businessId", "featureAddonId", "startDate");

-- CreateIndex: UpiMandate
CREATE UNIQUE INDEX IF NOT EXISTS "UpiMandate_razorpayMandateId_key" ON "UpiMandate"("razorpayMandateId");
CREATE INDEX IF NOT EXISTS "UpiMandate_businessId_status_idx" ON "UpiMandate"("businessId", "status");
CREATE INDEX IF NOT EXISTS "UpiMandate_status_nextChargeAt_idx" ON "UpiMandate"("status", "nextChargeAt");

-- AddForeignKey: SubscriptionEvent
ALTER TABLE "SubscriptionEvent"
    ADD CONSTRAINT "SubscriptionEvent_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionEvent"
    ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: BusinessAddon
ALTER TABLE "BusinessAddon"
    ADD CONSTRAINT "BusinessAddon_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessAddon"
    ADD CONSTRAINT "BusinessAddon_featureAddonId_fkey"
    FOREIGN KEY ("featureAddonId") REFERENCES "FeatureAddon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: UpiMandate
ALTER TABLE "UpiMandate"
    ADD CONSTRAINT "UpiMandate_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UpiMandate"
    ADD CONSTRAINT "UpiMandate_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Protect audit ledger: prevent UPDATE and DELETE on SubscriptionEvent rows.
-- Trigger fires BEFORE UPDATE or DELETE and raises an exception.
CREATE OR REPLACE FUNCTION prevent_subscription_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SubscriptionEvent rows are immutable — UPDATE and DELETE are forbidden. (code: AUDIT_LEDGER_IMMUTABLE)';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_subscription_event_immutable" ON "SubscriptionEvent";
CREATE TRIGGER "trg_subscription_event_immutable"
  BEFORE UPDATE OR DELETE ON "SubscriptionEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_subscription_event_mutation();
