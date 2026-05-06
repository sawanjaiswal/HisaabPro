---
status: draft
feature: recurring-invoices
created: 2026-05-06T12:55:00Z
author: architect agent
prd: docs/recurring-invoices/PRD.md
---

# ARCHITECTURE — Recurring Invoices

Phase 1 design. Builds on the partial implementation already present at
`server/src/services/recurring/*`, `server/src/routes/recurring.ts`,
`src/features/recurring/RecurringListPage.tsx`. This doc closes the gaps:
runs table, cron infra, autoSend / autoPaymentLink / autoReminder hooks,
manual generate-now, frontend create/detail pages, race-safe claim semantics.

Confirmed (from PRD §16): drop missed runs on resume, manual generate-now
advances `nextRunDate`, DAILY is in Phase 1.

---

## 1. Data model

### 1.1 `RecurringInvoice` (extend in place)

Existing model lives at `server/prisma/schema.prisma:1695`. Additions only —
no field type changes (avoids the add-column → backfill → not-null dance).

```prisma
model RecurringInvoice {
  // === unchanged existing fields ===
  id                 String    @id @default(cuid())
  businessId         String
  templateDocumentId String
  partyId            String
  frequency          String                          // DAILY|WEEKLY|MONTHLY|QUARTERLY|YEARLY
  startDate          DateTime
  endDate            DateTime?
  nextRunDate        DateTime
  dayOfMonth         Int?                            // 1-28
  dayOfWeek          Int?                            // 0-6
  autoSend           Boolean   @default(false)
  status             String    @default("ACTIVE")    // ACTIVE|PAUSED|COMPLETED
  generatedCount     Int       @default(0)
  lastGeneratedAt    DateTime?
  isDeleted          Boolean   @default(false)
  deletedAt          DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  // === NEW (nullable / defaulted — safe additive migration) ===
  name               String?   @db.VarChar(120)
  autoPaymentLink    Boolean   @default(false)
  autoReminder       Boolean   @default(false)
  lastFailureReason  String?   @db.VarChar(500)
  cancelledAt        DateTime?
  cancelledBy        String?
  createdBy          String?                         // userId; nullable for backfill of pre-existing rows
  updatedBy          String?
  claimedAt          DateTime?                       // cron claim watermark — see §3
  claimedBy          String?   @db.VarChar(80)       // worker id (hostname:pid)

  business  Business              @relation(fields: [businessId], references: [id], onDelete: Cascade)
  documents Document[]
  runs      RecurringInvoiceRun[]                    // NEW back-relation

  @@index([businessId, status])
  @@index([nextRunDate, status])
  @@index([businessId, isDeleted])
  @@index([businessId, partyId])                     // NEW
  @@index([status, claimedAt])                       // NEW — cron picker
}
```

Notes:
- `createdBy` made nullable so the migration does not need a backfill of
  existing rows (current `crud.ts` ignores `_userId`; PR2 will start writing it).
- `claimedAt` / `claimedBy` only used by the cron picker — see §3.
- Status enum stays string-typed to match the current `Document.status` /
  `RecurringInvoice.status` convention. CANCELLED is implicit — if
  `generatedCount === 0`, hard-delete; the audit trail is in `AuditLog`.

### 1.2 `RecurringInvoiceRun` (new)

```prisma
model RecurringInvoiceRun {
  id                  String    @id @default(cuid())
  recurringInvoiceId  String
  businessId          String
  scheduledFor        DateTime                         // the original due date
  ranAt               DateTime  @default(now())
  status              String                           // SUCCESS|SUCCESS_PARTIAL|FAILED|SKIPPED
  generatedDocumentId String?
  paymentLinkId       String?
  idempotencyKey      String                           // {recurringId}_{scheduledFor_YYYYMMDD}
  errorMessage        String?   @db.VarChar(500)
  warning             String?   @db.VarChar(120)       // autoSend_skipped_no_phone, paymentLink_failed, gstin_mismatch, …
  retryCount          Int       @default(0)
  triggeredBy         String                           // "cron" | userId
  isDeleted           Boolean   @default(false)        // soft-delete trio (consistency)
  deletedAt           DateTime?
  createdAt           DateTime  @default(now())

  recurringInvoice    RecurringInvoice  @relation(fields: [recurringInvoiceId], references: [id], onDelete: Cascade)
  business            Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  generatedDocument   Document?         @relation("RecurringRunDocument", fields: [generatedDocumentId], references: [id], onDelete: SetNull)

  @@unique([idempotencyKey])
  @@index([recurringInvoiceId, ranAt(sort: Desc)])
  @@index([businessId, status])
  @@index([scheduledFor, status])
}
```

