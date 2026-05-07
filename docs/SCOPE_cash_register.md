---
feature: cash-register
status: draft
author: scope-writer
created: 2026-05-07T05:17:00Z
---

# SCOPE — Cash Register

## 1. Summary

Calculator-style petty-cash ledger for recording instant Cash In / Cash Out
entries without creating a full invoice. User taps numbers and operators on a
keypad, sees a live-evaluated total, and commits the amount as IN or OUT. A
scrollable history shows per-day buckets with Today / 7-day / 30-day summary
tiles. Entries can be edited, soft-voided with a reason, or restored.

## 2. Goals and Non-Goals

### Goals

- Record petty-cash receipts and payments instantly via calculator input
- Live expression evaluation (no `eval`; tokenise-then-evaluate, same algo on client + server)
- Full audit trail: CREATED / EDITED / VOIDED / RESTORED events per entry
- Idempotent create (offline-queue safe — same key retries yield same row)
- History with today / 7-day chart / 30-day total; filter by direction, sort by time or amount
- Soft-void with optional reason, restore a voided entry
- Hard-delete only voided rows (owner/manager only)
- Sound (cash register chime) and haptic feedback via Capacitor with graceful fallback
- Multi-tenant: every query and write scoped by `businessId`
- English + Hindi i18n from day one

### Non-Goals

- Auto-posting to the double-entry accounting ledger (Phase 3 bridge is noted but out of scope here — entries will have a `ledgerJournalId` nullable column reserved for later wiring)
- GST / tax preset buttons (DH feature — stripped for HP MVP)
- Batch import of cash entries from CSV
- PDF export of cash register history
- Party linkage (attach cash entry to a customer/vendor) — Phase 2 enhancement
- Offline-queue for mutations (online-only for MVP; `pending:true` Dexie flag reserved for Phase 2)
- Recurring cash entries
- Cash denominations / drawer management

---

## 3. User Stories

### Raju (micro-retailer, kirana)

- "I collected Rs 850 from three customers today. I want to tap 200+350+300, see Rs 850, tap Cash In, and it's saved."
- "I paid the delivery guy Rs 120. I tap 120, tap Cash Out, done."
- "I made a mistake — I want to edit that last entry and change the amount."
- "I voided a wrong entry by accident. I want to restore it."

### Priya (wholesaler, 2-5 staff)

- "My accountant checks the register at end of day. I need a clean Today / 7-day summary."
- "I want to filter history to see only Cash Out this week."
- "I want to void an entry and record why (e.g., 'entered by mistake')."

---

## 4. UI Surface

### Routes

| Route | Component | Description |
|---|---|---|
| `/cash-register` | `CashRegisterPage` | Shell — header + tab toggle |

No sub-routes. Single page, two panels toggled by tab state.

### Component tree (6-layer split, 250 LOC cap each)

```
src/features/cash-register/
  CashRegisterPage.tsx          — page shell, tab toggle, dialog orchestration
  useCashRegisterPage.ts        — page-level state: expression reducer, mutations, summary query
  cashRegister.types.ts         — DayBucket, CashHistoryFilter, CashHistorySort, CashRegisterTab
  cashRegister.utils.ts         — formatPaise, formatPaiseCompact, applyHistoryView, buildDayBuckets
  cashRegister.constants.ts     — KEYPAD_KEYS, OPERATORS, MAX_EXPRESSION_LEN
  cashRegister.reducer.ts       — expression state machine + safeEvaluate (no eval)
  cash-register.service.ts      — api() wrappers for all endpoints
  components/
    CalculatorPanel.tsx         — display + keypad + note + commit buttons
    CalculatorDisplay.tsx       — expression string + live Rs total
    Keypad.tsx                  — 4×4 grid of tap targets
    NoteField.tsx               — optional 256-char note input
    HistoryPanel.tsx            — summary header + controls + list
    CashSummaryHeader.tsx       — Today card + 7-day bar chart + 30-day tile
    HistoryControls.tsx         — filter pills (All / In / Out) + sort dropdown
    HistoryList.tsx             — virtualized day-bucketed list
    HistoryEntryRow.tsx         — single row: expression, amount chip, actions menu
    EditEntryDrawer.tsx         — bottom drawer: re-type expression + note
    VoidConfirmDialog.tsx       — confirm + reason field
    DeleteConfirmDialog.tsx     — hard-delete confirm (voided entries only)
```

