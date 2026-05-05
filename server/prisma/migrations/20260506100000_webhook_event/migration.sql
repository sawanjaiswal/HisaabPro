-- AddWebhookEvent: idempotency table for inbound webhooks (MB-1)
-- Deduplicates webhook replays at DB level via UNIQUE constraint on eventId.

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"           TEXT        NOT NULL,
  "eventId"      TEXT        NOT NULL,
  "source"       VARCHAR(20),
  "payload"      JSONB,
  "processedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");
