---
feature: cash-register
status: approved
approver: Sawan
author: architect
created: 2026-05-07T05:35:00Z
scope_ref: docs/SCOPE_cash_register.md
---

# ARCHITECTURE — Cash Register

> Calculator-first petty-cash ledger. Single page, two tabs (Calculator,
> History). Online-only MVP. Multi-tenant, audited, idempotent. Zero auto-post
> to journal in Phase 1 (`ledgerJournalId` reserved).

---

## 0. Prerequisite Audit (HP codebase reality check)

Decisions Q1 + Q2 required a grep. Findings drive concrete deltas vs SCOPE.

| Item | SCOPE assumed | HP reality | Action |
|---|---|---|---|
| `requireBusinessAccess` middleware | Standalone middleware | DOES NOT exist as a named middleware. `requirePermission()` (`server/src/middleware/permission.ts`) already verifies `BusinessUser` is `isActive:true` and `status:'ACTIVE'` for the `req.user.businessId`. | DO NOT build a separate middleware. Stack `requireAuth` + `requirePermission('cashRegister.create' / .edit / .delete)` — the permission check itself enforces business access. Owner role auto-bypasses (line 51 of permission.ts). |
| Idempotency middleware | Body-keyed `idempotencyKey` field | EXISTS (`server/src/middleware/idempotency.ts`) but reads `X-Idempotency-Key` HEADER, scoped to `userId` (not businessId), backed by `IdempotencyLog` Prisma model with TTL. | Use the existing header-based middleware. Client sends `X-Idempotency-Key` header (NOT body field). Add `@@unique([businessId, idempotencyKey])` on `CashEntry` as a defence-in-depth second layer to dedupe at the data tier even if header is omitted/replayed across users in the same business. |
| Permission key namespace | `cash_entry:create` (colon) | HP convention is dot-notation: `expenses.create`, `invoicing.view`. | Use `cashRegister.create`, `cashRegister.edit`, `cashRegister.delete`, `cashRegister.view`. Add to `server/src/services/settings/permissions-data.ts` PERMISSION_GROUPS and to BOTH owner (auto via role==='owner' bypass) and Manager seed role permissions list. Q3 lock: BOTH owner and manager get all four. |
| `createdBy` semantics | `BusinessUser.id` | Confirmed (Q10). `req.user` carries `userId`+`businessId`; we resolve `BusinessUser.id` once per request. | Service layer resolves `businessUser.id` from `(userId, businessId)` and stores that on `CashEntry.createdBy` and `CashEntryEvent.actorId`. |

**No new middleware shipped by this feature.** Two prerequisites are satisfied.

---

## 1. Module Map (6-layer split, ≤250 LOC each)

### Server (`server/src/features/cash-register/`)

| Layer | File | Purpose |
|---|---|---|
| types | `cashRegister.types.ts` | DTO shapes, internal types, event payload unions |
| constants | `cashRegister.constants.ts` | `MAX_EXPRESSION_LEN=128`, `MAX_NOTE_LEN=256`, `LARGE_AMOUNT_PAISE=100000000` (Rs 10,00,000), allowed-char regex |
| utils | `expression.ts` | `validateExpression(expr, amountPaise): void` — shared evaluator (server side); throws `ExpressionError` |
| schemas | `cashRegister.schemas.ts` | Zod: `CreateCashEntrySchema`, `EditCashEntrySchema`, `VoidCashEntrySchema`, `ListCashEntriesQuerySchema`, `CashSummaryQuerySchema` |
| service (queries) | `cashRegister.queries.ts` | `listCashEntries`, `getCashEntry`, `getCashSummary` — read-only |
| service (mutations) | `cashRegister.mutations.ts` | `createCashEntry`, `editCashEntry`, `voidCashEntry`, `restoreCashEntry`, `hardDeleteCashEntry` — each opens its own transaction |
| service (events) | `cashRegister.events.ts` | `appendCashEntryEvent(tx, …)` — single helper for audit log append |
| route | `cashRegister.route.ts` | Express router; mounts middleware stack; thin handlers calling service |
| index | `index.ts` | Re-exports for `server/src/index.ts` registration |

Server total: ~9 files, target < 1100 LOC combined.

### Frontend (`src/features/cash-register/`)

Per HP 6-layer split:

| Layer | File | Purpose |
|---|---|---|
| types | `cashRegister.types.ts` | `CashEntryDTO`, `DayBucket`, `CashHistoryFilter`, `CashHistorySort`, `CashRegisterTab`, `ExpressionState` |
| constants | `cashRegister.constants.ts` | `KEYPAD_KEYS`, `OPERATORS`, `MAX_EXPRESSION_LEN`, `MAX_NOTE_LEN`, `LARGE_AMOUNT_PAISE`, query keys |
| utils | `cashRegister.utils.ts` | `formatPaise`, `formatPaiseCompact`, `applyHistoryView`, `buildDayBuckets`, `getTzOffsetMinutes` |
| evaluator | `cashRegister.evaluator.ts` | `safeEvaluate(expr): { paise, error }` — recursive-descent parser, NO eval |
| reducer | `cashRegister.reducer.ts` | Expression keypad state machine: `appendDigit`, `appendOperator`, `backspace`, `clear` |
| service | `cashRegister.service.ts` | Thin `api()` wrappers (one function per endpoint) — passes `entityType:'cashEntry'`, `entityLabel`, `X-Idempotency-Key` header |
| hooks | `useCashRegisterMutations.ts` | React Query: `useCreateCashEntry`, `useEditCashEntry`, `useVoidCashEntry`, `useRestoreCashEntry`, `useHardDeleteCashEntry` |
| hooks | `useCashRegisterQueries.ts` | React Query: `useCashSummary`, `useCashHistory` (cursor-paginated infinite query) |
| hooks | `useCashCalculator.ts` | Wraps reducer + evaluator + commit dispatch — page-level state owner |
| page | `CashRegisterPage.tsx` | Shell — header, tab toggle, dialog orchestration, no business logic |

Component layer (`src/features/cash-register/components/`):

| File | Purpose |
|---|---|
| `CalculatorPanel.tsx` | display + keypad + note + commit buttons (composition only) |
| `CalculatorDisplay.tsx` | expression string + live Rs total + error/warning chip |
| `Keypad.tsx` | 4×4 grid; pure presentational |
| `NoteField.tsx` | optional 256-char note input |
| `CommitButtons.tsx` | Cash In / Cash Out paired buttons |
| `HistoryPanel.tsx` | summary header + controls + virtualised list |
| `CashSummaryHeader.tsx` | Today + 7-day bars + 30-day tile |
| `HistoryControls.tsx` | direction filter pills + sort dropdown |
| `HistoryList.tsx` | day-bucketed list, infinite-scroll trigger |
| `HistoryEntryRow.tsx` | one row, badges, kebab actions |
| `EditEntryDrawer.tsx` | bottom drawer, reuses CalculatorPanel state machine |
| `VoidConfirmDialog.tsx` | confirm + reason field |
| `DeleteConfirmDialog.tsx` | hard-delete confirm (voided only, owner-gated) |
| `LargeAmountWarningDialog.tsx` | Rs 10L threshold confirm |

Frontend total: ~25 files. Each capped at 250 LOC; tightest ones (`Keypad`, `NoteField`, `CommitButtons`, dialogs) ~50–80 LOC.

### Migrations / seed

- `server/prisma/migrations/<ts>_cash_register/migration.sql` — additive (PR1)
- `server/prisma/seed.ts` patch — add `cashRegister.*` permissions to Manager role + permissions-data registry (PR2)

### i18n

- `src/i18n/locales/en.json` and `hi.json` — add `cashReg.*` namespace (~80 keys; full list authored at impl time)

---

## 2. Database Schema

### Prisma model definitions

Add to `server/prisma/schema.prisma`:

```prisma
enum CashEntryDirection {
  IN
  OUT
}

enum CashEntryEventType {
  CREATED
  EDITED
  VOIDED
  RESTORED
  HARD_DELETED
}

model CashEntry {
  id              String             @id @default(cuid())
  businessId      String
  createdBy       String             // BusinessUser.id
  direction       CashEntryDirection
  amountPaise     Int
  expression      String             @db.VarChar(128)
  note            String?            @db.VarChar(256)
  idempotencyKey  String             @db.VarChar(128)
  editCount       Int                @default(0)
  voidedAt        DateTime?
  voidedBy        String?            // BusinessUser.id
  voidReason      String?            @db.VarChar(256)
  ledgerJournalId String?            // RESERVED — Phase 3 auto-post; null in Phase 1

  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  business        Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  events          CashEntryEvent[]

  @@unique([businessId, idempotencyKey])
  @@index([businessId, createdAt(sort: Desc)])
  @@index([businessId, direction, createdAt(sort: Desc)])
  @@index([businessId, voidedAt])
}

model CashEntryEvent {
  id          String             @id @default(cuid())
  cashEntryId String
  businessId  String             // denormalised for cheap business-scoped audit queries
  actorId     String?            // BusinessUser.id; nullable for system events
  actorName   String?            // captured at event time so audit survives rename/leave
  type        CashEntryEventType
  payload     Json               @default("{}")
  createdAt   DateTime           @default(now())

  cashEntry   CashEntry          @relation(fields: [cashEntryId], references: [id], onDelete: Cascade)

  @@index([cashEntryId])
  @@index([businessId, createdAt(sort: Desc)])
}
```

Append to `Business` model: `cashEntries CashEntry[]`.

### FK on-delete

