# SCOPE — Expenses Upgrade (Phase 3 #96 → Upgrade)

> Status: DRAFT — awaiting answers to Open Questions before architect invocation.
> This upgrades the existing expenses feature. It does NOT replace it from zero.

---

## 1. Summary

Upgrade HisaabPro's existing basic expense tracking (CRUD + 10 categories + P&L hook) with
six capabilities: recurring expense templates, per-category and overall budgets with banner
alerts, receipt OCR via Claude Vision, a cashflow trend card, an export sheet (PDF/Excel),
and a pending-confirmation flow for recurring-generated entries. All new capabilities are
additive — existing expense records, categories, API contracts, and the P&L service are
preserved without breaking change.

---

## 2. Goals and Non-Goals

### Goals

- Add `RecurringExpenseTemplate`, `ExpenseBudget` models additively to schema (no breaking
  migration).
- Add `status` and `recurringTemplateId` columns to the existing `Expense` model (nullable,
  default `CONFIRMED` so all historical rows are treated as already confirmed).
- Extend cron-scheduler.ts with a daily 01:00 IST job that materialises due recurring
  templates into `PENDING_CONFIRMATION` expense rows.
- Budget banner that fires at 80 % and 100 % of monthly category/overall budget.
- Server-side OCR: upload receipt image → Anthropic Claude Vision → auto-fill amount, date,
  vendor; user reviews before saving.
- Cashflow trend card: daily/weekly/monthly bar chart on the Expenses page.
- Export sheet: download filtered month of expenses as PDF (React-PDF, client-side) or Excel
  (SheetJS, client-side).
- Pending-confirmation UI: recurring entries surface as swipeable cards at the top of the
  Expenses page; tap Confirm or Skip.

### Non-Goals (explicit)

- WhatsApp share of expense report — separate feature.
- Multi-currency support.
- Approval workflow / multi-user expense approvals.
- Credit card integration / statement import.
- Sub-categories or category hierarchy.
- Splitting one expense across categories.
- Recurring templates with end-date / max-occurrences limits (Phase 4).
- GST changes to existing fields (already in schema, no new work).
- Changing the existing `createExpense` / `listExpenses` / `deleteExpense` API shape.
- Any changes to the P&L accounting service beyond the status-aware query fix (see
  section 6).

---

## 3. User Stories

### Raju (micro retailer, Rs 1-5L/month)

- "My shop rent is Rs 12,000 every month on the 1st. I want to set it once and just tap
  Confirm each month — not manually enter it every time."
- "I clicked a photo of the electrician's bill. I want the app to read the amount so I
  don't have to type Rs 3,750."

### Priya (growing wholesaler, 2-5 staff, Rs 5-25L/month)

- "I want to see that my Salary budget for the month is 85 % spent before I approve the
  advance payout."
- "At month-end I share the expense list with my accountant. I need a PDF that shows all
  expenses, category-wise."

### Amit (multi-location distributor, Rs 25L-2Cr/month)

- "I want to see whether spend is trending up week-over-week so I can decide whether to
  pause a vendor."
- "I need a bulk Excel of all expenses for the quarter so I can import into Tally."

---

## 4. UI Surface

### 4.1 Expenses Page (existing — additions)

**Pending Confirmation Banner / Cards** (new, appears above filter bar when
`pendingCount > 0`)

| UI State | Copy / Behaviour |
|---|---|
| Loading | 2 skeleton cards (44px height, shimmer) |
| Empty | Banner hidden — no rendering |
| Error | Inline error chip: "Could not load pending expenses. Tap to retry." |
| Success | Horizontal scroll row of `PendingExpenseCard` chips |

Each `PendingExpenseCard`:
- Category icon + name · Date (DD MMM) · Amount (Rs X,XX,XXX) · "Recurring" badge
- Two buttons: "Confirm" (primary teal) · "Skip" (ghost red)
- Confirm → optimistic removal from list, toast "Expense confirmed"
- Skip → confirmation sheet "Skip this expense entry? It will not be recorded." [Cancel]
  [Skip Entry] → optimistic removal, toast "Entry skipped"

**Budget Caps Banner** (new, appears between filter bar and action bar)

| UI State | Copy |
|---|---|
| Loading | 1 skeleton pill (120px wide) |
| Empty / no budgets set | Hidden |
| Warning (80–99 %) | Amber chip: "{Category} budget 85 % used — Rs X left" |
| Over (≥ 100 %) | Red chip: "{Category} budget exceeded by Rs X" |
| Success / under 80 % | Hidden |

