---
status: approved
feature: notifications-engine
created: 2026-05-07T00:00:00Z
approver: Sawan
high_risk_paths_touched:
  - server/src/routes/webhooks/notifications-fcm.routes.ts
  - server/src/routes/webhooks/notifications-resend.routes.ts
  - server/src/routes/webhooks/notifications-msg91.routes.ts
  - server/src/routes/admin/notifications-broadcast.ts
  - server/prisma/schema.prisma
agents_invoked:
  - scope-writer (output: docs/SCOPE_notifications_engine.md)
  - architect (output: docs/ARCHITECTURE_notifications_engine.md)
  - security (output: docs/SECURITY_AUDIT_notifications_engine.md)
  - task-manager (output: docs/TASKS_notifications_engine.md)        # PENDING
acceptance:
  backend:
    - tsc --noEmit clean across all new files
    - curl GET /api/notifications (auth) → 200 with cursor + unreadCount
    - curl GET /api/notifications (no auth) → 401
    - curl PUT /api/notifications/preferences (bad body) → 400
    - curl POST /api/admin/notifications/broadcast (user token) → 403
    - curl POST /api/webhooks/notifications/msg91 (no HMAC) → 401
    - curl POST /api/webhooks/notifications/msg91 (valid HMAC) → 200
    - Quiet hours test: 23:00 IST enqueue → scheduledAt = next 07:00 IST
    - Rate cap test: 11th external notif/day → DEAD with RATE_CAP_EXCEEDED
    - Cost cap test: monthly tally exceeds plan cap → DEAD with COST_CAP_EXCEEDED, in-app still fires
    - WhatsApp provider stub throws NOT_REGISTERED on send()
  frontend:
    - screenshots: inbox loading, error, empty, success at 320px + 375px
    - screenshots: preferences loading, error, success at 320px + 375px
    - screenshots: bell badge 0, 1-9, 9+ states
    - 320px: no horizontal overflow, title 2-line truncate, body 1-line truncate
---

# Architecture — Notifications Engine

> Companion to `SCOPE_notifications_engine.md`. This document is the contract
> the Backend / Frontend / QA agents will build against.
> Locks: PUSH+EMAIL+SMS+IN_APP for MVP. WhatsApp deferred (stub only).
> Queue: DB-backed via existing `cron-scheduler.ts`. No Redis.
> Cost caps: Rs 500 / Rs 2,000 / Rs 10,000 per business per month.
> Retention: 90d Notification, 30d NotificationJob.
> Templates: static code, EN + HI.

---

## 1. Module Map (6-layer feature split)

Every file below is ≤ 250 LOC. Files marked (NEW) are created by this epic;
(EXTEND) means an existing file gains additions.

### Layer 1 — Domain types & event catalog (server)

| File | LOC budget | Purpose |
|---|---|---|
| `server/src/features/notifications/notification-events.ts` (NEW) | 120 | EventKey union, 18-event metadata map, default channel selection, default priority |
| `server/src/features/notifications/notification-types.ts` (NEW) | 80 | `DispatchResult`, `RenderedTemplate`, `NotificationContext`, `BroadcastReq`, channel/locale enums |
| `server/src/features/notifications/notification-errors.ts` (NEW) | 60 | Typed error codes: `NOT_REGISTERED`, `INVALID_RECIPIENT`, `RATE_CAP_EXCEEDED`, `COST_CAP_EXCEEDED`, `QUIET_HOURS_DEFERRED`, `OPTED_OUT`, `PROVIDER_DOWN`, `EXPIRED_TOKEN` |

### Layer 2 — Provider abstraction

| File | LOC budget | Purpose |
|---|---|---|
| `server/src/features/notifications/providers/notification-provider.ts` (NEW) | 50 | `NotificationProvider` interface + `ProviderRegistry` resolver |
| `server/src/features/notifications/providers/fcm.provider.ts` (NEW) | 180 | Firebase Admin SDK wrapper. Sends data + notification payload, deep-link via `data.entityType`/`data.entityId` |
| `server/src/features/notifications/providers/resend.provider.ts` (NEW) | 140 | Resend HTTP client; renders HTML email with optional PDF attachment |
| `server/src/features/notifications/providers/msg91.provider.ts` (NEW) | 140 | MSG91 transactional SMS; E.164 validation; DLT template ID per event |
| `server/src/features/notifications/providers/in-app.provider.ts` (NEW) | 80 | DB insert into `Notification`, fires SSE `notification:new` |
| `server/src/features/notifications/providers/whatsapp.provider.ts` (NEW, STUB) | 60 | `send()` throws `NotRegisteredError`. `isConfigured()` returns false. Wired into registry but never called when `WHATSAPP_ENABLED=false` |

### Layer 3 — Services (orchestration)

| File | LOC budget | Purpose |
|---|---|---|
| `server/src/features/notifications/notification-template.service.ts` (NEW) | 220 | Static template map: `event × channel × locale → { title, body, deepLinkUrl, payload }`. Mustache-style placeholder render. Paise → Rs format. |
| `server/src/features/notifications/notification-preference.service.ts` (NEW) | 160 | Read/write `NotificationPreference`. Default-on for unseen rows. Resolves channel set per `(user, event)`. |
| `server/src/features/notifications/notification-quiet-hours.service.ts` (NEW) | 100 | Reads `ReminderConfig.quietHoursStart/End` (default 22:00–07:00 IST). Returns `scheduledAt` shifted forward when in window. In-app exempt. |
| `server/src/features/notifications/notification-rate-limit.service.ts` (NEW) | 90 | Counts external jobs per user per IST day. Cap 10. Excludes IN_APP. |
| `server/src/features/notifications/notification-cost.service.ts` (NEW) | 140 | Reads + writes `NotificationCostTally`. Plan cap lookup: STARTER Rs 500 / PRO Rs 2,000 / BUSINESS Rs 10,000. Pre-flight check; post-dispatch increment. Emits in-app warning at 80%. |
| `server/src/features/notifications/notification-dispatch.service.ts` (NEW) | 240 | Public entry. Steps: resolve channels → dedupe (60s) → check opt-out → check quiet hours → check rate cap → check cost cap → render templates → enqueue jobs → fire in-app immediately |
| `server/src/features/notifications/notification-queue.service.ts` (NEW) | 220 | DB-backed queue. `enqueue`, `claimBatch(50)` (atomic `UPDATE … RETURNING` with worker id), `markDispatched`, `markDelivered`, `markFailed`, `markDead`. Retry policy: 3 attempts at 30s / 5m / 30m exponential. |
| `server/src/features/notifications/notification.manager.ts` (NEW) | 80 | Public facade `notify(eventKey, ctx)` consumed by feature code (invoices, payments, stock, etc.). Wraps dispatch service in try/catch — never throws to caller. |
| `server/src/features/notifications/notification-cron.ts` (NEW) | 140 | Registers 4 cron entries via `cron-scheduler.ts` extension hook: queue drain (1m), 08:00 IST overdue scan, 09:00 IST subscription scan, 02:00 IST Sunday retention purge, 00:05 IST 1st-of-month tally reset. |

