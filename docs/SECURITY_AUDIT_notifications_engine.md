---
status: complete
feature: notifications-engine
audit_type: pre-code design review
created: 2026-05-07T19:34:00+05:30
auditor: security agent
references:
  - docs/ARCHITECTURE_notifications_engine.md
  - docs/SCOPE_notifications_engine.md
  - OWASP Top 10 (2021)
verdict: APPROVED WITH FIXES
---

# Security Audit — Notifications Engine (PRE-CODE)

This audit reviews the design only. No code exists yet. All findings are
required to be addressed before / during implementation. Severity legend:

- **P0** — Must fix before any code lands. Ship-blocker.
- **P1** — Must fix before flipping `NOTIFICATIONS_ENGINE_ENABLED=true` in prod.
- **P2** — Should fix before broad rollout; can ship to staging.
- **P3** — Hardening / nice-to-have.

OWASP categories used: A01 Broken Access Control · A02 Crypto Failures ·
A03 Injection · A04 Insecure Design · A05 Security Misconfig · A07 Auth
Failures · A08 Data Integrity · A09 Logging · A10 SSRF.

---

## P0 — Ship-blockers

### P0-1 — Admin broadcast lacks explicit Zod-validated body schema and tier coercion guard
Section: §8 (admin broadcast appears in Module Map / §9 Multi-Tenant table); body shape only described as `{ plan-tier targeting: STARTER | PRO | BUSINESS | ALL }`.
OWASP: A01 Broken Access Control, A03 Injection, A04 Insecure Design.

Risk: A compromised admin or buggy UI can post `{ targetTier: 'ALL', userIds: ['*'] }` or coerce filter to a wider audience than intended. Unvalidated `targetTier` strings could be injected into a Prisma `where` builder. Templates carry user-supplied `title` / `body` — without strict length + character allowlist, an admin can blast malformed payloads to every user.

Required mitigation:
- Define and enforce a Zod schema with `.strict()` (no `.passthrough()`). Allowed keys only: `eventKey: 'ADMIN_BROADCAST'`, `targetTier: enum(['STARTER','PRO','BUSINESS','ALL'])`, `titleEn`, `titleHi`, `bodyEn`, `bodyHi`, `deepLinkUrl?` (URL parsed; reject non-https; reject `javascript:`, `data:`, off-domain hosts not in allowlist).
- Hard-cap title 160 chars, body 1000 chars, deepLinkUrl 255 chars (matches schema VARCHAR limits to prevent DB-truncation surprises).
- Server MUST resolve target user list itself; never accept a `userIds` array from the client.
- Reject any payload with `WHATSAPP` channel until `WHATSAPP_ENABLED=true`.

### P0-2 — Admin broadcast must require `requireSuperAdmin`, not just `requireAdmin`
Section: §9 says "`requireAdmin + requireSuperAdmin`" but Module Map §1/L4 says "`requireAdmin`". Inconsistent.
OWASP: A01 Broken Access Control.

Risk: Cross-tenant write surface. A Tier-1 admin (support staff) granted only `requireAdmin` should NOT be able to mass-mail every paying customer.

Required mitigation: Lock the route to `requireSuperAdmin` only. Document in route file header. Add an integration test that calls the endpoint with a non-super admin token and asserts 403. Add an `auth-canary.yml` regression case if not already covered.

### P0-3 — Resend webhook secret env var name disagrees with documented var
Section: §8.2 says HMAC keyed by `SVIX_SECRET`; frontmatter and §15 reference `RESEND_WEBHOOK_SECRET`.
OWASP: A02 Crypto Failures, A05 Security Misconfig.

Risk: If the implementation reads the wrong env var, signature verification silently uses `undefined` → HMAC equality returns true on attacker payload (depending on implementation), or the route always 401s. Either way it's wrong.

Required mitigation:
- Pick one canonical name: `RESEND_WEBHOOK_SECRET`. Update §8.2.
- `lib/env.ts` MUST require it at boot when `NOTIFICATIONS_ENGINE_ENABLED=true`.
- Reject (boot-fail or 503) when missing rather than degrading to "no signature".