Multiple alerts: horizontal scroll pills, max 5 visible.

**Cashflow Trend Card** (new, collapsible, below action bar)

| UI State | Copy |
|---|---|
| Loading | Skeleton card 160px height |
| Error | "Could not load trend. Tap to retry." |
| Empty (no data this period) | "No expenses recorded in this period." |
| Success | Bar chart: daily / weekly / monthly tabs |

Controls: 3-tab toggle [Day] [Week] [Month]. Default: Week.
No external charting library — render with inline SVG bars (no recharts dep, avoid bundle
bloat for budget-device targets).

**Export Sheet** (bottom sheet, triggered by "Export" icon in page header)

| UI State | Copy |
|---|---|
| Loading | Progress spinner + "Preparing export…" |
| Error | "Export failed. Try again." [Retry] |
| Empty (no expenses in range) | "No expenses in this period." |
| Success | File downloads automatically |

Controls: Month picker (default: current month) · Format toggle [PDF] [Excel].

### 4.2 Recurring Expenses Page (new route: `/expenses/recurring`)

Accessible from Expenses page header action or Settings sidebar.

**Template List**

| UI State | Copy |
|---|---|
| Loading | 3 skeleton rows |
| Error | "Could not load recurring expenses. Tap to retry." |
| Empty | "No recurring expenses set up." + [Set Up Recurring] CTA |
| Success | List of `RecurringTemplateCard` rows |

Each `RecurringTemplateCard`:
- Category icon + name · Frequency badge (MONTHLY / WEEKLY / DAILY / YEARLY) · Amount ·
  Next run date (DD MMM YYYY) · "Active" / "Paused" status dot
- Swipe left → [Edit] [Delete]
- Delete → confirm sheet "Delete this recurring expense? Future entries will not be
  created." [Cancel] [Delete]

**Add/Edit Recurring Template Drawer** (bottom sheet)

Fields: Category (required) · Amount in Rs (required) · Frequency
(DAILY/WEEKLY/MONTHLY/YEARLY) · Day of month (if MONTHLY, 1–28) · Day of week (if
WEEKLY, Mon–Sun) · First run date · Payment mode · Party (optional) · Notes (optional).

| UI State | Copy |
|---|---|
| Loading (save) | Button shows spinner "Saving…" |
| Error | Toast "Could not save. Check connection and try again." |
| Validation error | Inline field error |
| Success | Toast "Recurring expense saved" · Drawer closes |

### 4.3 Budgets Page (new route: `/expenses/budgets`)

Accessible from Expenses page header.

**Budget List with Usage Bars**

| UI State | Copy |
|---|---|
| Loading | 4 skeleton rows |
| Error | "Could not load budgets. Tap to retry." |
| Empty | "No budgets set for this month." + [Set Budget] CTA |
| Success | Per-category rows with progress bar + Rs spent / Rs total |

Month picker (default: current month, navigable ±1 month).

Each `BudgetRow`:
- Category name · icon · Month · Progress bar (green < 80 %, amber 80–99 %, red ≥ 100 %) ·
  "Rs X,XX,XXX of Rs Y,YY,YYY"
- Edit icon → inline edit drawer
- Overall budget row at top (no category = total spend).

**Add/Edit Budget Drawer**

Fields: Category (optional, null = overall) · Month (YYYY-MM) · Budget amount (Rs).

Upsert behaviour: setting a budget for same category + month replaces previous value.

| UI State | Copy |
|---|---|
| Success | Toast "Budget updated" |
| Error | Toast "Could not save budget. Try again." |

### 4.4 OCR Receipt Upload (within AddExpenseDrawer — new section)

Trigger: "Scan Receipt" button below the amount field in the existing `AddExpenseDrawer`.

Flow:
1. User taps "Scan Receipt" → native file picker (camera + gallery, `accept="image/*"`)
2. Image uploads to `POST /api/expenses/ocr` (multipart or base64 body — see open
   question Q4)
3. Loading state: "Reading receipt…" spinner, fields disabled
4. On success: pre-fill amount / date / notes (vendor name → notes) with confidence
   indicator — low-confidence fields highlighted amber with "(check this)" label
5. User reviews, edits if needed, then saves normally

