# TASKS — Expenses Upgrade (Phase 3 #96)

> Proof-gated build plan. Each PR lists agent, proof gates, dependencies, blockedBy chains.
> Status: READY FOR BUILD (design plan approved 2026-05-07T12:45:00Z)

---

## Approval & Gating

- **Design Plan:** `/Users/sawanjaiswal/Projects/HisaabPro/.claude/design-plan-active.md` — status: approved
- **Scope:** `/Users/sawanjaiswal/Projects/HisaabPro/docs/SCOPE_expenses_upgrade.md`
- **Architecture:** `/Users/sawanjaiswal/Projects/HisaabPro/docs/ARCHITECTURE_expenses_upgrade.md`
- **Verifier gates:** Backend (tsc + curl matrix) → Frontend (screenshots + 320/375px) → QA
- **Postmortem trigger:** If QA rejects after Redo >1 pass, or Verifier >2 failures on same task

---

## PR1 — Schema Migrations (Database)

**Agent:** Database-Manager (Prisma migrations only)

**Description:** Add three migrations: (A) `status` + `recurringTemplateId` columns, create `RecurringExpenseTemplate` + `ExpenseBudget` tables. (B) Backfill `status='CONFIRMED'` (idempotent). (C) Assertion verifier (empty migration).

**Modified files:**
- `server/prisma/schema.prisma` — Add Expense columns + 2 new models (HIGH RISK PATH)
- `server/prisma/migrations/` — 3 new migration files

**Proof gates — BACKEND (Verifier):**
- [ ] `npx prisma migrate dev` completes cleanly (no drift)
- [ ] All Expense rows have `status='CONFIRMED'` after migration (select count where status is NULL = 0)
- [ ] RecurringExpenseTemplate table exists with correct columns
- [ ] ExpenseBudget table exists with correct columns

**Blockers:**
- None (foundation task)

**Blocked by:**
- Design plan approved (✓ 2026-05-07T12:45:00Z)

**Risk:** ALTER TABLE on Expense; mitigated by Postgres 14+ instant-add with DEFAULT in metadata.

**Merge to:** `feature/expenses-upgrade` (branch off master)

---

## PR2 — Service-Layer Status Filter Fix (Backend)

**Agent:** DudhHisaab-API-Builder

**Description:** Patch existing services to exclude PENDING_CONFIRMATION rows from aggregations. Add `status: 'CONFIRMED'` filter to `getExpenseSummary`, `listExpenses` (default), `export.service.ts`, `report-daybook.ts`.

**Modified files:**
- `server/src/services/expense.service.ts` — Lines 198, 154
- `server/src/services/export.service.ts` — Line 158
- `server/src/services/report/report-daybook.ts` — Line 122

**Proof gates — BACKEND (Verifier):**
- [ ] `tsc` clean (no new TS errors)
- [ ] `getExpenseSummary()` excludes PENDING rows (unit test: create PENDING, assert not in sum)
- [ ] Existing tests still pass (regression)
- [ ] `curl GET /api/expenses/summary` with PENDING expense in DB → amount does not include it

**Blockers:**
- PR1 must merge (schema migration)

**Blocked by:**
- PR1 proof gates passed

**Note:** P&L service reads from journal, not Expense; no journal entry is posted for PENDING rows, so P&L auto-skips them.

**Merge to:** `feature/expenses-upgrade`

---

## PR3 — Recurring Service + Scheduler (Backend)

**Agent:** DudhHisaab-API-Builder

**Description:** Implement `recurring.service.ts` (template CRUD + worker), `recurring.dates.ts` (pure date math), `pending.service.ts` (confirm/skip). Register daily 01:00 IST cron job in `cron-scheduler.ts`.

**New files:**
- `server/src/services/expense/recurring.service.ts` — Template CRUD, listTemplates, runRecurringExpensesWorker ≤ 240 LOC
- `server/src/services/expense/recurring.dates.ts` — Pure computeNextRunDate (DAILY/WEEKLY/MONTHLY/YEARLY) ≤ 80 LOC
- `server/src/services/expense/pending.service.ts` — confirmPending, skipPending, listPending ≤ 140 LOC
- `server/src/__tests__/integration/expense-recurring.test.ts` — Date math, worker idempotency ≤ 220 LOC