Inverse relations to add:
- `Business.recurringRuns RecurringInvoiceRun[]`
- `Document.recurringRun  RecurringInvoiceRun? @relation("RecurringRunDocument")`

`@@unique(idempotencyKey)` is the last-line defence against double-generation
(see §3). On collision Prisma throws `P2002`; the cron catches and logs `SKIPPED`.

### 1.3 `Document` (1 field flip)

`Document.isRecurring` already exists (`schema.prisma:1884`). PR2 will set it
to `true` when a document is bound as a `templateDocumentId`. The document
delete path (`server/src/services/document.service.ts`) MUST refuse deletion
when `isRecurring = true` — see Risk #3 / Edge case #17 in the PRD.

---

## 2. Migration plan

Single hand-written SQL file (per `.claude/rules/PRISMA_MIGRATION_RULES.md` —
no `db push`, no `migrate dev` for production paths).

**File:** `server/prisma/migrations/20260507000000_recurring_phase1/migration.sql`

Ordered DDL:

```sql
-- 1. Additive columns on RecurringInvoice (all nullable / defaulted)
ALTER TABLE "RecurringInvoice"
  ADD COLUMN "name"              VARCHAR(120),
  ADD COLUMN "autoPaymentLink"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "autoReminder"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastFailureReason" VARCHAR(500),
  ADD COLUMN "cancelledAt"       TIMESTAMP(3),
  ADD COLUMN "cancelledBy"       TEXT,
  ADD COLUMN "createdBy"         TEXT,
  ADD COLUMN "updatedBy"         TEXT,
  ADD COLUMN "claimedAt"         TIMESTAMP(3),
  ADD COLUMN "claimedBy"         VARCHAR(80);

CREATE INDEX "RecurringInvoice_businessId_partyId_idx"
  ON "RecurringInvoice"("businessId", "partyId");
CREATE INDEX "RecurringInvoice_status_claimedAt_idx"
  ON "RecurringInvoice"("status", "claimedAt");

-- 2. New table
CREATE TABLE "RecurringInvoiceRun" (
  "id"                  TEXT PRIMARY KEY,
  "recurringInvoiceId"  TEXT NOT NULL,
  "businessId"          TEXT NOT NULL,
  "scheduledFor"        TIMESTAMP(3) NOT NULL,
  "ranAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"              TEXT NOT NULL,
  "generatedDocumentId" TEXT,
  "paymentLinkId"       TEXT,
  "idempotencyKey"      TEXT NOT NULL,
  "errorMessage"        VARCHAR(500),
  "warning"             VARCHAR(120),
  "retryCount"          INTEGER NOT NULL DEFAULT 0,
  "triggeredBy"         TEXT NOT NULL,
  "isDeleted"           BOOLEAN NOT NULL DEFAULT false,
  "deletedAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringInvoiceRun_recurringInvoiceId_fkey"
    FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id") ON DELETE CASCADE,
  CONSTRAINT "RecurringInvoiceRun_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,
  CONSTRAINT "RecurringInvoiceRun_generatedDocumentId_fkey"
    FOREIGN KEY ("generatedDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "RecurringInvoiceRun_idempotencyKey_key"
  ON "RecurringInvoiceRun"("idempotencyKey");
CREATE INDEX "RecurringInvoiceRun_recurringInvoiceId_ranAt_idx"
  ON "RecurringInvoiceRun"("recurringInvoiceId", "ranAt" DESC);
CREATE INDEX "RecurringInvoiceRun_businessId_status_idx"
  ON "RecurringInvoiceRun"("businessId", "status");
CREATE INDEX "RecurringInvoiceRun_scheduledFor_status_idx"
  ON "RecurringInvoiceRun"("scheduledFor", "status");
```