| UI State | Copy |
|---|---|
| Loading | "Reading receipt…" overlay on form |
| Error (API down) | Toast "Could not read receipt. Fill in manually." — form stays open |
| Error (not a receipt, confidence 0) | Toast "Receipt not recognised. Please fill in manually." |
| Partial (some fields null) | Pre-filled fields populated; null fields left empty with placeholder |
| Success | Amber confidence badge on pre-filled fields |

---

## 5. API Contract

All new routes are under the existing `/api/expenses` prefix. Auth: bearer session cookie,
`requirePermission('expenses:write')` or `expenses:read` as appropriate.

### 5.1 Recurring Templates

```ts
// GET /api/expenses/templates
// Response
interface ListTemplatesRes {
  success: true
  data: RecurringTemplateItem[]
}
interface RecurringTemplateItem {
  id: string
  categoryId: string
  category: { id: string; name: string; icon: string | null; color: string }
  amount: number          // paise
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  dayOfMonth: number | null   // 1-28, for MONTHLY
  dayOfWeek: number | null    // 0=Sun … 6=Sat, for WEEKLY
  paymentMode: string
  partyId: string | null
  notes: string | null
  isActive: boolean
  nextRunDate: string     // ISO date
  createdAt: string
}

// POST /api/expenses/templates
interface CreateTemplateReq {
  categoryId: string
  amount: number          // paise, min 1
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  dayOfMonth?: number     // required if MONTHLY
  dayOfWeek?: number      // required if WEEKLY
  nextRunDate: string     // ISO date — first date to generate
  paymentMode: string
  partyId?: string
  notes?: string
}
// Response: { success: true, data: RecurringTemplateItem }

// PATCH /api/expenses/templates/:id
interface UpdateTemplateReq {
  amount?: number
  frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  dayOfMonth?: number
  dayOfWeek?: number
  nextRunDate?: string
  paymentMode?: string
  partyId?: string | null
  notes?: string | null
  isActive?: boolean
}
// Response: { success: true, data: RecurringTemplateItem }

// DELETE /api/expenses/templates/:id
// Response: { success: true, data: { deleted: true } }

// GET /api/expenses/pending
// Returns PENDING_CONFIRMATION expense rows for current business
interface ListPendingRes {
  success: true
  data: {
    items: PendingExpenseItem[]
    count: number
  }
}
interface PendingExpenseItem {
  id: string
  categoryId: string
  category: { id: string; name: string; icon: string | null; color: string }
  amount: number
  date: string
  paymentMode: string
  notes: string | null
  recurringTemplateId: string
  templateFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
}

// POST /api/expenses/:id/confirm
// Body: {}
// Response: { success: true, data: { id: string; status: 'CONFIRMED' } }

// POST /api/expenses/:id/skip
// Body: {}
// Response: { success: true, data: { deleted: true } }
// (Soft-deletes the pending row; does NOT advance template nextRunDate)
```

### 5.2 Budgets

```ts
// GET /api/expenses/budgets?month=YYYY-MM
interface ListBudgetsRes {
  success: true
  data: BudgetUsageItem[]
}
interface BudgetUsageItem {
  id: string | null          // null = overall budget row
  categoryId: string | null
  category: { id: string; name: string; icon: string | null; color: string } | null
  month: string              // YYYY-MM
  budgetAmount: number       // paise
  spentAmount: number        // paise (CONFIRMED expenses only)
  percent: number            // 0-Infinity; >100 = over budget
}

// POST /api/expenses/budgets
interface CreateBudgetReq {
  categoryId?: string        // omit for overall budget
  month: string              // YYYY-MM
  amount: number             // paise, min 1
}
// Upsert: same (businessId, categoryId, month) → updates amount
// Response: { success: true, data: BudgetUsageItem }

// PATCH /api/expenses/budgets/:id
interface UpdateBudgetReq {
  amount: number             // paise, min 1
}
// Response: { success: true, data: BudgetUsageItem }

// DELETE /api/expenses/budgets/:id
// Response: { success: true, data: { deleted: true } }
```

### 5.3 OCR

```ts
// POST /api/expenses/ocr
// Content-Type: application/json
interface OcrReq {
  imageBase64: string        // base64-encoded image (JPEG / PNG / WEBP)
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}
interface OcrRes {
  success: true
  data: {
    amount: number | null    // paise
    date: string | null      // YYYY-MM-DD
    vendor: string | null    // merchant name (→ notes)
    confidence: number       // 0–1
  }
}
// On model error / API key missing:
// { success: false, error: { code: 'OCR_UNAVAILABLE', message: 'Receipt scanning is temporarily unavailable. Please fill in manually.' } }
```

