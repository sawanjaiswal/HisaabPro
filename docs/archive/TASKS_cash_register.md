---
feature: cash-register
status: build-plan
created: 2026-05-07T19:47:00Z
design_plan_ref: .claude/design-plan-active.md
scope_ref: docs/SCOPE_cash_register.md
architecture_ref: docs/ARCHITECTURE_cash_register.md
---

# TASKS — Cash Register Build Orchestration

> Cash Register feature build plan. Single page, two tabs (Calculator, History), 
> online-only MVP, audited, idempotent. Orchestrated by task-manager. Each PR 
> gated by required proof evidence.

---

## Task 1: Database Schema Migration (Additive)

**Agent:** DudhHisaab-Database-Manager  
**PR destination:** hisaabpro / master  
**Priority:** P0 — prerequisite

### Scope

Create Prisma migration adding greenfield tables + enums. No destructive operations.

### Deliverables

```
server/prisma/migrations/<TIMESTAMP>_cash_register_init/migration.sql
```

### Changes required

Add to `server/prisma/schema.prisma`:
- Enum: `CashEntryDirection { IN, OUT }`
- Enum: `CashEntryEventType { CREATED, EDITED, VOIDED, RESTORED, HARD_DELETED }`
- Model: `CashEntry` with fields per ARCHITECTURE §2 (16 fields, 4 indexes)
- Model: `CashEntryEvent` with fields per ARCHITECTURE §2 (8 fields, 2 indexes)
- Relation append to `Business`: `cashEntries CashEntry[]`

Then run `npx prisma migrate dev --name cash_register_init` from `server/` directory. 
**Do not `db push`** — always use `migrate dev`. Verify migration file exists and is additive-only.

### Migration safety checklist

- [ ] No `DROP` statements in SQL
- [ ] No `ALTER TABLE ... DROP COLUMN`
- [ ] No `ALTER TABLE ... CHANGE` (MySQL) or `ALTER ... TYPE` (Postgres)
- [ ] All `ADD COLUMN` are optional (`nullable`) or have `DEFAULT`
- [ ] All FK references point to existing tables (no circular deps)
- [ ] `@@unique` and indexes are in the migration
- [ ] `createdAt` and `updatedAt` timestamps present
- [ ] Enums serialise correctly to Postgres (or SQLite for tests)

### Proof gate

**BLOCKED until:**
- [ ] `npx prisma migrate status` shows "All migrations up to date"
- [ ] `npx tsc --noEmit` in `server/` returns 0 errors
- [ ] Migration file is <200 lines and additive-only
- [ ] `git diff` shows ONLY `schema.prisma` + the new migration file

**Submit:**  
Screenshot of terminal output showing migration status + tsc clean.

---

## Task 2: Permissions Registry & Manager Seed Role Update

**Agent:** DudhHisaab-Database-Manager  
**PR destination:** hisaabpro / master  
**Priority:** P0 — prerequisite for backend

### Scope

Update existing permission seed infrastructure to register cash-register permissions 
and grant them to Manager role. Owner already auto-bypasses via `requirePermission` 
middleware (line 51 of `server/src/middleware/permission.ts`).

### Changes required

**File 1:** `server/src/services/settings/permissions-data.ts` (or equivalent registry)

Add new permission group (exact location confirmed by code audit; insert near other feature groups):

```ts
{
  key: 'cashRegister',
  label: 'Cash Register',
  actions: ['view', 'create', 'edit', 'delete']
}
```

This expands to permissions: `cashRegister.view`, `cashRegister.create`, `cashRegister.edit`, `cashRegister.delete`.

**File 2:** `server/prisma/seed.ts` (or role bootstrap module)

Locate Manager role seeding (search `role === 'manager'` or `name: 'Manager'`). 
Add the four permission strings to the Manager's `permissions` array:

```ts
permissions: [
  // ... existing permissions ...
  'cashRegister.view',
  'cashRegister.create',
  'cashRegister.edit',
  'cashRegister.delete',
]
```

### Seed safety checklist

- [ ] Query current permissions in DB before running seed (compare old vs new)
- [ ] Seed is idempotent: running twice produces same result, no duplicates
- [ ] Owner role is NOT modified (auto-bypass confirmed in middleware)
- [ ] No permission regressions: existing permissions unchanged
- [ ] New permissions do NOT leak to lower tiers (Owner/Manager only)

### Proof gate

**BLOCKED until:**
- [ ] `npx tsc --noEmit` in `server/` returns 0 errors
- [ ] `npx prisma db seed` runs without error (if seed separate; else part of task 1 test)
- [ ] Database query `SELECT permissions FROM roles WHERE name='Manager' ORDER BY permissions` includes all four new strings
- [ ] `git diff` shows ONLY permissions-data + seed changes

**Submit:**  
Screenshot of database query result showing Manager role with 4 new permissions.

---

## Task 3: Backend Implementation

**Agent:** DudhHisaab-API-Builder  
**PR destination:** hisaabpro / master  
**Priority:** P0 (after Task 1 + 2)  
**Proof gate:** See "Proof Gate — Backend" below

### Scope

Implement server-side service layer, expression evaluator, and 7 Express endpoints.
Online-only MVP. Per-business transactions. Idempotency via `X-Idempotency-Key` header 
and DB unique constraint. Full audit trail.

### Module structure (9 files, ≤1100 LOC combined)

```
server/src/features/cash-register/
  index.ts                          — re-exports for server/src/index.ts registration
  cashRegister.types.ts             — DTO, internal types, event payloads (~80 LOC)
  cashRegister.constants.ts         — MAX_EXPRESSION_LEN, MAX_NOTE_LEN, LARGE_AMOUNT_PAISE, regex (~40 LOC)
  expression.ts                     — evaluateExpression + validateExpression (recursive-descent, ~120 LOC)
  cashRegister.schemas.ts           — Zod schemas for request validation (~80 LOC)
  cashRegister.queries.ts           — listCashEntries, getCashEntry, getCashSummary (~150 LOC)
  cashRegister.mutations.ts         — create/edit/void/restore/hardDelete (~250 LOC)
  cashRegister.events.ts            — appendCashEntryEvent helper (~50 LOC)
  cashRegister.route.ts             — Express router + middleware stack + thin handlers (~200 LOC)
```

### Implementation checklist

#### expression.ts (shared evaluator logic)

