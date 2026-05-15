# ARCHITECTURE: subscription-port

**Mission slug:** subscription-port
**Date:** 2026-05-15
**Mode:** AUGMENT (HP base preserved; DH-only features added)
**Status:** draft (awaiting Sawan approval)
**Author agent:** architect
**Crosses high-risk paths:** `prisma/schema.prisma`, `services/razorpay*`, `routes/razorpay.ts`, `middleware/subscription-gate.ts`, `lib/env.ts`, `lib/auth*`, `services/auth*`.

---

## 1. System Diagram (ASCII)

```
┌──────────────────────────── CLIENT (Capacitor 8 + Vite) ──────────────────────────────┐
│                                                                                       │
│   PlanGate ─▶ UpgradeDrawer ─▶ POST /subscription/checkout ──────────┐                │
│                                                                      │                │
│   SubscriptionStateBanner ◀── useSubscription() ◀── GET /subscription│                │
│                                  │                                   │                │
│                                  ├── reads IDB.entitlement_token     │                │
│                                  │   (RS256 JWT, 48h, WebCrypto)     │                │
│                                  │   + IDB.trusted_time              │                │
│                                  │                                   │                │
│   MandateSetupDrawer ─▶ POST /subscription/mandate/create ─────────┐ │                │
│                          │  returns upi://pay?...                  │ │                │
│                          ▼                                         │ │                │
│                      UPI app (GPay/PhonePe/BHIM)                   │ │                │
│                                                                    │ │                │
│   OverflowBanner ◀── /subscription (isGrace, graceUntil)           │ │                │
│                                                                    │ │                │
│   /lib/api offline-queue ─── (only cancel/reactivate queue-able) ──┼─┼──── (online)─┐ │
└────────────────────────────────────────────────────────────────────┼─┼──────────────┼─┘
                                                                     │ │              │
                              HTTPS (cookie auth, CSRF, replay-prot) │ │              │
                                                                     ▼ ▼              ▼
┌──────────────────────────────── API (Express + Prisma) ──────────────────────────────┐
│                                                                                       │
│   routes/subscription.ts ─────────────┐                                               │
│   routes/admin/subscriptions.admin.ts ┤                                               │
│   routes/razorpay.ts (webhook)        │                                               │
│       │                               │                                               │
│       │  HMAC sig verify              │                                               │
│       ▼                               ▼                                               │
│   ┌─────────────────────────────────────────────────────────────────────────────┐    │
│   │  services/razorpay-webhook.service.ts  (idempotency: SubscriptionEvent      │    │
│   │  unique(razorpayEventId) — first writer wins, dupes return 200 no-op)       │    │
│   └─────────────────────────────────────────────────────────────────────────────┘    │
│       │                                                                               │
│       ▼                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────────────┐    │
│   │  services/subscription/subscription.writer.ts  ← SSOT (single $tx)          │    │
│   │     │                                                                       │    │
│   │     ├── transitionState(from, trigger)   [subscription-state-machine.ts]    │    │
│   │     ├── applyEvent(tx, evt)              [subscription.writer.events.ts]    │    │
│   │     │      └── set_grace / clear_grace / cancel_other_active / enqueue_inv  │    │
│   │     └── INSERT SubscriptionEvent (audit ledger, append-only)                │    │
│   └─────────────────────────────────────────────────────────────────────────────┘    │
│       │                                                                               │
│       ├──▶ services/subscription/upi-mandate.service.ts    (mandate.created/cancel)  │
│       ├──▶ services/subscription/checkout-session.service.ts (Razorpay sub create)   │
│       ├──▶ services/subscription/downgrade.service.ts        (period_end scheduling) │
│       ├──▶ services/subscription/addon.service.ts            (BusinessAddon CRUD)    │
│       ├──▶ services/subscription/subscription-admin.service.ts (grant/revoke)        │
│       ├──▶ services/subscription/overflow-grace.service.ts   (quota grace bookkeep)  │
│       └──▶ services/subscription/entitlement-jwt.service.ts  (RS256 sign — 48h TTL)  │
│                  ↑ called on GET /subscription + /auth/refresh                       │
│                                                                                       │
│   middleware/subscription-gate.ts (existing, extended)                                │
│      ├── reads from DB (no client state)                                              │
│      ├── honors gracePeriodEndsAt / overflowGraceUntil                                │
│      ├── overlays BusinessAddon features on plan features                             │
│      └── returns 402 UPGRADE_REQUIRED / QUOTA_EXCEEDED / 409 INVALID_STATE_TRANSITION │
│                                                                                       │
│   lib/cron-scheduler.ts (existing, extended)                                          │
│      ├── cron-grace-expiry.ts        06:00 IST daily — PAST_DUE → LOCKED              │
│      ├── cron-trial-end.ts           07:00 IST daily — TRIAL_NO_AUTOPAY day-31 sweep  │
│      └── cron-mandate-reminder.ts    08:00 IST daily — pending-mandate >24h reminder  │
│                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────────┐
                         │  PostgreSQL (Render Starter)│
                         │   Subscription (extended)   │
                         │   SubscriptionEvent (new)   │
                         │   FeatureAddon (new)        │
                         │   BusinessAddon (new)       │
                         │   UpiMandate (new)          │
                         └─────────────────────────────┘
```