### 4 UI States — every component must handle all four

#### CashRegisterPage (calculator tab)

| State | Description |
|---|---|
| Loading | `commitDisabled=true`, keypad enabled, no spinner (calculator is always usable) |
| Error | Submit error banner below keypad: exact error text from API |
| Empty | Expression display shows placeholder copy "Enter amount" |
| Success | Toast appears, expression clears, history refetch triggered |

#### HistoryPanel

| State | Description |
|---|---|
| Loading | Skeleton rows (3 × HistoryEntryRow skeleton) |
| Error | Inline error card: "Could not load history. Tap to retry." |
| Empty | Inbox icon + contextual message (see UX Copy section) |
| Success | Day-bucketed list with summary header |

#### CashSummaryHeader

| State | Description |
|---|---|
| Loading | Shimmer placeholder for today net + bar chart |
| Error | Dash values (—) instead of Rs amounts |
| Empty | All values Rs 0 (zero is valid data, not an error state) |
| Success | Today net, in/out pills, 7-day bars, 30-day net |

#### EditEntryDrawer

| State | Description |
|---|---|
| Loading | Save button shows spinner |
| Error | Inline validation error below expression field |
| Empty | Pre-filled from current entry on open |
| Success | Drawer closes, toast fires, history invalidated |

---

## 5. API Contract

Base path: `/api/businesses/:businessId/cash-entries`

Auth: `requireAuth` + `requireBusinessAccess` on all routes.
Permission: `cash_entry:create` to create; `cash_entry:edit` to edit/void/restore;
`cash_entry:delete` to hard-delete. Owner always has all three.

### POST /api/businesses/:businessId/cash-entries

Idempotency middleware keyed on `idempotencyKey` in body.

```ts
// Request
interface CreateCashEntryReq {
  direction: 'IN' | 'OUT'
  amountPaise: number          // integer, >0
  expression: string           // raw user expression, max 128 chars
  note?: string | null         // max 256 chars
  idempotencyKey: string       // SHA-256(businessId+expression+direction+timestamp), client-generated
}

// Response 201
interface CreateCashEntryRes {
  success: true
  entry: CashEntryDTO
}

// Errors
// 400 { success: false, error: { code: 'VALIDATION_ERROR', message: '...' } }
// 400 { success: false, error: { code: 'EXPRESSION_MISMATCH', message: 'Expression evaluates to Rs X, got Rs Y' } }
// 401 { success: false, error: { code: 'UNAUTHORIZED' } }
// 403 { success: false, error: { code: 'FORBIDDEN', message: 'Missing permission cash_entry:create' } }
```

### GET /api/businesses/:businessId/cash-entries

```ts
// Query params
interface ListCashEntriesQuery {
  direction?: 'IN' | 'OUT'
  includeVoided?: boolean       // default false
  from?: string                 // YYYY-MM-DD, user local date
  to?: string                   // YYYY-MM-DD, user local date
  tzOffsetMinutes: number       // e.g. 330 for IST
  cursor?: string               // last entry id for cursor pagination
  limit?: number                // default 50, max 100
}

// Response 200
interface ListCashEntriesRes {
  success: true
  entries: CashEntryDTO[]
  nextCursor: string | null
}
```

### GET /api/businesses/:businessId/cash-entries/summary