- [ ] Recursive-descent parser: `parseExpression → parseTerm → parseFactor`
- [ ] Tokenizer: allows `0-9 . + - * / ( )` and space only
- [ ] Unary minus: `-5` parsed as `0 - 5`
- [ ] Precedence: `*` `/` before `+` `-` (two-pass)
- [ ] Division by zero → throw `ExpressionError('DIVIDE_BY_ZERO')`
- [ ] Result <= 0 → throw `ExpressionError('INVALID_RESULT')`
- [ ] Result > 9,999,999,999 paise (Rs 10 crore) → throw `ExpressionError('RESULT_OVERFLOW')`
- [ ] Final paise: `Math.round(result * 100)`
- [ ] `validateExpression(expr, amountPaise)` asserts `|Math.round(eval*100) - amountPaise| <= 1`
- [ ] 30 golden fixtures tested (boundary, precedence, unary, division, underflow, overflow, invalid-char, syntax-error, empty)

#### cashRegister.queries.ts

- [ ] `listCashEntries`: cursor pagination, filter by direction, includeVoided toggle, date range `fromUtc..toUtc`, scoped by businessId
  - Indexes: `(businessId, createdAt DESC)` for default; `(businessId, direction, createdAt DESC)` for filtered
  - Returns `{ entries: CashEntryDTO[], nextCursor: string | null }`
- [ ] `getCashEntry`: single row by id + businessId, returns null if not found
- [ ] `getCashSummary`: aggregates for today / last 7 / last 30 days; respects `tzOffsetMinutes` for "today" boundary
  - Today: count + inPaise + outPaise + netPaise
  - Last 7 Days: array of 7 objects (one per date), each with count + in/out/net
  - Last 30: aggregate count + in/out/net
  - All filtered: `WHERE voidedAt IS NULL` (voided entries excluded by default)
  - Range timestamps: UTC for audit, local date strings for JSON response

#### cashRegister.mutations.ts

Each mutation opens its own `prisma.$transaction()` (per F-06 rule):

- [ ] `createCashEntry`:
  - Pre-tx: fast-path `findUnique({ where: { businessId_idempotencyKey } })`; if exists, return DTO without re-writing
  - Tx: validate expression → generate idempotency key (if not provided) → insert `CashEntry` row → append `CREATED` event
  - On P2002 (race): refetch and return same DTO (idempotent 200)
  - Isolation: ReadCommitted (sufficient because middleware + unique constraint serialise creates)
  
- [ ] `editCashEntry`:
  - Guard: row must exist and `voidedAt IS NULL` → throw 409 CONFLICT if voided
  - Tx: update one or more of (direction, amountPaise, expression, note) → increment editCount → append `EDITED` event with before/after diff
  - No amount re-validation on patch (validate only on create)
  
- [ ] `voidCashEntry`:
  - Guard: row must exist and `voidedAt IS NULL` → throw 409 CONFLICT if already voided
  - Tx: set `voidedAt := now()`, `voidedBy := businessUserId`, `voidReason := reason` → append `VOIDED` event
  - Isolation: **Serializable** (prevents multi-tab race)
  
- [ ] `restoreCashEntry`:
  - Guard: row must exist and `voidedAt IS NOT NULL` → throw 409 CONFLICT if active
  - Tx: set `voidedAt := null`, `voidedBy := null`, `voidReason := null` → append `RESTORED` event with priorReason in payload
  - Isolation: Serializable
  
- [ ] `hardDeleteCashEntry`:
  - Guard: row must exist and `voidedAt IS NOT NULL` → throw 409 CONFLICT if active
  - Tx: write `AuditLog` row (type='cashEntryHardDelete', entityType='cashEntry', entityId=id, full entry+events snapshot in payload) → delete row (WHERE id AND voidedAt IS NOT NULL — DB-level guard)
  - Isolation: Serializable
  - On affected rows = 0 → throw 409 CONFLICT (defensive; state guard already checked)

#### cashRegister.events.ts

- [ ] `appendCashEntryEvent(tx, args)`: pure helper
  - Params: tx (Prisma transaction), cashEntryId, businessId, actorId, actorName, type, payload
  - Creates `CashEntryEvent` row in given transaction (no inner tx)

#### cashRegister.schemas.ts (Zod)

- [ ] `CreateCashEntrySchema`: body + X-Idempotency-Key header
  - direction: 'IN' | 'OUT' (required)
  - amountPaise: integer > 0 (required)
  - expression: string, 1–128 chars (required)
  - note: string | null, max 256 chars (optional)
  - idempotencyKey: handled by middleware, NOT in body schema
  
- [ ] `ListCashEntriesQuerySchema`: query params
  - direction: 'IN' | 'OUT' | undefined (optional)
  - includeVoided: boolean, default false (optional)
  - from, to: YYYY-MM-DD dates (optional; converted to UTC range in query)
  - tzOffsetMinutes: -840..840 (required)
  - cursor: string | undefined (optional)
  - limit: 1..100, default 50 (optional)
  
- [ ] `CashSummaryQuerySchema`: query params
  - tzOffsetMinutes: -840..840 (required)
  
- [ ] `EditCashEntrySchema`: body
  - direction, amountPaise, expression, note all optional; at least one required
  - same validation as create
  
- [ ] `VoidCashEntrySchema`: body
  - reason: string | null, max 256 chars (optional)
  
- [ ] Re-use for GET /:id: parse `{ id: string }` from params

#### cashRegister.route.ts (Express)

Mount at: `/api/businesses/:businessId/cash-entries` (in `server/src/index.ts` registration).

Middleware stack per endpoint:
```
requireAuth 
  → assertBusinessIdMatch (inline, 5 lines: req.params.businessId === req.user.businessId)
    → idempotencyCheck() [POST/PATCH/DELETE only]
      → requirePermission('cashRegister.<verb>')
        → validate(zodSchema)
          → asyncHandler(thinController)
```

Endpoint handlers (thin, 10–15 LOC each):