### Layer 4 — Routes (HTTP surface)

| File | LOC budget | Purpose |
|---|---|---|
| `server/src/routes/notifications.ts` (NEW) | 220 | User-facing: GET list (cursor), GET unread-count, POST `:id/read`, POST `read-all`, GET/PUT preferences, GET/PUT settings, GET stream (SSE) |
| `server/src/routes/admin/notifications-broadcast.ts` (NEW, HIGH-RISK) | 140 | `POST /api/admin/notifications/broadcast`, `GET /api/admin/notifications/delivery-stats`. **`requireSuperAdmin`** (NOT `requireAdmin`) on broadcast — Tier-1 admins must not be able to mass-mail customers. |
| `server/src/routes/webhooks/notifications-fcm.routes.ts` (NEW, HIGH-RISK) | 160 | FCM delivery report receiver. Verifies Google service-account-signed JWT in `Authorization: Bearer` header (audience match + cert from `https://www.googleapis.com/oauth2/v1/certs`) |
| `server/src/routes/webhooks/notifications-resend.routes.ts` (NEW, HIGH-RISK) | 140 | Resend webhook. Verifies `Svix-Signature` HMAC-SHA256 with `RESEND_WEBHOOK_SECRET` (Resend uses Svix). Idempotency via `Svix-Id`. |
| `server/src/routes/webhooks/notifications-msg91.routes.ts` (NEW, HIGH-RISK) | 140 | MSG91 webhook. IP allowlist (env `MSG91_WEBHOOK_IPS`) + optional HMAC `X-MSG91-Signature` if MSG91 account has it enabled. |
| `server/src/routes/webhooks/notifications-aisensy.routes.ts` (NEW, STUB) | 60 | Stub: returns 501 NOT_IMPLEMENTED. Wired to router but disabled by `WHATSAPP_ENABLED=false`. |
| `server/src/lib/sse-notifications.ts` (NEW) | 90 | SSE channel `notification:new` keyed by `(businessId, userId)`. Connection map + heartbeat. Falls back to client polling after 3 reconnect failures. |

### Layer 5 — Migration & seed

| File | LOC budget | Purpose |
|---|---|---|
| `server/prisma/schema.prisma` (EXTEND) | +110 | Adds 5 models: `Notification`, `NotificationJob`, `NotificationPreference`, `NotificationCostTally`, `PushToken`. Adds enums `NotificationChannel`, `NotificationJobStatus`, `NotificationDeliveryStatus`. |
| `server/prisma/migrations/<ts>_notifications/migration.sql` (NEW) | ~180 | Additive only. CREATE TABLE × 5. CREATE INDEX × 9. CREATE TYPE × 3. No drops, no NOT NULL backfill on existing tables. |

### Layer 6 — Frontend (client)

| File | LOC budget | Purpose |
|---|---|---|
| `client/src/features/notifications/types.ts` (NEW) | 80 | TS contracts mirror `notification-types.ts` |
| `client/src/features/notifications/notifications.service.ts` (NEW) | 180 | All calls via `api()` from `@/lib/api`. Reads opt in `cacheReads: true`. Mutations carry `entityType: 'notification'`. |
| `client/src/features/notifications/useNotifications.ts` (NEW) | 140 | TanStack Query hook: list (infinite), unread-count, read, read-all. Optimistic update. |
| `client/src/features/notifications/useNotificationStream.ts` (NEW) | 120 | EventSource subscribe to `/api/notifications/stream` (auth-cookie). Falls back to 30s polling on 3 reconnect fails. |
| `client/src/features/notifications/NotificationBell.tsx` (NEW) | 110 | Bell icon + badge (`9+` for ≥10). 4 UI states. |
| `client/src/features/notifications/NotificationsPage.tsx` (NEW) | 240 | Inbox list, infinite scroll, mark-read on tap, deep-link by `entityType`. 4 UI states. 320px tested. |
| `client/src/features/notifications/NotificationRow.tsx` (NEW) | 110 | Single row: icon dot, 2-line title, 1-line body, relative time. |
| `client/src/features/notifications/NotificationPreferencesPage.tsx` (NEW) | 240 | Event × channel toggle grid. Disabled cells with tooltip when channel unavailable (e.g., no FCM token). 4 UI states. |
| `client/src/features/notifications/NotificationQuietHoursCard.tsx` (NEW) | 130 | Quiet-hours start/end pickers. Reads/writes via settings endpoint. |
| `client/src/i18n/locales/en/notifications.json` (NEW) | 80 | EN keys |
| `client/src/i18n/locales/hi/notifications.json` (NEW) | 80 | HI keys |

**Total new files**: 31 server + 11 client + 2 i18n = 44 files. None > 250 LOC.

---

## 2. Provider Abstraction

### 2.1 Interface

```ts
// server/src/features/notifications/providers/notification-provider.ts
import type { NotificationJob } from '@prisma/client'

export type ChannelType = 'PUSH' | 'EMAIL' | 'SMS' | 'IN_APP' | 'WHATSAPP'

export interface DispatchResult {
  success: boolean
  externalId?: string
  costPaise: number
  errorCode?: string
  errorMessage?: string
  retryable: boolean
}

export interface NotificationProvider {
  readonly name: ChannelType
  isConfigured(): boolean
  estimateCostPaise(job: NotificationJob): number
  send(job: NotificationJob): Promise<DispatchResult>
}

export interface ProviderRegistry {
  get(channel: ChannelType): NotificationProvider
  isEnabled(channel: ChannelType): boolean
}
```

### 2.2 Per-provider files (one per channel, no exceptions)

| File | Channel | External lib | Cost (paise) | Webhook |
|---|---|---|---|---|
| `fcm.provider.ts` | PUSH | `firebase-admin` | 0 | yes (Google JWT) |
| `resend.provider.ts` | EMAIL | `resend` SDK | 0 (free 3K/mo) | yes (Svix HMAC) |
| `msg91.provider.ts` | SMS | `axios` to MSG91 v5 | 15 (Rs 0.15) | yes (IP + HMAC) |
| `in-app.provider.ts` | IN_APP | none (Prisma + SSE) | 0 | n/a |
| `whatsapp.provider.ts` | WHATSAPP | none (STUB) | 25 (Rs 0.25) — used by cost estimator | stub route |