```ts
// Query params
interface CashSummaryQuery {
  tzOffsetMinutes: number
}

// Response 200
interface CashSummaryRes {
  success: true
  summary: {
    today: { inPaise: number; outPaise: number; netPaise: number; count: number }
    last7Days: Array<{
      date: string              // YYYY-MM-DD local
      inPaise: number
      outPaise: number
      netPaise: number
      count: number
    }>
    last30: { inPaise: number; outPaise: number; netPaise: number; count: number }
    range: { from: string; to: string } // ISO UTC
  }
}
```

### GET /api/businesses/:businessId/cash-entries/:id

```ts
// Response 200
interface GetCashEntryRes {
  success: true
  entry: CashEntryDTO
}
// 404 { success: false, error: { code: 'NOT_FOUND' } }
```

### PATCH /api/businesses/:businessId/cash-entries/:id

```ts
// Request (all fields optional; at least one required)
interface EditCashEntryReq {
  direction?: 'IN' | 'OUT'
  amountPaise?: number
  expression?: string
  note?: string | null           // null = clear note
}

// Response 200
interface EditCashEntryRes {
  success: true
  entry: CashEntryDTO
}
// 409 { success: false, error: { code: 'CONFLICT', message: 'Cannot edit a voided entry — restore it first' } }
```

### POST /api/businesses/:businessId/cash-entries/:id/void

```ts
// Request
interface VoidCashEntryReq {
  reason?: string | null         // max 256 chars
}

// Response 200
interface VoidCashEntryRes {
  success: true
  entry: CashEntryDTO
}
// 409 { success: false, error: { code: 'CONFLICT', message: 'Entry already voided' } }
```

### POST /api/businesses/:businessId/cash-entries/:id/restore

```ts
// Response 200
interface RestoreCashEntryRes {
  success: true
  entry: CashEntryDTO
}
// 409 { success: false, error: { code: 'CONFLICT', message: 'Entry is not voided' } }
```

### DELETE /api/businesses/:businessId/cash-entries/:id

Hard-delete. Only voided entries. Requires `cash_entry:delete` permission.

```ts
// Response 200
{ success: true }
// 409 { success: false, error: { code: 'CONFLICT', message: 'Only voided entries may be permanently deleted' } }
```

### CashEntryDTO (shared shape)

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
  ledgerJournalId: string | null  // reserved for Phase 3 — always null in Phase 1
  createdBy: string               // BusinessUser.id
  createdAt: string               // ISO UTC
  updatedAt: string               // ISO UTC
}
```

---

## 6. Data Model

### New Prisma models

Add to `server/prisma/schema.prisma` under the Business model.

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
}

model CashEntry {
  id             String               @id @default(cuid())
  businessId     String
  createdBy      String               // BusinessUser.id (actor who created)
  direction      CashEntryDirection
  amountPaise    Int
  expression     String               @db.VarChar(128)
  note           String?              @db.VarChar(256)
  idempotencyKey String               @db.VarChar(128)
  editCount      Int                  @default(0)
  voidedAt       DateTime?
  voidedBy       String?              // BusinessUser.id
  voidReason     String?              @db.VarChar(256)
  ledgerJournalId String?             // reserved for Phase 3 accounting auto-post

  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  business       Business             @relation(fields: [businessId], references: [id], onDelete: Cascade)
  events         CashEntryEvent[]

  @@unique([businessId, idempotencyKey])
  @@index([businessId, createdAt(sort: Desc)])
  @@index([businessId, direction, createdAt(sort: Desc)])
  @@index([businessId, voidedAt])
}

model CashEntryEvent {
  id           String             @id @default(cuid())
  cashEntryId  String
  businessId   String             // denormalised for easy business-scoped audit queries
  actorId      String?            // BusinessUser.id
  actorName    String?
  type         CashEntryEventType
  payload      Json               @default("{}")
  createdAt    DateTime           @default(now())

  cashEntry    CashEntry          @relation(fields: [cashEntryId], references: [id], onDelete: Cascade)

  @@index([cashEntryId])
  @@index([businessId, createdAt(sort: Desc)])
}
```