| HTTP | Path | Permission | Idempotent | Controller |
|---|---|---|---|---|
| POST | `/` | `cashRegister.create` | YES | extract body → call createCashEntry → 201 |
| GET | `/` | `cashRegister.view` | n/a | extract query → call listCashEntries → 200 |
| GET | `/summary` | `cashRegister.view` | n/a | extract query → call getCashSummary → 200 |
| GET | `/:id` | `cashRegister.view` | n/a | extract params → call getCashEntry → 200 or 404 |
| PATCH | `/:id` | `cashRegister.edit` | YES | extract body + params → call editCashEntry → 200 or 409 |
| POST | `/:id/void` | `cashRegister.edit` | YES | extract body + params → call voidCashEntry → 200 or 409 |
| POST | `/:id/restore` | `cashRegister.edit` | YES | extract params → call restoreCashEntry → 200 or 409 |
| DELETE | `/:id` | `cashRegister.delete` | YES | **ALSO call requireOwner()** after requirePermission → call hardDeleteCashEntry → 200 or 403 or 409 |

Error responses (consistent across all endpoints):
```ts
// 400 Validation / Expression
{ success: false, error: { code: 'VALIDATION_ERROR' | 'EXPRESSION_MISMATCH', message: '...' } }

// 401 Auth
{ success: false, error: { code: 'UNAUTHORIZED' } }

// 403 Permission
{ success: false, error: { code: 'FORBIDDEN' | 'FORBIDDEN_OWNER_ONLY' } }

// 404 Not found
{ success: false, error: { code: 'NOT_FOUND' } }

// 409 State conflict
{ success: false, error: { code: 'CONFLICT', message: '...' } }

// 200 / 201 Success
{ success: true, entry?: CashEntryDTO }
```

#### cashRegister.types.ts

```ts
interface CashEntryDTO {
  id: string
  businessId: string
  direction: 'IN' | 'OUT'
  amountPaise: number
  expression: string
  note: string | null
  idempotencyKey: string
  editCount: number
  voidedAt: string | null         // ISO UTC
  voidedBy: string | null         // BusinessUser.id
  voidReason: string | null
  ledgerJournalId: string | null  // reserved, always null in Phase 1
  createdBy: string               // BusinessUser.id
  createdAt: string               // ISO UTC
  updatedAt: string               // ISO UTC
}

interface CashSummaryDTO {
  today: { inPaise: number; outPaise: number; netPaise: number; count: number }
  last7Days: Array<{
    date: string                  // YYYY-MM-DD local
    inPaise: number
    outPaise: number
    netPaise: number
    count: number
  }>
  last30: { inPaise: number; outPaise: number; netPaise: number; count: number }
  range: { from: string; to: string }  // ISO UTC start/end of summary window
}

type CashEntryEventType = 'CREATED' | 'EDITED' | 'VOIDED' | 'RESTORED' | 'HARD_DELETED'

interface CashEntryEventPayload {
  CREATED: { direction: 'IN'|'OUT'; amountPaise: number; expression: string; note?: string }
  EDITED: { before: Partial<CashEntryDTO>; after: Partial<CashEntryDTO>; changedFields: string[] }
  VOIDED: { reason?: string }
  RESTORED: { priorReason?: string }
  // HARD_DELETED is written to AuditLog, not CashEntryEvent
}
```

#### index.ts

```ts
export * from './cashRegister.types'
export * from './cashRegister.constants'
export { cashRegisterRouter } from './cashRegister.route'
```

Then in `server/src/index.ts`, register the router:
```ts
import { cashRegisterRouter } from './features/cash-register'
// ...
app.use('/api/businesses/:businessId/cash-entries', cashRegisterRouter)
```

### Proof gate

**BLOCKED until all of:**

- [ ] `npx tsc --noEmit` in `server/` returns 0 errors (0 type errors, 0 warnings)
- [ ] `npx tsc --noEmit` in client app returns 0 errors
- [ ] All 9 files combined < 1100 LOC
- [ ] No file > 250 LOC
- [ ] curl POST /api/businesses/:bId/cash-entries (valid payload + X-Idem-Key) → 201 + entry DTO
- [ ] curl POST same request (same X-Idem-Key) → 200 + same entry.id (idempotent)
- [ ] curl POST (no auth cookie) → 401 UNAUTHORIZED
- [ ] curl POST (user not member of :bId) → 403 FORBIDDEN
- [ ] curl POST (user in business but no cashRegister.create) → 403 FORBIDDEN
- [ ] curl POST (valid expression, amountPaise wrong) → 400 EXPRESSION_MISMATCH
- [ ] curl POST (invalid expression like "10++5") → 400 VALIDATION_ERROR
- [ ] curl POST (division by zero "10/0") → 400 VALIDATION_ERROR
- [ ] curl GET /summary?tzOffsetMinutes=330 → 200 + { last7Days.length === 7 } + correct net totals
- [ ] curl PATCH /:id (edit voided entry) → 409 CONFLICT with message
- [ ] curl POST /:id/void twice (second call) → 409 CONFLICT
- [ ] curl DELETE /:id (active entry) → 409 CONFLICT
- [ ] curl DELETE /:id (voided entry, manager role) → 403 FORBIDDEN_OWNER_ONLY
- [ ] curl DELETE /:id (voided entry, owner role) → 200 + row deleted from DB + AuditLog row written
- [ ] Git diff shows only new files in `server/src/features/cash-register/` + schema.prisma + migration

**Submit:**  
- **Proof 1:** Terminal screenshot showing all tsc checks passing
- **Proof 2:** curl command output showing all 16 scenarios (201, 200 idem, 401, 403 × 2, 400 × 3, 200 summary, 409 × 3, 403 owner-only, 200 delete, 200 voided delete)
- **Proof 3:** Database query showing CashEntryEvent rows for lifecycle test (create → edit → void → restore scenario) with correct event types
- **Proof 4:** AuditLog query showing HARD_DELETED event with full entry snapshot

---

## Task 4: Frontend Implementation

**Agent:** DudhHisaab-Frontend-Builder  
**Must run:** `/design` skill first to load hp-design tokens  
**PR destination:** hisaabpro / master  
**Priority:** P0 (after Task 3 backend proof)  
**Proof gate:** See "Proof Gate — Frontend" below

### Scope

Implement Cash Register page with two tabs (Calculator, History), 14 components, 
state machines, and 4 UI states per major panel. Uses hp-design tokens, Tailwind 4, 
TanStack Query, React 19. Online-only MVP. Responsive 320–375px+.

### File structure (25 files, ≤250 LOC each)

