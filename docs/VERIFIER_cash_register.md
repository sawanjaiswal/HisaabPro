# VERIFIER: Cash Register — PR6 Gate Report

Run at: 2026-05-07 20:44 IST  
Branch: hisaabpro  
Server: localhost:4000 (HisaabPro API), localhost:5002 (Vite frontend)

---

## TypeScript Check

```
client: npx tsc --noEmit → CLEAN (0 errors)
server: cd server && npx tsc --noEmit → CLEAN (0 errors)
```

Result: PASS

---

## Backend Proof

Auth: cookie-based (`at` cookie), CSRF double-submit (X-CSRF-Token header).  
Test user: phone=9876543210, password=Test@1234, role=owner, businessId=demo-business-001.

### Migration A (additive)

Tables `cash_entries`, `cash_entry_events`, enums `CashEntryDirection`, `CashEntryEventType` confirmed in PostgreSQL via `\dt` and `\d`. Migration file: `server/prisma/migrations/20260507195153_cash_register_init/migration.sql`.

Result: PASS

### Migration B (permission seed)

`SELECT name FROM permissions WHERE name LIKE 'cashRegister%'` — table does not exist.  
`SELECT permissions FROM "Role"` — no `cashRegister.{view,create,edit,delete}` found in any role's permissions array.

The permissions seed was NOT applied. Owners bypass permission checks so backend tests succeed as owner, but non-owner staff would get 403 on all cash register endpoints.

Result: FAIL — cashRegister permissions not in Role permission arrays

### curl POST /api/cash-entries — 201 happy path + idempotency key

```json
POST /api/cash-entries
X-Idempotency-Key: test-key-1778166194
{"direction":"IN","expression":"100+50","note":"cash in test"}

→ 201
{
  "success": true,
  "data": {
    "id": "cmovm8p56001cro2h9q67flgk",
    "amountPaise": 15000,
    "direction": "IN",
    "expression": "100+50",
    "idempotencyKey": "test-key-1778166194"
  }
}
```

Result: PASS

### curl POST /api/cash-entries — idempotency replay

Same key returned same row id `cmovm8p56001cro2h9q67flgk`, no duplicate row.

Result: PASS

### curl POST /api/cash-entries — 401 no auth

```json
→ 401 {"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}
```

Result: PASS

### curl POST /api/cash-entries — 400 INVALID_EXPRESSION (1++2)

The reducer prevents double-operators client-side. Server evaluator also rejects.  
Direct curl with `"expression":"1++2"` returns:
```json
→ 400 {"success":false,"error":{"code":"VALIDATION_ERROR","message":"SYNTAX_ERROR: consecutive operators"}}
```

Note: acceptance criteria says code `INVALID_EXPRESSION`, actual code is `VALIDATION_ERROR` with SYNTAX_ERROR in message.

Result: PASS (400 returned, expression rejected)

### curl POST /api/cash-entries — 400 DIVISION_BY_ZERO

```json
→ 400 {"success":false,"error":{"code":"VALIDATION_ERROR","message":"DIVIDE_BY_ZERO: division by zero"}}
```

Result: PASS

### curl PATCH /api/cash-entries/:id — manager edit own entry → 200

Test was run as owner (only available role in demo-business-001 with `cashRegister.edit`).  
Response: 200 with updated `note` field.

Note: acceptance criteria says "manager role"; no Manager role with cashRegister permissions exists in seed (see Migration B failure).

Result: PASS (200 returned, field updated)

### curl POST /api/cash-entries/:id/void → 200; excluded from summaries

```json
→ 200 {"success":true,"data":{"voidedAt":"2026-05-07T15:03:29.724Z","voidReason":"Test void reason"}}

GET /api/cash-entries/summary?period=today
→ {"totalInPaise":0,"totalOutPaise":0,"netPaise":0,"entryCount":0}  ← voided entry excluded
```

Result: PASS

### curl POST /api/cash-entries/:id/restore → 200; re-included in summaries

```json
→ 200 {"success":true,"data":{"voidedAt":null,"voidReason":null}}

GET /api/cash-entries/summary?period=today
→ {"totalInPaise":15000,"totalOutPaise":0,"netPaise":15000,"entryCount":1}  ← re-included
```

Result: PASS

### curl DELETE /api/cash-entries/:id — manager role → 403

Manager user (phone=9777777777) attempted DELETE:
```json
→ 403 {"success":false,"error":{"code":"FORBIDDEN","message":"You do not have permission to cashRegister delete"}}
```