Hot path for an upgrade: `client → POST /subscription/checkout → Razorpay → webhook → razorpay-webhook.service → applySubscriptionEvent → writer.events.applyEvent (tx) → INSERT SubscriptionEvent + UPDATE Subscription → entitlement-jwt re-issued on next GET /subscription`.

---

## 2. Migration Sequence (mandatory, ordered)

**Rule:** every step is a separate `npx prisma migrate dev --name <name>` invocation. NEVER `db push`. Add-column then backfill then NOT-NULL — never combined. New tables ship after columns exist because they FK-reference Subscription. See `.claude/rules/PRISMA_MIGRATION_RULES.md`.

| Step | Name | Type | What | Reversible? |
|------|------|------|------|-------------|
| 1 | `20260515_subscription_port_columns_nullable` | add columns (NULLABLE) | Add 9 new columns to `Subscription` — all nullable, all with safe defaults where applicable | yes |
| 2 | `20260515_subscription_port_backfill` | data migration (raw SQL in migration body) | `UPDATE "Subscription" SET "subscriptionState" = CASE WHEN status='ACTIVE' THEN 'ACTIVE' WHEN status='CANCELLED' THEN 'CANCELLED' WHEN status='TRIALING' THEN 'TRIAL_NO_AUTOPAY' WHEN status='PAST_DUE' THEN 'PAST_DUE' ELSE 'NONE' END WHERE "subscriptionState" IS NULL; UPDATE "Subscription" SET "autoRenew"=true WHERE "autoRenew" IS NULL;` | yes (data only) |
| 3 | `20260515_subscription_port_columns_notnull` | tighten | `ALTER COLUMN "subscriptionState" SET NOT NULL` + `SET DEFAULT 'NONE'`; same for `autoRenew DEFAULT true NOT NULL`. All other new columns stay nullable on purpose (mandate-id, grace-period etc. only set when relevant). | yes |
| 4 | `20260515_subscription_port_indexes` | indexes | `@@index([subscriptionState])`, `@@index([gracePeriodEndsAt])`, `@@index([nextBillingAt])` on Subscription | yes |
| 5 | `20260515_subscription_port_new_tables` | new tables | Create `SubscriptionEvent`, `FeatureAddon`, `BusinessAddon`, `UpiMandate` (all FKs to existing Subscription / Business) + their indexes (including UNIQUE on `SubscriptionEvent.razorpayEventId` for idempotency, UNIQUE composite `(businessId, addonId)` on BusinessAddon, UNIQUE on `FeatureAddon.name`) | yes (table drop) |

Each step:
1. Edit `schema.prisma` for that step only.
2. `npx prisma migrate dev --name <name>` — creates migration SQL.
3. Inspect generated `migration.sql`.
4. Commit migration + schema in one commit.

**Rollback story:** every step is `prisma migrate resolve --rolled-back` + manual `DROP COLUMN` / `DROP TABLE`. Since step 1 + 5 are pure adds, rollback is non-destructive. Step 3 NOT-NULL set is the only "harder to unwind" step — by design it runs AFTER backfill, so `ALTER COLUMN DROP NOT NULL` rollback is trivial.

**Why this order:**
- Adding columns nullable first means existing rows continue to work between deploy and backfill (zero-downtime).
- Backfill is data-only — no schema change — so a bad backfill can be re-run.
- NOT-NULL constraint comes last so production never has the "deploy a NOT-NULL on a NULL row" footgun.
- New tables come last so failed migration of column changes doesn't leave orphaned tables to clean up.