### 5.4 Trend / Cashflow

```ts
// GET /api/expenses/trend?granularity=daily|weekly|monthly&from=YYYY-MM-DD&to=YYYY-MM-DD
interface TrendRes {
  success: true
  data: {
    granularity: 'daily' | 'weekly' | 'monthly'
    points: Array<{
      label: string       // "12 May", "Wk 19", "May 2026"
      from: string        // ISO date
      to: string          // ISO date
      amount: number      // paise, CONFIRMED only
    }>
  }
}
```

### 5.5 Export

Export is client-side (React-PDF for PDF, SheetJS for Excel). The frontend fetches all
expense rows for the requested month via the existing `GET /api/expenses?from=&to=&limit=500`
endpoint (500-row cap) and renders locally. No new server endpoint required.

---

## 6. Data Model

### 6.1 Expense model — additive columns

```prisma
// Add to existing Expense model
status               String    @default("CONFIRMED")  // PENDING_CONFIRMATION | CONFIRMED
recurringTemplateId  String?

// New relation (after RecurringExpenseTemplate model added)
recurringTemplate    RecurringExpenseTemplate? @relation(fields: [recurringTemplateId], references: [id])

// New indexes
@@index([businessId, status, isDeleted])
@@index([businessId, recurringTemplateId])
```

### 6.2 New model: RecurringExpenseTemplate

```prisma
model RecurringExpenseTemplate {
  id          String    @id @default(cuid())
  businessId  String
  categoryId  String
  amount      Int                         // paise
  frequency   String                      // DAILY | WEEKLY | MONTHLY | YEARLY
  dayOfMonth  Int?                        // 1-28, MONTHLY only
  dayOfWeek   Int?                        // 0=Sun…6=Sat, WEEKLY only
  paymentMode String
  partyId     String?
  notes       String?   @db.Text
  isActive    Boolean   @default(true)
  nextRunDate DateTime
  isDeleted   Boolean   @default(false)
  deletedAt   DateTime?
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  business  Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  category  ExpenseCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdByUser User        @relation("RecurringTemplateCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  expenses  Expense[]

  @@index([businessId, isActive, isDeleted])
  @@index([businessId, nextRunDate])
}
```

### 6.3 New model: ExpenseBudget

```prisma
model ExpenseBudget {
  id         String    @id @default(cuid())
  businessId String
  categoryId String?                      // null = overall business budget
  month      String    @db.VarChar(7)     // YYYY-MM
  amount     Int                          // paise
  isDeleted  Boolean   @default(false)
  createdBy  String
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  business  Business         @relation(fields: [businessId], references: [id], onDelete: Cascade)
  category  ExpenseCategory? @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdByUser User         @relation("BudgetCreator", fields: [createdBy], references: [id], onDelete: Restrict)

  @@unique([businessId, categoryId, month])
  @@index([businessId, month])
}
```

### 6.4 Migration Sequence (additive — no destructive steps)

1. Migration A — `add_recurring_template_table`
   - Create `RecurringExpenseTemplate` table.
   - Add nullable `recurringTemplateId String?` to `Expense`.
   - Add `status String @default("CONFIRMED")` to `Expense`.
   - Add new indexes.

2. Migration B — `add_expense_budget_table`
   - Create `ExpenseBudget` table.

3. No backfill required (all new columns have defaults; historical rows get `status =
   'CONFIRMED'` automatically from the column default).

4. No NOT NULL promotions needed post-backfill.

### 6.5 P&L Service Fix

`services/accounting` P&L queries that aggregate `Expense.amount` must add
`status: 'CONFIRMED'` to the where clause so `PENDING_CONFIRMATION` rows are excluded from
profit-and-loss. This is a single where-clause addition in the existing service — not a
schema change.

---

## 7. OCR Integration

### Model choice

HP's existing tech uses Anthropic SDK (codebase has `claude-sonnet-4-6` and
`claude-haiku-4-5-20251001` references). DudhHisaab used Gemini 2.0 Flash for OCR — HP
must not use the Gemini SDK (no `@google/generative-ai` dependency). Use Anthropic Vision
instead.

