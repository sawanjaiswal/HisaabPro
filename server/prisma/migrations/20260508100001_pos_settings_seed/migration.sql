-- POS Billing Mode — Migration B (pos_settings_seed)
-- Seeds one PosSetting row per existing Business with defaults.
-- Idempotent: skips businesses that already have a PosSetting row.
-- Uses replace(gen_random_uuid()::text, '-', '') for cuid-like IDs without pgcrypto.

INSERT INTO "PosSetting" ("id", "businessId", "createdAt", "updatedAt")
SELECT
  'pst_' || replace(gen_random_uuid()::text, '-', ''),
  b."id",
  NOW(),
  NOW()
FROM "Business" b
LEFT JOIN "PosSetting" ps ON ps."businessId" = b."id"
WHERE ps."id" IS NULL;