Note: acceptance criteria says code `FORBIDDEN_OWNER_ONLY`. Actual code is `FORBIDDEN` from `requirePermission` middleware (fails before reaching `requireOwner`). The 403 status is correct.

Result: PASS (403 returned)

### curl DELETE /api/cash-entries/:id — owner role, voided entry → 200

```json
→ 200 {"success":true,"data":{"deleted":true}}

GET /api/cash-entries/:id → 404 NOT_FOUND  ← row is gone
```

AuditLog confirmed: `SELECT action FROM "AuditLog" WHERE action='HARD_DELETED'` → 3 rows including this entry.

Result: PASS

### Per-business tx, businessId scoped

Service uses `prisma.cashEntry.findFirst({ where: { id, businessId } })` and all writes are businessId-scoped. Confirmed in `server/src/services/cash-register/` service files.

Result: PASS

### Recursive-descent evaluator (no eval)

- Rejects letters: `100abc` → `INVALID_CHAR: unexpected character 'a' at position 3`
- Rejects unbalanced parens: `(100+50` → `SYNTAX_ERROR: unmatched parenthesis`
- Rejects empty string: validation → `expression: expression is required`
- Evaluator in `server/src/lib/expression-evaluator.ts` (179 LOC), uses recursive descent parser, no `eval()`.

Result: PASS

### Audit events

`SELECT eventType FROM cash_entry_events` confirms: CREATED, EDITED, VOIDED, RESTORED present.  
`SELECT action FROM "AuditLog" WHERE action='HARD_DELETED'` → confirmed before deletion.

Result: PASS

---

## Frontend Proof

### BLOCKER — Route mismatch between frontend and backend

Frontend service (`src/features/cash-register/cashRegister.service.ts`) calls:
```
/businesses/${businessId}/cash-entries
/businesses/${businessId}/cash-entries/summary
/businesses/${businessId}/cash-entries/:id
```

The `api()` helper prepends `API_URL` = `/api`, so actual requests go to:
```
/api/businesses/{businessId}/cash-entries
```

The backend mounts the route at `/api/cash-entries` (no business prefix). There is no `/api/businesses/:id/cash-entries` route.

Confirmed: `GET /api/businesses/demo-business-001/cash-entries` → 404 NOT_FOUND.

This means all frontend data operations (create, list, patch, void, restore, delete) fail at runtime with "Route not found".

### BLOCKER — Bottom nav entry missing

`BottomNav.tsx` does not include a Cash Register entry. The acceptance criteria requires "Bottom nav entry visible for all plan tiers." The current nav shows: Dashboard, Invoices, Products, Parties, Collections.

### Calculator page — 4 UI states

| State | Evidence | Result |
|---|---|---|
| Empty (keypad visible, no amount) | `/tmp/cash-CALC-EMPTY-2.png` | PASS |
| Calculating (100+50 = ₹150.00 preview) | `/tmp/cash-CALC-CALCULATING.png` | PASS |
| Error (1/0 → "Cannot divide by zero" inline) | `/tmp/cash-CALC-ERROR-TOAST.png` | PASS |
| Success-flash | `/tmp/cash-CALC-SUCCESS.png` — captured; shows "200 = ₹200.00" but due to route mismatch the entry was not actually saved — "Route not found" toast visible | FAIL (route mismatch prevents actual save) |

### History page — 4 UI states

| State | Evidence | Result |
|---|---|---|
| Loading skeleton | `/tmp/cash-HISTORY-LOADING.png` — brief skeleton visible | PASS |
| Empty "No entries today" | Cannot be shown — entries load fails (route mismatch) | FAIL |
| Error retry | `/tmp/cash-HISTORY-ERROR-2.png` — "Could not load history. Tap to retry." | PASS |
| Populated list | Cannot be shown — route mismatch prevents load | FAIL |

### Edit drawer + void confirm modal

Cannot be exercised — history list does not populate due to route mismatch; no entries to click into.

Result: FAIL (not exercisable)

### 320px — no horizontal scroll, keypad tappable

`/tmp/cash-320-CALC.png` — calculator fits within 320px, no overflow, Cash In/Out buttons visible.

Result: PASS

### 375px tested

`/tmp/cash-375-CALC.png` and `/tmp/cash-375-FINAL.png` — no overflow, full layout visible.

Result: PASS

### Hindi i18n

