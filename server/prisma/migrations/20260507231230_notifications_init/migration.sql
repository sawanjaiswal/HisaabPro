-- Notifications Engine — PR1
-- Additive only: 3 CREATE TYPE, 5 CREATE TABLE, 9 CREATE INDEX
-- No DROP, no NOT NULL backfill on existing tables.
-- ReminderConfig, ReminderLog, CollectionCadence untouched.
-- Table creation order: PushToken first (FK dependency for NotificationJob).

-- 1. Enums

CREATE TYPE "NotificationChannel" AS ENUM (
  'PUSH',
  'EMAIL',
  'SMS',
  'IN_APP',
  'WHATSAPP'
);

CREATE TYPE "NotificationJobStatus" AS ENUM (
  'QUEUED',
  'PROCESSING',
  'DISPATCHED',
  'DELIVERED',
  'FAILED',
  'DEAD'
);

CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'UNKNOWN',
  'DELIVERED',
  'BOUNCED',
  'REJECTED',
  'EXPIRED'
);

-- 2. PushToken (created before NotificationJob because of FK dependency)

CREATE TABLE "PushToken" (
  "id"         TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "token"      VARCHAR(255) NOT NULL,
  "platform"   VARCHAR(20) NOT NULL,
  "appVersion" VARCHAR(40),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isValid"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PushToken_userId_token_key" UNIQUE ("userId", "token"),
  CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PushToken_businessId_fkey" FOREIGN KEY ("businessId")
    REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Notification (in-app inbox row)

CREATE TABLE "Notification" (
  "id"          TEXT NOT NULL,
  "businessId"  TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "eventKey"    VARCHAR(60) NOT NULL,
  "titleEn"     VARCHAR(160) NOT NULL,
  "titleHi"     VARCHAR(160) NOT NULL,
  "bodyEn"      TEXT NOT NULL,
  "bodyHi"      TEXT NOT NULL,
  "isRead"      BOOLEAN NOT NULL DEFAULT false,
  "readAt"      TIMESTAMP(3),
  "entityType"  VARCHAR(40),
  "entityId"    TEXT,
  "deepLinkUrl" VARCHAR(255),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_businessId_fkey" FOREIGN KEY ("businessId")
    REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4. NotificationJob (dispatch queue — depends on PushToken)

CREATE TABLE "NotificationJob" (
  "id"               TEXT NOT NULL,
  "businessId"       TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "eventKey"         VARCHAR(60) NOT NULL,
  "channel"          "NotificationChannel" NOT NULL,
  "status"           "NotificationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "deliveryStatus"   "NotificationDeliveryStatus" NOT NULL DEFAULT 'UNKNOWN',
  "idempotencyKey"   VARCHAR(40) NOT NULL,
  "recipientChannel" "NotificationChannel" NOT NULL,
  "pushTokenId"      TEXT,
  "recipientHash"    VARCHAR(64) NOT NULL,
  "payload"          JSONB NOT NULL,
  "externalId"       VARCHAR(120),
  "scheduledAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt"        TIMESTAMP(3),
  "claimedBy"        VARCHAR(80),
  "processedAt"      TIMESTAMP(3),
  "deliveredAt"      TIMESTAMP(3),
  "failedAt"         TIMESTAMP(3),
  "failureCode"      VARCHAR(60),
  "failureReason"    VARCHAR(500),
  "retryCount"       INTEGER NOT NULL DEFAULT 0,
  "costPaise"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationJob_idempotencyKey_key" UNIQUE ("idempotencyKey"),
  CONSTRAINT "NotificationJob_businessId_fkey" FOREIGN KEY ("businessId")
    REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationJob_pushTokenId_fkey" FOREIGN KEY ("pushTokenId")
    REFERENCES "PushToken"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 5. NotificationPreference (per-business per-channel opt-in)

CREATE TABLE "NotificationPreference" (
  "id"         TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "eventKey"   VARCHAR(60) NOT NULL,
  "channel"    "NotificationChannel" NOT NULL,
  "enabled"    BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_businessId_userId_eventKey_channel_key"
    UNIQUE ("businessId", "userId", "eventKey", "channel"),
  CONSTRAINT "NotificationPreference_businessId_fkey" FOREIGN KEY ("businessId")
    REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6. NotificationCostTally (per-business per-month spend tracker)

CREATE TABLE "NotificationCostTally" (
  "id"         TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "month"      VARCHAR(7) NOT NULL,
  "channel"    "NotificationChannel" NOT NULL,
  "totalPaise" INTEGER NOT NULL DEFAULT 0,
  "sentCount"  INTEGER NOT NULL DEFAULT 0,
  "updatedAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationCostTally_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationCostTally_businessId_month_channel_key"
    UNIQUE ("businessId", "month", "channel"),
  CONSTRAINT "NotificationCostTally_businessId_fkey" FOREIGN KEY ("businessId")
    REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7. Indexes (9 total per ARCHITECTURE §3)

-- Notification (3 indexes)
CREATE INDEX "Notification_businessId_userId_isRead_createdAt_idx"
  ON "Notification" ("businessId", "userId", "isRead", "createdAt" DESC);

CREATE INDEX "Notification_businessId_userId_createdAt_idx"
  ON "Notification" ("businessId", "userId", "createdAt" DESC);

CREATE INDEX "Notification_createdAt_idx"
  ON "Notification" ("createdAt");

-- NotificationJob (6 indexes)
CREATE INDEX "NotificationJob_status_scheduledAt_idx"
  ON "NotificationJob" ("status", "scheduledAt");

CREATE INDEX "NotificationJob_businessId_status_createdAt_idx"
  ON "NotificationJob" ("businessId", "status", "createdAt");

CREATE INDEX "NotificationJob_externalId_idx"
  ON "NotificationJob" ("externalId");

CREATE INDEX "NotificationJob_userId_createdAt_idx"
  ON "NotificationJob" ("userId", "createdAt");

CREATE INDEX "NotificationJob_recipientHash_createdAt_idx"
  ON "NotificationJob" ("recipientHash", "createdAt");

CREATE INDEX "NotificationJob_createdAt_idx"
  ON "NotificationJob" ("createdAt");

-- NotificationPreference (1 index)
CREATE INDEX "NotificationPreference_businessId_userId_idx"
  ON "NotificationPreference" ("businessId", "userId");

-- NotificationCostTally (1 index)
CREATE INDEX "NotificationCostTally_businessId_month_idx"
  ON "NotificationCostTally" ("businessId", "month");

-- PushToken (1 index)
CREATE INDEX "PushToken_businessId_userId_isValid_idx"
  ON "PushToken" ("businessId", "userId", "isValid");