### 2.3 WhatsApp stub contract

```ts
// server/src/features/notifications/providers/whatsapp.provider.ts
import { NotRegisteredError } from '../notification-errors.js'
export class WhatsAppProvider implements NotificationProvider {
  readonly name = 'WHATSAPP' as const
  isConfigured(): boolean { return false }
  estimateCostPaise(): number { return 25 }
  async send(): Promise<DispatchResult> {
    throw new NotRegisteredError(
      'WhatsApp templates not registered with Aisensy. ' +
      'Set WHATSAPP_ENABLED=true and register templates before invoking.'
    )
  }
}
```

Dispatch service guards by `registry.isEnabled('WHATSAPP')` before queueing — stub
never reached during normal flow. Enabling later: register Aisensy templates, set
`WHATSAPP_ENABLED=true`, swap class body. No interface change. No call-site refactor.

---

## 3. Schema (Prisma)

PushToken (NEW — no existing table). UserDevice does not exist. WebAuthn credentials
table is unrelated and must not be reused.

### 3.1 PII separation in `NotificationJob` (P0-6)

`NotificationJob.payload` MUST NOT carry raw recipient PII. The schema below
enforces this with explicit columns:

- `recipientChannel` — duplicates `channel` for clarity at the recipient layer.
- `pushTokenId` — FK to `PushToken` for PUSH jobs; provider re-reads token at send-time.
- `recipientHash` — sha256 of recipient identifier (phone E.164 / email-normalised /
  pushTokenId). Used for dedupe + log correlation. Raw recipient never persisted.
- `payload` — keeps **only the rendered template content**: `title`, `body`,
  `deepLinkUrl`, and template vars that have already been substituted. NO raw
  phone, NO raw email, NO raw FCM token.

Provider send-path resolves the actual recipient at dispatch time:
- PUSH: `pushTokenId` → SELECT token from PushToken → call FCM.
- EMAIL: lookup `User.email` by `userId`.
- SMS: lookup `User.phone` (or `Party.phone` for outbound recipient) by `userId` + ctx.

This keeps DB backups and any debug dump free of raw recipient PII.

```prisma
enum NotificationChannel {
  PUSH
  EMAIL
  SMS
  IN_APP
  WHATSAPP
}

enum NotificationJobStatus {
  QUEUED
  PROCESSING
  DISPATCHED
  DELIVERED
  FAILED
  DEAD
}

enum NotificationDeliveryStatus {
  UNKNOWN
  DELIVERED
  BOUNCED
  REJECTED
  EXPIRED
}

model Notification {
  id         String   @id @default(cuid())
  businessId String
  userId     String

  eventKey   String   @db.VarChar(60)
  titleEn    String   @db.VarChar(160)
  titleHi    String   @db.VarChar(160)
  bodyEn     String   @db.Text
  bodyHi     String   @db.Text

  isRead     Boolean  @default(false)
  readAt     DateTime?

  entityType String?  @db.VarChar(40)
  entityId   String?
  deepLinkUrl String? @db.VarChar(255)

  createdAt  DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([businessId, userId, isRead, createdAt(sort: Desc)])
  @@index([businessId, userId, createdAt(sort: Desc)])
  @@index([createdAt])  // retention purge
}

model NotificationJob {
  id         String                @id @default(cuid())
  businessId String
  userId     String

  eventKey   String                @db.VarChar(60)
  channel    NotificationChannel
  status     NotificationJobStatus @default(QUEUED)
  deliveryStatus NotificationDeliveryStatus @default(UNKNOWN)

  // Idempotency: provider retries use this; equals job.id
  idempotencyKey String             @unique @db.VarChar(40)

  // P0-6 PII separation — see §3.1
  recipientChannel NotificationChannel
  pushTokenId      String?           // FK to PushToken (PUSH only)
  recipientHash    String  @db.VarChar(64)   // sha256 of recipient identifier; never raw

  payload    Json                  // RENDERED ONLY: { title, body, deepLinkUrl, vars }
                                   // NO raw phone, email, or FCM token
  externalId String?               @db.VarChar(120)  // provider message id

  scheduledAt   DateTime           @default(now())
  claimedAt     DateTime?
  claimedBy     String?            @db.VarChar(80)   // worker id
  processedAt   DateTime?
  deliveredAt   DateTime?
  failedAt      DateTime?
  failureCode   String?            @db.VarChar(60)
  failureReason String?            @db.VarChar(500)
  retryCount    Int                @default(0)

  costPaise     Int                @default(0)

  createdAt     DateTime           @default(now())

  business  Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  pushToken PushToken? @relation(fields: [pushTokenId], references: [id], onDelete: SetNull)

  @@index([status, scheduledAt])              // queue drain
  @@index([businessId, status, createdAt])    // admin stats
  @@index([externalId])                       // webhook lookup
  @@index([userId, createdAt])                // rate-limit count
  @@index([recipientHash, createdAt])         // dedupe lookup
  @@index([createdAt])                        // retention
}

model NotificationPreference {
  id         String              @id @default(cuid())
  businessId String
  userId     String
  eventKey   String              @db.VarChar(60)
  channel    NotificationChannel
  enabled    Boolean             @default(true)

  updatedAt  DateTime            @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([businessId, userId, eventKey, channel])
  @@index([businessId, userId])
}

model NotificationCostTally {
  id         String              @id @default(cuid())
  businessId String
  month      String              @db.VarChar(7)   // "2026-05" IST
  channel    NotificationChannel
  totalPaise Int                 @default(0)
  sentCount  Int                 @default(0)
  updatedAt  DateTime            @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@unique([businessId, month, channel])
  @@index([businessId, month])
}

model PushToken {
  id         String   @id @default(cuid())
  businessId String
  userId     String
  token      String   @db.VarChar(255)
  platform   String   @db.VarChar(20)   // 'android' | 'ios' | 'web'
  appVersion String?  @db.VarChar(40)
  lastSeenAt DateTime @default(now())
  isValid    Boolean  @default(true)
  createdAt  DateTime @default(now())

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  notificationJobs NotificationJob[]

  @@unique([userId, token])
  @@index([businessId, userId, isValid])
}
```

Migration is **additive only**: 5 CREATE TABLE, 3 CREATE TYPE, 9 CREATE INDEX,
0 ALTER COLUMN on existing tables. `ReminderConfig`, `ReminderLog`,
`CollectionCadence` untouched.