| Relation | Behaviour | Why |
|---|---|---|
| `CashEntry.business → Business` | `Cascade` | Deleting a business removes its cash ledger (consistent with `Expense`, `Party` on the same model) |
| `CashEntryEvent.cashEntry → CashEntry` | `Cascade` | Hard-deleting a voided entry removes its event chain. Audit retention for hard-delete handled by writing a `HARD_DELETED` event to a separate retention store BEFORE the delete (see §8) — no, simpler: see §8 for the actual choice. |

> Decision: keep cascade on `CashEntryEvent`. Hard-delete is owner-only and rare;
> the audit row that matters (`HARD_DELETED`) is written to the parent
> business's `AuditLog` table (existing) rather than to `CashEntryEvent`,
> because the parent row is about to vanish. See §8.

### Indexes — design rationale

- `(businessId, createdAt DESC)` — drives default history list and summary range scans.
- `(businessId, direction, createdAt DESC)` — drives direction-filtered list + per-direction summary aggregates.
- `(businessId, voidedAt)` — drives summary aggregates (which exclude `voidedAt IS NOT NULL`); also serves "include voided" toggle.
- `(businessId, idempotencyKey)` UNIQUE — defence-in-depth idempotency at the DB tier.

### Migration ordering

**PR1 — additive only (no destructive ops):**

1. `CREATE TYPE "CashEntryDirection" AS ENUM ('IN', 'OUT');`
2. `CREATE TYPE "CashEntryEventType" AS ENUM ('CREATED','EDITED','VOIDED','RESTORED','HARD_DELETED');`
3. `CREATE TABLE "CashEntry" (...);`
4. `CREATE TABLE "CashEntryEvent" (...);`
5. All four indexes above.

No existing rows touched. No backfill. Greenfield tables. Rollback = drop tables/enums.

**PR2 — seed update:**

- Add `cashRegister` permission group to `permissions-data.ts`.
- Add the four permission strings to system Manager role permissions array
  (`Manager` role in `seed.ts` / equivalent role-bootstrap module).
- Owner already auto-bypasses via `requirePermission` line 51, so no seed
  change required for owner.
- Idempotent upsert (no-op on second run).

---

## 3. Service Layer

All service functions live in `server/src/features/cash-register/`. Pure
functions; receive prisma client; never read `req` directly.

### Public signatures

```ts
// queries.ts
export async function listCashEntries(args: {
  businessId: string
  direction?: 'IN' | 'OUT'
  includeVoided?: boolean
  fromUtc?: Date
  toUtc?: Date
  cursor?: string
  limit: number
}): Promise<{ entries: CashEntryDTO[]; nextCursor: string | null }>

export async function getCashEntry(args: {
  businessId: string
  id: string
}): Promise<CashEntryDTO | null>

export async function getCashSummary(args: {
  businessId: string
  tzOffsetMinutes: number   // -840 .. 840
  now?: Date                // injected for tests
}): Promise<CashSummaryDTO>
```

```ts
// mutations.ts — each opens its OWN transaction (per F-06 rule: per-business,
// no outer batch tx). No mutation depends on another's tx scope.

export async function createCashEntry(args: {
  businessId: string
  businessUserId: string
  actorName: string
  direction: 'IN' | 'OUT'
  amountPaise: number
  expression: string
  note: string | null
  idempotencyKey: string
}): Promise<CashEntryDTO>

export async function editCashEntry(args: {
  businessId: string
  businessUserId: string
  actorName: string
  id: string
  patch: { direction?: 'IN'|'OUT'; amountPaise?: number; expression?: string; note?: string | null }
}): Promise<CashEntryDTO>

export async function voidCashEntry(args: {
  businessId: string
  businessUserId: string
  actorName: string
  id: string
  reason: string | null
}): Promise<CashEntryDTO>

export async function restoreCashEntry(args: {
  businessId: string
  businessUserId: string
  actorName: string
  id: string
}): Promise<CashEntryDTO>

export async function hardDeleteCashEntry(args: {
  businessId: string
  businessUserId: string
  actorName: string
  id: string
}): Promise<void>
```

### Transaction boundaries

Per F-06 (per-business transactions, no outer batch):

- Each mutation wraps its DB writes in `prisma.$transaction(async (tx) => {…})`.
- Inside the tx: `findUnique` (with row state check) → write the entity → append `CashEntryEvent` via `appendCashEntryEvent(tx, …)`.
- Isolation: `Serializable` for `void` and `restore` (prevents the multi-tab void-twice race in scope §8). `ReadCommitted` (default) is sufficient for `create` because the unique idempotency key + serial idempotency middleware already serialise duplicate creates.
- Hard-delete: `Serializable`, two writes — write `AuditLog` row (business-level, retained), then `prisma.cashEntry.delete({ where: { id, voidedAt: { not: null } }})`. The `voidedAt: { not: null }` predicate in the `where` is the DB-level guard required by SCOPE §11. If 0 rows match → throw `CONFLICT`.
- Idempotent fast-path on create: pre-tx `findUnique` on `(businessId, idempotencyKey)`; if row exists, return its DTO without touching the DB.