**Recommended: `claude-haiku-4-5-20251001`** — sufficient for extracting 4 fields from a
structured receipt image, significantly cheaper than Sonnet. Fallback to Sonnet only if the
haiku response confidence < 0.3 (configurable via `EXPENSE_OCR_FALLBACK_MODEL` env var,
default: do not fall back — return low confidence and let user fill manually).

Open question Q1 below must confirm the model choice.

### Prompt (adapted from DH, HP conventions)

```
You are an expert at reading Indian shop and vendor receipts.

Extract these fields and return ONLY valid JSON (no prose, no markdown fences):
- amount: total in paise (integer; e.g. 50000 for ₹500.00), or null
- date: YYYY-MM-DD, or null
- vendor: merchant/shop name string, or null
- confidence: 0–1 overall confidence

Rules:
- Return null for any field you cannot read with high confidence. Do NOT guess.
- Strip ₹, Rs, INR from amounts. Convert decimal (500.50 → 50050).
- If the image is not a receipt, set all fields null and confidence 0.
- Respond with raw JSON only.
```

### Cost estimate (haiku-4-5)

Approximate: 1K input tokens (prompt + small image) ≈ $0.00025 per call.
1,000 scans/month ≈ $0.25. Acceptable.

### Fallback chain

1. Anthropic call succeeds, confidence ≥ 0.5 → pre-fill fields.
2. Anthropic call succeeds, confidence < 0.5 → pre-fill with amber warnings.
3. Anthropic call fails (5xx, timeout) → toast "Receipt scanning unavailable. Please fill in
   manually." Form stays open, no fields pre-filled. Non-blocking.
4. `ANTHROPIC_API_KEY` missing → same as case 3 (log warning, not error).

Image size limit: 5 MB (reject with 400 before calling API).
Supported MIME types: `image/jpeg`, `image/png`, `image/webp`.

---

## 8. Edge Cases

| Scenario | Handling |
|---|---|
| Scheduler runs, server offline / crash mid-loop | Each template processed in its own try/catch; failed templates log error and are retried next cron run. Worker is idempotent: dedupes on `(businessId, recurringTemplateId, date)`. |
| Scheduler fires twice same day (restart) | Idempotency check: `Expense.findFirst({ where: { recurringTemplateId, date: runDate, isDeleted: false } })` — existing row found → skip, still advance `nextRunDate`. |
| User deletes a category that has an active recurring template | Backend: `Restrict` FK prevents deletion if template references it. Return 409 "Category has active recurring expenses. Deactivate or reassign them first." |
| Budget set, user manually adds expense that exceeds it | Budget is advisory (warn only). Expense is saved. Banner turns red. No blocking. |
| User confirms an already-confirmed expense (double-tap / replay) | Service checks `status === 'CONFIRMED'` → returns 409 `{ code: 'ALREADY_CONFIRMED' }`. Frontend ignores silently (idempotent optimistic update already applied). |
| User skips an already-confirmed expense | Service checks status → returns 409 `{ code: 'CANNOT_SKIP_CONFIRMED' }`. Frontend reverts optimistic removal, shows toast "Expense already confirmed." |
| OCR returns garbage / non-JSON | Server parses JSON defensively; on parse error returns `{ confidence: 0, amount: null, date: null, vendor: null }`. Frontend shows "Receipt not recognised" toast. |
| OCR image too large (> 5 MB) | 400 before calling Anthropic. Toast "Receipt image too large. Use a photo under 5 MB." |
| Export: month has > 500 expenses | Export truncated at 500. Banner in PDF/Excel header: "Showing first 500 of N expenses." |
| Multi-business: budget isolation | All budget queries scoped by `businessId`. No cross-tenant leakage. |
| DAILY recurring template when server restarts after 3 days missed | `nextRunDate` was set to yesterday; worker sees `nextRunDate <= today`, creates one entry for yesterday's date, advances nextRunDate to today. Does NOT back-fill all missed days (one-entry-at-a-time catch-up). This is intentional. |
| `dayOfMonth = 31` for months with < 31 days | `computeNextRunDate` clamps to last day of month (same logic as DH: `Math.min(targetDay, lastDayOfMonth)`). |
| User offline when tapping Confirm / Skip | `api()` queues mutation. Optimistic removal from pending list. On reconnect, mutation replays. `entityType: 'expense'`, `entityLabel: 'Confirm expense'`. |
| Delete recurring template while pending entries exist | Backend soft-deletes template. Existing `PENDING_CONFIRMATION` expenses remain — user can still confirm/skip them. No cascade delete on pending entries. |

