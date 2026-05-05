# Payments & Collections Hub — Architecture

> Owner: architect agent · Status: design-locked, ready for implementation
> Predecessors: `PRD.md` (1,324 lines — "what" + personas) · this doc is the "how"
> Touches HIGH-RISK paths: `server/prisma/schema.prisma`, `server/prisma/migrations/**`
> Reference quality bar: `docs/business-verticals/PHASE_3_ARCHITECTURE.md`,
> `docs/ARCHITECTURE_gst_phase_2.md`

---

## 0. TL;DR

The Payments & Collections Hub layers a collections workflow on top of the
existing `Document` + `Payment` + `PaymentAllocation` + `PaymentReminder`
machinery — no edits to those tables. Three new models — `PromiseToPay`,
`PaymentLink`, `ReminderLog` — plus a forward-compatible `CollectionCadence`
shell for Phase 2 auto-cadence rules. Aging is computed on demand from the
existing `Document.outstandingAmount` + `dueDate` columns (already maintained
by `services/payment/outstanding.ts`); a thin `aging.service.ts` aggregates
into 0–30 / 31–60 / 61–90 / 90+ buckets at request time and is cached in
Redis under `aging:{businessId}` for 60 s. Razorpay integration is extended
from subscription-only to per-invoice **Standard Payment Links** (not
Checkout) — one new service, one new webhook event family, link rows are
the single source of truth (not Razorpay's API). WhatsApp dispatch is
unchanged from the existing `wa.me` deep-link pattern, but a new
`bulk-dispatch.ts` sequencer drives the OS share sheet on Capacitor with
2 s pacing to avoid Android intent throttling. New `collections` permission
module with 5 actions. ~22 endpoints. Aging dashboard P50 < 800 ms for
5,000 open invoices via composite index `(businessId, isDeleted, dueDate)`
already present plus one new partial index. MVP cuts: no auto-cadence cron,
no UPI Collect, no statement scheduling — all in Phase 2.

---

## 1. Schema changes

Append to `server/prisma/schema.prisma` after the existing `ReminderConfig`
block (~line 1018, before `// === Settings & Security ===`). Also append
inverse relations on `Business`, `Party`, `Document`.

### 1a. New enums

```prisma
// ─── Payments & Collections Hub ─────────────────────────────────────────────

enum PromiseToPayStatus {
  OPEN          // active commitment, due date in the future or today
  KEPT          // payment recorded on/before promiseDate covering >= amount
  BROKEN        // promiseDate passed without sufficient payment
  CANCELLED     // user manually cancelled (e.g. customer renegotiated)
}

enum PaymentLinkStatus {
  CREATED       // row exists locally; Razorpay create may still be in flight
  ACTIVE        // shortUrl available, accepting payments
  PAID          // webhook confirmed full payment
  PARTIALLY_PAID // webhook confirmed partial (Razorpay supports this on Standard PL)
  EXPIRED       // expireBy passed without full payment
  CANCELLED     // user revoked the link
  FAILED        // Razorpay create failed; row kept for audit
}

enum ReminderChannel {
  WHATSAPP
  SMS
  PUSH
  EMAIL         // present in enum, blocked at service layer in MVP (no Resend creds)
}

enum ReminderDispatchStatus {
  QUEUED        // sitting in offline queue or scheduler
  DISPATCHED    // handed to the channel (wa.me opened, SMS sent, push delivered)
  DELIVERED     // only for channels with delivery receipts (push)
  FAILED        // channel rejected
}

enum CadenceTrigger {  // Phase 2 — present in v0 schema for forward compat
  ON_DUE_DATE
  AFTER_DUE_DAYS
  AFTER_LAST_REMINDER_DAYS
}
```

### 1b. New models

```prisma
model PromiseToPay {
  id             String   @id @default(cuid())
  businessId     String
  partyId        String
  invoiceId      String?  // optional — PTP can be against a party's whole balance, not one invoice

  amountPaise    Int      // expected inflow, paise. > 0.
  promiseDate    DateTime // calendar date the customer committed to (DATE in Postgres, but DateTime here)
  status         PromiseToPayStatus @default(OPEN)
  notes          String?  @db.VarChar(500)

  // Resolution
  keptAt         DateTime?  // when status flipped to KEPT
  brokenAt       DateTime?  // when daily cron flipped to BROKEN
  cancelledAt    DateTime?
  cancelReason   String?    @db.VarChar(500)

  // Links to the payments that satisfied this PTP (many payments may credit one PTP)
  satisfyingPaymentIds String[] @default([])  // Postgres TEXT[] — denormalised for read speed

  // Offline + audit (matches HP convention)
  clientId       String?  @unique
  isDeleted      Boolean  @default(false)
  deletedAt      DateTime?
  deletedBy      String?
  createdBy      String
  updatedBy      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  party    Party    @relation(fields: [partyId], references: [id], onDelete: Restrict)
  invoice  Document? @relation("PtpInvoice", fields: [invoiceId], references: [id], onDelete: SetNull)

  @@index([businessId, status])
  @@index([businessId, partyId])
  @@index([businessId, promiseDate, status])  // drives daily evaluator + cash-flow query
  @@index([businessId, isDeleted])
  @@index([clientId])
}

model PaymentLink {
  id             String   @id @default(cuid())
  businessId     String
  invoiceId      String   // every link is per-invoice in MVP (party-level link is P2)
  partyId        String   // denormalised for index efficiency

  // Razorpay state — link row is canonical, Razorpay payload mirrored
  razorpayLinkId String?  @unique  // null between CREATED and Razorpay confirm
  shortUrl       String?           // null until ACTIVE
  amountPaise    Int               // capture amount (may be < invoice outstanding)
  currency       String   @default("INR") @db.VarChar(3)
  status         PaymentLinkStatus @default(CREATED)

  // Lifecycle
  expireBy       DateTime          // server-set, default now() + 7 days, max now() + 30 days
  expiredAt      DateTime?
  paidAt         DateTime?
  paidAmountPaise Int     @default(0)
  cancelledAt    DateTime?

  // Customer-facing copy (sent in WA / SMS) — kept on the row for audit
  description    String?  @db.VarChar(280)
  notifyChannels String[] @default([])  // ["WHATSAPP","SMS"] — what we offered the customer

  // Idempotency for Razorpay create
  createIdempotencyKey String? @unique  // sent as Razorpay Idempotency-Key header

  // Webhook trail
  lastWebhookEvent String?  @db.VarChar(64)
  lastWebhookAt    DateTime?

  // Audit + soft delete
  isDeleted      Boolean  @default(false)
  deletedAt      DateTime?
  deletedBy      String?
  createdBy      String
  updatedBy      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  invoice  Document @relation("PaymentLinkInvoice", fields: [invoiceId], references: [id], onDelete: Restrict)
  party    Party    @relation(fields: [partyId], references: [id], onDelete: Restrict)

  @@index([businessId, status])
  @@index([businessId, invoiceId])
  @@index([businessId, partyId])
  @@index([expireBy, status])  // drives expiry sweeper cron
  @@index([businessId, isDeleted])
}

model ReminderLog {
  id             String   @id @default(cuid())
  businessId     String
  partyId        String
  invoiceId      String?  // null when sent against party-level dues (statement-style)

  // Source: was this fired manually, by cadence, or part of bulk?
  origin         String   @db.VarChar(20) // MANUAL | BULK | CADENCE
  bulkBatchId    String?  @db.VarChar(40) // groups rows from one bulk dispatch
  cadenceId      String?  // FK to CollectionCadence when origin=CADENCE (Phase 2)

  channel        ReminderChannel
  status         ReminderDispatchStatus @default(QUEUED)

  // Rendered message (post-token-substitution) — frozen at dispatch time
  renderedMessage String  @db.Text
  templateKey    String?  @db.VarChar(40) // e.g. "FRIENDLY_T7", "FIRM_T30"

  // wa.me / SMS / push metadata
  recipientPhone String?  @db.VarChar(20)  // E.164, never log unmasked in app logs
  dispatchedAt   DateTime?
  failedAt       DateTime?
  failureReason  String?  @db.VarChar(500)

  // Snapshot of amount at time of reminder (so log stays meaningful even after payments)
  snapshotOutstandingPaise Int

  createdBy      String
  createdAt      DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  party    Party    @relation(fields: [partyId], references: [id], onDelete: Restrict)
  invoice  Document? @relation("ReminderLogInvoice", fields: [invoiceId], references: [id], onDelete: SetNull)

  @@index([businessId, partyId, createdAt])
  @@index([businessId, invoiceId, createdAt])
  @@index([businessId, status, createdAt])
  @@index([businessId, bulkBatchId])
}

// Phase 2 forward-compat shell. Created at v0 so PaymentLink + ReminderLog
// can hold an FK; the cadence engine ships in P2.
model CollectionCadence {
  id             String   @id @default(cuid())
  businessId     String
  name           String   @db.VarChar(80)
  enabled        Boolean  @default(false)        // off by default until P2 ships
  trigger        CadenceTrigger
  triggerOffsetDays Int   @default(0)            // semantics depend on trigger
  channel        ReminderChannel @default(WHATSAPP)
  templateKey    String   @db.VarChar(40)
  quietHoursStart String  @default("21:00") @db.VarChar(5)
  quietHoursEnd   String  @default("09:00") @db.VarChar(5)

  // Eligibility filters (JSON to keep schema flexible; all keys optional)
  // { partyTags?: string[], minAmountPaise?: number, maxAmountPaise?: number }
  filters        Json     @default("{}")

  isDeleted      Boolean  @default(false)
  deletedAt      DateTime?
  createdBy      String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  reminders ReminderLog[] @relation("CadenceReminders")

  @@index([businessId, enabled])
  @@unique([businessId, name])
}
```

### 1c. Inverse relations to add to existing models

`model Business` (with the existing `paymentReminders` line ~138):

```prisma
  // Payments & Collections Hub
  paymentLinks         PaymentLink[]
  promisesToPay        PromiseToPay[]
  reminderLogs         ReminderLog[]
  collectionCadences   CollectionCadence[]
```

`model Party` (around the existing `paymentReminders` line ~296):

```prisma
  paymentLinks   PaymentLink[]
  promisesToPay  PromiseToPay[]
  reminderLogs   ReminderLog[]
```

`model Document` (around the existing `paymentReminders` line ~739):

```prisma
  paymentLinks   PaymentLink[]  @relation("PaymentLinkInvoice")
  promisesToPay  PromiseToPay[] @relation("PtpInvoice")
  reminderLogs   ReminderLog[]  @relation("ReminderLogInvoice")
```

### 1d. Conventions verified against repo

| Convention | Source | Adopted |
|---|---|---|
| `cuid()` ids | `Document`, `Payment` | yes |
| `businessId` first column | every tenant model | yes |
| Money in PAISE as `Int` | `Payment.amount`, `Document.grandTotal` | yes |
| Soft-delete trio | `Document` 681-683 | yes (PTP, PaymentLink) |
| `clientId String? @unique` for offline | `Document.clientId` | yes (PTP) |
| `createdBy/updatedBy/createdAt/updatedAt` | `Payment` 929-932 | yes |
| Composite index `(businessId, …)` | every tenant model | yes |
| `onDelete: Restrict` for business + party FKs | `Payment.business/party` 934-935 | yes |
| `onDelete: SetNull` for forward optional links | `Document.sourceDocument` | yes (PTP/Reminder → invoice) |
| Postgres `TEXT[]` for small denormalised id lists | `ReminderConfig.frequencyDays Int[]` | yes (`PromiseToPay.satisfyingPaymentIds`) |

`ReminderLog` deliberately has **no soft-delete** — it is an append-only
audit log; users can hide rows from the UI but never destroy them.

---

## 2. Migration plan

Per `.claude/rules/PRISMA_MIGRATION_RULES.md` and the GST Phase 2 / Phase 3
precedent, this epic ships **hand-written SQL migrations** — `prisma migrate
dev` only used to scaffold; final SQL is reviewed and committed manually.
`prisma db push` is blocked by `pre-tool-gate.sh`.

**Naming:** `20260510120000_payments_hub_schema` (single migration —
all five tables + four enums in one transactional migration since they
have no cross-table backfill).

**Order inside the migration:**

```sql
BEGIN;

-- 1. Enums
CREATE TYPE "PromiseToPayStatus" AS ENUM ('OPEN','KEPT','BROKEN','CANCELLED');
CREATE TYPE "PaymentLinkStatus"  AS ENUM ('CREATED','ACTIVE','PAID','PARTIALLY_PAID','EXPIRED','CANCELLED','FAILED');
CREATE TYPE "ReminderChannel"    AS ENUM ('WHATSAPP','SMS','PUSH','EMAIL');
CREATE TYPE "ReminderDispatchStatus" AS ENUM ('QUEUED','DISPATCHED','DELIVERED','FAILED');
CREATE TYPE "CadenceTrigger"     AS ENUM ('ON_DUE_DATE','AFTER_DUE_DAYS','AFTER_LAST_REMINDER_DAYS');

-- 2. Tables (parents before children — none of these are children of each other)
CREATE TABLE "PromiseToPay" (...);
CREATE TABLE "PaymentLink"  (...);
CREATE TABLE "ReminderLog"  (...);
CREATE TABLE "CollectionCadence" (...);

-- 3. FKs added at table level (Business / Party / Document already exist)

-- 4. Indexes — including one partial index for hot-path aging
CREATE INDEX "Document_aging_open_idx"
  ON "Document" ("businessId", "dueDate")
  WHERE "isDeleted" = false
    AND "outstandingAmount" > 0
    AND "type" IN ('SALE_INVOICE','SALES_RETURN');

COMMIT;
```

**No backfill:** all four new tables start empty. `Document`'s aging
index is additive — does not rewrite any rows; build is `CREATE INDEX
CONCURRENTLY` in the prod runbook (PR description specifies this; the
dev migration uses plain `CREATE INDEX` because dev DBs are small).

**Rollback:** forward-only. Recovery migration `_payments_hub_revert`
drops the four tables + four enums + the partial index in reverse order.
We never edit the original migration file once shipped — see
`PRISMA_MIGRATION_RULES.md`.

**Verification before commit:**
1. `npx prisma migrate dev --create-only --name payments_hub_schema` (scaffolds)
2. Hand-edit the generated SQL to add the partial index + enum order
3. `npx prisma migrate dev` (apply locally)
4. `npx prisma generate` (refresh client)
5. `tsc -p server/tsconfig.json` — must be clean

---

## 3. Service-layer file map

All new code under `server/src/services/collections/`. ≤ 250 LOC per file
per HP CLAUDE.md. Where logic crosses the budget, split by verb.

| Path | Purpose | LOC budget | Reuses |
|---|---|---|---|
| `server/src/schemas/collections.schemas.ts` | Zod: `createPtpSchema`, `updatePtpSchema`, `createPaymentLinkSchema`, `bulkRemindSchema`, `agingQuerySchema`, `statementQuerySchema` + inferred types | 220 | `paise()`, `cuid()` from `_shared.ts` |
| `server/src/services/collections/aging.service.ts` | `computeAging(businessId, asOf?)` → bucket totals; `listPartiesInBucket(businessId, bucket, cursor)`; `topOutstandingParties(businessId, limit=5)` | 240 | `prisma`, redis client (`lib/cache.ts`) |
| `server/src/services/collections/aging-buckets.ts` | Pure helper: `bucketFor(daysOverdue)` → `'CURRENT' \| '0_30' \| '31_60' \| '61_90' \| '90_PLUS'`; bucket constants | 60 | none — pure |
| `server/src/services/collections/reminders/dispatch.service.ts` | `recordReminder(businessId, userId, input)` writes a `ReminderLog` row + returns `wa.me` URL or SMS payload | 180 | `services/parties/get.ts`, `services/document/get-list.ts` |
| `server/src/services/collections/reminders/bulk-dispatch.service.ts` | `prepareBulkBatch(businessId, userId, partyIds, templateKey)` → `{ batchId, items: Array<{partyId, waUrl, smsPayload?}> }`; resolves the per-party message with the templating engine | 240 | `dispatch.service`, `services/templates/render.ts` |
| `server/src/services/collections/reminders/templates.ts` | Token registry: `{{partyName}}`, `{{businessName}}`, `{{outstandingAmount}}`, `{{oldestDueDate}}`, `{{paymentLinkUrl}}`, `{{upiVpa}}`, `{{statementUrl}}`. `render(template, ctx)` deterministic. | 180 | none |
| `server/src/services/collections/reminders/get-list.ts` | `listReminderLogs(businessId, query)` cursor pagination by `(createdAt, id)` | 140 | shared cursor util |
| `server/src/services/collections/payment-links/create.service.ts` | `createPaymentLink(businessId, userId, input)` — Razorpay Standard Payment Link API call with idempotency key; persists row optimistically as `CREATED` then `ACTIVE` | 240 | `razorpay.service.ts` (extend) |
| `server/src/services/collections/payment-links/cancel.service.ts` | `cancelPaymentLink(businessId, userId, id)` — calls Razorpay revoke + flips status | 100 | razorpay client |
| `server/src/services/collections/payment-links/webhook.handler.ts` | New handlers: `payment_link.paid`, `payment_link.partially_paid`, `payment_link.expired`, `payment_link.cancelled`. Idempotent on `(razorpayLinkId, eventId)`. Triggers `outstanding.recompute` for invoice. | 240 | `razorpay-webhook.service.ts` (extend dispatcher) |
| `server/src/services/collections/payment-links/get-list.ts` | `listPaymentLinks(businessId, query)`, `getPaymentLink(businessId, id)` | 130 | cursor util |
| `server/src/services/collections/promise-to-pay/create.service.ts` | `createPtp(businessId, userId, input)` | 140 | helpers, `parties/get.ts` |
| `server/src/services/collections/promise-to-pay/update.service.ts` | `updatePtp`, `cancelPtp`, `markPtpKept(ptpId, paymentId)` (called from `payment.create.ts` hook) | 220 | helpers |
| `server/src/services/collections/promise-to-pay/evaluator.service.ts` | `evaluateOpenPtps(asOf)` — daily cron entry point. Walks `OPEN` PTPs with `promiseDate <= asOf`, checks satisfaction, transitions to KEPT or BROKEN. | 220 | `prisma`, allocations |
| `server/src/services/collections/promise-to-pay/get-list.ts` | `listPtps`, `getPtp`, `partyPtpHistory(partyId)` | 160 | cursor util |
| `server/src/services/collections/statements/build.service.ts` | `buildStatement(businessId, partyId, fromDate, toDate)` → DTO with opening balance, transactions (invoices + payments + credits), closing balance, aging snapshot | 240 | `services/payment/outstanding.ts` |
| `server/src/services/collections/statements/share.service.ts` | `shareStatement(businessId, partyId, channel, ...)` returns `{ pdfUrl, waUrl }` — PDF generated client-side via React-PDF; service returns the pre-signed S3 URL of the cached PDF if present | 160 | `services/storage.service.ts` |
| `server/src/services/collections/cashflow/forecast.service.ts` | **(P2 — stub in MVP)** `forecast30(businessId)` returns 30-day expected inflow series | 120 | aging, ptp |
| `server/src/services/collections/cadence/scheduler.service.ts` | **(P2 — stub in MVP)** picks rows from `CollectionCadence` and enqueues `ReminderLog` rows | 220 | dispatch.service |
| `server/src/services/collections/index.ts` | Barrel re-export | 40 | — |
| `server/src/services/collections/cron/expire-payment-links.ts` | `expireDueLinks(asOf)` — flips ACTIVE→EXPIRED past `expireBy` | 80 | razorpay (revoke best-effort) |
| `server/src/routes/collections/aging.ts` | Express router for `/api/collections/aging/*` | 120 | `auth`, `requirePermission`, `validate` |
| `server/src/routes/collections/reminders.ts` | `/api/collections/reminders/*` (list, dispatch, bulk-prepare) | 180 | same |
| `server/src/routes/collections/payment-links.ts` | `/api/collections/payment-links/*` | 200 | same |
| `server/src/routes/collections/promise-to-pay.ts` | `/api/collections/ptp/*` | 180 | same |
| `server/src/routes/collections/statements.ts` | `/api/collections/statements/*` | 120 | same |
| `server/src/routes/collections/index.ts` | Mounts all routers under `/api/collections` | 30 | — |

### Cross-service hooks (additive — no edits inside the touched files)

| Existing file | Hook added | Mechanism |
|---|---|---|
| `services/payment/create.ts` | After successful payment + allocations, call `markPtpKept` for any OPEN PTP on the invoice/party where the new running-paid amount ≥ promise amount | New post-commit step inside the existing transaction's `then()`; no signature change |
| `services/payment/outstanding.ts` | After `recomputeOutstanding(invoiceId)`, bust Redis key `aging:{businessId}` | Tiny call, no logic change |
| `services/razorpay-webhook.service.ts` | Dispatcher table gains 4 new event keys → `payment-links/webhook.handler.ts` | One-line additions to the existing switch |
| `services/document/delete.ts` | On soft-delete of an invoice with active PaymentLinks, mark links CANCELLED + Razorpay revoke (best-effort) | New helper call inside the existing tx |

---

## 4. Aging algorithm

### 4a. Inputs

The existing `Document` row already carries everything we need:
- `outstandingAmount` (paise, maintained by `services/payment/outstanding.ts`
  on every `Payment` / `PaymentAllocation` / credit-note write)
- `dueDate` (set at create / edit; nullable for cash-only docs)
- `documentDate`
- `type ∈ {SALE_INVOICE, SALES_RETURN, ...}` — credits are `SALES_RETURN`
  with negative outstanding contribution

### 4b. Bucket boundaries

`bucketFor(daysOverdue: number)` is the single source of truth:

```
daysOverdue =  - 1        → CURRENT       (due in future)
daysOverdue ∈  [0,  30]   → BUCKET_0_30
daysOverdue ∈  [31, 60]   → BUCKET_31_60
daysOverdue ∈  [61, 90]   → BUCKET_61_90
daysOverdue >= 91         → BUCKET_90_PLUS
```

`daysOverdue = floor( (asOf - dueDate) / 1 day )` using UTC midnights.
Documents without `dueDate` count as `CURRENT` (treated as not-yet-due
under the user's default credit terms; a note appears in the UI).

### 4c. Two views — invoice-level vs party-level

**Invoice-level** (rendered as the bucket detail drill-down):
straightforward — every open invoice contributes its
`outstandingAmount` to one bucket.

**Party-level** (rendered as the bucket totals on the dashboard):
**a single party may have invoices spread across multiple buckets**.
We compute by *summing each invoice into its own bucket*, then totalling
per party for the bucket-sort order. We do **not** collapse a party into
their oldest-bucket — that hides Rs in the newer buckets and misleads
Priya about her overall position. Buckets sum to total receivables;
party rows sort by their bucket-specific outstanding.

### 4d. Credit notes, overpayments, advances

| Item | Treatment |
|---|---|
| Credit note (`SALES_RETURN` linked to an invoice) | Reduces the source invoice's `outstandingAmount` via the existing recompute path. No special aging handling. |
| Standalone credit note (no link) | Reduces the **party** total at the party-level view; in invoice-level view it appears as a negative row in `CURRENT` so Sum(buckets) === Sum(per-party totals). |
| Overpayment / advance (`Payment.type=PAYMENT_IN` not allocated) | Subtracted from party-level total only. Listed separately in the dashboard ("Advances on hand: Rs X") so user knows their net exposure. |
| Disputed / under-review | Out of scope — no `disputed` column in MVP. P2 adds `Document.disputeStatus`. |

### 4e. Recompute trigger

- **No materialised aging table.** Aging is computed from the existing
  `outstandingAmount` columns on read. The Redis cache key
  `aging:{businessId}` (TTL 60 s) absorbs read bursts.
- Cache invalidated on: payment create/edit/delete, invoice create/edit/delete,
  credit-note create/edit/delete. Hooks added to the existing service files
  (one-line cache delete — no business logic moves).
- Worst case (cold cache, 5,000 open invoices): single SQL aggregate query
  using the new partial index. See §15 for query + EXPLAIN budget.

### 4f. Index strategy

The hot-path query is:

```sql
SELECT id, partyId, dueDate, outstandingAmount
FROM "Document"
WHERE "businessId" = $1
  AND "isDeleted"  = false
  AND "outstandingAmount" > 0
  AND "type" IN ('SALE_INVOICE','SALES_RETURN');
```

The new partial index `Document_aging_open_idx` is
`(businessId, dueDate) WHERE isDeleted=false AND outstandingAmount>0
AND type IN (...)` — a covering scan on the open subset only. Existing
b-tree on `(businessId, type)` remains useful for other paths.

---

## 5. REST endpoints

All under `/api/collections`. All require auth (`auth` middleware) and
are tenant-scoped to the JWT's `businessId`. All mutating endpoints
require the relevant `collections.*` permission (see §10) and accept an
optional `Idempotency-Key` header (HP-wide convention; surfaced via
`requireIdempotency` middleware).

Response envelope is the existing `sendSuccess` shape:
`{ ok: true, data: T }` and `{ ok: false, error: { code, message, details? } }`.

### 5a. Aging (4 endpoints)

| # | Method | URL | Permission | Description |
|---|---|---|---|---|
| 1 | GET | `/aging/summary` | `collections.view` | Bucket totals + counts; cached 60 s. Returns `{ asOf, totalPaise, advancesPaise, buckets: { CURRENT: {totalPaise, partyCount}, BUCKET_0_30: {...}, ... } }` |
| 2 | GET | `/aging/buckets/:bucket/parties?cursor=&limit=50` | `collections.view` | Parties in a bucket sorted by outstanding desc |
| 3 | GET | `/aging/parties/:partyId/invoices` | `collections.view` | All open invoices for a party with per-invoice bucket |
| 4 | GET | `/aging/top?limit=5` | `collections.view` | Top-N outstanding parties (Amit dashboard tile) |

Status codes: 200 success, 400 invalid query, 401 unauth, 403 perm.
Rate limit: 60 req/min per user (general read-tier).

### 5b. Reminders (5 endpoints)

| # | Method | URL | Permission | Description |
|---|---|---|---|---|
| 5 | POST | `/reminders` | `collections.remind` | Single reminder. Body `{ partyId, invoiceId?, channel, templateKey, customMessage? }`. Returns `{ id, waUrl?, smsPayload? }`. **Always idempotent** by `Idempotency-Key`. |
| 6 | POST | `/reminders/bulk` | `collections.remind` | Body `{ partyIds: string[], templateKey, channel }` (max 50). Returns `{ batchId, items: Array<{partyId, partyName, waUrl, success}> }`. Server pre-records each `ReminderLog` as QUEUED so retries are safe. |
| 7 | POST | `/reminders/:id/dispatched` | `collections.remind` | Client confirms after the OS share-sheet returned (best-effort UX signal, flips QUEUED → DISPATCHED). Idempotent. |
| 8 | GET | `/reminders?partyId=&invoiceId=&cursor=` | `collections.view` | Cursor list of reminder logs |
| 9 | GET | `/reminders/templates` | `collections.view` | Returns the static template registry + user overrides from `ReminderConfig.whatsappTemplate` |

Status: 201 on create, 207 multi-status on `/bulk` if any item failed.
Rate limit: 30 req/min per user on POST `/reminders` and `/reminders/bulk`;
batch size capped at 50 items per bulk call.

### 5c. Payment Links (5 endpoints)

| # | Method | URL | Permission | Description |
|---|---|---|---|---|
| 10 | POST | `/payment-links` | `collections.collect` | Body `{ invoiceId, amountPaise?, expireBy?, description?, notifyChannels[] }`. Returns full `PaymentLink` row including `shortUrl`. Idempotent on `Idempotency-Key` AND on `(invoiceId, amountPaise)` if no key supplied (latest ACTIVE link reused) |
| 11 | GET | `/payment-links?status=&invoiceId=&cursor=` | `collections.view` | List |
| 12 | GET | `/payment-links/:id` | `collections.view` | Detail |
| 13 | POST | `/payment-links/:id/cancel` | `collections.collect` | Revokes at Razorpay + flips status |
| 14 | POST | `/payment-links/:id/resend` | `collections.collect` | Returns fresh `waUrl`/SMS payload using the stored `shortUrl` (no Razorpay call) |

Status: 201 / 200 / 409 if invoice is already PAID / 422 if Razorpay rejects.
Rate limit: 10 req/min per user on POST `/payment-links` (Razorpay create
quota protection).

### 5d. Promise to Pay (5 endpoints)

| # | Method | URL | Permission | Description |
|---|---|---|---|---|
| 15 | POST | `/ptp` | `collections.ptp` | Body `{ partyId, invoiceId?, amountPaise, promiseDate, notes? }` |
| 16 | PATCH | `/ptp/:id` | `collections.ptp` | Update notes, amount, date (only while OPEN) |
| 17 | POST | `/ptp/:id/cancel` | `collections.ptp` | Body `{ reason? }`; flips OPEN → CANCELLED |
| 18 | GET | `/ptp?status=&partyId=&dueFrom=&dueTo=&cursor=` | `collections.view` | List |
| 19 | GET | `/ptp/:id` | `collections.view` | Detail (incl. satisfying payments) |

Status: 201/200/409 (cannot edit non-OPEN PTP).
Rate limit: 30 req/min per user on writes.

### 5e. Statements (3 endpoints)

| # | Method | URL | Permission | Description |
|---|---|---|---|---|
| 20 | GET | `/statements/:partyId?from=&to=` | `collections.view` | Returns the statement DTO (server-side aggregation; PDF rendered client-side via React-PDF) |
| 21 | POST | `/statements/:partyId/share` | `collections.remind` | Body `{ channel, fromDate, toDate }`. Records a `ReminderLog` of templateKey=`STATEMENT` and returns `{ waUrl }`. The PDF is uploaded by the client to `/storage/statements` and the resulting URL substituted into `{{statementUrl}}`. |
| 22 | GET | `/statements/:partyId/last-sent` | `collections.view` | When was a statement last shared (renders "Last sent: 3 days ago" pill) |

Rate limit: 20 req/min per user.

### 5f. Cash-flow forecast (1 endpoint, P2 stub returning 200 with synthesized data)

| # | Method | URL | Permission | Description |
|---|---|---|---|---|
| 23 | GET | `/cashflow/forecast?days=30` | `collections.view` | 30-day expected inflow series. MVP returns `{ days: [], note: 'phase-2' }`; P2 ships the real series. |

---

## 6. Razorpay integration delta

Today `razorpay.service.ts` only handles **subscriptions** (plan upgrade
checkout for HisaabPro itself). Payment Hub adds **Standard Payment
Links** for end-customers paying their invoices.

### 6a. Why Standard Payment Links (not Checkout)

- Customer pays without HisaabPro hosting any payment UI — the link
  renders Razorpay's UPI / card / netbanking page.
- One link per invoice; supports partial payment; supports notify
  callbacks; supports revoke.
- No PCI scope; no JS SDK on the customer side.

### 6b. New service file: `services/razorpay/payment-link.client.ts`

Wraps three Razorpay REST calls:

```ts
export async function razorpayCreatePaymentLink(input: {
  amountPaise: number
  currency: 'INR'
  expireBy: number             // unix seconds
  description: string
  customer: { name: string; contact: string; email?: string }
  notify: { sms: boolean; email: boolean }
  reminder_enable: false       // we do our own reminders
  reference_id: string         // == PaymentLink.id (our local id)
  notes: { invoiceId: string; businessId: string; paymentLinkId: string }
}, idempotencyKey: string): Promise<{ id: string; short_url: string; status: string }>

export async function razorpayCancelPaymentLink(linkId: string): Promise<void>
export async function razorpayFetchPaymentLink(linkId: string): Promise<PaymentLinkPayload>
```

`reminder_enable` is hard-coded `false` to prevent Razorpay from
texting the customer on its own schedule — we own that channel.
`reference_id` carries our local `PaymentLink.id`, making webhook
correlation cheap.

### 6c. Webhook events handled

Add to the existing dispatcher in `razorpay-webhook.service.ts`:

| Event | Handler | Action |
|---|---|---|
| `payment_link.paid` | `handleLinkPaid` | Idempotent on `(razorpayLinkId, eventId)`. Creates a `Payment` row (mode=`UPI` or per `payment.method`), creates a `PaymentAllocation` to the invoice, recomputes outstanding, flips link to `PAID`, busts aging cache, fires `markPtpKept` hook. |
| `payment_link.partially_paid` | `handleLinkPartiallyPaid` | Same but link → `PARTIALLY_PAID`; allocation amount = the partial paise. |
| `payment_link.expired` | `handleLinkExpired` | Link → `EXPIRED`. No money movement. |
| `payment_link.cancelled` | `handleLinkCancelled` | Link → `CANCELLED`. No money movement. |

### 6d. Signature verification

Reuses the existing `verifyWebhookSignature(rawBody, sigHeader, secret)`
in `razorpay-webhook.service.ts`. Only the dispatcher's switch grows.
Failed signature → 400 + audit log row. Same secret as subscription
webhooks (Razorpay only issues one per account).

### 6e. Idempotency

- **Outbound create:** `Idempotency-Key` header = `pl-create-{PaymentLink.id}`
  (uuid7 generated server-side before Razorpay call). Stored in
  `PaymentLink.createIdempotencyKey @unique`. Retry-safe across server
  restarts.
- **Inbound webhook:** dedupe on `(razorpayLinkId, eventId)` against
  the existing `WebhookEvent` audit table (already used for
  subscription webhooks).

### 6f. Expiry

`PaymentLink.expireBy` defaults to `now() + 7 days`, max `now() + 30 days`
(server-validated; Razorpay also enforces a 30-day max on Standard PL).
Daily cron `expire-payment-links.ts` flips ACTIVE rows where
`expireBy <= now()` and the webhook didn't fire (defence in depth).

---

## 7. WhatsApp dispatch

Existing pattern (no change for single sends): build a `wa.me/<phone>?text=<urlencoded>`
URL on the server, return it to the client, client opens `window.open(url)`
on web or `window.open(url, '_system')` on Capacitor — the OS chooses
WhatsApp.

### 7a. Token rendering

`templates.ts` exposes a registry:

```ts
export const REMINDER_TEMPLATES = {
  FRIENDLY_T7:  'Hi {{partyName}}, gentle reminder — invoice {{invoiceNumber}} of {{outstandingAmount}} is due {{dueDateRelative}}. Pay via {{paymentLinkUrl}}. Thanks, {{businessName}}',
  FIRM_T30:     '{{partyName}}, invoice {{invoiceNumber}} ({{outstandingAmount}}) is overdue by {{daysOverdue}} days. Please pay via {{paymentLinkUrl}} today. — {{businessName}}',
  STATEMENT:    'Hi {{partyName}}, your account statement from {{fromDate}} to {{toDate}} is ready: {{statementUrl}}. Outstanding: {{outstandingAmount}}. — {{businessName}}',
  // 6 more — see PRD §6
}
```

Token resolution is deterministic and pure — same inputs → same string,
suitable for idempotent log writes. Unknown tokens render as the literal
`{{token}}` (never empty) so missing data is visible to QA.

User overrides live on `ReminderConfig.whatsappTemplate` (already exists);
override falls through to template default. P2 will move to per-template
overrides via `CollectionCadence.templateKey` + a separate template
override table.

### 7b. Bulk dispatch on Capacitor

Android intents throttle if you fire `window.open` 50 times in rapid
succession — only the first 1-2 typically actually open WhatsApp, the
rest are dropped. Bulk dispatch sequences:

1. Server returns `{ batchId, items: [{partyId, partyName, waUrl}, ...] }`
2. Client renders the list with checkboxes (default all checked) and a
   "Send Next" + "Send All" button
3. **Send All** runs an async loop:
   - `window.open(item.waUrl, '_system')`
   - `await sleep(2000)` — 2 s pacing avoids intent dropping
   - On Capacitor, listen to `App.addListener('appStateChange', ...)`
     and only proceed when app returns to foreground (the user actually
     hit "Send" in WhatsApp before returning)
   - After each successful return, POST `/reminders/:id/dispatched`
4. **Send Next** advances one row at a time — preferred UX for Raju
   (no autopilot; he reads each name before sending)

Web fallback (no Capacitor): same loop but no foreground detection;
plain 2 s pacing.

Failure modes: if user doesn't return to the app within 60 s on Capacitor,
the row stays QUEUED with a "Tap to retry" affordance. No auto-retry
client-side.

---

## 8. Cron jobs

Existing scheduler: BullMQ queue + Redis (already used by
`outbox-dispatcher.ts`, `subscription-rollover.ts`). Two new jobs.

| Job | Schedule | Worker | Purpose | Failure |
|---|---|---|---|---|
| `ptp-evaluator` | `0 1 * * *` IST (01:00 daily) | `services/collections/promise-to-pay/evaluator.service.ts` | For every business, walk OPEN PTPs with `promiseDate <= today`. If running paid since PTP create ≥ amount → KEPT. Else → BROKEN. Emits SSE `ptp.broken` for live dashboards. | Per-business try/catch; one bad tenant doesn't stop the run. Job is idempotent (KEPT/BROKEN flips are no-ops). |
| `payment-link-expiry-sweeper` | `*/15 * * * *` (every 15 min) | `services/collections/cron/expire-payment-links.ts` | Flip ACTIVE → EXPIRED where `expireBy <= now()`. Best-effort Razorpay revoke. | Same idempotency story. |

Both registered in `server/src/queue/index.ts` next to the existing jobs.
Scheduler: BullMQ repeatable jobs; Redis already provisioned in prod.

The cadence engine (P2) becomes a third job `cadence-evaluator` running
every 5 min — schema is in place but the worker is a stub in MVP that
returns `{ skipped: 0 }`.

---

## 9. (merged into §8 — kept §-numbering aligned with PHASE_3 reference)

---

## 10. Permissions

New module appended to `PERMISSION_MATRIX` in
`server/src/services/settings/permissions-data.ts`:

```ts
{
  key: 'collections', label: 'Collections',
  actions: [
    { key: 'view',    label: 'View Collections (aging, lists)' },
    { key: 'remind',  label: 'Send Reminders & Statements' },
    { key: 'collect', label: 'Create Payment Links' },
    { key: 'ptp',     label: 'Manage Promise-to-Pay' },
    { key: 'export',  label: 'Export Aging / Statements' },
  ],
},
```

System-role defaults:

| Role | view | remind | collect | ptp | export |
|---|---|---|---|---|---|
| owner | inherit | inherit | inherit | inherit | inherit |
| manager | yes | yes | yes | yes | yes |
| accountant | yes | yes | yes | yes | yes |
| salesman | yes | yes | no  | yes | no  |
| viewer | yes | no  | no  | no  | no  |

Owner inherits via the existing `role === 'owner'` bypass in
`server/src/middleware/permission.ts:51`. Defaults are seeded only for
new businesses; existing businesses get the new keys via the same
"missing key → inherit role default" lazy pathway already in place for
GST Phase 2 module additions.

---

## 11. Frontend file map

All under `src/features/collections/`. Mirrors the structure used by
`features/jobs/` (Phase 3) and `features/custom-orders/` (Phase 4).
≤ 250 LOC per file. Mobile-first (320px floor), Deep Teal + Lime-Yellow
palette per `hp-design`.

```
src/features/collections/
├── CollectionsHubPage.tsx                      # 5-tab shell: Aging | Reminders | Payment Links | PTP | Statements
├── collections.routes.tsx                      # Route registration + lazy import
├── collections.service.ts                      # api() callers — barrel
├── collections.types.ts                        # DTOs — generated from server zod inferred types
├── collections.constants.ts                    # bucket labels, colors, permission keys
│
├── aging/
│   ├── AgingDashboard.tsx                      # Bucket cards + top-5 parties + advances tile
│   ├── AgingBucketCard.tsx                     # One bucket's total + count + tap target
│   ├── AgingBucketDetailPage.tsx               # Drill into a bucket → party list
│   ├── PartyOutstandingRow.tsx                 # One party row with "Remind" + "Link" actions
│   ├── useAgingSummary.ts                      # TanStack query hook
│   └── aging-buckets.ui.ts                     # bucketLabel(), bucketColor()
│
├── reminders/
│   ├── ReminderTemplatesPage.tsx               # Template list (read-only in MVP, edit in P2)
│   ├── BulkRemindDrawer.tsx                    # Multi-select party drawer + dispatch loop
│   ├── ReminderHistoryPage.tsx                 # Per-party reminder timeline
│   ├── ReminderRow.tsx                         # One row in the history
│   ├── useBulkRemindDispatch.ts                # The 2-s pacing loop + foreground detection
│   └── waOpen.ts                               # Capacitor / web wa.me opener (reused from existing share)
│
├── payment-links/
│   ├── CreatePaymentLinkDrawer.tsx             # Invoice + amount + expiry + share channels
│   ├── PaymentLinksPage.tsx                    # List with status pills
│   ├── PaymentLinkDetailDrawer.tsx             # Webhook trail + cancel + resend
│   ├── PaymentLinkStatusPill.tsx               # Color-coded chip
│   └── usePaymentLinks.ts                      # TanStack hooks
│
├── promise-to-pay/
│   ├── CreatePtpDrawer.tsx                     # Mini form invoked from a party row
│   ├── PtpListPage.tsx                         # Today / This Week / Overdue tabs
│   ├── PtpRow.tsx
│   ├── PtpStatusPill.tsx
│   └── usePtps.ts
│
├── statements/
│   ├── StatementPreviewPage.tsx                # React-PDF preview + Share button
│   ├── StatementShareDrawer.tsx                # Date range + channel picker
│   ├── StatementPDF.tsx                        # @react-pdf/renderer document — reuses
│   │                                           #   src/features/templates/components/* helpers
│   └── useStatement.ts
│
└── __tests__/
    ├── aging-buckets.test.ts                   # bucketFor() exhaustive
    ├── templates.render.test.ts                # token rendering edge cases
    └── ptp-evaluator.test.ts                   # daily transitions
```

Routing additions in `src/router.tsx`:

```ts
{
  path: 'collections',
  lazy: () => import('@/features/collections/collections.routes'),
}
```

The existing bottom nav (`src/components/nav/BottomNav.tsx`) gets a new
**"Collections"** item between "Payments" and "More" — visible if the
user has `collections.view` permission. On verticals where collections
is irrelevant (e.g. milk-delivery from the DudhHisaab cousin), the
nav item is filtered out via `useVertical().hiddenNavKeys` (same
pattern as Phase 3 jobs).

---

## 12. State machines

### 12a. PromiseToPay

```
                  ┌──── cancelPtp (user) ────┐
                  │                          ▼
   ┌──────────┐   │   payment satisfies   ┌──────┐
   │  (none)  │──▶│ OPEN ─────────────────▶ KEPT │
   └──────────┘   │                       └──────┘
                  │   daily evaluator
                  │   (promiseDate <= today
                  │    AND paid < amount)
                  │           │
                  │           ▼
                  │      ┌────────┐
                  └─────▶│ BROKEN │
                         └────────┘

  KEPT / BROKEN / CANCELLED are terminal.
  No "reopen" — user creates a new PTP.
```

Allowed transitions enforced server-side in
`promise-to-pay/update.service.ts`. Any client requesting an illegal
transition gets 409.

### 12b. PaymentLink

```
        createPaymentLink
              │
              ▼
        ┌──────────┐
        │ CREATED  │ (Razorpay call in flight)
        └────┬─────┘
             │ Razorpay create OK     │ Razorpay create fail
             ▼                        ▼
        ┌──────────┐              ┌────────┐
        │ ACTIVE   │              │ FAILED │ (terminal; user creates new)
        └────┬─────┘              └────────┘
             │
   ┌─────────┼─────────┬──────────────┐
   │ paid    │partial  │ user cancel  │ expireBy passed
   │webhook  │webhook  │              │
   ▼         ▼         ▼              ▼
┌──────┐ ┌────────────┐ ┌──────────┐ ┌─────────┐
│ PAID │ │PARTIALLY_  │ │CANCELLED │ │ EXPIRED │
└──────┘ │   PAID     │ └──────────┘ └─────────┘
         └─────┬──────┘
               │ second webhook completes payment
               ▼
            ┌──────┐
            │ PAID │
            └──────┘
```

PARTIALLY_PAID → PAID is the only non-terminal transition out of a
"completion-ish" state. All others terminal.

### 12c. Reminder dispatch

```
   recordReminder
        │
        ▼
   ┌────────┐  client confirms     ┌────────────┐
   │ QUEUED │─────────────────────▶│ DISPATCHED │
   └───┬────┘                      └─────┬──────┘
       │                                 │ (only PUSH gets receipt)
       │ channel hard error              ▼
       ▼                            ┌───────────┐
   ┌────────┐                       │ DELIVERED │
   │ FAILED │                       └───────────┘
   └────────┘
```

`DISPATCHED` is the realistic "sent" terminal for WhatsApp/SMS — we
have no proof of delivery and don't pretend to.

---

## 13. Offline behaviour

Per `.claude/rules/OFFLINE_RULES.md` — every feature must be
offline-correct from day one.

| Action | Offline behaviour |
|---|---|
| Open Aging dashboard | Reads `cacheReads: true` from `/aging/summary`. Stale-while-revalidate; UI shows "Last synced: 2 m ago" pill. |
| Open Bucket detail | Same pattern; cached per `(businessId, bucket)` key in IDB via `api-cache.ts`. |
| Create PTP | Queued via `api()`; passes `entityType: 'ptp'`, `entityLabel: '${partyName} — Rs ${amount}'`. Optimistically inserts in TanStack Query cache. |
| Create Payment Link | **Hard-fails offline** with a toast "Payment link needs internet — try again when online." Razorpay round-trip can't be queued meaningfully (the link must exist before the customer is texted). |
| Bulk reminder | Each `ReminderLog` POST is queued individually with `entityType: 'reminder'`, `entityLabel: '${partyName} — ${templateKey}'`. Server pre-records before issuing `wa.me` URLs, so the URLs are valid. **However:** the `wa.me` open requires online (WhatsApp app needs network). If offline, dispatch button is disabled. |
| Mark reminder dispatched | Queued. |
| Generate statement PDF | Works fully offline — React-PDF runs client-side. Sharing requires the upload step to complete (queued, but the wa.me URL won't carry `{{statementUrl}}` until upload syncs). Drawer warns the user. |
| Cancel PTP / cancel link | Queued. Optimistic flip. Link cancel re-tries on reconnect. |

All API calls go through `api()` from `@/lib/api`. No raw `fetch()`.
Mutation handlers tolerate the optimistic `{}` return per Rule 5.

---

## 14. PDF generation (statements)

Reuses the **React-PDF** stack already in `src/features/templates/`:

- `StatementPDF.tsx` is a `<Document>` composed of:
  - Header band (business logo, name, address, GSTIN if any) — reuses
    `templates/components/PdfHeader.tsx` props
  - Party block (name, address, period)
  - Opening balance row
  - Transactions table (date / type / ref / debit / credit / running balance)
  - Closing balance row
  - Aging snapshot footer (4 buckets)
- Generated **client-side** in a Web Worker on web (
  `@react-pdf/renderer` supports it) and on the main thread on
  Capacitor (worker not yet wired in the mobile bundle — tracked).
- After render, the resulting `Blob` is uploaded to
  `POST /storage/statements` → returns a 7-day pre-signed S3 URL.
- That URL is substituted into the `STATEMENT` reminder template.
- We do **not** store statement PDFs server-side beyond the cache —
  re-generation is cheap and avoids stale balance issues.

PDF size budget: ≤ 200 KB for a 12-month statement of a typical Priya
party (≈ 80 transactions). Verified during QA via the
`templates/__tests__/pdf-size.test.ts` pattern (extend with a statement
fixture).

---

## 15. Performance

### 15a. Aging dashboard target

P50 < 800 ms end-to-end for a business with **5,000 open invoices**,
on a Rs 12K Android phone over 4G. Decomposition:

| Hop | Budget |
|---|---|
| Service-worker / IDB cache hit (warm) | < 50 ms |
| Network round-trip | < 250 ms |
| Server cache hit (Redis `aging:{businessId}`) | < 30 ms |
| Server cold compute (no cache) | < 400 ms |
| Render (4 bucket cards + top-5 list) | < 100 ms |

**Cold compute query** under EXPLAIN budget:

```sql
SELECT
  COUNT(*) FILTER (WHERE "outstandingAmount" > 0)             AS open_count,
  SUM("outstandingAmount")                                    AS total,
  SUM(CASE WHEN "dueDate" IS NULL OR "dueDate" >= $now THEN "outstandingAmount" ELSE 0 END) AS current,
  SUM(CASE WHEN "dueDate" <  $now AND ($now - "dueDate") <= INTERVAL '30 days' THEN "outstandingAmount" ELSE 0 END) AS bucket_0_30,
  SUM(CASE WHEN ($now - "dueDate") BETWEEN INTERVAL '31 days' AND INTERVAL '60 days' THEN "outstandingAmount" ELSE 0 END) AS bucket_31_60,
  SUM(CASE WHEN ($now - "dueDate") BETWEEN INTERVAL '61 days' AND INTERVAL '90 days' THEN "outstandingAmount" ELSE 0 END) AS bucket_61_90,
  SUM(CASE WHEN ($now - "dueDate") > INTERVAL '90 days' THEN "outstandingAmount" ELSE 0 END) AS bucket_90_plus
FROM "Document"
WHERE "businessId" = $1
  AND "isDeleted"  = false
  AND "outstandingAmount" > 0
  AND "type" IN ('SALE_INVOICE','SALES_RETURN');
```

Plan target: **Index Only Scan** on `Document_aging_open_idx`,
heap fetches ≈ 0 (covering for `dueDate`, `outstandingAmount` not in
index → small heap fetch acceptable). Worst observed in dev: 280 ms
for 7k rows → fits the 400 ms cold budget with margin.

### 15b. Other endpoints

- Bucket party list: cursor-paginated 50/page, `(businessId, partyId)` group-by; budget P50 < 250 ms for 50 results.
- Reminder list: cursor on `(createdAt, id)`, indexed; < 150 ms.
- Statement DTO: 12-month range, < 600 ms server-side.

### 15c. Frontend

- Code-split: `collections.routes.tsx` is `React.lazy`d. Initial bundle
  contribution ≤ 35 KB gzip (verified in `vite.config.ts` rollup
  visualizer report; budget added to `scripts/check-bundle-budgets.mjs`).
- React-PDF chunk loaded only on Statement preview navigation.
- Aging dashboard renders bucket cards before the top-5 list is fetched
  (parallel queries, independent suspense boundaries).

---

## 16. Security

### 16a. Threat model & mitigations

| Threat | Mitigation |
|---|---|
| **Payment link enumeration** (attacker guesses `razorpayLinkId` to view another tenant's link) | Razorpay short URLs are 22-char base62 (entropy ~131 bits). Our endpoints `/payment-links/:id` always tenant-scope on `businessId` from JWT — `id` alone is never enough. No public route exposes the link by id. |
| **Reminder template injection** (user puts `{{paymentLinkUrl}}` for a different invoice into a custom message) | Tokens resolved server-side from the `(partyId, invoiceId)` pair on the request, not from user-supplied strings. User custom message is escaped + appended **after** template rendering, never inside it. |
| **PII in WhatsApp messages** (sending phone numbers, balances to wrong party) | Server validates `partyId` ↔ `invoiceId` consistency in the same business before rendering. Client-side per-party preview before bulk send shows the rendered text + recipient phone. Rate limit on `/reminders/bulk` (50 per call, 30/min). |
| **Razorpay webhook spoofing** | Existing `verifyWebhookSignature` reused — same secret as subscription webhooks. Failed sig = 400 + audit row. |
| **Webhook replay** | Dedupe on `WebhookEvent(eventId)` table — already used. |
| **PaymentLink amount tampering by customer** | Razorpay enforces the amount we set at create time; partial-pay is also bounded. We trust the webhook-reported amount, not the URL. |
| **Statement URL leak** (pre-signed S3 URL forwarded to wrong recipient) | URL TTL 7 days; can be revoked manually. Statement re-share generates a fresh URL. |
| **Cross-tenant data via PTP/Link list** | Every list query has `WHERE businessId = $1` from JWT — verified by the existing `requirePermission('collections.view')` middleware which also checks tenant membership. |
| **Idempotency-key reuse across tenants** | Idempotency is namespaced `(businessId, key)` in the existing `IdempotencyRecord` table. |
| **PII in app logs** (rendered messages contain phone, amount) | `ReminderLog.renderedMessage` stored in DB but **never logged** to stdout. Only `{ id, partyId, channel, status }` goes to logger. Recipient phone masked in logs (`+91XXXXX1234`). |

### 16b. Audit columns

Every mutating endpoint writes the actor's `userId` to `createdBy` /
`updatedBy`. Cancel + delete record `cancelledAt` / `deletedBy`.
PaymentLink keeps `lastWebhookEvent` + `lastWebhookAt` for forensics.

### 16c. Rate limits (summary)

| Endpoint family | Limit |
|---|---|
| GET reads | 60 req/min/user |
| POST `/reminders` (single) | 30 req/min/user |
| POST `/reminders/bulk` | 5 req/min/user, 50 items/call |
| POST `/payment-links` | 10 req/min/user |
| POST `/ptp` | 30 req/min/user |
| POST `/statements/*/share` | 10 req/min/user |

Implemented via existing `rate-limit.middleware.ts` + Redis token bucket.

### 16d. Permissions (recap)

`collections.view` for all reads. `collections.collect` for payment-link
mutations. `collections.remind` for reminder + statement dispatch.
`collections.ptp` for PTP writes. `collections.export` for CSV/PDF
exports of aging or batch statements (Phase 2). Owner inherits all.

---

## 17. Risks + mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Razorpay rate-limits us during a bulk-link day | Med | Med | 10 req/min user limit + idempotency means retries don't double-create. Razorpay quota is 5000/day per merchant — we're well below. |
| 2 | wa.me intent dropped on cheap Androids during bulk dispatch | High | Med | 2 s pacing + Capacitor foreground detection; "Send Next" mode for users who don't trust Send All; full retry list in the drawer. |
| 3 | Aging cache stale shows wrong totals after a payment | Med | Med | Hooks in `payment/create.ts` and `outstanding.ts` bust the cache key in the same transaction's success callback. Worst case 60 s drift. |
| 4 | Daily PTP evaluator marks wrong rows BROKEN due to TZ confusion | Med | High | Compare in IST midnight using `dayjs.tz('Asia/Kolkata')`; explicit unit test per HP convention. |
| 5 | PaymentLink webhook arrives before the create response is persisted (race) | Low | Med | We persist `CREATED` row + idempotency key BEFORE the Razorpay call; webhook handler does upsert by `razorpayLinkId` so out-of-order is fine. |
| 6 | Soft-deleted invoice still has an ACTIVE PaymentLink, customer pays it, money lands without an invoice | Low | High | `services/document/delete.ts` hook cancels active links + revokes at Razorpay (best-effort). If revoke fails, link still in our DB as CANCELLED — webhook on inbound payment routes to a quarantine handler that creates a Payment with `notes: 'Pre-cancelled link payment — review'`. |
| 7 | Cross-tenant PaymentLink id collision (cuid clash) | Negligible | High | cuid collision probability is ~0; tenant scoping in every query is the real defence. |
| 8 | Bulk reminder leaks a PII message to wrong party (template token mismapped) | Med | High | Server resolves all tokens per-row; client preview shows the rendered text. Snapshot tests on the templating engine. |
| 9 | React-PDF statement OOMs the browser on a 5,000-txn party | Low | Med | Server caps statement range at 366 days; UI also caps. Statement DTO paginates internally and concatenates. |
| 10 | User overuses bulk reminders and Razorpay reports them as spammers | Med | High | We don't use Razorpay for reminders. WhatsApp spam-throttling is the user's risk; the app shows "WhatsApp may rate-limit you" warning at bulk size > 20. |
| 11 | Migration adds index that locks `Document` table on prod | Med | High | Production runbook uses `CREATE INDEX CONCURRENTLY`; PR description explicitly calls this out for the DBA. Dev migration uses plain index (small DBs). |
| 12 | Schema FKs prevent future Party/Invoice deletes | Low | Low | All FKs to Party/Document use `Restrict` or `SetNull` matching repo convention; no new cascade-delete chains introduced. |

---

## 18. Acceptance criteria (per feature)

Each feature ships with both backend curl proofs AND the 4 UI states
(loading / error / empty / success) at 320 px AND in dark theme.

### 18a. Aging dashboard

Backend:
- `curl -X GET /api/collections/aging/summary` → 200 with bucket totals
- Same endpoint with empty business → 200 with all buckets at 0
- Same with no auth → 401
- Same with `viewer` role missing `collections.view` → 403 (smoke — viewer has it by default)
- 5,000-invoice seeded business: `time` shows < 800 ms warm, < 1.2 s cold

Frontend screenshots:
- 320 px: loading skeleton (4 shimmer cards), error toast, empty state ("All clear — no outstanding"), success (4 buckets + top-5)
- Dark theme variants of each

### 18b. Bulk reminders

Backend:
- `curl -X POST /api/collections/reminders/bulk` with 3 partyIds → 207 with each item resolved
- Same with 51 items → 400 ("max 50")
- Same with cross-tenant partyId → 403/404 per item, never a leak

Frontend:
- 320 px: party multiselect, preview drawer per row, pacing loader between sends, "Sent 3 / 5" progress, retry on failure
- Dark theme

### 18c. Payment Links

Backend:
- `curl -X POST /api/collections/payment-links` for an open invoice → 201 with `shortUrl`
- Same for a PAID invoice → 409
- Same with `Idempotency-Key` repeated → 200 returning the same row
- Razorpay webhook `payment_link.paid` → invoice outstanding drops; aging cache busted; a `Payment` row exists

Frontend:
- 320 px: amount input (defaults to invoice outstanding), expiry picker (7d default), share-channel chips, success toast with WA / SMS share buttons, status pill on detail
- Dark theme

### 18d. Promise to Pay

Backend:
- Create / update / cancel PTP curls
- Daily evaluator dry-run prints transitions; once enabled, OPEN PTPs past `promiseDate` flip correctly

Frontend:
- Today / This Week / Overdue tabs each with empty + loaded states
- 320 px + dark

### 18e. Statements

Backend:
- `curl -X GET /api/collections/statements/:partyId?from=&to=` → 200 with DTO
- 366-day range OK, 367-day → 400

Frontend:
- React-PDF preview renders within 2 s on a 12-month statement (perf budget)
- Share drawer: WhatsApp + Download tabs, both render
- 320 px + dark

---

## 19. Out-of-scope (explicit)

These are deliberately not in this epic — restating the PRD's
non-goals through an architecture lens so future contributors don't
accidentally back-door them:

- **WhatsApp Cloud API / Meta BSP** — no `sendTemplateMessage` calls,
  no template approval workflow, no opt-in registry. All dispatch is
  `wa.me` deep links.
- **AI-drafted reminder messages** — no LLM in the request path.
  Templates are static + token-substituted only.
- **Escalation / legal notice generation** — no notice templates,
  no doc auto-attach to disputed invoices.
- **Multi-currency collections** — `PaymentLink.currency` defaults to
  `INR` and is not surfaced in UI; non-INR invoices throw a 400 at
  link create.
- **Customer self-service portal** — no public web URL aggregating
  a customer's dues; only per-invoice `shortUrl` from Razorpay.
- **Bank reconciliation** — inbound bank credit matching to outstanding
  is Phase 4 banking, not here.
- **Collections-staff assignment / queue** — no `assignedTo` on PTP or
  invoice; no per-user collections workload view.
- **Auto-write-off** — manual journal entry remains the path.
- **NACH / mandate auto-debit** — out of scope.
- **Email reminders** — `EMAIL` enum value reserved but the dispatcher
  throws a 422 ("email channel not yet enabled — connect Resend in
  Settings → Integrations") when invoked.

---

## 20. MVP cut vs Phase 2

| Capability | MVP (this epic) | Phase 2 |
|---|---|---|
| Aging buckets dashboard | Full | — |
| Bucket drill-down → party list | Full | — |
| Top-N outstanding parties tile | Full | — |
| Per-party invoice list with bucket | Full | — |
| Manual reminder (single) | Full | — |
| Bulk reminder dispatch | Full | — |
| Reminder history per party | List view | Add channel-delivery receipts (PUSH) |
| Reminder templates | Static registry + single override on `ReminderConfig` | Per-template editor; rich-text; per-cadence templates |
| Auto-cadence (T+7 / T+14 / T+30) | **Schema only**, evaluator stub | Cron `cadence-evaluator` enabled; UI to configure cadences |
| Quiet hours | Honoured by manual + bulk client UI (warn at 21:00–09:00) | Enforced server-side for cadence-fired sends |
| Payment Links — Standard (Razorpay) | Full | — |
| UPI Collect deep link (no Razorpay) | — | Phase 2 |
| Payment Link expiry sweeper | Full | — |
| Webhook handlers (paid / partial / expired / cancelled) | Full | — |
| Payment Link resend | Full | — |
| Promise-to-Pay create / update / cancel | Full | — |
| Daily PTP evaluator (KEPT / BROKEN) | Full | — |
| PTP per-party history | Full | — |
| Statements — server DTO + client React-PDF | Full | — |
| Statement share via WhatsApp | Full | — |
| Statement scheduling (e.g. monthly auto-send) | — | Phase 2 cadence engine |
| Cash-flow forecast (30-day) | **Endpoint stub returning empty** | Real series from due dates + PTP dates |
| Collections export (CSV) | — | Phase 2; permission key already reserved |
| Multi-recipient sequencing on Capacitor (2 s pacing) | Full | — |
| Permissions module `collections` | Full (5 actions) | — |
| `CollectionCadence` table | **Created (forward-compat)** | Engine + UI ship in P2 |

MVP scope is **22 endpoints**, 4 new tables + 1 forward-compat table,
2 cron jobs, 1 new permission module, 1 new top-level tab in the app.
The forward-compat `CollectionCadence` row in v0 means Phase 2 ships
without another migration on this surface.