### Validation chain (per mutation)

1. Zod schema validates body shape.
2. `validateExpression(expression, amountPaise)` — server-side evaluator confirms `|round(eval(expr)*100) - amountPaise| <= 1`. Throws `EXPRESSION_MISMATCH` otherwise.
3. `sanitizeText(note)` and `sanitizeText(voidReason)` before DB write.
4. State guards: edit/void/restore/delete branches check `voidedAt` and throw `CONFLICT` per scope §5.

---

## 4. Route Layer

Mount: `server/src/index.ts` registers `cashRegisterRouter` at
`/api/businesses/:businessId/cash-entries`.

### Middleware stack order

```
requireAuth                    // sets req.user.{userId, businessId}
  → assertBusinessIdMatch       // small inline guard: req.params.businessId === req.user.businessId
    → idempotencyCheck()        // POST only — reads X-Idempotency-Key header
      → requirePermission('cashRegister.<verb>')   // also enforces BusinessUser active
        → validate(zodSchema)   // Zod body/query parser; sends 400 on fail
          → asyncHandler(thinController)
```

`assertBusinessIdMatch` is a 5-line inline guard (NOT a new middleware in
the dependency-injection sense — just a local helper in
`cashRegister.route.ts`). This avoids a tenant escape via URL-vs-token
mismatch even when both are valid for the same user.

### Endpoint table

| Method | Path | Permission | Idempotent | Zod schema |
|---|---|---|---|---|
| POST | `/` | `cashRegister.create` | YES (header) | `CreateCashEntrySchema` |
| GET | `/` | `cashRegister.view` | n/a | `ListCashEntriesQuerySchema` |
| GET | `/summary` | `cashRegister.view` | n/a | `CashSummaryQuerySchema` |
| GET | `/:id` | `cashRegister.view` | n/a | `IdParamSchema` |
| PATCH | `/:id` | `cashRegister.edit` | YES (header) | `EditCashEntrySchema` |
| POST | `/:id/void` | `cashRegister.edit` | YES (header) | `VoidCashEntrySchema` |
| POST | `/:id/restore` | `cashRegister.edit` | YES (header) | `IdParamSchema` |
| DELETE | `/:id` | `cashRegister.delete` | YES (header) | `IdParamSchema` — manager+owner have permission; SCOPE Q5 lock says **owner-only** for hard-delete, so we additionally call `requireOwner()` AFTER `requirePermission` for this route. |

> Q5 reconciliation: SCOPE listed the permission for managers AND requested
> owner-only at lock-time. We satisfy both by registering the permission
> (so the system stays consistent) AND stacking `requireOwner()` on DELETE.
> Manager will receive `403 FORBIDDEN_OWNER_ONLY` from the second gate.

### Idempotency key derivation (client side)

Client computes:
```
key = sha256(`${businessId}|${expression}|${direction}|${clientNonce}`)
```
Where `clientNonce` is `crypto.randomUUID()` per user-initiated tap on Cash In / Cash Out (regenerated only on a NEW commit attempt, NOT on retry). Sent as `X-Idempotency-Key` header. The server middleware dedupes per `userId`; the DB unique constraint dedupes per `businessId`. Cross-tab safety: same nonce in same tab session means a network retry of the same commit is safe; different tabs editing simultaneously generate different nonces (correct — they are different intents).

### Error codes (consistent across endpoints)

| HTTP | code | Origin |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod / sanitise / expression syntax |
| 400 | `EXPRESSION_MISMATCH` | server evaluator vs amountPaise |
| 401 | `UNAUTHORIZED` | requireAuth |
| 403 | `FORBIDDEN` | requirePermission |
| 403 | `FORBIDDEN_OWNER_ONLY` | requireOwner on DELETE |
| 404 | `NOT_FOUND` | row not in business |
| 409 | `CONFLICT` | state guard (already voided / not voided / not voidable) |

---

## 5. Frontend Layer

### Component tree

```
<CashRegisterPage>
  <PageHeader title="Cash Register" backHref="/" data-hide-bottom-nav>
  <TabToggle value={tab} onChange={setTab} />
  {tab === 'calculator' ? (
    <CalculatorPanel
      expression={…} liveTotalPaise={…} error={…} warning={…}
      onKey={dispatchKey} onCommit={(direction) => commit(direction)}
      onChangeNote={…} note={…}
      isSubmitting={mutation.isPending}
    >
      <CalculatorDisplay/>
      <Keypad onKey/>
      <NoteField/>
      <CommitButtons/>
    </CalculatorPanel>
  ) : (
    <HistoryPanel>
      <CashSummaryHeader summary={summaryQuery.data}/>
      <HistoryControls filter sort onChange/>
      <HistoryList pages={historyQuery.data.pages} onLoadMore={fetchNextPage}>
        <HistoryEntryRow onEdit onVoid onRestore onDelete />
      </HistoryList>
    </HistoryPanel>
  )}
  <EditEntryDrawer open entry onSave onClose/>
  <VoidConfirmDialog open entry onConfirm onClose/>
  <DeleteConfirmDialog open entry onConfirm onClose/>
  <LargeAmountWarningDialog open paise onConfirm onCancel/>
</CashRegisterPage>
```