**Modified files:**
- `server/src/lib/cron-scheduler.ts` — Register `runRecurringExpensesWorker` daily 01:00 IST

**Proof gates — BACKEND (Verifier):**
- [ ] `tsc` clean
- [ ] Unit tests pass (date math: Jan 31 → Feb 28 clamp, Feb 29 in leap year, WEEKLY across timezones)
- [ ] Worker idempotency test: run twice same date → 1 PENDING row created, not 2
- [ ] `curl POST /api/expenses/templates` with valid body → 201 success, response includes `nextRunDate`
- [ ] `curl GET /api/expenses/pending` → returns PENDING_CONFIRMATION rows only for authenticated business
- [ ] `curl POST /api/expenses/:id/confirm` → expense status changes to CONFIRMED, 409 on second call (already confirmed)
- [ ] `curl POST /api/expenses/:id/skip` → expense soft-deleted (isDeleted=true), not in pending list

**Blockers:**
- PR1 + PR2 must merge (schema + service foundation)

**Blocked by:**
- PR1, PR2 proof gates passed

**Merge to:** `feature/expenses-upgrade`

---

## PR4 — Budget Service (Backend)

**Agent:** DudhHisaab-API-Builder

**Description:** Implement `budget.service.ts` (CRUD + usage aggregation), `budget.queries.ts` (spent calculation). Budget is advisory only (warn dialog, no block). Per-category + overall (null categoryId) budgets.

**New files:**
- `server/src/services/expense/budget.service.ts` — listBudgetsForMonth, upsertBudget, updateBudget, deleteBudget ≤ 200 LOC
- `server/src/services/expense/budget.queries.ts` — Helper for spent aggregation (CONFIRMED only) ≤ 80 LOC
- `server/src/__tests__/integration/expense-budget.test.ts` — Upsert idempotency, spent calculation, PENDING exclusion ≤ 180 LOC

**Proof gates — BACKEND (Verifier):**
- [ ] `tsc` clean
- [ ] Unit tests pass (upsert same month+category twice → 1 row updated, not 2; spent excludes PENDING)
- [ ] `curl POST /api/expenses/budgets` → 201 success
- [ ] `curl POST /api/expenses/budgets` same month+category → 200 upsert (idempotent)
- [ ] `curl GET /api/expenses/budgets?month=2026-05` → response includes spentAmount for each category matching CONFIRMED sum

**Blockers:**
- PR2 must merge (status filter foundation)

**Blocked by:**
- PR2 proof gates passed

**Merge to:** `feature/expenses-upgrade`

---

## PR5 — OCR Service (Backend)

**Agent:** DudhHisaab-API-Builder

**Description:** Implement `ocr.service.ts` using Anthropic `claude-haiku-4-5-20251001` Vision API. Base64 JSON body, 5 MB limit, no persistence. Graceful fallback when API key missing.

**New files:**
- `server/src/services/expense/ocr.service.ts` — ocrReceipt, loadImageForModel (storage swap point) ≤ 180 LOC
- `server/src/schemas/expense-ocr.schemas.ts` — Zod schema for { imageBase64, mimeType } ≤ 60 LOC
- `server/src/__tests__/integration/expense-ocr.test.ts` — Mock Anthropic SDK, test size guard, missing key, malformed JSON ≤ 150 LOC

**Modified files:**
- `server/src/lib/env.ts` — Add `ANTHROPIC_API_KEY` (optional), `EXPENSE_OCR_MODEL` (default haiku), `EXPENSE_OCR_MAX_BYTES` (default 5242880)