### P0-4 — Webhook handlers must verify signature BEFORE `JSON.parse` and on the RAW body
Section: §8.5 mounts `express.raw({ type: 'application/json' })` only on these routes — good — but the architecture does not state the order of operations, and the Module Map shows both raw-body and Zod validation living in a single 140-LOC route file.
OWASP: A02 Crypto Failures, A04 Insecure Design.

Risk: If a developer parses the body first and then HMACs the re-stringified JSON, key-ordering / unicode-normalisation differences will break verification, OR worse — verification will succeed on malformed/attacker-controlled payloads after Express's default body parser silently rewrites.

Required mitigation: For each webhook route, require this exact order in the route file:
1. `express.raw({ type: 'application/json', limit: '64kb' })` (mounted route-level, not app-level).
2. Read `req.body` as `Buffer`. Verify HMAC against this buffer with `crypto.timingSafeEqual`.
3. Verify timestamp window (≤ 5 min for Resend; recommend ≤ 5 min for MSG91 / Aisensy).
4. Only after both checks pass: `JSON.parse(req.body.toString('utf8'))` inside try/catch.
5. Run Zod schema on parsed body.
6. Look up `NotificationJob` by externalId — never trust client to set businessId.

Add this sequence to the route file's top-of-file comment so reviewers can verify by reading the first 40 lines.

### P0-5 — Webhook failure modes must NOT return 200 on signature failure
Section: §8.5 says "uncaught errors return 200 OK + log internally"; §8.1 says "Invalid token: return 401". The general "return 200" rule contradicts the specific HMAC-failure cases.
OWASP: A04 Insecure Design, A09 Logging.

Risk: Returning 200 to an attacker tells them "your forged signature was accepted, no need to retry". It also defeats provider-side tooling that flags repeated 4xx as misconfiguration.

Required mitigation:
- HMAC / JWT signature failure → 401 with body `{ error: 'invalid_signature' }`. Nothing else. No reason text. No echo of input.
- Timestamp out of window → 401 `{ error: 'stale_timestamp' }`.
- Body parse / Zod failure AFTER signature OK → 400 `{ error: 'invalid_body' }`.
- Idempotency replay (Svix-Id / requestId already seen) → 200 with `{ status: 'duplicate' }` (provider convention).
- Internal handler error AFTER signature OK → 500 with generic body, log internally. Do NOT 200 — Resend / MSG91 will retry, which is what we want.
- Never include stack traces, env values, DB error messages, or job payload details in the response body.

### P0-6 — `NotificationJob.payload` is `Json` and may contain raw recipient PII
Section: §3 schema; §6.1 dispatch uses `recipient` inside payload.
OWASP: A02 Crypto Failures, A09 Logging.

Risk: `payload` can hold full phone numbers, full email addresses, FCM tokens, and rendered SMS text containing party names + amounts. If a future audit / debug endpoint dumps `NotificationJob` rows, this is a privacy incident. Database backups will hold rendered SMS bodies for 30 days.

Required mitigation:
- Forbid storing raw FCM tokens in `payload`. Store only `pushTokenId`; provider re-reads token at send time. Eliminates token leakage if a backup is lost.
- For SMS / EMAIL: store recipient in a separate dedicated column (`recipient` VARCHAR(160)), redact to last-4 in any logs.
- Never log `payload` as a whole. Add a custom Winston serializer that strips `payload`, `recipient`, `token`, `phone`, `email` keys.
- Document in Section §11 (PushToken) that the token column is application-sensitive and must NOT appear in any API response, including admin endpoints.

### P0-7 — SSE stream auth must be cookie-based AND must enforce SameSite/CSRF posture
Section: §10.1 says "auth cookie" — does not specify how an EventSource (no custom headers possible) is protected from CSRF when the cookie auto-attaches.
OWASP: A07 Auth Failures, A01 Broken Access Control.

Risk: EventSource cannot set custom headers, so the standard CSRF-token header guard is bypassed. A malicious site can `new EventSource('https://hisaabpro.in/api/notifications/stream')` and, while it can't read cross-origin payloads, it CAN cause server-side resource exhaustion (one connection per visitor of attacker site).

