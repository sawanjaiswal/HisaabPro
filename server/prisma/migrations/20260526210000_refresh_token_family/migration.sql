-- Refresh-token family rotation (RFC 6819 §5.2.2.3)
-- Additive only; family stays NULLABLE forever to keep legacy + admin tokens valid.

ALTER TABLE "RefreshToken"
  ADD COLUMN "family"        TEXT,
  ADD COLUMN "replacedBy"    TEXT,
  ADD COLUMN "revokedAt"     TIMESTAMP(3),
  ADD COLUMN "revokedReason" TEXT;

-- Backfill family = id for every existing row (each existing token is its
-- own one-element family). Code path also tolerates NULL via `row.family ?? row.id`
-- but backfilling keeps analytics clean.
UPDATE "RefreshToken" SET "family" = "id" WHERE "family" IS NULL;

-- Indexes
CREATE INDEX "RefreshToken_family_idx" ON "RefreshToken"("family");
CREATE INDEX "RefreshToken_userId_revokedAt_expiresAt_idx"
  ON "RefreshToken"("userId", "revokedAt", "expiresAt");

-- Partial unique constraint: a family can have at most one rotation row pointing
-- to a given `replacedBy`. Concurrent-refresh race lost → P2002 → caller treats
-- as reuse-detected. WHERE clause keeps the constraint silent for NULL replacedBy
-- (the "tail" row of every chain).
CREATE UNIQUE INDEX "RefreshToken_family_replacedBy_unique"
  ON "RefreshToken"("family", "replacedBy")
  WHERE "replacedBy" IS NOT NULL;