Also add to Business model relations:
```prisma
  cashEntries    CashEntry[]
```

### Migration

One new migration: `YYYYMMDDHHMMSS_cash_register`
Steps: add enum `CashEntryDirection`, add enum `CashEntryEventType`, create
`CashEntry`, create `CashEntryEvent`, add relation to `Business`.
No backfill needed (greenfield table).

### Key design decisions vs DH

| DH field | HP equivalent | Reason |
|---|---|---|
| `userId` (single-tenant) | `businessId` | HP is multi-tenant |
| No `createdBy` | `createdBy: String` | HP has staff roles; need to know which staff member recorded it |
| No `ledgerJournalId` | `ledgerJournalId: String?` | Reserved column for Phase 3 accounting auto-post |
| `userId_idempotencyKey` unique | `businessId_idempotencyKey` unique | Scoped to business |

---

## 7. Expression Evaluator

Client and server MUST use the same algorithm. No `eval`.

Algorithm: tokenise → two-pass precedence (`*` `/` first, then `+` `-`).

### Rules

- Allowed characters: `0-9`, `.`, `+`, `-`, `*`, `/`, whitespace
- Leading `-` treated as `0 - n` (negative numbers via subtraction)
- Division by zero → `400 EXPRESSION_MISMATCH` / client error state
- Result must be > 0 and > 0 paise after rounding (`Math.round(result * 100)`)
- Server cross-checks: `|Math.round(result*100) - amountPaise| <= 1` (±1 paisa float tolerance)
- Max expression length: 128 chars

### Location in HP

- Client: `src/features/cash-register/cashRegister.reducer.ts` — exports `safeEvaluate(expr): { paise: number; error: string | null }`
- Server: `server/src/features/cash-register/expression.ts` — exports `validateExpression(expr, amountPaise): void`

---

## 8. Edge Cases

| Scenario | Handling |
|---|---|
| Invalid expression (e.g. `10++5`) | Client blocks commit; error shown in display: "Invalid expression" |
| Division by zero (`10/0`) | Client error: "Cannot divide by zero" — commit disabled |
| Expression result is 0 or negative | Commit button disabled; no toast |
| Expression evaluates to > Rs 10,00,000 | Client warning: "Amount seems high. Confirm?" (configurable threshold — default 10L) |
| Offline at commit time | Show toast: "You are offline. Entry will sync when back online." Use offline queue (Phase 2). For MVP: show "No internet connection — please retry" |
| Duplicate submit (network retry, same idempotencyKey) | Server returns existing entry (idempotent fast-path); client shows success |
| Edit while voided | Server returns 409; client toast: "Restore the entry before editing" |
| Void already-voided | Server returns 409; client toast: "Entry is already voided" |
| Restore a non-voided entry | Server returns 409; client toast: "Entry is not voided" |
| Hard-delete non-voided entry | Server returns 409; client hides Delete option for active entries |
| Multi-tab race on void | Serializable transaction on server; second request sees 409 |
| Note > 256 chars | Client input capped at `maxLength={256}`; server rejects with 400 |
| Expression > 128 chars | Client prevents additional input; server rejects with 400 |
| History list empty (first use) | Empty state with Inbox icon + "No cash entries yet. Tap + to record your first entry." |
| Network fails mid-create | idempotencyKey already generated; retry with same key is safe |
| User changes tz mid-session | `tzOffsetMinutes` read fresh on each summary/list call from `Intl.DateTimeFormat` |

---

## 9. UX Copy

### English