---

## 4. Event Catalog (typed)

```ts
// server/src/features/notifications/notification-events.ts
export const EVENT_KEYS = [
  'INVOICE_CREATED',
  'INVOICE_SHARED',
  'PAYMENT_RECEIVED',
  'PAYMENT_OVERDUE',
  'PAYMENT_REMINDER',
  'PAYMENT_LINK_OPENED',
  'PAYMENT_LINK_PAID',
  'EXPENSE_RECORDED',
  'RECURRING_INVOICE_GENERATED',
  'RECURRING_EXPENSE_PENDING',
  'LOW_STOCK_ALERT',
  'BATCH_EXPIRY_ALERT',
  'STOCK_OUT',
  'PTP_DUE_TODAY',
  'PTP_BROKEN',
  'SUBSCRIPTION_EXPIRING_SOON',
  'SUBSCRIPTION_EXPIRED',
  'ADMIN_BROADCAST',
] as const
export type EventKey = (typeof EVENT_KEYS)[number]

export interface EventMeta {
  defaultChannels: ChannelType[]   // MVP excludes WHATSAPP
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  templateName: string             // template lookup key
  requiresEntity: boolean          // entityType + entityId mandatory in ctx
}
```

### 4.1 Event → Channel matrix (MVP — WhatsApp deferred)

| Event | MVP channels | Template names |
|---|---|---|
| INVOICE_CREATED | IN_APP | `invoice.created` |
| INVOICE_SHARED | EMAIL, IN_APP | `invoice.shared.email`, `invoice.shared.in_app` |
| PAYMENT_RECEIVED | PUSH, IN_APP | `payment.received` |
| PAYMENT_OVERDUE | SMS, IN_APP | `payment.overdue.sms`, `payment.overdue.in_app` |
| PAYMENT_REMINDER | SMS, IN_APP | `payment.reminder.sms`, `payment.reminder.in_app` |
| PAYMENT_LINK_OPENED | IN_APP | `payment.link.opened` |
| PAYMENT_LINK_PAID | PUSH, IN_APP | `payment.link.paid` |
| EXPENSE_RECORDED | IN_APP | `expense.recorded` |
| RECURRING_INVOICE_GENERATED | IN_APP | `recurring.invoice` |
| RECURRING_EXPENSE_PENDING | PUSH, IN_APP | `recurring.expense` |
| LOW_STOCK_ALERT | PUSH, IN_APP | `stock.low` |
| BATCH_EXPIRY_ALERT | PUSH, IN_APP | `stock.batch_expiry` |
| STOCK_OUT | PUSH, IN_APP | `stock.out` |
| PTP_DUE_TODAY | SMS, IN_APP | `ptp.due_today` |
| PTP_BROKEN | IN_APP | `ptp.broken` |
| SUBSCRIPTION_EXPIRING_SOON | PUSH, EMAIL, IN_APP | `subscription.expiring` |
| SUBSCRIPTION_EXPIRED | PUSH, EMAIL, IN_APP | `subscription.expired` |
| ADMIN_BROADCAST | PUSH, EMAIL, IN_APP | `admin.broadcast` |

WhatsApp left in `wantedChannels` array but filtered out by
`registry.isEnabled('WHATSAPP') === false`. When enabled, no migration needed.

### 4.2 Seed plan

All 18 events seed at code-load (static map). No DB rows for events.
`NotificationPreference` is lazily created on first opt-out (default-on
fallback when row absent).

---

## 5. Templates

### 5.1 Resolver signature

```ts
// notification-template.service.ts
export function renderTemplate(args: {
  eventKey: EventKey
  channel: ChannelType
  locale: 'en' | 'hi'
  context: Record<string, string | number>
}): RenderedTemplate

export interface RenderedTemplate {
  title: string             // ≤ 160 chars
  body: string              // ≤ 1000 chars (SMS truncated to 160 separately)
  deepLinkUrl?: string
  payload: {                // channel-specific extras
    fcmData?: Record<string, string>
    emailHtml?: string
    smsDltTemplateId?: string
  }
}
```

### 5.2 Static template map shape

```ts
const TEMPLATES: Record<string, Record<'en' | 'hi', RawTemplate>> = {
  'payment.overdue.sms': {
    en: { title: 'Payment overdue', body: 'Hi {{partyName}}, payment of Rs {{amount}} for {{invoiceNo}} from {{businessName}} is overdue.' },
    hi: { title: 'भुगतान बकाया', body: 'नमस्ते {{partyName}}, {{businessName}} का चालान {{invoiceNo}} (रु {{amount}}) बकाया है।' },
  },
  // ... 17 more
}
```

Placeholder render uses simple `{{key}}` regex; HTML-escapes for EMAIL channel only.
Amounts are passed pre-formatted (paise-to-rupee done by caller). No `eval`,
no template injection surface.

### 5.3 Locale source

`user.preferredLocale` (existing column) → fallback to `'en'`.

---

## 6. Queue + Dispatcher

### 6.1 Enqueue path

```
notification.manager.notify(eventKey, ctx)
  ├─ dispatch.resolveChannels(user, eventKey)             // event defaults ∩ user prefs ∩ enabled-providers
  ├─ dispatch.dedupe(userId, eventKey, channel, 60s)      // skip if matching QUEUED/PROCESSING exists
  ├─ in-app.provider.send() FIRST (synchronous, fire SSE) // never blocked by quiet hours
  ├─ for each external channel:
  │    ├─ rateLimit.check(userId)                          // 10/day cap
  │    ├─ cost.check(businessId, channel)                  // monthly cap
  │    ├─ quietHours.computeScheduledAt()                  // shift if 22:00-07:00 IST
  │    ├─ template.render()                                // produces { title, body, deepLinkUrl, vars }
  │    ├─ recipient.resolve(userId, channel)               // returns { recipientHash, pushTokenId? }
  │    │                                                   // — raw recipient NOT included in payload
  │    └─ queue.enqueue({
  │         idempotencyKey: cuid(),
  │         scheduledAt,
  │         recipientChannel: channel,
  │         pushTokenId,                  // PUSH only
  │         recipientHash,                // sha256 of phone/email/tokenId
  │         payload: { title, body, deepLinkUrl, vars }   // rendered ONLY
  │       })
  └─ catch all errors → log + return; never throws to caller
```

