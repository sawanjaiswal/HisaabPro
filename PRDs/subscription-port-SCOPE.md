# SCOPE: subscription-port
**Mission slug:** subscription-port
**Date:** 2026-05-15
**Mode:** AUGMENT — keep HP's working Subscription model, add DH-only features on top.
**Status:** draft (awaiting architect approval)

---

## Summary

Port DudhHisaab's production-grade subscription engine into HisaabPro: 4th tier (PRO_MAX), state machine + writer SSOT replacing direct Prisma mutations in webhook handlers, UPI Autopay mandate flow, overflow grace period, RS256 offline entitlement JWT, per-business feature addons, and admin comp-grant routes. HP's existing `Subscription` model, `subscription-gate.ts` middleware, `plans.ts`, `PlanGate`, and `useSubscription` hook are all KEPT and EXTENDED — nothing is ripped out.

---

## In Scope

- Add `PRO_MAX` as a 4th tier value to `plans.ts` and `plan-limits.ts` (string column — no enum migration needed)
- `SubscriptionState` state machine ported from DH (`NONE | PROMO_ACTIVE | TRIAL_NO_AUTOPAY | ACTIVE | PAST_DUE | LOCKED | CANCELLED`)
- Writer SSOT (`subscription.writer.ts` + `subscription.writer.events.ts`) so all webhook handlers route events through `applySubscriptionEvent()` instead of raw Prisma upserts
- `SubscriptionEvent` audit log table (immutable append-only ledger)
- `FeatureAddon` model + `BusinessAddon` join (per-business feature unlocks purchased separately)
- UPI Autopay mandate flow: `upi-mandate.service.ts` + UPI intent URL builder + webhook handler for `mandate.created` / `mandate.cancelled` events
- Overflow grace: invoice quota overflow tracked with configurable grace window; `subscription-gate.ts` extended to honor grace period before hard-block
- RS256 offline entitlement JWT: `entitlement-jwt.service.ts` mints 48h token, returned on `/subscription` + `/auth/refresh`; FE verifies with public key via WebCrypto + IndexedDB trusted-time baseline
- Admin comp-grant routes: `POST /admin/subscriptions/:businessId/grant` and `POST /admin/subscriptions/:businessId/revoke`
- Cron additions: grace-expiry enforcer (`PAST_DUE → LOCKED`), mandate-renewal reminder, trial-end notifier
- FE: extend `useSubscription` return shape; add `SubscriptionStateBanner`, `MandateSetupDrawer`, `OverflowBanner`, `SubscriptionManagePage` (replacing the absent dedicated page)
- `.env.example` additions: `ENTITLEMENT_PRIVATE_KEY`, `ENTITLEMENT_PUBLIC_KEY`, `RAZORPAY_PLAN_PRO_MAX`, `RAZORPAY_MERCHANT_VPA`, `RAZORPAY_MERCHANT_NAME`

---

## Out of Scope

- Stripe (Razorpay only)
- Seat-based billing (users-as-seats pricing)
- Per-feature micro-pricing (priced per individual API endpoint)
- Multi-tenant plan inheritance (each Business gets its own Subscription row)
- Customer/supplier overflow packs (DH-specific — HP uses invoice quota model)
- Refund service (Phase 3 epic)
- Admin panel UI (admin routes only — no AdminPanel frontend component in this scope)
- iOS-specific UPI handling (Android deep-link only; iOS needs App Clip — later)
- SMS/WhatsApp subscription lifecycle notifications (notification system already ships these; just add event hooks)

---

## User Flows

### 1. Trial Start (new business)

1. Business created → `ensureFreeSubscription()` called at business-create time.
2. If business `createdAt` ≤ 30 days ago, `getBusinessPlan()` returns `PRO` + `isTrialing: true` (existing logic, unchanged).
3. New: state machine also writes `subscriptionState = TRIAL_NO_AUTOPAY` on the `Subscription` row.
4. FE `useSubscription` returns `{ state: 'TRIAL_NO_AUTOPAY', graceUntil: <30-day expiry> }`.
5. `SubscriptionStateBanner` shows "30-day PRO trial — X days left. Set up UPI Autopay to keep PRO after trial."

### 2. UPI Autopay Mandate Setup