**Proof gates — BACKEND (Verifier):**
- [ ] `tsc` clean
- [ ] Unit tests pass (mock Anthropic, verify size check, missing key path)
- [ ] `curl POST /api/expenses/ocr` with valid JPEG base64 → 200 { success: true, data: { amount, date, vendor, confidence } }
- [ ] `curl POST /api/expenses/ocr` with image > 5 MB → 400 { success: false, error: { code: 'IMAGE_TOO_LARGE' } }
- [ ] `ANTHROPIC_API_KEY` unset → 200 { success: false, error: { code: 'OCR_UNAVAILABLE' } } (no 500)
- [ ] Verify haiku model used in logs (not sonnet)

**Blockers:**
- `ANTHROPIC_API_KEY` must be confirmed in env (Sawan / DevOps)

**Blocked by:**
- PR1 proof gates passed (no hard dependency, independent service)

**Merge to:** `feature/expenses-upgrade`

---

## PR6 — Trend Service (Backend)

**Agent:** DudhHisaab-API-Builder

**Description:** Implement `trend.service.ts` with daily/weekly/monthly aggregation. CONFIRMED expenses only. Caps range queries to prevent slow endpoints.

**New files:**
- `server/src/services/expense/trend.service.ts` — getTrend (daily/weekly/monthly buckets), range capping ≤ 160 LOC

**Proof gates — BACKEND (Verifier):**
- [ ] `tsc` clean
- [ ] `curl GET /api/expenses/trend?granularity=weekly&from=2026-05-01&to=2026-05-31` → 200 with weekly buckets, amounts in paise, CONFIRMED only
- [ ] Request with granularity=daily, from..to > 90 days → 400
- [ ] PENDING expenses excluded from trend amounts (unit test)

**Blockers:**
- PR2 must merge (status filter foundation)

**Blocked by:**
- PR2 proof gates passed

**Merge to:** `feature/expenses-upgrade`

---

## PR7 — Routes + Zod Schemas (Backend)

**Agent:** DudhHisaab-API-Builder

**Description:** Wire up 5 sub-routers under `/api/expenses`. Expand `expenses.ts` to mount `/templates`, `/budgets`, `/ocr`, `/trend`, `/pending`, `/:id/confirm`, `/:id/skip`. Define Zod schemas for all endpoints.

**New files:**
- `server/src/routes/expense-templates.ts` — GET/POST/PATCH/DELETE /templates ≤ 120 LOC
- `server/src/routes/expense-budgets.ts` — GET/POST/PATCH/DELETE /budgets, GET /budgets/check ≤ 110 LOC
- `server/src/routes/expense-ocr.ts` — POST /ocr with 6 MB JSON limit ≤ 70 LOC
- `server/src/routes/expense-trend.ts` — GET /trend ≤ 60 LOC
- `server/src/routes/expense-pending.ts` — GET /pending, POST /:id/confirm, POST /:id/skip ≤ 110 LOC
- `server/src/schemas/expense-template.schemas.ts` — Zod (create, update, list queries) ≤ 120 LOC
- `server/src/schemas/expense-budget.schemas.ts` — Zod (create, update, list queries) ≤ 80 LOC

**Modified files:**
- `server/src/routes/expenses.ts` — Mount 5 sub-routers before `/:id` param route

**Proof gates — BACKEND (Verifier):**
- [ ] `tsc` clean
- [ ] All routes respond with correct HTTP status (201 POST create, 200 GET, 409 conflict on double confirm, 404 not found, 400 validation)
- [ ] Route order correct (named routes before param route; no /templates matched as /:id)
- [ ] `curl POST /api/expenses/templates` invalid frequency → 400 Zod error
- [ ] Endpoints require auth (401 without cookie)
- [ ] Endpoints require feature permission (403 if not accounting.read/accounting.create/etc.)

**Blockers:**
- PR3, PR4, PR5, PR6 must merge (all service layers)

**Blocked by:**
- PR3, PR4, PR5, PR6 proof gates passed

**Merge to:** `feature/expenses-upgrade`

---

## PR8 — Frontend Implementation (UI/UX)

**Agent:** DudhHisaab-Frontend-Builder (MUST run `/design first`)

