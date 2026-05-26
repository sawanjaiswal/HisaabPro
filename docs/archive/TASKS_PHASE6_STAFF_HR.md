# Phase 6 Staff & HR — Task Manager PR Sequence

**Owner:** task-manager  ·  **Created:** 2026-05-17  ·  **Architecture version:** v2.3 (PASS at security re-audit)

> This file is the execution contract for the Phase 6 epic. Source for every row below: `docs/ARCHITECTURE_PHASE6_STAFF_HR.md` §18 (File Plan, 223 rows) + §17 (Acceptance Gates) + `docs/SCOPE_PHASE6_STAFF_HR.md` §11 (acceptance criteria) + `docs/SECURITY_AUDIT_PHASE6_STAFF_HR.md` v2.3 closure.

> Calendar-duration markers are **very rough** wall-clock with one backend agent + one frontend agent running serial-within-PR + parallel-across-PR where dependencies allow. Real velocity varies with proof-gate fail/redo cycles.

---

## PR0 — Cross-tenant leak audit (architect-led doc)

**Files:** 1 doc (`docs/TENANCY_AUDIT.md`)
**Depends on:** none (this gates everything)
**Duration:** 0.5d
**Why first:** SCOPE Q11.12 hard gate — every Prisma WHERE in the existing repo must filter on `businessId`. Phase 6 adds 8 new tables (Employee, Attendance, GeofenceConsent, PayrollRun, Payroll, PayslipSnapshot, AuditLog, AuditLogRedaction) + extends 6 nullable columns; a missing `businessId` filter that's a "stale row leak" today becomes a "salary information leak across firms" tomorrow.

**Build:**
1. architect agent greps every `prisma.<model>.findMany|findFirst|findUnique|update|delete|count|aggregate` across `server/src/**`.
2. For each hit, classify: (a) has `businessId` in the WHERE, (b) is internal-bookkeeping (no `businessId` column on the model), (c) MISSING — leak.
3. Output `docs/TENANCY_AUDIT.md` with one row per query: `file:line | model | classification | fix-PR (if any)`.

**Proof gate (verifier collects):**
- [ ] `docs/TENANCY_AUDIT.md` exists with 100% coverage (zero `findMany|findFirst|findUnique|update|delete` left unclassified)
- [ ] Every "MISSING" classification has a fix-PR field non-empty (PR1 to PR8)
- [ ] Architecture §17.1 first acceptance gate signed off

**QA gate:** architecture-auditor re-reads and approves. APPROVED → PR1 can start.

---

## PR1 — Schema core + enum widenings + middleware + helper SSOT

**Files:** 55 rows (per architecture §18.2 — actual rows 2 through 55, with §18.2 noting +5L for A04.1 schema, +1L for Party.type comment, +1 NEW row 24c for security-events.ts)
**Depends on:** PR0 (TENANCY_AUDIT.md must list zero unresolved violations against PR1-touched paths)
**Duration:** 2d (highest LOC density; 5 schema/migration tests included)

**Lands:**