1. User taps "Set up Autopay" in `MandateSetupDrawer`.
2. FE calls `POST /api/subscription/mandate/create` with device fingerprint header.
3. BE calls Razorpay Subscriptions API to create/associate mandate, returns `{ upiIntentUrl, mandateId }`.
4. FE on Android: `window.location.href = upiIntentUrl` (deep-links to GPay/PhonePe/BHIM).
5. UPI app completes mandate; Razorpay fires `mandate.created` webhook.
6. Webhook handler → state machine trigger `mandate.created` → `TRIAL_NO_AUTOPAY → PROMO_ACTIVE`.
7. FE polls `/subscription` (stale: 30s while mandate pending) or receives WS push (if push fanout wired).
8. Banner updates to "Autopay active — first charge on `<day31>`."

### 3. Checkout / Upgrade

1. User hits paywalled feature → `PlanGate` shows `UpgradePrompt` (existing).
2. User taps `Upgrade plan` → `UpgradeDrawer` opens (new component).
3. User selects tier (PRO / BUSINESS / PRO_MAX) + billing cycle.
4. FE calls `POST /api/subscription/checkout` → BE creates Razorpay subscription, returns `{ subscriptionId, checkoutUrl }`.
5. FE opens Razorpay checkout in WebView iframe (existing `razorpay.service.ts` + new `checkout-session.service.ts`).
6. Payment captured → Razorpay fires `payment.captured` + `subscription.activated`.
7. Webhook: `applySubscriptionEvent({ trigger: 'payment.captured.full', ... })` → state `ACTIVE`.
8. `SubscriptionEvent` audit row inserted.
9. FE: `useSubscription` refetches → `PlanGate` releases → feature visible.
10. Toast: "Subscription upgraded to PRO."

**Error path — payment failed:**
- Razorpay fires `payment.failed` → trigger `subscription.charged.failed` → `ACTIVE → PAST_DUE` → `set_grace` side effect writes `gracePeriodEndsAt = now + 7 days`.
- FE banner: "Payment failed. Retry within 7 days to keep access."

### 4. Downgrade

1. User opens Settings → Manage Subscription → "Change plan".
2. Selects lower tier (e.g., BUSINESS → PRO).
3. `ConfirmDialog`: "Your plan will downgrade to PRO at end of current billing period. Some features will be locked."
4. Confirmed → `PATCH /api/subscription/plan` with `{ targetTier: 'PRO' }`.
5. BE: calls `downgrade.service.ts` — schedules Razorpay subscription change at `current_end`; writes `pendingDowngrade` on `Subscription` row.
6. FE: badge "Downgrade scheduled: PRO on `<date>`".
7. On Razorpay `subscription.charged` with new plan ID → writer SSOT updates tier + clears `pendingDowngrade`.

**Error path:**
- Toast: "Downgrade failed. Your current plan is unchanged."

### 5. Cancel + Grace Period

1. User taps "Cancel subscription" → `ConfirmDialog`: "Cancel your subscription? You keep access until `<expiresAt>`."
2. Confirmed → `DELETE /api/subscription`.
3. BE trigger `user.cancel` → `ACTIVE → CANCELLED`; Razorpay subscription cancelled via API.
4. `expiresAt` remains; middleware honors it until expiry.
5. After `expiresAt`: cron `grace-expiry` fires → `subscription-gate` returns FREE entitlements.
6. FE banner: "Subscription cancelled. Access until `<date>`."

**Reactivate within grace:**
- User taps "Reactivate" → `POST /api/subscription/reactivate` → state machine `CANCELLED → ACTIVE` on new payment.

### 6. Grace Period — Payment Failure

1. `payment.failed` webhook → `ACTIVE → PAST_DUE`, `gracePeriodEndsAt = now + 7 days`.
2. Middleware: during grace, plan stays at paid tier. `isGrace: true` attached to response.
3. `OverflowBanner` shown: "Payment failed — retry before `<date>` to avoid downgrade."
4. Cron: if `now > gracePeriodEndsAt` → trigger `grace.expired` → `PAST_DUE → LOCKED`.
5. `LOCKED`: middleware returns `FREE` entitlements. Features gated again.
6. User retries payment → `payment.captured.full` → `LOCKED → ACTIVE`, grace cleared.

### 7. Offline Grace Window