**Description:** 14 new files per 6-layer split. Pages: ExpensesPage (additions), RecurringPage, BudgetsPage. Components: PendingExpenseCard, BudgetCapsBanner, CashflowTrendCard, OcrReceiptUpload, RecurringTemplateCard, AddRecurringDrawer, BudgetRow, AddBudgetDrawer, ExportSheet. All ≤ 250 LOC. 4 UI states each.

**New files:**
- `src/features/expenses/pages/RecurringPage.tsx` — Template list, empty/loading/error/success ≤ 180 LOC
- `src/features/expenses/pages/BudgetsPage.tsx` — Budget list with progress bars, month nav, empty/loading/error/success ≤ 200 LOC
- `src/features/expenses/components/PendingExpenseCard.tsx` — Swipeable card, confirm/skip buttons ≤ 140 LOC
- `src/features/expenses/components/BudgetCapsBanner.tsx` — Alert pills (amber 80%, red 100%), max 5 visible ≤ 160 LOC
- `src/features/expenses/components/CashflowTrendCard.tsx` — Inline SVG bar chart, day/week/month tabs, no recharts ≤ 220 LOC
- `src/features/expenses/components/ExportSheet.tsx` — Bottom sheet, month picker, PDF/Excel download ≤ 200 LOC
- `src/features/expenses/components/RecurringTemplateCard.tsx` — Row with swipe-left edit/delete ≤ 140 LOC
- `src/features/expenses/components/AddRecurringDrawer.tsx` — Form all fields, frequency validation, add/edit ≤ 240 LOC
- `src/features/expenses/components/BudgetRow.tsx` — Progress bar, Rs spent/total ≤ 110 LOC
- `src/features/expenses/components/AddBudgetDrawer.tsx` — Form, category optional (overall budget), month, upsert ≤ 180 LOC
- `src/features/expenses/components/OcrReceiptUpload.tsx` — File picker (camera+gallery), loading, pre-fill with amber badges ≤ 180 LOC
- `src/features/expenses/services/recurring.service.ts` — listTemplates, createTemplate, updateTemplate, deleteTemplate, confirmExpense, skipExpense ≤ 140 LOC
- `src/features/expenses/services/budget.service.ts` — listBudgets, upsertBudget, checkBudgetExceeded ≤ 110 LOC
- `src/features/expenses/services/trend.service.ts` — getTrend (daily/weekly/monthly) ≤ 60 LOC

**Modified files:**
- `src/features/expenses/ExpensesPage.tsx` — Mount PendingCards row (above filter bar), BudgetCapsBanner, CashflowTrendCard, Export button
- `src/features/expenses/expense.types.ts` — Add RecurringTemplateItem, BudgetUsageItem, PendingExpenseItem, OcrResult, TrendPoint
- `src/features/expenses/expense.service.ts` — Add ocrReceipt(base64, mimeType), confirmExpense, skipExpense
- `src/features/expenses/components/AddExpenseDrawer.tsx` — Mount OcrReceiptUpload above amount field

**Proof gates — FRONTEND (Verifier):**

**Screenshots (all states + responsive):**
- [ ] ExpensesPage pending cards: loading skeleton (2 cards), empty (hidden), error chip, success (horizontal scroll row)
- [ ] BudgetCapsBanner: loading pill, empty (hidden), amber at 85%, red at 105%
- [ ] CashflowTrendCard: loading skeleton, error "Could not load", empty "No expenses", success (SVG chart, week tab active)
- [ ] RecurringPage: loading (3 skeleton rows), empty "No recurring expenses" + CTA, success (template list)
- [ ] BudgetsPage: loading (4 skeleton rows), empty "No budgets set" + CTA, success (budget rows + month nav)
- [ ] OcrReceiptUpload: button in drawer, loading overlay "Reading receipt…", success pre-filled fields with amber badges, error "Receipt not recognised" toast
- [ ] ExportSheet: bottom sheet open, month picker, format toggle, success (file download auto-triggers)

**Responsive + console:**
- [ ] 375px: all new pages/components render without overflow
- [ ] 320px: no horizontal scroll on Expenses, Recurring, Budgets pages
- [ ] Console clean (no errors, warnings, or console.log in production code)

