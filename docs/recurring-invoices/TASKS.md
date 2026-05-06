---
status: pending
feature: recurring-invoices-phase-1
created: 2026-05-06T19:19:00Z
approver: Sawan
---

# TASKS — Recurring Invoices Phase 1

Concrete PR breakdown with file paths, gates, and acceptance criteria. All 6 PRs inherit the design-plan approval from `ARCHITECTURE.md §8`.

---

## Summary Table

| PR # | Title | Gate | Agent | Estimated LOC |
|------|-------|------|-------|---------------|
| 1 | Schema migration + types | tsc clean | Backend | ~250 |
| 2 | Service + cron + claim | tsc clean + curl 200/404/422 + 2 idempotent runs = 1 invoice | Backend | ~650 |
| 3 | API routes + permissions | curl matrix (401/403/404/422/409) + idempotency replay | Backend | ~350 |
| 4 | Frontend list + detail | screenshots (4 states × 2 sizes) + tsc clean + console clean | Frontend | ~850 |
| 5 | Frontend form + entry points | screenshots (load/error/empty/success × 2 sizes) + offline queue demo | Frontend | ~650 |
| 6 | Polish + i18n + telemetry + cleanup | language toggle (en/hi) + failure email test + 90d cleanup deletes | Frontend | ~400 |

**Total estimates:** Backend ~1.25 KLOC + Frontend ~1.9 KLOC + migrations < 500 LOC.

---

## PR1 — Schema Migration + Types

**Scope:** Add new fields to `RecurringInvoice`, create `RecurringInvoiceRun` table, extend frontend types, add DAILY frequency to constants.

### Files Touched

| Path | Status | Purpose | Est. LOC |
|------|--------|---------|----------|
| `server/prisma/migrations/20260507000000_recurring_phase1/migration.sql` | NEW | DDL for additive columns + new `RecurringInvoiceRun` table + indexes | ~190 |
| `server/prisma/schema.prisma` | MODIFIED | Extend `RecurringInvoice` (8 new fields), add `RecurringInvoiceRun` model, back-relations on `Business` and `Document` | ~50 |
| `server/src/schemas/recurring.schemas.ts` | MODIFIED | Add `name`, `autoPaymentLink`, `autoReminder` to `createRecurringSchema`; add `DAILY` to `FREQUENCIES` enum; new `pauseSchema`, `resumeSchema`, `runsListSchema` | ~80 |
| `src/features/recurring/recurring.types.ts` | MODIFIED | Extend `RecurringInvoice` interface; add `RecurringRun` interface | ~40 |
| `src/features/recurring/recurring.constants.ts` | MODIFIED | Add `DAILY` to `FREQUENCIES` array; add status values `ACTIVE|PAUSED|COMPLETED` | ~15 |

### Acceptance Gates

- [ ] `npx prisma migrate deploy` runs clean on staging; no schema drift reported
- [ ] `npx prisma generate` succeeds; `@prisma/client` imports resolve
- [ ] `tsc --noEmit` clean across `server/` and `src/`
- [ ] `RecurringInvoiceRun` table exists with `@@unique(idempotencyKey)` constraint
- [ ] All new fields on `RecurringInvoice` are nullable or have defaults

### Dependencies

None. PR1 is the foundation.

---

## PR2 — Backend Service + Cron + Race-Safe Claim

**Scope:** Implement `RecurringInvoiceRun` cron generation with atomic claim, autoSend/autoPaymentLink/autoReminder hooks, GSTIN mismatch detection, date math fixes, and manual trigger path.

### Files Touched

| Path | Status | Purpose | Est. LOC |
|------|--------|---------|----------|
| `server/src/services/recurring/claim.ts` | NEW | Atomic `UPDATE ... FOR UPDATE SKIP LOCKED RETURNING` query; fetch + claim batch per worker | ~120 |
| `server/src/services/recurring/generation.ts` | MODIFIED | Rewrite per-schedule transaction: validate template → `INSERT RecurringInvoiceRun` → `generateNextNumber` → clone document + line items → update schedule → hook into autoSend/link/reminder; idempotency catch (P2002 → SKIPPED); failure handling | ~280 |
| `server/src/services/recurring/dates.ts` | MODIFIED | Fix UTC safety: replace `getMonth`/`setMonth` with explicit UTC math; add DAILY frequency case; add unit tests for Feb-28/Feb-29, month-end snapping, IST midnight edge cases | ~150 |
| `server/src/services/recurring/crud.ts` | MODIFIED | Write `createdBy`, `updatedBy`, `name`, `autoPaymentLink`, `autoReminder` in create/update; mark template `Document.isRecurring=true` in same tx on create; unset on delete | ~80 |
| `server/src/services/recurring/runs.ts` | NEW | Query + pagination helpers for run history; helper to cleanup runs older than 90 days | ~95 |
| `server/src/services/document.service.ts` | MODIFIED | Block hard-delete when `isRecurring = true`; return 409 with message "This invoice is used as a recurring template..." | ~25 |
| `server/src/lib/cron-scheduler.ts` | MODIFIED | Register `*/15 * * * *` (IST) entry calling `runRecurringGenerator()`; import + wire timezone | ~30 |
| `server/src/jobs/run-recurring-generator.ts` | NEW | Manual CLI export (mirror of `run-ptp-evaluator.ts`); for testing; wraps cron function | ~55 |