1. On every successful auth (`/auth/refresh` or `/subscription` GET), BE issues RS256 entitlement JWT (48h TTL) with `{ businessId, planTier, features, graceUntil, iat, exp }`.
2. FE stores JWT in IndexedDB under key `entitlement_token`.
3. FE also stores server-issued `trustedTime` (ISO) alongside — used to detect clock rewind.
4. While offline: `useSubscription` reads JWT from IDB; if `exp > trustedTime + elapsed`, treats plan as valid.
5. After 48h without server confirmation: JWT expired → FE downgrades to FREE locally (soft lock, no data loss).
6. On reconnect: FE re-fetches `/subscription`, server issues new JWT, IDB updated.

**Clock rewind detection:** if `device.now < trustedTime`, reject JWT (cannot trust expiry math).

### 8. Admin Comp-Grant

1. Admin calls `POST /admin/subscriptions/:businessId/grant` with `{ tier: 'PRO_MAX', months: 3, reason: 'support_comp' }`.
2. BE validates admin session (AdminUser model); trigger `admin.force_activate`; writes `Subscription` + `SubscriptionEvent`.
3. Response: `{ success: true, data: { subscriptionId, tier, expiresAt } }`.
4. Admin calls `POST /admin/subscriptions/:businessId/revoke` to cancel early.

### 9. Invoice Quota Overflow (grace)

1. Business on FREE (50 invoices/month limit) creates invoice #51.
2. `requireQuota('invoices')` in middleware detects overflow.
3. If within grace window (`overflowGraceUntil` not expired): allow, set response header `X-Quota-Overflow: true`, decrement grace counter.
4. `OverflowBanner` shown: "Monthly limit reached (51/50). Upgrade to PRO for unlimited invoices."
5. After grace exhausted: hard 402 with `QUOTA_EXCEEDED`.

---

## API Surface

### Existing endpoints modified

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/businesses/:businessId/subscription` | Extended response: adds `state`, `graceUntil`, `mandateStatus`, `addons[]`, `offlineToken` |
| `POST` | `/api/razorpay/webhook` | Handlers rerouted through writer SSOT instead of direct Prisma upsert |

### New endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/subscription/checkout` | user | Create Razorpay subscription + return checkout session |
| `PATCH` | `/api/subscription/plan` | user | Schedule tier change (upgrade or downgrade) |
| `DELETE` | `/api/subscription` | user | Cancel subscription (triggers `user.cancel`) |
| `POST` | `/api/subscription/reactivate` | user | Re-activate from CANCELLED/LOCKED on new payment |
| `POST` | `/api/subscription/mandate/create` | user | Create UPI Autopay mandate, return UPI intent URL |
| `DELETE` | `/api/subscription/mandate` | user | Revoke UPI mandate |
| `GET` | `/api/subscription/mandate/status` | user | Mandate status polling endpoint |
| `POST` | `/api/admin/subscriptions/:businessId/grant` | admin | Comp-grant: set tier + expiry |
| `POST` | `/api/admin/subscriptions/:businessId/revoke` | admin | Revoke comp grant |
| `GET` | `/api/admin/subscriptions/:businessId` | admin | Admin view of subscription state + event log |

### API Contracts