### State management strategy

| State | Where | Why |
|---|---|---|
| Expression keypad state (`{display, tokens, error}`) | local `useReducer` inside `useCashCalculator` hook | Page-local, not shared across views |
| Tab selection (`'calculator' | 'history'`) | local `useState` in `CashRegisterPage` | Trivial, page-local |
| Edit / void / delete dialog open state | local `useState` in page | Page-local UI state |
| Cash entry list, summary, single entry | TanStack Query | Server state; cache, retry, invalidation |
| Mutations (create/edit/void/restore/delete) | TanStack Query `useMutation` with `onSuccess` invalidating list + summary keys | Standard HP pattern |
| Filter + sort | URL-synced `useState` (querystring) | Shareable; survives reload |

**No Zustand** — there is no cross-feature sharing here, no cross-page persistence beyond the URL. Adding Zustand would be over-engineering. (Project rule: local > Zustand > Context.)

### Data flow

```
Tap key → dispatch(reducer)            // pure
        → expression updates           // useReducer state
        → safeEvaluate(expression)     // memoised on expression
        → display shows live total

Tap Cash In/Out →
  if (paise > LARGE_AMOUNT_PAISE) showWarning()
  else commit()

commit() →
  generate clientNonce + sha256 key
  mutation.mutate({ direction, amountPaise, expression, note, idempotencyKey })
  service.createCashEntry(…)
    → api('POST /cash-entries', { entityType:'cashEntry', entityLabel: formatPaise(amount), headers:{ 'X-Idempotency-Key': key } })
  onSuccess →
    queryClient.invalidateQueries(['cashHistory', businessId])
    queryClient.invalidateQueries(['cashSummary', businessId])
    reducer.dispatch('clear')
    Capacitor.Haptics.impact({ style: 'Medium' }).catch(() => {})
    toast.success(t('cashReg.cashInSaved'))
```

### React Query keys

```ts
['cashHistory', businessId, { direction, includeVoided, sort, from, to }]
['cashSummary', businessId, { tzOffsetMinutes }]
['cashEntry', businessId, id]
```

`useCashHistory` is `useInfiniteQuery` keyed on cursor; `getNextPageParam = last => last.nextCursor`.

### Cache opt-in (per OFFLINE_RULES Rule 3)

- `cashHistory` and `cashSummary`: **do NOT** pass `cacheReads:true` — entries contain freeform notes that may capture PII. Network-only.
- This is documented in code comments at the service call site to prevent drift.

### File-size budget (validated against ≤250 LOC rule)

Target LOC: page 80, hooks ~120 each, panels ~150, dialogs ~80, evaluator ~150, reducer ~120, utils ~120. Largest file expected: `HistoryList.tsx` (virtualisation + day bucket header sticky logic) — keep under 220 LOC by extracting the bucket-header subcomponent if it grows.

---

## 6. Expression Evaluator

**Algorithm: recursive-descent parser. NO `eval`. NO `Function()`.**

Why recursive descent over shunting-yard: scope §7 needs only `+ - * /` with precedence and parentheses. Recursive descent fits in ~120 LOC, gives precise error positions, and the same source can be transliterated to TS for both client and server.

### Grammar (LL(1))

```
expression := term (('+' | '-') term)*
term       := factor (('*' | '/') factor)*
factor     := number | '(' expression ')' | '-' factor   // unary minus
number     := DIGIT+ ('.' DIGIT+)?                        // up to 4 fractional digits in raw, evaluator works in paise via *100 round at end
```

### Tokenizer

- Single forward pass over input string.
- Whitespace: skipped.
- Allowed chars: `0-9 . + - * / ( )` and space.
- Any other char → `INVALID_CHAR` error with index.
- Number length cap: 12 digits before decimal, 4 after.
- Total expression length cap: 128 chars (validated up-front).

### Parser

Recursive-descent functions: `parseExpression`, `parseTerm`, `parseFactor`. Each consumes tokens via a shared cursor. Mismatched paren or trailing input → `SYNTAX_ERROR`.

### Evaluation

- Internal arithmetic in JS `number` (double-precision) — acceptable because final result is rounded to integer paise.
- Division by zero → throw `DIVIDE_BY_ZERO`.
- After full evaluation: `paise = Math.round(result * 100)`.
- Reject if `!Number.isFinite(result)` or `paise <= 0` → `INVALID_RESULT`.
- Reject if `paise > 9_999_999_999` (Rs 10 crore upper bound; integer-safe sentinel) → `RESULT_OVERFLOW`.

### Acceptable inputs