Required mitigation:
- Cookie MUST be `SameSite=Lax` minimum (current platform default — verify).
- Add `Origin` / `Referer` header check on `/api/notifications/stream`: reject if not in app-domain allowlist (`hisaabpro.in`, `localhost:5173` dev). Return 403.
- Per-IP connection cap (e.g. 10 concurrent SSE per IP) in addition to per-user cap (3).
- Document that mobile (Capacitor WebView) sets `Origin: capacitor://localhost` — allow that explicitly.

---

## P1 — Must fix before prod flag flip

### P1-1 — FOR UPDATE SKIP LOCKED claim pattern is correct, but worker-crash recovery is missing
Section: §6.2 + §6.3.
OWASP: A04 Insecure Design.

Risk: Job in `PROCESSING` whose worker crashed (pod OOM, deploy mid-flight) will sit forever — `claimedAt` set but never `markDispatched`-ed. The drain query selects `status='QUEUED'` only, so the row is orphaned. Cost is on us (provider already sent? unknown).

Required mitigation:
- Add a "stale claim sweeper" — every drain tick, also `UPDATE NotificationJob SET status='QUEUED', claimedBy=NULL WHERE status='PROCESSING' AND claimedAt < now() - interval '5 minutes'`. 5-minute upper bound is ample for any real provider call.
- Rely on `idempotencyKey = NotificationJob.id` (already designed §14) so re-claim doesn't double-send if provider already received.
- Log every reclaim with `claimedBy` worker id for postmortem.

### P1-2 — Cost-cap race: pre-check then increment is not atomic across concurrent dispatches
Section: §7.1 `checkAndReserve()` and §7.2 `recordSpend()` are described as separate calls. Two concurrent dispatches can both read tally below cap, both succeed, push tally over cap.
OWASP: A04 Insecure Design, A08 Data Integrity.

Risk: Plan caps (Rs 500 / 2,000 / 10,000) can be overshot. Material under high SMS load (PTP_DUE_TODAY + PAYMENT_OVERDUE on 1st of month).

Required mitigation: Replace two-step with a single atomic compare-and-swap:
```sql
UPDATE "NotificationCostTally"
SET totalPaise = totalPaise + $estPaise, sentCount = sentCount + 1, updatedAt = now()
WHERE businessId = $1 AND month = $2 AND channel = $3
  AND totalPaise + $estPaise <= $cap
RETURNING totalPaise;
```
Zero rows returned → cap would be exceeded → mark DEAD `COST_CAP_EXCEEDED`, do NOT call provider. One row returned → reserved, proceed to send. On send failure, run a compensating decrement bound to the same job.id transition. Document the compensating-decrement guard so a webhook delivery-failure doesn't double-decrement.

### P1-3 — Rate-limit per user per IST day must be lock-aware too
Section: §6.1 `rateLimit.check(userId)` followed by `queue.enqueue` — same race window as P1-2.
OWASP: A04 Insecure Design.

Risk: 10/day cap can be exceeded under burst (e.g. cron firing PAYMENT_REMINDER + PTP_DUE_TODAY simultaneously).

Required mitigation: Use the same atomic-update-with-WHERE approach OR implement as a counter row with `INSERT ... ON CONFLICT DO UPDATE SET count = count + 1 WHERE count < 10 RETURNING count`. Or simpler: count outbound jobs in current IST-day with `SELECT count(*)` inside the same transaction that does `INSERT INTO NotificationJob`, with appropriate isolation level (REPEATABLE READ minimum). Pick one and document in §7.

### P1-4 — Monthly tally reset cron idempotency
Section: §7.4 says "no-op for existing rows (new month means new key)" — relies on `(businessId, month, channel)` unique key being read correctly.
OWASP: A04 Insecure Design.

Risk: If two pods schedule the cron simultaneously (clock drift across zones, or cron-scheduler bug) the prune step may delete > 6mo rows twice. Currently the "reset" is logically a no-op, but the prune is described as optional and not bounded.

