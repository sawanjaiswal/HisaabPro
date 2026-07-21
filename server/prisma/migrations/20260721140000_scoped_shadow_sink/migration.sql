-- Shadow-harness sink tables (scoped-prisma shadow, Wave A).
--
-- Hand-written rather than `prisma migrate dev`-generated: the shadow-database
-- diff this repo needs for autogeneration cannot replay its own history — six
-- existing migrations use CREATE INDEX CONCURRENTLY, which Postgres refuses
-- inside the transaction block the schema engine wraps each migration in
-- (P3006). Hand SQL + `migrate deploy` is the documented path here
-- (.claude/rules/PRISMA_MIGRATION_RULES.md), not a workaround invented for this
-- change. Purely additive: two new tables, no column added to an existing
-- table, no backfill, no NOT-NULL promotion.

-- CreateTable
CREATE TABLE "scoped_shadow_divergence" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "subjectBusinessId" TEXT,
    "unscopedCount" INTEGER NOT NULL,
    "scopedCount" INTEGER NOT NULL,
    "onlyUnscoped" TEXT[],
    "onlyScoped" TEXT[],
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "shapeHash" TEXT NOT NULL,
    "suppressed" INTEGER NOT NULL DEFAULT 0,
    "routeHint" TEXT NOT NULL DEFAULT '',
    "provenance" TEXT NOT NULL,
    "hadBusinessOnToken" BOOLEAN NOT NULL DEFAULT false,
    "hasInclude" BOOLEAN NOT NULL DEFAULT false,
    "hasBoundedWindow" BOOLEAN NOT NULL DEFAULT false,
    "observationIntervalMs" INTEGER NOT NULL,
    "stackHint" TEXT,
    "errorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoped_shadow_divergence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoped_shadow_stat" (
    "id" TEXT NOT NULL,
    "hourBucket" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "routeHint" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scoped_shadow_stat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The group key carries the classification, not only the payload signature:
-- every empty-diff kind shares one shapeHash, so a [shapeHash, routeHint] key
-- would collapse the whole no-context population into a single row.
CREATE UNIQUE INDEX "scoped_shadow_divergence_kind_model_operation_shapeHash_rou_key" ON "scoped_shadow_divergence"("kind", "model", "operation", "shapeHash", "routeHint");

-- CreateIndex
CREATE INDEX "scoped_shadow_divergence_lastSeenAt_idx" ON "scoped_shadow_divergence"("lastSeenAt");

-- CreateIndex
CREATE INDEX "scoped_shadow_divergence_createdAt_idx" ON "scoped_shadow_divergence"("createdAt");

-- CreateIndex
CREATE INDEX "scoped_shadow_divergence_kind_lastSeenAt_idx" ON "scoped_shadow_divergence"("kind", "lastSeenAt");

-- CreateIndex
CREATE INDEX "scoped_shadow_divergence_kind_provenance_lastSeenAt_idx" ON "scoped_shadow_divergence"("kind", "provenance", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "scoped_shadow_stat_hourBucket_kind_routeHint_key" ON "scoped_shadow_stat"("hourBucket", "kind", "routeHint");

-- CreateIndex
CREATE INDEX "scoped_shadow_stat_hourBucket_idx" ON "scoped_shadow_stat"("hourBucket");

-- CreateIndex
CREATE INDEX "scoped_shadow_stat_kind_hourBucket_idx" ON "scoped_shadow_stat"("kind", "hourBucket");