Dispatcher contract (P0-6):
- `payload` fed to `queue.enqueue` MUST contain only rendered template fields.
- Raw phone / email / token MUST NOT be passed. The provider's `send()` re-resolves
  the recipient via `pushTokenId` (PUSH) or `userId` lookup (EMAIL/SMS) at send-time.
- `recipientHash = sha256(normalize(recipient))` used for 60s dedupe and log
  correlation only — never reversed.

### 6.2 Drain (claim batch)

```sql
-- queue.claimBatch(workerId, 50)
UPDATE "NotificationJob" SET status = 'PROCESSING', claimedAt = now(), claimedBy = $1
WHERE id IN (
  SELECT id FROM "NotificationJob"
  WHERE status = 'QUEUED' AND scheduledAt <= now()
  ORDER BY scheduledAt ASC
  LIMIT 50
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`SKIP LOCKED` is critical — multiple instances of the cron tick won't double-claim.

### 6.3 Retry policy

| Attempt | Backoff | Outcome |
|---|---|---|
| 1 | immediate (next drain tick) | FAILED → reschedule +30s |
| 2 | +30s | FAILED → reschedule +5m |
| 3 | +5m | FAILED → reschedule +30m |
| 4+ | n/a | DEAD with last failureCode |

Non-retryable error codes (`INVALID_RECIPIENT`, `EXPIRED_TOKEN`, `OPTED_OUT`,
`COST_CAP_EXCEEDED`, `RATE_CAP_EXCEEDED`) bypass retry and go straight to DEAD.

### 6.4 Quiet-hours scheduling

If `now` ∈ `[quietHoursStart, quietHoursEnd]` (IST, with wrap), set
`scheduledAt = nextOccurrence(quietHoursEnd)`. In-app fires immediately
regardless. Stored as IST-derived UTC timestamp.

---

## 7. Cost Gating

### 7.1 Pre-flight

```ts
// notification-cost.service.ts
async function checkAndReserve(
  businessId: string, channel: ChannelType, estPaise: number,
): Promise<{ allowed: boolean; remainingPaise: number; warn80pct: boolean }>
```

Reads `NotificationCostTally` for `(businessId, currentMonthIST, channel)`.
Compares `totalPaise + estPaise` against plan cap (resolved from
`Business.subscriptionTier`). Hard cap → returns `allowed: false` and
dispatch marks job DEAD with `COST_CAP_EXCEEDED`. In-app still fires.

### 7.2 Post-dispatch increment

```ts
async function recordSpend(
  businessId: string, channel: ChannelType, costPaise: number,
): Promise<void>   // upsert on (businessId, month, channel)
```

Atomic via Prisma `upsert` + `increment`. Idempotent because tied to
`NotificationJob.id` (one increment per job, guarded by status transition
QUEUED → DISPATCHED).

### 7.3 80% warning

After increment, if `totalPaise / cap >= 0.80` and a warning hasn't fired
this month (check `NotificationCostTally.sentCount` flag column or
look-up of an existing `NOTIFICATION_BUDGET_WARNING` Notification row in
current month), enqueue an in-app notification to business owner.

### 7.4 Monthly reset

Cron `5 0 1 * *` IST: no-op for existing rows (new month means new key).
Optional: prune tallies > 6 months for compactness.

---

## 8. Webhook Routes (HIGH-RISK — security review required)

### 8.0 Mandatory order of operations (P0-4)

**HMAC verification operates on the RAW request body (Buffer), BEFORE any JSON
parsing.** Express middleware order: `express.raw({ type: 'application/json',
limit: '64kb' })` mounted on each webhook route, NOT global `express.json()`.
After verification passes, then `JSON.parse(rawBody.toString('utf8'))` for
the handler.

Required sequence inside every webhook route file (top-of-file comment must
state this so reviewers can verify in the first 40 lines):

1. `express.raw({ type: 'application/json', limit: '64kb' })` (route-level only).
2. Read `req.body` as `Buffer`. Verify HMAC / JWT signature against this raw
   buffer using `crypto.timingSafeEqual`.
3. Verify timestamp window (≤ 5 min for Resend; ≤ 5 min for MSG91 / Aisensy).
4. Only after both checks pass: `JSON.parse(req.body.toString('utf8'))` inside
   try/catch.
5. Run Zod schema on the parsed body.
6. Look up `NotificationJob` by `externalId` — never trust client to set
   `businessId`.

### 8.1 FCM delivery report — `POST /api/webhooks/notifications/fcm`

FCM doesn't push delivery webhooks for individual messages; this endpoint
receives **Pub/Sub-pushed BigQuery delivery export** events when
`messaging/dataMessageDeliveryReport` is enabled, OR error reports from
the FCM HTTP v1 API surfaced through Cloud Functions push.

- Header: `Authorization: Bearer <google-signed JWT>`.
- Verification:
  1. Decode JWT, check `iss == 'https://accounts.google.com'`.
  2. Check `aud == process.env.FCM_WEBHOOK_AUDIENCE` (our own URL).
  3. Verify signature with cached Google certs from
     `https://www.googleapis.com/oauth2/v1/certs` (TTL respected).
  4. Check `email` claim matches `process.env.FCM_PUSH_SA_EMAIL`.
- On valid: lookup `NotificationJob` by `externalId = message.message_id`,
  update `deliveryStatus`, set `deliveredAt`. Return 200.
- Invalid JWT / signature failure: see §8.5 — return 401, no echo.

For invalid-token errors at send time (`messaging/registration-token-not-registered`),
`fcm.provider.ts` flips `PushToken.isValid = false` synchronously — no webhook needed.

### 8.2 Resend webhook — `POST /api/webhooks/notifications/resend`

- Header: `Svix-Id`, `Svix-Timestamp`, `Svix-Signature` (Resend uses Svix).
- Verification: `signature == HMAC_SHA256(RESEND_WEBHOOK_SECRET, ${svix_id}.${svix_timestamp}.${rawBody})`.
  Compare with `crypto.timingSafeEqual` against the **raw Buffer** body
  (per §8.0). Reject if `|now - svix_timestamp| > 5min`.
- Env contract: `RESEND_WEBHOOK_SECRET` is the canonical name (no `SVIX_SECRET`
  alias). `lib/env.ts` MUST require it at boot when
  `NOTIFICATIONS_ENGINE_ENABLED=true`. Missing → boot-fail.
- Idempotency: dedupe on `Svix-Id` (insert into a small `WebhookReceipt` row or
  cache for 24h).
- Events handled: `email.delivered`, `email.bounced`, `email.complained`,
  `email.opened` (ignored). Update `NotificationJob.deliveryStatus`.

### 8.3 MSG91 webhook — `POST /api/webhooks/notifications/msg91`