### Acceptance Gates

- [ ] `tsc --noEmit` clean
- [ ] Unit tests pass for all 8 date cases in `dates.test.ts`:
  - MONTHLY anchor 28 in Feb → Feb 28 (not rolled)
  - QUARTERLY from Jan 31 → Apr 28 (capped)
  - WEEKLY same day-of-week
  - YEARLY same date or capped (Feb 29 → Feb 28)
  - DAILY increments by 1
  - IST midnight boundary (no UTC skew)
  - Leap year forward/backward
- [ ] Manual curl test flow:
  1. `curl -X POST /api/recurring { templateDocumentId, frequency: "WEEKLY", startDate, endDate, autoSend: false }` → `{ status: 201, data: { id, status: "ACTIVE", nextRunDate } }`
  2. Trigger cron (manual: `node jobs/run-recurring-generator.ts` OR wait 15 min)
  3. `curl GET /api/recurring/:id/runs` → `{ items: [{ status: "SUCCESS", generatedDocumentId, idempotencyKey }] }`
  4. `curl GET /documents/:generatedDocumentId` → document exists with `recurringInvoiceId = schedule.id`, `status = "SAVED"`
- [ ] Calling manual generate twice in same day → first call creates run with status SUCCESS; second call returns run with status SKIPPED (unique constraint on `idempotencyKey`)
- [ ] Two parallel generate-now triggers (same schedule, seconds apart) → via atomic claim, one claims the row first, other's run is logged as SKIPPED
- [ ] Resume on PAUSED schedule → `nextRunDate` recalculated from now, not backfilled
- [ ] Schedule endDate passed → after generation advances nextRunDate past endDate, status auto-flips to COMPLETED
- [ ] Pause transition: `status = "PAUSED"`, `nextRunDate` unchanged
- [ ] Resume transition: `status = "ACTIVE"`, `nextRunDate` recalculated; if new nextRunDate > endDate, flip to COMPLETED immediately
- [ ] Template document marked `isRecurring=true` after schedule create; `isRecurring=false` after schedule hard-delete
- [ ] Attempting to delete a template document → 409 "This invoice is used as a recurring template..."
- [ ] autoSend with party.phone = null → run succeeds, warning logged as `"autoSend_skipped_no_phone"`, email/WhatsApp skipped
- [ ] GSTIN mismatch (party.gstin ≠ template.partyGstin) → run succeeds, warning = `"gstin_mismatch"`, event emitted, schedule banner shows "Party GSTIN changed"

### Dependencies

Requires PR1 (schema + migrations applied).

---

## PR3 — API Routes + Permissions

**Scope:** Add pause/resume/generate-now/runs endpoints, switch permission keys, validate idempotency headers on POST.

### Files Touched

| Path | Status | Purpose | Est. LOC |
|------|--------|---------|----------|
| `server/src/routes/recurring.ts` | MODIFIED | Replace/add: `POST /pause` (trigger pause), `POST /resume` (trigger resume + recalc), `POST /:id/generate-now` (manual generate), `GET /:id/runs` (run history paginated); switch all perms to `requirePermission('recurring.view/manage/pause')`; add idempotency-key validation middleware | ~200 |
| `server/src/services/admin/permissions.constants.ts` (or adjacent) | MODIFIED | Define `recurring.view`, `recurring.manage`, `recurring.pause` permission keys | ~20 |
| `server/src/services/admin/permissions.defaults.ts` (or adjacent) | MODIFIED | Map role → permissions: Owner/Admin/Accountant get all 3; Salesperson/Viewer get `.view` only | ~15 |

### Acceptance Gates

