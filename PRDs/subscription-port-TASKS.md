# TASKS: subscription-port

**Mission slug:** subscription-port
**Date:** 2026-05-15
**Status:** READY FOR BUILD (all prerequisites approved)
**Authors:** scope-writer, architect, security

---

## Overview

Sequenced build breakdown for porting DudhHisaab subscription engine to HisaabPro. This document is the **work order** for Phase 3 build agents. Every gate has explicit proof requirements (curl, tsc, screenshots, console) before advancing.

### Gate Flow

```
Gate 0 (Prep)
    ↓
Gate 1 (DB — Database-Manager)
    ↓
Gate 2 (API — API-Builder) ← Proof: tsc clean + curl 200/401/400
    ↓
Gate 3 (Admin — API-Builder)
    ↓
Gate 4 (FE — Frontend-Builder) ← Proof: screenshots (4 states × 5 pages × 4 viewports) + console clean
    ↓
Gate 5 (Verify — Verifier Agent) ← Proof: tsc all + curl all + screenshots all + enforce.js clean
    ↓
Gate 6 (QA — qa) ← 8 P1 security acceptance criteria + functional T1-T6
```

---

## Gate 0 — Prep (mechanical, non-agent)

**Owner:** task-manager (no coding — setup only)

### Checklist

- [ ] `.env.example` updated with:
  - `RAZORPAY_PLAN_PRO_MAX=<placeholder>`
  - `ENTITLEMENT_PRIVATE_KEY=<PEM placeholder>`
  - `ENTITLEMENT_PUBLIC_KEY=<PEM placeholder>`
  - `ENTITLEMENT_KEY_PREV=<optional backup>`
  - `RAZORPAY_MERCHANT_VPA=<upi-id@bank>`
  - `RAZORPAY_MERCHANT_NAME=<business-name>`
  - `SUBSCRIPTION_OVERFLOW_GRACE_DAYS=3`
  - `SUBSCRIPTION_GRACE_PERIOD_DAYS=7`

- [ ] `scripts/enforce.js` patterns added:
  - Ban `prisma.subscription.update` / `prisma.subscription.upsert` outside `/services/subscription/subscription.writer*.ts` allowlist (7 files allowed).
  - Ban `prisma.subscriptionEvent.create` outside writer allowlist.
  - Ban raw `fetch(` in `src/features/subscription/**` — enforce `api()` wrapper (per OFFLINE_RULES).
  - Ban `localStorage.setItem` in subscription feature code.
  - Ban JWT/token strings in logger calls (pattern: `logger.*({ ... (token|jwt) ... })`).
  - Ban unmasked VPA in logger calls (pattern: `logger.*({ upiVpa: ... })`).
  - Warn on `PRO` tier references missing `PRO_MAX` equality check in `minTierFor()` conditionals.

- [ ] `docs/BUGS.md` — confirm no conflicts with subscription-adjacent work.

- [ ] `.claude/design-plan-active.md` seeded with:
  - `status: approved`
  - `agents_invoked: [scope-writer, architect, security, task-manager]`
  - `created:` ISO now
  - Paths listed under `high_risk_paths_touched:`

**Gate exit:** all above marked done. **Blocker:** none (mechanical only).

---

## Gate 1 — DB (Database-Manager agent)

**Owner:** DudhHisaab-Database-Manager
**Reads:** Architecture §2 (migration sequence)
**Writes:** server/prisma/schema.prisma + 5 migration files

### Migration sequence (strict order — every step separate `prisma migrate dev`)

| Step | Migration name | Type | What | Status |
|------|---|---|---|---|
| 1.1 | `20260515_subscription_port_columns_nullable` | ALTER | Add 9 columns NULLABLE to `Subscription` (subscriptionState, gracePeriodEndsAt, mandateId, lastWebhookEventId, autoRenew, nextBillingAt, paymentMethod, trialEndsAt, overflowGraceUntil) + 2 NEW columns (pendingDowngradeTier String?, lastEntitlementIssuedAt DateTime?) | [ ] |
| 1.2 | `20260515_subscription_port_backfill` | DATA | `UPDATE "Subscription" SET "subscriptionState" = CASE WHEN status='ACTIVE' THEN 'ACTIVE' ... ELSE 'NONE' END WHERE "subscriptionState" IS NULL`; `UPDATE "Subscription" SET "autoRenew"=true WHERE "autoRenew" IS NULL` | [ ] |
| 1.3 | `20260515_subscription_port_columns_notnull` | ALTER | `ALTER COLUMN "subscriptionState" SET NOT NULL DEFAULT 'NONE'`; `ALTER COLUMN "autoRenew" SET NOT NULL DEFAULT true`; leave others nullable | [ ] |
| 1.4 | `20260515_subscription_port_indexes` | INDEX | Add indexes: `@@index([subscriptionState])`, `@@index([gracePeriodEndsAt])`, `@@index([nextBillingAt])` on Subscription | [ ] |
| 1.5 | `20260515_subscription_port_new_tables` | CREATE | Create `SubscriptionEvent`, `FeatureAddon`, `BusinessAddon`, `UpiMandate` tables + relations + indexes (UNIQUE on `SubscriptionEvent.razorpayEventId` sparse, UNIQUE composite on `BusinessAddon(businessId, addonId)`, UNIQUE on `FeatureAddon.name`). Add Postgres trigger `REVOKE UPDATE, DELETE ON "SubscriptionEvent"`. | [ ] |

### Per-step workflow

1. Edit `schema.prisma` for step only (do NOT add step 2-5 ahead of time).
2. Run `npx prisma migrate dev --name <name>`.
3. Inspect `prisma/migrations/<ts>_<name>/migration.sql` — verify correctness.
4. Commit schema + migration in one commit.
5. Verify: `SELECT COUNT(*) FROM "SubscriptionEvent" LIMIT 1` returns 0 (no error).

### Validation checklist

- [ ] `npx prisma migrate status` shows all 5 migrations applied cleanly.
- [ ] `npx tsc -b --noEmit` in server — 0 errors (schema types generated).
- [ ] `npx prisma db seed` runs (if seed script exists; else skip).
- [ ] Reversibility: each migration has a corresponding `down()` path documented in the migration file (comment).
- [ ] `SELECT * FROM "Subscription" LIMIT 1` includes new columns (all returned as NULL or default, not error).

**Gate exit:** all 5 migrations applied. Schema compiles. `prisma migrate status` clean.
**Proof file:** `.claude/gate-1-proof.md` with migration list + `prisma migrate status` output.
**Blocker:** if any migration fails to apply or `tsc` breaks — STOP, revert, fix, retry.