- IP allowlist: `req.ip` ∈ `process.env.MSG91_WEBHOOK_IPS.split(',')`.
- Optional HMAC: if `MSG91_WEBHOOK_SECRET` set, verify
  `X-MSG91-Signature` as HMAC-SHA256 of raw body (per §8.0).
- Body schema: `{ requestId, status: 'DLVRD' | 'FAILED' | 'NDNV', mobile, ... }`.
- Lookup `NotificationJob` by `externalId == requestId`. Update.

### 8.4 Aisensy stub — `POST /api/webhooks/notifications/aisensy`

- Returns 501 `NOT_IMPLEMENTED` if `WHATSAPP_ENABLED !== 'true'`.
- When enabled later (Phase 2): verify `X-Aisensy-Signature` HMAC.

### 8.5 Common webhook hardening

- `express.raw({ type: 'application/json', limit: '64kb' })` mounted ONLY on
  these routes (HMAC needs raw body).
- Rate limit: 600 req/min per IP via `express-rate-limit`.
- Never echo provider payload into response body.
- **Failure-mode response codes (P0-5)** — explicit, NOT "always 200":

  | Failure | Status | Body |
  |---|---|---|
  | HMAC / JWT signature failure | **401** | `{ error: 'invalid_signature' }` |
  | Stale timestamp (window > 5 min) | **401** | `{ error: 'stale_timestamp' }` |
  | Body parse / Zod failure (after sig OK) | **400** | `{ error: 'invalid_body' }` |
  | Idempotency replay (Svix-Id / requestId already seen) | **200** | `{ status: 'duplicate' }` |
  | Internal handler error (after sig OK) | **500** | `{ error: 'internal' }` (provider retries) |
  | Successful processing | **200** | `{ status: 'ok' }` |

  - Signature-failure response body MUST be `{ error: 'invalid_signature' }`
    only — no expected/received signature, no stack trace, no env values, no
    DB error messages, no payload echo.
  - Log every signature failure to the security audit channel with truncated
    provider name + ISO timestamp only (no raw body, no headers).

### 8.6 Admin broadcast body validation (P0-1)

`POST /api/admin/notifications/broadcast` body MUST be validated with a Zod
schema using `.strict()` (no `.passthrough()`):

```ts
import { z } from 'zod'

const BROADCAST_TIERS = ['free', 'pro', 'business'] as const
// Tier-coercion guard: targetTier MUST be exactly one of the string literals
// above. Any other string (including 'ALL', 'all', 'starter', empty string,
// numbers, arrays) → schema reject → 400 invalid_body. Server resolves the
// user list itself based on this tier; no userIds[] accepted from client.

export const BroadcastBodySchema = z.object({
  eventKey:    z.literal('ADMIN_BROADCAST'),
  targetTier:  z.enum(BROADCAST_TIERS),         // strict tier guard
  titleEn:     z.string().min(1).max(160),
  titleHi:     z.string().min(1).max(160),
  bodyEn:      z.string().min(1).max(1000),
  bodyHi:      z.string().min(1).max(1000),
  deepLinkUrl: z
    .string()
    .url()
    .max(255)
    .refine((u) => {
      const parsed = new URL(u)
      return parsed.protocol === 'https:'           // no javascript:, no data:
    }, 'must be https')
    .optional(),
}).strict()
```

Hard rules:
- `.strict()` rejects unknown keys (no `userIds[]`, no `channels[]`, no `WHATSAPP`).
- `targetTier` ∈ `{free, pro, business}` only — no `ALL`, no wildcard.
- Server resolves the user list itself from `Business.subscriptionTier`.
- Char limits match VARCHAR storage to prevent DB-truncation surprises.
- `deepLinkUrl` https-only; `javascript:` / `data:` / off-domain rejected by URL parser.

Route guard: `requireSuperAdmin` (NOT `requireAdmin`) — see §1/L4 and §9.

---

## 9. Multi-Tenant Isolation

| Surface | Isolation strategy |
|---|---|
| User-facing routes | `requireAuth` populates `req.user.businessId`; every Prisma query adds `where: { businessId }` |
| SSE stream | Connection keyed by `(businessId, userId)`; broadcast filtered server-side |
| Webhook routes | Look up `NotificationJob` by `externalId` first, then derive `businessId` from job; never trust client input |
| Admin broadcast | **`requireSuperAdmin`** ONLY (NOT `requireAdmin`) — Tier-1 admins must not be able to mass-mail customers. Body validated by Zod `.strict()` schema (see §8.6); tier coercion guard locks `targetTier` to `free \| pro \| business`. Single endpoint that creates jobs scoped to each target user's businessId. |
| Cron scans | Iterate businesses, scope each Prisma query by `businessId` |
| Templates | Static — no per-tenant data persisted |
| `NotificationJob.payload` | Rendered template content only (title, body, deepLinkUrl, substituted vars). NO raw recipient PII (phone, email, FCM token). Recipient resolved at send-time from `pushTokenId` or `userId`. See §3.1 / §6.1. |

Admin broadcast isolation: route under `/api/admin/notifications/broadcast`,
guarded by `requireSuperAdmin`. Body specifies plan-tier targeting (`free | pro |
business`). Server paginates User × Business and creates jobs per
`(userId, businessId)`. Admin never reads user data — only writes broadcast
jobs. Audit log via existing `admin-audit.service`.

---

## 10. SSE for Inbox Bell

### 10.1 Path

`GET /api/notifications/stream` (auth cookie). Returns
`Content-Type: text/event-stream`, `Connection: keep-alive`.

### 10.2 Server

`server/src/lib/sse-notifications.ts` keeps a `Map<businessId:userId, Response[]>`.
On `in-app.provider.send()`:

```ts
sseRegistry.broadcast(businessId, userId, {
  type: 'notification:new',
  unreadCount,        // pre-computed
  // NO message content — bell badge only
})
```

Heartbeat: `:keepalive\n\n` every 25s. Connection limit: 3 per user (LRU evict).

### 10.3 Hardening (P0-7)

EventSource cannot set custom headers, so the standard CSRF-token header guard
is bypassed. The stream endpoint MUST defend itself with origin validation
and a per-IP cap:

1. **Origin allowlist (primary)** — validate `Origin` header on the stream
   request. Must equal `process.env.APP_ORIGIN` (e.g. `https://hisaabpro.in`).
   In dev, allow values in the comma-separated `APP_ORIGIN_DEV_ALLOWLIST` (e.g.
   `http://localhost:5173`). Capacitor mobile sends `Origin: capacitor://localhost`
   — explicitly allowed. Reject (403 `forbidden_origin`) otherwise.
