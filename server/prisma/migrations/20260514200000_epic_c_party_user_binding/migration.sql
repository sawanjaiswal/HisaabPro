-- Epic C PR5 — Party invite claim: bind a User to a Party
-- Add nullable userId FK to Party. The @unique constraint ensures at most one
-- Party globally can point at a given User (MVP invariant per ARCHITECTURE §2 / §13).
-- No backfill — existing rows keep userId = NULL.

ALTER TABLE "Party"
  ADD COLUMN "userId" TEXT;

ALTER TABLE "Party"
  ADD CONSTRAINT "Party_userId_key" UNIQUE ("userId");

ALTER TABLE "Party"
  ADD CONSTRAINT "Party_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
