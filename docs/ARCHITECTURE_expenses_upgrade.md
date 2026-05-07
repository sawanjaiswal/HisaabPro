---
status: approved
feature: expenses-upgrade
created: 2026-05-07T12:45:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations
agents_invoked:
  - scope-writer (output: docs/SCOPE_expenses_upgrade.md)
  - architect (output: docs/ARCHITECTURE_expenses_upgrade.md)
  - task-manager (output: docs/TASKS_expenses_upgrade.md)
acceptance:
  backend:
    - tsc clean
    - prisma migrate dev clean (3 migrations)
    - curl POST /api/expenses/templates 201
    - curl POST /api/expenses/ocr 200 (with valid JPEG base64)
    - curl POST /api/expenses/ocr 400 (image > 5MB)
    - curl GET /api/expenses/budgets?month=2026-05 200
    - curl POST /api/expenses/:id/confirm idempotent (second call → 409 ALREADY_CONFIRMED)
    - getExpenseSummary excludes status=PENDING_CONFIRMATION rows
  frontend:
    - screenshots: pending cards, budget amber 85%, budget red 105%, trend card, OCR loading, OCR pre-filled, recurring list empty, budgets list empty, all loading skeletons
    - 320px tested (no overflow on Expenses, Recurring, Budgets pages)
    - 375px tested
    - offline confirm/skip queues via api() with entityType=expense
---

# ARCHITECTURE — Expenses Upgrade

> Upgrade (not rewrite) of the existing `Expense` + `ExpenseCategory` feature.
> Locked decisions: Anthropic `claude-haiku-4-5-20251001` for OCR; base64 JSON
> transport (5 MB cap, no persistence); single catch-up entry on missed days;
> warn dialog on budget overrun; export capped at 500; trend = CONFIRMED only;
> YEARLY frequency included; nextRunDate advances on skip AND confirm.

## 0. What exists today (verified)

- `server/prisma/schema.prisma` lines 1929–1986: `Expense` (no `status`, has
  `isRecurring` boolean, `receiptUrl`, `journalEntryId`), `ExpenseCategory`.
- `server/src/services/expense.service.ts` (242 LOC): CRUD + categories +
  `getExpenseSummary` aggregate. **Bug to fix**: aggregate has no status
  filter — once `status` column lands, PENDING rows would inflate the summary
  and the dashboard P&L preview.
- `server/src/routes/expenses.ts` (135 LOC): mounted CRUD routes; new
  sub-routers will live in separate files imported here.
- `server/src/lib/cron-scheduler.ts`: existing cron registry with daily 01:00
  IST job for PTPs and a recurring-invoice generator. We extend it.
- `server/src/services/reports/profit-and-loss.ts`: P&L reads from journal
  movements (`expenseLines = movements.filter(...)`), NOT from
  `Expense.amount`. So P&L itself is **not** affected by the new `status`
  column **as long as we never emit a journal entry for a PENDING row**.
  The fix scope is therefore: (1) `getExpenseSummary`, (2) any direct
  `prisma.expense.aggregate/groupBy/count` reads, (3) `export.service.ts`
  expenses export at line 158, (4) `report-daybook.ts` (line 122 — uses an
  aggregate path we must inspect when implementing).
- Frontend: `src/features/expenses/{ExpensesPage,expense.service,expense.types,
  useExpenses,components/{ExpenseCard,AddExpenseDrawer}}.tsx` exist. We add
  14 files; modify `ExpensesPage.tsx`, `expense.service.ts`, `expense.types.ts`.

---

## 1. Module map

All file size budgets are LOC caps; if a file is approaching 250, split.

### 1.1 Backend — new files