2. **Referer allowlist (backup)** — when `Origin` is absent (some legacy
   clients), check `Referer` against the same allowlist. If neither `Origin`
   nor `Referer` matches, reject with 403.
3. **Per-IP connection cap** — 5 concurrent SSE streams per source IP. Beyond
   that, return **429** `{ error: 'too_many_streams' }` with `Retry-After: 60`.
   Per-user cap of 3 (LRU evict) still applies on top.
4. **Cookie posture** — `SameSite=Lax` minimum on the auth cookie (already the
   platform default; verified by integration test).

If **neither Origin nor Referer matches** the allowlist, the connection is
rejected before any bytes are written.

### 10.4 Client fallback

`useNotificationStream`: on 3 consecutive `EventSource` errors within 60s,
disconnect and switch to `setInterval(refetchUnreadCount, 30_000)`. Recheck
SSE every 5min. Status surfaced as `connectionMode: 'sse' | 'polling'`.

### 10.5 Why not WebSocket

HP backend is Express-only; no socket.io. SSE works on standard HTTP, survives
through Capacitor's WebView, and the load is one-way (server → client).

---

## 11. PushToken Handling

### 11.1 Discovery result

Grepped schema.prisma + codebase: **no existing `PushToken` / `UserDevice` /
`fcmToken` table or column**. WebAuthn credentials table is for passkeys, not
push.

### 11.2 Design (NEW table — see §3 schema)

- Token registered via `POST /api/notifications/push-token` (auth):
  `{ token, platform, appVersion }`.
- Capacitor app registers on app boot (after FCM `getToken()`).
- Cleanup on logout: mark `isValid = false` for that user's tokens on this
  device (matched by token string).
- Cleanup on send failure (`messaging/registration-token-not-registered`):
  flip `isValid = false`. Provider returns `EXPIRED_TOKEN` non-retryable.
- Multi-device: a user can have N valid tokens. Fan-out: send to all valid
  tokens; treat per-token failures independently (one token expired ≠ fail).
- Storage: `token` is opaque; not PII per Google policy but treated as
  sensitive (no logs, never echoed in responses).
- **PII separation (P0-6)**: `NotificationJob` stores only `pushTokenId` (FK).
  The provider re-reads the token at send-time. Raw FCM tokens are NEVER
  embedded in `NotificationJob.payload`. Backups hold no addressable push
  credentials beyond the canonical `PushToken` table.

---

## 12. Frontend

### 12.1 Component tree

```
<AppHeader>
  <NotificationBell />                       // 110 LOC
</AppHeader>

/notifications  (route)
  <NotificationsPage>                        // 240 LOC
    <NotificationRow />  × N                 // 110 LOC
    <ListEmptyState /> | <ListErrorState /> | <ListLoading />
  </NotificationsPage>

/settings/notifications
  <NotificationPreferencesPage>              // 240 LOC
    <NotificationQuietHoursCard />           // 130 LOC
    <PrefToggleGrid />                       // inlined < 80 LOC
  </NotificationPreferencesPage>
```

### 12.2 4 UI states (per screen — mandatory)

| Screen | Loading | Error | Empty | Success |
|---|---|---|---|---|
| Inbox | 5 shimmer rows, bell badge `…` | "Could not load. Tap to retry." + button | Illustration + "You're all caught up!" | Chronological list, unread blue accent |
| Preferences | Shimmer toggle grid | "Could not load. Tap to retry." | n/a (catalog always present) | Toggle grid; disabled cells with tooltip |
| Bell | Bell, no badge | n/a (silent fail to 0) | n/a | Badge with count or `9+` |

### 12.3 Service & cache rules (per OFFLINE_RULES.md)

- All calls via `api()` from `@/lib/api` — no `fetch()`.
- Reads (`/api/notifications`, `/unread-count`) opt in `cacheReads: true`
  — non-PII, lifecycle-bounded.
- Mutations (`mark read`, `read-all`, `update preferences`) carry
  `entityType: 'notification'`, `entityLabel: '<truncated title>'`.
- Optimistic updates: TanStack Query `setQueryData`. Mutation handlers
  tolerate offline `{}` return.

### 12.4 Mobile-first

- 320px primary; bell sits in app header, fixed 44×44 hit area.
- `NotificationsPage` is `max-w-lg mx-auto` on tablet, full-width below.
- Row: icon dot 12px + 2-line `line-clamp-2` title + 1-line `line-clamp-1`
  body + relative time. No horizontal overflow at 320px.
- Capacitor: tap on system-tray push opens app, deep-links via
  `data.entityType` + `data.entityId` resolved by `useDeepLinkRouter`
  (existing).

---

## 13. Failure-Mode Matrix

| Failure | Detection | Action | User-visible |
|---|---|---|---|
| FCM down | `firebase-admin` throws transient | Retry 3x (30s/5m/30m) → DEAD | In-app fired; push silent |
| Resend down | HTTP 5xx | Retry policy | In-app fired |
| MSG91 down | HTTP 5xx / timeout | Retry policy | In-app fired |
| ALL externals down | Per-channel circuit breakers report unhealthy | Fall back to IN_APP only; admin sees "delivery degraded" banner | In-app fired |
| Cost cap hit | `cost.check()` returns `allowed: false` | Mark DEAD `COST_CAP_EXCEEDED` | In-app fired; one warning notif at 80% |
| Rate cap hit | `rateLimit.check()` returns false | Mark DEAD `RATE_CAP_EXCEEDED` | In-app fired |
| User opted out | `pref.enabled === false` | Skip channel at enqueue | Other channels still fire |
| Invalid recipient | E.164/email regex fails in provider | Mark DEAD `INVALID_RECIPIENT` non-retryable | Other channels still fire |
| Expired FCM token | Provider error code | Flip `PushToken.isValid = false`, DEAD `EXPIRED_TOKEN` | Silent; user re-registers on next app open |
| Quiet hours | `quietHours.compute()` returns shifted `scheduledAt` | Job stays QUEUED until 07:00 IST | In-app fired immediately |
| WhatsApp called by mistake | `provider.send()` throws `NotRegisteredError` | Job DEAD, log warning, alert engineer via existing error pipeline | None — channel filtered upstream anyway |
| Webhook HMAC fails | Verification step | **Return 401** `{ error: 'invalid_signature' }`; log to security audit channel (provider+timestamp only); no echo | None |
| SSE Origin/Referer reject | Stream upgrade check | Return 403 `{ error: 'forbidden_origin' }` | None |
| SSE per-IP cap | > 5 concurrent streams from same IP | Return 429 `{ error: 'too_many_streams' }` + `Retry-After: 60` | None |
| SSE connection drop | EventSource error 3x | Client switches to 30s polling | None visible |
| DB write fail at enqueue | Prisma error | `manager.notify` swallows + logs; caller never sees error | Source feature flow continues unaffected |
| Cron tick overlaps | `SKIP LOCKED` row claim | Second tick skips claimed rows | None |

