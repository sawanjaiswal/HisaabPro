# SECURITY AUDIT: subscription-port

**Mission slug:** subscription-port
**Date:** 2026-05-15
**Auditor agent:** security
**Scope reviewed:** SCOPE.md + ARCHITECTURE.md (60-file plan, 5 migrations, 19 transitions, RS256 entitlement JWT)
**Status:** APPROVED with conditions (5 P1 fixes required before Gate 1 close; 0 P0)

---

## Executive summary

| Severity | Count | Must-fix-before |
|----------|-------|----------------|
| P0 (blocker, abort Gate 1) | **0** | — |
| P1 (must-fix before merge) | **5** | Gate 2 close (backend services) |
| P2 (must-fix before ship) | **7** | Gate 6 close (ship) |
| P3 (track in backlog) | **4** | Post-ship sweep |

**Top 3 findings:**
1. **P1 — Webhook lacks timestamp/replay-age check.** HMAC alone permits unlimited re-fires of a captured signed payload. Razorpay does NOT include `event_id` uniqueness alone as a temporal guard; today's code stores `eventId` only AFTER processing succeeds, so a poisoned-channel replay window exists between sign-and-process. Architecture's `SubscriptionEvent.razorpayEventId @unique` mitigates state-change duplicates but NOT non-state-changing replays (logs, metrics, downstream notifications). Add `created_at` ≤ 5min check + reject older.
2. **P1 — Admin grant routes lack rate limit, self-grant guard, and immutable audit ledger.** `subscription-admin.service.ts` (90L) is the highest-blast-radius surface in this epic — a compromised AdminUser session can grant PRO_MAX comp to any business. Architecture lists `AdminUser session required` and `SubscriptionEvent` row but does not call out: (a) rate-limit on grant route, (b) refuse-grant-to-business-where-admin-is-owner (self-grant via sock-puppet), (c) require `super-admin` not `admin`, (d) operatorId + reason fields on SubscriptionEvent metadata that are non-null + non-empty validated.
3. **P1 — Entitlement JWT `features` claim is denormalized PII-adjacent surface; 48h offline grace exceeds industry billing-revocation norms.** 48h offline ceiling is acceptable for a side-project tier but is on the loose end: Stripe portal revokes instantly, Apple StoreKit revokes within 24h. With clock-rewind defense being client-trust-bounded, an attacker with full device control gets up to 48h of paid features after admin revoke. Documented-and-accepted per scope threat model — but raise to Sawan: drop to **24h** TTL with a daily silent re-fetch on app foreground. The blast-radius / convenience tradeoff favors 24h.

---

## 1. Webhook security