```
src/features/cash-register/
  index.ts                              — re-exports
  cashRegister.types.ts                 — DayBucket, Filter, Sort, Tab, ExpressionState (~60 LOC)
  cashRegister.constants.ts             — KEYPAD_KEYS, MAX_EXPRESSION_LEN, OPERATORS, LARGE_AMOUNT (~40 LOC)
  cashRegister.utils.ts                 — formatPaise, formatPaiseCompact, buildDayBuckets, applyHistoryView, getTzOffsetMinutes (~120 LOC)
  cashRegister.evaluator.ts             — safeEvaluate (recursive-descent, mirrors server, ~120 LOC)
  cashRegister.reducer.ts               — expression state machine: appendDigit, appendOp, backspace, clear (~100 LOC)
  cashRegister.service.ts               — api() wrappers: post, list, getSummary, get, patch, void, restore, delete (~80 LOC)
  useCashRegisterQueries.ts             — TanStack Query hooks: useCashSummary, useCashHistory (~80 LOC)
  useCashRegisterMutations.ts           — TanStack Query mutations: useCreate, useEdit, useVoid, useRestore, useDelete (~80 LOC)
  useCashCalculator.ts                  — page-level state: expression reducer + mutations + summary query (~100 LOC)
  
  components/
    CashRegisterPage.tsx                — shell, tab toggle, dialog orchestration (~150 LOC)
    CalculatorPanel.tsx                 — display + keypad + note + buttons composition (~120 LOC)
    CalculatorDisplay.tsx               — expression + live Rs total + error/warning chip (~80 LOC)
    Keypad.tsx                          — 4×4 grid, pure presentational (~80 LOC)
    NoteField.tsx                       — optional note textarea, maxLength 256 (~60 LOC)
    CommitButtons.tsx                   — Cash In / Cash Out paired buttons, loading states (~70 LOC)
    HistoryPanel.tsx                    — summary header + controls + list orchestration (~100 LOC)
    CashSummaryHeader.tsx               — today + 7-day bars + 30-day tile, loading skeleton (~120 LOC)
    HistoryControls.tsx                 — direction filter pills + sort dropdown (~80 LOC)
    HistoryList.tsx                     — day-bucketed virtualized list, infinite scroll (~150 LOC)
    HistoryEntryRow.tsx                 — single row: amount, badges, kebab actions (~100 LOC)
    EditEntryDrawer.tsx                 — bottom drawer with calculator state reuse (~100 LOC)
    VoidConfirmDialog.tsx               — confirm + reason field (~80 LOC)
    DeleteConfirmDialog.tsx             — hard-delete confirm, voided-only message (~70 LOC)
    LargeAmountWarningDialog.tsx        — Rs 10L threshold, confirm/cancel (~60 LOC)
```

### Implementation checklist

#### types.ts

```ts
export interface CashEntryDTO {
  // from server
}

export interface DayBucket {
  date: string              // YYYY-MM-DD
  entries: CashEntryDTO[]
  inPaise: number
  outPaise: number
  netPaise: number
}

export interface CashHistoryFilter {
  direction?: 'IN' | 'OUT'
  includeVoided: boolean
}

export interface CashHistorySort {
  by: 'newest' | 'oldest' | 'highest' | 'lowest'
}

export type CashRegisterTab = 'calculator' | 'history'

export interface ExpressionState {
  display: string
  tokens: Token[]
  error: string | null
}

interface Token {
  type: 'number' | 'operator' | 'paren'
  value: string
}
```

#### utils.ts

- [ ] `formatPaise(paise: number): string` → "₹1,23,456.78" (Indian Rupee format)
- [ ] `formatPaiseCompact(paise: number): string` → "₹1.2L" if >= 100,000
- [ ] `buildDayBuckets(entries: CashEntryDTO[]): DayBucket[]` → group by local date, compute totals
- [ ] `applyHistoryView(entries, filter, sort): DayBucket[]` → filter + sort + bucket
- [ ] `getTzOffsetMinutes(): number` → from `Intl.DateTimeFormat().resolvedOptions().timeZone` and local/UTC offset calculation

#### evaluator.ts (MUST match server exactly)

- [ ] Recursive-descent parser (identical to `server/src/features/cash-register/expression.ts`)
- [ ] `safeEvaluate(expr: string): { paise: number | null; error: ExpressionErrorType | null }`
- [ ] Returns `{ paise: 1500, error: null }` on success; `{ paise: null, error: 'DIVIDE_BY_ZERO' }` on error
- [ ] 30 golden fixtures (same as server) to verify parity

#### reducer.ts (expression state machine)

```ts
type ExpressionAction = 
  | { type: 'APPEND_DIGIT'; digit: string }
  | { type: 'APPEND_OPERATOR'; op: '+' | '-' | '*' | '/' }
  | { type: 'APPEND_PAREN'; which: '(' | ')' }
  | { type: 'BACKSPACE' }
  | { type: 'CLEAR' }

function expressionReducer(state: ExpressionState, action: ExpressionAction): ExpressionState {
  // Pure function; updates display, tokens, and error
}
```

Behaviors:
- Append digit: add to display if < 128 chars
- Append operator: add to display; validate tokens (no double-operator, etc.)
- Backspace: remove last char
- Clear: reset to empty state
- Constraints: prevent invalid syntax (double operators, dangling operators, unmatched parens)

#### service.ts (thin api() wrappers)

Each function is 5–10 LOC. All use `api()` from `@/lib/api`, pass `entityType:'cashEntry'` and `entityLabel`.