---

## Gate 2 — API Core (API-Builder / backend agent)

**Owner:** DudhHisaab-API-Builder
**Reads:** SCOPE.md + ARCHITECTURE.md (state-machine, writer SSOT) + SECURITY.md (all P1 items)
**Writes:** 34 BE files (see architecture §8 file plan rows 7-41)

### Build order (layer-wise, smallest first)

#### Phase 2a — Types + Constants (no dependencies)

| File | Lines | Content |
|------|-------|---------|
| `server/src/services/subscription/subscription.types.ts` | ~60 | `SubscriptionState` enum, `StateTransition`, `SubscriptionEvent` shape, `MandateStatus`, etc. |
| `server/src/services/subscription/subscription.constants.ts` | ~40 | State machine transitions table, TTL constants, grace-period defaults |
| `server/src/config/plans.ts` | +40 | Add `PRO_MAX: { monthlyInr, quarterlyInr, annualInr, features: {...} }` |
| `server/src/lib/env.ts` | +25 | Add 7 env vars: `RAZORPAY_PLAN_PRO_MAX`, `ENTITLEMENT_PRIVATE_KEY` (optional), `ENTITLEMENT_PUBLIC_KEY` (optional), etc. — all zod-schemaed, no `.default()` on keys (use `.optional()`) |

**Checkpoint 2a-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors
```

#### Phase 2b — Pure state machine (no Prisma, no network)

| File | Lines | Content |
|------|-------|---------|
| `server/src/services/subscription/subscription-state-machine.ts` | ~110 | `transitionState(fromState, trigger): toState` function + transition validation table (19 transitions, 5 invalid-transition rejections return 409). Unit-testable, zero side-effects. **SECURITY P1-D:** enforce.js bans imports here by accident; this is pure. |
| `server/src/services/subscription/subscription.writer.events.ts` | ~140 | `applyEvent(tx, eventData)` orchestrator: calls state machine, emits side-effect array (set_grace, clear_grace, cancel_other_active, enqueue_invoice, push_fanout), builds `SubscriptionEvent` payload. All side-effects are pure descriptions (returned array), NOT executed inside. **SECURITY P2-F:** side-effects AFTER commit, not during. |

**Tests needed here (tracked as separate agent deliverables):**
- `server/src/services/subscription/__tests__/state-machine.test.ts` (~180 lines) — all 19 transitions + 5 invalid rejections.
- `server/src/services/subscription/__tests__/writer.test.ts` (~140 lines) — idempotency (duplicate razorpayEventId = 1 row).

**Checkpoint 2b-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors

npm run test -- state-machine.test.ts
# output: 19 pass, 5 pass (invalid), 0 fail

npm run test -- writer.test.ts
# output: idempotency pass, 0 fail
```

#### Phase 2c — Services (orchestration layer)

| File | Lines | Purpose | P1 tie-in |
|------|-------|---------|-----------|
| `server/src/services/subscription/entitlement-jwt.keys.ts` | ~70 | Load + cache RSA keys from env, expose `getPrivateKey()` / `getPublicKey()`. **SECURITY P2-C:** no PII in logs (redact helper). | P1-C |
| `server/src/services/subscription/entitlement-jwt.service.ts` | ~110 | `signToken(subscription)` using private key (RS256, 48h TTL, includes `trustedTime` claim). **SECURITY:** TTL decision (48h vs 24h) — Sawan sign-off required. If unset key, return `null` (degraded). | P1-C |
| `server/src/services/subscription/subscription.writer.ts` | ~70 | SSOT entry point: `applySubscriptionEvent(eventData, businessId)` — calls state-machine, calls writer-events to build side-effect array, wraps in `$transaction` with advisory lock, fires side-effects AFTER. **SECURITY P2-B:** use 64-bit `hashtextextended()` for lock. **SECURITY P1-E:** wrapped with `idempotencyCheck` middleware by route layer. | P1-D, P2-B, P2-F |
| `server/src/services/subscription/upi-mandate.service.ts` | ~130 | `createMandate(subscription)` → call Razorpay, return `{ mandateId, upiIntentUrl }`. `revokeMandate(mandateId)`. **SECURITY P2-G:** mask VPA in all logger calls. | P2-G |
| `server/src/services/subscription/upi-intent.utils.ts` | ~50 | `buildUpiDeepLink(vpa, amount, note)` → returns `upi://pay?...` URL (pure util). |  |
| `server/src/services/subscription/checkout-session.service.ts` | ~130 | `createCheckoutSession({ tier, billingCycle, couponCode?, businessId })` → call Razorpay Subscriptions API, return `{ subscriptionId, checkoutUrl, amount }`. Wrap with 8s timeout + 1 retry (risk §4). | Risk 4 |
| `server/src/services/subscription/downgrade.service.ts` | ~100 | `scheduleDowngrade({ targetTier, effectiveAt })` → call Razorpay to schedule change at period_end, set `pendingDowngradeTier` on Subscription. |  |
| `server/src/services/subscription/addon.service.ts` | ~110 | `grantAddon(businessId, addonId, expiresAt?)` → insert `BusinessAddon` row. `revokeAddon(businessId, addonId)`. |  |
| `server/src/services/subscription/addon.queries.ts` | ~70 | `getActiveAddons(businessId)` → `BusinessAddon[]` (read-only). |  |
| `server/src/services/subscription/subscription-admin.service.ts` | ~90 | `grantComparable({ businessId, tier, months, reason, adminId })` → validate inputs + trigger state machine via writer. **SECURITY P1-B:** `requireSuperAdmin` validation, self-grant guard, rate-limit applied upstream in route. **SECURITY P2-E:** reason min(8) max(500), months int 1–36. **SECURITY P2-J:** validate `businessId` exists in DB. | P1-B, P2-E, P2-J |
| `server/src/services/subscription/overflow-grace.service.ts` | ~80 | `recordOverflow(businessId)` → set `overflowGraceUntil = now + 3 days` (configurable). `checkOverflow(businessId)` → boolean. |  |
| `server/src/services/subscription/ensure-free-subscription.ts` | ~40 | Helper: if no Subscription row for business, insert FREE tier row with sensible defaults. Called at business-create time. |  |
| `server/src/services/subscription/cron-grace-expiry.ts` | ~80 | Cron handler (06:00 IST): `sweep PAST_DUE where gracePeriodEndsAt < now` → trigger `grace.expired` → LOCKED. Use cursor loop `take: 500`. Idempotent (run it 10x, same result). | |
| `server/src/services/subscription/cron-trial-end.ts` | ~60 | Cron handler (07:00 IST): `sweep TRIAL_NO_AUTOPAY where trialEndsAt < now` → trigger `day31.reached.no_mandate` → PAST_DUE. Cursor loop `take: 500`. | P2-K |
| `server/src/services/subscription/cron-mandate-reminder.ts` | ~60 | Cron handler (08:00 IST): `sweep UpiMandate.status=PENDING where createdAt < 24h ago` → enqueue notification `mandate_pending_24h`. No state change. | |