- [ ] `tsc --noEmit` clean
- [ ] curl matrix passes all cases from PRD §14 (Backend / API block):
  - `curl -X POST /api/recurring { valid }` → 201
  - `curl -X POST /api/recurring` (no auth) → 401
  - `curl -X POST /api/recurring { templateDocumentId: draft }` → 400
  - `curl -X GET /api/recurring` (no `recurring.view`) → 403
  - `curl -X POST /api/recurring/:id/pause` → 200 status=PAUSED
  - `curl -X POST /api/recurring/:id/resume` (COMPLETED) → 422
  - `curl -X DELETE /api/recurring/:id` (generatedCount=0) → 200 { hard: true }
  - `curl -X DELETE /api/recurring/:id` (generatedCount>0) → 200 { completed: true, hard: false }
  - `curl -X POST /api/recurring/:id/generate-now` (no idempotency-key) → 400
  - Replay same `idempotency-key` → same response (idempotent)
- [ ] Feature gate `requireFeature('recurringInvoices')` blocks Free plan with 403 + code `FEATURE_NOT_AVAILABLE`
- [ ] Pause/resume/generate-now transitions match PRD §7 (state machine)

### Dependencies

Requires PR2 (service layer).

---

## PR4 — Frontend List + Detail Pages

**Scope:** Build RecurringListPage (refactor), RecurringDetailPage (new), RecurringCard (new), RunHistoryList (new), pause/resume/delete confirm sheets.

### Files Touched

| Path | Status | Purpose | Est. LOC |
|------|--------|---------|----------|
| `src/features/recurring/pages/RecurringDetailPage.tsx` | NEW | Schedule detail: header with name/party/frequency, next-run card, status chip, generated-count stat, run history section (collapsible), action buttons | ~180 |
| `src/features/recurring/pages/RecurringListPage.tsx` | MODIFIED | Refactor to import RecurringCard; add status filter pills (All/Active/Paused/Completed); add "Generate Due" button; 4 UI states (loading skeleton, error with retry, empty with CTA, list) | ~150 |
| `src/features/recurring/components/RecurringCard.tsx` | NEW | Schedule card: party name, frequency badge, status chip (style by status), next-run label, generated count, kebab menu (edit/pause-or-resume/delete) | ~120 |
| `src/features/recurring/components/RecurringActions.tsx` | NEW | Buttons: Edit → navigate to form; Pause → show confirm sheet; Resume → call API; Delete → confirm + call API; Generate Now → show confirm sheet | ~100 |
| `src/features/recurring/components/RunHistoryList.tsx` | NEW | Paginated list of last 10 runs per schedule; columns: ranAt, status chip (SUCCESS/FAILED/SKIPPED), warning badge, generatedDocumentId link | ~140 |
| `src/features/recurring/components/PauseConfirmSheet.tsx` | NEW | Bottom sheet: "Pause this schedule? Runs during pause will be skipped." → [Cancel / Pause] | ~80 |
| `src/features/recurring/components/GenerateNowConfirmSheet.tsx` | NEW | Bottom sheet: "Generate now? Counts as early run. Next auto-run still [date]." → [Cancel / Generate] | ~80 |
| `src/features/recurring/hooks/useRecurringList.ts` | NEW | React Query: GET /api/recurring, cacheReads=true, pagination support | ~80 |
| `src/features/recurring/hooks/useRecurringDetail.ts` | NEW | React Query: GET /api/recurring/:id, includes _count.documents, _count.runs | ~75 |
| `src/features/recurring/hooks/useRecurringRuns.ts` | NEW | React Query: GET /api/recurring/:id/runs (cursor pagination, NOT cached — large surface, PII risk) | ~65 |
| `src/features/recurring/hooks/useRecurringMutations.ts` | NEW | Wrappers for pause/resume/delete/generate-now; pass entityType='recurring', entityLabel=schedule.name\|\|party.name; tolerate optimistic {} return | ~150 |

### Acceptance Gates

- [ ] `tsc --noEmit` clean; all imports resolve
- [ ] Console clean (no warnings, no unhandled errors)
- [ ] All files under 250 LOC per `.claude/CLAUDE.md`
- [ ] 4 UI states screenshotted on **RecurringListPage** at 375px and 320px:
  - Loading skeleton (≥1 card shape visible)
  - Error state (banner + retry button reachable by thumb)
  - Empty state (CTA button "Create First Schedule" reachable)
  - List with 2+ items (cards visible, no horizontal scroll)
- [ ] 4 UI states screenshotted on **RecurringDetailPage** (navigate from list):
  - Loading (skeleton of header + run history section)
  - Error (banner)
  - Schedule with 0 runs (empty run history)
  - Schedule with 3+ runs (last 10 displayed, paginated)