```ts
// GET /api/businesses/:businessId/subscription
// Response (extended)
interface SubscriptionResponse {
  plan: 'FREE' | 'PRO' | 'BUSINESS' | 'PRO_MAX'
  status: 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING' | 'NONE' | 'LOCKED'
  state: 'NONE' | 'PROMO_ACTIVE' | 'TRIAL_NO_AUTOPAY' | 'ACTIVE' | 'PAST_DUE' | 'LOCKED' | 'CANCELLED'
  expiresAt: string | null        // ISO 8601
  graceUntil: string | null       // gracePeriodEndsAt ISO — non-null while PAST_DUE
  isTrialing: boolean
  isGrace: boolean
  startDate: string | null
  mandateStatus: 'NONE' | 'PENDING' | 'ACTIVE' | 'CANCELLED'
  addons: Array<{ name: string; features: Record<string, boolean> }>
  offlineToken: string | null     // RS256 JWT, 48h TTL — null if no private key
  usage: {
    invoices: { used: number; limit: number }
    users: { used: number; limit: number }
  }
}

// POST /api/subscription/checkout
interface CheckoutReq {
  tier: 'PRO' | 'BUSINESS' | 'PRO_MAX'
  billingCycle: 'monthly' | 'quarterly' | 'annual'
  couponCode?: string
}
interface CheckoutRes {
  subscriptionId: string          // Razorpay subscription ID
  checkoutUrl: string             // Razorpay hosted page URL
  amount: number                  // paise
  currency: 'INR'
}

// PATCH /api/subscription/plan
interface PlanChangeReq {
  targetTier: 'FREE' | 'PRO' | 'BUSINESS' | 'PRO_MAX'
  effectiveAt: 'now' | 'period_end'
}
interface PlanChangeRes {
  scheduledTier: string
  effectiveAt: string             // ISO 8601
}

// POST /api/subscription/mandate/create
interface MandateCreateRes {
  mandateId: string               // internal ID
  upiIntentUrl: string            // upi://pay?... deep-link
  razorpaySubscriptionId: string
}

// POST /api/admin/subscriptions/:businessId/grant
interface AdminGrantReq {
  tier: 'FREE' | 'PRO' | 'BUSINESS' | 'PRO_MAX'
  months: number                  // 1–36
  reason: string                  // audit note
}
interface AdminGrantRes {
  subscriptionId: string
  tier: string
  expiresAt: string
  grantedBy: string               // AdminUser ID
}

// Error shape (all endpoints)
// { success: false, error: { code: string, message: string, status: number } }
// codes: UPGRADE_REQUIRED (402), QUOTA_EXCEEDED (402), MANDATE_FAILED (422),
//        INVALID_STATE_TRANSITION (409), UNAUTHORIZED (401), FORBIDDEN (403)
```

---

## Data Model Delta

**HP's existing `Subscription` model is extended in-place. No model rename.**

### 1. Columns added to `Subscription`

```prisma
model Subscription {
  // ... existing columns preserved ...

  // State machine (all nullable — backward-compatible, populated on first transition)
  subscriptionState   String?   // 'NONE'|'PROMO_ACTIVE'|'TRIAL_NO_AUTOPAY'|'ACTIVE'|'PAST_DUE'|'LOCKED'|'CANCELLED'
  gracePeriodEndsAt   DateTime? // set by set_grace side-effect; cleared by clear_grace
  mandateId           String?   // FK → UpiMandate.id (logical, nullable)
  lastWebhookEventId  String?   // idempotency key from last Razorpay event
  autoRenew           Boolean   @default(true)
  nextBillingAt       DateTime?
  paymentMethod       String?   // 'upi' | 'card' | 'netbanking' | 'admin_grant'
  pendingDowngradeTier String?  // set on downgrade-scheduled, cleared on charge with new plan
  trialEndsAt         DateTime? // explicit trial end for TRIAL_NO_AUTOPAY state
  overflowGraceUntil  DateTime? // invoice quota overflow grace

  // planTier extended value: 'FREE'|'PRO'|'BUSINESS'|'PRO_MAX' (string column — no enum, no migration risk)
}
```

Migration note: all new columns are nullable with safe defaults — single `ALTER TABLE ADD COLUMN` per field, no backfills required. `planTier` is already `String` with `@default("FREE")` — add `PRO_MAX` as a valid string value with no schema change.

### 2. New table: `SubscriptionEvent` (audit ledger)

```prisma
model SubscriptionEvent {
  id             String   @id @default(cuid())
  businessId     String
  subscriptionId String
  trigger        String   // StateTrigger value
  fromState      String?  // null for initial events
  toState        String
  razorpayEventId String? // Razorpay webhook event ID for idempotency
  metadata       Json     @default("{}")
  createdAt      DateTime @default(now())

  business     Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  subscription Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([businessId, createdAt])
  @@index([razorpayEventId])     // idempotency lookup
  @@index([subscriptionId, trigger])
}
```

### 3. New table: `FeatureAddon`

```prisma
model FeatureAddon {
  id          String   @id @default(cuid())
  name        String   @unique // e.g. 'pos_mode', 'batch_tracking'
  displayName String
  description String?
  features    Json     // Record<featureFlag, boolean>
  priceMonthly Int     // paise
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  businessAddons BusinessAddon[]

  @@index([isActive, sortOrder])
}
```

### 4. New table: `BusinessAddon` (join)

```prisma
model BusinessAddon {
  id           String    @id @default(cuid())
  businessId   String
  addonId      String
  activatedAt  DateTime  @default(now())
  expiresAt    DateTime?
  grantedByAdminId String? // AdminUser ID if admin-granted

  business Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  addon    FeatureAddon @relation(fields: [addonId], references: [id], onDelete: Restrict)

  @@unique([businessId, addonId])
  @@index([businessId, expiresAt])
}
```