---

## 3. State Machine Transition Table

States: `NONE | PROMO_ACTIVE | TRIAL_NO_AUTOPAY | ACTIVE | PAST_DUE | LOCKED | CANCELLED` (plus `null` = no Subscription row yet).

Terminal-ish: `CANCELLED` and `LOCKED` are terminal-until-payment. `ACTIVE` is the steady-state goal.

| # | From | Trigger | To | Side effects |
|---|------|---------|----|--------------| 
| 1 | null | `payment.captured.promo` | PROMO_ACTIVE | insert_promo_lock, cancel_other_active, enqueue_invoice, push_fanout |
| 2 | null | `payment.captured.full` | ACTIVE | cancel_other_active, enqueue_invoice, push_fanout |
| 3 | null | `admin.force_activate` | ACTIVE | enqueue_invoice |
| 4 | NONE | `admin.force_activate` | ACTIVE | enqueue_invoice |
| 5 | PROMO_ACTIVE | `payment.captured.recurring` | ACTIVE | clear_grace, enqueue_invoice, push_fanout |
| 6 | PROMO_ACTIVE | `mandate.cancelled` | TRIAL_NO_AUTOPAY | — |
| 7 | PROMO_ACTIVE | `subscription.charged.failed` | PAST_DUE | set_grace, push_fanout |
| 8 | TRIAL_NO_AUTOPAY | `mandate.created` | PROMO_ACTIVE | clear_grace |
| 9 | TRIAL_NO_AUTOPAY | `day31.reached.no_mandate` | PAST_DUE | set_grace, push_fanout |
| 10 | ACTIVE | `subscription.charged.failed` | PAST_DUE | set_grace, push_fanout |
| 11 | ACTIVE | `user.cancel` | CANCELLED | — |
| 12 | ACTIVE | `mandate.cancelled` | ACTIVE | — (no state change; next charge will fail) |
| 13 | PAST_DUE | `payment.captured.full` | ACTIVE | clear_grace, enqueue_invoice, push_fanout |
| 14 | PAST_DUE | `payment.captured.recurring` | ACTIVE | clear_grace, enqueue_invoice, push_fanout |
| 15 | PAST_DUE | `grace.expired` | LOCKED | push_fanout |
| 16 | PAST_DUE | `admin.force_activate` | ACTIVE | clear_grace, enqueue_invoice |
| 17 | LOCKED | `payment.captured.full` | ACTIVE | cancel_other_active, enqueue_invoice, push_fanout |
| 18 | LOCKED | `admin.force_activate` | ACTIVE | clear_grace, enqueue_invoice |
| 19 | CANCELLED | `payment.captured.full` | ACTIVE | cancel_other_active, enqueue_invoice, push_fanout |

**19 transitions total** (scope said 14 — refined to 19 after enumerating admin-from-null + LOCKED→ACTIVE + CANCELLED→ACTIVE reactivate paths). Anything not in this table = INV_INVALID_TRANSITION error (409).

---

## 4. Entitlement JWT Design

**Algorithm:** RS256 (asymmetric — FE verifies with public key only; private key never leaves the API).

**TTL:** 48h. Long enough for a weekend offline; short enough that revocation by admin/webhook becomes effective within 2 days max even without an explicit blocklist hit.

**Claims:**
```ts
{
  // standard
  "iss": "hisaabpro-api",
  "sub": "<subscriptionId>",      // for blocklist lookup
  "aud": "hisaabpro-client",
  "iat": <unix s>,
  "exp": <unix s + 172800>,        // 48h
  "jti": "<cuid>",                 // for blocklist lookup
  // app-specific
  "bid": "<businessId>",
  "uid": "<userId>",
  "tier": "FREE|PRO|BUSINESS|PRO_MAX",
  "state": "ACTIVE|TRIAL_NO_AUTOPAY|...",
  "graceUntil": "<ISO|null>",
  "features": { "posMode": true, "batchTracking": false, ... },  // resolved (plan+addon overlay)
  "addons": ["pos_mode"],
  "trustedTime": "<server now ISO>"   // for clock-rewind detection
}
```