| # | Check | Status | Severity | Finding | Fix location |
|---|-------|--------|----------|---------|--------------|
| 1.1 | HMAC verify before processing | ✅ pass | — | `routes/razorpay.ts:74` calls `verifyRazorpaySignature(rawBody, signature, secret)` before parse. New SubscriptionEvent path preserves this gate (writer is called from inside the verified handler). | n/a |
| 1.2 | Fail-closed when `RAZORPAY_WEBHOOK_SECRET` unset | ✅ pass | — | `routes/razorpay.ts:64-71` returns 503 if secret missing. | n/a |
| 1.3 | Raw body for HMAC (not re-stringified JSON) | ✅ pass | — | `express.raw({ type: 'application/json' })` at line 50; `rawBody as Buffer` passed to verifier as Buffer. **CONFIRM NEW writer path keeps `rawBody`, NEVER `JSON.stringify(req.body)`.** | `services/razorpay-webhook.service.ts` (modify) — ENFORCE: receive `rawBody: Buffer` arg; if NEW handler calls `applySubscriptionEvent({ payload: req.body })`, the parsed object is fine for state-machine input — but signature must already have been validated against the Buffer upstream. |
| 1.4 | Timing-safe compare | ✅ pass | — | `lib/razorpay.ts:35` uses `crypto.timingSafeEqual` with length-mismatch swallow. | n/a |
| 1.5 | **Replay age window (event timestamp ≤ 5min old)** | ❌ MISSING | **P1** | Razorpay webhook payloads include `created_at` (unix-s). Current handler does NOT check it. A captured signed payload can be replayed weeks later — `SubscriptionEvent.razorpayEventId @unique` blocks duplicate STATE changes but log noise, metrics, and any non-state-changing side effects (notification fanouts) re-fire on every replay. | `services/razorpay-webhook.service.ts` — at handler entry, parse `payload.created_at`; if `now - created_at > 300s`, return `200 { stale: true }` (200 to stop Razorpay's retry loop) + `logger.warn('razorpay.webhook_stale')`. |
| 1.6 | `event_id` presence required | ⚠ partial | **P2** | `routes/razorpay.ts:89` parses payload but does NOT validate `payload.id` is present before delegating. If Razorpay-look-alike attacker forges an event with missing `id`, the writer's idempotency insert tries `razorpayEventId: undefined` which Prisma will allow as NULL (sparse unique). NULL `razorpayEventId` = unbounded duplication. | `services/razorpay-webhook.service.ts` — at handler entry, reject if `!payload.id || typeof payload.id !== 'string'` with 400. |
| 1.7 | 5xx on processing error (not 200-swallow) | ✅ pass — confirm in writer | — | Architecture §5 says writer wraps state-change in `$transaction`; a thrown error should bubble. Confirm `asyncHandler` catches and returns 500 (not 200). | n/a |
| 1.8 | Webhook rate-limit | ✅ pass | — | `routes/razorpay.ts:40` `600/min/IP`. Acceptable for Razorpay's burst rate. | n/a |
| 1.9 | Idempotency on writer | ✅ pass | — | `SubscriptionEvent.razorpayEventId @unique` inside same `$transaction` — P2002 → 200 idempotent. **Confirm `razorpayEventId @unique` is NOT `@@unique` partial — sparse-NULL must NOT collapse multiple NULL admin-event rows into 1 conflict.** Postgres treats NULL as distinct in unique indexes by default; OK. | n/a |
| 1.10 | `pg_advisory_xact_lock(businessId)` scope | ⚠ verify | **P2** | Architecture §5 says lock is per-business (`hashtext('subscription:' || businessId)`). Confirm hash collision risk: `hashtext` is 32-bit → birthday collision ~1 per 65K businesses. Probability of a collision serializing two unrelated businesses is low but real. For HisaabPro target (10K+ businesses), use 64-bit `pg_advisory_xact_lock(hashtextextended(...))` OR `pg_advisory_xact_lock(hi32, lo32)` two-arg form. | `services/subscription/subscription.writer.ts` — use `hashtextextended('subscription:' || businessId, 0)` instead. |

---

## 2. Entitlement JWT

| # | Check | Status | Severity | Finding | Fix |
|---|-------|--------|----------|---------|-----|
| 2.1 | RS256 (asymmetric) — not HS256 | ✅ pass | — | Architecture §4 specifies RS256, public key served at `/api/auth/entitlement-pubkey`. FE never holds private key. | n/a |
| 2.2 | `aud` + `iss` pinned | ✅ pass | — | `iss: hisaabpro-api`, `aud: hisaabpro-client` in claims. **CONFIRM** FE verify call passes `audience: 'hisaabpro-client'` AND `issuer: 'hisaabpro-api'` to `jose.jwtVerify` — these are NOT validated by default. | `features/subscription/entitlement-verify.utils.ts` — pass both options to verify. |
| 2.3 | No PII beyond businessId + plan | ⚠ partial | **P2** | Claims include `uid` (userId), `tier`, `features` (25 flags), `addons[]`. UserId is identifier but not PII per OWASP A02. Features list is business-config, not PII. **PASS** but: `graceUntil` reveals churn signal — acceptable. **Recommendation:** drop `uid` if not needed by FE — only `bid` (businessId) is required for gating; `uid` leaks "which user inside the org has paid access" if JWT ever logged. | `services/subscription/entitlement-jwt.service.ts` — drop `uid` claim unless FE has documented use. |
| 2.4 | TTL = revocation ceiling | ⚠ tradeoff | **P1** | 48h is acceptable per scope threat model BUT industry norm tighter: Stripe portal instant, Apple StoreKit 24h, Razorpay subscriptions API real-time. With ~12-hour offline-grace cron sweeps, 24h TTL with silent foreground-refetch loses zero UX but halves the revocation window. **Surface this to Sawan as a Gate 1 decision.** | Decision-point: keep 48h (per scope) or tighten to 24h. If 24h chosen: `entitlement-jwt.service.ts` constant `TTL_SECONDS = 86400`. |
| 2.5 | Key storage | ⚠ partial | **P2** | Architecture §4 says env vars. Render env vars are fine for current scale BUT: (a) private key MUST be excluded from any log statements (`logger.info({ ...env })` style debug routes); (b) `.env.example` MUST show only `ENTITLEMENT_PRIVATE_KEY=<PEM>` placeholder, never a real key; (c) audit `lib/env.ts` zod for `.optional()` not `.default(SOMETHING)`. | `lib/env.ts` — verify `ENTITLEMENT_PRIVATE_KEY: z.string().optional()`. Add to `services/subscription/entitlement-jwt.keys.ts` a `redactForLog()` helper used in any error log that mentions the key. |
| 2.6 | Key rotation 2-key window | ✅ pass | — | Architecture §4 specifies `ENTITLEMENT_PRIVATE_KEY_PREV` as optional second slot; FE imports both pubkeys, tries current then prev. | n/a |
| 2.7 | `trustedTime` claim — clock-rewind defense | ⚠ partial | **P2** | FE check is client-trust bounded — a modified app binary can strip the check. Server-side defense is the SSOT (every gated API call re-derives state from DB). **PASS** but: ADD a server-side check on `/auth/refresh` — if device sends a `If-Trusted-Time` header from cached IDB value and that value is >48h old, force re-issue with shorter TTL (defense against rotated clocks). | `services/subscription/entitlement-jwt.service.ts` — optional enhancement; document as known-limitation. |
| 2.8 | Pubkey route public-readable | ✅ pass | — | `/api/auth/entitlement-pubkey` is intentionally public (FE needs it pre-auth in some flows). Pubkey by definition non-secret. **CONFIRM:** route NEVER returns private key even on error. | `routes/auth/entitlement-pubkey.route.ts` — read only `ENTITLEMENT_PUBLIC_KEY` env, never `_PRIVATE_KEY`. |
| 2.9 | JWT in IDB only, not localStorage | ✅ pass | — | Architecture §4 + OFFLINE_RULES rule 4 ban localStorage for entity data. `entitlement-idb.ts` is Dexie-backed. | n/a |
| 2.10 | Logout clears IDB entitlement | ✅ pass | — | Architecture §4 says "Cleared on logout (existing logout flow clears all IDB)." **CONFIRM:** add explicit `await entitlementIdb.clear()` in logout handler — don't rely on global IDB wipe alone. | `src/lib/auth.ts` (logout path) — explicit clear call. |

---

## 3. Authz on admin-grant routes

| # | Check | Status | Severity | Finding | Fix |
|---|-------|--------|----------|---------|-----|
| 3.1 | super-admin only (not just admin) | ❌ MISSING | **P1** | Architecture says "AdminUser session required" — but HisaabPro has admin/super-admin role split (per security_defaults: `requireSuperAdmin` middleware exists). Comp-grant gives PRO_MAX = financial value; MUST be `requireSuperAdmin`, not `requireAdmin`. | `routes/admin/subscriptions.admin.ts` — mount with `requireSuperAdmin` middleware. Verify middleware exists in HP (port from DH if not). |
| 3.2 | Rate limit on grant routes | ❌ MISSING | **P1** | No rate limiter listed in architecture for `POST /admin/subscriptions/:businessId/grant`. A compromised admin token could iterate the business table and grant PRO_MAX to all. | `routes/admin/subscriptions.admin.ts` — apply `createRateLimiter({ windowMs: 60_000, max: 10, keyFn: req => 'rl:admin:grant:' + req.user.userId })`. |
| 3.3 | Cannot grant to self | ❌ MISSING | **P1** | A super-admin who is ALSO an owner of a Business could grant their own business PRO_MAX. Even if super-admins are HisaabPro staff today, defense-in-depth: reject if `req.user.userId` is in `BusinessUser` for the target `businessId`. | `services/subscription/subscription-admin.service.ts` — pre-check: `SELECT 1 FROM "BusinessUser" WHERE businessId=$target AND userId=$admin LIMIT 1` → if exists, throw `FORBIDDEN_SELF_GRANT`. |
| 3.4 | Immutable audit ledger | ✅ pass — strengthen | **P2** | `SubscriptionEvent` is append-only by convention (no UPDATE/DELETE in writer). **Strengthen:** add Postgres trigger that REVOKES UPDATE/DELETE from app role on `SubscriptionEvent` so even a SQL-injection or buggy code path can't tamper. Belt-and-braces. | `prisma/migrations/20260515_subscription_port_new_tables/migration.sql` — append `REVOKE UPDATE, DELETE ON "SubscriptionEvent" FROM PUBLIC;` (or app role specifically). |
| 3.5 | operatorId + reason fields validated | ⚠ partial | **P2** | Scope §AdminGrantReq shows `reason: string` — but no max-length, no non-empty enforcement. A 1MB reason field = DoS. | `schemas/subscription.schemas.ts` — `reason: z.string().min(8).max(500)` + log `grantedByAdminId` in `SubscriptionEvent.metadata.operatorId`. |
| 3.6 | grant amount sanity | ⚠ partial | **P2** | `months: 1–36` per scope contract — confirm Zod validation enforces this. | `schemas/subscription.schemas.ts` — `months: z.number().int().min(1).max(36)`. |
| 3.7 | Admin route IP allowlist | ⚠ optional | **P3** | DH security_defaults notes "ipWhitelist middleware on all `/api/admin/*` mounts; production fail-closed if `ADMIN_IP_WHITELIST` env unset." HisaabPro per-CLAUDE.md doesn't yet enumerate this. If HP has the middleware, mount it; if not, file as backlog. | Backlog: add `ADMIN_IP_WHITELIST` perimeter once HP admin-panel matures. |

---

## 4. State-machine writer SSOT

| # | Check | Status | Severity | Finding | Fix |
|---|-------|--------|----------|---------|-----|
| 4.1 | Single writer = only path to Subscription state column | ⚠ verify | **P1** | The SSOT only holds if NO OTHER code path writes `subscriptionState`. Pre-existing `razorpay.service.ts` (subscription create/cancel) and `razorpay-webhook.service.ts` (5 event handlers) currently call `prisma.subscription.update` directly. Architecture says these are rewritten to go through writer — but the writer SSOT contract must be **enforced mechanically**, not just by convention. | Add `scripts/enforce.js` pattern: ban `prisma.subscription.update` / `upsert` outside `services/subscription/subscription.writer*.ts` allowlist. Same pattern for `prisma.subscriptionEvent.create` (writer-only). |
| 4.2 | Advisory lock per-business (not global) | ⚠ verify | **P2** | See §1.10 — `hashtext` 32-bit collision risk. Move to `hashtextextended`. | (same as 1.10) |
| 4.3 | Transaction wraps state-change + event-insert | ✅ pass | — | Architecture §5 specifies single `$transaction`. | n/a |
| 4.4 | Side-effect ordering (notifications fired AFTER commit) | ⚠ verify | **P2** | If `push_fanout` / notification side-effects fire INSIDE the transaction, a rollback after notification = phantom event sent to user. | `services/subscription/subscription.writer.ts` — collect side-effects in array; fire AFTER `$transaction` resolves. Pattern: `const sideEffects = await prisma.$transaction(...); for (const fx of sideEffects) await fx()`. |

---

## 5. Idempotency + replay

| # | Check | Status | Severity | Finding | Fix |
|---|-------|--------|----------|---------|-----|
| 5.1 | `idempotencyCheck` middleware on state-changing routes | ⚠ verify | **P1** | Scope 17-Q answer 16 says "idempotencyCheck + replayProtection on all mutation routes." Architecture file plan does NOT show this middleware applied per-route. | `routes/subscription.ts` + `routes/subscription/mandate.routes.ts` + `routes/admin/subscriptions.admin.ts` — every POST/PATCH/DELETE mounts `idempotencyCheck()`. Confirm middleware exists in HP; port from DH if not. |
| 5.2 | `replayProtection` on high-stakes routes | ⚠ verify | **P2** | Checkout, upgrade, cancel — replay protection (timestamp-signed request). | Same routes — mount `replayProtection()`. |
| 5.3 | Webhook idempotency | ✅ pass | — | `SubscriptionEvent.razorpayEventId @unique`. | n/a |

---

## 6. Money handling

| # | Check | Status | Severity | Finding | Fix |
|---|-------|--------|----------|---------|-----|
| 6.1 | All amounts paise Int | ✅ pass | — | Scope confirms. `FeatureAddon.priceMonthly Int (paise)`. | n/a |
| 6.2 | No float / no parseFloat on Razorpay payloads | ⚠ verify | **P2** | Razorpay webhook payloads carry `amount` as integer paise. Writer must NEVER `Number(payload.amount)` — must `parseInt(payload.amount, 10)` with overflow guard (`< Number.MAX_SAFE_INTEGER`). | `services/razorpay-webhook.service.ts` — explicit Int parse with bounds check. |
| 6.3 | Currency lock | ✅ pass | — | INR-only per scope. Reject any payload where `payload.currency !== 'INR'`. | `services/razorpay-webhook.service.ts` — explicit check. |

---

## 7. PII / logging

| # | Check | Status | Severity | Finding | Fix |
|---|-------|--------|----------|---------|-----|
| 7.1 | Razorpay subId OK to log | ✅ pass | — | Non-PII identifier. | n/a |
| 7.2 | UPI VPA / card last-4 mask | ❌ MISSING | **P2** | `UpiMandate.upiVpa` stored raw — that's fine in DB (encrypted at rest). BUT: if it ever flows to `logger.info({ ...mandate })`, the VPA leaks to log aggregator. | `services/subscription/upi-mandate.service.ts` — `maskVpa(vpa: string): string` helper (`abc***@upi`); use in all log calls. ADD lint pattern: ban raw `upiVpa` in logger args. |
| 7.3 | Email mask in notifications | ✅ pass | — | Per security_defaults, notification.service already masks. | n/a |
| 7.4 | JWT contents in logs | ❌ MISSING | **P1** | `entitlement-jwt.service.ts` will likely have `logger.debug({ token })` during dev. The token contains `features`, `tier`, `bid` — leaking signed feature flags lets an attacker enumerate plan caps. **Critical:** sign-output must NEVER be in any logger call. | `services/subscription/entitlement-jwt.service.ts` — code review: zero `logger.*` calls receiving the JWT string. Add enforce.js pattern: ban `logger.*` with arg matching `/jwt|token|sign/i` in any subscription service file. |

---

## 8. Tenant scoping

| # | Check | Status | Severity | Finding | Fix |
|---|-------|--------|----------|---------|-----|
| 8.1 | All new Prisma queries scoped by businessId | ⚠ verify | **P1** | Per security_defaults: every Prisma query on user-owned data MUST scope by businessId in BOTH `findFirst` AND subsequent `update`/`delete` (TOCTOU defense). The writer flow's lookup + advisory-lock + update pattern must enforce this. | All `services/subscription/*.ts` — code review checklist: every `prisma.{model}.{find,update,delete}` includes `where: { businessId }` (or `id` + `businessId` composite). |
| 8.2 | Webhook resolves businessId from razorpaySubId (not from request body) | ⚠ verify | **P1** | Razorpay webhook body has no req.user. Architecture says lookup via `subscriptionId` → DB → businessId. **Critical:** NEVER trust a `businessId` field in webhook payload — Razorpay doesn't send it, but a future malicious crafted payload could include `businessId: <victim>`. | `services/razorpay-webhook.service.ts` — businessId MUST be derived via `prisma.subscription.findFirst({ where: { razorpaySubscriptionId: payload.subscription_id } })` → `.businessId`. Reject if not found (404, log). |
| 8.3 | Mandate routes scope by businessId from session | ✅ pass — confirm | — | `req.user!.businessId` used (per HP convention). Confirm new routes use `req.user.userId` and `req.user.businessId` NOT `req.user.id`. | (per security_defaults) |
| 8.4 | Admin routes scope to `:businessId` param (validated against DB) | ⚠ verify | **P2** | `POST /admin/subscriptions/:businessId/grant` — confirm businessId is validated as existing + active before any writes. | `services/subscription/subscription-admin.service.ts` — `prisma.business.findUnique({ where: { id: businessId } })` first; throw 404 if absent. |

---

## 9. Race conditions

| # | Check | Status | Severity | Finding | Fix |
|---|-------|--------|----------|---------|-----|
| 9.1 | Trial expiry cron vs concurrent upgrade | ⚠ partial | **P2** | Cron fires `day31.reached.no_mandate` while user simultaneously hits `POST /checkout` → both want to write subscriptionState. Advisory lock per business serializes them. **Order matters:** if cron acquires lock first → user's transition path becomes `PAST_DUE → ACTIVE` (valid #13) instead of `TRIAL_NO_AUTOPAY → ACTIVE` (not in table → 409). User sees 409 error mid-checkout. | `services/subscription/subscription-state-machine.ts` — add transition `TRIAL_NO_AUTOPAY → payment.captured.full → ACTIVE` (currently missing — only PROMO_ACTIVE path is enumerated). Either add or document that the cron-then-upgrade sequence resolves cleanly via PAST_DUE intermediate. |
| 9.2 | Overflow grace cron vs concurrent downgrade | ⚠ partial | **P2** | Cron sets `isEnforced=true` on overflow-grace expiry; user simultaneously schedules `targetTier=FREE` downgrade for period-end. Both write to Subscription row → advisory lock serializes → final state correct. **PASS** but document. | n/a — confirm in writer.test.ts. |
| 9.3 | Two webhooks same `event_id` arriving concurrently | ✅ pass | — | Advisory lock + unique constraint = one wins, other returns idempotent. | n/a |
| 9.4 | Clock-skew between server and Razorpay (replay-age 5min window) | ⚠ partial | **P3** | If server clock is >5min behind, legitimate webhooks rejected as stale. NTP keeps it in <100ms in practice. Document. | n/a — operational concern. |

---

## 10. Mitigations summary

### P0 — none. **Gate 1 not aborted.**

### P1 — must-fix before Gate 2 close

| # | Item | Owner file |
|---|------|------------|
| P1-A | Webhook replay-age check (`created_at` ≤ 5min) | `services/razorpay-webhook.service.ts` |
| P1-B | Admin grant: `requireSuperAdmin` + rate-limit + self-grant guard | `routes/admin/subscriptions.admin.ts`, `services/subscription/subscription-admin.service.ts` |
| P1-C | Entitlement TTL decision (48h vs 24h) — Sawan sign-off | `services/subscription/entitlement-jwt.service.ts` |
| P1-D | Writer SSOT enforced mechanically (enforce.js pattern bans direct `prisma.subscription.update` outside writer allowlist) | `scripts/enforce.js` |
| P1-E | Idempotency middleware applied to all subscription mutation routes | `routes/subscription.ts`, `routes/subscription/mandate.routes.ts`, `routes/admin/subscriptions.admin.ts` |
| P1-F | Tenant scoping: businessId resolved server-side from razorpaySubscriptionId in webhooks (never trust payload-supplied businessId) | `services/razorpay-webhook.service.ts` |
| P1-G | JWT never in logs (enforce.js pattern + code review) | `scripts/enforce.js`, `services/subscription/entitlement-jwt.service.ts` |
| P1-H | Tenant scoping check on all new Prisma queries | All `services/subscription/*.ts` |

### P2 — must-fix before Gate 6 ship

| # | Item | Owner file |
|---|------|------------|
| P2-A | `event_id` presence validated before idempotency insert | `services/razorpay-webhook.service.ts` |
| P2-B | Advisory lock 64-bit (`hashtextextended`) | `services/subscription/subscription.writer.ts` |
| P2-C | `uid` claim dropped from JWT if FE doesn't need it | `services/subscription/entitlement-jwt.service.ts` |
| P2-D | Postgres `REVOKE UPDATE, DELETE ON "SubscriptionEvent"` | `prisma/migrations/20260515_subscription_port_new_tables/migration.sql` |
| P2-E | `reason` field Zod min(8) max(500); `months` int 1–36 | `schemas/subscription.schemas.ts` |
| P2-F | Side-effects fire AFTER transaction commit | `services/subscription/subscription.writer.ts` |
| P2-G | UPI VPA mask in all log paths | `services/subscription/upi-mandate.service.ts` |
| P2-H | replayProtection on checkout/upgrade/cancel | route files |
| P2-I | Razorpay payload amount: explicit Int parse + currency=INR check | `services/razorpay-webhook.service.ts` |
| P2-J | Admin businessId validated against Business table | `services/subscription/subscription-admin.service.ts` |
| P2-K | TRIAL_NO_AUTOPAY → payment.captured.full transition added or documented | `services/subscription/subscription-state-machine.ts` |
| P2-L | Audience + issuer pinned in FE JWT verify call | `features/subscription/entitlement-verify.utils.ts` |
| P2-M | Server-side `If-Trusted-Time` defense on /auth/refresh | `services/subscription/entitlement-jwt.service.ts` |
| P2-N | Explicit IDB clear on logout | `src/lib/auth.ts` |

### P3 — backlog

| # | Item |
|---|------|
| P3-A | Admin IP allowlist (`ADMIN_IP_WHITELIST`) once HP admin panel matures |
| P3-B | NTP/clock-skew operational alert |
| P3-C | Future: instant revocation via Redis or DB blocklist (when TTL pain felt) |
| P3-D | Future: refund flow state-machine triggers |

---

## 11. Threat scenarios walked

### Scenario A — Compromised admin token
- Attacker gets super-admin session cookie (XSS on admin panel).
- WITHOUT mitigations: grants self PRO_MAX comp, indefinite period.
- WITH P1-B mitigations: rate-limit (10/min) + self-grant guard + audit ledger (immutable, see P2-D).
- WITH SubscriptionEvent immutable + super-admin rate-limited: detectable in 10min via audit log scan.

### Scenario B — Replayed webhook
- Attacker captures a valid `subscription.activated` webhook (e.g. via compromised log aggregator).
- Re-fires it 30 days later.
- WITHOUT P1-A: signature still valid, event_id unique check blocks state change, BUT non-state-changing side-effects (re-issued entitlement, notifications) may re-fire.
- WITH P1-A (replay-age 5min): rejected immediately.

### Scenario C — Offline grace abuse
- User pays for PRO, gets 48h JWT, immediately cancels via mandate revoke.
- Goes airplane mode for 48h, continues using PRO features.
- WITH 48h TTL: max abuse window = 48h × `monthlyFee/30` ≈ ₹16 loss per cancel-and-abuse cycle. Bounded.
- WITH 24h TTL: halved to ₹8.
- Verdict: acceptable per scope, but 24h tightens the loop at zero UX cost.

### Scenario D — Clock-rewind device
- User sets device clock to T0 (when JWT was issued), then T0+1ms, repeats.
- WITHOUT trustedTime check: JWT never expires from FE perspective.
- WITH trustedTime + monotonic clock check: detected if `Date.now() < storedTrustedTime - 60s`.
- WITH server SSOT on every gated API call: on reconnect, server gates regardless of JWT. Defense-in-depth holds.

### Scenario E — Tenant cross-contamination via webhook
- Attacker registers their own business + Razorpay subscription.
- Crafts a webhook payload claiming `businessId: <victim>` in body.
- WITHOUT P1-F: writer trusts body, grants victim PRO.
- WITH P1-F (lookup via `razorpaySubscriptionId` only): payload businessId ignored; lookup returns attacker's businessId; victim untouched.

---

## 12. Blocker statement

**No P0 blockers. Gate 1 is APPROVED to advance, conditional on:**

1. Sawan decides P1-C (48h vs 24h entitlement TTL) before Gate 2 close.
2. All P1 items (A-H) are tracked as Gate 2 acceptance criteria and verified by `task-manager` before Gate 2 → Gate 3 handoff.
3. P2 items folded into Gate 6 ship checklist.
4. The architect's transition table re-checked for the missing TRIAL_NO_AUTOPAY → payment.captured.full path (P2-K).

---

## Appendix — OWASP Top 10 mapping

| OWASP 2021 | Coverage | Findings |
|------------|----------|----------|
| A01 Broken Access Control | §3 Admin grant + §8 Tenant scoping | P1-B, P1-F, P1-H |
| A02 Cryptographic Failures | §2 JWT | P1-C, P2-E key handling |
| A03 Injection | All Zod schemas + Prisma parameterized | covered by HP defaults |
| A04 Insecure Design | §4 Writer SSOT + §9 Race conditions | P1-D, P2-F |
| A05 Security Misconfiguration | §1.2 Fail-closed + §2.5 key storage | covered |
| A06 Vulnerable Components | (npm audit baseline) | n/a this round |
| A07 ID & Auth Failures | §2 JWT + §3 Admin | P1-B, P1-C |
| A08 Software & Data Integrity | §3.4 Immutable audit ledger | P2-D |
| A09 Logging Failures | §7 PII / logs | P1-G, P2-G |
| A10 SSRF | n/a (no user-supplied URLs in scope) | — |

**End of audit.**
