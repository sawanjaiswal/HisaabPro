-- #133 BOGO — additive boolean for free-item lines (default false, no backfill needed)
ALTER TABLE "DocumentLineItem"
  ADD COLUMN "isFreeItem" BOOLEAN NOT NULL DEFAULT false;