### 5. New table: `UpiMandate`

```prisma
model UpiMandate {
  id                     String    @id @default(cuid())
  businessId             String
  razorpaySubscriptionId String
  razorpayMandateId      String?   // Razorpay mandate token
  status                 String    @default("PENDING") // PENDING|ACTIVE|CANCELLED|FAILED
  upiVpa                 String?   // payer VPA (from webhook)
  createdAt              DateTime  @default(now())
  activatedAt            DateTime?
  cancelledAt            DateTime?
  revokedByUserId        String?

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, status])
  @@index([razorpaySubscriptionId])
}
```

### 6. Relations added to existing models

```prisma
// Business model — add:
subscriptionEvents SubscriptionEvent[]
businessAddons     BusinessAddon[]
upiMandates        UpiMandate[]

// Subscription model — add:
events SubscriptionEvent[]
```

### 7. `env.ts` additions

```ts
ENTITLEMENT_PRIVATE_KEY: z.string().optional()   // PEM RS256 private key
ENTITLEMENT_PUBLIC_KEY: z.string().optional()    // PEM RS256 public key (sent to FE)
RAZORPAY_PLAN_PRO_MAX: z.string().optional()
RAZORPAY_MERCHANT_VPA: z.string().optional()     // merchant UPI VPA
RAZORPAY_MERCHANT_NAME: z.string().optional()
SUBSCRIPTION_OVERFLOW_GRACE_DAYS: z.coerce.number().default(3)
SUBSCRIPTION_GRACE_PERIOD_DAYS: z.coerce.number().default(7)
```

---

## UI States

### `SubscriptionManagePage` (`/settings/subscription`)

- **Loading:** `<ListSkeleton rows={4}>` — covers plan card + usage bars + mandate section
- **Error:** `<ErrorState title="Could not load subscription" message="Check your connection and try again." onRetry />` 
- **Empty (FREE, no subscription row):** Plan card shows "Free Plan — 30-day trial active" + "Upgrade plan" CTA
- **Success:** Plan card with tier badge, status chip, usage bars, mandate section, billing history list

### `MandateSetupDrawer`

- **Loading:** Spinner + "Opening UPI app…"
- **Error:** "Mandate setup failed. Try again or pay manually." + retry button
- **Pending (waiting for webhook):** "Waiting for UPI confirmation…" + 60s polling indicator
- **Success:** "Autopay active" banner + close drawer

### `OverflowBanner` (inline on dashboard)

- **Loading:** hidden (no skeleton — banner is non-critical)
- **Error:** hidden
- **Empty (no overflow):** hidden
- **Active (grace remaining):** amber banner — "Monthly limit reached (N/50). Upgrade before `<date>`."

### `SubscriptionStateBanner` (sticky below header)

- **Loading:** hidden
- **Error:** hidden
- **TRIAL_NO_AUTOPAY:** blue info — "Trial ends in X days. Set up UPI Autopay to keep PRO."
- **PAST_DUE:** red warning — "Payment failed. Retry before `<date>` to avoid downgrade."
- **LOCKED:** red error — "Account locked. Renew to restore access."
- **PROMO_ACTIVE / ACTIVE:** hidden

### `UpgradeDrawer` (modal triggered from PlanGate)

- **Loading:** `<Skeleton>` tier cards
- **Error:** "Could not load plans. Try again." + retry
- **Empty:** not applicable (always shows 3+ tiers)
- **Success:** tier comparison cards + CTA button

---

## Cross-Feature Impact

| File | Change Required |
|------|----------------|
| `server/prisma/schema.prisma` | Add 8 columns to `Subscription`, add 4 new models, add relations to `Business` |
| `server/src/config/plans.ts` | Add `PRO_MAX` to `PlanTier`, `PLAN_HIERARCHY`, `PLAN_LIMITS` |
| `server/src/lib/env.ts` | Add 7 new env vars with zod schema |
| `server/src/services/razorpay-webhook.service.ts` | Replace direct Prisma upserts with `applySubscriptionEvent()` calls |
| `server/src/middleware/subscription-gate.ts` | Add grace-period check, state-machine-aware plan resolution, addon overlay |
| `server/src/lib/cron-scheduler.ts` | Register 3 new cron jobs: grace-expiry, mandate-renewal-reminder, trial-end |
| `server/src/routes/subscription.ts` | Add 7 new routes; extend GET response |
| `src/hooks/useSubscription.ts` | Extend `SubscriptionData` type + return shape for state, graceUntil, addons, offlineToken |
| `src/features/subscription/plan-limits.ts` | Add `PRO_MAX` tier (must stay in sync with server `plans.ts`) |
| `src/features/subscription/PlanGate.tsx` | Handle `PRO_MAX` tier in `minTierFor()` calls; accept `isGrace` prop |