| Group | Rows | What |
|---|---|---|
| Schema + migration | 2, 2a, 3 | `schema.prisma` +186L + `Payment.reversesPaymentId Int? @unique` + FK self-ref (relation pair `PaymentReversal`); migration SQL ~265L includes ADD COLUMN + CREATE UNIQUE INDEX + ADD CONSTRAINT FK |
| Enum widenings | 6, 7, 17 | `shared/enums.ts` +12L (PAYMENT_TYPES widen + PARTY_TYPES widen to add STAFF + CUSTOMER_PAYMENT_TYPES split); `payment.schemas.ts` +12L (Public + Internal split); `party.schemas.ts` +6L (`includeStaff?: boolean`) |
| Helper SSOT (M6 + M8) | 8, 8a | `shared/payment-types.ts` ~95L (assertCustomerPaymentType throws AppError(INVALID_PAYMENT_TYPE, 400)); `server/src/lib/errors.ts` +2L for the ErrorCode enum entry |
| 8 downstream consumer edits (M6) | 9, 10, 11, 12, 13, 14, 15, 16 | `payment/create.ts`, `payment/update-delete.ts`, `payment/get-list.ts`, `report/report-payment.ts`, `report/report-party.ts`, `party/ledger.service.ts`, `dashboard/home.ts`, `party/list-get.ts` — each gets the helper import + assert call (+ default filter on list-get for STAFF exclusion) |
| Party guards (M7) | 16a, 17a, 17b, 17c | `party/create.ts` rejects `type='STAFF'` with 400; FE `party.constants.ts` + PartyFilterBar + PartyFormBasic re-verified to NOT surface STAFF in customer-facing pickers |
| Middleware | 18, 19 | `middleware/rate-limit/per-business-factory.ts` ~80L (real factory wrap, not the fictional `niceRateLimit`); `middleware/require-active-business.ts` ~75L (uses `req.user.userId` — A01.1) |
| Permissions | 20 | `services/settings/permissions-data.ts` +20L for HR permission keys |
| Audit SSOT scaffolding | 4, 5 | `lib/audit/audit-coverage.ts` ~120L (list of 22 mutation services); `scripts/enforce-audit-coverage.mjs` ~200L (pre-commit enforcer) |
| Security events SSOT (Q2) | 24c | `lib/security-events.ts` ~70L (enum + emitSecurityEvent dispatcher) |
| Tests | 21, 22, 23, 24, 24a, 24b, 25-55 | migration test, helper test, middleware cross-tenant test, payroll-type-guard test, staff-party-create-guard test, party-staff-roundtrip test + 26 fixture rows |