| Path | Purpose | LOC |
|---|---|---|
| `server/src/services/expense/recurring.service.ts` | Template CRUD + `runRecurringExpensesWorker` | ≤ 240 |
| `server/src/services/expense/recurring.dates.ts` | Pure `computeNextRunDate(freq, prev, dom?, dow?)` | ≤ 80 |
| `server/src/services/expense/budget.service.ts` | Budget CRUD + usage aggregation | ≤ 200 |
| `server/src/services/expense/ocr.service.ts` | Anthropic Vision call + JSON parse + size guard | ≤ 180 |
| `server/src/services/expense/trend.service.ts` | Daily/weekly/monthly bucket aggregation | ≤ 160 |
| `server/src/services/expense/pending.service.ts` | confirm/skip + listPending | ≤ 140 |
| `server/src/schemas/expense-template.schemas.ts` | Zod schemas (create/update/list) | ≤ 120 |
| `server/src/schemas/expense-budget.schemas.ts` | Zod schemas | ≤ 80 |
| `server/src/schemas/expense-ocr.schemas.ts` | Zod schema for `{ imageBase64, mimeType }` | ≤ 60 |
| `server/src/routes/expense-templates.ts` | `/api/expenses/templates` sub-router | ≤ 120 |
| `server/src/routes/expense-budgets.ts` | `/api/expenses/budgets` sub-router | ≤ 110 |
| `server/src/routes/expense-ocr.ts` | `POST /api/expenses/ocr` | ≤ 70 |
| `server/src/routes/expense-trend.ts` | `GET /api/expenses/trend` | ≤ 60 |
| `server/src/routes/expense-pending.ts` | `/api/expenses/pending`, `:id/confirm`, `:id/skip` | ≤ 110 |
| `server/src/__tests__/integration/expense-recurring.test.ts` | Worker idempotency + date math | ≤ 220 |
| `server/src/__tests__/integration/expense-budget.test.ts` | Budget upsert + spent calculation | ≤ 180 |
| `server/src/__tests__/integration/expense-ocr.test.ts` | Mock Anthropic + 5 MB guard + missing-key path | ≤ 150 |

### 1.2 Backend — modified files

| Path | Change |
|---|---|
| `server/prisma/schema.prisma` | Add columns + 2 new models (Migrations A/B/C) |
| `server/src/services/expense.service.ts` | Add `status: 'CONFIRMED'` filter to `getExpenseSummary`, `listExpenses` (default), `deleteExpense` allow either status |
| `server/src/services/export.service.ts` | Line 158 — filter `status: 'CONFIRMED'` |
| `server/src/services/report/report-daybook.ts` | If it reads Expense directly, add `status: 'CONFIRMED'` |
| `server/src/routes/expenses.ts` | Mount the 5 new sub-routers |
| `server/src/lib/cron-scheduler.ts` | Register `runRecurringExpensesWorker` at `0 1 * * *` IST |
| `server/src/lib/env.ts` | Add `ANTHROPIC_API_KEY` (optional — feature degrades), `EXPENSE_OCR_MODEL` default `claude-haiku-4-5-20251001`, `EXPENSE_OCR_MAX_BYTES` default `5242880` |

### 1.3 Frontend — new files (14, all 6-layer split)

Layer L = Layout/Page · C = Component · H = Hook · S = Service · T = Types · X = Constants

| Path | Layer | LOC |
|---|---|---|
| `src/features/expenses/pages/RecurringPage.tsx` | L | ≤ 180 |
| `src/features/expenses/pages/BudgetsPage.tsx` | L | ≤ 200 |
| `src/features/expenses/components/PendingExpenseCard.tsx` | C | ≤ 140 |
| `src/features/expenses/components/BudgetCapsBanner.tsx` | C | ≤ 160 |
| `src/features/expenses/components/CashflowTrendCard.tsx` | C | ≤ 220 (inline SVG) |
| `src/features/expenses/components/ExportSheet.tsx` | C | ≤ 200 |
| `src/features/expenses/components/RecurringTemplateCard.tsx` | C | ≤ 140 |
| `src/features/expenses/components/AddRecurringDrawer.tsx` | C | ≤ 240 |
| `src/features/expenses/components/BudgetRow.tsx` | C | ≤ 110 |
| `src/features/expenses/components/AddBudgetDrawer.tsx` | C | ≤ 180 |
| `src/features/expenses/components/OcrReceiptUpload.tsx` | C | ≤ 180 |
| `src/features/expenses/services/recurring.service.ts` | S | ≤ 140 |
| `src/features/expenses/services/budget.service.ts` | S | ≤ 110 |
| `src/features/expenses/services/trend.service.ts` | S | ≤ 60 |

### 1.4 Frontend — modified files

| Path | Change |
|---|---|
| `src/features/expenses/ExpensesPage.tsx` | Mount PendingCards row, BudgetCapsBanner, CashflowTrendCard, Export button |
| `src/features/expenses/expense.types.ts` | Add `RecurringTemplate`, `BudgetUsageItem`, `PendingExpenseItem`, `OcrResult`, `TrendPoint` |
| `src/features/expenses/expense.service.ts` | Add `ocrReceipt(base64, mimeType)`, `confirmExpense`, `skipExpense` |
| `src/features/expenses/components/AddExpenseDrawer.tsx` | Mount OcrReceiptUpload above amount field |