---

## File Plan

### Backend (server)

| path | action | est_lines | layer |
|------|--------|-----------|-------|
| `server/prisma/schema.prisma` | modify | +120 | schema |
| `server/prisma/migrations/<ts>_subscription_port/migration.sql` | create | ~80 | migration |
| `server/src/config/plans.ts` | modify | +40 | constants |
| `server/src/lib/env.ts` | modify | +20 | constants |
| `server/src/services/subscription/subscription.types.ts` | create | ~60 | types |
| `server/src/services/subscription/subscription-state-machine.ts` | create | ~90 | pure logic |
| `server/src/services/subscription/subscription.writer.events.ts` | create | ~120 | pure logic |
| `server/src/services/subscription/subscription.writer.ts` | create | ~60 | orchestration |
| `server/src/services/subscription/subscription.writer.legacy.ts` | create | ~50 | orchestration |
| `server/src/services/subscription/entitlement-jwt.service.ts` | create | ~100 | service |
| `server/src/services/subscription/upi-mandate.service.ts` | create | ~120 | service |
| `server/src/services/subscription/upi-intent.utils.ts` | create | ~50 | utils (pure) |
| `server/src/services/subscription/checkout-session.service.ts` | create | ~120 | service |
| `server/src/services/subscription/downgrade.service.ts` | create | ~100 | service |
| `server/src/services/subscription/plan-cache.service.ts` | create | ~80 | service |
| `server/src/services/subscription/addon.service.ts` | create | ~100 | service |
| `server/src/services/subscription/subscription-admin.service.ts` | create | ~80 | service |
| `server/src/services/subscription/overflow-grace.service.ts` | create | ~70 | service |
| `server/src/services/subscription/ensure-free-subscription.ts` | create | ~40 | service |
| `server/src/services/subscription/cron-grace-expiry.ts` | create | ~70 | cron handler |
| `server/src/services/subscription/cron-trial-end.ts` | create | ~50 | cron handler |
| `server/src/services/subscription/cron-mandate-reminder.ts` | create | ~50 | cron handler |
| `server/src/schemas/subscription.schemas.ts` | create | ~80 | schema (Zod) |
| `server/src/middleware/subscription-gate.ts` | modify | +80 | middleware |
| `server/src/routes/subscription.ts` | modify | +150 | route |
| `server/src/routes/admin/subscriptions.admin.ts` | create | ~100 | route |
| `server/src/services/razorpay-webhook.service.ts` | modify | +60 (replace upserts) | service |
| `server/src/lib/cron-scheduler.ts` | modify | +30 | lib |

### Frontend (src)

| path | action | est_lines | layer |
|------|--------|-----------|-------|
| `src/features/subscription/subscription.types.ts` | create | ~80 | types |
| `src/features/subscription/subscription.constants.ts` | create | ~40 | constants |
| `src/features/subscription/plan-limits.ts` | modify | +30 | constants |
| `src/features/subscription/entitlement-idb.ts` | create | ~80 | utils (IndexedDB) |
| `src/features/subscription/entitlement-verify.utils.ts` | create | ~70 | utils (pure) |
| `src/features/subscription/upi-intent.utils.ts` | create | ~30 | utils (pure) |
| `src/hooks/useSubscription.ts` | modify | +40 | hook |
| `src/hooks/useEntitlementToken.ts` | create | ~80 | hook |
| `src/hooks/useMandateStatus.ts` | create | ~60 | hook |
| `src/features/subscription/PlanGate.tsx` | modify | +20 | component |
| `src/features/subscription/SubscriptionStateBanner.tsx` | create | ~80 | component |
| `src/features/subscription/OverflowBanner.tsx` | create | ~60 | component |
| `src/features/subscription/MandateSetupDrawer.tsx` | create | ~120 | component |
| `src/features/subscription/UpgradeDrawer.tsx` | create | ~150 | component |
| `src/features/subscription/PlanCard.tsx` | create | ~100 | component |
| `src/features/subscription/AddonBadge.tsx` | create | ~40 | component |
| `src/pages/SubscriptionManagePage.tsx` | create | ~200 | page |
| `src/features/subscription/subscription.css` | create | ~60 | css |
| `src/lib/translations.en.ts` | modify | +30 keys | i18n |
| `src/lib/translations.hi.ts` | modify | +30 keys | i18n |

