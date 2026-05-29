---
status: approved
feature: drive-backup
created: 2026-05-29T11:57:01Z
approved_at: 2026-05-29T12:00:47Z
approver: Sawan
session: bare-172309
proposer: claude
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/lib/env.ts
  - server/src/services/oauth-drive.service.ts
files_planned:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/lib/env.ts
  - server/src/services/oauth-drive.service.ts
  - server/src/services/backup/drive-oauth-state.ts
  - server/src/services/backup/drive-crypto.ts
  - server/src/services/backup/drive-upload.service.ts
  - server/src/services/backup/drive-backup.service.ts
  - server/src/services/backup.service.ts
  - server/src/schemas/backup.schemas.ts
  - server/src/routes/backup.ts
  - server/package.json
  - src/features/backup/backup.types.ts
  - src/features/backup/backup.constants.ts
  - src/features/backup/backup.service.ts
  - src/features/backup/useDriveBackup.ts
  - src/features/backup/DriveBackupCard.tsx
  - src/features/backup/BackupPage.tsx
  - src/config/routes.config.ts
  - src/app.routes.ts
  - src/App.tsx
  - src/lib/translations.en.ts
  - src/lib/translations.hi.ts
agents_invoked:
  - architecture-auditor (output: docs/EPIC_drive-backup/architecture-critique.md, verdict: PASS)
  - security (output: docs/EPIC_drive-backup/security-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-29T11:55:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 3 MUST_FIX (User back-relation, unnamed state store, non-reusable snapshot builder)
  - ts: 2026-05-29T11:55:00Z
    critic: security
    verdict: REVISE
    revision: 1
    findings: 4 MUST_FIX (state not user-bound, callback auth/CSRF, IV+key-absence, disconnect partial-fail)
  - ts: 2026-05-29T12:12:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
  - ts: 2026-05-29T12:12:00Z
    critic: security
    verdict: PASS
    revision: 2
acceptance:
  backend:
    - tsc clean
    - curl 200 (status when configured) / 401 (no auth) / 503 (provider unconfigured)
    - refresh token never appears in logs or API responses (grep proof)
  frontend:
    - screenshots: disconnected · connecting · connected · error · 320px
    - console clean
---

# Google Drive Backup (audit #5) — Plan  (rev 2)

## Problem / scope

`backup.service.ts` produces a JSON snapshot but it lives **in-memory only**
(`backupStore = new Map`) — nothing persists and nothing leaves the server.
Audit #5 wants the snapshot pushed to the user's own Google Drive.

This epic adds an **opt-in, env-gated** Drive integration that mirrors the
Resend/GSTIN-verify pattern: real code that degrades to `503 not configured`
when `GOOGLE_DRIVE_*` env vars are absent, so local backup is never affected
and the app boots fine without creds.

**In scope:** OAuth connect/disconnect, encrypted refresh-token storage,
upload the existing backup JSON to a private app folder on the user's Drive,
status + "backup now to Drive" endpoints, a minimal Settings → Backup UI with
explicit PII-export consent.

**Out of scope (FUTURE_EPIC):** automatic daily Drive push (scheduler),
restore-from-Drive, multi-file rotation/retention on Drive, moving the
in-memory `backupStore` to a durable store.

## Security model (the reason this runs the gate)

1. **Scope minimization** — request only `https://www.googleapis.com/auth/drive.file`.
   Read/write **only files this app created**, never the user's whole Drive.
2. **OAuth CSRF + connection-fixation defense (sec MUST_FIX #1, #2)** — the
   `state` record is **bound to `req.user.userId`** at connect time and the
   callback asserts `state.userId === req.user.userId`. This blocks the
   account-attach vector (attacker binding their Google account to a victim).
   `state` = random 32-byte token, single-use, 10-min TTL; PKCE S256 verifier
   stored alongside. **The callback REQUIRES `auth`** (cookie-auth GET) and is
   never placed on any CSRF skip-allowlist — the user-bound state + PKCE
   verifier are its anti-forgery anchor.
3. **State store named (arch MUST_FIX #2)** — `drive-oauth-state.ts`, modeled on
   the existing `server/src/services/gst/backfill-store.ts`: Redis when
   `REDIS_URL` is set, in-memory `Map` fallback with TTL sweep otherwise. Keyed
   by the random state token; value = `{ userId, codeVerifier, expiresAt }`.
   Single-use (deleted on read).
4. **Refresh-token at rest (sec MUST_FIX #3)** — AES-256-GCM in
   `drive-crypto.ts`: a **fresh `crypto.randomBytes(12)` IV per encrypt**, stored
   as `ivB64:authTagB64:ciphertextB64`; decrypt **verifies the authTag** (throws
   on tamper). Key from `DRIVE_TOKEN_ENC_KEY` (base64, must decode to exactly 32
   bytes) — the module **fails closed (throws) if the key is missing or wrong
   length**. Single env key is acceptable for v1 (GCM's per-call random IV gives
   uniqueness; no per-record salt needed). Plaintext token never written to DB or
   logs. Single encrypt/decrypt site.
5. **Tenant scoping** — `DriveBackupConnection.userId @unique`; every query
   filters on `req.user!.userId` (this codebase's AuthRequest shape is
   `req.user!.userId`, NOT `.id`). No endpoint accepts a userId from the client.
6. **Disconnect = revoke, fail-open on delete (sec MUST_FIX #4)** —
   `/drive/disconnect` calls Google's token-revoke endpoint best-effort, then
   **ALWAYS deletes the row even if revoke fails** (logs non-PII), and is
   idempotent (no-op when already disconnected).
7. **No token leakage** — access tokens minted on demand, held only in-process
   (short cache, see arch SHOULD_FIX below), never returned to the client and
   never in the redirect URL. Callback redirects to the fixed literal
   `/settings/backup?connected=1` (no token in querystring). Status returns
   `{ connected, email?, connectedAt?, lastBackupAt? }` only.
8. **redirect_uri pinned** — read from `getDriveRedirectUri()` env, never derived
   from the request Host (no open-redirect / SSRF surface).
9. **PII-export consent (sec SHOULD_FIX)** — the backup JSON contains user +
   business PII shipped to a third party (Google). The connect UI shows an
   explicit consent explainer the user must acknowledge before the OAuth redirect.
10. **Error scrubbing (sec SHOULD_FIX)** — `googleapis` error objects can embed
    tokens; services log a scrubbed `{ code, message }` only, never the raw error.
11. **Rate-limit (sec SHOULD_FIX)** — `/drive/connect` and `/drive/backup-now`
    reuse the existing rate-limit middleware.
12. **Boot-safe** — `isDriveConfigured()` returns false when any `GOOGLE_DRIVE_*`
    / `DRIVE_TOKEN_ENC_KEY` var is missing; endpoints return 503; lazy
    `process.env` reads only (no import-time throw), mirroring `isResendConfigured`.

## File Plan

| path | action | est-lines | layer |
|------|--------|-----------|-------|
| server/prisma/schema.prisma | modify | +16 | schema — new `DriveBackupConnection` model **+ back-relation field on `User`** (arch MUST_FIX #1) |
| server/prisma/migrations/** | create | ~20 | migration (add-table, no backfill) |
| server/src/lib/env.ts | modify | +34 | env — `isDriveConfigured`, `getDrive{ClientId,ClientSecret,RedirectUri}`, `getDriveTokenEncKey` |
| server/src/services/backup/drive-crypto.ts | create | ~60 | utils — AES-256-GCM (12-byte IV, authTag verify, fail-closed) |
| server/src/services/backup/drive-oauth-state.ts | create | ~80 | utils — user-bound state/PKCE store (Redis/memory + TTL), single-use |
| server/src/services/oauth-drive.service.ts | create | ~150 | transport — auth-URL build, PKCE, code→token exchange, refresh (+short in-proc access-token cache), revoke |
| server/src/services/backup/drive-upload.service.ts | create | ~110 | transport — googleapis Drive file create/update in app folder; scrubbed errors |
| server/src/services/backup/drive-backup.service.ts | create | ~110 | service — orchestrate: `buildBackupData` → ensure token → upload → persist meta |
| server/src/services/backup.service.ts | modify | +20 | service — **extract pure `buildBackupData(userId)`** (no cooldown/rate-limit/Map) so both manual + Drive paths reuse it (arch MUST_FIX #3) |
| server/src/schemas/backup.schemas.ts | create | ~30 | Zod — callback query (code, state), disconnect |
| server/src/routes/backup.ts | modify | +75 | routes — `/drive/connect`, `/drive/callback` (auth-guarded), `/drive/status`, `/drive/disconnect`, `/drive/backup-now` |
| server/package.json | modify | +1 | dep — `googleapis` |
| src/features/backup/backup.types.ts | create | ~30 | FE types |
| src/features/backup/backup.constants.ts | create | ~20 | FE constants |
| src/features/backup/backup.service.ts | create | ~50 | FE api() calls (entityType/entityLabel) |
| src/features/backup/useDriveBackup.ts | create | ~70 | FE hook (status query + connect/disconnect/backup mutations) |
| src/features/backup/DriveBackupCard.tsx | create | ~130 | FE component — 4 states + consent explainer |
| src/features/backup/BackupPage.tsx | create | ~70 | FE page at /settings/backup |
| src/config/routes.config.ts | modify | +1 | SETTINGS_BACKUP route |
| src/app.routes.ts | modify | +1 | lazy export |
| src/App.tsx | modify | +2 | route wiring |
| src/lib/translations.{en,hi}.ts | modify | +~18 ea | i18n keys (incl. consent copy) |

## Schema

```prisma
model DriveBackupConnection {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  googleEmail     String
  refreshTokenEnc String    // AES-256-GCM ivB64:authTagB64:ciphertextB64 — never plaintext
  scope           String
  connectedAt     DateTime  @default(now())
  lastBackupAt    DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```
**Plus the back-relation on `model User`:** `driveBackupConnection DriveBackupConnection?`
(without it `prisma validate` fails — arch MUST_FIX #1). Migration is pure
add-table (no backfill, no retro NOT-NULL) — low risk.

## API contracts

- `GET  /api/backup/drive/connect`   (auth) → 200 `{ authUrl }` · 503 unconfigured
- `GET  /api/backup/drive/callback?code&state` (**auth required**) → verifies
  user-bound state + PKCE, exchanges code, stores enc refresh token, redirects to
  `/settings/backup?connected=1` · 400 bad/expired/mismatched state
- `GET  /api/backup/drive/status`    (auth) → 200 `{ connected, email?, connectedAt?, lastBackupAt? }`
- `POST /api/backup/drive/backup-now` (auth, settings.modify, rate-limited) → 201 `{ fileId, sizeBytes, uploadedAt }` · 409 not connected · 503 unconfigured
- `POST /api/backup/drive/disconnect` (auth, settings.modify) → 200 `{ disconnected: true }` (revoke best-effort, row always deleted, idempotent)

All under `router.use(auth)` + `requireFeature('backup')`; mutations add
`requirePermission('settings.modify')`.

## Access-token lifecycle (arch SHOULD_FIX #4)

`oauth-drive.service.ts` keeps a tiny in-process cache `Map<userId, { token, exp }>`;
on `backup-now` it returns a cached non-expired access token or refreshes from the
stored refresh token (60s skew). Avoids minting per request and `invalid_grant`
churn. Cache is best-effort (lost on restart → re-mint), never persisted.

## Rollout

Ship dark (no creds in prod) → 503 / FE shows "not available". When the Google
Cloud project + OAuth consent screen + `GOOGLE_DRIVE_CLIENT_ID/SECRET/REDIRECT_URI`
+ `DRIVE_TOKEN_ENC_KEY` are provisioned, the same code lights up. No migration
ordering hazard.

## Resolved critic findings (rev 1 → rev 2)

- arch MUST_FIX #1 User back-relation → added to schema section.
- arch MUST_FIX #2 unnamed state store → `drive-oauth-state.ts` (Redis/memory+TTL, gst/backfill-store.ts pattern), user-bound.
- arch MUST_FIX #3 non-reusable snapshot → extract `buildBackupData(userId)` in backup.service.ts; both paths reuse.
- arch SHOULD_FIX #4 token caching → §"Access-token lifecycle".
- arch SHOULD_FIX #5 split oauth service → state store now its own file; transport stays in oauth-drive.service.ts.
- sec MUST_FIX #1 state→user binding; #2 callback auth-guarded + no CSRF-skip; #3 IV/authTag/fail-closed crypto; #4 disconnect fail-open delete. All folded into Security model §2-6.
- sec SHOULD_FIX consent UI / error scrub / rate-limit / pinned redirect_uri → §9-11, §8.