**Checkpoint 2c-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors

node scripts/enforce.js
# output: 0 errors (no forbidden prisma.subscription.update outside writer, no raw fetch in features/subscription, no JWT in logs, etc.)
```

#### Phase 2d — Schemas + Middleware updates

| File | Lines | Purpose | P1 tie-in |
|------|-------|---------|-----------|
| `server/src/schemas/subscription.schemas.ts` | ~90 | Zod schemas: `CheckoutReqSchema`, `PlanChangeReqSchema`, `AdminGrantReqSchema` (reason min 8 max 500, months 1–36), etc. Used by route handlers. | P2-E |
| `server/src/middleware/subscription-gate.ts` | +90 | Extend existing middleware: read `subscriptionState` from DB (not client), honor `gracePeriodEndsAt` during grace window, overlay `BusinessAddon.features` on plan features, return 402 UPGRADE_REQUIRED / QUOTA_EXCEEDED / 409 on invalid state. **SECURITY:** all businessId scoping from authenticated user, never from request body. | P1-H |
| `server/src/lib/cron-scheduler.ts` | +30 | Register 3 new cron jobs in the job list (grace-expiry, trial-end, mandate-reminder) — reuse existing subscription-expiry schedule slot for grace-expiry. |  |

**Checkpoint 2d-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors
```

#### Phase 2e — Routes (HTTP layer)

| File | Lines | Purpose | P1 tie-in |
|------|-------|---------|-----------|
| `server/src/routes/subscription.ts` | +110 | **EXISTING route, extended.** Add endpoints: `POST /subscription/checkout`, `PATCH /subscription/plan`, `DELETE /subscription`, `POST /subscription/reactivate`. Extend `GET /api/businesses/:businessId/subscription` response with `state`, `graceUntil`, `mandateStatus`, `addons`, `offlineToken`. Mount `idempotencyCheck()` on all mutations. **SECURITY P1-E:** every POST/PATCH/DELETE wrapped. **Note:** keep final file ≤250L; split mandate routes to `routes/subscription/mandate.routes.ts` (see below). | P1-E |
| `server/src/routes/subscription/mandate.routes.ts` | ~90 | **NEW sub-router.** Routes: `POST /subscription/mandate/create`, `DELETE /subscription/mandate`, `GET /subscription/mandate/status`. Mount `idempotencyCheck()`. Mounted under main `/subscription` router via `app.use('/api/subscription', mandateRoutes)`. | P1-E |
| `server/src/routes/admin/subscriptions.admin.ts` | ~110 | **NEW admin routes.** `POST /admin/subscriptions/:businessId/grant`, `POST /admin/subscriptions/:businessId/revoke`. Mount `requireSuperAdmin()` middleware **before route handlers** (not within). Mount 10/min rate limiter (per admin ID). **SECURITY P1-B:** all mitigations enforced here. **SECURITY P1-F:** businessId from `:param`, not body. | P1-B, P1-E, P1-F |
| `server/src/routes/auth/entitlement-pubkey.route.ts` | ~30 | **NEW public route.** `GET /api/auth/entitlement-pubkey` → returns `{ publicKey: <PEM>, algorithm: 'RS256' }`. No auth required (FE fetches at boot). Read ONLY from `ENTITLEMENT_PUBLIC_KEY` env, never `_PRIVATE_KEY`. | |

**Checkpoint 2e-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors

# curl checks
curl -X GET http://localhost:4000/api/auth/entitlement-pubkey
# output: { "success": true, "data": { "publicKey": "-----BEGIN PUBLIC KEY-----\n...", "algorithm": "RS256" } }

curl -X GET http://localhost:4000/api/businesses/test-biz-id/subscription
# output: { "success": true, "data": { "state": "ACTIVE", "graceUntil": null, ... } } — with auth
# or 401 — without auth

curl -X POST http://localhost:4000/api/subscription/checkout -H 'Content-Type: application/json' -d '{}'
# output: { "success": false, "error": { "code": "VALIDATION_ERROR", "status": 400, ... } }