After applying via `prisma migrate deploy` (NOT dev), edit `schema.prisma`
to add the model + fields, then run `prisma generate` only. Verify with
`prisma migrate status` — must show no drift.

No backfill is required; existing `RecurringInvoice` rows get the column
defaults. There are no production rows yet (Phase 1 epic).

---

## 3. Cron runner

### 3.1 Schedule

Reuse `server/src/lib/cron-scheduler.ts`. Add one new entry registered in
`initCronJobs()`:

```ts
cron.schedule('*/15 * * * *', () => void runRecurringGenerator(), {
  timezone: 'Asia/Kolkata',
})
```

Every 15 minutes in IST. Matches PRD §9.2 budget. Exposed for manual run
via `server/src/jobs/run-recurring-generator.ts` (sibling to existing
`run-ptp-evaluator.ts`).

### 3.2 Race-safe claim — atomic `UPDATE … RETURNING`

The current `generation.ts` does a `findMany({ status: 'ACTIVE', nextRunDate: { lte: now }})`
then loops. Two cron pods would each fetch and double-generate. Replace
with a single atomic claim that locks rows in a status-update window.

```ts
// pseudo, in services/recurring/claim.ts
const now = new Date()
const claim = `${process.env.HOSTNAME ?? 'local'}:${process.pid}`
const claimWindow = new Date(now.getTime() - 5 * 60_000) // 5 min — re-claim stalled

const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
  UPDATE "RecurringInvoice"
  SET "claimedAt" = ${now}, "claimedBy" = ${claim}
  WHERE "id" IN (
    SELECT "id" FROM "RecurringInvoice"
    WHERE "status" = 'ACTIVE'
      AND "isDeleted" = false
      AND "nextRunDate" <= ${now}
      AND ("claimedAt" IS NULL OR "claimedAt" < ${claimWindow})
    ORDER BY "nextRunDate" ASC
    LIMIT 500
    FOR UPDATE SKIP LOCKED
  )
  RETURNING "id"
`
```

`FOR UPDATE SKIP LOCKED` ensures parallel pods never see the same row.
`claimedAt` watermark allows a stuck worker (crash mid-run) to be reclaimed
after 5 minutes by the next pod. After the run loop, claim is cleared
(`claimedAt = null, claimedBy = null`) inside the same per-schedule
transaction that bumps `nextRunDate`.

### 3.3 Per-schedule transaction

For each claimed id:

1. Outside tx: build `idempotencyKey = ${id}_${scheduledFor.toISOString().slice(0,10)}`.
2. Outside tx: load template via existing `TEMPLATE_SELECT`.
3. **Tx start** (single `prisma.$transaction`):
   a. `INSERT RecurringInvoiceRun` with `status='RUNNING'` placeholder
      (catches duplicate via unique constraint immediately → SKIPPED branch).
   b. `generateNextNumber(tx, ...)` (existing `document-number.service.ts`).
   c. Create `Document` (status=SAVED, recurringInvoiceId=schedule.id).
   d. Clone line items + additional charges (existing `clone.ts`).
   e. Update `RecurringInvoice` — bump `nextRunDate`, `generatedCount`,
      `lastGeneratedAt`, possibly flip `status=COMPLETED` if past `endDate`.
      Clear `claimedAt`/`claimedBy`.
   f. Update the run row with `status='SUCCESS'`, `generatedDocumentId`.
4. **Outside tx (best-effort, per PRD):**
   - If `autoPaymentLink`: call `payment.service.createPaymentLink()`. On
     failure → `runRow.status = 'SUCCESS_PARTIAL'`, `warning = 'paymentLink_failed'`.
   - If `autoReminder` AND link succeeded: enroll via reminder-config service.
   - If `autoSend`: `wa-utils.sendInvoiceShare()` (or queue if party has no
     phone → `warning = 'autoSend_skipped_no_phone'`).
5. Emit `recurring.run.success` / `.failed` analytics event + structured log.

### 3.4 Failure / retry policy

- Unique constraint violation (P2002 on `idempotencyKey`): catch,
  `runRow.status = 'SKIPPED'`, log `recurring.run.skipped`. NEVER throw.
- Other tx failure: catch outside, `INSERT RecurringInvoiceRun` with
  `status='FAILED'`, `errorMessage`, increment `retryCount` from prior
  failed runs for the same `idempotencyKey` (lookup by `recurringInvoiceId + scheduledFor`).
  Schedule stays ACTIVE — next 15-min tick retries until `retryCount >= 3`,
  after which `RecurringInvoice.lastFailureReason` is set and an in-app
  banner + email fires (PRD §11). The schedule still stays ACTIVE — manual
  intervention required to clear `lastFailureReason` (edit endpoint).
- Bulk catch-up cap: when `nextRunDate` is more than one period in the past
  (outage), generate exactly one invoice for the most recent due date; emit
  one SKIPPED row for each missed earlier date with `warning='outage_catchup_limit'`.
  Implementation: loop `calculateNextRunDate` until result `> now`, log
  intermediate dates as SKIPPED rows.

---

## 4. Invoice generation — what gets copied vs recomputed

### 4.1 Snapshotted from template (cloned verbatim)

All fields already enumerated in `services/recurring/clone.ts` `TEMPLATE_SELECT`:
party, shippingAddress, paymentTerms, notes, terms, signature flag, transport
fields, supply type, reverse-charge flag, composite flag, all line items
(productId, qty, rate, discount, hsn/sac, taxableValue, **all GST amounts**),
additional charges, totals (subtotal, totalDiscount, totalAdditionalCharges,
roundOff, grandTotal, totalTaxableValue, totalCgst, totalSgst, totalIgst,
totalCess, tdsRate, tdsAmount, tcsRate, tcsAmount).

### 4.2 Freshly assigned

- `documentNumber` / `sequenceNumber` / `financialYear` — via
  `generateNextNumber(tx, businessId, type, documentDate)`. The existing
  service handles FY rollover automatically because `documentDate = run date`
  (already correct in current generation.ts:88-92).
- `documentDate = run date, UTC midnight`.
- `dueDate = null` (template doesn't carry one).
- `status = 'SAVED'`.
- `recurringInvoiceId = schedule.id`.
- `balanceDue = grandTotal`, `paidAmount = 0`.
- `createdBy = 'system'` (matches existing pattern at generation.ts:172;
  `AuditLog` will record `systemActor=true`).

### 4.3 GST recompute decision — **snapshot only in Phase 1**

PRD line 70 (Priya pain) and PRD §8 case #3-#4 / Risk #11 say:
recompute from current party GSTIN. Reality check against the existing
clone path: GST amounts are stored on `DocumentLineItem` (cgstAmount,
sgstAmount, igstAmount, cessAmount), and changing them mid-generation
means rerunning the entire `tax-calc` pipeline against current
`TaxCategory.rate`, current party `gstin`, current business `gstin` for
inter/intra-state determination. That is a meaningful chunk of work and
can produce silently wrong totals if a rate has changed since the
template was saved.

**Decision:** Phase 1 = pure snapshot (current behaviour). On generation,
run a **read-only mismatch detector**:

```ts
const currentParty = await tx.party.findUnique({
  where: { id: template.partyId },
  select: { gstin: true },
})
if (currentParty?.gstin !== template.partyGstin /* if we add this column */) {
  runRow.warning = 'gstin_mismatch'
  // schedule.lastFailureReason set to a banner-friendly string
}
```

Surface the mismatch as a card warning + banner (PRD §11
`recurring.party_gstin_mismatch`). User must edit/replace the template
to clear. **Phase 2** will switch to recompute behind a feature flag once
we have a tax-calc unit-test harness for the recurring path.

Document this decision prominently on the schedule detail page so users
on long contracts (Priya) understand the trade-off.

### 4.4 Risk callout

A government-driven GST rate change (rare, but happens) silently
invalidates every active recurring schedule. The mismatch detector above
catches party-level GSTIN changes; rate-level changes need a
`TaxCategory.updatedAt` vs `template.lineItems[*].cgstRate` check. PR2
must include both checks.

---

## 5. API surface

All routes mounted at `/api/recurring`. Auth: `auth` middleware (existing).
Subscription: `requireFeature('recurringInvoices')` (existing).
Idempotency: per repo convention, POSTs that create rows use the
`idempotency-key` header middleware (already wired for documents).

| Method | Path | Permission | Zod schema | Response |
|---|---|---|---|---|
| POST | `/recurring` | `recurring.manage` (NEW; until then `invoicing.create`) | `createRecurringSchema` | `201 { id, status, nextRunDate, … }` |
| GET | `/recurring` | `recurring.view` | `listRecurringSchema` | `200 { items, pagination }` |
| GET | `/recurring/:id` | `recurring.view` | — | `200 { …, _count: { documents, runs } }` |
| PATCH | `/recurring/:id` | `recurring.manage` | `updateRecurringSchema` | `200 { … }` |
| POST | `/recurring/:id/pause` | `recurring.pause` | empty body | `200 { id, status: 'PAUSED' }` |
| POST | `/recurring/:id/resume` | `recurring.pause` | empty body | `200 { id, status: 'ACTIVE', nextRunDate }` |
| POST | `/recurring/:id/generate-now` | `recurring.manage` | empty body, idempotency-key required | `200 { documentId, runId, nextRunDate }` |
| DELETE | `/recurring/:id` | `recurring.manage` | — | `200 { deleted, hard }` |
| GET | `/recurring/:id/runs` | `recurring.view` | `?cursor&limit` | `200 { items: RunRow[], nextCursor }` |
| POST | `/recurring/generate` *(existing, kept for testing)* | `recurring.manage` | empty | same as cron path |

Permission keys (PRD §10): introduce `recurring.view`, `recurring.manage`,
`recurring.pause`. Owners/Admins/Accountants get manage; Salespeople/Viewers
get view only. Mapping table goes in
`server/src/services/admin/permissions.constants.ts` (or sibling — match
the convention of the file currently holding `payments.manage`).

### 5.1 Pause / Resume / Generate-now semantics

Promote pause/resume out of the generic `PUT` because the side effects
differ (resume recalculates `nextRunDate`).

- **Pause:** `status = 'PAUSED'`. `nextRunDate` preserved. AuditLog write.
- **Resume:** Reject if `status === 'COMPLETED'` (422). Compute
  `nextRunDate = calculateNextRunDate(now, frequency, dayOfMonth, dayOfWeek)`
  (per Q1 — drop missed runs). If new `nextRunDate > endDate`, transition
  straight to `COMPLETED` and return that.
- **Generate-now:** Wrap the same `generateOneInvoice()` path with
  `triggeredBy = req.user!.userId`, `idempotencyKey = ${id}_manual_${scheduledFor_YYYYMMDD}`
  (note `_manual_` segment so it doesn't clash with cron's same-day key).
  Per Q2: after success, `nextRunDate` advances exactly as if cron ran it.

### 5.2 Idempotency at the API edge

`POST /generate-now` requires the `idempotency-key` header (existing
`server/src/middleware/idempotency.ts` if present, else the documents
service's pattern). Returning the same response for a replay is necessary
because the cron's idempotency key won't catch a manual replay.

---

## 6. Frontend

### 6.1 Folder layout (6-layer split, ≤250 LOC per file)

```
src/features/recurring/
├── recurring.types.ts                     (existing, 55 LOC — extend)
├── recurring.constants.ts                 (existing, 36 LOC — extend with FREQUENCIES, statuses)
├── recurring.service.ts                   (existing, 99 LOC — split if >250)
│   └── for now keep flat; if it grows past 250 split into:
│       ├── crud.service.ts
│       └── runs.service.ts
├── recurring.css                          (existing)
├── pages/
│   ├── RecurringListPage.tsx              (existing 198 LOC; refactor to import card from components/)
│   ├── RecurringDetailPage.tsx            (NEW, target ~180 LOC)
│   └── RecurringFormPage.tsx              (NEW, target ~180 LOC — used by /new and /:id/edit)
├── components/
│   ├── RecurringCard.tsx                  (NEW, ~120 LOC; status chip, next-run, generated count)
│   ├── RecurringFormFields.tsx            (NEW, ~200 LOC; frequency segment + anchor day picker)
│   ├── TemplatePicker.tsx                 (NEW, ~150 LOC; reuses InvoicePicker if present)
│   ├── RecurringActions.tsx               (NEW, ~100 LOC; pause/resume/delete/generate-now buttons)
│   ├── RunHistoryList.tsx                 (NEW, ~140 LOC; list of last 10 runs)
│   ├── PauseConfirmSheet.tsx              (NEW, ~80 LOC)
│   └── GenerateNowConfirmSheet.tsx        (NEW, ~80 LOC)
├── hooks/
│   ├── useRecurringList.ts                (NEW, ~80 LOC; React Query, cacheReads:true)
│   ├── useRecurringDetail.ts              (NEW, ~80 LOC)
│   ├── useRecurringRuns.ts                (NEW, ~60 LOC)
│   └── useRecurringMutations.ts           (NEW, ~150 LOC; create/update/pause/resume/delete/generate-now)
└── __tests__/
    ├── recurring.service.test.ts
    └── dates.test.ts                      (mirror of server-side date helpers)
