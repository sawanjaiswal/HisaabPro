-- Phase 6.1 SHOULD_FIX-2 — drop unused PinPhoneLockout table.
--
-- The table was DH-ported verbatim in phase6_schema_core (20260518100000)
-- but HP implements PIN-verify lockout on UserAppSettings.{pinAttempts,
-- pinLockedUntil} per services/security-pin/pin-lockout.service.ts. No
-- service ever reads or writes PinPhoneLockout, so the table is orphan
-- data. Dropping it removes the dead surface area.
--
-- Reversibility: PIN throttling continues to function via UserAppSettings;
-- nothing in the application path consults this table, so the drop has no
-- runtime effect. If a future phone-level lockout feature is added, it
-- can be re-introduced under a new migration with a clean shape.

-- DropIndex
DROP INDEX IF EXISTS "PinPhoneLockout_phoneE164_idx";
DROP INDEX IF EXISTS "PinPhoneLockout_phoneE164_key";

-- DropTable
DROP TABLE IF EXISTS "PinPhoneLockout";