Required mitigation:
- Wrap the entire cron tick in a database advisory lock: `SELECT pg_try_advisory_lock(hashtext('notif-tally-monthly'))`. Skip if not acquired. Release in `finally`.
- Apply the same advisory-lock pattern to ALL crons in §1/L3 `notification-cron.ts`: queue drain (1m), 08:00 overdue scan, 09:00 subscription scan, 02:00 retention purge, 00:05 1st-of-month tally.

### P1-5 — Retention purge is hard-delete only — irreversible
Section: §15.3 / §6 mention 90-day Notification + 30-day NotificationJob purge.
OWASP: A09 Logging, A08 Data Integrity.

Risk: If the date-window logic has a bug (timezone, off-by-one), the cron can wipe all rows. Hard-delete can't be undone without restoring from backup.

Required mitigation:
- Cap the per-tick delete batch: `DELETE ... WHERE createdAt < $cutoff LIMIT 5000`. Loop until 0. Prevents a runaway DELETE from locking the table.
- Before each batch, write an audit row to `AdminAudit` (or new `RetentionAudit`) with `{ table, cutoff, rowCount }`. Provides a paper trail.
- Cutoff must be computed in UTC explicitly: `now() - interval '90 days'`. Document the timezone assumption.
- Add a "dry-run" mode behind env `NOTIFICATIONS_PURGE_DRY_RUN=true` for the first prod week. Logs counts but doesn't delete.
- Refuse to run if the cutoff would delete > 50% of the table (sanity guard against clock-skew or restored-from-backup-into-wrong-env disasters).

### P1-6 — PushToken at rest: column-level encryption recommended, justify if declining
Section: §11; §3 schema stores `token VARCHAR(255)` plaintext.
OWASP: A02 Crypto Failures.

Risk: FCM tokens ARE credentials — anyone with a token can address-the-device pushes. If our DB is leaked (backup theft, SQL injection in unrelated code), every user's push surface is takeover-able.

Required mitigation (pick one):
- (Preferred) Application-level AES-GCM encryption with a key from `lib/env.ts` (`PUSH_TOKEN_ENC_KEY`); decrypt at provider send-time only. Schema unchanged (`VARCHAR(255)` holds base64 ciphertext + IV).
- (Acceptable) Postgres `pgcrypto` column encryption.
- (Minimum, must be documented) Plaintext, but with: row-level access only via service-role connection, no admin endpoint that returns tokens, weekly purge of `isValid=false` tokens > 30d.

Document the choice in §11 with rationale before code lands.

### P1-7 — Webhook `WebhookReceipt` dedupe table is mentioned but not in schema
Section: §8.2 says "insert into a small `WebhookReceipt` row or cache for 24h". Not in §3 schema.
OWASP: A04 Insecure Design.

Risk: If implemented as in-memory cache, two pods will accept the same Svix-Id twice. Also lost on restart.

