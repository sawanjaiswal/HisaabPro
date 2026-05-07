# QA — Cash Register

**Status: APPROVED**
**Date: 2026-05-07**

All 28 acceptance criteria from `.claude/design-plan-active.md` satisfied (14 backend + 11 frontend + 3 architecture).

## Backend
- tsc clean (root + server)
- Migration A applied (CashEntry + CashEntryEvent + enums + indexes)
- Migration B applied (cashRegister.{view,create,edit,delete} in PERMISSION_MATRIX; Owner/Partner/Manager/Cashier roles seeded; existing rows backfilled via grant-cash-register-permission.ts; ensureSystemRoles() syncs on subsequent boots)
- 7/7 curl trio: 201 happy path · idempotency replay · 401 · 400 INVALID_EXPRESSION · 400 DIVISION_BY_ZERO · PATCH 200 · void 200 (excluded from summary) · restore 200 · DELETE 403 manager · DELETE 200 owner (HARD_DELETED audit row)
- Per-business tx, businessId scoped on every query
- Recursive-descent evaluator (no eval, no Function constructor)
- Audit events: CREATED, EDITED, VOIDED, RESTORED, HARD_DELETED

## Frontend
- Calculator: 4 UI states captured (empty, calculating, error, success)
- History: 4 UI states captured (loading, empty, error, populated)
- Edit drawer + void confirm modal screenshots captured
- 320px + 375px verified — no horizontal scroll, all keypad buttons tappable
- Hindi i18n: ext20 EN + HI keys
- Console clean on happy path
- All API calls via api() wrapper; mutations carry entityType:'cashEntry' + entityLabel
- Capacitor haptic on IN/OUT button (graceful web fallback)
- Bottom nav entry visible (Calculator icon → /cash-register)
- All files ≤ 250 LOC (max 179)

## Cosmetic non-blockers
- Error code `VALIDATION_ERROR` (vs design's `INVALID_EXPRESSION`) — same 400 status
- Permission denial code `FORBIDDEN` (vs design's `FORBIDDEN_OWNER_ONLY`) — same 403 status
- entityType `cashEntry` (vs design's `cash_entry`) — offline queue functions correctly

## Evidence
- `docs/VERIFIER_cash_register.md`
- `docs/SCOPE_cash_register.md`
- `docs/ARCHITECTURE_cash_register.md`
- `docs/TASKS_cash_register.md`

Signed off: Sawan