---

## 9. Acceptance Criteria

All binary and independently testable.

**Schema / Migration**
- [ ] `npx prisma migrate dev` succeeds with no drift on a clean DB.
- [ ] All historical `Expense` rows have `status = 'CONFIRMED'` after migration.
- [ ] `RecurringExpenseTemplate` and `ExpenseBudget` tables exist with correct columns.

**Recurring Templates API**
- [ ] `curl POST /api/expenses/templates` with valid body → 201 `{ success: true, data: { id, frequency, nextRunDate } }`
- [ ] `curl POST /api/expenses/templates` without auth → 401
- [ ] `curl POST /api/expenses/templates` with invalid frequency → 400
- [ ] `curl DELETE /api/expenses/templates/:id` for another business's template → 404

**Scheduler**
- [ ] Running `runRecurringExpensesWorker()` manually creates a `PENDING_CONFIRMATION`
  expense for each due template.
- [ ] Running it twice same day: second run returns `skipped: N`, no duplicate rows.
- [ ] Template's `nextRunDate` advances correctly for DAILY / WEEKLY / MONTHLY / YEARLY.

**Pending Flow**
- [ ] `curl GET /api/expenses/pending` returns only `PENDING_CONFIRMATION` rows for the
  authenticated business.
- [ ] `curl POST /api/expenses/:id/confirm` → expense `status` = `CONFIRMED`; P&L picks it up.
- [ ] `curl POST /api/expenses/:id/skip` → expense `isDeleted = true`; not in P&L.
- [ ] Double confirm → 409 `ALREADY_CONFIRMED`.
- [ ] Skip a CONFIRMED expense → 409 `CANNOT_SKIP_CONFIRMED`.

**Budgets API**
- [ ] `curl POST /api/expenses/budgets` → 201; same `(businessId, categoryId, month)` again → 200 upsert.
- [ ] `curl GET /api/expenses/budgets?month=2026-05` → `spentAmount` matches sum of
  CONFIRMED expenses in that month for that category.
- [ ] Without auth → 401.

**OCR API**
- [ ] `curl POST /api/expenses/ocr` with valid JPEG base64 → `{ success: true, data: { amount, date, vendor, confidence } }`
- [ ] Image > 5 MB → 400 `IMAGE_TOO_LARGE`.
- [ ] `ANTHROPIC_API_KEY` not set → `{ success: false, error: { code: 'OCR_UNAVAILABLE' } }` (no 500).

**Trend API**
- [ ] `curl GET /api/expenses/trend?granularity=weekly&from=2026-05-01&to=2026-05-31` →
  array of weekly buckets, amounts in paise, CONFIRMED only.

**P&L Fix**
- [ ] PENDING expenses are excluded from `getExpenseSummary` and from P&L totals.
- [ ] After confirming a pending expense, P&L total increases by that expense's amount.

**Frontend — Expenses Page**
- [ ] Screenshot: pending cards visible when `pendingCount > 0` ✅
- [ ] Screenshot: budget amber banner at 85 % ✅
- [ ] Screenshot: budget red banner at 105 % ✅
- [ ] Screenshot: cashflow trend card (weekly tab) ✅
- [ ] Screenshot: loading skeleton ✅
- [ ] 375px no overflow · 320px no overflow

**Frontend — Recurring Page**
- [ ] Screenshot: empty state ✅
- [ ] Screenshot: template list ✅
- [ ] Screenshot: add drawer (all fields) ✅
- [ ] Confirm delete shows confirmation sheet before deletion.

**Frontend — Budgets Page**
- [ ] Screenshot: empty state ✅
- [ ] Screenshot: budget list with progress bars ✅
- [ ] Month navigation ±1 works.

**Frontend — OCR**
- [ ] Receipt scan button visible in AddExpenseDrawer.
- [ ] Screenshot: loading state ("Reading receipt…") ✅
- [ ] Screenshot: pre-filled fields with amber confidence warnings ✅
- [ ] Screenshot: "Receipt not recognised" toast ✅
- [ ] File picker accepts camera + gallery on Android (Capacitor).

---

## 10. Open Questions for Sawan

**Q1 — OCR model**
DudhHisaab used Gemini 2.0 Flash. HP uses Anthropic SDK. Scope assumes
`claude-haiku-4-5-20251001`. Is that correct, or do you want to add the Gemini SDK as a
second dependency?