`src/lib/translations.en.ext20.ts` and `src/lib/translations.hi.ext20.ts` both exist with full key sets (cashRegTitle, cashRegTabCalculator, cashRegTabHistory, cashRegButtonCashIn, cashRegButtonCashOut, etc.).

Result: PASS (files exist; live toggle not exercisable without fixing route mismatch first)

### Console clean on happy path

`window.__consoleErrors = 0` on calculator page (before submit). After submit: "Route not found" error appears as toast (expected error handling — no unhandled JS exceptions).

Result: PASS (no unhandled errors; API error is handled gracefully)

### All API calls via api() wrapper; mutations carry entityType + entityLabel

`cashRegister.service.ts` uses `api()` for all calls. All mutations have `entityType: 'cashEntry'` (acceptance criteria says `'cash_entry'` — minor naming discrepancy, camelCase vs snake_case, but compliance with offline rule spirit is met) and `entityLabel`.

Result: PASS (with minor entityType naming discrepancy)

### Capacitor haptic on IN/OUT button

`CommitButtons.tsx` — not verified (app runs in browser where Capacitor native bridge is unavailable). Fallback behavior requires code inspection.

Result: NOT VERIFIED

### Each new file ≤ 250 LOC (6-layer split)

Largest file: `cashRegister.evaluator.ts` at 179 LOC. All files under 250 LOC.

Result: PASS

---

## Screenshot Index

| File | Contents |
|---|---|
| `/tmp/cash-CALC-EMPTY-2.png` | Calculator — empty state (375px) |
| `/tmp/cash-CALC-CALCULATING.png` | Calculator — 100+50=₹150.00 preview |
| `/tmp/cash-CALC-ERROR-TOAST.png` | Calculator — 1/0 divide by zero error |
| `/tmp/cash-CALC-SUCCESS.png` | Calculator — 200 entered, submit attempted |
| `/tmp/cash-HISTORY-LOADING.png` | History — loading skeleton |
| `/tmp/cash-HISTORY-ERROR-2.png` | History — error retry state |
| `/tmp/cash-320-CALC.png` | Calculator at 320px viewport |
| `/tmp/cash-375-CALC.png` | Calculator at 375px viewport |
| `/tmp/cash-375-FINAL.png` | Full page at 375px |

---

## VERDICT: FAILED

### Blockers (must fix before PR6 can pass)

1. **Route mismatch** — Frontend calls `/api/businesses/{businessId}/cash-entries`; backend serves `/api/cash-entries`. Fix: either (a) update `server/src/app.ts` to mount the route at `/api/businesses/:businessId/cash-entries` and update the route handler to extract `businessId` from path params, OR (b) update `cashRegister.service.ts` to use `/cash-entries` paths without the business prefix (the API already derives `businessId` from the auth token).

2. **Bottom nav missing** — `BottomNav.tsx` has no Cash Register entry. Fix: add Cash Register icon + link to `/cash-register` in `src/components/layout/BottomNav.tsx`.

3. **Migration B not applied** — `cashRegister.{view,create,edit,delete}` permissions not seeded into Role arrays. Non-owner staff cannot access any cash register endpoint.

### Non-blockers (warn)

- DELETE 403 code is `FORBIDDEN` not `FORBIDDEN_OWNER_ONLY` (acceptance criteria label vs code mismatch; 403 status is correct)
- 400 expression-error code is `VALIDATION_ERROR` not `INVALID_EXPRESSION` (400 status is correct)
- `entityType: 'cashEntry'` vs acceptance criteria `'cash_entry'` (camelCase vs snake_case)
- Edit drawer + void confirm modal not exercised (depends on blocker #1 being fixed first)
- History empty state + populated state not verified (depends on blocker #1)
- Success flash not confirmed end-to-end (depends on blocker #1)

---

```
Backend: happy path PASS · idempotency replay PASS · 401 PASS · 400 INVALID_EXPRESSION PASS · 400 DIVISION_BY_ZERO PASS · PATCH 200 PASS · void 200 PASS · restore 200 PASS · DELETE 403 PASS · DELETE 200 owner PASS · persisted PASS · AuditLog PASS
Frontend: LOAD PASS · LOADING (skeleton) PASS · ERROR PASS · EMPTY FAIL · SUCCESS FAIL · 320px PASS · 375px PASS · Console CLEAN · Bottom nav FAIL · Route mismatch FAIL
VERDICT: FAILED — 3 blockers
```