**Proof gate (verifier collects):**
- [ ] `npx tsc -b --noEmit` clean
- [ ] `npx prisma migrate dev --name phase6_schema_core` applied on shadow DB without drift
- [ ] `npx prisma migrate diff` shows the `Payment.reversesPaymentId` column added with `Int? @unique` + FK self-ref (A04.1 schema-check gate)
- [ ] `curl -X POST /api/payments -d '{"type":"PAYROLL_OUT", ...}'` returns **400 INVALID_PAYMENT_TYPE** (M8 single-rejection-path gate — must not 500)
- [ ] `curl -X POST /api/payments -d '{"type":"PAYROLL_IN", ...}'` same
- [ ] `curl -X POST /api/parties -d '{"type":"STAFF", ...}'` returns **400 INVALID_PARTY_TYPE** (M7 guard)
- [ ] `curl -X GET /api/parties` does NOT include STAFF rows by default
- [ ] `curl -X GET /api/parties?includeStaff=true` DOES include STAFF rows
- [ ] Integration test: `requireActiveBusiness` middleware reading `req.user.id` (undefined) fails the cross-tenant assertion; the real middleware reading `req.user.userId` passes (A01.1 counter-example)
- [ ] `scripts/enforce-audit-coverage.mjs` exits 0 (lists the services that will gain audit-writes in PR7; PR1 itself doesn't add audit-writes yet but the SSOT lands)
- [ ] No `req.user.id` reference anywhere in the diff (enforce.js pattern check)

**QA gate:** scope-auditor + architecture-auditor + security re-read PR1 diff and approve. APPROVED → PR2, PR3, PR5, PR7 can start in parallel.

---

## PR2 — Tenancy elevation (suspend / reactivate / /me / TenantChip)

**Files:** 15 rows (per architecture §18.3, rows 56-70)
**Depends on:** PR1 (requires `requireActiveBusiness` middleware + permissions data)
**Duration:** 1d

**Lands:**

| Group | Rows | What |
|---|---|---|
| Service | 56, 57, 59 | `auth/switch-business.service.ts` +30L (audit hook); `business/suspend.service.ts` ~140L (NEW); `auth/me.service.ts` +12L (`suspendedAt` fields) |
| Route | 58 | `routes/businesses.routes.ts` +60L (suspend + reactivate endpoints, owner-only) |
| FE | 60-65 | TenantChip component + suspend banner + reactivation modal + tests |
| Tests | 66-70 | Integration tests for switch + suspend + reactivate (one per state transition) |

**Proof gate (verifier collects):**
- [ ] `npx tsc -b --noEmit` clean
- [ ] `curl -X POST /api/businesses/:id/suspend` (as owner): 200 + AuditLog row with `action='SUSPEND'`
- [ ] `curl -X POST /api/businesses/:id/suspend` (as non-owner): 403
- [ ] After suspend: `curl -X GET /api/parties` (a tenant-scoped route): **403 FIRM_SUSPENDED**
- [ ] After member-level suspend: same call: **403 MEMBER_SUSPENDED**
- [ ] `curl -X GET /me`: response includes `business.suspendedAt` and `businessUser.suspendedAt` (timestamps when set, null otherwise)
- [ ] Cross-tenant: User A switches Biz1 → Biz2; next request reads ONLY Biz2 data; integration test asserts zero leak
- [ ] FE screenshots: TenantChip in 4 states (normal, member-suspended, firm-suspended, loading); 320px no overflow
- [ ] FE console: clean

**QA gate:** verify acceptance gates §17.1. APPROVED → PR2 done; PR6 can start once PR3 and PR5 also done.

---

## PR3 — PIN port + signed-cookie grace + middleware

**Files:** 35 rows (per architecture §18.4, rows 71-105)
**Depends on:** PR1 (errors.ts + security-events.ts + middleware factory)
**Duration:** 2d (DH-port heavy; pf + domain-separation grew rows 71/74/75/78 in v2.3)

**Lands:**

| Group | Rows | What |
|---|---|---|
| PIN service (DH port) | 71, 72, 73 | `security-pin/pin-verify.service.ts` ~220L (success branch passes `pinHash` into `issuePinGraceCookie`); `pin-lockout.service.ts` ~210L; `pin-reset.service.ts` ~220L |
| Cookie grace | 74, 75 | `pin-grace-cookie.ts` ~190L (domain-sep prefix `'pin-grace-cookie-v1:'` + `pf` field); test ~210L (covers pf mismatch, domain-prefix rejection, security-event emission) |
| Constants + job | 76, 77 | `constants/pin-auth.constants.ts` ~60L; `jobs/pin-gc.job.ts` ~130L |
| Middleware | 78 | `middleware/require-recent-pin.ts` ~130L (SELECTs current `UserAppSettings.pinHash` before calling `verifyPinGraceCookie` for the pf compare) |
| Route + schema | 79, 80 | `routes/auth-pin.routes.ts` ~150L; `schemas/pin.schemas.ts` ~80L |
| Bootstrap | 81 | `app.ts` +5L (cookieParser verify — already mounted) |
| FE | 82-105 | PinGateProvider + PinPad components + `window.__pinGate.requestVerify()` helper + tests; replaces api.ts 401-refresh swallow (SCOPE Gap 5) |

**Pre-planned splits (S6 mitigation):**
- If `pin-verify.service.ts` lands >230L → extract `pin-verify-orchestrator.ts`
- If `pin-reset.service.ts` lands >230L → extract `pin-reset-token-mint.ts`
- If `pin-grace-cookie.ts` lands >230L → extract `pin-grace-cookie-verify.ts` (pf compare + domain-prefix verify lives there)

**Proof gate (verifier collects):**
- [ ] `npx tsc -b --noEmit` clean
- [ ] `curl -X POST /api/auth/pin/verify` with correct PIN: 200 + Set-Cookie: pin_gate_grace=<...> (httpOnly, secure, sameSite=strict, path=/api)
- [ ] Same call with wrong PIN: 401 + counter increment (per-device + per-phone)
- [ ] After 5 wrong on same device: 423 PIN_LOCKED_DEVICE + 30min retry-after
- [ ] After 20 wrong on same phone in 1h: 423 PIN_LOCKED_PHONE
- [ ] `curl -X POST /api/hr/employees` (a future PIN-gated route mocked for this gate): without cookie → 403 PIN_REQUIRED (NOT 401 — must not trip the api.ts refresh interceptor per Gap 5)
- [ ] PIN change rotates `pinHash` → next request with prior cookie: 403 PIN_REQUIRED + emits `pin_gate.pf_stale` (A02.2 pf gate)
- [ ] HMAC tamper: modify cookie middle byte → 403 + emits `pin_gate.cookie_tamper_detected`
- [ ] Cross-user replay: cookie issued for user A, presented in user B session: 403 + emits `pin_gate.cross_user`
- [ ] Domain-prefix omission: payload signed with JWT_SECRET but WITHOUT `'pin-grace-cookie-v1:'`: 403 + emits `pin_gate.domain_prefix_mismatch` (Q1 acceptance)
- [ ] Cookie size in headers: <500B (v2.3 ~270B with pf)
- [ ] FE screenshots: PIN modal loading / error / wrong-pin / locked / success; 320px no overflow
- [ ] FE: `window.__pinGate.requestVerify()` exists and resolves on success / rejects on cancel
- [ ] Integration test: api.ts does NOT redirect to login on 403 PIN_REQUIRED — instead surfaces the modal (Gap 5 closure)

**QA gate:** verify §17.3 + §17.5 + §17.6. APPROVED → PR3 done; PR4 (audit-search needs PIN gates audit-read) can start; PR6 unblocks.

---

## PR4 — Audit search + redaction UI

**Files:** 25 rows (per architecture §18.5, rows 106-130)
**Depends on:** PR3 (audit read endpoints are PIN-gated)
**Duration:** 1.5d

**Lands:**

| Group | Rows | What |
|---|---|---|
| Service | 106, 107 | `audit/audit-search.service.ts` ~180L (uses `websearch_to_tsquery('english', $1)` per A03.1); `audit/audit-redaction.service.ts` ~150L (phone/PIN field masking on read; raw stored) |
| Route + schema | 108, 109 | `routes/audit.routes.ts` ~120L (PIN-gated); `schemas/audit.schemas.ts` ~90L |
| FE | 110-130 | Audit log page + filter drawer + diff viewer + fuzz-input tests |

**Proof gate (verifier collects):**
- [ ] `npx tsc -b --noEmit` clean
- [ ] `curl -X GET /api/audit/logs?q=created` with PIN cookie: 200 + array of AuditLog rows
- [ ] Same call without PIN cookie: 403 PIN_REQUIRED
- [ ] Fuzz battery: `?q=R%26D`, `?q=(test)`, `?q=it%27s`, `?q=a%7Cb`, `?q=--`, `?q=%26%7C%21()` — each returns 200 with empty-or-matching results, never 500 (A03.1 fuzz gate — `to_tsquery` would crash on these inputs)
- [ ] Phone field returned as `*****1234` (last 4) — redacted on read; psql shows raw value stored
- [ ] FE screenshots: audit page loading / error / empty / success / search-with-results / diff-viewer; 320px no overflow
- [ ] FE: no PII leak in console (Rule K of PAGE_AUDIT_CHECKLIST)

**QA gate:** verify §17.3 + redaction acceptance. APPROVED.

---

## PR5 — Attendance domain

**Files:** 12 rows (per architecture §18.6, rows 131-142)
**Depends on:** PR1 (schema + middleware)
**Duration:** 1d

**Lands:**

| Group | Rows | What |
|---|---|---|
| Service | 131 | `hr/attendance.service.ts` ~200L (one-row-per-employee-per-day; unique constraint enforced) |
| Route + schema | 132, 133 | `routes/hr.routes.ts` ~150L (attendance endpoints); `schemas/attendance.schemas.ts` ~80L |
| FE | 134-142 | Attendance grid + per-day drawer + geofence consent flow + tests (Gap 4 closure: consent withdrawal pathway) |

**Proof gate (verifier collects):**
- [ ] `npx tsc -b --noEmit` clean
- [ ] `curl -X POST /api/hr/attendance -d '{employeeId, date, status}'`: 200 + AuditLog row
- [ ] Second POST for same (employeeId, date): **409** (unique constraint per §17.2)
- [ ] `curl -X DELETE /api/hr/geofence/consent` (consent withdrawal): 200 + future attendance recording proceeds without geo capture
- [ ] FE screenshots: attendance grid loading / error / empty (no employees yet) / success / 320px
- [ ] FE: geofence consent modal flow — initial-prompt, granted, revoked screenshots

**QA gate:** verify §17.2 first bullet + Gap 4 closure. APPROVED.

---

## PR6 — Employee + Payroll + STAFF Party pairing + reversal

**Files:** 35 rows (per architecture §18.7, rows 143-177)
**Depends on:** PR3 (PIN gates payroll FINALIZE), PR5 (attendance feeds payroll compute)
**Duration:** 2d (largest behavioural surface; reversal flow is gnarly)

**Lands:**

| Group | Rows | What |
|---|---|---|
| Employee service | 143, 144 | `hr/employee.service.ts` ~230L (S8 pairing: `createEmployee` wraps Party-STAFF-create + Employee-create in one tx); types ~60L |
| Payroll compute | 145 | `payroll/payroll-compute.ts` ~180L (pure; no I/O) |
| Payroll run service | 146 | `payroll/payroll-run.service.ts` ~245L (FINALIZE tx + reverse() with try/catch translating Prisma P2002 on `reversesPaymentId` to AppError 409 PAYMENT_ALREADY_REVERSED — A04.1) |
| Payroll snapshot | 147 | `payroll/payroll-snapshot.ts` ~140L (PayslipSnapshot writer) |
| Route + schema | 148, 149 | `routes/payroll.routes.ts` ~180L (PIN-gated); `schemas/payroll.schemas.ts` ~120L |
| FE | 150-177 | Employees list + detail + Payroll runs list + Payroll run detail + Payslip preview + PDF + share + tests |

**Pre-planned split (S6):** if `payroll-run.service.ts` >245L → extract `payroll-run-reverse.ts` (v2.3 makes this likely given the +catch block).

**Proof gate (verifier collects):**
- [ ] `npx tsc -b --noEmit` clean
- [ ] `curl -X POST /api/hr/employees -d '{name, phone, salary}'`: 200 + AuditLog row + Party row (type=STAFF) + Employee row both exist (S8 pairing test)
- [ ] Party row's `partyId` matches Employee.partyId (FK link)
- [ ] `curl -X POST /api/payroll/runs -d '{periodStart, periodEnd}'` (PREVIEW): 200 + Payroll preview rows in response, no DB writes
- [ ] `curl -X POST /api/payroll/runs/:id/finalize`: 200 + ONE transaction writes: 1 PayrollRun + N Payroll + N Payment(type=PAYROLL_OUT, partyId=<STAFF Party id>) + N PayslipSnapshot + N AuditLog (verified via psql: all row counts match in a single tx timestamp)
- [ ] Every payroll Payment row's `partyId` points to a Party with `type='STAFF'` (S8 invariant — §17.2 gate)
- [ ] `curl -X POST /api/payroll/runs/:id/reverse`: 200 + N inverse Payment rows written (type=PAYROLL_IN, amount=positive, reversesPaymentId=<original>)
- [ ] Second `curl -X POST /api/payroll/runs/:id/reverse`: **409 PAYMENT_ALREADY_REVERSED** (A04.1 P2002 catch — NOT 500)
- [ ] No row in `Payment` table has `amount < 0` (CHECK constraint test)
- [ ] Customer ledger `curl -X GET /api/parties/:customerId/ledger`: zero PAYROLL_* rows (§17.2 — verified by joining on Party type)
- [ ] Dashboard "Money Out" `curl -X GET /api/dashboard/home`: PAYROLL_OUT amounts NOT included in customer-payment totals
- [ ] FE screenshots (10 pages total): Employees list 4-state + Employee detail 4-state + Payroll runs list 4-state + Payroll run detail 4-state + Payslip preview 4-state; all at 320px
- [ ] FE: PIN modal triggers on Payroll FINALIZE click (PR3 integration)
- [ ] FE: offline queue UI shows "Saving employee — Raju" and "Finalizing payroll — May 2026"

**QA gate:** verify §17.2 in full + all postmortem-trigger preventions. APPROVED.

---

## PR7 — Audit backfill across 22 mutation services

**Files:** 22 rows (per architecture §18.8, rows 178-199 — 16 existing services gain audit-write rows + 6 Phase-6 services double-checked)
**Depends on:** PR1 (audit-coverage.ts SSOT + enforcer)
**Duration:** 1.5d (parallel-friendly with PR3-6, but should land before PR8 rollout)

**Lands:**

| Group | Rows | What |
|---|---|---|
| Existing service audit-write | 178-193 | 16 existing services each gain audit-write inside their `$transaction` (+10-20L each) |
| Phase-6 service double-check | 194-199 | 6 Phase-6 services (already audit-writing in PR3/PR5/PR6) get explicit test coverage |

**Services backfilled (per `audit-coverage.ts` SSOT):** invoices/create, invoices/update-delete, parties/create, parties/update-delete, payments/create, payments/update-delete, products/create, products/update-delete, expenses/create, expenses/update-delete, purchases/create, purchases/update-delete, businesses/create, businesses/update, business-users/invite, business-users/update — and Phase-6's hr/employee, hr/attendance, payroll/payroll-run + reverse, security-pin/pin-verify, security-pin/pin-reset.

**Proof gate (verifier collects):**
- [ ] `npx tsc -b --noEmit` clean
- [ ] `scripts/enforce-audit-coverage.mjs` exits 0 (every service in SSOT has an audit-write call inside its `$transaction`)
- [ ] For each of the 16 backfilled services: integration test runs the mutation + asserts an AuditLog row landed in the same tx (16 test files, one per service)
- [ ] Pre-commit hook fails if a new service is added without audit coverage (manual test: add a stub service, run `git commit` → enforcer fires)

**QA gate:** verify §17.3 last bullet — "22 services in audit-coverage.ts SSOT have audit-write inside $transaction (pre-commit enforced)". APPROVED.

---

## PR8 — Rollout + flags + docs

**Files:** 6 rows (per architecture §18.9, rows 200-222 — feature flags + runbook + release notes + telemetry dashboards + alert rules)
**Depends on:** ALL prior PRs (this is the cap)
**Duration:** 0.5d

**Lands:**

| Group | Rows | What |
|---|---|---|
| Feature flags | 200, 201 | `server/src/config/features.ts` + `src/config/features.ts` +6L each (`phase6_staff_hr`, `phase6_pin_gate`, `phase6_audit`, etc.) |
| Docs | 202, 203 | `docs/ROLLOUT_PHASE6.md` ~250L; `docs/RUNBOOK_PHASE6.md` ~250L (PAYMENT_ALREADY_REVERSED runbook + pin_gate.cookie_tamper_detected runbook) |
| Release ops | 204-222 | Release notes + telemetry dashboard JSON + alert rules |

**Proof gate (verifier collects):**
- [ ] All feature flags default OFF in prod env
- [ ] `RUNBOOK_PHASE6.md` includes paging-on-call runbooks for: `pin_grace_cookie_tamper_total` spike, `payment_already_reversed_total` spike, PIN-gated p95 > baseline + 100ms
- [ ] Telemetry dashboard renders all 11 metrics from architecture §14 (including the new `pf_stale`, `cross_user`, `cross_tenant`, `domain_prefix_mismatch` event rollups)

**QA gate:** verify all of architecture §17 — every box checked. APPROVED → epic DONE.

---

## Build sequence (proof-gate enforced)

```
Day 0   PR0 architect → TENANCY_AUDIT.md
        Verifier: 100% coverage; QA approves.

Day 1-2 PR1 backend → schema + middleware + helper SSOT
        Verifier: tsc + migrate + curl 400/403 gates; QA approves.
                                  |
                                  +---- parallel-from-here ----+
                                  |                            |
Day 3   PR2 backend → tenancy     PR3 backend → PIN port       PR5 backend → attendance
        Verifier collects.        Verifier collects.            Verifier collects.
        PR2 frontend → TenantChip PR3 frontend → PinGateProvider PR5 frontend → attendance grid
        Verifier + QA.            Verifier + QA.                Verifier + QA.

Day 4-5                           PR4 backend → audit search    PR7 backend → audit backfill (16 services)
                                  Verifier + PR4 FE + QA.       Verifier (22 enforcer green) + QA.

Day 5-6                           PR6 backend → Employee + Payroll + Reversal
                                  Verifier collects (10 endpoints + 10 FE pages); QA approves.

Day 7   PR8 → flags + runbook + release notes
        Verifier + QA approves → epic DONE.
```

Total: 7 calendar days under perfect-execution; expect 9-12 with redo cycles.

## Postmortem trigger conditions

If verifier fails twice on the same PR, OR QA rejects any PR, OR Redo agent runs more than once on a PR → invoke Postmortem agent (`postmortem` skill) automatically per task-manager rules.