---

## 2. Schema migrations

Three migrations, in order. Each is a separate `prisma migrate dev --name`
invocation so rollback granularity stays one column at a time.

### Migration A — `add_expense_status_recurring_template_budget` (additive)

Diff vs current `Expense` model (lines 1929–1963):

```prisma
model Expense {
  // ... existing fields unchanged ...
  isRecurring         Boolean   @default(false)   // existing — leave; legacy flag
  // NEW
  status              String    @default("CONFIRMED") // CONFIRMED | PENDING_CONFIRMATION
  recurringTemplateId String?

  // NEW relation
  recurringTemplate   RecurringExpenseTemplate? @relation(fields: [recurringTemplateId], references: [id], onDelete: SetNull)

  // NEW indexes
  @@index([businessId, status, isDeleted])
  @@index([businessId, recurringTemplateId])
  // existing indexes preserved
}

model RecurringExpenseTemplate {
  id          String    @id @default(cuid())
  businessId  String
  categoryId  String
  amount      Int
  frequency   String                          // DAILY | WEEKLY | MONTHLY | YEARLY
  dayOfMonth  Int?
  dayOfWeek   Int?
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

  business      Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  category      ExpenseCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdByUser User            @relation("RecurringTemplateCreator", fields: [createdBy], references: [id], onDelete: Restrict)
  expenses      Expense[]

  @@index([businessId, isActive, isDeleted])
  @@index([businessId, nextRunDate])
}

model ExpenseBudget {
  id         String    @id @default(cuid())
  businessId String
  categoryId String?
  month      String    @db.VarChar(7)  // YYYY-MM
  amount     Int
  isDeleted  Boolean   @default(false)
  createdBy  String
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  business      Business         @relation(fields: [businessId], references: [id], onDelete: Cascade)
  category      ExpenseCategory? @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdByUser User             @relation("BudgetCreator", fields: [createdBy], references: [id], onDelete: Restrict)

  @@unique([businessId, categoryId, month])
  @@index([businessId, month])
}
```

Generated SQL (verbatim Prisma output expected):

