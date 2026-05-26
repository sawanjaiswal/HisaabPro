---
status: approved
feature: refresh-token-family-rotation
created: 2026-05-26T22:10:00Z
approved_at: 2026-05-26T22:15:00Z
approver: Sawan (via "audit deep and approve")
session: bare-215932
proposer: claude
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/src/lib/jwt.ts
files_planned:
  - server/prisma/schema.prisma
  - server/prisma/migrations/20260526210000_refresh_token_family/migration.sql
  - server/src/lib/jwt.ts
  - server/src/services/auth/login.ts
  - server/src/services/auth/password-reset.ts
  - server/src/services/session.service.ts
  - server/src/routes/auth/login.ts
  - server/src/routes/auth/register.ts
  - server/src/routes/auth/dev-login.ts
  - server/src/routes/auth/refresh.ts
  - server/src/routes/auth/logout.ts
  - server/src/routes/auth/switch-business.ts
  - server/src/services/auth/me.ts
  - server/src/routes/public/invite/claim.handler.ts
  - server/src/routes/biometric.ts
  - server/src/__tests__/refresh-token-family.test.ts
  - server/src/__tests__/session-revocation.test.ts
  - docs/EPIC_refresh-token-family-rotation/architecture-critique.md
  - docs/EPIC_refresh-token-family-rotation/security-critique.md