Required mitigation: Add a `WebhookReceipt` model to schema.prisma (in this same migration so we don't need a follow-up migration):
```prisma
model WebhookReceipt {
  id         String   @id            // svix-id or msg91 requestId
  provider   String   @db.VarChar(20)
  receivedAt DateTime @default(now())
  @@index([receivedAt])              // 24h purge
}
```
Cleanup cron: hourly DELETE WHERE receivedAt < now() - 24h.

### P1-8 — FCM JWT verification cert cache must fail-closed
Section: §8.1 step 3 says "Verify signature with cached Google certs ... TTL respected". §16 R3 acknowledges fail-closed but no specifics.
OWASP: A02 Crypto Failures, A07 Auth Failures.

Risk: If our cache TTL expires and Google's cert endpoint is briefly down, a naive implementation might accept any JWT (cache-miss = skip verify). Or cache the wrong response.

Required mitigation:
- Cache MUST be in shared store (DB or Redis) not per-pod memory — eliminates cold-start divergence.
- On cache miss + fetch failure: REJECT 503 with retry; do NOT skip verification.
- Cache the JWKS response with TTL = min(`Cache-Control: max-age`, 12h).
- Pin allowed `kid` set to Google's published rotating set; reject unknown `kid` rather than fetching arbitrarily.
- Verify ALL JWT claims in this order: `iss`, `aud`, `exp`, `iat`, `email`, signature. Fail on first mismatch.

### P1-9 — MSG91 webhook IP allowlist is the ONLY auth when HMAC unavailable
Section: §8.3.
OWASP: A07 Auth Failures.

Risk: IP allowlists are weak when behind a proxy (X-Forwarded-For spoofing) and brittle when MSG91 changes IPs.

Required mitigation:
- Compute client IP from `req.ip` AFTER `app.set('trust proxy', ...)` is set to a specific count (NOT `true` — that's spoofable). Document the proxy-hop count.
- ALSO require a shared secret in `X-MSG91-Auth-Key` header (MSG91 supports this) checked with `timingSafeEqual`. Two-factor: IP + header secret.
- Mandate HMAC be enabled in MSG91 console as a prereq before flipping the prod flag. Track in TASKS_notifications_engine.md.
- Quarterly review of `MSG91_WEBHOOK_IPS` (already in §16 R5) — formalize as a reminder cron / calendar.

### P1-10 — Rate limit on auth-relevant routes (push-token register, preferences)
Section: §11 `POST /api/notifications/push-token`, §1 `PUT /api/notifications/preferences`.
OWASP: A07 Auth Failures.

Risk: Push-token register endpoint can be abused to flood the DB (token spam) by a stolen session. No mention of rate limits.

Required mitigation:
- `POST /push-token`: 30/min per user, 200/day per user.
- `PUT /preferences` (single + bulk): 60/min per user. Bulk-update size limited to 50 items per request.
- All notification routes: 600/min per IP global ceiling (matches §8.5 webhook ceiling).
- Reuse existing `express-rate-limit` infra; do NOT roll new.

---

## P2 — Should fix before broad rollout

### P2-1 — Template injection surface in user-supplied context
Section: §5.2 templates use `{{partyName}}`, `{{businessName}}`, `{{invoiceNo}}`, `{{amount}}`. §5 says "HTML-escapes for EMAIL channel only".
OWASP: A03 Injection.

Risk: A party named `<script>alert(1)</script>` or `{{businessName}}` recurses if regex is greedy. A party named `Raju\nFROM: attacker@evil.com` could break MIME headers in email. Amount strings with control chars could break SMS DLT compliance.

Required mitigation:
- Render is single-pass, non-recursive (`String.replaceAll('{{key}}', value)` — no second pass).
- Per channel sanitisation:
  - EMAIL: HTML-escape (`<`, `>`, `&`, `"`, `'`) on all values. Strip CR/LF from values used in headers (subject line). Reject any subject value > 200 chars.
  - SMS: strip non-printable, ASCII-only, hard-truncate to 160 chars. Reject if DLT template ID missing.
  - PUSH: title strip CR/LF, limit 160; body limit 240 (FCM hard cap).
  - IN_APP: store as-is; React renders it as text — XSS-safe by default. Verify no component uses `dangerouslySetInnerHTML` on `Notification.body`.
- Add a static-analysis test that scans `NotificationsPage` / `NotificationRow` for `dangerouslySetInnerHTML`.

### P2-2 — Logging hygiene — explicit denylist required
Section: §9 says "no JWTs, no full phones (last-4 only in logs)" but no central enforcement.
OWASP: A09 Logging.

Risk: Ad-hoc `logger.info({ job })` will leak `payload` (P0-6 again) and tokens.

Required mitigation:
- Add a Winston format function `redactNotificationPayload()` registered globally; strips keys: `payload`, `token`, `recipient`, `phone`, `email`, `bodyEn`, `bodyHi`, `titleEn`, `titleHi`, `Authorization`, `Svix-Signature`, `X-MSG91-Signature`, `X-MSG91-Auth-Key`.
- Lint/grep rule: any `logger.*({ ...job })` that passes a NotificationJob requires explicit `.pick(['id','status','channel','retryCount','failureCode'])`.
- enforce.js pattern: forbid `console.log` in `notifications/` (already covered project-wide; verify).

### P2-3 — Admin broadcast audit log must include full payload AND actor IP/UA
Section: §9 mentions "Audit log via existing `admin-audit.service`".
OWASP: A09 Logging.

Risk: If a rogue admin fires a phishing broadcast, we need provable evidence. Current admin-audit-service may not capture body.

Required mitigation: Audit row fields:
- `actorAdminId`, `actorIp`, `actorUserAgent`, `targetTier`, `targetUserCount` (resolved server-side), `eventKey: 'ADMIN_BROADCAST'`, `titleEn`, `titleHi`, `bodyEn`, `bodyHi`, `deepLinkUrl`, `idempotencyKey`, `createdAt`. Serialize the broadcast body separately even if redacted elsewhere — this audit table is the source of truth.

### P2-4 — Idempotency-Key on admin broadcast must reject collisions, not silently dedupe
Section: §14 row "Admin broadcast | Required `Idempotency-Key` header".
OWASP: A04 Insecure Design.

Risk: If two different admins use the same Idempotency-Key by accident, the second call should NOT succeed silently — they should be told it's a duplicate and forced to use a new key.

Required mitigation: Store `(idempotencyKey, requestBodyHash)` in the audit row. On subsequent POST with same key, compare body hash:
- Same hash: return 200 + first response (true idempotency).
- Different hash: return 409 Conflict `{ error: 'idempotency_key_reuse' }`. Force admin to mint a new key.

### P2-5 — SSE payload contains `unreadCount` only — verify no body leakage in error paths
Section: §10.2 design correctly says "NO message content".
OWASP: A01 Broken Access Control.

Risk: A future "let's also send the title for richer toasts" PR could regress this. The architecture rule must be tested.

Required mitigation:
- Add a route-level integration test: subscribe SSE as user A, fire a notification for user B in same business, fire one for user A — assert user A receives only their own event AND payload contains exactly `{ type, unreadCount }` keys (no extra fields).
- Add a comment block at the top of `sse-notifications.ts`:
  `// SECURITY: payload MUST be {type, unreadCount} only. No body, no title, no entityId. Cross-tenant guard relies on this.`

### P2-6 — Feature flag default-off plus a "kill-switch" for each provider
Section: §15.1 has a single flag.
OWASP: A04 Insecure Design.

Risk: If MSG91 starts mass-failing AND retrying, we can't selectively disable SMS without disabling the whole engine.

Required mitigation: Per-channel kill switches in env:
- `NOTIFICATIONS_FCM_ENABLED`
- `NOTIFICATIONS_RESEND_ENABLED`
- `NOTIFICATIONS_MSG91_ENABLED`
- `NOTIFICATIONS_INAPP_ENABLED` (always true; documented for clarity)
Provider registry checks these AND `provider.isConfigured()`. Kill switch flips disable enqueue at dispatch time; in-flight jobs DEAD with `PROVIDER_DISABLED`.

### P2-7 — CORS posture for notifications routes
Section: not addressed.
OWASP: A05 Security Misconfig.

Risk: Webhooks must NOT be CORS-reachable from any browser; user routes must match existing app posture.

Required mitigation:
- Webhook routes: explicit `cors({ origin: false })` or no CORS middleware mounted on this router. Browsers should never call them.
- Other notification routes: inherit existing app CORS (whitelist `hisaabpro.in`, `capacitor://localhost`, dev origins). NEVER `*`.
- SSE route: same as user routes plus the Origin guard from P0-7.

### P2-8 — Helmet-level CSP must allow EventSource self-origin
Section: not addressed.
OWASP: A05 Security Misconfig.

Risk: A future CSP tighten may break SSE silently.

Required mitigation: Document `connect-src 'self' https://hisaabpro.in` requirement. Ship CSP tests.

### P2-9 — Webhook body size limit
Section: §8.5 doesn't specify limit.
OWASP: A04 Insecure Design (DoS).

Risk: An attacker (or even a buggy provider) sends 100MB body — blows up memory.

Required mitigation: `express.raw({ type: 'application/json', limit: '64kb' })`. 64kb is far above any provider event payload.

### P2-10 — Admin-audit retention vs notification retention mismatch
Section: §15.3.
OWASP: A09 Logging.

Risk: NotificationJob purged at 30d, but the admin-audit row referencing it is retained — fine. Reverse case: if admin-audit retention < broadcast investigation window, we lose evidence of past broadcasts.

Required mitigation: Document admin-audit retention is ≥ 1 year for `ADMIN_BROADCAST` events. If existing service has a shorter window, override per-event-type.

---

## P3 — Hardening / nice-to-have

### P3-1 — Constant-time comparison wrappers
Use `crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))`. If lengths differ, short-circuit `return false` — but compare equal-length buffers first (timingSafeEqual throws on mismatch). Wrap in helper `safeEqual(string, string): boolean` to centralize.

### P3-2 — A10 SSRF — provider HTTP is to fixed-domain endpoints
Section: §2.2 — Resend/MSG91 use HTTP to fixed provider domains. No user-supplied URL fetched server-side. Confirmed safe. Note in audit that `deepLinkUrl` is rendered into client templates only — never fetched server-side. Document this assumption so a future "preview link" feature doesn't introduce SSRF.

### P3-3 — Failure log on auth failures (P0-5)
A01/A07: log every webhook 401 and admin-broadcast 403 with `provider`, `ip`, `ua`, `path`. Feed into existing security alert pipeline. Threshold alert: > 50 invalid HMACs / 10 min.

### P3-4 — Push-token rotation
Document expected client behavior: Capacitor app re-registers token on app upgrade. Server side: when same `(userId, token)` re-registered, just bump `lastSeenAt` and `appVersion`. When `userId` matches but `token` differs (rotation), keep both rows (multi-device); rely on `isValid=false` on send-failure to prune.

### P3-5 — Logout cleanup
On logout, mark THIS device's `PushToken.isValid=false` only — not all of the user's tokens. Identify "this device" by the token currently registered in the active session. If unknown, no-op. Documents in §11.

### P3-6 — Test coverage gates
Add to TASKS:
- HMAC-failure path test for each webhook.
- Cross-tenant test (user A cannot read user B preferences, list, stream).
- Cost-cap race test (concurrent 1000 dispatches at cap-1).
- Stale-claim recovery test.
- Webhook replay test (Svix-Id reuse).

### P3-7 — Document PII minimization for in-app notifications
`Notification.bodyEn/bodyHi` is rendered text. For events about other users (e.g. "Raju paid Rs 10,000"), the recipient is the business owner — fine. Confirm no event leaks data ABOUT one user TO another user across businesses. Audit each of the 18 templates' body for cross-user leakage during template review.

### P3-8 — Rate-limit feedback in error response
When a notification-engine API returns rate-limit-exceeded, return `Retry-After` header with seconds-until-reset. Standard practice; avoids client tight-loops.

---

## OWASP Top 10 — applicability matrix

| Category | Applies | Findings |
|---|---|---|
| A01 Broken Access Control | YES | P0-1, P0-2, P0-7, P2-5 |
| A02 Crypto Failures | YES | P0-3, P0-4, P0-6, P1-6, P1-8 |
| A03 Injection | YES | P0-1, P2-1 |
| A04 Insecure Design | YES | P0-1, P0-4, P0-5, P1-1, P1-2, P1-3, P1-4, P1-7, P2-4, P2-6, P2-9 |
| A05 Security Misconfig | YES | P0-3, P2-7, P2-8 |
| A06 Vulnerable Components | LOW | Pin firebase-admin, resend, axios; npm-audit-check baseline applies |
| A07 Auth Failures | YES | P0-2, P0-7, P1-8, P1-9, P1-10 |
| A08 Data Integrity | YES | P1-2, P1-5 |
| A09 Logging & Monitoring | YES | P0-5, P0-6, P2-2, P2-3, P2-10, P3-3 |
| A10 SSRF | NO (verified) | P3-2 (forward-looking note) |

---

## Summary table

| ID | Severity | Title | OWASP |
|---|---|---|---|
| P0-1 | P0 | Admin broadcast: Zod schema + tier coercion guard | A01/A03/A04 |
| P0-2 | P0 | Admin broadcast must require requireSuperAdmin | A01 |
| P0-3 | P0 | Resend webhook secret env name canonicalize | A02/A05 |
| P0-4 | P0 | Webhook signature verify before parse, on raw body | A02/A04 |
| P0-5 | P0 | Webhook 401 on signature fail; never 200 | A04/A09 |
| P0-6 | P0 | NotificationJob.payload PII redaction | A02/A09 |
| P0-7 | P0 | SSE Origin/Referer + per-IP cap | A01/A07 |
| P1-1 | P1 | Stale-claim sweeper for crashed workers | A04 |
| P1-2 | P1 | Atomic CAS for cost-cap | A04/A08 |
| P1-3 | P1 | Atomic rate-limit | A04 |
| P1-4 | P1 | Cron advisory locks | A04 |
| P1-5 | P1 | Retention purge guard rails | A08/A09 |
| P1-6 | P1 | PushToken at-rest encryption decision | A02 |
| P1-7 | P1 | WebhookReceipt model in this migration | A04 |
| P1-8 | P1 | FCM JWT cert cache fail-closed + shared store | A02/A07 |
| P1-9 | P1 | MSG91 IP+HMAC dual-factor | A07 |
| P1-10 | P1 | Rate limits on push-token + preferences | A07 |
| P2-1 | P2 | Template-render injection hardening | A03 |
| P2-2 | P2 | Winston redaction format | A09 |
| P2-3 | P2 | Admin-broadcast audit log fields | A09 |
| P2-4 | P2 | Idempotency-key collision returns 409 | A04 |
| P2-5 | P2 | SSE payload shape lock + test | A01 |
| P2-6 | P2 | Per-channel kill switches | A04 |
| P2-7 | P2 | CORS posture per route group | A05 |
| P2-8 | P2 | CSP allows SSE | A05 |
| P2-9 | P2 | 64kb webhook body limit | A04 |
| P2-10 | P2 | Admin-audit retention ≥ 1y for broadcasts | A09 |
| P3-1..P3-8 | P3 | Hardening (see body) | various |

---

## Verdict

**APPROVED WITH FIXES.**

The design is fundamentally sound — provider abstraction is clean, multi-tenant isolation is thought through, and the queue/idempotency model is correct in principle. Webhook design is on the right track but the order-of-operations + failure-mode discipline must be made explicit before code is written, otherwise typical implementation mistakes will reintroduce the very risks the abstraction is supposed to prevent.

Code may begin once the seven P0 items are reflected in `ARCHITECTURE_notifications_engine.md` (or in a short addendum referenced from it). The P1 items must be implemented and verified before flipping `NOTIFICATIONS_ENGINE_ENABLED=true` in production. P2 items must be addressed before broad rollout (i.e. before turning the flag on for paying customers, vs. the staging cohort).

No part of this design is REJECTED. The architecture's existing risk register (§16) already acknowledges several of these issues at a high level; this audit converts them into testable acceptance criteria.

### Minimum bar to start coding (P0 closure list)
1. Update §8.2 to canonical `RESEND_WEBHOOK_SECRET`.
2. Reconcile §1/L4 admin broadcast guard to `requireSuperAdmin` (not just `requireAdmin`).
3. Add explicit "verify-then-parse" pseudocode to §8.5.
4. Add 401-on-HMAC-fail row to §13 Failure-Mode Matrix.
5. Add `recipient`/`pushTokenId` separation note to §3 / §11.
6. Add Origin/Referer guard + per-IP cap to §10.
7. Add Zod schema sketch + admin broadcast body limits to §8 (or new sub-section).

Once those seven edits land, security gate is cleared. P1/P2/P3 are tracked by task-manager.

— security agent, 2026-05-07T19:34:00+05:30
