# SCOPE — Notifications Engine (F004 / F030 / F042 / F047 Phase Activation)

> Status: DRAFT — open questions listed in Section 15.
> This is a REWRITE of the existing `notification.service.ts` stub.
> The stub's three raw send functions (`sendEmail`, `sendWhatsApp`, `sendPushNotification`)
> are replaced by this engine. The existing `ReminderLog`, `ReminderConfig`, and
> `CollectionCadence` models are PRESERVED and extended, not replaced.

---

## 1. Summary

Build a production-ready, event-driven notifications engine for HisaabPro that activates
the four feature stubs currently gated behind missing credentials: F004 (Notifications),
F030 (Auto Invoice Sharing), F042 (Payment Reminders), and F047 (Low-Stock Alerts). The
engine follows the HP 6-layer split pattern, a `NotificationProvider` interface with
per-channel strategies, a DB-backed delivery queue (no new Redis dependency), and
respects user quiet hours, opt-out preferences, per-user rate limits, and monthly cost
budgets per business.

---

## 2. Goals and Non-Goals

### Goals

- `NotificationProvider` interface: WhatsApp (Aisensy), Push (FCM), Email (Resend), SMS
  (MSG91), In-app (DB).
- Event catalog: ~18 HP MSME events seeded at build time (see Section 3).
- Per-channel, per-event templates in English and Hindi with placeholder syntax.
- User preferences: opt-in/out per event-type per channel; quiet hours (default 10 PM–7 AM
  IST); per-user rate cap (max 10 external notifications/day across all channels combined).
- Delivery status lifecycle: `QUEUED → DISPATCHED → DELIVERED | FAILED`. Provider callbacks
  update status via inbound webhook routes.
- In-app notification inbox: bell icon + `/notifications` list page, unread count badge.
- Cost tracking: per-channel unit cost config, per-business monthly spend tally, hard cap
  (default Rs 500/month for Starter; Rs 2,000 for Pro; Rs 10,000 for Business).
- Multi-tenant isolation: every DB row scoped to `businessId`.
- Admin broadcast: admin can send an announcement to all users on a named plan tier — NOT
  cross-business data; only admin-facing UI in `/admin`.
- Reuse `cron-scheduler.ts` for the daily 08:00 IST digest/reminders job — no new
  scheduler process.
- Inbound webhooks for provider delivery receipts (Aisensy, MSG91, FCM-TTL).
- Fail-soft policy: if ALL external providers down, notifications degrade to in-app only.
  Server never 500s a user-facing request due to a notification failure.

### Non-Goals (Phase 5+)

