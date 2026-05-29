verdict: PASS

# Drive Backup — Architecture Critique (audit #5, rev 2)

All three rev-1 MUST_FIX resolved against real code precedents; both SHOULD_FIX folded in. No new architectural seam broken. Cleared to build.

## MUST_FIX — verification

| # | rev-1 finding | rev-2 status |
|---|---------------|--------------|
| 1 | User back-relation missing → `prisma validate` fails | RESOLVED. Schema §line 174 adds `driveBackupConnection DriveBackupConnection?` to `model User`; File Plan row bumped to `+16`. Both relation sides present (FK on child, optional on User:13). |
| 2 | OAuth state/PKCE store unnamed, multi-instance-unsafe | RESOLVED. `server/src/services/backup/drive-oauth-state.ts` in `files_planned:` (~80L); §3 models it on `gst/backfill-store.ts` (verified: Redis-when-`REDIS_URL` + memory `Map` fallback + TTL, line 39/29/26). User-bound value `{userId, codeVerifier, expiresAt}`, single-use on read. Memory-fallback limitation acknowledged. |
| 3 | Snapshot builder not reusable → duplicate gather logic | RESOLVED. `backup.service.ts` now in `files_planned:` (`+20`); §line 143 extracts pure `buildBackupData(userId)`. Verified feasible: gather block (backup.service.ts:81-106) is cleanly separable from rate-limit/cooldown/Map-write (lines 70-79, 120). `drive-backup.service.ts` consumes it without re-running the 3/day cooldown. |

## SHOULD_FIX — verification

| # | status |
|---|--------|
| 4 | RESOLVED. §"Access-token lifecycle" adds in-proc `Map<userId,{token,exp}>`, 60s skew, refresh-on-miss, best-effort (lost on restart). |
| 5 | RESOLVED. State store split into its own `drive-oauth-state.ts`; `oauth-drive.service.ts` now ~150L (transport: auth-URL/PKCE/exchange/refresh/revoke). Clean seam env → state → transport → service → route. |

## New-gap sweep (no regressions)

- All BE/FE file estimates ≤250L (largest: oauth-drive.service.ts ~150, drive-upload ~110). PASS.
- `drive-oauth-state.ts` lives under `services/backup/` alongside crypto/upload — no cross-module reach; only oauth-drive.service.ts and the callback route consume it. No new cycle.
- Migration remains pure add-table (no backfill/NOT-NULL ordering hazard).
- SCOPE trade-offs (env-gated 503, drive.file scope, per-user scoping, in-memory backupStore deferred) preserved, not silently overturned.

## FUTURE_EPIC (non-blocking, carried forward)

- `googleapis` heavy NEW dep — `google-auth-library` + raw REST would cut bundle/CVE surface; record the trade-off.
- Restore-from-Drive, scheduled daily push, durable backupStore — explicitly deferred. OK.

Security MUST_FIX #1–#4 are the security auditor's lane; architecturally the state-binding and fail-open-delete designs are coherent.