```
0-9               digits
.                 decimal point (one per number)
+ - * /           operators
( )               parens
space             ignored
unary -           leading or after operator/paren
```

### Rejection cases (each maps to a localised error string)

| Input | Error |
|---|---|
| `10++5` | `SYNTAX_ERROR` (two operators) |
| `10/0` | `DIVIDE_BY_ZERO` |
| `1e5` | `INVALID_CHAR` (no scientific) |
| `100;DROP` | `INVALID_CHAR` |
| `(10+5` | `SYNTAX_ERROR` (unmatched paren) |
| `10..5` | `SYNTAX_ERROR` (two decimals) |
| empty | `EMPTY` |
| only operators | `SYNTAX_ERROR` |
| length > 128 | `TOO_LONG` (caught before tokenize) |
| evaluates ≤ 0 | `INVALID_RESULT` |
| evaluates > Rs 10cr | `RESULT_OVERFLOW` |

### Shared file pair

- Client: `src/features/cash-register/cashRegister.evaluator.ts` exports `safeEvaluate(expr): { paise: number; error: ExpressionError | null }`.
- Server: `server/src/features/cash-register/expression.ts` exports two functions:
  - `evaluateExpression(expr): number` (paise; throws)
  - `validateExpression(expr, amountPaise): void` — calls evaluate, then asserts `Math.abs(result - amountPaise) <= 1` (one-paisa float tolerance).
- Implementation is duplicated, NOT shared via a workspace package, because the server runs ESM-compiled TS and frontend has its own bundler — the algorithm is small and stable. Both files have identical golden tests (§10) so divergence is caught.

---

## 7. Idempotency Strategy

### Three layers — each defends a different failure mode

| Layer | Where | Defends against |
|---|---|---|
| Client nonce | `crypto.randomUUID()` per commit; held in mutation closure across retries | Network retry within same browser tab |
| `idempotencyCheck()` middleware | Header `X-Idempotency-Key`, scoped by `userId`, TTL ~24h via `IdempotencyLog` table | Cross-tab / cross-device retries by same user; replays |
| `@@unique([businessId, idempotencyKey])` on CashEntry | Postgres unique constraint | Even if middleware bypassed (e.g. header missing), DB rejects duplicate; prisma `P2002` mapped to 200 with existing row |

### Key derivation

```
clientNonce = crypto.randomUUID()           // generated when user taps Cash In / Out
material    = `${businessId}|${expression}|${direction}|${clientNonce}`
key         = bytesToHex(sha256(material))   // 64-char hex; fits VarChar(128)
```

`expression` and `direction` are included so a hash collision across legitimate distinct operations is impossible without an actual SHA-256 collision. `businessId` prevents cross-tenant key reuse (already guarded by middleware userId scoping but defence-in-depth).

### Server fast-path

In `createCashEntry`:
1. Pre-tx `findUnique({ businessId_idempotencyKey })`.
2. If row exists → return DTO (200), don't recompute, don't re-emit `CREATED` event.
3. Else open tx → insert + emit event. On `P2002` from race, refetch the existing row and return it (still 200).

Edit / void / restore / delete: idempotency key is optional but recommended; the middleware caches the response, so a retried PATCH with the same header returns the prior 200 without re-applying the mutation. State guards make these endpoints naturally idempotent for state outcomes (voiding a voided entry → 409, which itself is also cached).

---

## 8. Audit / Event Log

### Events emitted

| Event | Trigger | Payload |
|---|---|---|
| `CREATED` | end of `createCashEntry` tx | `{ direction, amountPaise, expression, note }` |
| `EDITED` | end of `editCashEntry` tx | `{ before: {direction,amountPaise,expression,note}, after: {…}, changedFields: string[] }` |
| `VOIDED` | end of `voidCashEntry` tx | `{ reason }` |
| `RESTORED` | end of `restoreCashEntry` tx | `{ priorReason }` |
| `HARD_DELETED` | NOT written to `CashEntryEvent` (parent row about to vanish; cascade would erase audit). Written to existing platform `AuditLog` table with `entityType:'cashEntry'`, `entityId`, full snapshot of the entry + its event chain in `payload`. | snapshot |

### Actor capture

`actorId` and `actorName` populated from `req.user` and a single
`prisma.user.findUnique({ select:{ name: true }})` per request (cached in
service args, not refetched per event).

### Replay invariant

For any non-deleted entry: `events[].sort(asc)` reconstructs current state.
QA tests assert that `replay(events) === currentDTO` for fixtures.

---

## 9. Integration Points