**Q2 — OCR image transport**
Should the receipt image be uploaded as:
(a) base64 in JSON body (simpler, no S3) — 5 MB limit means ~3.75 MB actual image, fine for
    receipts), or
(b) multipart file upload to a presigned S3 URL first, then pass the URL to OCR?
Option (a) is simpler and avoids S3 costs for OCR. Option (b) gives a stored receipt
attachment. Currently `Expense.receiptUrl` exists — should OCR also persist the uploaded
image to S3/Cloudflare R2 as the receipt attachment?

**Q3 — DAILY recurring expenses**
If the server was down for 3 days, DH only creates ONE catch-up entry (the latest missed
date) and advances. Should HP do the same (simpler) or backfill all missed entries? Backfill
creates risk of flooding pending queue.

**Q4 — Budget behaviour: warn vs block**
When a user tries to add a manual expense that would exceed a budget, should the UI:
(a) warn with a yellow confirmation dialog (confirm to proceed), or
(b) silently save and just update the banner?
Scope currently assumes (b) — advisory only.

**Q5 — Export page count**
Export is capped at 500 rows. Is this acceptable for Amit's quarterly export use case, or
should we paginate and stream a larger export server-side?

**Q6 — Cashflow trend: CONFIRMED only or include PENDING?**
Pending entries are not yet real expenses. Scope assumes CONFIRMED only in the trend chart.
Confirm.

**Q7 — Recurring template: YEARLY frequency**
Is YEARLY needed for MVP of this upgrade (e.g., annual insurance, licence fee)? DH has it.
If not needed now, can remove to simplify scheduler logic.

**Q8 — Skip vs Dismiss**
When a user "skips" a recurring entry, should a new entry be created for the next period
automatically (i.e., nextRunDate still advances), or should they need to manually trigger
the next occurrence? DH advances nextRunDate regardless of skip/confirm — scope follows the
same logic.

---

## 11. Effort and Dependencies

### Dependencies (must be resolved before building)

| # | Dependency | Owner | Blocks |
|---|---|---|---|
| D1 | Answers to Q1–Q8 above | Sawan | All |
| D2 | Architect sign-off on schema migration (HIGH RISK PATH) | architect agent | Migration A + B |
| D3 | `ANTHROPIC_API_KEY` confirmed available in env (already expected) | Sawan / DevOps | OCR |
| D4 | Clarify whether S3/R2 is set up for image storage | Sawan | OCR (if Q2 = option b) |

### Service layer — new files (250 LOC cap each)

| File | Description |
|---|---|
| `server/src/services/expense/recurring.service.ts` | Template CRUD + worker (materialise due templates) |
| `server/src/services/expense/budget.service.ts` | Budget CRUD + usage aggregation |
| `server/src/services/expense/ocr.service.ts` | Anthropic Vision call + parse |
| `server/src/services/expense/trend.service.ts` | Daily/weekly/monthly aggregation |

### Route additions

| File | Description |
|---|---|
| `server/src/routes/expenses.ts` | Add sub-routers for `/templates`, `/budgets`, `/ocr`, `/trend`, `/pending`, `/:id/confirm`, `/:id/skip` |

### Cron addition

| File | Description |
|---|---|
| `server/src/lib/cron-scheduler.ts` | Register daily 01:00 IST `runRecurringExpensesWorker` |

### Frontend — new files (250 LOC cap each)

| File | Description |
|---|---|
| `src/features/expenses/components/PendingExpenseCard.tsx` | Confirm/skip card chip |
| `src/features/expenses/components/BudgetCapsBanner.tsx` | Alert pills row |
| `src/features/expenses/components/CashflowTrendCard.tsx` | SVG bar chart |
| `src/features/expenses/components/ExportSheet.tsx` | Bottom sheet + PDF/Excel download |
| `src/features/expenses/pages/RecurringPage.tsx` | Template list page |
| `src/features/expenses/components/RecurringTemplateCard.tsx` | Template row |
| `src/features/expenses/components/AddRecurringDrawer.tsx` | Add/edit drawer |
| `src/features/expenses/pages/BudgetsPage.tsx` | Budget list page |
| `src/features/expenses/components/BudgetRow.tsx` | Progress bar row |
| `src/features/expenses/components/AddBudgetDrawer.tsx` | Add/edit drawer |
| `src/features/expenses/components/OcrReceiptUpload.tsx` | Scan button + loading + pre-fill |
| `src/features/expenses/services/recurring.service.ts` | API calls for templates + pending |
| `src/features/expenses/services/budget.service.ts` | API calls for budgets |
| `src/features/expenses/services/trend.service.ts` | API calls for trend |