**All rows ≤ 250 lines. Total: 28 BE files + 20 FE files = 48 files.**

---

## Build Plan

### Gate 0 — Schema + Migration

1. Add columns + new models to `schema.prisma`.
2. Run `npx prisma migrate dev --name subscription_port`.
3. Verify: `npx prisma studio` shows new tables; `npx tsc -b --noEmit` in server is clean.
4. **Checkpoint:** `SELECT * FROM "SubscriptionEvent" LIMIT 1` returns empty (no error).

### Gate 1 — Backend Core (state machine + writer)

1. Port `subscription.types.ts`, `subscription-state-machine.ts`, `subscription.writer.events.ts`, `subscription.writer.ts`, `subscription.writer.legacy.ts`.
2. Update `razorpay-webhook.service.ts` to use writer SSOT.
3. `npx tsc -b --noEmit` clean.
4. **Checkpoint:** Unit test `subscription-state-machine.test.ts` — all 14 transitions pass.

### Gate 2 — Backend Services (JWT, mandate, checkout, admin)

1. Add `entitlement-jwt.service.ts`, `upi-mandate.service.ts`, `checkout-session.service.ts`, `downgrade.service.ts`, `addon.service.ts`, `subscription-admin.service.ts`, `overflow-grace.service.ts`.
2. Update `subscription-gate.ts` with grace + state-machine-aware logic.
3. Register cron jobs in `cron-scheduler.ts`.
4. `npx tsc -b --noEmit` clean.
5. **Checkpoint (curl):**
   - `curl GET /api/businesses/:id/subscription` → `{ success: true, data: { state, offlineToken, ... } }`
   - `curl -X DELETE /api/subscription` (no auth) → `{ success: false, error: { code: 'UNAUTHORIZED', status: 401 } }`
   - `curl POST /api/subscription/checkout` (bad body) → `{ success: false, error: { code: 'VALIDATION_ERROR', status: 400 } }`

### Gate 3 — Admin Routes

1. Add `server/src/routes/admin/subscriptions.admin.ts`.
2. **Checkpoint:**
   - `curl POST /admin/subscriptions/:id/grant` (with admin token) → `{ success: true, data: { tier, expiresAt } }`
   - Same endpoint without admin token → 403.

### Gate 4 — Frontend Core (types, hook, IDB)

1. Add FE types, extend `useSubscription`, add `useEntitlementToken` + IDB layer.
2. `npx tsc -b --noEmit` clean in frontend.
3. **Checkpoint:** `useSubscription` returns `state`, `offlineToken` fields.

### Gate 5 — Frontend UI (components + page)

1. Add all components + `SubscriptionManagePage`.
2. Add routes in `App.tsx` (or router config).
3. **Checkpoint (screenshots):**
   - `SubscriptionManagePage` loading state ✓
   - `SubscriptionManagePage` success (FREE tier) ✓
   - `MandateSetupDrawer` open ✓
   - `SubscriptionStateBanner` PAST_DUE state ✓
   - 320px no overflow ✓

### Gate 6 — i18n + Drift Test Update

1. Add 30 EN + 30 HI keys.
2. Update `plan-limits.drift.test.ts` to include `PRO_MAX` row.
3. `node scripts/enforce.js` clean.

---

## Security Notes

- RS256 private key stored in env, never logged, never returned raw.
- Entitlement JWT is signed; FE verifies with public key (WebCrypto `importKey` + `verify`).
- Device fingerprint embedded in JWT — client verifies match before trusting offline grant.
- Admin grant routes require `AdminUser` session (separate auth path from business user auth).
- Webhook endpoint retains existing HMAC signature verification; no bypass introduced.
- All state machine transitions are validated; invalid transitions return 409 INVALID_STATE_TRANSITION.
- Idempotency: `razorpayEventId` unique-indexed on `SubscriptionEvent` — duplicate webhooks are no-ops.
- Grace-period bypass is not possible via client; server re-derives state from DB on every gated request (no client-supplied state accepted).