- [ ] All screenshots at 320px: no text truncation, all interactive elements thumb-reachable
- [ ] Pause action: sheet appears, cancel dismisses without change, tap Pause → API call → list refreshes → status chip updates to yellow "Paused"
- [ ] Resume action: on PAUSED card, tap Resume → API call → nextRunDate recalculated → chip back to green "Active"
- [ ] Generate-now button disabled with tooltip text when offline (checked via `navigator.onLine`)

### Dependencies

Requires PR3 (routes + perms).

---

## PR5 — Frontend Form + Entry Points

**Scope:** Build RecurringFormPage, RecurringFormFields (frequency + anchor day picker), TemplatePicker, integrate "Set as Recurring" into InvoiceDetailPage, add "Auto-Generated" filter pill to InvoicesListPage.

### Files Touched

| Path | Status | Purpose | Est. LOC |
|------|--------|---------|----------|
| `src/features/recurring/pages/RecurringFormPage.tsx` | NEW | Form wrapper: load existing schedule if edit mode (/:id/edit), otherwise new. Header, form fields, submit button. Offline: queued mutation toast. Validations (endDate > startDate). | ~180 |
| `src/features/recurring/components/RecurringFormFields.tsx` | NEW | Fieldset: template picker, frequency segment (DAILY/WEEKLY/MONTHLY/QUARTERLY/YEARLY), anchor day picker (conditional: WEEKLY → day-of-week dropdown 0-6; MONTHLY/QUARTERLY/YEARLY → day-of-month 1-28 capped), dates (startDate, endDate optional), name field, 3 toggles (autoSend, autoPaymentLink, autoReminder); validation errors inline. | ~200 |
| `src/features/recurring/components/TemplatePicker.tsx` | NEW | Searchable list of SAVED documents (type=INVOICE); taps open modal/drawer; returns templateDocumentId; fallback: text "No saved invoices yet." | ~150 |
| `src/features/invoices/InvoiceDetailPage.tsx` | MODIFIED | Kebab menu → add "Set as Recurring" item (visible only if `hasPermission('recurring.manage')`); taps open bottom sheet with RecurringFormFields pre-filled with templateDocumentId | ~40 |
| `src/features/invoices/InvoicesListPage.tsx` | MODIFIED | Add "Auto-Generated" filter pill (query: `recurringInvoiceId IS NOT NULL`); style with "Recurring" badge icon; integrate with existing filter state machine | ~30 |
| `src/features/recurring/hooks/useRecurringMutations.ts` | (extends PR4) | Add create mutation: POST /api/recurring with entityType='recurring', entityLabel; tolerate optimistic {} return | ~0 (already in PR4) |

### Acceptance Gates

- [ ] `tsc --noEmit` clean
- [ ] Console clean
- [ ] Create flow end-to-end: navigate to Invoices → pick a SAVED invoice → kebab → "Set as Recurring" → sheet opens with template pre-filled → fill frequency/dates → offline: toast "Saved offline — will create when reconnected" (queue visible in sync drawer later) → online: POST → toast "Schedule created. First invoice on [date]." → navigate back to Recurring list → new schedule visible
- [ ] Form validation: entering endDate before startDate → inline error message (non-blocking); tapping Create → error toast if still invalid
- [ ] Offline create + later edit: create offline (queued), reconnect, sheet closes, list updates. Tap to view → detail page loads. Edit again (change frequency) → another offline mutation queued.
- [ ] 4 UI states screenshotted at 375px and 320px:
  - Loading template picker (skeleton of list)
  - Error loading (banner)
  - Empty (no SAVED invoices)
  - Picker list with items
- [ ] Form at 320px: no horizontal scroll, all pickers/inputs reachable by thumb
- [ ] Day-of-month picker caps at 28; UI shows "Max: 28th" helper text
- [ ] "Auto-Generated" filter pill on invoice list filters correctly; badge shows on matching cards
- [ ] "Set as Recurring" entry point visible & clickable on existing invoice detail

### Dependencies

Requires PR4 (detail page + mutation hooks).

---

## PR6 — Polish + i18n + Telemetry + Cleanup Job

**Scope:** Add all translation keys (English + Hindi), wire analytics events, add failure email template, add "Recurring" stat to Dashboard, nightly cleanup cron job.

### Files Touched