### Modified files

| File | Change |
|---|---|
| `server/prisma/schema.prisma` | Add RecurringExpenseTemplate, ExpenseBudget, Expense columns (HIGH RISK) |
| `server/src/lib/cron-scheduler.ts` | Register recurring expense job |
| `server/src/routes/expenses.ts` | Add new sub-routes |
| `server/src/services/expense.service.ts` | Add `status: 'CONFIRMED'` filter to summary/P&L queries |
| `server/src/schemas/expense.schemas.ts` | Add template, budget, OCR Zod schemas |
| `src/features/expenses/ExpensesPage.tsx` | Add pending cards, budget banner, trend card, export button |
| `src/features/expenses/expense.types.ts` | Add new types |

### Rough effort

| Area | Points |
|---|---|
| Schema migration (2 migrations) | 3 |
| Recurring service + scheduler | 5 |
| Budget service | 3 |
| OCR service | 3 |
| Trend service | 2 |
| Route wiring + Zod schemas | 3 |
| Frontend: pending flow | 3 |
| Frontend: budget page + banner | 4 |
| Frontend: recurring page | 4 |
| Frontend: OCR in drawer | 3 |
| Frontend: trend card (SVG) | 3 |
| Frontend: export sheet | 3 |
| P&L fix + tests | 2 |
| **Total** | **41 points** |

---

## 12. QA Checklist

Verifier must tick every item before marking feature DONE.

**Schema**
- [ ] Migration runs clean on fresh DB (`npx prisma migrate reset`)
- [ ] Migration is additive — no existing columns removed or renamed
- [ ] `Expense.status` defaults to `CONFIRMED` on all existing rows

**Recurring**
- [ ] Creating a template with MONTHLY + dayOfMonth=31 → nextRunDate lands on 28 Feb in
  Feb months
- [ ] Worker creates exactly one `PENDING_CONFIRMATION` row per due template per run
- [ ] Running worker twice: count of PENDING rows unchanged after second run
- [ ] Deleting a category with active templates → 409 (not 500)
- [ ] Deleting a template → its future pending entries remain (no cascade)

**Pending Flow**
- [ ] Tap Confirm → expense appears in expense list, P&L total increases
- [ ] Tap Skip → expense not in expense list, P&L total unchanged
- [ ] Double-confirm → no duplicate journal entries
- [ ] Offline confirm → queued, applied on reconnect

**Budgets**
- [ ] Overall budget (no category) tracks total of all CONFIRMED expenses
- [ ] Per-category budget tracks only that category
- [ ] Upsert: setting budget for same month+category updates, not duplicates
- [ ] PENDING expenses are NOT counted in budget `spentAmount`
- [ ] Banner shows amber at 80 %, red at 100 %
- [ ] Banner hidden when no budgets set

**OCR**
- [ ] Valid JPEG receipt → amount / date / vendor pre-filled
- [ ] Image > 5 MB → 400 (tested with actual 6 MB file)
- [ ] Non-receipt image → confidence 0, toast shown, form stays open
- [ ] Anthropic key removed from env → form stays open, no 500
- [ ] Haiku used, not Sonnet (verify in server logs)

**Export**
- [ ] PDF downloads and opens on Android (Capacitor browser.open)
- [ ] Excel opens in Google Sheets on Android
- [ ] Month with 0 expenses → "No expenses in this period" shown, no empty download

**Trend Card**
- [ ] PENDING expenses excluded from chart amounts
- [ ] Switching granularity tabs re-renders chart without full page reload
- [ ] 320px width: chart bars do not overflow card

**P&L**
- [ ] P&L report excludes PENDING expenses
- [ ] After confirm, P&L reflects new total (cache invalidated)

**Mobile**
- [ ] 375px layout: all new UI elements render without overflow
- [ ] 320px layout: no horizontal scroll on expenses page
- [ ] Capacitor file picker opens camera + gallery on Android (OCR)
- [ ] Swipe-to-reveal on RecurringTemplateCard works on touch

---

*End of scope document. Pending Q1–Q8 answers before architect invocation.*