**Where keys live:**
- `ENTITLEMENT_PRIVATE_KEY` — PEM RS256 private key, in env (Render env vars). Never logged.
- `ENTITLEMENT_PUBLIC_KEY` — PEM RS256 public key, in env AND served read-only at `GET /api/auth/entitlement-pubkey` so the FE can `WebCrypto.importKey()` it once at app boot and cache in IDB (not localStorage).
- Both optional in zod: if `ENTITLEMENT_PRIVATE_KEY` unset, GET /subscription returns `offlineToken: null` and FE silently degrades to online-only (no app-level error).

**Key rotation story:**
- Two-key window: `ENTITLEMENT_PRIVATE_KEY` (current) + `ENTITLEMENT_PRIVATE_KEY_PREV` (optional, last 48h grace).
- Signer always uses current. Verifier (FE) imports both pubkeys, tries current first then prev. After 48h of new key in place, drop prev.
- Procedure: `prev := current; current := new` in env vars, redeploy. Within 48h, drop prev, redeploy.

**Clock-rewind detection (FE):**
- On every JWT receive, FE also stores `Date.now() - trustedTime.parse()` as `clockSkew` baseline in IDB.
- Before trusting `exp`, FE checks: `Date.now() + storedSkew >= storedTrustedTime - 60s`. If clock moved BACK by >60s vs stored monotonic baseline, JWT is rejected → forced online mode.
- Additionally uses `performance.now()` monotonic counter as secondary check across the same session.

**Revocation (server-side blocklist):**
- New table NOT introduced — keep blocklist small in Redis-or-equivalent (HP currently has no Redis; use in-memory + DB fallback).
- Pragma: instead of an entitlement blocklist table, ALL revocations re-issue the JWT next time `/subscription` is called. Because TTL is 48h, the practical worst-case offline-with-revoked-access window is 48h — accepted per scope's threat model.
- For hard-kill (compromised account): `Subscription.lastWebhookEventId` getting set to a `REVOKE_*` marker is checked by middleware on EVERY gated request anyway, so server-side gating still rejects requests as soon as the user is online.
- Net: revoke = (a) flip state in DB, (b) trust the 48h ceiling for offline. No new blocklist plumbing this round.

**FE storage:**
- IDB store: `entitlement` with single row `{ token, exp, trustedTime, clockSkew }`.
- Cleared on logout (existing logout flow clears all IDB).
- NEVER `localStorage` (per `.claude/rules/OFFLINE_RULES.md` rule 4).

---

## 5. Webhook Idempotency

**Mechanism:** `SubscriptionEvent.razorpayEventId` is `@unique` (sparse — nullable for non-Razorpay-originated events like admin grants).

**Flow:**
1. Razorpay webhook arrives → `razorpay-webhook.service.ts` parses `event.id`.
2. Inside the same transaction that calls `applySubscriptionEvent`, the writer attempts `prisma.subscriptionEvent.create({ data: { razorpayEventId: event.id, ... } })`.
3. On unique-violation (P2002 on `razorpayEventId`), the entire transaction aborts. The webhook handler catches the P2002, returns `200 OK` with `{ idempotent: true }` body. No state changes, no duplicate side effects.
4. Razorpay sees 200 and stops retrying.

**Why this not redis dedupe:**
- Same database, same transaction — atomic.
- No second moving part to fail.
- Free queryable audit log as a side effect (`SubscriptionEvent` doubles as ledger).

**Race ordering:** `pg_advisory_xact_lock(hashtext('subscription:' || businessId))` taken at the start of every webhook handler — prevents two webhooks for the same business clobbering each other. DH ships this pattern; we port it verbatim.

---

## 6. Cron Jobs

All registered in `lib/cron-scheduler.ts` (existing). All schedules in IST. All idempotent (re-running same day is a no-op).

| Job | Schedule | Purpose | Triggers |
|-----|----------|---------|----------|
| `cron-grace-expiry` | 06:00 IST daily | Sweep `Subscription` where `subscriptionState='PAST_DUE' AND gracePeriodEndsAt < now()`. For each: call `applySubscriptionEvent({ trigger: 'grace.expired' })` → PAST_DUE → LOCKED. | grace.expired |
| `cron-trial-end` | 07:00 IST daily | Sweep `Subscription` where `subscriptionState='TRIAL_NO_AUTOPAY' AND trialEndsAt < now()`. Trigger `day31.reached.no_mandate` → PAST_DUE (sets grace). | day31.reached.no_mandate |
| `cron-mandate-reminder` | 08:00 IST daily | Find `UpiMandate.status='PENDING'` older than 24h. Enqueue notification. No state-machine call. | (notification only) |
| `cron-overflow-enforce` | 06:00 IST daily (piggybacks on grace-expiry job — same handler) | Sweep `Subscription.overflowGraceUntil < now()` where overflow active. Sets `isEnforced=true` flag (read by `checkCustomerLimit` middleware). | (sets flag only) |