| Surface | Hook | Responsibility |
|---|---|---|
| Side nav (`src/components/layout/SideNav.tsx` or equivalent) | Add `Cash Register` link with `Calculator` lucide icon, route `/cash-register`. Q9: visible to all plan tiers, no feature flag. | nav link |
| Bottom nav | Hidden on this page via `data-hide-bottom-nav="true"` attribute on page root (existing convention used by full-screen flows). | hide |
| Dashboard "Today's cash flow" tile (future) | NOT in this feature scope (SCOPE §14 explicitly out of scope). The summary endpoint exposes the data so the dashboard widget can read it later without API change. | API exposed; UI later |
| Accounting journal | `CashEntry.ledgerJournalId` reserved column, `null` in Phase 1. Phase 3 will write this from a new `journal-poster.service` consuming `CashEntryEvent` stream. NO code in this feature touches journal. | column reserved |
| i18n | New `cashReg.*` namespace in `en.json` + `hi.json`. Loader is existing. | namespace addition |
| Capacitor Haptics | Existing plugin (`@capacitor/haptics`). Used in commit success handler. Sounds skipped (Q8). | call site only |
| Permissions registry | `permissions-data.ts` gets a new group `{ key:'cashRegister', label:'Cash Register', actions:[view, create, edit, delete] }`. | seed PR2 |
| Manager seed role | Add `cashRegister.view`, `cashRegister.create`, `cashRegister.edit`, `cashRegister.delete` to Manager permission array. | seed PR2 |
| Service worker / Workbox cache | Do NOT precache `/cash-register*` API responses — read endpoints carry PII. App shell HTML/JS precached as usual. | exclusion |

---

## 10. Test Strategy

### Unit tests

#### Expression evaluator (`server/src/features/cash-register/__tests__/expression.test.ts` and frontend mirror)

Boundary table — both files run the same fixtures:

| Input | Expected paise | Expected error |
|---|---|---|
| `100` | 10000 | null |
| `100+50` | 15000 | null |
| `100+50*2` | 20000 | null (precedence) |
| `(100+50)*2` | 30000 | null |
| `10.5` | 1050 | null |
| `10.555` | 1056 | null (rounded) |
| `-100+200` | 10000 | null (unary minus) |
| `100-200` | — | INVALID_RESULT (≤0) |
| `0` | — | INVALID_RESULT |
| `10/0` | — | DIVIDE_BY_ZERO |
| `10++5` | — | SYNTAX_ERROR |
| `(10+5` | — | SYNTAX_ERROR |
| `1e5` | — | INVALID_CHAR |
| `99999999.99` | 9999999999 | null (boundary) |
| `100000000` | — | RESULT_OVERFLOW |
| `'a'.repeat(129)` | — | TOO_LONG |
| `''` | — | EMPTY |

#### Service unit tests

- `createCashEntry`: idempotent fast-path returns existing row without writing event; race-on-P2002 also returns 200.
- `editCashEntry` on voided row → throws `CONFLICT`.
- `voidCashEntry` twice → second throws `CONFLICT`.
- `restoreCashEntry` on active row → `CONFLICT`.
- `hardDeleteCashEntry` on active row → `CONFLICT`; on voided row → succeeds + emits `HARD_DELETED` audit row.

### Integration tests (lifecycle)

`server/src/features/cash-register/__tests__/lifecycle.int.test.ts`:

1. `POST /` → 201 + entry, event `CREATED` exists.
2. `POST /` same key → 200 same id, NO new event.
3. `PATCH /:id` change amount → 200, `editCount=1`, event `EDITED` with diff.
4. `POST /:id/void` → 200, `voidedAt!=null`, event `VOIDED`.
5. `PATCH /:id` while voided → 409.
6. `POST /:id/restore` → 200, `voidedAt=null`, event `RESTORED`.
7. `DELETE /:id` while active → 409.
8. `POST /:id/void` → 200.
9. `DELETE /:id` as manager → 403 `FORBIDDEN_OWNER_ONLY`.
10. `DELETE /:id` as owner → 200; row gone; AuditLog row written.
11. Replay invariant: fixture entry → `replayEvents(rows)` → DTO matches DB state.

### curl proof matrix (must be captured into `acceptance.backend`)

```
curl POST /cash-entries (valid)              → 201
curl POST /cash-entries (same X-Idem-Key)    → 200 same id
curl POST /cash-entries (no auth)            → 401
curl POST /cash-entries (other business)     → 403
curl POST /cash-entries (no permission)      → 403
curl POST /cash-entries (amount mismatch)    → 400 EXPRESSION_MISMATCH
curl POST /cash-entries (10++5)              → 400 VALIDATION_ERROR
curl POST /cash-entries (10/0)               → 400 VALIDATION_ERROR
curl GET  /cash-entries/summary?tz=330       → 200 with 7-day array length 7
curl PATCH /cash-entries/:id (voided)        → 409
curl POST /cash-entries/:id/void (twice)     → 200 then 409
curl DELETE /cash-entries/:id (active)       → 409
curl DELETE /cash-entries/:id (voided, mgr)  → 403 FORBIDDEN_OWNER_ONLY
curl DELETE /cash-entries/:id (voided, own)  → 200
tsc --noEmit (server)                        → 0 errors
```

### Frontend

