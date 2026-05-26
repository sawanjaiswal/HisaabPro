verdict: PASS

# Security critique — rev 2 (refresh-token-family-rotation)

All 4 rev-1 MUST_FIX addressed correctly.

**M1 (race).** Resolved. `$transaction` + `Serializable` + `SELECT ... FOR UPDATE` via `$queryRaw` on `token = $1` serializes concurrent refreshes correctly. The locked row exists (minted at login), so the "FOR UPDATE on missing row" foot-gun does not apply — `!row` simply returns zero rows and hits the unknown-token branch. Second TX wakes after first commit, re-reads, sees `revokedAt && replacedBy`, hits reuse-detected BEFORE creating its sibling. Postgres semantics check out.

One nit: the partial unique on `(family, replacedBy) WHERE replacedBy IS NOT NULL` would NOT actually fire on two parallel rotations (each produces a distinct `replacedBy` value); Serializable + FOR UPDATE is doing the real work. The unique catches duplicate-pointer corruption only. The P2002 catch handler is still correct and harmless.

**M2 (deleteMany → updateMany).** Confirmed in password-reset.ts and session.service.ts with `revokedReason` ('password-reset', 'logout'). Audit trail preserved.

**M3 (drop in-process blacklist from /refresh).** Confirmed removed. DB is SSOT. Process-local blacklist retained only on logout path as a layered shortcut — acceptable.

**M4 (session.service `blacklistUser()`).** Confirmed dropped. Matches `memory/auth_refresh_multi_device.md` — theft revokes family only, never escalates to mass multi-device logout (regression 2ea48002 avoided).

**S3 (Sentry hash salt) — SHOULD_FIX, non-blocking.** `sha256(userId + JWT_SECRET)` couples log-anonymization to a rotatable secret. Rotating JWT_SECRET (documented op) re-anonymizes Sentry, breaking forensic continuity. Prefer a dedicated `USER_HASH_SALT` env (32 random bytes, stable for install lifetime). Not a ship-blocker; track as follow-up.

Ship rev 2.