| Element | Copy |
|---|---|
| Page title | Cash Register |
| Tab: calculator | Calculator |
| Tab: history | History |
| Calculator placeholder | Enter amount |
| Cash In button | Cash In |
| Cash Out button | Cash Out |
| Note field label | Add note (optional) |
| Note placeholder | e.g. delivery, rent, misc |
| Success toast — Cash In | Cash In saved |
| Success toast — Cash Out | Cash Out saved |
| Error toast — save failed | Could not save. Try again. |
| Edit drawer title | Edit Entry |
| Edit save button | Save Changes |
| Edit success toast | Entry updated |
| Void confirm title | Void this entry? |
| Void confirm description | This entry will be marked as voided. You can restore it later. |
| Void reason label | Reason (optional) |
| Void confirm button | Void Entry |
| Void success toast | Entry voided |
| Restore success toast | Entry restored |
| Delete confirm title | Delete permanently? |
| Delete confirm description | This cannot be undone. Only voided entries can be deleted. |
| Delete confirm button | Delete |
| Delete success toast | Entry deleted |
| Empty — all | No cash entries yet |
| Empty — Cash In | No Cash In entries |
| Empty — Cash Out | No Cash Out entries |
| Summary — Today | Today |
| Summary — Last 7 Days | Last 7 Days |
| Summary — Last 30 Days | Last 30 Days |
| Summary — In | In |
| Summary — Out | Out |
| Summary — Net | Net |
| Error: invalid expression | Invalid expression |
| Error: divide by zero | Cannot divide by zero |
| Error: amount too high | Amount is Rs [X]. Confirm? |
| Error: online only (MVP) | No internet connection. Please retry. |
| Error: restore before edit | Restore the entry before editing |
| Error: already voided | Entry is already voided |
| Error: not voided | Entry is not currently voided |
| History filter: All | All |
| History sort label | Sort by |
| History sort: Newest | Newest |
| History sort: Oldest | Oldest |
| History sort: Highest | Highest |
| History sort: Lowest | Lowest |
| Entry row: voided badge | Voided |
| Entry row: edited badge | Edited |

### Hindi (i18n keys)

All keys added to `en.json` and `hi.json` under `cashReg.*` namespace (e.g.
`cashRegTitle`, `cashRegCashIn`, `cashRegEntrySaved`, etc.). Full list to be
authored during implementation; key names follow existing HP i18n patterns.

---

## 10. Mobile Layout

- Primary breakpoint: 375px. Minimum: 320px.
- Calculator panel: full-height, no scroll — keypad + display + buttons all visible without scrolling on iPhone SE (320px width, ~568px height).
- Keypad: 4 columns, 4 rows. Each key: min 56px × 56px touch target.
- Cash In / Cash Out buttons: full-width row, each 50%. min-height 52px.
- Note field: collapsible or always shown below keypad — fits in viewport.
- History panel: scrollable list; summary header sticky at top.
- Bottom nav: hidden on this page (`data-hide-bottom-nav="true"` on page root).
- Back button: top-left. Tab toggle: top-right icon button.
- No horizontal overflow at 320px — all amounts use `formatPaiseCompact` (e.g. "₹1.2L").

### Native behaviour (Capacitor)

- `playCashInSound()` / `playCashOutSound()`: plays pre-bundled audio via Capacitor Sound plugin. Falls back silently if plugin unavailable.
- `vibrateNotification()`: Capacitor Haptics `ImpactStyle.Medium`. No-op on web.
- Both are fire-and-forget (`void fn()`); errors do not block the save flow.

---

## 11. Security

| Concern | Handling |
|---|---|
| Auth required | Yes — `requireAuth` on all routes |
| Business scoping | `requireBusinessAccess` middleware confirms requesting user has an active `BusinessUser` row for the businessId in the URL |
| Permission gating | `cash_entry:create`, `cash_entry:edit`, `cash_entry:delete` checked via `requirePermission()` |
| Expression injection | No `eval` — custom tokeniser. Server validates independently of client |
| Amount manipulation | Server cross-checks `validateExpression(expression, amountPaise)` ±1 paisa tolerance |
| Idempotency abuse | Key scoped to `(businessId, idempotencyKey)` unique constraint; no info leak on duplicate |
| Hard-delete protection | Only voided rows; additional DB-level constraint (`voidedAt NOT NULL`) via `deleteMany({ where: { voidedAt: { not: null } } })` |
| Rate limit | 60 writes/min per `businessId` (existing rate-limit middleware) |
| Text sanitisation | `sanitizeText()` applied to `note` and `voidReason` before DB write |