**Offline & data flow:**
- [ ] All API calls use `api()` from `@/lib/api` (never raw fetch)
- [ ] All mutations pass `entityType: 'expense'` or `'recurring-expense'` + `entityLabel` for offline queue
- [ ] Mutation handlers tolerate optimistic `{}` return (no deref of response fields)
- [ ] Confirm/skip queued offline, applied on reconnect
- [ ] OCR never cached (PII), short-circuits offline with toast "OCR requires internet"

**Blockers:**
- PR7 must merge (routes + schemas finalized)
- Backend Verifier proof gates all passed (backend implementation complete + tsc + curl matrix)

**Blocked by:**
- PR7 proof gates passed

**Merge to:** `feature/expenses-upgrade`

---

## PR9 — i18n (Translations)

**Agent:** Translator (or Frontend-Builder if integrated)

**Description:** Add English + Hindi translation keys for all new UI copy. Keys follow existing `expenses.*` namespace.

**Files:**
- `public/locales/en/expenses.json` — Add keys: `pending.*`, `budgets.*`, `recurring.*`, `ocr.*`, `trend.*`, `export.*`
- `public/locales/hi/expenses.json` — Hindi translations

**Proof gates — FRONTEND (Verifier):**
- [ ] All new copy uses `t('expenses.xxx')` or `t('common.yyy')`
- [ ] No hardcoded English/Hindi strings in components
- [ ] `i18next` builds cleanly (no missing keys in build logs)

**Blockers:**
- PR8 must merge (all components finalized with copy)

**Blocked by:**
- PR8 proof gates passed

**Merge to:** `feature/expenses-upgrade`

---

## PR10 — Verifier Gate (Integration Test Suite)

**Agent:** Verifier

**Description:** Run full integration test suite. tsc clean, prisma migrate clean, curl matrix (all endpoints with 200/201/400/401/409 paths), screenshot acceptance, 320px/375px responsive, console clean, offline queue tested.

**Acceptance Criteria (from ARCHITECTURE frontmatter):**

**Backend gates:**
- [ ] `tsc` clean (no errors)
- [ ] `npx prisma migrate dev` clean (3 migrations, no drift)
- [ ] `curl POST /api/expenses/templates` valid body → 201, response includes nextRunDate
- [ ] `curl POST /api/expenses/templates` 401 without auth
- [ ] `curl POST /api/expenses/templates` invalid frequency → 400
- [ ] `curl POST /api/expenses/ocr` valid JPEG base64 → 200 success, data.amount in paise
- [ ] `curl POST /api/expenses/ocr` image > 5 MB → 400 IMAGE_TOO_LARGE
- [ ] `curl GET /api/expenses/budgets?month=2026-05` → 200, spentAmount matches CONFIRMED sum
- [ ] `curl POST /api/expenses/:id/confirm` → 200, expense status='CONFIRMED'
- [ ] `curl POST /api/expenses/:id/confirm` second call → 409 ALREADY_CONFIRMED (idempotent)
- [ ] `getExpenseSummary` excludes PENDING_CONFIRMATION rows

**Frontend gates:**
- [ ] Screenshots: all 4 UI states (loading, error, empty, success) for each new component + page
- [ ] Screenshots: pending cards visible, budget amber at 85%, budget red at 105%, trend card
- [ ] Screenshots: OCR loading overlay, pre-filled with amber badges, "Receipt not recognised" toast
- [ ] Screenshots: recurring page empty + list, budgets page empty + list with month nav
- [ ] 375px layout: all components render correctly (no overflow)
- [ ] 320px layout: no horizontal scroll on Expenses, Recurring, Budgets pages
- [ ] Console clean (no errors, warnings, or debugging logs)
- [ ] Offline: confirm/skip queued via `api()` with entityType=expense, applied on reconnect

**Blockers:**
- PR1 through PR9 must merge

**Blocked by:**
- PR1–PR9 proof gates passed
- All code committed to `feature/expenses-upgrade` branch

**Output:**
- Signed-off test report confirming all gates passed
- Screenshots stored in `docs/VERIFY_expenses_upgrade_screenshots/` directory