```

### 6.2 Reuse existing invoice form components

`RecurringFormPage` does NOT re-implement an invoice editor. The form only
captures schedule metadata — frequency, anchor day, dates, three toggles,
template picker. The template picker opens a list of existing SAVED
documents (reuse `src/features/invoices/components/InvoicePicker.tsx` if
present, else build a thin wrapper around the existing invoices list query).

The "Set as Recurring" entry point on `InvoiceDetailPage` opens a bottom
sheet pre-filled with `templateDocumentId` — sheet body is `RecurringFormFields`.

### 6.3 Offline rules (strict adherence to `.claude/rules/OFFLINE_RULES.md`)

- All API calls go through `api()` from `@/lib/api` (no raw fetch).
- All mutations carry `entityType: 'recurring'`, `entityLabel: schedule.name ?? party.name`.
- `useRecurringList` uses `cacheReads: true` (list is safe — same-business data only).
- `useRecurringRuns` does NOT cache (run history can be large; not safe-to-cache PII surface).
- `generateNow` mutation is **blocked client-side when offline** with tooltip
  `t.generationRequiresInternet` — must not enter the offline queue (a queued
  generate-now would re-fire on reconnect with a stale idempotency window).
- All mutation success handlers tolerate `{}` return: invalidate query +
  show "Saved — will sync when online" if `!navigator.onLine`.

### 6.4 4 UI states per page

`RecurringListPage` (already partially done) and the new `RecurringDetailPage`,
`RecurringFormPage`, `RunHistoryList` each render: loading skeleton, error
banner with retry, empty state with CTA, success/list state. Form has its
own validation-error sub-state.

---

## 7. Date math — edge cases

Existing helpers in `server/src/services/recurring/dates.ts` are mostly
correct. Required fixes / additions:

| Case | Current behaviour | Required |
|---|---|---|
| MONTHLY anchor=31 | Schema caps `dayOfMonth ≤ 28`, so impossible | Keep cap. UI shows "Max: 28th". |
| MONTHLY anchor=28 in Feb | Lands on Feb 28 (correct) | OK. Add unit test. |
| QUARTERLY anchor=28, current=Jan 31 | `setMonth(+3)` from Jan 31 = May 1 (rolls over because Feb has no 31), then snaps to 28 → Apr 28? No: setMonth then snap is on the rolled month. Risky. | Replace impl with: `next = new Date(Date.UTC(y, m+step, Math.min(dayOfMonth, daysInMonth(y,m+step))))`. Add explicit day-of-month set instead of relying on JS Date arithmetic. |
| WEEKLY across DST | IST has no DST | Safe. |
| Cron tick at IST midnight, schedule at IST midnight | `nextRunDate <= now` always true on first tick after midnight | Add 1-min grace by using `<= now` directly (IST Date stored as UTC 18:30). |
| Leap year on YEARLY anchor | `setFullYear(+1)` from Feb 29, 2024 → Feb 29, 2025 (invalid → rolls to Mar 1) | Snap with `Math.min(dayOfMonth, lastDay)` after year bump. Current code does this. Add unit test for Feb-29 → Feb-28. |
| IST midnight boundary | Date ops use local timezone in current code (`getMonth`, `getDate`). For IST users this is fine if server runs in IST or always works in UTC then renders IST. **Issue:** mixing `getDate()` (local) with `setUTCHours(0,0,0,0)` (UTC) introduces a 5:30h skew bug. | Convert all helpers to use UTC throughout, OR use a `parseIstDate` / `toIstStartOfDay` helper. Current pattern in repo: dates are stored in UTC and IST-displayed at the edge. Standardise on UTC inside the helper. PR1/PR2 must include unit tests for IST 23:30 and 00:30 cases. |
| DAILY frequency | Not yet supported by `calculateNextRunDate` | Add `case 'DAILY': next.setDate(next.getDate() + 1)`. Update Zod `FREQUENCIES` to include `'DAILY'`. |

---

## 8. PR breakdown

Six PRs in dependency order. Each carries its own acceptance + tests.

### PR1 — Schema migration + types (~6 files)
- `server/prisma/migrations/20260507000000_recurring_phase1/migration.sql`
- `server/prisma/schema.prisma` (extend RecurringInvoice + add RecurringInvoiceRun + back-relations on Business + Document)
- `server/src/schemas/recurring.schemas.ts` (add `name`, `autoPaymentLink`, `autoReminder` to create; add `DAILY` to enum; new `pauseSchema`, `resumeSchema` no-op; new `runsListSchema`)
- `src/features/recurring/recurring.types.ts` (extend types; add `RecurringRun`)
- `src/features/recurring/recurring.constants.ts` (add `DAILY`)
- AC: `prisma migrate deploy` clean on staging; `prisma generate` succeeds; `tsc` clean.

### PR2 — Backend service + cron + race-safe claim (~8 files)
- `server/src/services/recurring/claim.ts` (NEW)
- `server/src/services/recurring/generation.ts` (rewrite to use claim + run row + autoSend/link/reminder hooks + GSTIN mismatch detector)
- `server/src/services/recurring/dates.ts` (UTC-fix + DAILY)
- `server/src/services/recurring/crud.ts` (write `createdBy`, `updatedBy`, `name`, three auto-flags; mark template `Document.isRecurring=true` in same tx)
- `server/src/services/recurring/runs.ts` (NEW — list + cleanup helpers)
- `server/src/services/document.service.ts` (block delete when `isRecurring`)
- `server/src/lib/cron-scheduler.ts` (register `*/15 * * * *` recurring job)
- `server/src/jobs/run-recurring-generator.ts` (NEW manual CLI; mirror of `run-ptp-evaluator.ts`)
- AC: unit tests for all date cases (§7); curl create→cron-tick→GET runs shows SUCCESS; second tick same day shows SKIPPED (duplicate idempotencyKey); two parallel manual triggers produce one document.

### PR3 — API routes + permissions (~5 files)
- `server/src/routes/recurring.ts` (add pause/resume/generate-now/runs; switch PUT → PATCH semantics; switch perms to `recurring.manage` / `.view` / `.pause`)
- `server/src/services/admin/permissions.constants.ts` (or wherever perms keys live — add `recurring.*`)
- `server/src/services/admin/permissions.defaults.ts` (role mapping per PRD §10.2)
- AC: curl matrix from PRD §14 backend block all green; 401, 403, 404, 422, 409 cases match; idempotency-key replay returns same response.

### PR4 — Frontend list + detail (~10 files)
- `src/features/recurring/pages/RecurringDetailPage.tsx` (NEW)
- `src/features/recurring/pages/RecurringListPage.tsx` (refactor — extract card)
- `src/features/recurring/components/RecurringCard.tsx` (NEW)
- `src/features/recurring/components/RecurringActions.tsx` (NEW)
- `src/features/recurring/components/RunHistoryList.tsx` (NEW)
- `src/features/recurring/components/PauseConfirmSheet.tsx` (NEW)
- `src/features/recurring/hooks/useRecurringList.ts` / `useRecurringDetail.ts` / `useRecurringRuns.ts` / `useRecurringMutations.ts` (NEW)
- AC: 4 UI states screenshotted on list + detail at 320 / 375; pause/resume work offline (queued) and online.

### PR5 — Frontend form + composer + entry points (~7 files)
- `src/features/recurring/pages/RecurringFormPage.tsx` (NEW)
- `src/features/recurring/components/RecurringFormFields.tsx` (NEW)
- `src/features/recurring/components/TemplatePicker.tsx` (NEW)
- `src/features/recurring/components/GenerateNowConfirmSheet.tsx` (NEW)
- `src/features/invoices/InvoiceDetailPage.tsx` (add "Set as Recurring" kebab item — opens form pre-filled)
- `src/features/invoices/InvoicesListPage.tsx` (add "Auto-Generated" filter pill — `recurringInvoiceId IS NOT NULL`)
- AC: create flow end-to-end; offline-create queues; `generate-now` button disabled offline; form validates endDate > startDate; screenshots at 320/375.

### PR6 — Polish + i18n + telemetry + cleanup job (~6 files)
- `src/hooks/useLanguage.ts` (add all new translation keys from PRD §13, English + Hindi)
- `src/components/dashboard/TodaysCashFlow.tsx` (or wherever today-strip lives — add Recurring stat)
- Banner component for `recurring.run.failed` on `RecurringListPage`
- Email template `server/src/lib/email-templates/recurring-failure.ts` (NEW)
- Server analytics events wired in `generation.ts` and `crud.ts` (use existing analytics util)
- Nightly cleanup cron entry: delete `RecurringInvoiceRun` rows older than 90 days
- AC: language toggle shows Hindi everywhere; failure email lands in test inbox; cleanup deletes >90d rows.

---

## 9. Open risks

1. **GSTIN/tax-rate snapshot drift (Phase 1 design choice).** Long-running
   schedules (Priya retainers) will silently emit invoices with stale GST if a
   rate revision happens. Mitigation: mismatch detector + dashboard banner
   (PR2). Phase 2: recompute behind feature flag.
2. **Template document deletion / soft-delete.** `Document.isRecurring = true`
   blocks hard delete, but the soft-delete trio still flips `isDeleted=true`
   silently (current document service likely doesn't check `isRecurring`).
   Audit `services/document.service.ts` and `services/soft-delete/*.ts` in PR2.
3. **Party hard-delete.** `Document.partyId` has `onDelete: Restrict`, which
   protects template + generated documents. But if party is soft-deleted
   (`isDeleted=true`), the schedule will continue generating invoices for a
   "deleted" party. Decide: skip generation when `party.isDeleted` and log
   `warning='party_deleted'`, or proceed. Recommendation: **skip + log**.
4. **Schedule endDate falls between two runs.** Already handled in §3.3 step
   3e (flip to COMPLETED if `nextRunDate > endDate` after bump). Resume path
   also handles it (§5.1). Add explicit AC test in PR3.
5. **Razorpay outage during autoPaymentLink.** SUCCESS_PARTIAL pattern is
   fine, but the user must have a clear way to "retry payment link" from
   the review queue. Consider an action button on generated invoice detail
   when `recurringRun.warning === 'paymentLink_failed'`. Add to PR6.
6. **Multi-pod cron drift.** With `FOR UPDATE SKIP LOCKED` claim + 15-min
   schedule, two pods are safe. **But** node-cron is in-process — every pod
   runs the cron. Verify deployment topology: if HisaabPro runs >1 web pod,
   we either accept the safe-claim semantics, or move cron to a single
   leader-elected worker. Confirm with infra before PR2 ships to prod.
7. **Idempotency key collision after timezone change.** Key uses
   `scheduledFor.toISOString().slice(0,10)` — UTC date. If a business
   later changes country (out of scope per PRD §15 risk #11), keys may
   collide near the IST/UTC boundary. Acceptable for Phase 1 (single TZ).
8. **`createdBy` nullable on existing rows.** Current `crud.ts` ignores
   `_userId`; until PR2 backfills new schedules with `createdBy`, audit
   reports may show NULL. Acceptable — feature is pre-launch.
9. **"Generate Now" race vs cron.** If user clicks generate-now at 14:59
   and cron tick fires at 15:00, both target the same `scheduledFor`. The
   distinct `_manual_` segment in the manual idempotency key means BOTH
   succeed (two invoices). Decision: make `generate-now` **first claim
   the row** via the same UPDATE … RETURNING pattern (set `claimedAt = now`),
   ensuring cron skips it for 5 minutes. Document in PR3 implementation note.
10. **Reminder enrollment for cancelled invoices.** If user voids a
    generated invoice (Document.status=CANCELLED) but `autoReminder=true`
    already enrolled it, the reminder cadence will keep firing. The
    existing reminder service should already filter on `status != 'CANCELLED'`
    — verify in PR2.

---

*End of architecture document.*