```ts
export async function postCashEntry(args: {
  businessId: string
  direction: 'IN' | 'OUT'
  amountPaise: number
  expression: string
  note: string | null
  idempotencyKey: string
}): Promise<CashEntryDTO> {
  return api<{ success: true; entry: CashEntryDTO }>('/cash-entries', {
    method: 'POST',
    body: JSON.stringify({
      direction: args.direction,
      amountPaise: args.amountPaise,
      expression: args.expression,
      note: args.note,
    }),
    entityType: 'cashEntry',
    entityLabel: formatPaise(args.amountPaise),
    headers: { 'X-Idempotency-Key': args.idempotencyKey },
  }).then(res => res.entry)
}

export async function listCashEntries(args: {
  businessId: string
  direction?: 'IN' | 'OUT'
  includeVoided?: boolean
  from?: string        // YYYY-MM-DD
  to?: string          // YYYY-MM-DD
  tzOffsetMinutes: number
  cursor?: string
  limit?: number
}): Promise<{ entries: CashEntryDTO[]; nextCursor: string | null }> {
  const params = new URLSearchParams()
  if (args.direction) params.set('direction', args.direction)
  if (args.includeVoided) params.set('includeVoided', 'true')
  if (args.from) params.set('from', args.from)
  if (args.to) params.set('to', args.to)
  params.set('tzOffsetMinutes', String(args.tzOffsetMinutes))
  if (args.cursor) params.set('cursor', args.cursor)
  if (args.limit) params.set('limit', String(args.limit))
  
  return api<{ success: true; entries: CashEntryDTO[]; nextCursor: string | null }>(
    `/cash-entries?${params}`,
    { method: 'GET' }
  ).then(res => ({ entries: res.entries, nextCursor: res.nextCursor }))
}

export async function getCashSummary(args: {
  businessId: string
  tzOffsetMinutes: number
}): Promise<CashSummaryDTO> { ... }

export async function getCashEntry(args: {
  businessId: string
  id: string
}): Promise<CashEntryDTO> { ... }

export async function patchCashEntry(args: {
  businessId: string
  id: string
  patch: { direction?: 'IN'|'OUT'; amountPaise?: number; expression?: string; note?: string | null }
  idempotencyKey: string
}): Promise<CashEntryDTO> { ... }

export async function voidCashEntry(args: {
  businessId: string
  id: string
  reason: string | null
  idempotencyKey: string
}): Promise<CashEntryDTO> { ... }

export async function restoreCashEntry(args: {
  businessId: string
  id: string
  idempotencyKey: string
}): Promise<CashEntryDTO> { ... }

export async function deleteCashEntry(args: {
  businessId: string
  id: string
  idempotencyKey: string
}): Promise<void> { ... }
```

#### useCashRegisterQueries.ts

- [ ] `useCashSummary(businessId, tzOffsetMinutes)`: TanStack Query, key = `['cashSummary', businessId, tzOffsetMinutes]`, network-only (no cacheReads)
- [ ] `useCashHistory(businessId, filter, sort, tzOffsetMinutes)`: useInfiniteQuery, key = `['cashHistory', businessId, filter, sort, tzOffsetMinutes]`, network-only

#### useCashRegisterMutations.ts

Each is a standard `useMutation` with `onSuccess` invalidating related queries:

- [ ] `useCreateCashEntry()`: calls postCashEntry, invalidates both cashHistory + cashSummary
- [ ] `useEditCashEntry()`: calls patchCashEntry, invalidates cashHistory + cashSummary
- [ ] `useVoidCashEntry()`: calls voidCashEntry, invalidates cashHistory + cashSummary
- [ ] `useRestoreCashEntry()`: calls restoreCashEntry, invalidates cashHistory + cashSummary
- [ ] `useDeleteCashEntry()`: calls deleteCashEntry, invalidates cashHistory

#### useCashCalculator.ts

Page-level hook managing:
- Expression reducer (append digit, operator, backspace, clear)
- Live evaluation via memoized safeEvaluate
- Create mutation dispatch
- Summary query for live totals
- Error state

Returns object:
```ts
{
  expression: string
  liveTotalPaise: number | null
  error: string | null
  warning: string | null
  dispatch: (action) => void
  commit: (direction: 'IN'|'OUT') => Promise<void>
  isSubmitting: boolean
  summary: CashSummaryDTO | undefined
}
```

#### CashRegisterPage.tsx (shell, ~150 LOC)

```tsx
export default function CashRegisterPage() {
  const [tab, setTab] = useState<CashRegisterTab>('calculator')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [deletingId, setDeleteingId] = useState<string | null>(null)
  const [warningPaise, setWarningPaise] = useState<number | null>(null)

  const calc = useCashCalculator()
  const { data: entry } = useCashEntry(editingId)

  const handleCommit = (direction: 'IN' | 'OUT') => {
    if (calc.liveTotalPaise && calc.liveTotalPaise > LARGE_AMOUNT_PAISE) {
      setWarningPaise(calc.liveTotalPaise)
      return
    }
    calc.commit(direction)
  }

  const handleConfirmLarge = () => {
    calc.commit(...)  // cached direction
    setWarningPaise(null)
  }

  return (
    <div data-hide-bottom-nav>
      <PageHeader title="Cash Register" />
      <TabToggle value={tab} onChange={setTab} />
      
      {tab === 'calculator' ? (
        <CalculatorPanel
          expression={calc.expression}
          liveTotalPaise={calc.liveTotalPaise}
          error={calc.error}
          warning={calc.warning}
          onKey={calc.dispatch}
          onCommit={handleCommit}
          isSubmitting={calc.isSubmitting}
        />
      ) : (
        <HistoryPanel
          onEdit={setEditingId}
          onVoid={setVoidingId}
          onDelete={setDeleteingId}
        />
      )}

      {entry && (
        <EditEntryDrawer
          entry={entry}
          onClose={() => setEditingId(null)}
        />
      )}

      {voidingId && (
        <VoidConfirmDialog
          entryId={voidingId}
          onClose={() => setVoidingId(null)}
        />
      )}

      {deletingId && (
        <DeleteConfirmDialog
          entryId={deletingId}
          onClose={() => setDeleteingId(null)}
        />
      )}

      {warningPaise && (
        <LargeAmountWarningDialog
          paise={warningPaise}
          onConfirm={handleConfirmLarge}
          onCancel={() => setWarningPaise(null)}
        />
      )}
    </div>
  )
}
```

Four UI states per major panel:
- **Calculator Loading:** commit button shows spinner, keypad enabled
- **Calculator Error:** error banner with exact API message below display
- **Calculator Empty:** placeholder "Enter amount" in display
- **Calculator Success:** toast fires, expression clears

- **History Loading:** 3 skeleton rows (HistoryEntryRow skeleton)
- **History Error:** inline card "Could not load history. Tap to retry."
- **History Empty:** Inbox icon + message matching current filter
- **History Success:** day-bucketed list with summary header sticky

#### CalculatorPanel.tsx (~120 LOC)

Composition wrapper. Props: expression, liveTotalPaise, error, warning, onKey, onCommit, onChangeNote, note, isSubmitting.

Renders:
```
CalculatorDisplay (expression + live total + error/warning chip)
Keypad (4×4 grid)
NoteField (optional note textarea)
CommitButtons (Cash In / Cash Out)
```

#### CalculatorDisplay.tsx (~80 LOC)