```sql
ALTER TABLE "Expense" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "Expense" ADD COLUMN "recurringTemplateId" TEXT;

CREATE TABLE "RecurringExpenseTemplate" ( ... );
CREATE TABLE "ExpenseBudget" ( ... );

CREATE INDEX "Expense_businessId_status_isDeleted_idx"
  ON "Expense"("businessId","status","isDeleted");
CREATE INDEX "Expense_businessId_recurringTemplateId_idx"
  ON "Expense"("businessId","recurringTemplateId");
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringTemplateId_fkey"
  FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringExpenseTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

Because the column DEFAULT is `'CONFIRMED'`, all historical rows inherit it
on the ALTER. **No data backfill is required for correctness** — but we run
Migration B explicitly anyway so the audit trail is loud.

### Migration B — `backfill_expense_status` (data assertion, no schema change)

```sql
-- idempotent — verifies all rows have a status; logs zero updated when run
-- a second time
UPDATE "Expense" SET "status" = 'CONFIRMED' WHERE "status" IS NULL;
```

Acceptance: `SELECT COUNT(*) FROM "Expense" WHERE "status" IS NULL` → 0.

### Migration C — `constrain_expense_status_not_null` (no-op verifier)

The column was already created `NOT NULL DEFAULT` in Migration A, so this
migration is just a guard that asserts it. Prisma will detect no diff and
emit an empty migration; we keep the file with a SQL comment so the audit
record matches the scope's three-step plan:

```sql
-- Verifies status is NOT NULL — already enforced by Migration A.
-- Kept as a named migration for the rollout audit trail.
SELECT 1;
```

If a reviewer prefers we omit Migration C entirely, that is acceptable —
the guarantee is provided by A. Default plan: keep all three for clarity.

### Rollback plan

If Migration A fails on prod: `ALTER TABLE "Expense" DROP COLUMN "status",
DROP COLUMN "recurringTemplateId";` and drop the two new tables. Code on
older deploy paths does not read the new columns, so app stays green.

---

## 3. Service layer

### 3.1 `recurring.service.ts`

Public API:

```ts
export function listTemplates(businessId: string): Promise<RecurringTemplateItem[]>
export function createTemplate(businessId: string, userId: string, input: CreateTemplateInput): Promise<RecurringTemplateItem>
export function updateTemplate(businessId: string, id: string, input: UpdateTemplateInput): Promise<RecurringTemplateItem>
export function deleteTemplate(businessId: string, id: string): Promise<{ deleted: true }>
export function runRecurringExpensesWorker(): Promise<{ processed: number; created: number; skipped: number; failed: number }>
```

Worker shape (per-business, NOT one big batch):

```ts
async function runRecurringExpensesWorker() {
  const today = startOfDayIST(new Date())
  let cursor: string | undefined
  while (true) {
    const businesses = await prisma.business.findMany({
      where: { isActive: true }, select: { id: true },
      take: 50, ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { id: 'asc' },
    })
    if (!businesses.length) break
    for (const b of businesses) {
      try { await processBusinessRecurringExpenses(b.id, today) }
      catch (e) { logger.error('recurring-expense.business_error', { businessId: b.id, error: ... }) }
    }
    cursor = businesses.at(-1)!.id
    if (businesses.length < 50) break
  }
}
```

Per-template transaction (idempotent):

```ts
await prisma.$transaction(async (tx) => {
  // 1. Idempotency: row already exists for (template, runDate)?
  const existing = await tx.expense.findFirst({
    where: { recurringTemplateId: t.id, date: t.nextRunDate, isDeleted: false },
    select: { id: true },
  })
  if (!existing) {
    await tx.expense.create({
      data: {
        businessId: t.businessId,
        categoryId: t.categoryId,
        amount: t.amount,
        date: t.nextRunDate,
        paymentMode: t.paymentMode,
        partyId: t.partyId,
        notes: t.notes,
        status: 'PENDING_CONFIRMATION',
        recurringTemplateId: t.id,
        isRecurring: true, // legacy flag
        createdBy: t.createdBy,
      },
    })
  }
  // 2. Advance nextRunDate (single catch-up — Q3)
  const next = computeNextRunDate(t.frequency, t.nextRunDate, t.dayOfMonth, t.dayOfWeek)
  await tx.recurringExpenseTemplate.update({ where: { id: t.id }, data: { nextRunDate: next } })
})
```

**Tx boundary**: per-template, NOT per-business. One bad template can't
roll back its sibling. The outer per-business loop has its own try/catch.

`computeNextRunDate` (in `recurring.dates.ts`) — pure, exhaustively tested:

- DAILY: `+1 day`
- WEEKLY: `+7 days` (dayOfWeek snaps preserved by base date)
- MONTHLY: add 1 month, then `setDate(min(dayOfMonth, lastDayOf(targetMonth)))`
  → handles 31 → 28/29/30
- YEARLY: `+1 year`, same dayOfMonth clamp

### 3.2 `budget.service.ts`

Public API:

```ts
export function listBudgetsForMonth(businessId: string, month: string): Promise<BudgetUsageItem[]>
export function upsertBudget(businessId: string, userId: string, input: CreateBudgetInput): Promise<BudgetUsageItem>
export function updateBudget(businessId: string, id: string, amount: number): Promise<BudgetUsageItem>
export function deleteBudget(businessId: string, id: string): Promise<{ deleted: true }>
```

`listBudgetsForMonth` runs ONE query per month: groupBy categoryId on the
month's CONFIRMED expenses, then left-joined in JS to budget rows. Returns
the overall row first (categoryId = null) computed by aggregating the same
expense set.

Spent calculation always filters `status: 'CONFIRMED', isDeleted: false`.

### 3.3 `ocr.service.ts`

```ts
const MAX_BYTES = Number(env.EXPENSE_OCR_MAX_BYTES) // 5 MB default
const MODEL = env.EXPENSE_OCR_MODEL // claude-haiku-4-5-20251001