- React Testing Library for `useCashCalculator` reducer transitions.
- Visual proof: 10 screenshots per SCOPE §15 (loading/empty/error/success per panel + dialogs).
- 320px and 375px viewport screenshots checked in `playwright/cash-register.spec.ts`.

### Performance

- Bundle: code-split `/cash-register` route via existing `React.lazy` pattern. Budget: ≤30 KB gzipped delta over baseline (evaluator + reducer + 14 components).
- API: list `limit=50`, cursor-paginated, indexed scan only — verified by `EXPLAIN` on a 100k-row business in QA.

---

## 11. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Recursive-descent client and server diverge over time | Medium | Medium (server rejects valid client input or accepts invalid) | Identical golden-fixtures test in both packages; CI runs both. Fixture file is the single source of truth. |
| R2 | Idempotency middleware caches a 4xx and replays it for legit retry | Low | Medium | Existing middleware caches only `2xx` (line 45: `res.statusCode >= 200 && < 300`). Confirmed in code. |
| R3 | Manager unable to hard-delete creates support burden ("why can't I delete this?") | Medium | Low | UX hides Delete kebab item for managers entirely (read role from session); explanatory tooltip on the surfaced item for managers attempting other states. |
| R4 | `tzOffsetMinutes` from client is wrong / spoofed → wrong "Today" totals | Medium | Low | Treat as untrusted: clamp to `[-840, 840]`, but accept the value (UX requirement). For audit reports, use UTC always. Document as a UX-only field, not a security boundary. |
| R5 | Float rounding makes `validateExpression` reject a valid client commit (e.g. `0.1+0.2`) | Low | Medium | ±1 paisa tolerance in the server check. Golden tests cover `0.1+0.2`, `1/3*3`, `99.995`. |
| R6 | Hard-delete audit lost when `CashEntryEvent` cascades | Medium | High (compliance) | We DO NOT rely on `CashEntryEvent` for hard-delete audit. We write to existing platform `AuditLog` table with full entity + event-chain snapshot BEFORE the row is deleted, inside the same transaction. |
| R7 | Multi-tab race: two tabs void the same entry at once | Low | Low | Serializable isolation on void; second tx sees `voidedAt!=null`, throws `CONFLICT`. |
| R8 | Capacitor Haptics plugin missing on web | High | None | Code is `void Haptics.impact({...}).catch(() => {})`. Fire-and-forget, swallow rejection. |
| R9 | LARGE_AMOUNT_PAISE hardcoded (Q6) — Rs 10L threshold mid-sized merchants tap multiple times daily | Medium | Low | Constant lives in `cashRegister.constants.ts` with TODO comment for per-business override (Phase 2). User confirmed acceptable for MVP. |
| R10 | `editCount` overflows / unbounded edits muddy audit | Low | Low | `Int` column = 2.1B headroom; no realistic abuse. UI shows "Edited" badge if `editCount > 0`. |
| R11 | OFFLINE_RULES violation — direct fetch in service | Low | High (precommit blocks) | All API calls go through `api()`; mutations include `entityType:'cashEntry'`, `entityLabel`. enforce-offline.mjs ratchet covers this. |

---

## 12. agents_invoked Frontmatter Prep

When `design-plan-active.md` is created/approved for this feature, paste:

```yaml
---
status: approved
feature: cash-register
created: 2026-05-07T05:35:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/<ts>_cash_register/migration.sql
agents_invoked:
  - scope-writer (output: docs/SCOPE_cash_register.md)
  - architect (output: docs/ARCHITECTURE_cash_register.md)
  - task-manager (output: docs/TASKS_cash_register.md)
acceptance:
  backend:
    - tsc clean (server)
    - curl POST happy path 201
    - curl POST same idem key 200 same id
    - curl POST no auth 401
    - curl POST other business 403
    - curl POST no permission 403
    - curl POST amount mismatch 400 EXPRESSION_MISMATCH
    - curl GET /summary tz=330 returns last7Days length 7
    - curl PATCH voided 409
    - curl POST void twice 409
    - curl DELETE active 409
    - curl DELETE voided as manager 403 FORBIDDEN_OWNER_ONLY
    - curl DELETE voided as owner 200
    - integration lifecycle test passes
    - replay invariant test passes
  frontend:
    - tsc clean (frontend)
    - screenshots: calculator empty, valid, invalid, submitting
    - screenshots: history loading, empty, populated, edit drawer, void dialog, delete dialog, large-amount dialog
    - 320px no horizontal overflow
    - 375px keypad fully visible without scroll
    - hindi i18n: 0 missing-key fallbacks
    - console: 0 errors on happy path
    - enforce-offline.mjs passes (no new violations)
---
```

> Note: `security` agent is NOT required for this feature — no auth, billing,
> webhook, env, or admin paths touched. Scope ref: HIGH_RISK_PATHS.md tables.
> Schema changes require `architect` only; that's this document.

---

## End — file length: ~580 lines.