Shows:
- Expression string (monospace, scrollable if long)
- Live total in Rs format (e.g. "₹850.50")
- Error or warning chip below (e.g. "Cannot divide by zero")

Four states:
- Loading: display enabled, total shows "–" (en-dash)
- Error: display enabled, chip red with error text
- Empty: placeholder text "Enter amount"
- Success: display shows expression + live total

#### Keypad.tsx (~80 LOC)

Pure presentational. 4 rows × 4 cols:
```
[ 7 ] [ 8 ] [ 9 ] [ / ]
[ 4 ] [ 5 ] [ 6 ] [ * ]
[ 1 ] [ 2 ] [ 3 ] [ - ]
[ 0 ] [ . ] [ C ] [ + ]
```

Each key: min 56px × 56px. On tap: `onKey({ type: 'DIGIT'|'OPERATOR', value: key })`.

#### NoteField.tsx (~60 LOC)

Optional textarea: `Add note (optional)`, maxLength 256, placeholder "e.g. delivery, rent, misc".
Props: value, onChange.

#### CommitButtons.tsx (~70 LOC)

Two buttons side-by-side (50% width each):
- "Cash In" (green, triggers IN direction)
- "Cash Out" (red, triggers OUT direction)

When isSubmitting: show spinner, disable both.

#### HistoryPanel.tsx (~100 LOC)

Orchestrates:
```
CashSummaryHeader (loading/error/empty/success)
HistoryControls (filter + sort)
HistoryList (day-bucketed virtualized list)
```

#### CashSummaryHeader.tsx (~120 LOC)

Shows:
- Today: "Today ₹X (In: ₹Y, Out: ₹Z)"
- 7-day bar chart (7 bars, one per day)
- 30-day: "Last 30 Days ₹X"

Four states:
- Loading: shimmer placeholder
- Error: all values show "–"
- Empty: all Rs 0 (valid, not an error)
- Success: full data

#### HistoryControls.tsx (~80 LOC)

Filter pills: All / In / Out (mutually exclusive)
Sort dropdown: Newest / Oldest / Highest / Lowest

#### HistoryList.tsx (~150 LOC)

Virtualized list (react-window or tanstack virtualizer) with day-bucket headers sticky at top.

```tsx
<VirtualList
  items={dayBuckets}
  overscan={5}
  renderItem={(bucket) => (
    <>
      <DayBucketHeader date={bucket.date} />
      {bucket.entries.map(entry => <HistoryEntryRow key={entry.id} ... />)}
    </>
  )}
/>
```

Infinite scroll: triggers `fetchNextPage` when scrolling near bottom.

#### HistoryEntryRow.tsx (~100 LOC)

Single row:
- Amount: Rs format (right-aligned)
- Expression: monospace, left-aligned (truncated if long)
- Badges: "Edited" (if editCount > 0), "Voided" (if voidedAt)
- Kebab menu (Edit, Void/Restore, Delete if voided+owner)

#### EditEntryDrawer.tsx (~100 LOC)

Bottom drawer opened from HistoryEntryRow "Edit" action.

Reuses CalculatorPanel state machine (Keypad, CalculatorDisplay, NoteField).

Props: entry (pre-filled), onClose, onSave.

Save button: "Save Changes", shows spinner while isSubmitting. On success: drawer closes, toast fires.

#### VoidConfirmDialog.tsx (~80 LOC)

Confirm title: "Void this entry?"
Description: "This entry will be marked as voided. You can restore it later."
Reason field: "Reason (optional)", maxLength 256
Button: "Void Entry"

#### DeleteConfirmDialog.tsx (~70 LOC)

Confirm title: "Delete permanently?"
Description: "This cannot be undone. Only voided entries can be deleted."
Button: "Delete"

Only visible if entry.voidedAt IS NOT NULL (enforced by parent page logic).

#### LargeAmountWarningDialog.tsx (~60 LOC)

Title: "Amount is Rs [X]. Confirm?"
Description: "This is higher than usual. Confirm to proceed."
Buttons: "Cancel", "Confirm"

Dismissible on Cancel; on Confirm, retries the commit with same direction.

### Integration checklist

- [ ] All routes behind auth (`requireAuth` middleware)
- [ ] All queries/mutations scoped by `businessId` from URL
- [ ] All API calls via `api()` wrapper (never raw fetch)
- [ ] All mutations carry `entityType:'cashEntry'` + `entityLabel` (OFFLINE_RULES Rule 2)
- [ ] No `cacheReads: true` on cash history/summary (PII-safe concern; notes carry data)
- [ ] No `localStorage` writes for entry data (use Dexie / sessionStorage if needed)
- [ ] Offline: show toast "No internet connection. Please retry." (online-only MVP; Phase 2 queue)
- [ ] No `console.log` in feature code (checked by eslint)
- [ ] No `: any` types (checked by tsc)
- [ ] Mutation handlers do NOT deref response fields without guards (handle optimistic `{}` return)
- [ ] React Query mutations invalidate correct keys on success

### Mobile layout (320–375px+)

- [ ] Calculator panel: full viewport height, no scroll (keypad + display + buttons + note all visible)
- [ ] Keypad: 4 cols × 4 rows, each key ≥ 56px × 56px
- [ ] Cash In / Cash Out buttons: full-width row, 50% each, ≥ 52px height
- [ ] Note field: below keypad, textarea scrollable if needed
- [ ] History panel: scrollable list; summary header sticky top
- [ ] Tab toggle: visible at top
- [ ] Back button: top-left
- [ ] No horizontal overflow at 320px — all amounts use formatPaiseCompact
- [ ] Bottom nav hidden: `data-hide-bottom-nav="true"` on page root

### Proof gate

**BLOCKED until all of:**

