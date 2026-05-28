-- #150 Multi-user collaboration: monotonic optimistic-lock token.
-- Single-step: column carries a NOT NULL DEFAULT 0, so existing rows backfill to 0
-- and the first locked write increments to 1. No NULL->backfill->NOT-NULL dance.

ALTER TABLE "Party" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