**Merge to:** `feature/expenses-upgrade` (as verification evidence)

---

## PR11 — QA Gate & Final Approval

**Agent:** QA

**Description:** Validate feature completeness against SCOPE acceptance criteria. Review Verifier report, test user scenarios (Raju, Priya, Amit), approve or request redo.

**Acceptance Criteria (from SCOPE §9):**

**Schema:**
- [ ] Migration runs clean on fresh DB
- [ ] All historical Expense rows have status='CONFIRMED'
- [ ] RecurringExpenseTemplate + ExpenseBudget tables exist

**Recurring:**
- [ ] Create template MONTHLY dayOfMonth=31 → Feb clamps to 28/29
- [ ] Worker creates exactly 1 PENDING row per due template
- [ ] Running worker twice: no duplicate rows
- [ ] Delete category with active templates → 409 (FK Restrict)
- [ ] Delete template → pending entries remain

**Pending Flow:**
- [ ] Tap Confirm → expense in list, P&L increases
- [ ] Tap Skip → expense not in list, P&L unchanged
- [ ] Double-confirm → 409
- [ ] Offline confirm → queued, applied on reconnect

**Budgets:**
- [ ] Overall budget (null categoryId) tracks all CONFIRMED expenses
- [ ] Per-category budget tracks only that category
- [ ] Upsert same month+category → update, not duplicate
- [ ] PENDING not counted in spentAmount
- [ ] Banner amber at 80%, red at 100%
- [ ] Banner hidden when no budgets set

**OCR:**
- [ ] Valid JPEG → pre-fill amount/date/vendor
- [ ] Image > 5 MB → 400
- [ ] Non-receipt → confidence 0, toast shown, form open
- [ ] API key missing → soft fail, form open
- [ ] Haiku used in logs (not Sonnet)

**Export:**
- [ ] PDF downloads, opens on Android
- [ ] Excel opens in Google Sheets
- [ ] 0 expenses → "No expenses" shown, no empty file

**Trend Card:**
- [ ] PENDING excluded from chart
- [ ] Switching granularity re-renders without full page reload
- [ ] 320px: bars don't overflow

**P&L:**
- [ ] P&L excludes PENDING
- [ ] After confirm, P&L updates (cache invalidated)

**Mobile:**
- [ ] 375px: all UI elements render
- [ ] 320px: no horizontal scroll
- [ ] Camera + gallery picker works on Android
- [ ] Swipe-to-reveal on RecurringTemplateCard works on touch

**User Stories (integration test):**
- [ ] Raju: set recurring rent, tap confirm each month → quick workflow
- [ ] Priya: check salary budget at 85% → amber banner visible, expense saves, no block
- [ ] Amit: export quarter of expenses → PDF/Excel downloads, shows first 500 rows with banner

**Output:**
- [ ] QA approval signature (Sawan or designated QA)
- [ ] Link to final Verifier report
- [ ] Any blockers listed; if none, feature is DONE

**Blockers:**
- PR10 Verifier gates all passed
- All PRs merged to `feature/expenses-upgrade`

**Blocked by:**
- PR10 proof gates passed

**Result:** APPROVED → PR merged to master → feature DONE

---

## Redo Gate (if QA rejects)

If QA finds blockers:

1. **Send to Redo Agent** with violation list (from QA report)
2. **Redo Agent** fixes violations (code changes + new commits to `feature/expenses-upgrade`)
3. **Verifier re-runs all gates** (tsc, curl matrix, screenshots, console)
4. **QA re-validates** against SCOPE acceptance criteria
5. **If still blocked:** Invoke Postmortem Agent (auto-trigger if Redo >1x or Verifier fails >2x)

---

## Postmortem Trigger

Auto-invoke Postmortem Agent if:
- QA rejects feature after Redo Agent runs more than once
- Verifier fails (tsc, curl, screenshot, console) more than twice on the same task

Postmortem Agent reads all failures → updates agent instruction files → resumes build.

---

## Timeline & Sequencing