| Path | Status | Purpose | Est. LOC |
|------|--------|---------|----------|
| `src/hooks/useLanguage.ts` | MODIFIED | Add 50+ translation keys from PRD §13 (t.recurringInvoices, t.newSchedule, t.scheduleCreated, t.pauseScheduleConfirm, etc.) with English + Hindi pairs | ~100 |
| `src/components/dashboard/TodaysCashFlow.tsx` (or current location) | MODIFIED | Add "Recurring" stat row (if any schedules active); tap → navigate to /recurring | ~30 |
| `src/features/recurring/pages/RecurringListPage.tsx` | (extends PR5) | Add failure banner: if any run has status=FAILED and retryCount ≥ 3, show persistent in-app banner "Schedule '[name]' failed. [reason]. Tap to retry →" with action button | ~50 |
| `src/features/recurring/hooks/useRecurringMutations.ts` | (extends PR4/5) | Wire analytics events: `recurring.created`, `recurring.updated`, `recurring.paused`, `recurring.resumed`, `recurring.cancelled`, `recurring.manual_generate.triggered` | ~0 (already in PR4) |
| `server/src/services/recurring/generation.ts` | (extends PR2) | Emit events after each run: `recurring.run.success` (frequency, autoSend, autoPaymentLink, retryCount), `recurring.run.failed` (errorCode, retryCount), `recurring.run.skipped` (reason), `recurring.party_gstin_mismatch` | ~50 |
| `server/src/lib/email-templates/recurring-failure.ts` | NEW | Email template for run failure: subject "Invoice generation failed", body lists schedule name, reason, link to detail page | ~60 |
| `server/src/services/recurring/runs.ts` | (extends PR2) | Add cleanup helper: `deleteRunsOlderThan(days: 90)` | ~25 |
| `server/src/lib/cron-scheduler.ts` | (extends PR2) | Add nightly cleanup cron: `0 3 * * *` (3 AM IST) → call `deleteRunsOlderThan(90)` | ~15 |

### Acceptance Gates

- [ ] `tsc --noEmit` clean
- [ ] Language toggle in Settings (if not already wired) → confirm all new strings appear in both EN and HI
- [ ] Created schedule → `recurring.created` event fires with fields (frequency, autoSend, autoPaymentLink, autoReminder, hasEndDate)
- [ ] Pause → `recurring.paused` event fires
- [ ] Resume → `recurring.resumed` event fires
- [ ] Manual "Generate Now" → `recurring.manual_generate.triggered` event fires
- [ ] Cron generates invoice → `recurring.run.success` event fires
- [ ] Cron fails to generate (e.g., template deleted) → `recurring.run.failed` + `recurring_failure` email sent to business owner (test inbox)
- [ ] Run history > 90 days old → deleted by nightly cleanup cron
- [ ] Dashboard TodaysCashFlow → if active schedules exist, "Recurring" stat shows count (e.g., "3 active") or "Get Started" CTA if 0
- [ ] Failure banner appears on RecurringListPage only when a recent failure exists; disappears after clearing (edit schedule / retry)
- [ ] Email template renders correctly with schedule name, reason, link

### Dependencies

Requires PR5 (frontend complete) + PR2 (backend events wired).

---

## Workflow Sequence

```
PR1 (schema) 
  ↓
PR2 (service + cron) [depends PR1]
  ↓
PR3 (API routes)     [depends PR2]
  ↓
PR4 (frontend list/detail) [depends PR3]
  ↓
PR5 (frontend form/entry)  [depends PR4]
  ↓
PR6 (i18n + analytics)     [depends PR5 + PR2]
```

Each PR must pass its acceptance gate **before** the next PR is opened.

---

## Cross-Cutting Notes

- **Offline behaviour:** All mutations queue via `api()` with `entityType='recurring'`. Manual "Generate Now" disabled client-side offline (no queue). List caches with `cacheReads: true`. Run history NOT cached.
- **Permissions:** New keys `recurring.view`, `recurring.manage`, `recurring.pause`. Check role mapping in PR3.
- **Error handling:** Idempotency key collisions return 200 SKIPPED (not error). Template deletion mid-cycle → 409. Party with no phone + autoSend → SUCCESS with warning.
- **Documentation:** Each PR links to the relevant PRD section (§ ref) and ARCHITECTURE section in commit message.

---

Estimated total effort: **~340 person-hours** for experienced full-stack engineer (scope-scaled to 6 PRs × ~55 LOC per feature element).

**Total lines of code (estimate):**
- Backend (migrations + service + routes): ~1,250 LOC
- Frontend (pages + components + hooks): ~1,900 LOC
- Tests + fixtures: ~300 LOC
- Configuration + cleanup: ~150 LOC
- **Grand total: ~3,600 LOC**