agents_invoked:
  - architecture-auditor (output: docs/EPIC_refresh-token-family-rotation/architecture-critique.md, verdict: PASS)
  - security             (output: docs/EPIC_refresh-token-family-rotation/security-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-26T22:01:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 5 MUST_FIX, 6 SHOULD_FIX
  - ts: 2026-05-26T22:01:00Z
    critic: security
    verdict: REVISE
    revision: 1
    findings: 4 MUST_FIX, 4 SHOULD_FIX, 3 FUTURE_EPIC
  - ts: 2026-05-26T22:06:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
  - ts: 2026-05-26T22:06:00Z
    critic: security
    verdict: PASS
    revision: 2
    note: non-blocking SHOULD_FIX — prefer USER_HASH_SALT over JWT_SECRET for hashUserId (rotatable without losing Sentry forensic continuity); will adopt in build
acceptance:
  backend:
    - tsc clean
    - prisma migrate dev runs additive-only (no NOT NULL alter)
    - curl POST /api/auth/refresh 200 (happy path: new row linked via replacedBy)
    - curl POST /api/auth/refresh 401 with reused token revokes entire family
    - curl POST /api/auth/refresh 401 with unknown-but-valid-sig token logs Sentry event
    - curl POST /api/auth/logout revokes family (updateMany), not delete
    - GET /api/sessions hides revokedAt-non-null rows
    - existing 1029 server tests stay green
    - new test: family-reuse → all siblings revoked
    - new test: two concurrent refreshes → exactly one succeeds
    - new test: legacy NULL-family row rotates safely via row.family ?? row.id
  frontend:
    - n/a — server-only
---

# RefreshToken family rotation — Plan (rev 2)

## Why

Today every refresh issues a new RefreshToken row with no link to its
predecessor. Stolen tokens are undetectable; the in-process blacklist
(`token-blacklist.ts`) is lost on restart and does not cross instances.

Family rotation (RFC 6819 §5.2.2.3): every refresh chains to its
predecessor via `replacedBy`. Reuse of an already-replaced token = theft
signal → revoke the entire family.

## Schema migration — additive only, NULL-tolerant forever

```prisma
model RefreshToken {
  id            String    @id @default(cuid())
  userId        String
  token         String    @unique
  family        String?                         // NULLABLE — legacy rows + admin tokens stay valid
  replacedBy    String?
  revokedAt     DateTime?
  revokedReason String?                         // 'rotated'|'reuse-detected'|'logout'|'password-reset'|'business-switch'
  deviceInfo    String?
  expiresAt     DateTime
  createdAt     DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([family])
  @@index([userId, revokedAt, expiresAt])       // (arch M4) cover listSessions filter
}
```

Migration SQL also adds a **partial unique constraint**:

```sql
CREATE UNIQUE INDEX "RefreshToken_family_replacedBy_unique"
  ON "RefreshToken"("family", "replacedBy")
  WHERE "replacedBy" IS NOT NULL;
```

This guarantees the race scenario in sec M1 degrades safely: a duplicate
rotation throws P2002 → caller treats as reuse-detected.

**Backfill:** `UPDATE "RefreshToken" SET "family" = "id" WHERE "family" IS NULL`.
Optional — the code path tolerates NULL (`row.family ?? row.id`) so backfill
can run lazily. We will run it once for cleanliness.

**No NOT NULL alter.** family stays NULLABLE forever — defensive against
admin tokens, future flows, and rollback safety (arch M3).

## TokenPayload — UNCHANGED

```ts
export interface TokenPayload {
  userId: string
  phone: string
  businessId: string
  type: 'access' | 'refresh'
}
```

`family` is **NOT** in the JWT (sec S1, arch SHOULD_FIX-11). The rotate
path reads family from the DB row, not the token. Smaller JWT, less
coupling, fewer log-leak surfaces.

## Rotation algorithm — atomic via $transaction + Serializable

Lives inline in `server/src/services/auth/login.ts` (arch SHOULD_FIX-6 —
no new `refresh-rotation.ts` file).

```ts
async function refreshAccessToken(rawRefresh: string) {
  const decoded = verifyRefreshToken(rawRefresh)

  try {
    return await prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE via raw — Prisma doesn't expose row locks
      const rows = await tx.$queryRaw<RefreshTokenRow[]>`
        SELECT * FROM "RefreshToken" WHERE token = ${rawRefresh} FOR UPDATE
      `
      const row = rows[0]

      // Unknown token but valid signature → suspicious; Sentry warn
      if (!row) {
        Sentry.captureMessage('refresh-token unknown-but-valid-sig', {
          level: 'warning',
          tags: { reason: 'unknown-token-but-valid-sig' },
          extra: { userIdHash: hashUserId(decoded.userId), tokenAgeSec: tokenAge(decoded) },
        })
        throw new ReuseError('unknown-token')
      }

      // Reuse detection — token already had a replacement
      if (row.revokedAt && row.replacedBy) {
        const family = row.family ?? row.id   // legacy NULL-family safety
        await tx.refreshToken.updateMany({
          where: { OR: [{ family }, { id: family }], revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'reuse-detected' },
        })
        Sentry.captureMessage('refresh-token reuse-detected', {
          level: 'warning',
          tags: { reason: 'reuse-detected' },
          extra: { userIdHash: hashUserId(decoded.userId), family, deviceInfo: row.deviceInfo },
        })
        throw new ReuseError('reuse-detected')
      }

      if (row.revokedAt) throw new ReuseError('already-revoked')

      // Happy path
      const family = row.family ?? row.id     // legacy NULL-family graceful-skew
      const businessId = await resolveUserBusinessId(decoded.userId)
      const tokens = generateTokens(decoded.userId, decoded.phone, businessId)

      const newRow = await tx.refreshToken.create({
        data: {
          userId: decoded.userId,
          token: tokens.refreshToken,
          family,
          deviceInfo: row.deviceInfo,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
      await tx.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), revokedReason: 'rotated', replacedBy: newRow.id },
      })
      return tokens
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // Partial unique violation on (family, replacedBy) — concurrent rotation
      // race lost. Treat as reuse-detected.
      throw new ReuseError('reuse-detected-race')
    }
    throw e
  }
}
```

## File plan (≤250L each)

| Path | Action | Est lines | Layer |
|------|--------|-----------|-------|
| `server/prisma/schema.prisma` | edit RefreshToken model | +7 | schema |
| `server/prisma/migrations/20260526210000_refresh_token_family/migration.sql` | create | ~30 | migration |
| `server/src/lib/jwt.ts` | NO interface change; add `hashUserId` helper (or import from phone-pii.ts pattern) | +5 | lib |
| `server/src/services/auth/login.ts` | rewrite `refreshAccessToken` with $transaction + Serializable + Sentry hooks. Current 106L → ~190L | +90 / -20 | service |
| `server/src/services/auth/password-reset.ts` | `deleteMany` → `updateMany({ revokedReason: 'password-reset' })` (arch M1 / sec M2) | +3 / -2 | service |
| `server/src/services/session.service.ts` | (a) `listSessions` adds `revokedAt: null` filter; (b) `revokeSession` / `revokeAllSessions` `delete*` → `updateMany({ revokedReason: 'logout' })`; (c) **drop `blacklistUser()` call** (sec M4, references `memory/auth_refresh_multi_device.md` regression) | +8 / -5 | service |
| `server/src/routes/auth/login.ts` | on token create: persist with new `family: cuid()` | +3 | route |
| `server/src/routes/auth/register.ts` | same | +3 | route |
| `server/src/routes/auth/dev-login.ts` | same | +3 | route |
| `server/src/routes/auth/refresh.ts` | **remove `isBlacklisted` short-circuit on refresh path** (sec M3, arch SHOULD_FIX-8) — DB is SSOT. Map `ReuseError` → 401 with stable code `REFRESH_FAILED`. | +5 / -6 | route |
| `server/src/routes/auth/logout.ts` | add `updateMany({ where: { family }, data: { revokedAt, revokedReason: 'logout' } })` (arch M2) | +8 | route |
| `server/src/routes/auth/switch-business.ts` | route layer wires revoke-old-family before service call (arch SHOULD_FIX-9) | +8 | route |
| `server/src/services/auth/me.ts` | `switchBusiness` — generate new `family = cuid()`, persist RefreshToken row with deviceInfo (currently no persistence at all; under new design every refresh must have a row) | +12 | service |
| `server/src/routes/public/invite/claim.handler.ts` | persist RefreshToken row with new family after `generateTokens` (currently mints token but never writes a row → would be unrefreshable under new design) | +10 | route |
| `server/src/routes/biometric.ts` | persist with new family | +3 | route |
| `server/src/__tests__/refresh-token-family.test.ts` | new — happy / reuse / unknown-sig / concurrent / legacy-NULL-family / partial-unique-P2002 | ~210 | test |
| `server/src/__tests__/session-revocation.test.ts` | new — listSessions hides revoked, logout revokes family, password-reset revokes all families, business-switch revokes prior family | ~140 | test |

Each file under 250L. All call sites accounted for.

## Admin path — explicitly out of scope

`middleware/admin-auth.ts` and `routes/admin/admin-auth.ts` mint admin
refresh JWTs directly. They do **NOT** use `prisma.refreshToken` and do
not benefit from family rotation. This epic does not touch them. Admin
session security is a separate epic (`admin-session-rotation`) deferred
to FUTURE_EPIC. Documented here so the gate doesn't claim coverage we
don't have.

## Sentry alert decisions (resolved, were open Qs)

- **reuse-detected** → `Sentry.captureMessage` severity=warning.
  Tags: `reason: 'reuse-detected'`. Extra: `userIdHash` (sha256(userId+JWT_SECRET).slice(0,16)), `family`, `deviceInfo`. Never: token, phone, raw userId.
- **unknown-token-but-valid-sig** → same severity, tag `reason: 'unknown-token-but-valid-sig'`. Suggests JWT_SECRET leak.
- **User message stays generic** ("Session expired") — never tip the attacker.

`hashUserId(userId)` helper added to `lib/jwt.ts` (it has access to
JWT_SECRET already; keeps a single secret source).

## Rollout — additive only, no skew gates

1. Deploy migration (additive columns + partial unique index + composite index). Pure-additive; no rollback risk.
2. Deploy code. Behavior:
   - All new tokens (login/register/biometric/dev-login/switch-business) carry `family`.
   - Refresh path tolerates legacy NULL-family rows via `row.family ?? row.id`.
   - Family rotation active immediately for new and legacy rows.
3. After 7 days (refresh-token TTL) all live rows have family. Backfill SQL run for cleanliness.
4. No NOT NULL migration; family stays nullable.

Single deployment. No flag, no skew gate.

## Multi-instance correctness (sec M3 resolved)

- DB is SSOT post-transaction.
- Serializable isolation + `FOR UPDATE` row lock + partial unique = correct serialization across instances. Postgres handles it.
- In-process `token-blacklist.ts` no longer consulted on the refresh path. It is still used by `logout.ts` to invalidate the current request's tokens within process — that's fine, it's a process-local shortcut layered on top of DB authority.

## Logout / password-reset audit-trail preservation (sec M2, arch M1)

Both paths switch `deleteMany` → `updateMany({ revokedReason: ... })`.
Storage growth is bounded by the natural 7d expiry; a future cleanup job
(F3) can hard-delete `revokedAt < now() - 30d` rows when row count
exceeds 100k.

## Dead-but-exported code (no fix needed)

`services/auth/otp.ts::verifyOtp` is exported from `auth/index.ts` but has no
route caller (grep-verified). If wired up later, the caller must persist a
RefreshToken row with new family — same pattern as login/register. Flagged
here so a future epic doesn't miss it.

## What this plan does NOT cover (FUTURE_EPIC)

- Hash refresh tokens at rest (sec F1 — justified deferral).
- Remove in-process `token-blacklist.ts` entirely (sec M3 partial fix only).
- Admin-session rotation (M5 above).
- Cleanup-job for revoked rows (sec F3).
- Telemetry dashboard.

## Findings → fixes mapping

| Critic finding | Fix in this revision |
|---|---|
| arch M1 (`password-reset.ts` missing) | Added to files_planned; `deleteMany` → `updateMany` |
| arch M2 (`logout.ts` missing) | Added to files_planned; revokes family |
| arch M3 (NOT NULL migration wrong) | Removed — family stays NULLABLE forever |
| arch M4 (`listSessions` ghost rows + index) | Added `revokedAt: null` filter + composite index `[userId, revokedAt, expiresAt]` |
| arch M5 (admin path) | Explicitly out of scope, documented |
| arch S6 (split too granular) | Dropped `refresh-rotation.ts`; rotate inlined in `auth/login.ts` |
| arch S7 (test budget) | Split into 2 test files (family + session-revocation) |
| arch S8 (blacklist short-circuits reuse-detection) | Removed `isBlacklisted` from `/refresh` route — DB SSOT |
| arch S9 (switch-business family conflation) | New family on switch; revoke prior |
| arch S10 (Sentry decision now) | Resolved above |
| arch S11 (`family?` in TokenPayload dead weight) | Dropped from JWT entirely |
| sec M1 (race) | $transaction + Serializable + `FOR UPDATE` + partial unique on `(family, replacedBy)` |
| sec M2 (deleteMany destroys audit) | `updateMany` with `revokedReason` |
| sec M3 (drop in-process blacklist from refresh) | Done |
| sec M4 (session.service blacklistUser regression) | `blacklistUser()` call dropped |
| sec S1 (family in JWT) | Removed |
| sec S2 (unknown-token-but-valid-sig signal) | Separate Sentry event |
| sec S3 (Sentry PII) | hashUserId helper; no raw userId / phone / token |
| sec S4 (graceful-skew code path) | `row.family ?? row.id` documented + tested |