All PRs are **additive and independent at the service level**, so they can be:
- **Coded in parallel** (PR1 foundation, then 2–6 parallel, PR7 after 2–6 complete, PR8 after PR7, PR9 after PR8, PR10 after all, PR11 final).
- **Merged in strict order** to `feature/expenses-upgrade` to maintain bisectability.

**Recommended merge order:**
1. PR1 (schema)
2. PR2 (status filter)
3. PR3, PR4, PR5, PR6 (services — can merge in any order after PR2)
4. PR7 (routes — after PR3–6)
5. PR8 (frontend — after PR7 + backend proof gates)
6. PR9 (i18n — after PR8)
7. PR10 (Verifier — after PR1–9)
8. PR11 (QA — after PR10)

---

## File Checklist

**Backend files (new):**
- [ ] `server/prisma/migrations/*/add_expense_status_recurring_template_budget.sql`
- [ ] `server/prisma/migrations/*/backfill_expense_status.sql`
- [ ] `server/prisma/migrations/*/constrain_expense_status_not_null.sql`
- [ ] `server/src/services/expense/recurring.service.ts`
- [ ] `server/src/services/expense/recurring.dates.ts`
- [ ] `server/src/services/expense/budget.service.ts`
- [ ] `server/src/services/expense/ocr.service.ts`
- [ ] `server/src/services/expense/trend.service.ts`
- [ ] `server/src/services/expense/pending.service.ts`
- [ ] `server/src/routes/expense-templates.ts`
- [ ] `server/src/routes/expense-budgets.ts`
- [ ] `server/src/routes/expense-ocr.ts`
- [ ] `server/src/routes/expense-trend.ts`
- [ ] `server/src/routes/expense-pending.ts`
- [ ] `server/src/schemas/expense-template.schemas.ts`
- [ ] `server/src/schemas/expense-budget.schemas.ts`
- [ ] `server/src/schemas/expense-ocr.schemas.ts`
- [ ] `server/src/__tests__/integration/expense-recurring.test.ts`
- [ ] `server/src/__tests__/integration/expense-budget.test.ts`
- [ ] `server/src/__tests__/integration/expense-ocr.test.ts`

**Backend files (modified):**
- [ ] `server/prisma/schema.prisma`
- [ ] `server/src/services/expense.service.ts`
- [ ] `server/src/services/export.service.ts`
- [ ] `server/src/services/report/report-daybook.ts`
- [ ] `server/src/routes/expenses.ts`
- [ ] `server/src/lib/cron-scheduler.ts`
- [ ] `server/src/lib/env.ts`

**Frontend files (new):**
- [ ] `src/features/expenses/pages/RecurringPage.tsx`
- [ ] `src/features/expenses/pages/BudgetsPage.tsx`
- [ ] `src/features/expenses/components/PendingExpenseCard.tsx`
- [ ] `src/features/expenses/components/BudgetCapsBanner.tsx`
- [ ] `src/features/expenses/components/CashflowTrendCard.tsx`
- [ ] `src/features/expenses/components/ExportSheet.tsx`
- [ ] `src/features/expenses/components/RecurringTemplateCard.tsx`
- [ ] `src/features/expenses/components/AddRecurringDrawer.tsx`
- [ ] `src/features/expenses/components/BudgetRow.tsx`
- [ ] `src/features/expenses/components/AddBudgetDrawer.tsx`
- [ ] `src/features/expenses/components/OcrReceiptUpload.tsx`
- [ ] `src/features/expenses/services/recurring.service.ts`
- [ ] `src/features/expenses/services/budget.service.ts`
- [ ] `src/features/expenses/services/trend.service.ts`

**Frontend files (modified):**
- [ ] `src/features/expenses/ExpensesPage.tsx`
- [ ] `src/features/expenses/expense.types.ts`
- [ ] `src/features/expenses/expense.service.ts`
- [ ] `src/features/expenses/components/AddExpenseDrawer.tsx`

**i18n files:**
- [ ] `public/locales/en/expenses.json`
- [ ] `public/locales/hi/expenses.json`

---

*End of TASKS. Ready for build. Verifier and QA agents inherit this document.*