---

## 12. Effort Estimate

| Layer | Files | Estimated LOC | Effort |
|---|---|---|---|
| Prisma migration | 1 | ~60 | 0.5 day |
| Server: schemas + routes + mutations + queries | ~5 | ~400 | 1.5 days |
| Expression evaluator (shared algo) | 2 | ~200 | 0.5 day |
| Frontend: service + reducer + utils + types | ~5 | ~350 | 1 day |
| Frontend: components (12 components) | ~12 | ~900 | 2 days |
| i18n keys (en + hi) | 2 | ~80 keys | 0.5 day |
| Tests + QA | — | — | 1 day |
| **Total** | | | **~7 days** |

### Dependencies

| Dependency | Status | Notes |
|---|---|---|
| `requireBusinessAccess` middleware | Existing | Confirm it's in HP — if not, build it first |
| `requirePermission()` | Existing | Confirm `cash_entry:*` permission keys are in default role seeds |
| Idempotency middleware | Existing in DH | Port to HP if not already present |
| `api()` wrapper with offline queue | Existing | Use as-is; pass `entityType:'cash_entry'` |
| Capacitor Sound plugin | Unknown | Check if HP already uses it; may need to add to `package.json` |
| Capacitor Haptics | Existing | Already used in HP |

---

## 13. Phase 3 Accounting Bridge (Non-MVP, noted here for architect)

When accounting ledger is live, each `CashEntry` should auto-post a
`JournalEntry`. The `ledgerJournalId` column on `CashEntry` is reserved to
store the link. Posting rules (suggested, not in scope for this ticket):

- `direction=IN` → Debit "Cash in Hand" account, Credit "Misc Income" (or
  party account if party is linked — Phase 2 enhancement)
- `direction=OUT` → Credit "Cash in Hand" account, Debit "Misc Expense" (or
  expense category)

Auto-posting vs manual posting to be decided by architect during Phase 3.

---

## 14. Out of Scope

- Offline mutation queue (online-only MVP; queue integration is Phase 2)
- GST percentage preset buttons
- Party linkage (attach entry to a customer/vendor)
- PDF / CSV export of cash register history
- Recurring / scheduled entries
- Cash denomination tracking / end-of-day drawer count
- Auto-posting to double-entry accounting ledger
- Multi-currency cash entries
- Approval workflow for large cash amounts
- Dashboard widget showing today's cash net (can be added to dashboard separately)
- Per-user pin / re-auth before hard-delete

---

## 15. Acceptance Criteria

### Backend

- [ ] `curl -X POST /api/businesses/:bId/cash-entries -d '{...valid...}'` → `201 { success: true, entry: { id, direction, amountPaise, ... } }`
- [ ] Same request with same `idempotencyKey` → `201` with same `entry.id` (idempotent)
- [ ] Without auth cookie → `401`
- [ ] User not member of business → `403`
- [ ] User missing `cash_entry:create` permission → `403`
- [ ] `amountPaise` contradicts `expression` → `400 EXPRESSION_MISMATCH`
- [ ] Invalid expression chars → `400 VALIDATION_ERROR`
- [ ] Division by zero in expression → `400 VALIDATION_ERROR`
- [ ] `curl GET /summary?tzOffsetMinutes=330` → `{ today, last7Days[7], last30 }` with correct day count
- [ ] `curl PATCH /:id` on voided entry → `409 CONFLICT`
- [ ] `curl POST /:id/void` twice → second returns `409 CONFLICT`
- [ ] `curl DELETE /:id` on active entry → `409 CONFLICT`
- [ ] `curl DELETE /:id` on voided entry → `200 { success: true }`
- [ ] `npx tsc --noEmit` in server → 0 errors

### Frontend

