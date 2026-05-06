# PRD — Recurring Invoices
**Version:** 1.0  
**Date:** 2026-05-06  
**Author:** Product (drafted by scope-writer agent)  
**Status:** Draft — awaiting architect sign-off  
**Feature gate:** `recurringInvoices` (already wired in `server/src/routes/recurring.ts`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Personas & Pain](#2-personas--pain)
3. [In-Scope vs Out-of-Scope](#3-in-scope-vs-out-of-scope)
4. [User Journeys](#4-user-journeys)
5. [Information Architecture](#5-information-architecture)
6. [Domain Model](#6-domain-model)
7. [State Machine](#7-state-machine)
8. [Edge Cases & Failure Modes](#8-edge-cases--failure-modes)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Settings & Permissions](#10-settings--permissions)
11. [Notifications](#11-notifications)
12. [Telemetry](#12-telemetry)
13. [Internationalization](#13-internationalization)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Risks & Mitigations](#15-risks--mitigations)
16. [Open Questions](#16-open-questions)

---

## 1. Executive Summary

### Problem Statement

Indian MSMEs issue the same invoice to the same party every week, month, or quarter — monthly rent, distributor replenishment orders, retainer fees. Today, every issuance is a manual copy-paste from the previous invoice. A single missed cycle means lost revenue recognition and late payment follow-up. For Raju (micro retailer) this is error-prone; for Amit (multi-location distributor) it is a staffing cost.

### Solution

Allow a user to designate any existing saved invoice as a **recurring template**. The system clones that template on a configured cadence (weekly / monthly / quarterly / yearly), assigns the next invoice number from the active series, optionally auto-shares via WhatsApp or email, optionally creates a Razorpay payment link, and optionally enrolls the generated invoice in the Payments Hub auto-reminder cadence. The user gets a review queue so they can inspect, edit, or void any generated invoice before acting on it.

### KPIs

| Metric | Baseline | 6-Month Target |
|---|---|---|
| Recurring schedules created per active business | 0 | ≥ 1.5 |
| Manual re-invoicing time saved (min/cycle) | ~8 min | < 1 min |
| Payment link auto-creation rate on recurring runs | — | ≥ 40 % |
| Support tickets tagged "forgot to invoice" | baseline | −60 % |

---

## 2. Personas & Pain

### 2.1 Raju — Micro Retailer (₹1–5 L/month, 0–1 staff)

**What hurts today:** Raju sells flour, sugar, and oil to the same 12 local kirana stores every Monday. He either re-types or WhatsApp-copies last week's invoice. One mis-typed quantity causes a dispute two weeks later. He has no staff to delegate this.

**What Recurring Invoices unlocks:** A single setup creates 52 identical invoices/year without Raju touching the app. WhatsApp auto-share means the buyer gets the PDF on Monday morning without Raju waking up early. `recurring.run.success` fires a push notification so he knows it happened.

**Sensitivity:** Raju cannot tolerate a "double send" — if two copies of the same invoice arrive it causes confusion with his buyers. Idempotency is non-negotiable.

---

### 2.2 Priya — Growing Wholesaler (₹5–25 L/month, 2–5 staff)

**What hurts today:** Priya has a retainer agreement with 6 corporate clients — fixed monthly fee, GST applicable. One of her salespersons generates these manually on the 1st of every month but sometimes forgets or is on leave, causing a 2–3 day delay that stretches payment cycles.

**What Recurring Invoices unlocks:** Scheduled generation on the 1st of each month, with a payment link auto-created and enrolled in the 7-day auto-reminder cadence, means Priya's DSO drops without manual intervention. Her salesperson gets a "review queue" notification to spot-check before the link goes live.

**Sensitivity:** Priya's clients are GST-registered; the template must carry the correct HSN/SAC and tax rates. If a GST rate changes mid-contract, she needs to be alerted rather than silently generating wrong-GST invoices.

---

### 2.3 Amit — Multi-Location Distributor (₹25 L–2 Cr/month, 5–20 staff)

**What hurts today:** Amit's team manages 40+ recurring supply relationships. Monthly invoicing takes a full day for two staff. Missed invoices to large retailers mean missed payment cycles — each slip costs ₹15,000–₹50,000 in deferred cash. Different staff members use inconsistent invoice templates for the same party.

**What Recurring Invoices unlocks:** Per-party templates locked to the correct items, rates, and template (letterhead). Centralised schedule management. RBAC so the owner can grant "manage recurring" rights to an accounts executive while restricting "pause" to senior staff. Run-failure email digest goes to owner so oversight is maintained without micromanaging.

**Sensitivity:** Amit uses custom invoice number series per branch. The generation job must pick the correct series per document type. FY rollover (April 1) must not reset mid-year series mid-contract.

---

## 3. In-Scope vs Out-of-Scope

### In-Scope (this PRD / Phase 1 implementation)

- **Schedule CRUD:** Create, read, update, pause, resume, cancel a recurring schedule.
- **Frequencies:** WEEKLY (anchor to a day-of-week), MONTHLY (anchor to a day-of-month, 1–28), QUARTERLY, YEARLY.
- **Template clone:** Deep-clone of a SAVED document including all line items, additional charges, tax fields, notes, terms, shipping address, transport fields.
- **Document number assignment:** Via existing `generateNextNumber()` in `server/src/services/document-number.service.ts`. Uses the active series for the document type.
- **Auto-share (autoSend):** If `autoSend = true`, dispatch WhatsApp share for the generated invoice immediately after generation. Channel: WhatsApp first, fallback to in-app notification if party has no phone.
- **Payment link auto-creation:** Optional flag `autoPaymentLink`. If set, create a `PaymentLink` record via existing `server/src/services/payment/` layer after generation.
- **Payments Hub reminder enrollment:** Optional flag `autoReminder`. If set, enroll the generated invoice in the business's `ReminderConfig` auto-reminder cadence.
- **Generated-invoice review queue:** A filterable list of invoices generated by recurring schedules (filter: `recurringInvoiceId IS NOT NULL`). User can open, edit, share, or void each.
- **Pause / Resume transitions:** Owner or authorised staff can pause/resume. Paused schedules skip run dates silently (no backfill).
- **Run log:** `RecurringInvoiceRun` table records each generation attempt — success, skipped, failed — with error reason. Retained 90 days.
- **Failure notification:** In-app banner + email to business owner on generation failure.
- **State machine:** DRAFT → ACTIVE → PAUSED → COMPLETED → CANCELLED (see Section 7).
- **RBAC:** Three new permissions: `recurring.view`, `recurring.manage`, `recurring.pause`.
- **Idempotency:** Each generation attempt carries an idempotency key `{recurringId}_{date_YYYYMMDD}`. Duplicate runs within the same UTC day are a no-op.
- **Mobile UI:** 375px primary, 320px minimum. All interactions reachable with one thumb.
- **i18n:** English + Hindi for all user-visible strings.
- **Offline behaviour:** Schedule edits queue via the offline mutation system. Generation runs server-side only — never triggered from the client offline.

### Out-of-Scope (deferred)

| Item | Reason |
|---|---|
| **E-invoice (IRN) auto-generation** | NIC API reliability is ≤ 97 %. Auto-IRN on a recurring run risks silent failures that invalidate the invoice legally. Deferred to Phase 2 with a manual IRN-trigger button on the generated invoice. |
| **Recurring purchase orders / credit notes** | Only Sale Invoice type in Phase 1. The schema `type` field is already in place for future expansion. |
| **Pro-rata first invoice** | If the schedule starts mid-month, no pro-rated amount calculation. The template amount clones verbatim. |
| **Dynamic line-item pricing** | Items are cloned at the price recorded in the template. Live party-pricing lookup on generation is deferred. |
| **Multi-currency recurring** | ExchangeRate model exists but recurring generation will enforce template currency = INR only in Phase 1. |
| **Recurring credit notes** | Out of scope. |
| **Approval workflow before auto-share** | Complex; deferred. Users can turn off autoSend and use the review queue instead. |
| **SMS auto-share channel** | WhatsApp only in Phase 1. SMS is a `ReminderChannel` enum value but the recurring layer will not use it. |
| **Calendar / scheduling UI** | No visual calendar of upcoming runs. List view only. |
| **Bulk pause / resume** | One schedule at a time. |
| **GSTIN change detection on party** | Alert only; no auto-recompute. Deferred to Phase 2. |
| **Accounting journal entry on generation** | JournalEntry for recurring-generated invoices follows the same post path as manual invoices; no special recurring journal needed. Confirmed in scope but handled by existing document creation path, not this PRD. |

---

## 4. User Journeys

### Journey 1 — Create a Recurring Schedule

**Actor:** Priya (Owner or accounts executive with `recurring.manage`)  
**Entry point:** Invoices list → "Recurring" tab → "+ New Schedule" button

1. Priya opens an existing saved invoice (e.g., INV-2526-014 for client "Apex Corp").
2. She taps the kebab menu on that invoice → "Set as Recurring".
   - Alternatively: Recurring tab → "+ New Schedule" → selects a template invoice from a searchable picker.
3. **Schedule drawer opens.** Fields:
   - Template invoice: pre-filled if entering from invoice detail, or searchable list.
   - Frequency: WEEKLY / MONTHLY / QUARTERLY / YEARLY (segmented control).
   - Anchor day: if WEEKLY → "Every [Monday ▾]"; if MONTHLY/QUARTERLY/YEARLY → "On day [1▾] of the month" (1–28, capped at 28 to avoid month-length edge cases).
   - Start date: date picker, default = tomorrow.
   - End date: optional date picker. "Never" is the default (no end date).
   - Auto-share (toggle): "Send to party via WhatsApp when generated". Default OFF.
   - Auto payment link (toggle): "Create Razorpay payment link". Default OFF. Requires `payments.manage` permission; greyed out with tooltip if missing.
   - Auto reminder (toggle): "Enroll in reminder cadence". Only visible if `autoPaymentLink` is ON. Default OFF.
4. Priya taps "Create Schedule".
5. System validates:
   - Template invoice exists and is SAVED/SHARED status.
   - Start date >= today.
   - End date (if set) > start date.
   - Party on template invoice has a phone number if autoSend is ON (warning, not block).
6. `POST /api/recurring` fires. On success: drawer closes, list refreshes, success toast: "Schedule created. First invoice on [date]."
7. The schedule appears in the Recurring list with status chip "Active" and "Next: [date]".

**Error paths:**
- Template invoice not found or not SAVED: "Template not available. Save the invoice first." (400)
- End date before start date: "End date must be after start date." (inline, 400)
- Network offline: mutation queued; toast: "Saved offline — will create when reconnected."
- Party has no phone + autoSend ON: warning toast (non-blocking): "Party has no phone number. Auto-share will be skipped."

---

### Journey 2 — Edit a Schedule

**Actor:** Priya or accounts executive with `recurring.manage`  
**Entry point:** Recurring list → tap schedule card → Edit icon

1. Priya taps a schedule card. Card expands or navigates to a detail sheet.
2. She taps "Edit".
3. Same drawer opens, pre-populated. She changes frequency from MONTHLY to QUARTERLY.
4. A warning banner appears: "Changing frequency will recalculate the next run date. Current queued run on [old date] will be skipped."
5. She saves. `PUT /api/recurring/:id` fires.
6. `nextRunDate` is recalculated from `now` using the new frequency + anchor day.
7. Toast: "Schedule updated. Next invoice on [new date]."

**What cannot be changed:**
- Template invoice (templateDocumentId). Changing the template requires deleting and re-creating the schedule. This is intentional — historical generated invoices must trace back to a stable template.
- Party (derived from template). Party changes require a new schedule.

**Error paths:**
- Trying to edit a COMPLETED schedule: "This schedule has ended and cannot be changed." (403-level validation)
- Offline: queued mutation.

---

### Journey 3 — Pause and Resume

**Actor:** Amit's accounts manager with `recurring.pause`  
**Entry point:** Recurring list → schedule card kebab menu → "Pause"

**Pause:**
1. User taps "Pause".
2. Confirmation bottom sheet: "Pause this schedule? No invoices will be generated until you resume. Scheduled runs during the pause will be skipped." → "Pause" / "Cancel".
3. `PUT /api/recurring/:id { status: "PAUSED" }` fires.
4. Schedule card status chip changes to "Paused". `nextRunDate` is preserved (not cleared).
5. Toast: "Schedule paused."

**Resume:**
1. User taps "Resume" on a PAUSED schedule card.
2. No confirmation required (non-destructive).
3. `PUT /api/recurring/:id { status: "ACTIVE" }` fires.
4. Server recalculates `nextRunDate` from `now` + frequency (does NOT backfill missed runs).
5. Toast: "Schedule resumed. Next invoice on [new date]."
6. Status chip returns to "Active".

**Error paths:**
- Resuming a COMPLETED schedule: "This schedule has ended." (blocked server-side, 422)
- Network failure: offline toast + queue.

---

### Journey 4 — Generated Invoice Review Queue

**Actor:** Raju checking that Monday's auto-invoice went out correctly  
**Entry point:** Dashboard "Recurring" banner → or Invoices list → filter "Auto-Generated"

1. After the cron job runs, in-app banner appears: "3 invoices generated today. Review →"
2. User taps the banner or navigates to Invoices list with the "Auto-Generated" filter pill active.
3. List shows only invoices where `recurringInvoiceId IS NOT NULL`, ordered newest-first.
4. Each card shows: invoice number, party name, amount, generation date, and a "Recurring" badge.
5. User taps an invoice card → InvoiceDetailPage (existing). The detail page shows a "Generated from recurring schedule" banner with a link to the parent schedule.
6. User can:
   - Share the invoice (WhatsApp / email) — normal flow.
   - Edit the invoice — normal flow (un-links it from the recurring badge silently, does not affect schedule).
   - Void the invoice — normal flow (marks as CANCELLED; does not affect schedule; schedule will generate the next one on next run date).
   - Create a payment link — normal flow.
7. No action required. Review is optional. The invoice is already SAVED and appears in the normal Invoices list.

**Error paths:**
- Empty filter: "No auto-generated invoices yet. Schedules run automatically based on your set dates."

---

### Journey 5 — Convert Recurring Invoice to One-Off

**Actor:** Amit's salesperson who needs to issue a special one-time invoice for the same party, based on a recurring template, but with different quantities.

**Entry point:** Recurring list → schedule card → "Generate Now" (manual trigger) → opens draft

1. User taps "Generate Now" on a schedule card (only visible when schedule is ACTIVE and `recurring.manage` permission present).
2. Confirmation: "Generate an invoice now? This will count as an early run. Next auto-run will still occur on [scheduled date]."
   - Note: "Generate Now" generates one invoice immediately using the template, then advances `nextRunDate` normally. It does NOT cancel the next scheduled run.
3. After generation, the new invoice opens in InvoiceDetailPage in SAVED status.
4. User taps "Edit" → modifies quantities → saves.
5. The edited invoice is now a standalone SAVED invoice. The `recurringInvoiceId` FK remains (for traceability) but the schedule is not affected.
6. The user can also tap "Convert to One-Off" from the invoice detail. This NULLs `recurringInvoiceId` and removes the "Recurring" badge. The schedule continues normally.

**What "Convert to One-Off" does NOT do:**
- Does not cancel the schedule.
- Does not change the next run date.
- Does not change any amounts on the invoice.

---

## 5. Information Architecture

### Decision: Sub-tab under Invoices, not a top-level nav item

**Rationale:**

Recurring Invoices are not a peer of Invoices — they are a scheduling layer on top of invoices. Giving them a top-level nav item would imply they are as fundamental as Parties or Products, which they are not. The primary user intent is still "manage invoices"; recurring is a power feature.

The existing implementation already places Recurring at `/recurring` as a separate route, accessed via "Recurring" text link in the Invoices header. This PRD endorses that decision and extends it.

**Navigation path:**
```
Bottom tab: Invoices
  → Header: [All] [Recurring ▸]
  → Tapping "Recurring" navigates to /recurring (RecurringListPage)
  
  RecurringListPage:
    → Filter pills: All | Active | Paused | Completed
    → Action bar: [Generate Due ↺] [+ New Schedule]
    → Schedule card list
    → Tapping a card: RecurringDetailPage (new, to be built)
    
  RecurringDetailPage:
    → Schedule info (party, frequency, next run)
    → Run history (last 10 runs from RecurringInvoiceRun)
    → Generated invoices list (last 10)
    → Actions: Edit | Pause/Resume | Delete
```

**Entry point from Invoice Detail (existing invoice → set as recurring):**
```
InvoiceDetailPage
  → Kebab menu → "Set as Recurring"
  → Opens RecurringCreateDrawer (bottom sheet) pre-filled with templateDocumentId
```

**Review queue entry point:**
```
Dashboard → Today's cash flow strip → "Recurring" stat (new)
  → Links to /invoices?filter=auto-generated

InvoicesPage
  → Filter pills: existing pills + "Auto-Generated" pill
  → Filters on recurringInvoiceId IS NOT NULL
```

---

## 6. Domain Model

### 6.1 Existing model: `RecurringInvoice` (schema.prisma lines 1695–1721)

Current fields are sufficient for Phase 1 scheduling. The following **additions** are required:

```prisma
model RecurringInvoice {
  // --- existing fields (unchanged) ---
  id                 String    @id @default(cuid())
  businessId         String
  templateDocumentId String
  partyId            String
  frequency          String    // WEEKLY | MONTHLY | QUARTERLY | YEARLY
  startDate          DateTime
  endDate            DateTime?
  nextRunDate        DateTime
  dayOfMonth         Int?      // 1–28
  dayOfWeek          Int?      // 0–6 (0 = Sunday)
  autoSend           Boolean   @default(false)
  status             String    @default("ACTIVE") // ACTIVE | PAUSED | COMPLETED | CANCELLED | DRAFT
  generatedCount     Int       @default(0)
  lastGeneratedAt    DateTime?
  isDeleted          Boolean   @default(false)
  deletedAt          DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  // --- NEW fields ---
  name               String?   @db.VarChar(120)   // User-assigned schedule name, e.g. "Monthly — Apex Corp"
  autoPaymentLink    Boolean   @default(false)     // Create PaymentLink after generation
  autoReminder       Boolean   @default(false)     // Enroll in ReminderConfig cadence after generation
  lastFailureReason  String?   @db.VarChar(500)    // Most recent run failure message
  cancelledAt        DateTime?                      // When status → CANCELLED
  cancelledBy        String?                        // userId who cancelled
  createdBy          String                         // userId who created the schedule
  updatedBy          String?                        // userId of last editor

  // --- existing relations ---
  business  Business   @relation(fields: [businessId], references: [id], onDelete: Cascade)
  documents Document[]

  // --- NEW relation ---
  runs      RecurringInvoiceRun[]

  @@index([businessId, status])
  @@index([nextRunDate, status])
  @@index([businessId, isDeleted])
  @@index([businessId, partyId])       // new — party-scoped lookups
}
```

### 6.2 New model: `RecurringInvoiceItem` — NOT needed for Phase 1

Line items live on the template `Document`. The generation job clones `DocumentLineItem` records from the template at run time. No separate `RecurringInvoiceItem` table is required. If the user wants to change line items, they edit the template invoice.

### 6.3 New model: `RecurringInvoiceRun`

```prisma
/// Audit log of every generation attempt for a recurring schedule.
/// Retained for 90 days. Used for the run history tab and failure notifications.
model RecurringInvoiceRun {
  id                 String    @id @default(cuid())
  recurringInvoiceId String
  businessId         String
  scheduledFor       DateTime  // The date this run was supposed to generate for
  ranAt              DateTime  // When generation was attempted
  status             String    // SUCCESS | FAILED | SKIPPED
  generatedDocumentId String?  // Set if status = SUCCESS
  idempotencyKey     String    @unique // "{recurringId}_{scheduledFor_YYYYMMDD}"
  errorMessage       String?   @db.VarChar(500)
  paymentLinkId      String?   // Set if autoPaymentLink was true and link was created
  retryCount         Int       @default(0)
  createdAt          DateTime  @default(now())

  recurringInvoice RecurringInvoice @relation(fields: [recurringInvoiceId], references: [id], onDelete: Cascade)
  business         Business         @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([recurringInvoiceId, ranAt])
  @@index([businessId, status])
  @@index([scheduledFor, status])
}
```

### 6.4 Relationship Cardinality

```
Business ──< RecurringInvoice ──< RecurringInvoiceRun
Business ──< Document (templateDocument)
RecurringInvoice >── Document (templateDocument, N:1)
RecurringInvoice ──< Document (generatedInvoices, 1:N via recurringInvoiceId FK)
RecurringInvoiceRun >── Document (generatedDocument, N:1, nullable)
RecurringInvoiceRun >── PaymentLink (paymentLinkId, N:1, nullable)
```

### 6.5 Files touched by domain model changes

- `server/prisma/schema.prisma` — add `name`, `autoPaymentLink`, `autoReminder`, `lastFailureReason`, `cancelledAt`, `cancelledBy`, `createdBy`, `updatedBy` fields to `RecurringInvoice`; add `RecurringInvoiceRun` model; add `Business.recurringRuns` back-relation.
- `server/src/schemas/recurring.schemas.ts` — extend create/update schemas for new fields.
- `server/src/services/recurring/crud.ts` — pass `createdBy`, `name`, `autoPaymentLink`, `autoReminder`.
- `server/src/services/recurring/generation.ts` — write `RecurringInvoiceRun` record; call payment link service if `autoPaymentLink`; call reminder enrollment if `autoReminder`; enforce idempotency key.
- `src/features/recurring/recurring.types.ts` — extend `RecurringInvoice` interface.

---

## 7. State Machine

### States

| State | Description |
|---|---|
| `DRAFT` | Schedule created but not yet activated. Reserved for future use (approval workflows). Not user-visible in Phase 1; create flow goes directly to ACTIVE. |
| `ACTIVE` | Schedule is running. Generation job picks it up when `nextRunDate <= now`. |
| `PAUSED` | User-initiated pause. Generation job ignores it. `nextRunDate` is preserved. |
| `COMPLETED` | End date reached, or user cancelled a schedule that had already generated invoices (soft-close). No further generation. |
| `CANCELLED` | User explicitly cancelled a schedule that had zero generated invoices (hard delete equivalent, but kept for audit). In practice, `deleteRecurring` hard-deletes if `generatedCount === 0`. |

### Transitions

```
                    ┌─────────────────────────────────────────────────────┐
                    │                                                     │
         create()   ▼   resume()         endDate hit OR user cancels     │
  ──────────► DRAFT → ACTIVE ──────────────────────────────────► COMPLETED
                    │    ▲                                                 │
                    │    │ resume()                                        │
               pause()  │                                                 │
                    │    │                                                 │
                    ▼    │                                                 │
                  PAUSED ──────────── endDate hit while paused ──────────►
                    │
              (zero docs generated)
                    │
               delete()
                    ▼
               CANCELLED (hard delete in DB)
```

### Transition Triggers & Guards

| From | To | Trigger | Guard |
|---|---|---|---|
| — | ACTIVE | `POST /api/recurring` (create) | Template must be SAVED/SHARED; startDate >= today |
| ACTIVE | PAUSED | `PUT /api/recurring/:id { status: "PAUSED" }` | Permission: `recurring.pause` |
| PAUSED | ACTIVE | `PUT /api/recurring/:id { status: "ACTIVE" }` | Permission: `recurring.pause`; schedule must not be COMPLETED |
| ACTIVE | COMPLETED | Cron job: nextRunDate > endDate after advancing | Automatic |
| PAUSED | COMPLETED | User cancels a PAUSED schedule with docs generated | `generatedCount > 0` |
| ACTIVE | COMPLETED | User cancels an ACTIVE schedule with docs generated | `generatedCount > 0` |
| ACTIVE | CANCELLED | `DELETE /api/recurring/:id` where `generatedCount === 0` | Hard delete; no CANCELLED record retained (already wiped) |
| COMPLETED | — | Any edit | Blocked: "Schedule has ended" |
| CANCELLED | — | Any action | Record does not exist (hard deleted) |

### Invalid Transitions (server must reject)

- COMPLETED → ACTIVE (cannot re-open a completed schedule)
- COMPLETED → PAUSED (no-op / error)
- Any transition on `isDeleted = true` records

---

## 8. Edge Cases & Failure Modes

| # | Scenario | Handling |
|---|---|---|
| 1 | **Clock skew** — cron fires 30 seconds before midnight UTC, `nextRunDate` is exactly midnight | Use `nextRunDate <= now` (lte) with a 5-minute grace window: `nextRunDate <= now + 5min`. This means runs firing slightly early still process correctly. |
| 2 | **Party deleted between schedule creation and run** | Template document has `onDelete: Restrict` on `partyId`. Party cannot be deleted while template invoice references it. Generation will fail with `Party not found` only if the party was force-deleted by an admin. `RecurringInvoiceRun` logs `FAILED`, owner notified. Schedule moves to ACTIVE (retries next cycle). |
| 3 | **Party GSTIN changed mid-cycle** | Tax fields are frozen in the template document. Generated invoice carries the old GSTIN snapshot. The system does NOT auto-update. A `recurring.party_gstin_mismatch` event is emitted (see Telemetry). Banner on the schedule detail: "Party GSTIN has changed. Review template." |
| 4 | **Tax rate changed mid-cycle (GST rate revision by government)** | Same as #3 — template is a frozen snapshot. Generated invoices carry old rates. Admin alert on dashboard if `TaxCategory.rate` differs from template line-item rate. User must update template manually. |
| 5 | **Billing address changed on party after schedule created** | `shippingAddressId` is copied from template at schedule creation. If the template's address is deleted, `shippingAddressId` becomes NULL (SetNull cascade). Generated invoice will have no shipping address. `RecurringInvoiceRun` logs `SUCCESS` with a `warning: "shippingAddress missing"` flag. Review queue shows a caution icon. |
| 6 | **Invoice number sequence collision** | `generateNextNumber()` runs inside the same `$transaction` as document creation with a `FOR UPDATE` lock on the sequence row. Collision is prevented by the lock. If the lock times out (>5s), the run is logged as FAILED and retried on the next cron tick. |
| 7 | **Generation skipped due to server outage** | No backfill. Paused schedules and ACTIVE schedules that missed their window will have `nextRunDate` in the past. On restart, the cron job picks up all schedules where `nextRunDate <= now`. Each is generated once (idempotency key = `{recurringId}_{scheduledFor_YYYYMMDD}` based on the original due date). If the outage spanned multiple cycles, only the most recent missed cycle is generated; older missed cycles are logged as SKIPPED with reason `"outage_catchup_limit"`. Limit: max 1 catch-up per schedule per cron run. |
| 8 | **Business pauses subscription / plan downgrades** | `requireFeature('recurringInvoices')` middleware blocks API access. Active schedules in the DB are not deleted. When subscription is restored, schedules resume from the next due date (no backfill for the paused period). |
| 9 | **End date hit while schedule is PAUSED** | On resume, server recalculates `nextRunDate` from `now`. If the resulting `nextRunDate > endDate`, the schedule transitions to COMPLETED immediately on resume without generating any invoice. Toast: "Schedule has reached its end date and has been completed." |
| 10 | **Monthly on 31st** | `dayOfMonth` is capped at 28 in the schema and UI. This eliminates the 28/29/30/31 problem entirely. February 28 is the maximum. This is a deliberate product decision, not a technical limitation — document it in the UI ("Max: 28th"). |
| 11 | **DST (Daylight Saving Time)** | HisaabPro operates in IST (UTC+5:30). IST does not observe DST. All dates stored and computed in UTC. No DST handling needed. |
| 12 | **Indian public holidays** | Phase 1 does not skip public holidays. If generation falls on a holiday, the invoice is generated normally. This matches the behaviour expected by most MSME billing cycles. |
| 13 | **Duplicate generation (idempotency key collision)** | `RecurringInvoiceRun.idempotencyKey` has a `@unique` constraint. A second attempt for the same `{recurringId}_{YYYYMMDD}` will throw a unique constraint violation, which is caught and logged as SKIPPED (not FAILED). No duplicate invoice is created. |
| 14 | **Over-generation prevention (cron runs twice)** | The cron job should be configured with `concurrencyPolicy: Forbid` (Kubernetes) or equivalent. Additionally, the idempotency key (case #13) provides a last-resort guard even if two cron instances fire simultaneously. |
| 15 | **autoSend party has no phone** | If party.phone is NULL and `autoSend = true`: invoice is generated successfully, WhatsApp share is skipped, `RecurringInvoiceRun` is logged as SUCCESS with `warning: "autoSend_skipped_no_phone"`. Owner notified via in-app banner. |
| 16 | **autoPaymentLink: Razorpay API failure** | Payment link creation is attempted after document creation, in a separate (non-atomic) step. If Razorpay returns a non-2xx: invoice is already created (SAVED), `RecurringInvoiceRun.paymentLinkId` is NULL, run is logged as `SUCCESS_PARTIAL` with `warning: "paymentLink_failed"`. Owner can manually create the link from the review queue. |
| 17 | **Template document deleted after schedule is created** | `Document` has no FK cascade to `RecurringInvoice` (the FK is on `Document.recurringInvoiceId`, not vice versa). `templateDocumentId` is a plain string FK — if the template is hard-deleted, generation will fail with `Template not found`. Run logged as FAILED, schedule remains ACTIVE, owner notified. Users should not be able to delete a document that is a recurring template. The delete endpoint for `Document` must check `isRecurring` flag and block deletion with message: "This invoice is used as a recurring template. Cancel the schedule first." |
| 18 | **FY rollover (April 1)** | `generateNextNumber()` already handles FY rollover by computing `financialYear` from `documentDate` at generation time. The recurring job passes `documentDate = generationDate`, so invoices generated on or after April 1 automatically get the new FY number series. No special handling needed. |

---

## 9. Non-Functional Requirements

### 9.1 Performance Budget

| Operation | Target | Notes |
|---|---|---|
| Single invoice generation (clone + number + DB write) | < 2s | Includes `$transaction` with line item cloning |
| Batch generation (500 schedules) | < 10 min wall time | Processed sequentially in current `generation.ts`; parallelism is a Phase 2 optimisation |
| `GET /api/recurring` list (20 items) | < 400ms p95 | Indexed on `businessId + status` |
| `GET /api/recurring/:id` | < 200ms p95 | Single row + count |
| `POST /api/recurring` (create) | < 500ms p95 | Validates template + creates |

### 9.2 Cron Job

- **Frequency:** Every 15 minutes (not every minute — 15-min resolution is sufficient for daily/weekly/monthly schedules and avoids unnecessary DB load).
- **Scope:** Global — processes ALL businesses' due schedules in one run.
- **Concurrency:** `concurrencyPolicy: Forbid`. Only one instance at a time.
- **Retry:** On per-schedule failure, the schedule is not retried within the same cron tick. It will be retried on the next tick (15 minutes later). Max 3 retries logged per idempotency key before alerting as permanently failed.
- **Location:** Server-side only. The client UI `POST /api/recurring/generate` endpoint (manual trigger) scoped to the authenticated business is kept for testing/manual runs.

### 9.3 Backfill Behaviour After Outage

- On restart after outage, the cron processes all schedules with `nextRunDate <= now`.
- Per schedule: generate exactly one invoice for the most recent missed due date (idempotency key = `{recurringId}_{originalDueDate_YYYYMMDD}`).
- All earlier missed cycles: logged as SKIPPED with reason `"outage_catchup_limit_1"`.
- This is a deliberate choice. Generating all missed invoices risks flooding the party with multiple invoices and confusing the payment reminders system.

### 9.4 Offline Behaviour

| Action | Offline Behaviour |
|---|---|
| Create/edit/pause/resume schedule | Queued via `api()` offline mutation system. `entityType: 'recurring'`, `entityLabel: schedule.name or party name`. |
| Manual "Generate Now" | Blocked in UI when offline. Button disabled with tooltip: "Generation requires an internet connection." |
| View list (RecurringListPage) | Shows cached list if available (`cacheReads: true` on `GET /api/recurring`). |
| View run history | Not cached. Shows "Connect to load run history" if offline. |

### 9.5 Database Indexes (new)

Already in schema for `RecurringInvoice`:
- `(businessId, status)` — list filtered by status
- `(nextRunDate, status)` — cron query
- `(businessId, isDeleted)` — soft-delete filter

New for `RecurringInvoice`:
- `(businessId, partyId)` — filter by party (added above)

New for `RecurringInvoiceRun`:
- `(recurringInvoiceId, ranAt)` — run history tab
- `(businessId, status)` — failure count aggregation
- `(scheduledFor, status)` — outage catchup query

### 9.6 Data Retention

- `RecurringInvoiceRun` records: 90 days. A nightly cleanup job deletes runs older than 90 days.
- Soft-deleted `RecurringInvoice` records: 30 days, then hard-delete.
- Generated `Document` records: follow standard document retention policy (7 years per Indian GST rules).

---

## 10. Settings & Permissions

### 10.1 Permission Keys

| Permission Key | Description |
|---|---|
| `recurring.view` | View recurring schedule list and detail |
| `recurring.manage` | Create, edit, delete schedules; trigger manual generation |
| `recurring.pause` | Pause and resume schedules (less powerful than manage) |

### 10.2 Default Role Mapping

| Role | `recurring.view` | `recurring.manage` | `recurring.pause` |
|---|---|---|---|
| Owner | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ |
| Accountant | ✓ | ✓ | ✓ |
| Salesperson | ✓ | — | — |
| Viewer | ✓ | — | — |

Notes:
- The "Set as Recurring" entry point on InvoiceDetailPage is hidden from users without `recurring.manage`.
- The "Auto payment link" toggle within the create drawer requires `payments.manage` additionally. If the user has `recurring.manage` but not `payments.manage`, the toggle is visible but disabled with tooltip: "You need payments access to enable this."

### 10.3 Subscription Gate

- Feature flag: `recurringInvoices` (already in `requireFeature` middleware).
- Available on: Pro and Business plans. Not available on Free.
- If a business downgrades: API returns 403 with `{ code: "FEATURE_NOT_AVAILABLE", message: "Upgrade to Pro to use Recurring Invoices" }`. Schedules are preserved in DB but cannot be triggered.

---

## 11. Notifications

### 11.1 In-App Notifications

| Event | Recipient | Notification Type | Copy |
|---|---|---|---|
| `recurring.run.success` (daily digest) | Business owner | Banner on Dashboard | "N invoices generated today. Review →" |
| `recurring.run.failed` | Business owner | Persistent banner on Recurring list | "Schedule '[name]' failed to generate. [reason]. Tap to view →" |
| `recurring.run.success` + `autoSend` | Business owner | Toast | "[Invoice #] sent to [party] via WhatsApp." |
| `recurring.run.success` + `autoPaymentLink` | Business owner | Toast | "Payment link created for [Invoice #]." |
| `recurring.party_gstin_mismatch` | Business owner | Badge on schedule card | "Party GSTIN changed. Review template." |
| Schedule reaching `endDate` | Business owner | In-app toast | "Recurring schedule '[name]' has completed." |

### 11.2 Email Notifications

| Event | Recipient | Frequency |
|---|---|---|
| `recurring.run.failed` | Business owner's registered email | Immediate (per failure, deduplicated per day per schedule) |
| Daily digest: N invoices generated | Business owner | Once daily at 9 AM IST if any runs succeeded that day |
| Weekly digest: schedule summary | Business owner | Optional, Off by default. Configurable in Settings → Notifications. |

### 11.3 Owner vs Salesperson

| Notification | Owner | Salesperson |
|---|---|---|
| Run failures | Yes (email + in-app) | No |
| Success digest | Yes (in-app banner) | No (salesperson does not need operational visibility) |
| Review queue badge | Yes | Yes (if salesperson has `recurring.view`) |
| GSTIN mismatch | Yes | No |

---

## 12. Telemetry

All events fire via the existing analytics/event pipeline. Each event includes `businessId`, `userId`, `timestamp`, and the fields listed below.

| Event Name | Fired When | Additional Fields |
|---|---|---|
| `recurring.created` | User creates a new schedule | `frequency`, `autoSend`, `autoPaymentLink`, `autoReminder`, `hasEndDate` |
| `recurring.updated` | User edits a schedule | `fieldsChanged: string[]` (list of changed keys) |
| `recurring.paused` | Schedule transitions to PAUSED | `daysUntilNextRun`, `generatedCount` |
| `recurring.resumed` | Schedule transitions to ACTIVE | `pausedDurationDays` |
| `recurring.cancelled` | Schedule is deleted or completed by user | `generatedCount`, `reason: "user_cancel" | "end_date_reached"` |
| `recurring.run.success` | Cron job successfully generates an invoice | `recurringId`, `generatedDocumentId`, `frequency`, `autoSend`, `autoPaymentLink`, `retryCount` |
| `recurring.run.failed` | Cron job fails to generate | `recurringId`, `errorCode`, `retryCount` |
| `recurring.run.skipped` | Idempotency key collision or outage catchup limit | `recurringId`, `reason` |
| `recurring.invoice.opened` | User opens a generated invoice from the review queue | `recurringId`, `documentId`, `daysAfterGeneration` |
| `recurring.payment_link.tapped` | User taps the payment link from a recurring-generated invoice | `recurringId`, `documentId`, `paymentLinkId` |
| `recurring.manual_generate.triggered` | User taps "Generate Now" | `recurringId` |

---

## 13. Internationalization

All user-visible strings must be keyed in the `useLanguage` hook translation map. English and Hindi required for Phase 1. Keys follow the existing `t.` camelCase convention used throughout the codebase (e.g., `src/hooks/useLanguage.ts`).

### New Translation Keys Required

| Key | English | Hindi |
|---|---|---|
| `t.recurringInvoices` | Recurring Invoices | आवर्ती बिल |
| `t.newSchedule` | New Schedule | नया शेड्यूल |
| `t.createFirstSchedule` | Create First Schedule | पहला शेड्यूल बनाएं |
| `t.noRecurringSchedules` | No recurring schedules yet | अभी कोई आवर्ती शेड्यूल नहीं |
| `t.recurringEmptyDesc` | Set up a schedule to generate invoices automatically | स्वचालित बिल बनाने के लिए शेड्यूल सेट करें |
| `t.loadingSchedules` | Loading schedules… | शेड्यूल लोड हो रहे हैं… |
| `t.couldNotLoadRecurring` | Couldn't load schedules | शेड्यूल लोड नहीं हुए |
| `t.generateDue` | Generate Due | देय बिल बनाएं |
| `t.generatingDue` | Generating… | बन रहा है… |
| `t.manuallyGenerateDue` | Manually generate due invoices | मैन्युअल रूप से देय बिल बनाएं |
| `t.scheduleCount` | schedule | शेड्यूल |
| `t.schedulesCount` | schedules | शेड्यूल |
| `t.filterByStatusGroup` | Filter by status | स्थिति से फ़िल्टर करें |
| `t.autoSendLabel` | Auto-send via WhatsApp | WhatsApp से स्वतः भेजें |
| `t.autoPaymentLinkLabel` | Create payment link automatically | भुगतान लिंक स्वतः बनाएं |
| `t.autoReminderLabel` | Enroll in reminder cadence | रिमाइंडर क्रम में जोड़ें |
| `t.scheduleCreated` | Schedule created. First invoice on {date}. | शेड्यूल बना। पहला बिल {date} को। |
| `t.scheduleUpdated` | Schedule updated. Next invoice on {date}. | शेड्यूल अपडेट। अगला बिल {date} को। |
| `t.schedulePaused` | Schedule paused. | शेड्यूल रुका। |
| `t.scheduleResumed` | Schedule resumed. Next invoice on {date}. | शेड्यूल चालू। अगला बिल {date} को। |
| `t.scheduleCompleted` | Recurring schedule '{name}' has completed. | आवर्ती शेड्यूल '{name}' पूरा हो गया। |
| `t.pauseScheduleConfirm` | Pause this schedule? No invoices will be generated until you resume. | यह शेड्यूल रोकें? फिर से शुरू होने तक कोई बिल नहीं बनेगा। |
| `t.pauseScheduleRunsSkipped` | Scheduled runs during the pause will be skipped. | रुके हुए दौरान के शेड्यूल चूक जाएंगे। |
| `t.generateNowConfirm` | Generate an invoice now? This will count as an early run. | अभी बिल बनाएं? यह एक शुरुआती रन होगा। |
| `t.generateNowScheduleNote` | Next auto-run will still occur on {date}. | अगला स्वतः-रन {date} को होगा। |
| `t.cannotEditCompleted` | This schedule has ended and cannot be changed. | यह शेड्यूल समाप्त हो गया है और बदला नहीं जा सकता। |
| `t.cannotDeleteTemplate` | This invoice is used as a recurring template. Cancel the schedule first. | यह बिल एक आवर्ती टेम्पलेट के रूप में उपयोग हो रहा है। पहले शेड्यूल रद्द करें। |
| `t.noPhoneAutoSendWarning` | Party has no phone number. Auto-share will be skipped. | पार्टी का फोन नंबर नहीं है। स्वतः-शेयर छोड़ा जाएगा। |
| `t.runFailed` | Schedule '{name}' failed to generate. | शेड्यूल '{name}' बनाने में विफल। |
| `t.reviewGeneratedInvoices` | {n} invoices generated today. Review | आज {n} बिल बने। देखें |
| `t.generatedFromRecurring` | Generated from recurring schedule | आवर्ती शेड्यूल से बना |
| `t.convertToOneOff` | Convert to One-Off | एकल बिल में बदलें |
| `t.setAsRecurring` | Set as Recurring | आवर्ती सेट करें |
| `t.partyGstinChanged` | Party GSTIN has changed. Review template. | पार्टी का GSTIN बदल गया। टेम्पलेट जांचें। |
| `t.autoGeneratedFilter` | Auto-Generated | स्वतः-निर्मित |
| `t.runHistory` | Run History | रन इतिहास |
| `t.maxDayOfMonth` | Max: 28th | अधिकतम: 28 तारीख |
| `t.generationRequiresInternet` | Generation requires an internet connection. | बिल बनाने के लिए इंटरनेट जरूरी है। |
| `t.scheduleNamePlaceholder` | e.g. Monthly — Apex Corp | उदा. मासिक — Apex Corp |
| `t.frequencyLabel` | Frequency | आवृत्ति |
| `t.anchorDayLabel` | On day | दिन पर |
| `t.everyLabel` | Every | हर |
| `t.startDateLabel` | Start Date | शुरू तारीख |
| `t.endDateLabel` | End Date (optional) | समाप्ति तारीख (वैकल्पिक) |
| `t.neverLabel` | Never | कभी नहीं |
| `t.nextRunLabel` | Next run | अगला रन |
| `t.lastRunLabel` | Last run | पिछला रन |
| `t.totalGeneratedLabel` | Total generated | कुल बने |

---

## 14. Acceptance Criteria

Each item is binary and independently testable. QA signs off when all items are checked.

### Backend / API

- [ ] `curl -X POST /api/recurring` with valid payload → `{ success: true, data: { id, status: "ACTIVE", nextRunDate } }` (201)
- [ ] `curl -X POST /api/recurring` without auth token → 401
- [ ] `curl -X POST /api/recurring` with `templateDocumentId` pointing to a DRAFT document → 400 with `{ error: { code: "VALIDATION_ERROR" } }`
- [ ] `curl -X POST /api/recurring` with `endDate` before `startDate` → 400
- [ ] `curl -X GET /api/recurring` → paginated list with `{ items, pagination }` (200)
- [ ] `curl -X GET /api/recurring?status=PAUSED` → only PAUSED schedules returned
- [ ] `curl -X GET /api/recurring/:id` → full schedule object including `_count.documents`
- [ ] `curl -X GET /api/recurring/:id` for another business's schedule → 404
- [ ] `curl -X PUT /api/recurring/:id { status: "PAUSED" }` → schedule transitions to PAUSED, `nextRunDate` unchanged
- [ ] `curl -X PUT /api/recurring/:id { status: "ACTIVE" }` on PAUSED → transitions to ACTIVE, `nextRunDate` recalculated from now
- [ ] `curl -X PUT /api/recurring/:id { frequency: "QUARTERLY" }` → `nextRunDate` recalculated
- [ ] `curl -X PUT /api/recurring/:id` on COMPLETED schedule → 422
- [ ] `curl -X DELETE /api/recurring/:id` where `generatedCount === 0` → hard delete, `{ deleted: true, hard: true }`
- [ ] `curl -X DELETE /api/recurring/:id` where `generatedCount > 0` → soft-complete, `{ deleted: false, completed: true }`
- [ ] `POST /api/recurring/generate` → generates all due invoices for the authenticated business
- [ ] Generation creates a `RecurringInvoiceRun` record with `status: "SUCCESS"` and correct `idempotencyKey`
- [ ] Calling `POST /api/recurring/generate` twice on the same day → second call produces no duplicate (idempotency key returns SKIPPED, not duplicate document)
- [ ] Schedule with `endDate` in the past after advancing `nextRunDate` → `status` auto-sets to COMPLETED
- [ ] Schedule with `autoSend: true` and party with no phone → run succeeds, `warning: "autoSend_skipped_no_phone"` in run log
- [ ] `DELETE /api/documents/:id` where document is a recurring template → 409 with `{ error: { message: "This invoice is used as a recurring template..." } }`
- [ ] User without `recurring.manage` calling `POST /api/recurring` → 403
- [ ] User without `recurring.pause` calling `PUT /api/recurring/:id { status: "PAUSED" }` → 403
- [ ] Business on Free plan calling `POST /api/recurring` → 403 with `FEATURE_NOT_AVAILABLE`

### Date Logic

- [ ] MONTHLY schedule with `dayOfMonth: 28` run on Feb: `nextRunDate` = Feb 28 (not March 3)
- [ ] QUARTERLY schedule run on Jan 31: `nextRunDate` = April 28 (capped at 28, not May 1)
- [ ] WEEKLY schedule `dayOfWeek: 1` (Monday): `nextRunDate` always falls on a Monday
- [ ] YEARLY schedule: `nextRunDate` advances by exactly 1 calendar year

### Frontend / UI

- [ ] RecurringListPage renders loading skeleton → error state → empty state → list with items (4 UI states)
- [ ] RecurringCreateDrawer opens from "+ New Schedule" button and from "Set as Recurring" on InvoiceDetailPage
- [ ] Frequency segmented control shows all 4 options; selecting WEEKLY shows day-of-week picker; selecting MONTHLY shows day-of-month picker (1–28)
- [ ] Create form: tapping "Create" while offline shows queued toast; schedule appears when reconnected
- [ ] RecurringCard shows: party name, frequency badge, status chip (Active/Paused/Completed), next run date, generated count
- [ ] Pause action shows confirmation bottom sheet; cancel dismisses without state change
- [ ] "Generate Now" button disabled when offline with tooltip text `t.generationRequiresInternet`
- [ ] InvoicesPage "Auto-Generated" filter pill shows only invoices with `recurringInvoiceId != null`
- [ ] Generated invoice detail page shows "Generated from recurring schedule" banner with link to schedule
- [ ] "Convert to One-Off" action on invoice detail removes the banner and does not affect the parent schedule
- [ ] Party GSTIN mismatch badge renders on schedule card when applicable
- [ ] All 375px layout: no horizontal overflow, no truncated CTAs
- [ ] All 320px layout: no horizontal overflow, all interactive elements reachable by thumb
- [ ] All new strings appear in both English and Hindi (toggle language in Settings)
- [ ] Screenshot: RecurringListPage loading ✓ · error ✓ · empty ✓ · list with 2+ items ✓
- [ ] Screenshot: RecurringCreateDrawer open with all fields visible at 375px ✓
- [ ] Screenshot: RecurringCard showing PAUSED status ✓
- [ ] Screenshot: Generated invoice detail with "Recurring" banner ✓

---

## 15. Risks & Mitigations

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Cron drift / missed runs** | Medium | High | 15-min cron frequency; `nextRunDate <= now` query catches any missed windows. Post-outage backfill limited to 1 catch-up per schedule. |
| 2 | **Duplicate invoice generation** | Low | Critical | Idempotency key `{recurringId}_{YYYYMMDD}` + DB unique constraint on `RecurringInvoiceRun`. `concurrencyPolicy: Forbid` on cron. |
| 3 | **Template invoice deleted mid-cycle** | Low | High | Block template deletion when `isRecurring` is true. Existing `Document.isRecurring` field (schema line 1884) must be set to `true` on schedule creation and cleared on schedule hard-delete. |
| 4 | **Party deletion mid-cycle** | Low | Medium | `Document.partyId` has `onDelete: Restrict` — party cannot be deleted while any document (including template) references it. |
| 5 | **Wrong tax on generated invoice** | Medium | High | Tax fields are snapshotted in the template. Add a `tax_rate_mismatch` detection check: on each generation, compare template line-item tax rates against current `TaxCategory.rate`. If mismatch detected, log a warning in `RecurringInvoiceRun` and surface on the schedule card. (Phase 1: warn only; Phase 2: block.) |
| 6 | **FY rollover number series** | Low | High | `generateNextNumber()` uses `documentDate` (= run date), not schedule creation date. Invoices generated on/after April 1 automatically use the new FY series. No intervention needed. Verify in acceptance criteria. |
| 7 | **autoPaymentLink Razorpay rate limits** | Medium | Medium | Payment link creation is outside the main `$transaction`. Failure is logged as `SUCCESS_PARTIAL`. User can create manually from review queue. Razorpay allows up to 1,000 links/minute — unlikely to be an issue for MSME scale. |
| 8 | **Over-generation after infrastructure scale-out** | Medium | Critical | `concurrencyPolicy: Forbid` + idempotency key are the two defences. Load-test the batch generation path before production launch. |
| 9 | **Performance degradation with large backlog** | Low | Medium | The `take: 500` limit in `generateDueInvoices()` already caps one cron run. Businesses with > 500 due schedules (unrealistic at MSME scale) will catch up over multiple cron ticks. |
| 10 | **User confusion: paused vs completed** | Medium | Low | Clear status chips, distinct colours (yellow = PAUSED, grey = COMPLETED), and tooltip text explaining each state. Empty-state copy distinguishes the two. |
| 11 | **GSTIN on generated invoice does not match party's current GSTIN** | High | High (compliance) | Detect mismatch on generation (compare `party.gstin` with `template.partyGstin`); surface warning. Phase 2: require template re-save before next generation. |
| 12 | **autoSend WhatsApp flood** | Low | Medium | Each generation produces one WhatsApp share per invoice. No bulk mechanism. Raju sending 20 invoices at once (manual "Generate Now" × 20) is blocked by the UI (one at a time). |

---

## 16. Open Questions

These must be resolved before the architect runs the technical design. A yes/no or short answer is sufficient for each.

---

**Q1. Should a paused schedule's missed run dates be backfilled on resume, or always dropped?**

Current PRD says: **dropped** (no backfill on resume). `nextRunDate` is recalculated from `now`.

- If YES (backfill): the architect must design a catch-up queue with careful dedup logic. Risk of invoice flood.
- If NO (drop, current design): simpler, safer. User expectation must be set clearly in the UI.

**Recommendation:** Drop. Confirm with Sawan.

---

**Q2. Should "Generate Now" advance the `nextRunDate` (consuming the next slot), or generate an extra invoice without affecting the schedule?**

Current PRD says: **advance** — "Generate Now" counts as the next scheduled run, so `nextRunDate` advances by one period after the manual trigger.

- If YES (advance / current design): fewer invoices overall. User who triggers early gets next auto-run at `nextRunDate + 1 period`.
- If NO (extra invoice, do not advance): `nextRunDate` unchanged. Could produce two invoices if user forgets they triggered manually and the auto-run also fires.

**Recommendation:** Advance. Confirm with Sawan.

---

**Q3. For autoSend, should the channel be limited to WhatsApp only (Phase 1), or should email be supported if the party has an email address?**

Current PRD says: **WhatsApp only** in Phase 1.

The `DocumentShareLog` and email share path already exist in `server/src/services/document/`. Adding email auto-share would be a small incremental change.

- If YES (add email): requires a party email field check and an email dispatch call in the generation path. The `ReminderChannel.EMAIL` enum value already exists.
- If NO (WhatsApp only): simpler. Users can email manually from the review queue.

**Recommendation:** WhatsApp only for Phase 1. Revisit in Phase 2 alongside SMS. Confirm with Sawan.

---

**Q4. Should `DAILY` frequency be included in Phase 1?**

Current PRD says: **No** — frequencies are WEEKLY, MONTHLY, QUARTERLY, YEARLY.

Daily recurring invoices are a real use case for Raju (e.g., daily milk delivery invoices). However, daily generation at scale (if a business has 100+ daily schedules) adds significant cron load and WhatsApp volume.

- If YES (add DAILY): add `DAILY` to the `FREQUENCIES` enum. No anchor day needed. Generation logic is trivial. WhatsApp rate limits become a concern above ~30 daily schedules.
- If NO (exclude): users needing daily invoices continue manually. Can be added in Phase 1.1.

**Recommendation:** Defer daily to Phase 1.1 unless Raju segment data shows strong demand. Confirm with Sawan.

---

**Q5. Should `RecurringInvoiceRun` records be visible to the user in the UI (run history tab), or backend-only for debugging?**

Current PRD says: **visible** — a "Run History" tab on the schedule detail page showing last 10 runs.

- If YES (user-visible): adds complexity to the RecurringDetailPage (new page to build). High value for Amit who needs operational oversight.
- If NO (backend-only): simpler. Failure notifications still surface via email/in-app banner. Raju does not need granular run logs.

**Recommendation:** Show last 10 runs in the detail page, but make it a collapsible "History" section rather than a full tab. Confirm with Sawan.

---

*End of PRD.*