---

## Out of Scope (explicit)

- Stripe payment provider
- Seat-based (per-user) billing
- Per-feature micro-pricing
- Customer/supplier pack purchases (DH-specific model)
- Refund service
- Admin Panel frontend UI
- iOS UPI App Clip / StoreKit
- SMS/WhatsApp lifecycle notifications (notification system adds hooks — orchestration is notification system's job)
- Invoice PDF watermarking for FREE tier
- Multi-currency support

---

## Acceptance Criteria

- [ ] `curl GET /api/businesses/:businessId/subscription` → `{ success: true, data: { state: string, offlineToken: string|null, graceUntil: string|null, addons: [], mandateStatus: string } }`
- [ ] Without auth → `{ success: false, error: { code: 'UNAUTHORIZED', status: 401 } }`
- [ ] `POST /api/subscription/checkout` with invalid body → `{ success: false, error: { code: 'VALIDATION_ERROR', status: 400 } }`
- [ ] State machine: 14 defined transitions all pass unit test
- [ ] Duplicate webhook event (same `razorpayEventId`) → idempotent (second call is no-op, no duplicate `SubscriptionEvent` row)
- [ ] `PAST_DUE` business with `gracePeriodEndsAt` in future → middleware grants paid-tier access
- [ ] `PAST_DUE` business with `gracePeriodEndsAt` in past → cron sets `LOCKED`; middleware grants FREE access
- [ ] Admin grant: `POST /admin/subscriptions/:businessId/grant` (valid admin token) → `{ success: true }` + `SubscriptionEvent` row written
- [ ] Admin grant: same endpoint without admin token → 403
- [ ] Entitlement JWT: issued on `/subscription` GET when `ENTITLEMENT_PRIVATE_KEY` set; absent when key unset
- [ ] `PRO_MAX` tier: gated features include all BUSINESS features + at minimum `posMode`, `multiGodown`, `tallyExport`, `eInvoicing`, `batchTracking`, `serialTracking`
- [ ] `plan-limits.drift.test.ts` passes with `PRO_MAX` row
- [ ] `node scripts/enforce.js` → 0 errors
- [ ] `npx tsc -b --noEmit` (backend) → 0 errors
- [ ] `npx tsc -b --noEmit` (frontend) → 0 errors
- [ ] Screenshot: `SubscriptionManagePage` — loading ✓ · error ✓ · FREE state ✓ · PAID state ✓
- [ ] Screenshot: `MandateSetupDrawer` — open ✓ · pending ✓ · success ✓
- [ ] Screenshot: `SubscriptionStateBanner` — PAST_DUE ✓ · LOCKED ✓ · TRIAL_NO_AUTOPAY ✓
- [ ] 375px no overflow · 320px no overflow

---

## QA Checklist

- [ ] State machine tested for all 14 transitions (valid) + 3 invalid-transition rejections (409)
- [ ] Idempotency: replay same Razorpay `subscription.activated` webhook 3x — only 1 `SubscriptionEvent` row
- [ ] UPI intent URL format: starts with `upi://pay?pa=` and is URL-encoded
- [ ] JWT expiry: token issued at T; at T+49h, `useEntitlementToken` returns `expired: true`
- [ ] Clock rewind: set `trustedTime` to future; hook detects rewind and rejects token
- [ ] Grace period: set `gracePeriodEndsAt = yesterday`; cron `runGraceExpiryTick()` transitions PAST_DUE → LOCKED
- [ ] Admin grant sets `paymentMethod = 'admin_grant'` and `SubscriptionEvent.trigger = 'admin.force_activate'`
- [ ] Downgrade scheduling: `PATCH /subscription/plan { targetTier: 'PRO', effectiveAt: 'period_end' }` sets `pendingDowngradeTier` without changing current tier
- [ ] Addon overlay: `BusinessAddon` with `features.posMode = true` allows posMode even on PRO plan
- [ ] All new FE components pass 320px no-overflow check
- [ ] All strings in new components read from `t.*` via `useLanguage()` (both EN and HI)
- [ ] No raw `fetch()` calls — all API calls via `api()` from `@/lib/api`
- [ ] All mutations pass `entityType` + `entityLabel`
- [ ] No `localStorage` writes — IndexedDB only for entitlement token