---

## 14. Idempotency

| Layer | Key | Guarantee |
|---|---|---|
| Job enqueue dedupe | `(userId, eventKey, channel)` within 60s | No double-queue from rapid SSE re-emits |
| Provider send | `idempotencyKey = NotificationJob.id` passed as provider header (`X-Idempotency-Key` for MSG91 + Resend; FCM `name` parameter) | Provider retry of same job ID = no double-send |
| Status transitions | `UPDATE … WHERE status IN ('QUEUED','PROCESSING')` guards | Concurrent webhook + retry don't double-mark |
| Cost increment | Tied to status transition `PROCESSING → DISPATCHED`; one increment per job lifetime | No double-charge of tally |
| Webhook receipt | `Svix-Id` (Resend), `requestId` (MSG91) cached 24h | Provider retry = no double status update |
| Admin broadcast | Required `Idempotency-Key` header on POST; cached 24h | Click-twice on Send doesn't double-blast |

---

## 15. Migration Plan (additive)

### 15.1 Sequence

1. **Migration 1**: `CREATE TYPE` × 3 (enums) + `CREATE TABLE` × 5 + `CREATE INDEX` × 9. Zero downtime, zero backfill.
2. **Code deploy**: feature flag `NOTIFICATIONS_ENGINE_ENABLED=false` initially. New code paths inert.
3. **Cron registration**: behind same flag.
4. **Smoke tests staging**: enable flag, fire test events, verify webhooks.
5. **Roll out**: flip flag prod. No data backfill needed.
6. **Stub-removal**: existing `notification.service.ts` (the original 3-function stub) deleted ONLY after all callers migrated to `notification.manager.ts`. Tracked separately by task-manager.

### 15.2 Rollback

Flip flag → false. New code paths inert. Existing reminder/log pipeline
(`ReminderConfig`, `ReminderLog`) untouched throughout — no rollback risk
to existing behaviour. New tables remain (orphan but harmless).

### 15.3 No destructive changes

- No DROP TABLE / DROP COLUMN / ALTER TYPE.
- No data backfill required.
- `ReminderConfig` / `ReminderLog` / `CollectionCadence` unchanged.
- No User model changes (PushToken FK is one-way).

---

## 16. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | DB queue can't keep up at > 500 jobs/tick | LOW | MED | Drain batch tunable to 200; fall back to Bull (interface unchanged) |
| R2 | Quiet-hours math wrong across DST (n/a in IST but devs may copy) | LOW | LOW | Lock to `Asia/Kolkata` everywhere; unit tests on wrap-around |
| R3 | FCM JWT verification depends on Google certs cache | MED | HIGH | TTL respected; on cache miss, refetch synchronously; reject on fetch fail |
| R4 | Resend webhook replay attack | LOW | MED | Svix timestamp window 5min + dedupe by Svix-Id |
| R5 | MSG91 IP allowlist drift | MED | MED | Document quarterly review; HMAC layer when MSG91 enables it |
| R6 | Cost tally race condition | LOW | MED | Atomic upsert+increment; transaction-bound to status change |
| R7 | Admin broadcast hits user with all channels off | LOW | LOW | Broadcast bypasses prefs by design; documented; in-app guaranteed |
| R8 | WhatsApp stub accidentally invoked | LOW | LOW | Registry `isEnabled` filter at dispatch; provider throws hard error |
| R9 | Notification table grows unbounded | MED | LOW | 90-day purge cron; `(createdAt)` index supports fast delete |
| R10 | Cross-tenant SSE leak | LOW | HIGH | Connection key `(businessId, userId)`; payload contains no message body, only count; Origin/Referer guard + per-IP cap (§10.3) |
| R11 | PushToken table accumulates dead tokens | MED | LOW | `isValid=false` on send failure; weekly purge of `isValid=false` rows > 30d old |
| R12 | Webhook DoS | MED | MED | `express-rate-limit` 600/min/IP; SKIP_LOCKED ensures DB not overrun |
| R13 | Migration ordering on multi-pod deploy | LOW | MED | Additive only; new code feature-flagged off until DB applied |

---

## 17. agents_invoked frontmatter for `design-plan-active.md`

The block at the top of this document is the source of truth. After
`security` and `task-manager` produce their artefacts, the
`design-plan-active.md` symlink/copy is updated and `status` flips to
`approved`. Required next steps:

1. **security** (DONE):
   - `**/routes/**/webhooks*` matched (4 webhook files)
   - `**/routes/admin/**` admin broadcast endpoint
   - HMAC + JWT verification design reviewed
   - Output: `docs/SECURITY_AUDIT_notifications_engine.md`

2. **task-manager** must run because:
   - 44 new files, 5 schema models, 4 webhooks
   - Backend → Frontend → QA proof gates required
   - Output: `docs/TASKS_notifications_engine.md`

Until both artefacts exist with mtime ≥ this document's `created`, the
high-risk gate will block edits to:
- `server/prisma/schema.prisma`
- `server/src/routes/webhooks/notifications-*.ts`
- `server/src/routes/admin/notifications-broadcast.ts`

---

## 18. Acceptance Snapshot (mirrors frontmatter)

Backend gate:
- `tsc --noEmit` clean
- All curl probes in §acceptance.backend pass
- Quiet-hours test: 23:00 IST → scheduledAt 07:00 IST next day
- Rate cap test: 11th external/day → DEAD
- Cost cap test: tally exceeds plan → DEAD + in-app warning at 80%
- WhatsApp stub `send()` throws `NOT_REGISTERED`

Frontend gate:
- Screenshots: bell × 3, inbox × 4, preferences × 3 — at 320px AND 375px
- No horizontal overflow at 320px
- Offline: bell badge reads from IDB cache; mutations queue with `entityType`

QA gate (post-merge):
- Real device: FCM push appears, deep-link works
- Resend email delivered with PDF attachment for INVOICE_SHARED
- MSG91 SMS delivered for PAYMENT_OVERDUE
- Webhook HMAC failure path returns 401
- Cross-tenant probe: user A cannot read user B notifications