**Why 06:00 IST:** quietest time on Indian residential broadband; least user impact if a cron job spikes DB CPU on Render Starter (~25 conn pool — be conservative).

**Already-exists check:** HP `cron-scheduler.ts` has a `subscription-expiry` tick today. We REPLACE its handler call with the new state-machine writer (so its existing schedule is reused) — no new schedule registration, just a new handler implementation. This avoids cron sprawl.

**Resource ceiling:** each handler MUST use `findMany({ take: 500 })` + cursor loop. No unbounded queries. RAM is 512 MB on Render Starter and connection pool is ~25 — long-running scans risk pool exhaustion.

---

## 7. Offline Contract

Per `.claude/rules/OFFLINE_RULES.md`:

| Operation | Online-only? | Reason |
|-----------|--------------|--------|
| `POST /subscription/checkout` | YES | Razorpay session requires fresh server-issued ID + redirect. Queue would be meaningless — return network-error toast. |
| `POST /subscription/mandate/create` | YES | Same — Razorpay roundtrip required. |
| `DELETE /subscription/mandate` | NO — queue OK | Pure server-side state change; offline queue replays when online. `entityType: 'subscription-mandate'`, `entityLabel: 'UPI Autopay'`. |
| `DELETE /subscription` (cancel) | NO — queue OK | Same. `entityType: 'subscription'`, `entityLabel: '<tier> plan'`. |
| `POST /subscription/reactivate` | YES | Requires Razorpay charge — must be online. |
| `PATCH /subscription/plan` (downgrade only, scheduled at period_end) | NO — queue OK if effectiveAt='period_end' | No Razorpay call needed (scheduled change). |
| `PATCH /subscription/plan` (upgrade) | YES | Razorpay charge needed. |
| `POST /admin/subscriptions/:id/grant` | YES | Admin route; admin always online (web admin panel later). |
| `GET /subscription` | NO — cacheReads: true | Safe to cache; entitlement JWT is the offline source of truth anyway. |

**FE rule reinforcement:**
- All API calls via `api()` from `@/lib/api` (no raw `fetch`).
- Mutations pass `entityType` + `entityLabel` (per OFFLINE_RULES rule 2).
- `useSubscription` reads from IDB entitlement JWT when offline; FALLS BACK to FREE tier locally after 48h JWT expiry (NEVER blocks the app — degrades feature visibility).
- Mutation handlers tolerate `{}` response (per rule 5) — e.g. cancel-while-offline shows "Cancel queued — will sync" toast.

---

## 8. Validated File Plan (FINAL)

Revalidated scope-writer's 48-file plan. Findings:

- **Re-architected:** scope split `subscription.writer.legacy.ts` (DH had it for User.* dual-write — HP has no legacy User.subscriptionStatus column, AUGMENT mode means we're greenfield against `Subscription` rows). **DROP this file.**
- **Risk row:** `routes/subscription.ts modify +150` is borderline. Existing file size unverified. **SPLIT** off admin-grant-style sub-router via existing pattern; mount mandate routes as `routes/subscription/mandate.routes.ts` to keep main file ≤ 250L.
- **Risk row:** `SubscriptionManagePage.tsx ~200L` — keep but pre-split sub-sections as sibling components (already in plan: `PlanCard`, `AddonBadge`). Verified safe.
- **Risk row:** `UpgradeDrawer.tsx ~150L` — borderline; pre-extract `TierComparisonCard.tsx` (~70L) sub-component to stay safe.
- **Added:** `entitlement-jwt.keys.ts` — separate key-load + cache from sign logic (keeps service ≤ 100L cleanly).
- **Added:** `entitlement-pubkey.route.ts` (sub-router under `routes/auth.ts` modify) for FE to fetch pubkey at boot.
- **Migration:** scope listed one migration; per Section 2 we ship 5 migrations.

Final plan (49 files including all splits):

| path | action | est_lines | layer | phase |
|------|--------|-----------|-------|-------|
| server/prisma/schema.prisma | modify | +120 | schema | DB |
| server/prisma/migrations/20260515_subscription_port_columns_nullable/migration.sql | create | ~40 | migration | DB |
| server/prisma/migrations/20260515_subscription_port_backfill/migration.sql | create | ~20 | migration | DB |
| server/prisma/migrations/20260515_subscription_port_columns_notnull/migration.sql | create | ~15 | migration | DB |
| server/prisma/migrations/20260515_subscription_port_indexes/migration.sql | create | ~15 | migration | DB |
| server/prisma/migrations/20260515_subscription_port_new_tables/migration.sql | create | ~110 | migration | DB |
| server/src/config/plans.ts | modify | +40 | constants | API |
| server/src/lib/env.ts | modify | +25 | constants | API |
| server/src/services/subscription/subscription.types.ts | create | ~60 | types | API |
| server/src/services/subscription/subscription-state-machine.ts | create | ~110 | pure logic | API |
| server/src/services/subscription/subscription.writer.events.ts | create | ~140 | pure logic | API |
| server/src/services/subscription/subscription.writer.ts | create | ~70 | orchestration | API |
| server/src/services/subscription/entitlement-jwt.service.ts | create | ~110 | service | API |
| server/src/services/subscription/entitlement-jwt.keys.ts | create | ~70 | service | API |
| server/src/services/subscription/upi-mandate.service.ts | create | ~130 | service | API |
| server/src/services/subscription/upi-intent.utils.ts | create | ~50 | utils (pure) | API |
| server/src/services/subscription/checkout-session.service.ts | create | ~130 | service | API |
| server/src/services/subscription/downgrade.service.ts | create | ~100 | service | API |
| server/src/services/subscription/plan-cache.service.ts | modify | +30 | service | API |
| server/src/services/subscription/addon.service.ts | create | ~110 | service | API |
| server/src/services/subscription/addon.queries.ts | create | ~70 | service | API |
| server/src/services/subscription/subscription-admin.service.ts | create | ~90 | service | API |
| server/src/services/subscription/overflow-grace.service.ts | create | ~80 | service | API |
| server/src/services/subscription/ensure-free-subscription.ts | create | ~40 | service | API |
| server/src/services/subscription/cron-grace-expiry.ts | create | ~80 | cron handler | API |
| server/src/services/subscription/cron-trial-end.ts | create | ~60 | cron handler | API |
| server/src/services/subscription/cron-mandate-reminder.ts | create | ~60 | cron handler | API |
| server/src/schemas/subscription.schemas.ts | create | ~90 | schema (Zod) | API |
| server/src/middleware/subscription-gate.ts | modify | +90 | middleware | API |
| server/src/routes/subscription.ts | modify | +110 | route | API |
| server/src/routes/subscription/mandate.routes.ts | create | ~90 | route | API |
| server/src/routes/admin/subscriptions.admin.ts | create | ~110 | route | API |
| server/src/routes/auth/entitlement-pubkey.route.ts | create | ~30 | route | API |
| server/src/services/razorpay-webhook.service.ts | modify | +70 | service | API |
| server/src/lib/cron-scheduler.ts | modify | +30 | lib | API |
| server/src/services/subscription/__tests__/state-machine.test.ts | create | ~180 | test | API |
| server/src/services/subscription/__tests__/writer.test.ts | create | ~140 | test | API |
| server/.env.example | modify | +10 | env | API |
| src/features/subscription/subscription.types.ts | create | ~80 | types | FE |
| src/features/subscription/subscription.constants.ts | create | ~40 | constants | FE |
| src/features/subscription/plan-limits.ts | modify | +30 | constants | FE |
| src/features/subscription/entitlement-idb.ts | create | ~90 | utils (IDB) | FE |
| src/features/subscription/entitlement-verify.utils.ts | create | ~90 | utils (pure) | FE |
| src/features/subscription/entitlement-pubkey-loader.ts | create | ~60 | utils | FE |
| src/features/subscription/upi-intent.utils.ts | create | ~30 | utils (pure) | FE |
| src/hooks/useSubscription.ts | modify | +50 | hook | FE |
| src/hooks/useEntitlementToken.ts | create | ~90 | hook | FE |
| src/hooks/useMandateStatus.ts | create | ~70 | hook | FE |
| src/features/subscription/PlanGate.tsx | modify | +20 | component | FE |
| src/features/subscription/SubscriptionStateBanner.tsx | create | ~90 | component | FE |
| src/features/subscription/OverflowBanner.tsx | create | ~60 | component | FE |
| src/features/subscription/MandateSetupDrawer.tsx | create | ~130 | component | FE |
| src/features/subscription/UpgradeDrawer.tsx | create | ~120 | component | FE |
| src/features/subscription/TierComparisonCard.tsx | create | ~80 | component | FE |
| src/features/subscription/PlanCard.tsx | create | ~110 | component | FE |
| src/features/subscription/AddonBadge.tsx | create | ~40 | component | FE |
| src/pages/SubscriptionManagePage.tsx | create | ~210 | page | FE |
| src/features/subscription/subscription.css | create | ~60 | css | FE |
| src/lib/translations.en.ts | modify | +30 keys | i18n | FE |
| src/lib/translations.hi.ts | modify | +30 keys | i18n | FE |

**Totals:** 60 files (35 BE incl. migrations + tests + env, 22 FE, 3 i18n+css). Every row ≤ 210 lines. Max est: 210 (SubscriptionManagePage).

**Changes from scope (with WHY):**
- DROP `subscription.writer.legacy.ts` (DH-only User.* dual-write; HP has no legacy column to dual-write to).
- ADD `entitlement-jwt.keys.ts` (split key load/cache from sign — keeps service file lean).
- ADD `routes/subscription/mandate.routes.ts` (split off mandate sub-router so main `subscription.ts` stays ≤ 250L total after +110).
- ADD `routes/auth/entitlement-pubkey.route.ts` (FE needs pubkey at boot to verify offline JWTs — minimal new route).
- ADD `addon.queries.ts` (split read-side from write-side; `addon.service.ts` was already 100L+).
- ADD `entitlement-pubkey-loader.ts` (FE-side pubkey fetch + IDB cache, importKey once).
- ADD `TierComparisonCard.tsx` (split off UpgradeDrawer sub-section to keep parent ≤ 120L).
- ADD `__tests__/state-machine.test.ts` + `__tests__/writer.test.ts` (transition table coverage is a Section 10 acceptance criterion — must be in file plan).
- 5 migrations instead of 1 (mandatory add-column → backfill → NOT-NULL sequence).

---

## 9. Risk Register (top 5)

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **Migration drift on prod** — production has rows with NULL in new NOT-NULL columns at step-3 apply time. | M | H (boot failure) | Section 2's add-column → backfill → NOT-NULL ordering enforced. Step 3 only runs after step 2 backfill. CI runs `prisma migrate dev` against a clone of prod schema before deploy. |
| 2 | **Webhook double-fire** — Razorpay re-sends same event ID after timeout. | H | H (double-charge, double-grant) | `SubscriptionEvent.razorpayEventId @unique`. Insert inside the same transaction as state change. P2002 on dupe → handler returns 200 + `{ idempotent: true }`. `pg_advisory_xact_lock` per businessId serializes concurrent webhooks. |
| 3 | **Clock-rewind grace abuse** — user sets device clock back to extend offline grace beyond 48h. | M | M (free tier, low fraud value but real) | Server-issued `trustedTime` claim in JWT. FE stores at receive time and uses `performance.now()` monotonic counter to detect rewind. If `Date.now() < storedTrustedTime - 60s` → JWT rejected, forced online. (Defense-in-depth: server is still SSOT on every gated API call.) |
| 4 | **Razorpay down at checkout** — Razorpay 5xx during `POST /subscription/checkout`. | M | M (UX) | `checkout-session.service.ts` wraps Razorpay calls with 8s timeout + 1 retry. On final failure, returns 503 with `RAZORPAY_UNAVAILABLE` code. FE toast: "Payment service temporarily unavailable. Try again in a minute." No state change persisted — clean re-try possible. Pattern mirrors existing `razorpay.service.ts`. |
| 5 | **Existing Subscription rows missing new columns** — HP prod has live Subscription rows pre-migration. | H | H (NULL on read post-deploy → crash) | All new columns nullable in step 1. Step 2 backfill maps existing `status` → new `subscriptionState`. Writer SSOT tolerates NULL fromState (treats as `null` in state machine — see transition #1-#4). `useSubscription` zod schema makes new fields optional. |

**Lesser risks worth noting (not top 5):**
- Razorpay plan ID for `PRO_MAX` not yet provisioned in Razorpay dashboard — flagged in `.env.example`, deploy-checklist item.
- RS256 keypair generation — first-time generation must be done manually (`openssl genrsa`), stored in Render env. Documented in security audit.
- Cron job overlap with DB connection pool — limit cron handlers to `take: 500`; never unbounded `findMany`.

---

## 10. Acceptance Criteria (architecture-side)

Tied to `mission-active.md` `acceptance:` block.

### Backend
- [ ] `npx tsc -b --noEmit` clean across all new + modified files
- [ ] `node scripts/enforce.js` — 0 errors (file-length + offline rules + token discipline)
- [ ] `npx prisma migrate dev` runs all 5 migrations on fresh DB without error
- [ ] `npx prisma migrate deploy` on a clone of prod schema succeeds (no NOT-NULL violations)
- [ ] `curl GET /api/businesses/:id/subscription` → `{ success: true, data: { state, offlineToken, graceUntil, mandateStatus, addons } }` with all new fields present
- [ ] `curl` without auth → `{ success: false, error: { code: 'UNAUTHORIZED', status: 401 } }`
- [ ] `curl POST /api/subscription/checkout` with invalid body → `{ success: false, error: { code: 'VALIDATION_ERROR', status: 400 } }`
- [ ] State machine unit test: all 19 transitions pass + 5 invalid-transition rejections (409 `INVALID_STATE_TRANSITION`)
- [ ] Writer test: duplicate `razorpayEventId` → 1 `SubscriptionEvent` row, second call no-op (idempotent)
- [ ] `PAST_DUE` row with `gracePeriodEndsAt > now()` → middleware grants paid-tier
- [ ] Cron `cron-grace-expiry` on a `PAST_DUE` row with `gracePeriodEndsAt < now()` → transitions to `LOCKED`
- [ ] Admin grant route with valid admin session → `SubscriptionEvent.trigger='admin.force_activate'` written
- [ ] Entitlement JWT signed RS256, verifiable with `ENTITLEMENT_PUBLIC_KEY`, `exp - iat = 172800`
- [ ] Entitlement JWT contains `trustedTime` claim
- [ ] When `ENTITLEMENT_PRIVATE_KEY` unset, GET /subscription returns `offlineToken: null` (no error)
- [ ] `routes/subscription.ts` ≤ 250 lines after modification

### Frontend
- [ ] `npx tsc -b --noEmit` (frontend) clean
- [ ] `useSubscription` returns `{ state, graceUntil, mandateStatus, addons, offlineToken }`
- [ ] `entitlement-verify.utils.ts` rejects token where `device.now < trustedTime - 60s` (clock rewind)
- [ ] IDB store `entitlement` populated on first online `/subscription` call
- [ ] All new strings via `t.*` from `useLanguage()` — both EN and HI added
- [ ] All API calls via `api()` — zero `fetch(` in new feature code (enforce.js verified)
- [ ] All mutations pass `entityType` + `entityLabel`
- [ ] No `localStorage.setItem` in new feature code
- [ ] Screenshots: SubscriptionManagePage (loading, error, FREE, PAID), MandateSetupDrawer (open, pending, success), SubscriptionStateBanner (PAST_DUE, LOCKED, TRIAL_NO_AUTOPAY)
- [ ] 320px no horizontal overflow on every new screen
- [ ] Console clean on dashboard load with subscription gates evaluating

### Architecture-level
- [ ] Every file ≤ 250 lines (verified by enforce.js)
- [ ] All 5 migrations are separate `prisma migrate dev --name` invocations — none combine add+backfill+NOT-NULL
- [ ] No `prisma db push` anywhere in repo or scripts
- [ ] `plan-limits.drift.test.ts` updated for `PRO_MAX` and passing

---

## Appendix — Open questions / deferred

- **Refund flow:** scope explicitly out-of-scope. Will require new state-machine triggers (`refund.processed.full` → revert to prior state). Future architecture doc.
- **iOS App Clip for UPI:** Android-only intent URL in this round; iOS gets queued mandate creation via Razorpay hosted page fallback (no deep-link).
- **Multi-business per-user pricing:** each Business has its own Subscription row — model doesn't change for this. Multi-business UI rollup is a separate FE concern.
- **WebSocket push fanout (`push_fanout` side effect):** HP currently has no WS infrastructure. Side effect is a no-op stub for now; FE polls (`useSubscription` staleTime: 30s). Future: add real fanout when WS lands.