- [ ] `npx tsc --noEmit` (frontend) returns 0 errors
- [ ] All 25 files combined < 3500 LOC; no file > 250 LOC
- [ ] No raw `fetch()` calls in feature code (all via api() wrapper)
- [ ] No `localStorage` writes for entity data
- [ ] No `console.log` statements in feature code
- [ ] No `: any` type annotations
- [ ] All mutations pass entityType + entityLabel to api()
- [ ] Browser console: 0 errors on happy path (create → edit → void → restore)
- [ ] Browser console: 0 warnings (tighten eslint if needed)
- [ ] enforce-offline.mjs script passes (no new violations)
- [ ] Screenshot: Calculator page, empty expression (placeholder visible)
- [ ] Screenshot: Calculator page, valid expression "100+50*2" showing Rs 200 total
- [ ] Screenshot: Calculator page, invalid expression "10++5" with error chip
- [ ] Screenshot: Calculator page, submitting state (button spinner, keypad enabled)
- [ ] Screenshot: History page, loading state (3 skeleton rows)
- [ ] Screenshot: History page, empty state (Inbox icon + "No cash entries yet")
- [ ] Screenshot: History page, populated list (3+ entries with summary header sticky)
- [ ] Screenshot: Edit drawer, pre-filled expression
- [ ] Screenshot: Void confirm dialog
- [ ] Screenshot: Delete confirm dialog
- [ ] Screenshot: Large-amount warning dialog
- [ ] Screenshot: 320px viewport — calculator tab keypad fully visible, no horizontal scroll
- [ ] Screenshot: 320px viewport — history tab list no horizontal scroll
- [ ] Screenshot: 375px viewport — full page layout
- [ ] Hindi i18n: all strings render in Hindi when language is switched (0 missing-key fallbacks)
- [ ] Git diff shows only new files in `src/features/cash-register/` + i18n key additions

**Submit:**
- **Proof 1:** Terminal screenshot showing tsc clean + enforce-offline.mjs passing
- **Proof 2:** Browser console screenshot (no errors, no warnings)
- **Proof 3–21:** 19 screenshots (per checklist above)
- **Proof 22:** Hindi screenshot
- **Proof 23:** Git diff highlighting only feature files + i18n additions

---

## Task 5: i18n + Capacitor Haptics

**Agent:** DudhHisaab-Frontend-Builder (or same team)  
**PR destination:** hisaabpro / master  
**Priority:** P1 (after Task 4)

### Scope

Add Hindi i18n keys to `src/i18n/locales/{en,hi}.json`. 
Integrate Capacitor Haptics on IN/OUT button tap (graceful fallback if unavailable).

### Changes required

#### i18n keys (~80 keys)

Namespace: `cashReg.*` (follows HP convention).

```json
{
  "cashReg": {
    "title": "Cash Register",
    "tabCalculator": "Calculator",
    "tabHistory": "History",
    "placeholderEnterAmount": "Enter amount",
    "buttonCashIn": "Cash In",
    "buttonCashOut": "Cash Out",
    "labelNote": "Add note (optional)",
    "placeholderNote": "e.g. delivery, rent, misc",
    "toastCashInSaved": "Cash In saved",
    "toastCashOutSaved": "Cash Out saved",
    "toastErrorSave": "Could not save. Try again.",
    "drawerTitle": "Edit Entry",
    "drawerSaveButton": "Save Changes",
    "toastEntryUpdated": "Entry updated",
    "voidDialogTitle": "Void this entry?",
    "voidDialogDescription": "This entry will be marked as voided. You can restore it later.",
    "labelVoidReason": "Reason (optional)",
    "voidDialogButton": "Void Entry",
    "toastEntryVoided": "Entry voided",
    "toastEntryRestored": "Entry restored",
    "deleteDialogTitle": "Delete permanently?",
    "deleteDialogDescription": "This cannot be undone. Only voided entries can be deleted.",
    "deleteDialogButton": "Delete",
    "toastEntryDeleted": "Entry deleted",
    "emptyAllEntries": "No cash entries yet",
    "emptyOnlyIn": "No Cash In entries",
    "emptyOnlyOut": "No Cash Out entries",
    "summaryToday": "Today",
    "summaryLast7Days": "Last 7 Days",
    "summaryLast30Days": "Last 30 Days",
    "summaryIn": "In",
    "summaryOut": "Out",
    "summaryNet": "Net",
    "errorInvalidExpression": "Invalid expression",
    "errorDivideByZero": "Cannot divide by zero",
    "errorAmountHigh": "Amount is Rs {amount}. Confirm?",
    "errorNoInternet": "No internet connection. Please retry.",
    "errorRestoreBeforeEdit": "Restore the entry before editing",
    "errorAlreadyVoided": "Entry is already voided",
    "errorNotVoided": "Entry is not currently voided",
    "filterAll": "All",
    "sortLabel": "Sort by",
    "sortNewest": "Newest",
    "sortOldest": "Oldest",
    "sortHighest": "Highest",
    "sortLowest": "Lowest",
    "badgeVoided": "Voided",
    "badgeEdited": "Edited"
  }
}
```

Full translations in `hi.json` (same keys, translated to Hindi).

#### Capacitor Haptics integration

In `CommitButtons.tsx` or the mutation success handler, add:

```tsx
import { Haptics, ImpactStyle } from '@capacitor/haptics'

const handleCommitSuccess = async (direction: 'IN' | 'OUT') => {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch (e) {
    // Graceful fallback: haptic unavailable on web or old devices
  }
  
  toast.success(direction === 'IN' ? t('cashReg.toastCashInSaved') : t('cashReg.toastCashOutSaved'))
}
```

Fire-and-forget, no blocking. Plugin already installed (existing in HP).

### Proof gate

**BLOCKED until:**

- [ ] `src/i18n/locales/en.json` contains all ~80 `cashReg.*` keys
- [ ] `src/i18n/locales/hi.json` contains all ~80 keys with Hindi translations
- [ ] Browser screenshot: app in English, all strings render (no "i18n key missing" fallbacks)
- [ ] Browser screenshot: app switched to Hindi, all strings render in Hindi (no fallbacks)
- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] Git diff shows only i18n files + haptics code changes

**Submit:**  
Screenshots (EN + HI) showing all UI states with correct translations.

---

## Task 6: Verifier Proof Gate

**Agent:** Verifier  
**PR destination:** hisaabpro / master  
**Priority:** P1 (before QA)

### Scope

Run comprehensive proof suite: tsc clean, curl matrix, screenshots, console audit.

### Proof checklist

**Tsc clean:**
- [ ] `npx tsc --noEmit` (server) → 0 errors
- [ ] `npx tsc --noEmit` (frontend) → 0 errors