curl -X DELETE http://localhost:4000/api/subscription
# output: 401 (no auth) or 200 (with auth, subscription cancelled)
```

#### Phase 2f — Webhook integration

| File | Lines | Purpose | P1 tie-in |
|------|-------|---------|-----------|
| `server/src/services/razorpay-webhook.service.ts` | +70 | **EXISTING service, modified.** Replace all direct `prisma.subscription.update()` calls with calls to `subscription.writer.applySubscriptionEvent()`. Add replay-age check: if `payload.created_at < now - 300s`, return 200 idempotent. **SECURITY P1-A:** timestamp ≤ 5min. Validate `payload.id` is present + non-empty, else 400. **SECURITY P2-I:** amount parse as Int + currency='INR' check. **SECURITY P1-F:** businessId resolved via `prisma.subscription.findFirst({ where: { razorpaySubscriptionId: payload.subscription_id } })` (never from payload body). Reject 404 if not found (log, no state change). | P1-A, P2-I, P1-F |

**Checkpoint 2f-1:** (webhook testing deferred to integration; curl test in 2e covers happy path)

### Acceptance criteria for Gate 2

- [ ] `npx tsc -b --noEmit` in server → 0 errors
- [ ] `node scripts/enforce.js` → 0 errors (all patterns configured in Gate 0 pass)
- [ ] `npm run test -- state-machine.test.ts` → 19 + 5 pass
- [ ] `npm run test -- writer.test.ts` → idempotency pass
- [ ] **curl GET /api/auth/entitlement-pubkey** → 200 `{ publicKey, algorithm }`
- [ ] **curl GET /api/businesses/:businessId/subscription** (WITH valid auth) → 200 `{ state, graceUntil, offlineToken, ... }`
- [ ] **curl GET /api/businesses/:businessId/subscription** (WITHOUT auth) → 401 `{ error: { code: 'UNAUTHORIZED', status: 401 } }`
- [ ] **curl POST /api/subscription/checkout** (invalid body) → 400 `{ error: { code: 'VALIDATION_ERROR', status: 400 } }`
- [ ] **curl DELETE /api/subscription** (no auth) → 401
- [ ] `routes/subscription.ts` final file size ≤ 250 lines (after +110 modification)
- [ ] All P1 items traced to code locations + reviewed:
  - [ ] P1-A: `razorpay-webhook.service.ts` has `created_at` ≤ 5min check
  - [ ] P1-B: `routes/admin/subscriptions.admin.ts` mounted with `requireSuperAdmin()` + rate-limit
  - [ ] P1-C: `entitlement-jwt.service.ts` TTL set to Sawan's decision (48h default, document override path)
  - [ ] P1-D: `scripts/enforce.js` pattern bans direct subscription.update outside writer
  - [ ] P1-E: All mutation routes mount `idempotencyCheck()` middleware
  - [ ] P1-F: `razorpay-webhook.service.ts` resolves businessId via Subscription lookup, not payload
  - [ ] P1-G: No logger calls contain JWT string (enforce.js verified)
  - [ ] P1-H: All new Prisma queries include businessId in WHERE (code review spot-check)

**Gate exit:** all acceptance criteria met + curl proofs saved to `.claude/gate-2-proof.md`.
**Blocker:** if any curl fails or `tsc` errors — STOP, fix, re-test.

---

## Gate 3 — Admin Routes (continuation of API-Builder)

**Owner:** DudhHisaab-API-Builder (same agent, Phase 2e already laid groundwork)
**Reads:** SECURITY.md §3 (admin authz) + SCOPE.md (admin-grant API contract)
**Writes:** already created in Gate 2e (`routes/admin/subscriptions.admin.ts`) — THIS GATE VALIDATES IT

### Validation checklist

- [ ] Route file exists: `server/src/routes/admin/subscriptions.admin.ts`
- [ ] **curl POST /admin/subscriptions/:businessId/grant** (with valid super-admin token):
  ```bash
  curl -X POST http://localhost:4000/api/admin/subscriptions/test-biz/grant \
    -H 'Authorization: Bearer <super-admin-token>' \
    -H 'Content-Type: application/json' \
    -d '{ "tier": "PRO_MAX", "months": 3, "reason": "support_comp" }'
  # output: { "success": true, "data": { "subscriptionId": "...", "tier": "PRO_MAX", "expiresAt": "...", "grantedBy": "..." } }
  ```

- [ ] Same endpoint **without super-admin token** → 403 `{ error: { code: 'FORBIDDEN', status: 403 } }`
- [ ] Rate-limit check: fire 11 requests in 60s → 11th returns 429 (rate-limited)
- [ ] Self-grant guard: admin attempts to grant their own business → 403 `FORBIDDEN_SELF_GRANT`
- [ ] `SubscriptionEvent.trigger = 'admin.force_activate'` written to DB
- [ ] `SubscriptionEvent.metadata` includes `operatorId` (admin ID) + `reason` (from request)

**Gate exit:** admin routes validated.
**Proof file:** append admin curl proofs to `.claude/gate-2-proof.md`.
**Blocker:** if 403 missing or rate-limit doesn't fire — STOP, fix.

---

## Gate 4 — Frontend Core (Frontend-Builder agent)

**Owner:** DudhHisaab-Frontend-Builder
**Reads:** SCOPE.md + ARCHITECTURE.md (offline contract §7, caching rules) + OFFLINE_RULES.md
**Writes:** 22 FE files (see architecture §8 file plan rows 43-65)

### Build order (layer-wise, same pattern as backend)

#### Phase 4a — Types + Constants + Utils (no hook dependencies)

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/subscription/subscription.types.ts` | ~80 | `SubscriptionResponse` interface (mirrors backend shape), `SubscriptionState` enum, etc. |
| `src/features/subscription/subscription.constants.ts` | ~40 | State labels, feature-list per tier, etc. |
| `src/features/subscription/plan-limits.ts` | +30 | Add `PRO_MAX: { invoices: Infinity, users: 50, ... }` — must stay in sync with `server/src/config/plans.ts` |
| `src/features/subscription/entitlement-idb.ts` | ~90 | Dexie store: `entitlementDb.entitlement.toCollection()` CRUD. Read/write token + trusted-time + clock-skew. |
| `src/features/subscription/entitlement-verify.utils.ts` | ~90 | `verifyToken(jwt, publicKey)` using WebCrypto. Checks `aud` + `iss` pinned (SECURITY P2-L). Checks clock-rewind (`device.now < trustedTime - 60s` → reject). Returns `{ valid, claims }` or `{ valid: false }`. |
| `src/features/subscription/entitlement-pubkey-loader.ts` | ~60 | Fetch `GET /api/auth/entitlement-pubkey` once at app boot, cache in IDB, re-import via `WebCrypto.importKey()`. Returns `CryptoKey` ready for verify. |
| `src/features/subscription/upi-intent.utils.ts` | ~30 | `parseUpiDeepLink(url)` + `openUpiApp(url)` on Android (window.location.href). |

**Checkpoint 4a-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors (in frontend dir)
```

#### Phase 4b — Hooks (use-Subscription extended + new hooks)

| File | Lines | Purpose |
|------|-------|---------|
| `src/hooks/useSubscription.ts` | +50 | **EXISTING hook, extended.** Return shape now includes `{ state: SubscriptionState, graceUntil: string\|null, mandateStatus: MandateStatus, addons: BusinessAddon[], offlineToken: string\|null }`. Reads from entitlement IDB if offline + JWT still valid; falls back to online fetch if offline + JWT expired. **OFFLINE RULE:** `cacheReads: true` on the GET call (safe to cache — business config, not PII). |
| `src/hooks/useEntitlementToken.ts` | ~90 | `useEntitlementToken()` → `{ token, expired, isOffline }`. Verifies cached JWT in IDB, checks expiry vs local time. On expired, clears IDB and returns `{ token: null, expired: true }`. |
| `src/hooks/useMandateStatus.ts` | ~70 | `useMandateStatus(mandateId?)` → `{ status: MandateStatus, isLoading, error }`. Polls `GET /api/subscription/mandate/status` while pending (30s stale-time). |

**Checkpoint 4b-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors
```