export async function ocrReceipt(input: { imageBase64: string; mimeType: string }): Promise<OcrResult> {
  // 1. Size guard (base64 expands ~33%; check decoded byte length)
  const decodedBytes = Math.floor((input.imageBase64.length * 3) / 4)
  if (decodedBytes > MAX_BYTES) throw badRequestError('IMAGE_TOO_LARGE', 'Receipt image exceeds 5 MB')

  // 2. Missing-key path → return graceful failure, NOT 500
  if (!env.ANTHROPIC_API_KEY) return ocrUnavailable()

  // 3. Anthropic Vision call (see section 4)
  // 4. JSON parse with try/catch → on parse failure return zeroed result with confidence 0
}
```

Returned shape and error envelope match scope 5.3 exactly.

### 3.4 `trend.service.ts`

`getTrend(businessId, granularity, from, to)`:

- DAILY: groupBy `DATE_TRUNC('day', date)` (raw Postgres SQL via
  `prisma.$queryRaw` — Prisma groupBy doesn't support date-trunc cleanly).
  Caps from..to at 90 days max, else 400.
- WEEKLY: `DATE_TRUNC('week', date)` ISO week, label "Wk WW"
- MONTHLY: `DATE_TRUNC('month', date)`, label "MMM YYYY"
- All filter `status='CONFIRMED', isDeleted=false`.

### 3.5 `pending.service.ts`

```ts
export function listPending(businessId: string): Promise<PendingExpenseItem[]>
export function confirmPending(businessId: string, expenseId: string): Promise<{ id; status: 'CONFIRMED' }>
export function skipPending(businessId: string, expenseId: string): Promise<{ deleted: true }>
```

`confirmPending` — atomic:

```ts
return prisma.$transaction(async (tx) => {
  const e = await tx.expense.findFirst({
    where: { id: expenseId, businessId, isDeleted: false },
    select: { id: true, status: true },
  })
  if (!e) throw notFoundError('Expense')
  if (e.status === 'CONFIRMED')
    throw conflictError('ALREADY_CONFIRMED', 'Expense already confirmed')
  await tx.expense.update({ where: { id: e.id }, data: { status: 'CONFIRMED' } })
  // Journal entry creation is OUT OF SCOPE — existing P&L reads from journal,
  // so a follow-up commit will wire CONFIRMED → journal. Phase 3 already
  // posts journal entries on createExpense; we will replicate that path here.
  return { id: e.id, status: 'CONFIRMED' as const }
})
```

`skipPending` — soft delete the row; do NOT modify the template (template's
`nextRunDate` was already advanced by the worker at creation time, so skip ≠
re-trigger). This realises Q8: nextRunDate advances on both skip and confirm.

---

## 4. OCR design

### 4.1 Anthropic SDK call shape

```ts
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const response = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 256,
  system: SYSTEM_PROMPT, // see scope §7
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: { type: 'base64', media_type: input.mimeType, data: input.imageBase64 },
      },
      { type: 'text', text: 'Extract the receipt fields. Reply with JSON only.' },
    ],
  }],
})
```

### 4.2 Expected JSON output schema

```ts
interface OcrModelOutput {
  amount: number | null   // paise
  date: string | null     // YYYY-MM-DD
  vendor: string | null
  confidence: number      // 0..1
}
```

Server validates with a Zod schema before returning. If validation fails
(model returned prose, fences, malformed JSON) → return zeroed result with
`confidence: 0`. Never throw 500 to the client for model output issues.

### 4.3 Failure modes

| Failure | Status | Body |
|---|---|---|
| Image > 5 MB | 400 | `{ success: false, error: { code: 'IMAGE_TOO_LARGE' } }` |
| `ANTHROPIC_API_KEY` missing | 200 | `{ success: false, error: { code: 'OCR_UNAVAILABLE' } }` (frontend treats as soft fail) |
| Anthropic 5xx / timeout | 200 | Same `OCR_UNAVAILABLE` envelope |
| Model returned non-JSON | 200 | `{ success: true, data: { amount: null, date: null, vendor: null, confidence: 0 } }` |
| Model returned valid JSON, confidence 0 | 200 | Pass-through; frontend shows "Receipt not recognised" toast |
| Body too large (Express body-parser limit) | 413 | Express default; surfaced as user-facing toast |

Express JSON body limit on `/api/expenses/ocr` MUST be raised to `6mb`
(allows base64 expansion of a 4.5 MB image). All other expense routes keep
the global ~1 MB default. Implemented via per-route `express.json({ limit: '6mb' })`.

### 4.4 Cost

`claude-haiku-4-5-20251001`: small image + 256-token output ≈ $0.00025/call.
1,000 scans/mo ≈ $0.25. No fallback to Sonnet by default. Future PR can
flip via `EXPENSE_OCR_FALLBACK_MODEL`.

### 4.5 Storage swap point (future PR)

`ocr.service.ts` exposes one helper:

```ts
async function loadImageForModel(req: OcrReq): Promise<{ base64: string; mimeType: string }>
```

Today: identity passthrough on the request body. Future: replace with a
presigned-URL fetch step; nothing else in the service changes.

---

## 5. Recurring scheduler

Registered in `cron-scheduler.ts`:

```ts
// Daily 01:00 IST — materialise due recurring expense templates
cron.schedule(
  '0 1 * * *',
  () => void runRecurringExpensesJob(),
  { timezone: 'Asia/Kolkata' },
)
```

Note: 01:00 IST is also when PTP evaluator runs. They are independent and
both stream by `findMany` cursor; no contention.

`runRecurringExpensesJob` wrapper logs start/done/fatal in the same shape
as `runPtpEvaluator`. No retry-on-failure inside one run — failed templates
are picked up on the next day's run because their `nextRunDate` was not
advanced on failure (the per-template tx rolls back the advance too).

**Idempotency proof**: if cron fires twice the same day (rare; usually a
container restart inside the 1-minute window), the second pass:

1. Sees `nextRunDate` already advanced from yesterday → query
   `WHERE nextRunDate <= today` returns same templates only if today equals
   the new nextRunDate (e.g., DAILY).
2. For DAILY, the existence-check `findFirst({ recurringTemplateId, date: nextRunDate })`
   finds the row created in pass 1 → skip create, but the advance is also a
   no-op on re-run (advancing today → tomorrow once is the same as twice
   when source state is "tomorrow" already).

Acceptance: `runRecurringExpensesJob()` invoked twice in a unit test does
NOT create duplicate rows.

---

## 6. Budget enforcement

Backend never blocks. The `createExpense` endpoint stays untouched. The
**advisory** column is appended to the existing list/create response only
when the caller asks for it — to avoid breaking offline mutation handlers
that already work.

Pattern: a separate `GET /api/expenses/budgets/check?categoryId=X&amount=N`
returns `{ wouldExceed: boolean, currentSpent, budgetAmount, percentAfter }`.
The AddExpenseDrawer calls this on submit; if `wouldExceed` is true, the
yellow confirm-to-proceed dialog (Q4) opens. Cancel → form stays. Confirm
→ POST to `/api/expenses` proceeds normally.

This preserves the offline contract: if the check call fails (offline,
500), the form proceeds without the warning — never blocks.

Frontend dialog: `<BudgetWarnDialog />` reused by AddExpenseDrawer. Lives
inside `AddExpenseDrawer.tsx` (small, no separate file needed; keeps
drawer ≤ 240 LOC).

---

## 7. Route additions

All under `/api/expenses`. All require `auth` + `requireFeature('expenses')`.
Permissions match the existing convention (`accounting.create`, `.edit`,
`.delete`, read = no perm beyond auth).

| Method | Path | Perm | Zod schema |
|---|---|---|---|
| GET | `/templates` | — | — |
| POST | `/templates` | accounting.create | `createTemplateSchema` |
| PATCH | `/templates/:id` | accounting.edit | `updateTemplateSchema` |
| DELETE | `/templates/:id` | accounting.delete | — |
| GET | `/pending` | — | — |
| POST | `/:id/confirm` | accounting.create | — (empty body) |
| POST | `/:id/skip` | accounting.delete | — (empty body) |
| GET | `/budgets?month=YYYY-MM` | — | `listBudgetsQuerySchema` |
| POST | `/budgets` | accounting.create | `createBudgetSchema` |
| PATCH | `/budgets/:id` | accounting.edit | `updateBudgetSchema` |
| DELETE | `/budgets/:id` | accounting.delete | — |
| GET | `/budgets/check?categoryId=&amount=` | — | `checkBudgetQuerySchema` |
| POST | `/ocr` | accounting.create | `ocrSchema` (6 MB JSON limit) |
| GET | `/trend?granularity=&from=&to=` | — | `trendQuerySchema` |

Mount order in `expenses.ts`: `/templates`, `/pending`, `/budgets`, `/ocr`,
`/trend` BEFORE `/:id` route to avoid Express param matching `/templates`
as `/:id`.

Zod schema sketch (templates):

```ts
export const createTemplateSchema = z.object({
  body: z.object({
    categoryId: z.string().cuid(),
    amount: z.number().int().min(1),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    nextRunDate: z.coerce.date(),
    paymentMode: z.string().min(1),
    partyId: z.string().cuid().optional(),
    notes: z.string().max(500).optional(),
  }).superRefine((v, ctx) => {
    if (v.frequency === 'MONTHLY' && v.dayOfMonth == null)
      ctx.addIssue({ code: 'custom', message: 'dayOfMonth required for MONTHLY' })
    if (v.frequency === 'WEEKLY' && v.dayOfWeek == null)
      ctx.addIssue({ code: 'custom', message: 'dayOfWeek required for WEEKLY' })
  }),
})
```

---

## 8. Frontend — 6-layer split + 4 UI states

State management: TanStack Query for server state (already used by
`useExpenses`). Local useState for drawer open/close and form fields.
**No new Zustand stores** — feature is not cross-tree.

### Pages

| Component | Loading | Error | Empty | Success |
|---|---|---|---|---|
| `ExpensesPage` (modified) | Existing skeleton | Existing toast | "No expenses" CTA | List + new pending row + budget banner + trend card |
| `RecurringPage` | 3 skeleton rows | "Could not load. Tap to retry." inline | "No recurring expenses" + CTA | Template list |
| `BudgetsPage` | 4 skeleton rows | Inline error | "No budgets set" + CTA | Budget rows + month picker |

### Components

| Component | Loading | Error | Empty | Success |
|---|---|---|---|---|
| `PendingExpenseCard` | Skeleton 44px | Toast on confirm/skip fail | (banner row hidden when count=0) | Card with confirm/skip buttons |
| `BudgetCapsBanner` | Pill skeleton 120px | Hidden | Hidden when no budgets | Amber/red pills (max 5 visible, h-scroll) |
| `CashflowTrendCard` | 160px skeleton | "Could not load. Tap retry." | "No expenses recorded" | SVG bar chart, day/week/month tabs |
| `ExportSheet` | "Preparing export…" spinner | "Export failed" + retry | "No expenses in this period" | File download triggers |
| `RecurringTemplateCard` | (consumed by page skeleton) | (page-level) | (page-level) | Row + swipe actions |
| `AddRecurringDrawer` | "Saving…" button | Toast | (n/a — form) | Toast "Recurring expense saved" |
| `BudgetRow` | (page skeleton) | (page) | (page) | Progress bar + Rs values |
| `AddBudgetDrawer` | "Saving…" button | Toast | (n/a) | Toast "Budget updated" |
| `OcrReceiptUpload` | Overlay on form "Reading receipt…" | Soft toast, no fields filled | "Receipt not recognised" toast | Pre-filled fields with amber confidence badge |

### Service layer (frontend)

All calls go through `api()` per OFFLINE_RULES. Examples:

```ts
// recurring.service.ts (frontend)
export async function listTemplates(signal?: AbortSignal) {
  return api<RecurringTemplateItem[]>('/expenses/templates', { signal })
}
export async function createTemplate(input: CreateTemplateInput) {
  return api<RecurringTemplateItem>('/expenses/templates', {
    method: 'POST',
    body: JSON.stringify(input),
    entityType: 'recurring-expense',
    entityLabel: input.notes ?? 'Recurring expense',
  })
}
// pending confirm/skip — entityLabel pulled from card prop
export async function confirmExpense(id: string, label: string) {
  return api<{ id: string; status: 'CONFIRMED' }>(`/expenses/${id}/confirm`, {
    method: 'POST',
    entityType: 'expense',
    entityLabel: `Confirm ${label}`,
  })
}
```

OCR is **never cached** (PII), never queued offline (the response is
synchronous and fields would arrive too late). If offline, the OCR button
short-circuits with toast "OCR requires internet — fill in manually" and
the user fills the form by hand. No `cacheReads` anywhere in expense paths
(balances + party data = PII).

---

## 9. Migration risk — P&L impact

**Existing direct-Expense aggregations (must add `status: 'CONFIRMED'`):**

1. `server/src/services/expense.service.ts` `getExpenseSummary` — line 198
2. `server/src/services/expense.service.ts` `listExpenses` — line 154
   (default to CONFIRMED unless caller passes `status` filter)
3. `server/src/services/export.service.ts` line 158 (CSV/Excel export)
4. `server/src/services/report/report-daybook.ts` line 122 (day book
   expense roll-up)

**P&L itself is journal-driven**, so it auto-skips PENDING rows because
PENDING rows do **not** post a journal entry. Confirmation step posts the
journal (replicates `createExpense`'s journal logic, factored into a
shared helper `postExpenseJournalEntry(tx, expense)`).

**Regression test plan**:

- Snapshot `getExpenseSummary` output before migration on a copy of prod
  data → run migration → re-run → assert equal numerically (all rows
  default CONFIRMED).
- Snapshot P&L for a known month → migrate → re-run → assert byte-equal
  JSON.
- Add a PENDING expense → re-run both → assert P&L unchanged, summary
  unchanged.

---

## 10. Test strategy

| Test | File | Cases |
|---|---|---|
| Date math | `server/src/__tests__/unit/recurring-dates.test.ts` | Jan 31 → Feb 28 (non-leap), Feb 29 (leap), Apr 30. WEEKLY across DST. YEARLY Feb 29 → Mar 1 next year. |
| Worker idempotency | `expense-recurring.test.ts` | Run twice same date → 1 row. Run on 3-days-ago `nextRunDate` → 1 row, nextRunDate advanced once. Failed template doesn't poison sibling. |
| OCR happy path | `expense-ocr.test.ts` | Mock Anthropic SDK to return clean JSON → 200 with parsed paise. |
| OCR malformed JSON | same | Mock returns prose with backticks → 200, confidence 0. |
| OCR API down | same | Mock throws → 200 `OCR_UNAVAILABLE` (no 500). |
| OCR oversize | same | 6 MB base64 → 400 `IMAGE_TOO_LARGE`. |
| OCR no key | same | `delete env.ANTHROPIC_API_KEY` → 200 `OCR_UNAVAILABLE`. |
| Budget upsert | `expense-budget.test.ts` | Same (biz, cat, month) twice → 1 row updated, not duplicated. |
| Budget spent | same | PENDING expense excluded from spentAmount; CONFIRMED included. |
| Pending confirm | `expense-pending.test.ts` | Confirm → status=CONFIRMED + journal entry posted. Confirm twice → 409. |
| Pending skip | same | Skip → isDeleted=true. Skip a CONFIRMED → 409. |
| E2E budget warn | Playwright `expenses-budget-warn.spec.ts` | Set Rs 10k Salary budget → add Rs 12k expense → yellow dialog appears → cancel keeps form open → confirm proceeds. |

---

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration adds NOT NULL with bad default → ALTER lock on big Expense table | Low | Med | Postgres adds the column with default in metadata only on PG ≥ 11 — instant. Verified target = PG 14+. |
| Worker double-fires after restart, creates duplicate pending rows | Med | Low | Existence check by `(template, date)` before insert in same tx. |
| Anthropic SDK upgrade changes vision message shape | Low | Med | Pin SDK version; integration test mocks the exact request shape, fails on drift. |
| Base64 6 MB body bypasses general 1 MB limit and a different route forgets the limit | Low | Med | Per-route `express.json({ limit: '6mb' })` only on `/ocr`; rest unchanged. |
| User OCRs the same receipt twice → two pre-filled forms saved | Low | Low | Out of scope: idempotency key on `createExpense` already covers replay (existing replay middleware). |
| Trend endpoint hammered with 5-year `from..to` range | Med | Med | Server caps range to 90 days for DAILY, 53 weeks for WEEKLY, 24 months for MONTHLY → 400 if exceeded. |
| Category delete with active templates → cascade surprise | Low | High | FK is `Restrict` not `Cascade`; service surfaces 409 with translation key. |
| `recurringTemplateId` orphaned after template hard-delete | Low | Low | FK uses `onDelete: SetNull`; pending rows survive (per scope edge case). |
| Phase 3 P&L drift after `status` rollout | Low | High | P&L reads journal, not Expense; we only post journal on CONFIRMED. Snapshot test before/after migration. |
| Offline confirm/skip race: queued mutation replays after user manually deleted same expense | Low | Low | 409 ALREADY_CONFIRMED / not-found returned; api() drops the queued mutation cleanly. |

---

## 12. design-plan-active.md frontmatter (canonical)

Already at the top of this file. Copy block (between the `---` fences) into
`/Users/sawanjaiswal/Projects/HisaabPro/.claude/design-plan-active.md` to
unblock high-risk path edits to `schema.prisma` and the new migration files.

`agents_invoked` lists scope-writer, architect, task-manager. No
`security` agent is required because no path under
`HIGH_RISK_PATHS.md`'s auth/billing/admin tables is touched —
schema-only changes need `architect` alone.

---

*End — 11 sections, ≤ 800 lines.*
