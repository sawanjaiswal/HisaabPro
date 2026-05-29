-- S1 GL auto-posting: idempotency guard.
-- At most ONE POSTED JournalEntry per (business, source record). Scoped to
-- status='POSTED' so a VOID-in-place reversal (edit/delete) does NOT collide
-- with the fresh re-post. Partial + unique → not expressible in schema.prisma,
-- hence raw SQL. Prisma tracks this file but never diffs the index back.
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_source_posted_key"
  ON "JournalEntry" ("businessId", "sourceType", "sourceId")
  WHERE "sourceType" IS NOT NULL
    AND "sourceId" IS NOT NULL
    AND "status" = 'POSTED';