#### Phase 4c — Components (dumb → smart order)

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/subscription/AddonBadge.tsx` | ~40 | Badge: `<AddonBadge addon={addon} />` → "POS Mode" pill. Pure display. |
| `src/features/subscription/TierComparisonCard.tsx` | ~80 | Card showing 3-tier feature grid (PRO, BUSINESS, PRO_MAX). Reusable sub-component (used by UpgradeDrawer). |
| `src/features/subscription/PlanCard.tsx` | ~110 | Main plan card (current tier, next billing date, "Manage subscription" button). 4 UI states (loading, error, empty, success). **OFFLINE RULE:** uses `useSubscription` directly (has cacheReads). |
| `src/features/subscription/SubscriptionStateBanner.tsx` | ~90 | Sticky banner below header. Renders based on `state`: hidden for PROMO_ACTIVE/ACTIVE, shows info for TRIAL_NO_AUTOPAY, warning for PAST_DUE, error for LOCKED. Uses `useSubscription`. |
| `src/features/subscription/OverflowBanner.tsx` | ~60 | Inline banner (optional display). Shows "Monthly limit reached — X/Y. Upgrade before `<date>`" if `isGrace: true`. Hidden if no overflow. Uses `useSubscription`. |
| `src/features/subscription/MandateSetupDrawer.tsx` | ~130 | Modal drawer triggered from banner. Flow: (1) loading "Opening UPI app…", (2) spinner while pending, (3) success "Autopay active" or error "Retry". On success, opens UPI deep-link on Android. Uses `useMandateStatus` for polling. **OFFLINE RULE:** mandate create is online-only. |
| `src/features/subscription/UpgradeDrawer.tsx` | ~120 | Modal opened from PlanGate (when gated feature hit). Shows tier comparison cards + "Upgrade to X" CTA per selected tier. On click, calls `POST /api/subscription/checkout` (online-only). **OFFLINE RULE:** checkout online-only; doesn't queue. Has 4 UI states (loading, error, tier selection, success). |
| `src/features/subscription/PlanGate.tsx` | +20 | **EXISTING component, extended.** Existing fallback now handles `PRO_MAX` in `minTierFor()` checks. Passes `isGrace` prop to `UpgradePrompt`. |

All components:
- Use `t.keyName` from `useLanguage()` for all strings (EN + HI).
- Use semantic CSS variables (no hardcoded hex).
- Use design-system components (`<Button variant="primary">`, `<Card>`, `<Modal>`, etc.).
- 4 UI states at 320/375/768/1024 (tested via screenshots, see Gate 5).
- No raw `fetch()` — all API calls via `api()` wrapper.
- Mutations pass `entityType` + `entityLabel`.
- No `localStorage` writes.

**Checkpoint 4c-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors

node scripts/enforce.js
# output: 0 errors (no raw fetch in src/features/subscription, no localStorage, etc.)

node scripts/enforce-offline.mjs
# output: 0 errors (all api() calls have entityType+entityLabel for mutations)
```

#### Phase 4d — Page

| File | Lines | Purpose |
|------|-------|---------|
| `src/pages/SubscriptionManagePage.tsx` | ~210 | Full page mounted at `/settings/subscription`. Composes `PlanCard` + `MandateSetupDrawer` + `UpgradeDrawer` + billing history list. 4 UI states (loading, error, empty, success). **OFFLINE RULE:** reads from `useSubscription` (cached). |

