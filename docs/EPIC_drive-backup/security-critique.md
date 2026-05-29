verdict: PASS

# Drive Backup (audit #5) — adversarial security critique (rev 2 re-audit)

All four rev-1 MUST_FIX are closed in the plan text. Each SHOULD_FIX is present.
No new gap introduced. Cleared to code; verify the implementation matches §2-11
at build gate (the plan is sound — landing-code must honour it).

## MUST_FIX — RESOLVED

| # | Rev-2 evidence | Status |
|---|----------------|--------|
| 1 | §2 + drive-oauth-state.ts (§3): state record **bound to `req.user.userId`** at connect; callback **asserts `state.userId === req.user.userId`** (400 on mismatch). Single-use, 10-min TTL. Connection-fixation closed. | CLOSED |
| 2 | §2 + API contract: `/drive/callback` **REQUIRES `auth`**, under `router.use(auth)`. Verified NOT on `CSRF_EXEMPT_AUTH_PATHS` (csrf.ts) — it is a GET, which CSRF mw skips by method anyway; user-bound state + PKCE verifier is the correct anti-forgery anchor (a CSRF cookie can't survive Google's cross-origin redirect). | CLOSED |
| 3 | §4 + drive-crypto.ts: **fresh `randomBytes(12)` IV per encrypt**, `ivB64:authTagB64:ciphertextB64`, **authTag verified on decrypt (throws)**, **fail-closed throw when `DRIVE_TOKEN_ENC_KEY` missing/not 32 bytes**. Single env key OK (per-call IV gives uniqueness). | CLOSED |
| 4 | §6 + contract: `/drive/disconnect` revokes best-effort, **ALWAYS deletes the row even if revoke fails**, idempotent (no-op when already disconnected). Token never stranded. | CLOSED |

## SHOULD_FIX — RESOLVED

| # | Rev-2 evidence | Status |
|---|----------------|--------|
| 5 | §9: explicit PII-export consent explainer in DriveBackupCard.tsx before OAuth redirect. | CLOSED |
| 6 | §10: `googleapis` errors logged as scrubbed `{ code, message }` only; never raw. Backed by grep-proof acceptance. | CLOSED |
| 7 | §11: rate-limit middleware on `/drive/connect` + `/drive/backup-now`. | CLOSED |
| 8 | §8: `redirect_uri` pinned from `getDriveRedirectUri()` env, never from request Host; callback redirect is the fixed literal `/settings/backup?connected=1` (no token in querystring). | CLOSED |

## IDOR spot-check (5 endpoints) — clean

connect / callback / status / backup-now / disconnect: all scope on
`req.user!.userId` (§5; auth.ts L75 confirms the field — NOT `.id`, no
Prisma drop-undefined IDOR). `DriveBackupConnection.userId @unique`. **No
endpoint accepts a client-supplied userId.** `data: req.body` not used.

## No new gap
In-proc access-token cache (§"Access-token lifecycle") is keyed by userId,
never persisted, lost on restart — acceptable, no cross-tenant bleed.
Scope `drive.file` least-privilege retained. FUTURE_EPIC deferrals (scheduler,
restore, retention, durable backupStore) correctly out of scope.