- [ ] Screenshot: Calculator panel — empty expression (placeholder visible)
- [ ] Screenshot: Calculator panel — valid expression with live Rs total
- [ ] Screenshot: Calculator panel — invalid expression (error shown in display)
- [ ] Screenshot: Calculator panel — submitting state (button spinner)
- [ ] Screenshot: History panel — loading skeletons
- [ ] Screenshot: History panel — empty state (Inbox icon + message)
- [ ] Screenshot: History panel — populated list with summary header
- [ ] Screenshot: Edit drawer — pre-filled expression
- [ ] Screenshot: Void confirm dialog
- [ ] Screenshot: Delete confirm dialog
- [ ] 375px layout: keypad fully visible, no scroll needed on calculator tab
- [ ] 320px: no horizontal overflow on any panel
- [ ] `npx tsc --noEmit` in frontend → 0 errors
- [ ] Browser console: 0 errors, 0 warnings on happy path
- [ ] Hindi: all i18n keys render without missing-key fallback

---

## 16. Open Questions for Sawan

These must be resolved before the architect runs.

1. **`requireBusinessAccess` middleware** — does it already exist in HP's Express server? If not, should it be built as part of this feature or as a prerequisite?

2. **Idempotency middleware** — HP has this ported from DH or not? (`server/src/middleware/idempotency.middleware.ts`)

3. **Permission keys** — should `cash_entry:create`, `cash_entry:edit`, `cash_entry:delete` be added to the default `owner` and `manager` role seed scripts, or managed separately?

4. **Offline MVP decision** — confirmed online-only for MVP? If yes, the failure mode when offline is a non-dismissible toast ("No internet connection. Please retry.") and the user must wait. Is that acceptable?

5. **Hard-delete access** — should hard-delete be owner-only, or should manager-role also have `cash_entry:delete`?

6. **Large-amount warning threshold** — is Rs 10,00,000 (10L) the right warning threshold? Or should this be configurable per business?

7. **Accounting auto-post** — confirmed that Phase 1 does NOT auto-post to the journal, and the `ledgerJournalId` column is reserved but null? Any naming preference for the column?

8. **Sound assets** — are cash register chime `.mp3` files already in HP's asset bundle, or does this feature need to add them?

9. **Route access** — is `/cash-register` behind a feature flag or always visible in the nav for all plans (including free tier)?

10. **`createdBy` field** — in HP, `BusinessUser.id` or `User.id`? (DH used `userId` from single-tenant; HP should probably use `businessUserId` as the actor identifier for audit consistency with other features.)

---

## 17. QA Checklist

Verifier must confirm each item before marking the feature done.

- [ ] Create a Cash In entry — appears in history immediately
- [ ] Create a Cash Out entry — appears in history immediately
- [ ] Expression `100+50*2` evaluates to Rs 200 (not Rs 300 — operator precedence correct)
- [ ] Division by zero shows error, does not save
- [ ] Edit an entry — audit event EDITED visible in `CashEntryEvent` table
- [ ] Void an entry with reason — appears in history with "Voided" badge, excluded from summary totals
- [ ] Restore a voided entry — appears in history without "Voided" badge, re-included in summary totals
- [ ] Hard-delete a voided entry — row gone from DB, history updated
- [ ] Hard-delete button not visible / disabled for active entries
- [ ] Summary "Today" total updates after new entry without page refresh
- [ ] Filter "Cash In" shows only IN entries
- [ ] Filter "Cash Out" shows only OUT entries
- [ ] Sort "Highest" shows largest amount first
- [ ] Idempotent retry (same idempotencyKey) does not create duplicate
- [ ] Offline toast shown when device has no connectivity (MVP: no queue)
- [ ] 320px layout: no horizontal scroll, all buttons tappable
- [ ] Hindi i18n: all strings render in Hindi when language is switched
- [ ] tsc clean: 0 errors server + frontend
- [ ] Console: 0 errors on happy path
- [ ] Capacitor sound plays on physical Android device (or graceful fallback on web)
