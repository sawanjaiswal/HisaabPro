-- V1 hourly billing — additive only (no backfill, no drop).
-- JobItem.kind defaults to ITEM (constant default → catalog-only on PG >= 11).
-- Job.estimatedHours / actualHours are nullable tracking columns (never summed into money).

-- CreateEnum
CREATE TYPE "JobItemKind" AS ENUM ('ITEM', 'HOURLY');

-- AlterTable
ALTER TABLE "JobItem" ADD COLUMN "kind" "JobItemKind" NOT NULL DEFAULT 'ITEM';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN "estimatedHours" DECIMAL(10,2),
ADD COLUMN "actualHours" DECIMAL(10,2);