- Marketing/bulk SMS blasts to entire customer base (IDEAS_BACKLOG #123, #124).
- Push notification topic subscriptions (FCM topics).
- WhatsApp two-way chat / reply parsing.
- Email newsletter sequences / drip campaigns.
- Third-party provider failover (e.g., Aisensy down → MSG91 WhatsApp fallback) — provider
  is fixed per channel in this phase.
- SMS OTP (already handled separately via MSG91 in auth service).

---

## 3. Event Catalog

Seeded as an enum + metadata map in `notification-events.ts`. Each event carries default
channel selection and priority.

| Event Key | Trigger | Default Channels | Priority |
|---|---|---|---|
| `INVOICE_CREATED` | Document saved (sale invoice) | WhatsApp, In-app | HIGH |
| `INVOICE_SHARED` | User taps Share on invoice | WhatsApp, Email | HIGH |
| `PAYMENT_RECEIVED` | Payment In recorded | WhatsApp, In-app | HIGH |
| `PAYMENT_OVERDUE` | Cron: due date passed, balance > 0 | WhatsApp, SMS, In-app | HIGH |
| `PAYMENT_REMINDER` | Manual or cadence trigger | WhatsApp, SMS | HIGH |
| `PAYMENT_LINK_OPENED` | Razorpay payment link clicked | In-app | MEDIUM |
| `PAYMENT_LINK_PAID` | Razorpay payment link paid | WhatsApp, Push, In-app | HIGH |
| `EXPENSE_RECORDED` | Expense created | In-app | LOW |
| `RECURRING_INVOICE_GENERATED` | Cron: recurring runner fires | In-app | MEDIUM |
| `RECURRING_EXPENSE_PENDING` | Cron: recurring expense materialised pending | Push, In-app | MEDIUM |
| `LOW_STOCK_ALERT` | Stock quantity <= reorder point | Push, In-app | MEDIUM |
| `BATCH_EXPIRY_ALERT` | Cron: batch within expiry threshold | Push, In-app | MEDIUM |
| `STOCK_OUT` | Stock hits zero on invoice save | Push, In-app | HIGH |
| `PTP_DUE_TODAY` | Cron: promise-to-pay promise date = today | WhatsApp, In-app | HIGH |
| `PTP_BROKEN` | Cron: promise-to-pay past date, not kept | In-app | MEDIUM |
| `SUBSCRIPTION_EXPIRING_SOON` | Cron: trial/plan < 7 days remaining | Push, Email, In-app | HIGH |
| `SUBSCRIPTION_EXPIRED` | Subscription status → expired | Push, Email, In-app | HIGH |
| `ADMIN_BROADCAST` | Admin sends announcement | Push, Email, In-app | HIGH |

---

## 4. Architecture

### 4.1 Layers (6-layer HP split)

```
src/features/notifications/
  notification-events.ts          // event catalog + metadata (< 80 LOC)
  notification-provider.ts        // NotificationProvider interface (< 50 LOC)
  providers/
    whatsapp.provider.ts          // Aisensy adapter (< 150 LOC)
    push.provider.ts              // FCM adapter (< 120 LOC)
    email.provider.ts             // Resend adapter (< 120 LOC)
    sms.provider.ts               // MSG91 adapter (< 100 LOC)
    inapp.provider.ts             // DB insert only (< 80 LOC)
  notification-template.service.ts  // template render + i18n (< 200 LOC)
  notification-preference.service.ts // read/write user prefs + quiet hours (< 150 LOC)
  notification-dispatch.service.ts  // fan-out logic, rate check, cost check (< 200 LOC)
  notification-queue.service.ts     // DB-backed queue (enqueue/dequeue/retry) (< 200 LOC)
  notification-cost.service.ts      // cost tally + cap enforcement (< 120 LOC)
  notification.manager.ts           // public facade called by all other features (< 100 LOC)
  notification.routes.ts            // user-facing REST endpoints (< 200 LOC)
  notification-webhook.routes.ts    // inbound provider callbacks (< 150 LOC)
  notification-admin.routes.ts      // admin broadcast (< 100 LOC)
  notifications.page.tsx            // in-app inbox page (< 250 LOC)
  NotificationBell.tsx              // bell icon + badge (< 120 LOC)
  NotificationPreferencesPage.tsx   // per-event opt-out settings (< 250 LOC)
```

### 4.2 Queue Strategy: DB-backed (no new Redis instance)

Decision: use a `NotificationJob` Prisma table (status: `QUEUED | PROCESSING | DONE |
FAILED | DEAD`). The existing `cron-scheduler.ts` gets one new 1-minute heartbeat job
that drains the queue in batches of 50. This avoids adding Bull/Redis as a new
infrastructure dependency — HP already has Redis only for rate limiting (F065). If
Redis is already up, a Bull queue can be wired as an upgrade in Phase 2 without changing
the `NotificationProvider` interface.

Rationale against Bull now:
- HP targets Rs 8K–15K Android phones on 2G; the notification throughput for a single
  MSME business is < 200 events/day. DB polling at 1-min intervals handles this easily.
- Render's free/starter tier has single-process deployment; Bull requires a separate
  worker process.

If queue depth consistently exceeds 500 items at drain time (monitored via
`NotificationJob` count), upgrade to Bull is a drop-in swap on `notification-queue.service.ts`.

### 4.3 Provider Interface

```ts
interface NotificationProvider {
  channel: NotificationChannel
  send(job: NotificationJob): Promise<ProviderResult>
  isConfigured(): boolean
}

type ProviderResult = {
  success: boolean
  externalId?: string
  error?: string
  costPaise?: number
}
```

### 4.4 Dispatch Flow

```
1. Feature calls notification.manager.ts → emit(eventKey, context)
2. manager → notification-dispatch.service.ts
3. dispatch: resolve target channels for event (user pref + event defaults)
4. dispatch: check quiet hours (skip or schedule for next morning window)
5. dispatch: check rate limit (max 10 external notifs/user/day)
6. dispatch: check cost cap (per business monthly budget)
7. dispatch: render template (language from user prefs)
8. dispatch: enqueue NotificationJob rows per channel
9. cron heartbeat (every 1 min): drain up to 50 QUEUED jobs
10. for each job: call provider.send() → update status → update cost tally
11. provider webhooks (Aisensy/MSG91 callbacks): update DISPATCHED → DELIVERED | FAILED
```

### 4.5 Cron Integration

New jobs added to `cron-scheduler.ts`:

```
- Notification queue drain: every 1 min (*/1 * * * *)
- Daily digest + PAYMENT_OVERDUE scan: 08:00 IST (0 8 * * *)
- SUBSCRIPTION_EXPIRING_SOON scan: 09:00 IST (0 9 * * *)
```

### 4.6 SSE Integration

After in-app notification insert, fire `businessId:notification:new` SSE event so the
bell badge updates without a page reload. Uses existing `events.ts` SSE route.

---

## 5. Templates

### 5.1 Placeholder Syntax

`{{business_name}}`, `{{party_name}}`, `{{amount}}`, `{{invoice_no}}`, `{{due_date}}`,
`{{product_name}}`, `{{stock_qty}}`, `{{plan_name}}`, `{{days_left}}`.

Amounts always formatted as `Rs {{amount}}` (paise → Rs conversion server-side before
template render). No floating point in templates.

### 5.2 Sample Templates

**PAYMENT_OVERDUE — WhatsApp — English**
> Hi {{party_name}}, your payment of Rs {{amount}} for invoice {{invoice_no}} from
> {{business_name}} is overdue. Please pay at your earliest. — HisaabPro

**PAYMENT_OVERDUE — WhatsApp — Hindi**
> नमस्ते {{party_name}}, {{business_name}} का चालान {{invoice_no}} (रु {{amount}}) की
> भुगतान तिथि निकल गई है। कृपया जल्द भुगतान करें। — HisaabPro

**LOW_STOCK_ALERT — Push — English**
> Title: Low Stock Alert
> Body: {{product_name}} has only {{stock_qty}} units left. Time to reorder.

**INVOICE_SHARED — Email — English**
> Subject: Invoice {{invoice_no}} from {{business_name}}
> Body: HTML email with PDF attachment (delegates to existing `sendEmail` in Resend
> adapter).

### 5.3 Template Storage

Templates seeded as static `const` map in `notification-template.service.ts` (no DB
table). Custom templates are NOT in scope for this phase. Admin can override
`whatsappTemplate` + `smsTemplate` per business via `ReminderConfig` (already in schema)
for reminder events only.

### 5.4 Template Preview UI

In `NotificationPreferencesPage.tsx`: a "Preview" button per event+channel opens a modal
showing the rendered template with placeholder values filled from the user's own business
data. No new endpoint — renders client-side from static template map.

---

## 6. User Preferences

### 6.1 Data Model Addition

New `NotificationPreference` table (see Section 10). Per user, per event, per channel
opt-in boolean. Defaults: ALL events + ALL channels = opted-in at first use.

### 6.2 Quiet Hours

Stored in `ReminderConfig.quietHoursStart` / `quietHoursEnd` (already in schema, per
business). Default: `22:00`–`07:00` IST. During quiet hours, external notifications
(WhatsApp, SMS, Push, Email) are deferred to `07:00` IST next morning by setting
`NotificationJob.scheduledAt`. In-app notifications are never deferred.

### 6.3 Per-User Rate Limit

Hard cap: 10 external notifications per user per calendar day (IST). Counted across all
channels combined. In-app excluded from cap. If cap hit, job is marked `DEAD` with reason
`RATE_CAP_EXCEEDED` and an in-app notification is still created.

---

## 7. Admin Broadcast

Admin can send a one-off announcement to all users on a named plan tier.

- Route: `POST /api/admin/notifications/broadcast`
- Auth: admin JWT only (`requireAdmin` middleware).
- Body: `{ planTier: 'STARTER' | 'PRO' | 'BUSINESS' | 'ALL', titleEn, titleHi, bodyEn, bodyHi, channel: 'PUSH' | 'EMAIL' | 'IN_APP' }`
- Creates `NotificationJob` rows in batch of 100 per DB page (cursor pagination). Does
  NOT use the regular user opt-out preferences — admin broadcast always fires.
- Admin does NOT see individual user phone numbers or financial data.
- Rate limit: 2 broadcasts per admin per 24h.

---

## 8. Cost Tracking

### 8.1 Unit Costs (configurable in env, defaults below)

| Channel | Default unit cost |
|---|---|
| WhatsApp (Aisensy) | Rs 0.25 per message |
| SMS (MSG91) | Rs 0.15 per message |
| Push (FCM) | Rs 0.00 (free) |
| Email (Resend) | Rs 0.00 (free tier 3K/month) |
| In-app | Rs 0.00 |

### 8.2 Monthly Budget Cap per Plan

| Plan | Default monthly cap |
|---|---|
| STARTER | Rs 500 |
| PRO | Rs 2,000 |
| BUSINESS | Rs 10,000 |

Costs accumulated in `NotificationCostTally` (see Section 10). Hard cap enforced in
`notification-cost.service.ts` before dispatch. When remaining budget < 20% of cap, a
one-time `NOTIFICATION_BUDGET_WARNING` in-app notification is created for the business
owner.

### 8.3 Cost Reset

Monthly tallies reset on the 1st of each month via a new cron job at 00:05 IST
(`5 0 1 * *`).

---

## 9. Delivery Status Logging

### 9.1 Lifecycle

```
QUEUED → PROCESSING → DISPATCHED → DELIVERED
                    → FAILED (retry up to 3x, 5 min backoff)
                              → DEAD after 3 failures
```

### 9.2 Provider Webhook Callbacks

| Provider | Callback URL | Status Updates |
|---|---|---|
| Aisensy | `POST /api/webhooks/notifications/aisensy` | DELIVERED, FAILED |
| MSG91 | `POST /api/webhooks/notifications/msg91` | DELIVERED, FAILED |
| FCM | No callback; TTL expiry handled at send time | — |

Webhook routes validate provider-specific HMAC/token signatures. Signature secret stored
in env (`AISENSY_WEBHOOK_SECRET`, `MSG91_WEBHOOK_SECRET`).

---

## 10. API Surface

### 10.1 User-Facing Endpoints

```ts
// In-app inbox
GET  /api/notifications
  // query: { cursor?, limit=20, unreadOnly=false }
  // Response: { data: Notification[], nextCursor, unreadCount }

POST /api/notifications/:id/read
  // marks single notification as read
  // Response: { success: true }

POST /api/notifications/read-all
  // marks all as read for this user+business
  // Response: { success: true, count: number }

GET  /api/notifications/unread-count
  // Response: { data: { count: number } }

// Preferences
GET  /api/notifications/preferences
  // Response: { data: NotificationPreference[] }

PUT  /api/notifications/preferences
  // Body: { preferences: Array<{ eventKey, channel, enabled }> }
  // Response: { success: true }

// Settings (quiet hours, cost)
GET  /api/notifications/settings
  // Returns ReminderConfig fields relevant to notifications
  // Response: { data: NotificationSettings }

PUT  /api/notifications/settings
  // Body: { quietHoursStart, quietHoursEnd }
  // Response: { success: true }
```

### 10.2 Admin Endpoints

```ts
POST /api/admin/notifications/broadcast
  // Body: BroadcastReq (see Section 7)
  // Response: { success: true, data: { jobsQueued: number } }

GET  /api/admin/notifications/delivery-stats
  // query: { from, to, channel? }
  // Response: { data: DeliveryStats }
```

### 10.3 Webhook Endpoints (inbound from providers)

```ts
POST /api/webhooks/notifications/aisensy
POST /api/webhooks/notifications/msg91
  // Both: validated by HMAC; update NotificationJob status
  // Response: 200 OK always (to prevent provider retry storms)
```

---

## 11. Data Model

### 11.1 New Prisma Models

```prisma
model Notification {
  id         String   @id @default(cuid())
  businessId String
  userId     String

  eventKey   String   @db.VarChar(60)
  titleEn    String   @db.VarChar(120)
  titleHi    String   @db.VarChar(120)
  bodyEn     String   @db.Text
  bodyHi     String   @db.Text

  isRead     Boolean  @default(false)
  readAt     DateTime?

  // Optional link for tap-to-navigate
  entityType String?  @db.VarChar(40)
  entityId   String?

  createdAt  DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([businessId, userId, isRead, createdAt])
  @@index([businessId, userId, createdAt])
}

enum NotificationJobStatus {
  QUEUED
  PROCESSING
  DISPATCHED
  DELIVERED
  FAILED
  DEAD
}

enum NotificationChannel {
  WHATSAPP
  PUSH
  EMAIL
  SMS
  IN_APP
}

model NotificationJob {
  id         String                 @id @default(cuid())
  businessId String
  userId     String

  eventKey   String                 @db.VarChar(60)
  channel    NotificationChannel
  status     NotificationJobStatus  @default(QUEUED)

  payload    Json                   // rendered template + recipient details
  externalId String?                @db.VarChar(100)

  scheduledAt DateTime             @default(now())
  processedAt DateTime?
  deliveredAt DateTime?
  failedAt    DateTime?
  failureReason String?            @db.VarChar(500)
  retryCount  Int                  @default(0)

  costPaise   Int                  @default(0)

  createdAt   DateTime             @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([status, scheduledAt])
  @@index([businessId, status, createdAt])
  @@index([externalId])
}

model NotificationPreference {
  id         String  @id @default(cuid())
  businessId String
  userId     String
  eventKey   String  @db.VarChar(60)
  channel    NotificationChannel
  enabled    Boolean @default(true)

  updatedAt  DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([businessId, userId, eventKey, channel])
  @@index([businessId, userId])
}

model NotificationCostTally {
  id         String   @id @default(cuid())
  businessId String
  month      String   @db.VarChar(7)    // "2026-05"
  channel    NotificationChannel
  totalPaise Int      @default(0)
  sentCount  Int      @default(0)
  updatedAt  DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@unique([businessId, month, channel])
  @@index([businessId, month])
}
```

### 11.2 Existing Models — No Changes Required

- `ReminderConfig` — quiet hours + per-business reminder templates already there.
- `ReminderLog` — existing payment-reminder log preserved; NOT merged into
  `NotificationJob` to avoid a breaking migration on a live table.
- `CollectionCadence` — untouched.

---

## 12. Multi-Tenant Isolation

- Every `Notification`, `NotificationJob`, `NotificationPreference`, and
  `NotificationCostTally` row carries `businessId`.
- All queries add `where: { businessId }` — no cross-business query is possible via the
  user-facing routes.
- Admin broadcast creates jobs scoped to each target user's `businessId`.
- Provider webhooks match `externalId` to a `NotificationJob` row; the route never
  returns business data in its 200 OK response.
- SSE event includes only `{ type: 'notification:new', unreadCount }` — no message
  content over SSE to prevent cross-tab data leaks on shared devices.

---

## 13. UI States (all screens)

### 13.1 Notification Inbox (`/notifications`)

| State | Display |
|---|---|
| Loading | Shimmer list of 5 skeleton rows, bell badge shows `…` |
| Empty (no notifications) | Illustration + "No notifications yet" + "You're all caught up!" (Hindi: "कोई सूचना नहीं") |
| Error | "Could not load notifications. Tap to retry." with retry button |
| Success | Chronological list; unread rows have left blue border accent; tap marks as read + navigates to entity if `entityId` set |

### 13.2 Notification Preferences (`/settings/notifications`)

| State | Display |
|---|---|
| Loading | Shimmer toggle rows |
| Empty | Cannot be empty — event catalog always has entries |
| Error | "Could not load preferences. Tap to retry." |
| Success | Toggle grid: rows = events, columns = channels; unavailable channels (e.g., WhatsApp if no phone) are disabled with tooltip "Add phone number to enable" |

### 13.3 Bell Icon (`NotificationBell.tsx`)

| State | Display |
|---|---|
| Loading (on mount) | Bell icon, no badge |
| 0 unread | Bell icon, no badge |
| 1–9 unread | Bell icon + blue filled badge with count |
| 10+ unread | Bell icon + badge showing "9+" |

---

## 14. UX Copy

| Element | English | Hindi |
|---|---|---|
| Page title | Notifications | सूचनाएं |
| Mark all read button | Mark all read | सब पढ़ा |
| Empty state heading | You're all caught up | सब अपडेट हैं |
| Empty state subtext | No notifications yet | अभी कोई सूचना नहीं |
| Error state | Could not load notifications. Tap to retry. | सूचनाएं लोड नहीं हुईं। फिर कोशिश करें। |
| Preferences page title | Notification Preferences | सूचना प्राथमिकताएं |
| Quiet hours label | Quiet hours | शांत समय |
| Quiet hours subtext | No notifications between these hours | इस समय कोई सूचना नहीं |
| Budget warning in-app | You've used 80% of your notification budget this month. | इस महीने 80% नोटिफिकेशन बजट उपयोग हो गया। |
| Toast: preferences saved | Preferences saved | प्राथमिकताएं सहेजी |
| Toast: preferences error | Could not save preferences | प्राथमिकताएं सहेज नहीं हुईं |
| Toast: mark all read success | All notifications marked as read | सब सूचनाएं पढ़ी गईं |

---

## 15. Mobile

- Bell icon sits in the top-right of the app header bar, consistent across all pages.
- `/notifications` page: full-screen list, `max-w-lg mx-auto` on tablet, 375px native on
  mobile. Each row: icon (event-type color dot) + title + relative time ("2 min ago") +
  chevron if `entityId` set.
- 320px minimum: no horizontal overflow — title truncates at 2 lines, body at 1 line.
- Capacitor push: on Android, notification appears in system tray; tap opens the app and
  deep-links to entity route via `entityType` + `entityId` in FCM `data` payload.
- iOS: same via APNs (FCM handles APNs bridging via Firebase).
- Offline: bell badge counts from IndexedDB cache of in-app notifications (Dexie, cached
  with `cacheReads: true`). No external notifications dispatched while offline — queue
  drainer won't run.

---

## 16. Security Considerations — Flag for Security Agent

The following paths created by this feature trigger the high-risk gate:

| Path | Risk | Required review |
|---|---|---|
| `server/src/routes/notification-webhook.routes.ts` | Matches `**/routes/**/webhooks.ts` pattern | architect, security |
| `server/src/routes/notification-admin.routes.ts` | Admin cross-tenant broadcast | security |

Security audit MUST verify:
1. Aisensy HMAC verification — `X-Aisensy-Signature` header validated against
   `AISENSY_WEBHOOK_SECRET` before any DB write.
2. MSG91 signature — `X-MSG91-Signature` validated against `MSG91_WEBHOOK_SECRET`.
3. Admin broadcast: double-check `requireAdmin` middleware; broadcast body is plain text
   only — no HTML, no template injection vector.
4. `NotificationJob.payload` column stores rendered text only — never stores raw user
   JWT, phone number in cleartext (phone masked to last 4 digits in logs).
5. Provider error responses never reflected to caller (log internally, return generic
   error).
6. Rate limit: admin broadcast endpoint — 2/day per admin, not bypassable by user token.
7. Idempotency key required on all broadcast POSTs.

---

## 17. Edge Cases

| Scenario | Handling |
|---|---|
| Provider API down (Aisensy/MSG91) | Retry 3x with 5 min exponential backoff → DEAD. In-app notification always fires first (instant). |
| ALL external providers down | In-app only. No 500 to user. Business owner sees "Notification delivery degraded" in admin panel. |
| User opted out of a channel mid-flight | Job already QUEUED proceeds (opt-out checked at enqueue, not dispatch). Future jobs skip. |
| Recipient phone number invalid | Provider adapter validates via E.164 regex before send. Job → DEAD with reason `INVALID_PHONE`. |
| WhatsApp not activated by recipient | Aisensy returns 400. Job → FAILED → retry 2x → DEAD. |
| FCM token expired | Firebase returns `messaging/registration-token-not-registered`. Token removed from user record. Job → DEAD. |
| Quiet hours — notification enqueued at 11 PM | `scheduledAt` set to 07:00 IST next morning. In-app fires immediately regardless. |
| Duplicate event fired within 60 sec (SSE rapid-fire) | Dedupe check in `notification-dispatch.service.ts`: query for existing `QUEUED` or `DISPATCHED` job with same `(userId, eventKey, channel)` within last 60s — skip if found. |
| Monthly cost cap reached | All new external notification jobs → DEAD with `COST_CAP_EXCEEDED`. In-app still fires. Owner notified via one in-app message. |
| User with no phone (WhatsApp/SMS) | Channels skipped at dispatch. In-app + Push (if FCM token present) only. |
| Admin broadcast to 10K users | Paginated job creation: 100 jobs per DB transaction, cursor pagination. No single large transaction. |
| GDPR-style retention | `Notification` rows older than 90 days deleted by new weekly cron at 02:00 IST Sunday. `NotificationJob` rows (non-QUEUED) older than 30 days purged. |
| Double-read-all tap | `read-all` endpoint: upserts `isRead=true` for all unread rows — idempotent. |
| Business deleted | Cascade delete on `businessId` handles all child rows. |

---

## 18. Effort + Dependencies

| Task | Effort | Depends On |
|---|---|---|
| Data model migration (4 new models) | 0.5 day | architect sign-off |
| Provider adapters × 5 | 1 day | env credentials provisioned |
| Template service (18 events × 2 langs × 2+ channels) | 0.5 day | — |
| Dispatch + queue service | 1 day | — |
| Cost service | 0.5 day | — |
| Preference service + routes | 0.5 day | — |
| Cron integration (3 new jobs in cron-scheduler.ts) | 0.5 day | — |
| Webhook routes + HMAC verification | 0.5 day | security agent sign-off |
| Admin broadcast route | 0.5 day | security agent sign-off |
| In-app inbox UI (NotificationsPage + Bell) | 1 day | — |
| Notification preferences UI | 0.5 day | — |
| i18n keys (EN + HI) | 0.5 day | — |
| **Total** | **~7 days** | — |

---

## 19. Open Questions for Sawan

1. **Queue infra**: Confirm DB-backed queue (no Redis) for this phase. If Redis is already
   provisioned on Render for rate-limiting (F065), Bull can be added at ~0.5 day
   marginal cost. Which do you prefer?

2. **Event catalog seed count**: The 18 events above cover the 4 unblocked features. Are
   there any events to add or remove before implementation starts?

3. **Cost cap defaults**: Rs 500 / Rs 2,000 / Rs 10,000 per plan tier per month — do
   these match your Aisensy/MSG91 contract rates, or should we adjust?

4. **FCM token storage**: Where are device tokens currently stored? Is there an existing
   `UserDevice` or `PushToken` model in schema (not found during review), or should
   `NotificationJob.payload` carry the token at enqueue time only?

5. **Admin broadcast scope**: Confirm in scope (admin panel only, plan-tier targeting,
   NOT business-to-business contact lists). Is there a delivery report UI needed for
   admin broadcast, or just a queued-count acknowledgement?

6. **WhatsApp template registration**: Aisensy requires pre-approved template names (e.g.,
   `payment_overdue_en`, `low_stock_en`). Are these already registered in Aisensy, or
   does template registration need to be part of this task?

7. **Notification retention**: 90 days for inbox, 30 days for job log — acceptable, or
   should this be user-configurable per business?

---

## 20. Acceptance Criteria

- [ ] `curl POST /api/notifications/preferences` (auth) → `{ success: true }`
- [ ] `curl GET /api/notifications` (auth) → `{ success: true, data: [...], unreadCount: N }`
- [ ] `curl POST /api/notifications/:id/read` (auth) → `{ success: true }`
- [ ] `curl GET /api/notifications` (no auth) → `401`
- [ ] `curl PUT /api/notifications/preferences` (bad body) → `400`
- [ ] `curl POST /api/admin/notifications/broadcast` (user token, not admin) → `403`
- [ ] `curl POST /api/webhooks/notifications/aisensy` (no HMAC) → `401`
- [ ] `curl POST /api/webhooks/notifications/aisensy` (valid HMAC) → `200`
- [ ] Notification created for INVOICE_CREATED event → in-app row visible in inbox.
- [ ] Quiet hours: notification enqueued at 11 PM → `scheduledAt` = 07:00 IST next day.
- [ ] Rate cap: 11th external notification for user on same day → DEAD with `RATE_CAP_EXCEEDED`.
- [ ] Cost cap hit → new external jobs → DEAD with `COST_CAP_EXCEEDED`; in-app still fires.
- [ ] Bell badge: unread count updates via SSE within 2s of in-app notification insert.
- [ ] 375px inbox: no horizontal overflow · 320px: title wraps at 2 lines, no overflow.
- [ ] Screenshot: inbox loading ✓ · empty ✓ · error ✓ · populated ✓
- [ ] Screenshot: preferences loading ✓ · success ✓
- [ ] `tsc --noEmit` clean across all new files.
- [ ] `scripts/enforce-offline.mjs` passes (all service mutations use `api()` + `entityType`).
- [ ] Admin broadcast creates `N` jobs equal to user count on target tier.

---

## 21. QA Checklist

Verifier must confirm each item before marking feature DONE.

- [ ] WhatsApp message delivered to a real phone (test number) for PAYMENT_REMINDER event.
- [ ] SMS delivered via MSG91 for PAYMENT_OVERDUE event.
- [ ] FCM push appears in Android system tray; tap deep-links to correct entity route.
- [ ] Email delivered via Resend for INVOICE_SHARED event with PDF attachment.
- [ ] In-app notification appears in inbox, bell badge increments.
- [ ] Mark-all-read clears badge to 0.
- [ ] Preference toggle off for WhatsApp on PAYMENT_REMINDER → no WhatsApp job enqueued.
- [ ] Quiet hours respected: notification queued 11 PM, not sent until 07:00 IST.
- [ ] Provider down: notification job retried 3x, then DEAD; in-app still delivered.
- [ ] Cost tally incremented after each paid-channel dispatch.
- [ ] Monthly cost reset on 1st of month (cron manual trigger test).
- [ ] Admin broadcast: only users on target plan tier receive jobs.
- [ ] Webhook HMAC validation: tampered payload → 401.
- [ ] No cross-business data accessible via any notification endpoint.
- [ ] 90-day Notification purge cron runs without error on staging.
- [ ] All new i18n keys present in both `en.json` and `hi.json`.

---

## 22. Out of Scope

- Marketing bulk SMS / email blasts to customer contact lists (Phase 5 #123, #124).
- WhatsApp two-way reply parsing or chatbot flows.
- Email newsletter sequences or drip campaigns.
- Third-party provider auto-failover (e.g., Aisensy down → alternate WA provider).
- In-app notification grouping or threading.
- Push notification topic subscriptions (FCM topics).
- Custom notification templates per business (Phase 2 of this feature).
- Delivery analytics dashboard for business owners (Phase 2).
- SMS OTP — handled by existing MSG91 auth path.
- Any change to `services/auth*` paths — notification preference endpoints use the
  existing `auth` middleware unchanged.