#### Phase 4e — CSS + i18n

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/subscription/subscription.css` | ~60 | Styles for banners, modals, custom token overlays. All colors via `var(--color-*)`, all sizing via design tokens. Dark-mode parity (automatic via CSS var swap). |
| `src/lib/translations.en.ts` | +30 keys | Add: `subscription.titleManagePlan`, `subscription.stateTrialX days`, `subscription.statePastDue`, `subscription.actionUpgrade`, `subscription.actionSetupAutopay`, etc. — 30 new keys, sorted by feature area. |
| `src/lib/translations.hi.ts` | +30 keys | Same 30 keys, Hindi translations. |

**Checkpoint 4e-1:**
```bash
npx tsc -b --noEmit
# output: 0 errors
```

### Acceptance criteria for Gate 4

- [ ] `npx tsc -b --noEmit` (frontend) → 0 errors
- [ ] `node scripts/enforce.js` → 0 errors
- [ ] `node scripts/enforce-offline.mjs` → 0 errors
- [ ] `useSubscription` hook returns `{ state, graceUntil, offlineToken, mandateStatus, addons }`
- [ ] entitlement JWT verification rejects clock-rewind (`Date.now() < trustedTime - 60s`)
- [ ] IDB entitlement store populated on first online `/subscription` call
- [ ] All strings in new components via `t.keyName` from `useLanguage()`
- [ ] All API calls via `api()` from `@/lib/api` (zero raw `fetch(` in feature code)
- [ ] All mutations pass `entityType` + `entityLabel` (e.g., `entityType: 'subscription', entityLabel: '<tier> plan'`)
- [ ] No `localStorage.setItem` in new feature code
- [ ] All new components use semantic CSS variables (no hardcoded hex)
- [ ] Dark-mode parity (auto-verified by theme CSS var swap)

**Gate exit:** FE code complete, compiles, offline rules pass.
**Blocker:** if `tsc` errors or `enforce.js` fails — STOP, fix.

---

## Gate 5 — Verify (Verifier Agent)

**Owner:** verifier
**Reads:** Gates 2, 4 proof files
**Writes:** `.claude/gate-5-proof.md`

### Full verification suite

#### 5a — TypeScript (all 3 targets)

```bash
# Backend
cd server && npx tsc -b --noEmit
# output: 0 errors

# Frontend
cd ../frontend && npx tsc -b --noEmit  # adjust path per repo layout
# output: 0 errors

# Admin (if separate codebase; else skip)
# cd ../admin && npx tsc -b --noEmit
# output: 0 errors
```

#### 5b — Enforce patterns

```bash
node scripts/enforce.js
# output: 0 errors (all patterns pass)

node scripts/enforce-offline.mjs
# output: 0 errors (all offline rules pass)
```

#### 5c — Curl proofs (every route, happy + error paths)

Test these calls in order; save request + response to proof file.

| Route | Method | Auth | Req Body | Expected | Proof ID |
|-------|--------|------|----------|----------|----------|
| `/api/auth/entitlement-pubkey` | GET | none | — | 200 `{ publicKey, algorithm }` | curl-pubkey-200 |
| `/api/businesses/:businessId/subscription` | GET | yes | — | 200 `{ state, graceUntil, offlineToken, ... }` | curl-subscription-200 |
| `/api/businesses/:businessId/subscription` | GET | **no** | — | **401** `{ error: UNAUTHORIZED }` | curl-subscription-401 |
| `/api/subscription/checkout` | POST | yes | `{ tier, billingCycle }` | 200 `{ subscriptionId, checkoutUrl, amount }` | curl-checkout-200 |
| `/api/subscription/checkout` | POST | yes | `{}` **(invalid)** | **400** `{ error: VALIDATION_ERROR }` | curl-checkout-400 |
| `/api/subscription/mandate/create` | POST | yes | — | 200 `{ mandateId, upiIntentUrl }` | curl-mandate-create-200 |
| `/api/subscription/mandate/status` | GET | yes | — | 200 `{ mandateStatus, upiVpa? }` | curl-mandate-status-200 |
| `/api/subscription` | DELETE | yes | — | 200 `{ success: true }` | curl-delete-200 |
| `/api/subscription` | DELETE | **no** | — | **401** | curl-delete-401 |
| `/api/admin/subscriptions/:businessId/grant` | POST | admin ✓ | `{ tier, months, reason }` | 200 `{ subscriptionId, tier, expiresAt }` | curl-admin-grant-200 |
| `/api/admin/subscriptions/:businessId/grant` | POST | **no admin** | `{ tier, months, reason }` | **403** `{ error: FORBIDDEN }` | curl-admin-grant-403 |

Save all 11 curl commands + responses as markdown table in `.claude/gate-5-proof.md`.

#### 5d — Screenshot proofs

**Tooling:** Use normal Chrome browser (user preference per memory). Navigate to each page, capture at 320px / 375px / 768px / 1024px viewports. Take 1 screenshot per state.

| Page | Component | States | Viewports | Requirement |
|------|-----------|--------|-----------|------------|
| Subscription Manage | `SubscriptionManagePage` | Loading | 320 | Show skeleton, no overflow |
| Subscription Manage | `SubscriptionManagePage` | Error | 375 | Show error state + retry button |
| Subscription Manage | `SubscriptionManagePage` | Empty (FREE, no subscription row) | 320 | Show FREE tier card + "Upgrade" CTA |
| Subscription Manage | `SubscriptionManagePage` | Success (PAID tier) | 768 | Show plan card, usage bars, mandate section, billing history |
| Subscription Manage | `SubscriptionManagePage` | Success (PAID tier) | 1024 | Responsive desktop layout |
| Mandate Setup | `MandateSetupDrawer` | Open | 320 | Modal visible, CTA visible, no overflow |
| Mandate Setup | `MandateSetupDrawer` | Pending | 375 | Spinner + "Waiting for UPI confirmation…" |
| Mandate Setup | `MandateSetupDrawer` | Success | 320 | "Autopay active" banner |
| State Banner | `SubscriptionStateBanner` | TRIAL_NO_AUTOPAY state | 375 | Blue info banner "Trial ends in X days…" |
| State Banner | `SubscriptionStateBanner` | PAST_DUE state | 375 | Red warning banner "Payment failed…" |
| State Banner | `SubscriptionStateBanner` | LOCKED state | 375 | Red error banner "Account locked…" |
| Upgrade Drawer | `UpgradeDrawer` | Loading | 320 | Skeleton tier cards |
| Upgrade Drawer | `UpgradeDrawer` | Tier selection | 375 | 3 tier cards (PRO, BUSINESS, PRO_MAX), CTA |
| Overflow Banner | `OverflowBanner` | Grace active | 320 | Amber banner "Monthly limit reached (N/50)…" |
| Overflow Banner | `OverflowBanner` | No overflow | 320 | Hidden (no banner visible) |

**Capture steps:**
1. Open Chrome DevTools → Device toolbar → select 320px / 375px / etc.
2. Navigate to page.
3. Trigger state (e.g., set store to `subscriptionState='PAST_DUE'` for banner test).
4. Screenshot (Cmd+Shift+S or F12 → Screenshot tab).
5. Save as `gate-5-proof-<page>-<state>-<viewport>.png`.
6. Create markdown index in proof file: `| Page | State | 320 | 375 | 768 | 1024 |`.

#### 5e — Console clean

```bash
# Start app in dev
npm run dev

# Open Chrome DevTools → Console tab.
# Load each new page:
# - /settings/subscription
# - trigger MandateSetupDrawer
# - trigger UpgradeDrawer
# - trigger SubscriptionStateBanner PAST_DUE

# Verify: 0 errors, 0 warnings in Console (yellow or red).
# Whitelist known warnings (e.g., Vite HMR, external ads).
```

**Proof:** screenshot of Console tab showing clean output + list of pages checked.

### Gate 5 proof file format

`.claude/gate-5-proof.md`:

```markdown
# Gate 5 — Verify Proofs

## TypeScript
- Backend: `npx tsc -b --noEmit` ✅ 0 errors
- Frontend: `npx tsc -b --noEmit` ✅ 0 errors
- Enforce: `node scripts/enforce.js` ✅ 0 errors
- Offline: `node scripts/enforce-offline.mjs` ✅ 0 errors

## Curl tests
| Route | Method | Auth | Status | Proof |
| ... | ... | ... | ... | curl-<id>-<status> |
... (11 rows)

## Screenshots
| Page | State | 320 | 375 | 768 | 1024 |
| Subscription Manage | Loading | ✅ | — | — | — |
... (15 rows)

## Console
✅ No errors or warnings on:
- /settings/subscription
- MandateSetupDrawer open
- UpgradeDrawer open
- SubscriptionStateBanner (all 3 states)

Checked pages:
- [screenshot]
```

### Gate 5 acceptance criteria

- [ ] `npx tsc -b --noEmit` (backend, frontend, admin) → 0 errors × 3
- [ ] `node scripts/enforce.js` → 0 errors
- [ ] `node scripts/enforce-offline.mjs` → 0 errors
- [ ] All 11 curl tests pass (200/401/400 as expected per table)
- [ ] All 15 screenshot states captured at all viewports (65 total images)
- [ ] 320px tested on every new component (no horizontal overflow)
- [ ] Console clean (0 errors) on all new pages

**Gate exit:** all proofs saved to `.claude/gate-5-proof.md`. File must be committed.
**Blocker:** if any tsc error, curl fail, or screenshot missing — STOP, fix, retest.

---

## Gate 6 — QA (qa agent)

**Owner:** qa
**Reads:** SCOPE.md acceptance criteria + SECURITY.md P1 items + Gate 5 proofs
**Writes:** `.claude/gate-6-qa-report.md`

### Test matrix (T1–T6)

#### T1 — Functional

| Test | Expected | Status |
|------|----------|--------|
| Create business → subscription auto-created FREE tier | `Subscription.planTier = 'FREE'`, `subscriptionState = 'NONE'` | [ ] |
| Upgrade: select PRO + checkout → webhook fires → state → ACTIVE | `subscriptionState = 'ACTIVE'`, `PlanGate` releases feature | [ ] |
| Downgrade: BUSINESS → PRO (period_end) → `pendingDowngradeTier = 'PRO'` set | Next charge → state machine applies downgrade | [ ] |
| Cancel: subscription cancelled, grace window honored until `expiresAt` | Middleware grants paid-tier access during grace; after expiry, FREE | [ ] |
| Reactivate: CANCELLED → payment → ACTIVE | Works via `POST /subscription/reactivate` | [ ] |
| Trial: business ≤30d old → state = TRIAL_NO_AUTOPAY, banner shows "X days left" | Countdown correct; after 31d without mandate, PAST_DUE | [ ] |
| Mandate: setup UPI autopay → webhook → PROMO_ACTIVE → first charge → ACTIVE | State transitions correct | [ ] |
| Overflow: invoice quota hit on FREE → grace records → OverflowBanner shows | Middleware allows 3 extra invoices during grace; after grace, 402 | [ ] |

#### T2 — State Machine (unit test + integration)

| Transition | From → To | Trigger | Expected | Status |
|-----------|-----------|---------|----------|--------|
| 1 | null → PROMO_ACTIVE | payment.captured.promo | side-effects: cancel_other_active, enqueue_invoice | [ ] |
| 2 | null → ACTIVE | payment.captured.full | side-effects: cancel_other_active, enqueue_invoice | [ ] |
| 3 | PROMO_ACTIVE → ACTIVE | payment.captured.recurring | side-effects: clear_grace | [ ] |
| 4 | TRIAL_NO_AUTOPAY → PROMO_ACTIVE | mandate.created | state change | [ ] |
| 5 | ACTIVE → PAST_DUE | subscription.charged.failed | side-effects: set_grace (7 days) | [ ] |
| 6 | PAST_DUE → LOCKED | grace.expired | cron triggers after `gracePeriodEndsAt < now` | [ ] |
| 7 | PAST_DUE → ACTIVE | payment.captured.full | side-effects: clear_grace | [ ] |
| 8 | CANCELLED → ACTIVE | payment.captured.full | reactivate works | [ ] |
| 9 | LOCKED → ACTIVE | admin.force_activate | admin grant works | [ ] |
| **Invalid** | PROMO_ACTIVE → LOCKED | (none) | 409 INVALID_STATE_TRANSITION | [ ] |
| **Invalid** | CANCELLED → PAST_DUE | (none) | 409 | [ ] |
| **Invalid** | LOCKED → TRIAL_NO_AUTOPAY | (none) | 409 | [ ] |

#### T3 — Idempotency + Replay

| Scenario | Setup | Action | Expected | Status |
|----------|-------|--------|----------|--------|
| Webhook replay (same event_id) | Razorpay fires `subscription.activated` | Replay same event 3x within 5min | `SubscriptionEvent` inserted 1x, 2nd+3rd return 200 idempotent (P2002 catch) | [ ] |
| Webhook stale (>5min old) | Razorpay fires `subscription.activated` with `created_at` = 10min ago | Handler processes | Returns 200 `{ stale: true }`, no state change (P1-A) | [ ] |
| Mutation idempotency (checkout) | User hits "Upgrade" button while network lag | Button clicked 2x in 1s | Only 1 Razorpay session created (idempotencyCheck middleware dedupes) | [ ] |

#### T4 — Security (8 P1 items must each pass)

| P1 Item | Test | Expected | Status |
|---------|------|----------|--------|
| P1-A | Webhook replay-age check | Fire event with `created_at` > 5min old | Returns 200 idempotent, no state change | [ ] |
| P1-B | Admin grant requireSuperAdmin | Grant without super-admin session | 403 FORBIDDEN | [ ] |
| P1-B | Admin grant rate-limit | Fire 11 grant requests in 60s from same admin | 11th returns 429 | [ ] |
| P1-B | Admin grant self-guard | Admin attempts to grant own business | 403 FORBIDDEN_SELF_GRANT | [ ] |
| P1-C | Entitlement TTL | JWT issued at T; check expiry at T+49h (if 48h) | `expired: true` | [ ] |
| P1-D | Writer SSOT enforced | Attempt direct `prisma.subscription.update()` outside writer in a route handler | Linter + enforce.js catches pattern error | [ ] |
| P1-E | Idempotency middleware on routes | All POST/PATCH/DELETE under `/api/subscription/*` have middleware | Confirmed by code review | [ ] |
| P1-F | Webhook businessId resolution | Webhook with wrong businessId in body | DB lookup via razorpaySubscriptionId wins; body ignored | [ ] |
| P1-G | JWT in logs prohibited | Developer attempts `logger.info({ token })` | enforce.js pattern blocks pre-commit | [ ] |
| P1-H | Tenant scoping on all queries | Code review: all `prisma.{model}` queries include `where: { businessId }` | Confirmed in all 8 service files | [ ] |

#### T5 — Offline

| Scenario | Device state | Expected | Status |
|----------|--------------|----------|--------|
| Offline grace (JWT valid) | Offline, useSubscription called | Returns cached JWT; FE verifies expiry vs local time; if valid, plan = paid tier | [ ] |
| Offline expired | Offline for 49h+, JWT expired | useSubscription returns `offlineToken: null`; FE degrades to FREE (soft lock) | [ ] |
| Offline then online | Offline 24h, reconnect, /subscription fetched | New JWT issued, IDB updated, FE sync'ed | [ ] |
| Offline cancel queueable | Offline, user taps "Cancel subscription" | Mutation queues via `api()` with `entityType: 'subscription'` | [ ] |
| Offline checkout not queueable | Offline, user hits "Upgrade" → PlanGate → UpgradeDrawer | Checkout route returns error "Upgrade requires online connection"; not queued | [ ] |

#### T6 — Entitlement JWT

| Scenario | Setup | Expected | Status |
|----------|-------|----------|--------|
| JWT signature valid | Token issued by server | FE `verifyToken()` using public key succeeds | [ ] |
| JWT audience + issuer pinned | Token issued with correct claims | FE verify call includes `audience: 'hisaabpro-client', issuer: 'hisaabpro-api'` | [ ] |
| JWT clock-rewind defense | FE sets device clock back 2h post-JWT-issue | FE checks `Date.now() < trustedTime - 60s` → rejects JWT → forced online | [ ] |
| JWT in IDB only | JWT issued | Token stored in Dexie `entitlement` store, NOT localStorage | [ ] |
| JWT cleared on logout | User logged in (JWT in IDB), then logs out | IDB cleared; subsequent useSubscription returns `offlineToken: null` | [ ] |

### Test execution plan

**Run tests in this order** (dependencies):
1. **T1 functional** — happy path only (no errors yet).
2. **T2 state machine** — unit tests already run in Gate 2; QA re-runs on prod schema.
3. **T3 idempotency** — depends on T1 (webhook machinery working).
4. **T4 security** — spot-check 8 P1 items.
5. **T5 offline** — simulator + local dev (no network).
6. **T6 JWT** — WebCrypto verification test.

### Gate 6 acceptance criteria

- [ ] All T1 functional tests pass (8/8).
- [ ] All T2 state-machine transitions pass (9/9 + 3 invalid rejections).
- [ ] All T3 idempotency + replay tests pass (3/3).
- [ ] All T4 security P1 items pass (10/10) — each with proof.
- [ ] All T5 offline tests pass (5/5).
- [ ] All T6 JWT tests pass (5/5).
- [ ] No regressions in existing subscription features (plan-limits drift test passes).
- [ ] All new pages responsive at 320px (re-verified in Chrome DevTools during QA).

### QA fix rounds (max 3)

If any test fails:

1. **Triage:** is it a code bug or test setup issue?
2. **File:** `.claude/gate-6-findings.md` with:
   - Test ID (e.g., T4-P1-B)
   - Failure symptom
   - Root cause
   - Fix location (file:line)
3. **Fix:** apply patch (code change only, no scope/arch changes).
4. **Re-test:** single failing test → must pass.
5. **Commit:** `fix(subscription-port): <issue>` with root-cause per CLAUDE.md rules.
6. **Repeat:** up to 3 rounds. After round 3, if blockers remain, escalate to postmortem.

### Gate 6 exit

- [ ] `.claude/gate-6-qa-report.md` written with all tests pass/fail.
- [ ] 0 blockers remaining (all T1-T6 pass).
- [ ] `.claude/mission-active.md` updated with `shipped: { commit: <hash>, ts: <iso> }`.

**Blocker:** if T4 security tests fail → postmortem triggered (security regress).

---

## Dependency Graph

### Critical path (must succeed in order)

1. **Gate 0 (Prep)** → Gate 1, 2, 4 (no blocker)
2. **Gate 1 (DB)** → Gate 2 (API needs schema)
3. **Gate 2 (API)** → Gate 3 (admin routes already created) + Gate 5 (curl proofs)
4. **Gate 4 (FE)** → Gate 5 (screenshots)
5. **Gate 5 (Verify)** → Gate 6 (QA uses verified proofs)
6. **Gate 6 (QA)** → Ship (if all pass)

### Parallel gates

- **Gate 2** (API backend) and **Gate 4** (FE) can run in parallel (no dependencies on each other).
- **Gate 3** (admin routes) is a quick validation of already-written code in Gate 2 (can run inline or immediately after Gate 2).

### Blocking conditions

| Gate | Blocker | How to unblock |
|------|---------|----------------|
| Gate 1 | Migration fails or `tsc` breaks | Fix schema, retry migration |
| Gate 2 | `tsc` error or curl 401/400 fails | Fix code, recompile, retry curl |
| Gate 4 | `tsc` error or enforce.js fails | Fix code, recompile, retry enforce |
| Gate 5 | Any tsc, curl, or screenshot missing | Complete missing proof, retest |
| Gate 6 | T1-T6 test fails | Fix bug, re-run single test, re-commit |

---

## Security Acceptance Criteria (linked to P1 items)

Every P1 finding must have a test-id in Gate 6 + acceptance criteria:

| P1 ID | Finding | Test ID | Acceptance |
|-------|---------|---------|-----------|
| P1-A | Webhook replay-age check | T3 + T4-P1-A | Stale event (>5min) returns 200 idempotent |
| P1-B | Admin grant: super-admin + rate-limit + self-guard | T4-P1-B (3 subtests) | Each guard fires 403 on violation |
| P1-C | Entitlement TTL decision | T6 + code review | TTL set to Sawan's decision (48h or 24h), documented |
| P1-D | Writer SSOT enforced mechanically | T4-P1-D + enforce.js | Linter catches direct subscription.update outside allowlist |
| P1-E | Idempotency middleware on all routes | T3 + code review | All POST/PATCH/DELETE under /api/subscription/* wrapped |
| P1-F | Webhook businessId from DB not payload | T4-P1-F | Webhook with wrong businessId in body is ignored |
| P1-G | JWT never in logs | T4-P1-G + enforce.js | Pattern blocks `logger.*({ ... jwt|token ... })` |
| P1-H | Tenant scoping on all queries | T4-P1-H + code review | All 8 service files: every query has `WHERE businessId` |

---

## Cross-gate acceptance criteria (mission-level)

After all gates pass, mission-active.md `acceptance:` block populated:

```yaml
acceptance:
  backend:
    - tsc clean (Gates 2, 5)
    - curl success path (Gate 5: curl-subscription-200)
    - curl 401 path (Gate 5: curl-subscription-401)
    - curl 400 path (Gate 5: curl-checkout-400)
  frontend:
    - screenshots: loading, error, empty, success (Gate 5: 15 states × 4 viewports)
    - 320px tested (Gate 5 + Gate 6)
    - console clean (Gate 5)
  security:
    - All 8 P1 items tested (Gate 6: T4)
  qa:
    - T1-T6 all pass (Gate 6)
    - 0 fix rounds after 3 max (Gate 6)
    - plan-limits drift test passes (Gate 6)
```

---

## Proof file summary

| Gate | Proof file | Contents |
|------|-----------|----------|
| 1 | `.claude/gate-1-proof.md` | Migration list + `prisma migrate status` output |
| 2 | `.claude/gate-2-proof.md` | 11 curl commands + responses + P1 item locations |
| 5 | `.claude/gate-5-proof.md` | tsc/enforce output + 11 curl proofs + 65 screenshot paths + console clean |
| 6 | `.claude/gate-6-qa-report.md` | T1-T6 test matrix + pass/fail + security P1 sign-off |

All proof files committed to repo; `.claude/mission-active.md` references them.

---

## Final notes

- **Scope freeze:** no scope changes during build. If new issues emerge, log as P2/P3 backlog items, not scope creep.
- **Rollback:** every gate is independently reversible. If Gate 5 fails, revert Gate 4 + Gate 2 (DB stays — migrations are applied) and re-do from code fix.
- **Communication:** proof files are the SSOT. "It worked on my machine" is not a proof — curl output + screenshot is.
- **Estimation:** gates 2 (API), 4 (FE), 5 (Verify) are the heavy lifts. Gates 1, 3, 6 are quicker. Parallel 2 + 4 recommended.

---

**Document version:** 1.0 (2026-05-15)
**Status:** READY FOR PHASE 3 BUILD