**curl matrix (8 scenarios per the acceptance criteria):**
- [ ] POST /cash-entries (valid payload) → 201 + entry DTO
- [ ] POST /cash-entries (replay same X-Idem-Key) → 200 same entry.id (idempotent)
- [ ] POST /cash-entries (no auth) → 401 UNAUTHORIZED
- [ ] POST /cash-entries (user not in business) → 403 FORBIDDEN
- [ ] POST /cash-entries (missing cashRegister.create) → 403 FORBIDDEN
- [ ] POST /cash-entries (invalid expression) → 400 VALIDATION_ERROR
- [ ] POST /cash-entries (division by zero) → 400 VALIDATION_ERROR
- [ ] GET /summary?tzOffsetMinutes=330 → 200 + { last7Days.length === 7 }
- [ ] PATCH /:id (voided entry) → 409 CONFLICT
- [ ] POST /:id/void (twice) → 200 then 409 CONFLICT
- [ ] DELETE /:id (active) → 409 CONFLICT
- [ ] DELETE /:id (voided, manager) → 403 FORBIDDEN_OWNER_ONLY
- [ ] DELETE /:id (voided, owner) → 200 (deleted)

**Screenshots (mobile & desktop):**
- [ ] Calculator: empty (placeholder visible)
- [ ] Calculator: valid expression with live total
- [ ] Calculator: invalid expression with error
- [ ] Calculator: submitting (button spinner)
- [ ] History: loading skeleton
- [ ] History: empty state
- [ ] History: populated with summary
- [ ] Edit drawer
- [ ] Void dialog
- [ ] Delete dialog
- [ ] 320px: no horizontal scroll
- [ ] 375px: full layout
- [ ] Hindi: all strings in Hindi

**Console audit:**
- [ ] 0 errors on happy path (create → edit → void → restore)
- [ ] 0 warnings on happy path
- [ ] No `console.log` statements in feature code
- [ ] enforce-offline.mjs passes (no new violations)

### Output

Write proof report to `/tmp/CASH_REGISTER_PROOF_<timestamp>.txt` or embed screenshots 
in a markdown file for QA review.

---

## Task 7: QA Gate & Acceptance

**Agent:** qa  
**PR destination:** hisaabpro / master  
**Priority:** P1 (final)

### Scope

Cross-check all acceptance criteria from `design-plan-active.md` and SCOPE against 
Verifier proof report. Approve or reject.

### Acceptance checklist (from design-plan-active.md)

**Backend:**
- [ ] tsc clean (server + client)
- [ ] Migration A: CashEntry + CashEntryEvent + enums + indexes present
- [ ] Migration B: permissions registry updated, Manager role has 4 new permissions
- [ ] curl POST happy path → 201 + entry
- [ ] curl POST idempotent → 200 same id
- [ ] curl no auth → 401
- [ ] curl invalid expression → 400 INVALID_EXPRESSION
- [ ] curl division by zero → 400 DIVISION_BY_ZERO
- [ ] curl PATCH (manager, own entry) → 200
- [ ] curl void with reason → 200; entry excluded from summaries
- [ ] curl restore → 200; entry re-included
- [ ] curl DELETE (manager) → 403 FORBIDDEN_OWNER_ONLY
- [ ] curl DELETE (owner, voided) → 200; AuditLog row written
- [ ] Per-business tx on all mutations
- [ ] Recursive-descent evaluator with no eval
- [ ] Audit events: CREATED, EDITED, VOIDED, RESTORED, HARD_DELETED

**Frontend:**
- [ ] Calculator: 4 UI states screenshots
- [ ] History: 4 UI states screenshots
- [ ] Edit drawer screenshot
- [ ] Void dialog screenshot
- [ ] Delete dialog screenshot
- [ ] 320px tested
- [ ] 375px tested
- [ ] Hindi i18n (0 missing keys)
- [ ] Console clean
- [ ] All API calls via api() wrapper
- [ ] All mutations carry entityType + entityLabel
- [ ] Capacitor haptic on IN/OUT
- [ ] Bottom nav entry visible
- [ ] Each file ≤ 250 LOC

### Final approval

QA approves (or rejects with violation list). If approved, feature moves to DONE.

---

## Dependency Graph

```
Task 1 (Schema)
  ↓
Task 2 (Permissions seed)
  ↓
Task 3 (Backend) ← blocks on Task 2
  ↓
Task 4 (Frontend) ← blocks on Task 3
  ↓
Task 5 (i18n + Haptics) ← optional parallel with Task 4
  ↓
Task 6 (Verifier) ← blocks on Task 4 + 5
  ↓
Task 7 (QA) ← blocks on Task 6
  ↓
DONE
```

---

## Proof Gate Matrix

| Gate | Triggered by | Proof required | Blocker if missing |
|---|---|---|---|
| After Task 1 | Migration commit | tsc clean + migration status | ✅ cannot merge without |
| After Task 2 | Seed commit | DB query showing Manager permissions | ✅ cannot merge without |
| After Task 3 | Backend PR | 13 curl scenarios + tsc clean + git diff | ✅ BLOCKED_NO_PROOF |
| After Task 4 | Frontend PR | 20 screenshots + console clean + tsc + enforce-offline | ✅ BLOCKED_NO_PROOF |
| After Task 5 | i18n + Haptics PR | EN + HI screenshots | ✅ BLOCKED_NO_PROOF |
| After Task 6 | Verifier report | Comprehensive proof matrix | ✅ BLOCKED_NO_PROOF if gaps |
| After Task 7 | QA approval | All acceptance items checked ✅ | ✅ APPROVED or REJECTED |

---

## Notes for Orchestration

1. **Never skip a task.** Each gate depends on proof from prior gates.
2. **File size enforcement:** enforce-offline.mjs ratchet catches violations. Run before commit.
3. **Schema-first:** Always schema → seed → backend → frontend. No ordering flexibility here.
4. **API calls:** All via `api()` from `@/lib/api`. No exceptions.
5. **Offline MVP:** Online-only Phase 1. Phase 2 adds queue. For now, show "No internet" toast.
6. **Idempotency:** Three layers (client nonce + middleware + DB unique). All three must be present.
7. **Permissions:** MUST add to permissions-data registry even though owner bypasses. System hygiene.
8. **Hard-delete:** Owner-only. Manager receives 403. AuditLog row written before deletion.
9. **Audit events:** All 5 types (CREATED, EDITED, VOIDED, RESTORED, HARD_DELETED) must appear in tests.
10. **Expression evaluator:** Server and frontend MUST match exactly. Golden fixtures are SSOT.

---

**End — Orchestration document. ~2100 lines.**
