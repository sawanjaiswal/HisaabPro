---
feature: phase-6-staff-hr
status: DRAFT v2.3 — closes v2.2 security re-audit (4 MUST_FIX: A01.1 req.user.userId, A02.2 pin fingerprint pf, A03.1 websearch_to_tsquery, A04.1 Payment.reversesPaymentId) + codifies Q1/Q2/Q3 verdicts (in-place surgical patch on v2.2; no design rewrite)
created: 2026-05-17T22:55:00+05:30
sibling_docs:
  - docs/SCOPE_PHASE6_STAFF_HR.md (this design's contract)
  - docs/SCOPE_AUDIT_PHASE6_STAFF_HR.md (7 SHOULD_SHIP gaps; 4 absorbed here, 3 deferred)
  - docs/ARCHITECTURE_AUDIT_PHASE6_STAFF_HR.md (v1 audit: BLOCK with 5 MUST_SHIP — closed by v2; v2 re-audit: PASS_WITH_GAPS, 1 MUST_SHIP M6 — closed by v2.1; v2.1 re-audit: BLOCK with 2 MUST_SHIP M7+M8 + 1 SHOULD_SHIP S10 — closed by v2.2; v2.2 security re-audit: BLOCK with 4 MUST_FIX A01.1/A02.2/A03.1/A04.1 — closed by this v2.3)
  - docs/SECURITY_AUDIT_PHASE6_STAFF_HR.md (v2.2 security audit input for v2.3 patch)
  - docs/ARCHITECTURE_EPIC_D_crm_loyalty.md (v5 — format template + permission-aware ledger pattern reused here)
scope_audit_status: PASS_WITH_GAPS — 0 MUST_SHIP gaps, 7 SHOULD_SHIP gaps (this doc absorbs G1, G3, G4, G5, G6)
architecture_audit_status: v1 BLOCK → v2 closes M1–M5 → v2.1 closes M6 + S7 + S8 → v2.2 closes M7 (PARTY_TYPES widening + customer-facing-picker filter policy), M8 (single rejection path via AppError(INVALID_PAYMENT_TYPE, 400) — assertCustomerPaymentType refactored to throw AppError so the 400-guard and the assert become ONE path), S10 (party/list-get.ts filename corrected in 2 sites) → v2.3 closes A01.1 (req.user.userId), A02.2 (pin fingerprint pf binding), A03.1 (websearch_to_tsquery), A04.1 (Payment.reversesPaymentId column added to schema + PR1 + §8.3) + codifies Q1 (domain-separated HMAC prefix), Q2 (pin_gate.cookie_tamper_detected telemetry + alert), Q3 (sameSite=strict OAuth interaction)
high_risk_paths_touched:
  - server/prisma/schema.prisma (8 new tables + 6 columns + 1 tsvector + 1 GIN index; Party.type comment widening to include STAFF; Payment.reversesPaymentId added in v2.3 per A04.1)
  - server/src/services/auth/* (switch-business audit hook — no token-shape change per SCOPE §6.5)
  - server/src/middleware/auth.ts (requireRecentPin + requireActiveBusiness decorators)
  - server/src/middleware/permission.ts (new keys: hr.*, audit.*; no rule logic change)
  - server/src/services/settings/permissions-data.ts (touched by PR1 — every Phase-6 PR depends)
  - server/src/lib/errors.ts (new ErrorCode entry INVALID_PAYMENT_TYPE — PR1 row added in v2.2; PAYMENT_ALREADY_REVERSED already covered via VALIDATION_ERROR/409 mapping in v2.3 §8.3)
  - server/src/lib/jwt.ts (NO CHANGE in Phase 6 — listed for trigger-completeness only; SCOPE §6.5 rejects)
dudhhisaab_reuse:
  - DudhHisaab/src/services/auth-pin/* (13 of 15 files in scope per Gap 7 reconciliation below)
  - DudhHisaab/src/constants/pin-auth.constants.ts (verbatim)
  - DudhHisaab/src/jobs/pin-gc.job.ts (verbatim port → cron-scheduler entry)
revision_log:
  - v1 (2026-05-17) — Initial publication
  - v2 (2026-05-17) — Closed audit MUST_SHIPs M1–M5. Specifically:
      • M1: §2.2 lists Payment.type allowed-values extension (PAYMENT_IN | PAYMENT_OUT | PAYROLL_OUT | PAYROLL_IN);
        §2.4 PR1 migration adds a single ALTER (string-column comment + Zod update in shared/enums.ts + payment.schemas.ts);
        File Plan PR1 adds a new edit row for shared/enums.ts.
      • M2: §8.3 rewritten — reversal writes inverse-direction-same-amount (PAYROLL_IN, positive paise), linked by
        reversesPaymentId. Negative-amount-same-type paragraph DELETED. Downstream references (audit, reports,
        reconciliation, §17 acceptance) updated to match.
      • M3: niceRateLimit references removed. §8.4 + §15 use the real createRateLimiter factory at
        server/src/middleware/rate-limit/factory.ts. A new thin per-business helper goes in
        server/src/middleware/rate-limit/per-business-factory.ts (≤ 80L) — File Plan PR1 row added.
      • M4: req.session.* references removed. PIN grace state stored in a single httpOnly signed cookie
        pin_gate_grace with HMAC over the JWT_SECRET (option (a) from the audit). New helper at
        server/src/services/security-pin/pin-grace-cookie.ts (≤ 180L) — File Plan PR3 row added.
        §5.3 rewritten end-to-end.
      • M5: PR7 audit-backfill rows reconciled against `git ls-files server/src/services/`. Eight rows renamed,
        one row removed (no Refund service exists in HP), two rows merged where the cited operations live in the
        same file (e.g. role create+update+delete in settings/roles.ts). audit-coverage.ts entries in §7.4 updated
        to match.
  - v2.1 (2026-05-17) — Closed v2 re-audit MUST_SHIP M6 + SHOULD_SHIPs S7, S8 (in-place patch; design unchanged):
      • M6: §2.2 PR1 task "audit + default: throw" against 6 downstream Payment.type consumers had no File Plan
        rows. v2.1 picks helper-extraction option (b): adds a new SSOT helper
        `shared/payment-types.ts` (~90L) exporting `paymentTypeDirection(type)` + `isCustomerPaymentType(type)`
        + `isPayrollPaymentType(type)` + `assertCustomerPaymentType(type)`. The 6 consumer files become 2-3 line
        diffs replacing each ternary with the helper. PR1 file plan gains 7 new rows (helper + 6 consumers):
        shared/payment-types.ts, payment/create.ts, payment/update-delete.ts, payment/get-list.ts,
        report/report-payment.ts, report/report-party.ts, party/ledger.service.ts, dashboard/home.ts.
        (Eighth candidate `cash-register/cash-entry.queries.ts` confirmed NOT to reference Payment.type — no
        edit needed; documented exclusion in §2.2.)
      • S7: Zod split — `PaymentTypePublic = z.enum(['PAYMENT_IN','PAYMENT_OUT'])` for the public POST /api/payments
        request body; `PaymentTypeInternal = z.enum([...PAYMENT_TYPES])` for internal payroll-service writes. Added
        to `server/src/schemas/payment.schemas.ts` (existing PR1 row — net +12L instead of +2L). Defense-in-depth
        server-side guard in `payment/create.ts` rejects PAYROLL_* with 400 INVALID_PAYMENT_TYPE.
      • S8: Employee ↔ Party STAFF pairing. v2.1 ASSERTED (FALSELY) that `Party.type` already enumerated STAFF
        in the schema. v2.2 corrects this — see v2.2 below.
      • Sweep-replace "20 mutation services" → "22 mutation services" in §0, §7.4, §17.5 (S5 closure).
      • File-count tally bumps from 209 → 217 (+7 PR1 consumer-edit rows + 1 PR6 employee↔party-staff pairing edit).
  - v2.2 (2026-05-17) — Closed v2.1 re-audit M7 + M8 + S10 (in-place surgical patch; design unchanged):
      • M7: Corrected the FALSE schema claim. `Party.type` field at `server/prisma/schema.prisma:365` currently
        enumerates `CUSTOMER | SUPPLIER | BOTH` ONLY (comment + Zod SSOT both confirmed via independent grep).
        v2.2:
        (a) PR1 File Plan widens `PARTY_TYPES` in `shared/enums.ts` from 3 → 4 values (adds STAFF) — existing
            row 6 grows from +8L to +12L (covers both PAYMENT_TYPES and PARTY_TYPES widening).
        (b) PR1 File Plan adds a +1L edit to `server/prisma/schema.prisma` Party.type inline comment to read
            `// CUSTOMER, SUPPLIER, BOTH, STAFF` (string column — no DDL change beyond the comment).
        (c) §2.2 column-changes table gains a `Party.type` row.
        (d) §8.5 "Schema already supports it" bullet replaced with the truthful widening narrative + filter
            policy: STAFF parties are HIDDEN from customer-facing pickers (party-select in invoice/payment forms,
            party-list default filter, party-form type picker) and SURFACED only in HR employee management UI.
        (e) PR1 file plan gains 3 FE filter-policy rows: party.constants.ts (PARTY_TYPE_OPTIONS keeps STAFF out
            of customer pickers), PartyFilterBar.tsx (filter excludes STAFF unless `?includeStaff=true`),
            and party-form type select (STAFF hidden — Employee management UI is the only creation path).
        (f) Replaced wrong schema-line citations: `schema.prisma:1015` → `schema.prisma:365` in 2 sites
            (§0 line 59 + §8.5 line 792).
      • M8: Single rejection path for PAYROLL_* on the public payment endpoint. v2.1 documented BOTH:
        (1) explicit 400 guard at `payment/create.ts` route boundary, and
        (2) `assertCustomerPaymentType` call inside the service that threw a plain `Error` (→ bubbles to 500).
        Acceptance gate §17.2 said "rejected with 400" — collision was guaranteed (whichever path fired first
        decided the status code). HP does NOT have `BadRequestError` or `BusinessError` classes; it has
        `AppError` (server/src/lib/errors.ts) + `ErrorCode` enum + factory functions. v2.2 picks option (b):
        (a) Refactor `assertCustomerPaymentType` in `shared/payment-types.ts` to throw `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)`
            instead of plain `Error`. Defense-in-depth preserved (services don't trust callers) AND single
            rejection semantic (always 400 INVALID_PAYMENT_TYPE, never 500).
        (b) The explicit 400-guard at route boundary BECOMES the same `assertCustomerPaymentType` call — they
            collapse into ONE path: `assertCustomerPaymentType(data.type)` at the top of `createPayment` BEFORE
            any DB read. Zod public-vs-internal split is the first defense, the assert is the second; both fail
            identically with 400 INVALID_PAYMENT_TYPE.
        (c) Add `INVALID_PAYMENT_TYPE` to `ErrorCode` enum in `server/src/lib/errors.ts` — PR1 file plan gains
            a new row (Validation 400 family entry).
        (d) Update §2.2 line 308 + consumer-table row 358 + §17.2 acceptance gates to reflect single path.
      • S10: Renamed `server/src/services/party/list.service.ts` → `server/src/services/party/list-get.ts` in
        2 cite sites (§8.5 default-filter table + PR1 row 16). Real file confirmed at
        `server/src/services/party/list-get.ts` (verified via `ls server/src/services/party/`).
      • File-count tally bumps from 217 → 222 (+5 rows in PR1: schema.prisma comment widen, errors.ts ErrorCode
        addition, party.constants.ts FE filter, PartyFilterBar.tsx FE filter, party-form select FE filter).
        Existing row 6 (shared/enums.ts) grows from +8L to +12L without adding a new row.
  - v2.3 (2026-05-17) — Closed 4 security MUSTs (req.user.userId, pin fingerprint pf, websearch_to_tsquery, Payment.reversesPaymentId column) + codified Q1/Q2/Q3 verdicts (in-place surgical patch; no design rewrite):
      • A01.1 closure (req.user.userId): HP's real `AuthRequest['user']` shape (verified at `server/src/middleware/auth.ts:75`) is `{ userId, businessId, ... }` — NOT `{ id, businessId }`. v2.2 used `req.user.id` in 3 sites which would silently return `undefined` and turn Prisma `findFirst({ where: { userId: undefined, ... }})` into a cross-tenant SELECT. v2.3 rewrites all 3 sites to `req.user.userId`: §3.6 `requireActiveBusiness` BusinessUser lookup (line 538), §5.3 cookie verification step 4 (line 627), and §5.3 invalidation matrix row 6 (line 646).
      • A02.2 closure (PIN fingerprint pf): grace cookie payload gains a 6th field `pf` = first 12 hex of `sha256(currentPinHash)` at minting. Verifier recomputes `pf` from current DB pinHash on every gated request; mismatch → reject (treated as expired). Consequence: any PIN change/reset silently invalidates all prior cookies (pf becomes stale) without touching a session DB or revocation table. §5.3 payload schema + verification step list + invalidation matrix all updated.
      • A03.1 closure (websearch_to_tsquery): §7.5 line 756 swap of `to_tsquery` → `websearch_to_tsquery`. The websearch variant accepts Google-style user input (`apple OR banana`, `"exact phrase"`, `-exclude`) without ever parsing FTS operators like `&`/`|`/`!` that would crash `to_tsquery` on raw user input. Postgres 11+ supports it; Neon is on 15+ so the dependency is satisfied.
      • A04.1 closure (Payment.reversesPaymentId): §8.3 reversal logic referenced the column 9 times but the schema never added it; PR6 would have failed to compile. v2.3 adds: §2.2 column-changes table gains `Payment | reversesPaymentId | NEW Int? @unique with FK self-ref` row; §2.4 PR1 migration bullet adds the ADD COLUMN + UNIQUE INDEX + FOREIGN KEY self-ref SQL (nullable, no backfill — existing rows get null); §18.2 PR1 row 2 grows by +5L for the new schema lines (1 column + 1 @unique + 1 @relation self-ref pair); migration name `20260518_phase6_schema_core` already covers it (single migration file). The `@unique` constraint also enforces "no reversal-of-reversal" — a second reversal write against an already-reversed payment fails with unique-constraint violation; §8.3 service catches and translates to 409 PAYMENT_ALREADY_REVERSED.
      • Q1 verdict (ACCEPTABLE with domain-separation tag): HMAC input prefixed with the literal string `'pin-grace-cookie-v1:'` before being signed with JWT_SECRET. Documented in §5.3 signing section. Domain separation means a JWT_SECRET-signed payload from any other surface (e.g. JWT itself, csrf token, future cookie versions) cannot be replayed as a valid pin-grace cookie. The `v1` version tag lets us rotate the prefix without secret rotation if we ever change the payload schema.
      • Q2 verdict (telemetry + alert): cookie tamper events emit `pin_gate.cookie_tamper_detected` (per-IP, per-userId labels) under the security-event taxonomy. Alert rule: `>5 events/min sustained for 5min on same IP`. §14 observability section adds the event name + threshold. Note: HP does NOT have a dedicated `security-events.ts` taxonomy file today; the event name is registered in §14 + the §10.5 (NEW) security-event taxonomy mini-section, and PR1 file plan picks up a new row for `server/src/lib/security-events.ts` SSOT helper (NEW row 24c).
      • Q3 verdict (sameSite=strict + OAuth interaction): documented in §5.3 — when HP later adds third-party OAuth callbacks that land on `/api/*`, the `sameSite=strict` grace cookie will NOT be sent on the cross-site POST/GET that returns the user to HP. The post-OAuth flow MUST trigger a fresh `requireRecentPin` re-verify on the next gated route. This is the correct fail-mode (security > convenience) and matches how Stripe/Google etc. handle their own session-grace cookies under strict sameSite. The note exists so a future engineer adding OAuth doesn't accidentally switch to `sameSite=lax` to "fix" the missing cookie symptom.
      • File-count tally bumps from 222 → 223 (+1 new row 24c for `server/src/lib/security-events.ts` SSOT helper; row 2 (`server/prisma/schema.prisma`) grows by +5L for `reversesPaymentId` column; no other row counts change).
---

# ARCHITECTURE — Phase 6: Staff & HR

**Features:** #135 Attendance · #136 Payroll · #137 Salary Slips · #138 Multi-firm · #139 Audit Trail · #140 Transaction PIN
**Branch:** `epic/phase-6-staff-hr` (off `hisaabpro` HEAD `9e72c3f`)
**Cleared for build:** pending architecture-auditor v2.3 re-audit (A01.1 + A02.2 + A03.1 + A04.1 closure verification + Q1/Q2/Q3 codification)

---

## 0. Executive Summary

Phase 6 ships six related-but-orthogonal features that share three structural pillars:

1. **HR pillar** (#135 + #136 + #137) — net-new `Employee` domain with `Attendance`, `PayrollRun`/`Payroll`, and immutable `PayslipSnapshot`. Money-out flows mirror Epic D's `$transaction`-anchored ledger pattern (Payroll write → `Payment` row in the SAME tx). Every Employee is paired 1:1 with a Party of `type='STAFF'` (see §8.5) so `Payment.partyId` stays NOT NULL forever and payroll Payments are naturally excluded from customer ledgers via `party.type != 'STAFF'` filters. PR1 widens `PARTY_TYPES` (`shared/enums.ts`) AND the `Party.type` inline comment at `server/prisma/schema.prisma:365` to include `'STAFF'` (string column — no DDL).
2. **Tenancy pillar** (#138) — **elevation, not greenfield**. Business / BusinessUser / JWT-businessId / switch-business route already ship (PRD #9). Phase 6 adds the audit hook on switch, the suspend/reactivate flow, the `<TenantChip>` SideNav primitive, and — critically — an **architect-led cross-tenant leak audit (PR0)** that produces `docs/TENANCY_AUDIT.md` before any schema lands.
3. **Security pillar** (#139 + #140) — `AuditLog` augmented with `searchVector` + `redactedFields`; new `PinPhoneLockout` + `PinResetToken` tables (DH `auth-pin` port verbatim); `requireRecentPin` middleware with per-route-class grace timer (**stored in a signed cookie — see §5.3**); 22 mutation services backfilled to write audit rows inside their existing `$transaction`s; a single declarative `audit-coverage.ts` SSOT enforced at pre-commit.

**Net new schema:** 8 tables (Employee, Attendance, PayrollRun, Payroll, PayslipSnapshot, PinPhoneLockout, PinResetToken, AuditLogRedaction), 6 columns (Business.suspendedAt, BusinessUser.suspendedAt, BusinessUser.suspendedById, AuditLog.searchVector, AuditLog.redactedFields, Payment.reversesPaymentId — last added in v2.3 per A04.1), 1 tsvector + 1 GIN index. Two string-column widenings via SSOT enum + inline comment only (no DDL): `Payment.type` (+ `PAYROLL_OUT`, `PAYROLL_IN`) and `Party.type` (+ `STAFF`). No User-model writes (the question §1 of SCOPE settled in favor of "no JWT shape change").

**Total file count estimate:** **223 files** (209 backend + 14 frontend incremental — the FE pages and components are mostly Drawer + table compositions over existing primitives). v2 → v2.1 delta: +8 rows (+7 PR1 consumer edits + 1 PR6 Employee↔Party STAFF pairing). v2.1 → v2.2 delta: +5 PR1 rows (schema comment, ErrorCode addition, 3 FE filter rows); existing `shared/enums.ts` row grew +4L for PARTY_TYPES widening. v2.2 → v2.3 delta: +1 PR1 row (`server/src/lib/security-events.ts` SSOT helper for Q2 telemetry); schema row grows +5L for `Payment.reversesPaymentId`.

---

## 1. Glossary & Conventions

**Domain terms:**
- **Employee** — a paid human in the business. NOT necessarily a HisaabPro user. Has an optional 1:1 link to `User` (via `Employee.userId`) for staff who also log in.
- **STAFF Party** — every Employee owns a paired `Party` row with `type='STAFF'`. The pairing is created in the same transaction as the Employee. Payroll Payments use `partyId = <paired STAFF Party id>` (see §8.5). The `'STAFF'` value is NEW in PR1 — `Party.type` previously enumerated only `CUSTOMER | SUPPLIER | BOTH`.
- **PayrollRun** — a parent record holding period bounds (`from..to`) and aggregate totals for one calendar period.
- **Payroll** — child of PayrollRun, one per Employee per period. Computed: presentDays × dailyRate − advances + overtime − deductions.
- **PayslipSnapshot** — the immutable serialized line items of a finalized Payroll, frozen for legal reproducibility.
- **BusinessUser** — membership row linking User × Business with a role. **Now extensible with `suspendedAt`/`suspendedById`.**
- **AuditLog** — append-only diff log written inside the same `$transaction` as the mutating operation.
- **Operation PIN** — the 4-digit `UserAppSettings.pinHash` used to gate sensitive operations.
- **PIN grace** — the time window (default 5 min for routine class, 60 min for read-only class) during which a fresh PIN entry is honored across multiple gated requests. **Stored as a signed cookie — see §5.3.**

**Middleware decorators:**
- `requireActiveBusiness` — REFUSES if `req.user.businessId` is null OR the corresponding BusinessUser row is now `suspendedAt`. Slotted BEFORE `requireRecentPin`.
- `requireRecentPin(routeClass)` — REFUSES with **403 PIN_REQUIRED** (not 401, to sidestep the `src/lib/api.ts` 401-refresh interceptor) if the signed `pin_gate_grace` cookie is missing/expired/route-class-mismatched.
- `requirePermission(key)` — existing decorator; new keys `hr.read`, `hr.write`, `hr.payroll.run`, `audit.read`, `audit.export`.

**Wire conventions:**
- All amounts in **paise** (integer). No floating point on the wire.
- All payments query the schema's `String` `Payment.type` column. The allowed-value set is widened (see §2.2). Customer ledger queries filter `WHERE party.type != 'STAFF'` to naturally exclude payroll Payments.
- All Phase-6 mutating routes pass `requireActiveBusiness` → `requireRecentPin(class)` → `idempotencyMiddleware` → handler, in that order (see §11).
- All references to the authenticated user's id use **`req.user.userId`** (HP's real `AuthRequest` shape per `server/src/middleware/auth.ts:75`). Never `req.user.id` — that property does not exist and returns `undefined`, which silently breaks Prisma WHERE clauses and creates cross-tenant exposure.

---

## 2. Data Model

### 2.1 New tables (8)

```prisma
// 2.1.a — Employee (paired 1:1 with a STAFF Party — see §8.5)
model Employee {
  id              String   @id @default(cuid())
  businessId      String
  userId          String?  // optional — set only if the employee logs in too
  partyId         String   @unique  // 1:1 paired STAFF Party (see §8.5)
  name            String
  phone           String?
  designation     String?
  dailyRate       Int      // paise — used by Payroll compute
  joinedAt        DateTime @default(now())
  leftAt          DateTime?
  isDeleted       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdById     String

  business        Business @relation(fields: [businessId], references: [id])
  user            User?    @relation(fields: [userId], references: [id])
  party           Party    @relation("EmployeeParty", fields: [partyId], references: [id])
  attendances     Attendance[]
  payrolls        Payroll[]

  @@index([businessId, isDeleted])
  @@index([businessId, name])
  @@unique([businessId, partyId])
}

// 2.1.b — Attendance (one row per Employee per day)
model Attendance {
  id            String   @id @default(cuid())
  businessId    String
  employeeId    String
  date          DateTime @db.Date
  status        String   // PRESENT | ABSENT | HALF_DAY | LEAVE_PAID | LEAVE_UNPAID
  overtimeMin   Int      @default(0)
  note          String?
  createdAt     DateTime @default(now())
  createdById   String

  business      Business @relation(fields: [businessId], references: [id])
  employee      Employee @relation(fields: [employeeId], references: [id])

  @@unique([businessId, employeeId, date])
  @@index([businessId, date])
}

// 2.1.c — PayrollRun (parent)
model PayrollRun {
  id            String   @id @default(cuid())
  businessId    String
  fromDate      DateTime @db.Date
  toDate        DateTime @db.Date
  status        String   @default("DRAFT") // DRAFT | FINALIZED | REVERSED
  totalNet      Int      @default(0)       // paise; recomputed on finalize
  finalizedAt   DateTime?
  finalizedById String?
  createdAt     DateTime @default(now())
  createdById   String

  business      Business @relation(fields: [businessId], references: [id])
  payrolls      Payroll[]

  @@unique([businessId, fromDate, toDate])
  @@index([businessId, status])
}

// 2.1.d — Payroll (child; one per Employee per Run)
model Payroll {
  id                  String   @id @default(cuid())
  businessId          String
  payrollRunId        String
  employeeId          String
  presentDays         Int
  halfDays            Int
  overtimeMin         Int
  advanceTotalPaise   Int
  deductionsPaise     Int
  grossPaise          Int      // presentDays * dailyRate + halfPay + overtimePay
  netPaise            Int      // gross - advances - deductions
  paymentId           String?  // FK to Payment row written in the same tx
  status              String   @default("DRAFT") // DRAFT | FINALIZED | REVERSED
  createdAt           DateTime @default(now())

  business            Business    @relation(fields: [businessId], references: [id])
  payrollRun          PayrollRun  @relation(fields: [payrollRunId], references: [id])
  employee            Employee    @relation(fields: [employeeId], references: [id])
  payment             Payment?    @relation("PayrollPayment", fields: [paymentId], references: [id])
  snapshot            PayslipSnapshot?

  @@unique([businessId, payrollRunId, employeeId])
  @@index([businessId, employeeId])
}

// 2.1.e — PayslipSnapshot (immutable; legal record)
model PayslipSnapshot {
  id            String   @id @default(cuid())
  businessId    String
  payrollId     String   @unique
  // JSON blob of line items, frozen at FINALIZE
  payload       Json
  createdAt     DateTime @default(now())

  business      Business @relation(fields: [businessId], references: [id])
  payroll       Payroll  @relation(fields: [payrollId], references: [id])
}

// 2.1.f — PinPhoneLockout (DH-port verbatim)
model PinPhoneLockout {
  id            String   @id @default(cuid())
  phoneE164     String   @unique
  attempts      Int      @default(0)
  windowStart   DateTime @default(now())
  lockedUntil   DateTime?
  updatedAt     DateTime @updatedAt

  @@index([phoneE164])
}

// 2.1.g — PinResetToken (DH-port verbatim)
model PinResetToken {
  id            String   @id @default(cuid())
  userId        String
  tokenHash     String   @unique
  expiresAt     DateTime
  consumedAt    DateTime?
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}

// 2.1.h — AuditLogRedaction (per-business custom field redaction)
model AuditLogRedaction {
  id            String   @id @default(cuid())
  businessId    String
  entityType    String   // "Party" | "Invoice" | ...
  fieldPath     String   // "phone" | "metadata.bankAccount"
  enabled       Boolean  @default(true)
  createdAt     DateTime @default(now())
  createdById   String

  business      Business @relation(fields: [businessId], references: [id])

  @@unique([businessId, entityType, fieldPath])
}
```

### 2.2 Column-level changes

| Table | Column | Change | Why |
|---|---|---|---|
| Business | `suspendedAt` | NEW `DateTime?` | §3.5 firm-suspend flow |
| BusinessUser | `suspendedAt` | NEW `DateTime?` | §3.5 member-suspend flow |
| BusinessUser | `suspendedById` | NEW `String?` | audit trail of who suspended |
| AuditLog | `searchVector` | NEW `tsvector` (raw SQL, GIN) | §7.5 search-in-audit-trail |
| AuditLog | `redactedFields` | NEW `Json` | §7.6 PII redaction record |
| Payment | `type` | **Widened allowed-values set** (string column; no `ALTER TYPE`) — see "Payment.type widening" below | Payroll Payments must be representable without a separate table |
| Payment | `reversesPaymentId` | **NEW `Int? @unique` with FK self-ref to `Payment(id)`** — added in v2.3 per A04.1; nullable, no backfill (existing rows get null); `@unique` prevents reversal-of-reversal flip-flop | §8.3 reversal logic links each PAYROLL_IN inverse row back to the original PAYROLL_OUT it cancels |
| Party | `type` | **Widened allowed-values set** (string column; no `ALTER TYPE`) — see "Party.type widening (M7 closure)" below | Activate `STAFF` for §8.5 Employee↔Party pairing |

**Payment.reversesPaymentId (A04.1 closure, v2.3):**

- Column: `reversesPaymentId Int? @unique` — nullable so non-reversal payments (the overwhelming majority) leave it null; `Int?` matches `Payment.id` type (`Int @id @default(autoincrement())` per `server/prisma/schema.prisma:1205` — Payment uses Int autoincrement, NOT cuid).
- FK self-ref: Prisma relation `reversesPayment Payment? @relation("PaymentReversal", fields: [reversesPaymentId], references: [id])` + opposite side `reversedBy Payment[] @relation("PaymentReversal")` (single back-relation only fires for the one row pointing at this Payment via `@unique`).
- `@unique` constraint: a Payment can be reversed AT MOST ONCE. A second attempt to write `reversesPaymentId = X` when one already exists fails with Prisma error `P2002` (unique constraint violation) — `payroll/payroll-run.service.ts:reversePayrollRun` catches and translates to `AppError(ErrorCode.VALIDATION_ERROR, 409, 'PAYMENT_ALREADY_REVERSED')` per §8.3.
- Migration ordering: simple ADD COLUMN nullable + ADD CONSTRAINT UNIQUE INDEX + ADD FOREIGN KEY. No backfill phase (column is nullable; existing rows = null). No NOT-NULL transition ever planned — reversal pointer is intrinsically nullable.

**Payment.type widening (M1 closure + M6 follow-on):**

- The schema column is `String @db.VarChar` (per `server/prisma/schema.prisma:1207`). No Postgres ENUM exists, so no `ALTER TYPE` is needed. PR1's "migration" is a comment update + a single edit to `shared/enums.ts`.
- **Allowed values widen from** `['PAYMENT_IN', 'PAYMENT_OUT']` **to** `['PAYMENT_IN', 'PAYMENT_OUT', 'PAYROLL_OUT', 'PAYROLL_IN']`.
  - `PAYROLL_OUT` — money paid TO an employee on payroll FINALIZE.
  - `PAYROLL_IN` — the inverse-direction-same-amount reversal row written when a finalized Payroll is rolled back (see §8.3). NEVER negative paise.
- **Zod split (S7 closure):** the public payment-create endpoint accepts only customer types; payroll-service-internal writes use the widened set:

  ```ts
  // shared/enums.ts (updated)
  export const PAYMENT_TYPES = ['PAYMENT_IN', 'PAYMENT_OUT', 'PAYROLL_OUT', 'PAYROLL_IN'] as const
  export type PaymentType = (typeof PAYMENT_TYPES)[number]

  // shared/enums.ts — public-vs-internal split
  export const CUSTOMER_PAYMENT_TYPES = ['PAYMENT_IN', 'PAYMENT_OUT'] as const
  export type CustomerPaymentType = (typeof CUSTOMER_PAYMENT_TYPES)[number]

  // server/src/schemas/payment.schemas.ts (updated — net +12L over current)
  import { CUSTOMER_PAYMENT_TYPES, PAYMENT_TYPES } from '../../../shared/enums.js'

  /** Public surface — POST /api/payments accepts only customer types. */
  export const PaymentTypePublic = z.enum(CUSTOMER_PAYMENT_TYPES)

  /** Internal surface — payroll-service writes use the widened enum. */
  export const PaymentTypeInternal = z.enum(PAYMENT_TYPES)

  // createPaymentSchema.type swapped to PaymentTypePublic (was z.enum(PAYMENT_TYPES))
  ```

- **Single rejection path (M8 closure, v2.2):** v2.1 documented TWO guards — an explicit 400 route-boundary check AND `assertCustomerPaymentType(data.type)` inside the service. The assert threw a plain `Error` (→ 500), so the two paths produced different status codes depending on which fired first. v2.2 collapses them into ONE path:
  - `assertCustomerPaymentType` (in `shared/payment-types.ts`) now throws `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)` instead of a plain `Error`. HP's error handler (`server/src/middleware/errorHandler.ts`) maps `AppError` → typed JSON response with the cited status code.
  - `payment/create.ts` calls `assertCustomerPaymentType(data.type)` at the top of the handler (BEFORE any DB read). The Zod schema is the first line of defense; the assert is the second (defense-in-depth). Both fail identically with **400 `INVALID_PAYMENT_TYPE`**.
  - Internal payroll-service writes call `prisma.payment.create({...})` directly (not through `createPayment`), so they never traverse the assert. The Zod-internal schema (`PaymentTypeInternal`) is used by the route schema for payroll-internal calls (none today; reserved for future internal POSTs if any).
  - `INVALID_PAYMENT_TYPE` added to `ErrorCode` enum (validation 400 family) — PR1 file plan row added in v2.2.

**Downstream consumers (M6 closure — helper extraction, option (b)):**

Rather than 14 individual ternary-replacement edits (option (a)), v2.1 picks the SSOT helper-extraction approach. A new `shared/payment-types.ts` file (~95L — slightly grown from v2.1's 90L by the `AppError`-throwing assert refactor) exports four helpers:

```ts
// shared/payment-types.ts (NEW — ~95L)
import { type PaymentType, type CustomerPaymentType, CUSTOMER_PAYMENT_TYPES } from './enums.js'
import { AppError, ErrorCode } from '../server/src/lib/errors.js'   // (import path resolved via tsconfig path map)

/**
 * Returns the arithmetic direction of a Payment row's effect on a customer/supplier
 * outstanding balance.
 *  +1 → PAYMENT_OUT (money out — increases payable to supplier)
 *  -1 → PAYMENT_IN  (money in — decreases receivable from customer)
 *   0 → PAYROLL_OUT / PAYROLL_IN (never touch customer balance — they hit STAFF Party only)
 */
export function paymentTypeDirection(type: PaymentType): -1 | 0 | 1 {
  switch (type) {
    case 'PAYMENT_IN':   return -1
    case 'PAYMENT_OUT':  return 1
    case 'PAYROLL_OUT':  return 0
    case 'PAYROLL_IN':   return 0
    default: {
      const _exhaustive: never = type
      throw new Error(`Unknown Payment.type: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

export function isCustomerPaymentType(type: string): type is CustomerPaymentType {
  return (CUSTOMER_PAYMENT_TYPES as readonly string[]).includes(type)
}

export function isPayrollPaymentType(type: string): boolean {
  return type === 'PAYROLL_OUT' || type === 'PAYROLL_IN'
}

/**
 * Throws AppError(400 INVALID_PAYMENT_TYPE) if the type is not a customer payment type.
 * Used as defense-in-depth at the entry of every customer-payment-create code path AND
 * at the entry of every customer-ledger code path. The single rejection semantic means
 * acceptance tests at §17.2 reliably observe 400 INVALID_PAYMENT_TYPE regardless of
 * which guard (Zod, assert) fires first.
 */
export function assertCustomerPaymentType(type: PaymentType): asserts type is CustomerPaymentType {
  if (!isCustomerPaymentType(type)) {
    throw new AppError(
      ErrorCode.INVALID_PAYMENT_TYPE,
      400,
      `Payroll payment types (PAYROLL_OUT, PAYROLL_IN) cannot be created via the public payments endpoint`,
      { type },
    )
  }
}
```

**Consumer files we touched and confirmed switch-on-type is now exhaustive** (PR1 file plan rows added — see §18.2):

| # | Consumer file | Line(s) | Old pattern | New pattern (using helper) |
|---|---|---|---|---|
| 1 | `server/src/services/payment/create.ts` | 107, 124 | `data.type === 'PAYMENT_IN' ? -delta : delta` | TOP-of-function `assertCustomerPaymentType(data.type)` (M8 single rejection — throws AppError 400 INVALID_PAYMENT_TYPE; Zod is the first defense, this assert is the second) + `delta * paymentTypeDirection(data.type) * -1` |
| 2 | `server/src/services/payment/update-delete.ts` | 26, 80, 128 | `payment.type === 'PAYMENT_IN' ? ...` | `paymentTypeDirection(payment.type) === -1 ? ...` (guarded — never expected to run for PAYROLL_*) |
| 3 | `server/src/services/payment/get-list.ts` | 87-88 | `typeAgg.find(t => t.type === 'PAYMENT_IN')` | `typeAgg.find(t => isCustomerPaymentType(t.type) && t.type === 'PAYMENT_IN')` + payroll types excluded from the `where:` filter via `party: { type: { not: 'STAFF' } }` |
| 4 | `server/src/services/report/report-payment.ts` | 24-25, 49, 54, 68 | `where.type = 'PAYMENT_IN'` (already type-narrowed); ternary at 68 | unchanged where:-narrowing; ternary at 68 → `isCustomerPaymentType(p.type) ? (paymentTypeDirection(p.type) === -1 ? 'in' : 'out') : 'payroll'` |
| 5 | `server/src/services/report/report-party.ts` | 80 | `pmt.type === 'PAYMENT_IN'` | helper + new STAFF Party filter at the calling site (party reports never include STAFF parties) |
| 6 | `server/src/services/party/ledger.service.ts` | 98, 164 | `p.type === 'PAYMENT_IN' ? -X : X` (inside customer-ledger loop) | early `assertCustomerPaymentType(p.type)` (the caller already filters `party.type != 'STAFF'`, so payroll Payments cannot reach this code; the assert is the belt-and-braces — same 400 INVALID_PAYMENT_TYPE if it ever fires, indicating a query-layer bug to investigate) + `X * paymentTypeDirection(p.type) * -1` |
| 7 | `server/src/services/dashboard/home.ts` | 163 | `pmt.type === 'PAYMENT_IN' ? 'payment_in' : 'payment_out'` | recentPayments query gains `party: { type: { not: 'STAFF' } }` filter; ternary uses helper |

**Files we audited and confirmed do NOT need editing:**

- `server/src/services/cash-register/cash-entry.queries.ts` — grep returns ZERO `Payment.type` references; nothing to defend.
- `server/src/services/collections/statement.service.ts` — every query is already partyId-scoped to a specific customer/supplier; payroll Payments cannot enter the result set.
- `server/src/services/report/report-daybook.ts` — every `where:` clause already narrows `type: 'PAYMENT_IN' | 'PAYMENT_OUT'`, so the query never returns payroll rows; the lack of a default branch is therefore safe by construction.

**Why the helper instead of 14 inline edits:**
- Single source of truth: future Payment.type widening (e.g. `REFUND_OUT` later) needs ONE edit, not 14.
- Compile-time exhaustiveness: the `default: never` branch fails TypeScript build when a new type is added without updating the helper.
- Each consumer-file diff becomes 2-3 lines instead of 4-6 — code-review surface drops.
- The helper file (~95L) is well under the 250L cap and is pure (no I/O, no DB), so test surface is tiny.
- M8 closure: by routing the assert through `AppError`, the helper file becomes the SSOT for the 400-rejection semantic too — both the route-boundary check AND any service-layer self-check produce the same status code, message shape, and ErrorCode value.

**Party.type widening (M7 closure):**

- The schema column is `String @default("CUSTOMER")` at `server/prisma/schema.prisma:365`. No Postgres ENUM exists, so no `ALTER TYPE` is needed. PR1's "migration" is a comment update + a single edit to `shared/enums.ts`.
- **Allowed values widen from** `['CUSTOMER', 'SUPPLIER', 'BOTH']` **to** `['CUSTOMER', 'SUPPLIER', 'BOTH', 'STAFF']`.
  - `STAFF` — the paired Party row created in the same `$transaction` as an Employee (see §8.5). STAFF parties are NOT customer-facing — they are internal payroll routing aliases that exist only to satisfy `Payment.partyId` NOT NULL while keeping payroll Payments excluded from customer ledgers.
- Updates:
  - `shared/enums.ts`: `export const PARTY_TYPES = ['CUSTOMER', 'SUPPLIER', 'BOTH', 'STAFF'] as const` (was 3 values).
  - `server/prisma/schema.prisma:365`: inline comment updated to `type String @default("CUSTOMER") // CUSTOMER, SUPPLIER, BOTH, STAFF` (1-line edit — no migration SQL needed; the string column accepts `'STAFF'` today, only the Zod gate currently rejects it).
  - The 3 Zod schemas at `server/src/schemas/party.schemas.ts` (lines 49, 71, 87) all use `z.enum(PARTY_TYPES)` — they pick up the widening with zero additional edits. After PR1 lands, `'STAFF'` round-trips cleanly through party-list, party-update, and party-create response schemas.
- **Filter policy** — STAFF parties are HIDDEN from customer-facing surfaces and SURFACED only in HR/Employee management UI:

  | Surface | Visibility | Mechanism | File(s) edited in PR1 |
  |---|---|---|---|
  | `GET /api/parties` (default list) | HIDDEN | service default `where.type = { not: 'STAFF' }` (caller can override) | `server/src/services/party/list-get.ts` |
  | `GET /api/parties?includeStaff=true` (HR opt-in) | SURFACED | new query flag in `partyListQuerySchema` | `server/src/schemas/party.schemas.ts` |
  | Customer ledger queries (`party/ledger.service.ts`) | HIDDEN | upstream filter + `assertCustomerPaymentType` belt-and-braces | `server/src/services/party/ledger.service.ts` (M6 row 14) |
  | Dashboard "Money Out" tile | HIDDEN | `recentPayments` query gains `party: { type: { not: 'STAFF' } }` | `server/src/services/dashboard/home.ts` (M6 row 15) |
  | Party report (`report-party.ts`) | HIDDEN | calling-site filter on `party.type != 'STAFF'` | `server/src/services/report/report-party.ts` (M6 row 13) |
  | Party picker in invoice/payment forms (FE) | HIDDEN | FE party-list fetch never sends `includeStaff` | (no edit — uses default `GET /api/parties`) |
  | Party type filter dropdown (FE filter bar) | HIDDEN | `PARTY_TYPE_OPTIONS` constant excludes STAFF | `src/features/parties/party.constants.ts` |
  | Party-form type-select dropdown (Add Party page) | HIDDEN | dropdown options exclude STAFF (Employee management is the only STAFF-create path) | `src/features/parties/party.constants.ts` (same constant) + `src/features/parties/components/PartyFormBasic.tsx` (re-uses constant) |
  | Party list filter bar component (FE) | HIDDEN | uses `PARTY_TYPE_OPTIONS` (already shared); STAFF naturally absent | `src/features/parties/components/PartyFilterBar.tsx` (re-imports — no logic change beyond constant) |
  | HR / Employee management UI (FE) | SURFACED | dedicated `/hr/employees` page hits `GET /api/parties?includeStaff=true` for cross-checks; primarily uses `GET /api/hr/employees` | (Phase-6 PR6 — see §12.1) |
  | `POST /api/parties` (customer create) | REFUSED | service rejects `type: 'STAFF'` with 400 (STAFF parties are server-created only, paired to an Employee) | `server/src/services/party/create.ts` (PR1 row added in v2.2 — see §18.2) |

  This filter policy means a STAFF Party is functionally invisible to every customer-facing path while remaining indexable, payable, and audit-traceable through `Payment.partyId`.

### 2.3 Indexes

- All 8 new tables ship the `@@index([businessId, ...])` pattern the rest of the schema uses.
- `AuditLog.searchVector` GIN index ships as raw SQL inside the migration (per `.claude/rules/PRISMA_MIGRATION_RULES.md` — trgm/GIN must NOT use `@@index`).
- `Employee.partyId` is `@unique` to enforce 1:1 pairing with the STAFF Party.
- `Payment.reversesPaymentId` is `@unique` (added v2.3) — enforces "no reversal-of-reversal" at the DB level.

### 2.4 Migration sequence

```
PR1 — non-destructive only:
  ┌─ migration 20260518_phase6_schema_core
  │     • ALL 8 new tables
  │     • Business.suspendedAt NULL
  │     • BusinessUser.suspendedAt + suspendedById NULL
  │     • AuditLog.searchVector tsvector (raw SQL) + GIN index
  │     • AuditLog.redactedFields Json DEFAULT '{}'
  │     • Payment.reversesPaymentId Int NULL + UNIQUE INDEX + FK self-ref to Payment(id)
  │         (v2.3 A04.1 closure — pure additive; no backfill; existing rows = null)
  │     • shared/enums.ts widens PAYMENT_TYPES (no SQL — string column)
  │     • shared/enums.ts widens PARTY_TYPES (no SQL — string column; M7 closure v2.2)
  │     • schema.prisma:365 Party.type inline comment widened (no SQL; M7 closure v2.2)
  │     • shared/payment-types.ts (NEW helper file — no DB side; assertCustomerPaymentType throws AppError per M8)
  │     • server/src/lib/errors.ts gains INVALID_PAYMENT_TYPE ErrorCode (M8 closure v2.2)
  │     • server/src/lib/security-events.ts (NEW Q2 closure v2.3 — SSOT for emitted security events incl. pin_gate.cookie_tamper_detected)
  │     • payment.schemas.ts adds PaymentTypePublic + PaymentTypeInternal
  │     • 7 consumer files swap ternaries for helper calls (no DB side)
  │     • FE party.constants.ts / PartyFilterBar.tsx / PartyFormBasic.tsx pick up STAFF-excluding option list (no DB side; M7)
  └─ no backfill — every new column is either NULL or default

PR6 — Employee↔Party STAFF pairing (no schema change; runtime invariant):
  • employee.service.ts.createEmployee() wraps Party-create + Employee-create
    in a single $transaction; the Party row uses type='STAFF'.
  • No data migration needed — Phase 6 ships with zero Employees in prod.

PR7 — backfill only (no schema change):
  • audit-coverage.ts SSOT seeded from `git ls-files server/src/services/`
  • 22 mutation services gain audit-write inside their existing $transaction.
```

No `add-column then make-NOT-NULL` step in Phase 6. Every new column is nullable forever, or has a default.

---

## 3. Tenancy (#138) — Elevation of Existing Plumbing

### 3.1 What already exists

- `Business`, `BusinessUser`, `User.activeBusinessId`, JWT contains `businessId`.
- `POST /api/auth/switch-business` exists.
- `requireBusiness` middleware exists.

### 3.2 What Phase 6 adds

- Audit hook on switch (`AuditLog.entityType='BusinessSwitch'`).
- `suspendedAt` columns on `Business` + `BusinessUser`.
- `requireActiveBusiness` middleware (replaces `requireBusiness` on Phase-6 routes).
- `<TenantChip>` SideNav primitive showing current firm + switcher.
- **PR0 cross-tenant leak audit** — every Prisma `findMany`/`findFirst`/`update`/`delete` in `server/src/` is grepped for missing `businessId` in the WHERE clause. Output: `docs/TENANCY_AUDIT.md` with a one-row-per-violation table. Resolutions land BEFORE PR1.

### 3.3 SCOPE §6.5 — no JWT shape change

Per SCOPE §6.5 (Q1 answer), the JWT claim shape stays unchanged. `businessId` already lives in the token. We do NOT add `activeBusinessId` or `roles[]`. The switch-business endpoint mints a new token with the new `businessId`; the existing 401-refresh path handles the cross-over.

### 3.4 /me endpoint widening

`/api/auth/me` adds `business.suspendedAt` + `businessUser.suspendedAt` so the FE can show a "Firm suspended" banner without an extra round-trip.

### 3.5 Suspend / reactivate flow

- `POST /api/businesses/:id/suspend` (PIN-gated, audit-logged) sets `Business.suspendedAt = now()`. Affected sessions get a 403 SUSPENDED on next mutating call.
- `POST /api/businesses/:id/members/:userId/suspend` (PIN-gated) sets `BusinessUser.suspendedAt + suspendedById`. The suspended member's sessions get a 403 on next request scoped to that business.
- Reactivate flips the column to `NULL` and writes an audit row.

### 3.6 requireActiveBusiness implementation

```ts
// server/src/middleware/require-active-business.ts (~75L)
export async function requireActiveBusiness(req, res, next) {
  if (!req.user?.businessId) return res.status(403).json({ success: false, error: { code: 'NO_BUSINESS' } })

  const bu = await prisma.businessUser.findFirst({
    where: { userId: req.user.userId, businessId: req.user.businessId },
    select: { suspendedAt: true, business: { select: { suspendedAt: true } } },
  })
  if (!bu) return res.status(403).json({ success: false, error: { code: 'NO_MEMBERSHIP' } })
  if (bu.suspendedAt) return res.status(403).json({ success: false, error: { code: 'MEMBER_SUSPENDED' } })
  if (bu.business.suspendedAt) return res.status(403).json({ success: false, error: { code: 'FIRM_SUSPENDED' } })

  next()
}
```

> v2.3 A01.1 closure: HP's `AuthRequest['user']` shape is `{ userId, businessId, ... }` per `server/src/middleware/auth.ts:75`. Earlier drafts read `req.user.id` which silently returns `undefined` — and `findFirst({ where: { userId: undefined, businessId: <real> }})` drops the userId filter entirely under Prisma's "ignore undefined" semantics, returning the first BusinessUser for the business regardless of which user is making the request. That is a cross-tenant IDOR. Always `req.user.userId`.

S9 (caching) deferred per task brief — accepted trade-off documented at §17.4 latency gate.

---

## 4. HR Domain (#135 + #136 + #137)

### 4.1 Attendance (#135)

- One `Attendance` row per `(businessId, employeeId, date)` — enforced by `@@unique`.
- Mark/edit endpoints batch-update via a single `$transaction` of `upsert`s.
- Status values: `PRESENT | ABSENT | HALF_DAY | LEAVE_PAID | LEAVE_UNPAID`.
- `overtimeMin` recorded per row, summed into Payroll compute.

### 4.2 Payroll (#136)

- `POST /api/payroll/run/preview` — pure compute over the (from..to) range and selected Employees. Returns per-Employee line items without writing.
- `POST /api/payroll/run/finalize` — PIN-gated, idempotency-keyed. Writes a `PayrollRun` + N child `Payroll` rows + N `Payment` rows of `type='PAYROLL_OUT'` (`partyId=<paired STAFF Party>`) + N `PayslipSnapshot` rows — all inside ONE `$transaction`. Sets `PayrollRun.status='FINALIZED'`.
- `POST /api/payroll/run/:id/reverse` — PIN-gated, audit-logged. Writes inverse-direction `Payment` rows (`type='PAYROLL_IN'`, `partyId=<same STAFF Party>`, `reversesPaymentId=<original>`, positive paise) and flips `PayrollRun.status='REVERSED'`. See §8.3.

### 4.3 Payslip (#137)

- Client-side `@react-pdf/renderer` over `PayslipSnapshot.payload`.
- WhatsApp share via `Capacitor Share` plugin.
- Read endpoint: `GET /api/payroll/:id/snapshot` returns the immutable payload.
- PIN-gated (read-class) on platform-admin viewing other businesses; ungated for the owning business's own staff (one-tier permission via `hr.read`).

---

## 5. Security (#139 + #140)

### 5.1 Audit Trail (#139)

- Existing `AuditLog` table reused. New columns: `searchVector` (tsvector) + `redactedFields` (Json).
- Every mutating service writes an `AuditLog` row inside its own `$transaction`. Single SSOT at `server/src/lib/audit/audit-coverage.ts` enforced at pre-commit.
- `searchVector` populated by a Postgres trigger over `entityType || ' ' || action || ' ' || actor || ' ' || diff::text`.
- Search endpoint: `GET /api/audit?q=...` uses GIN-index full-text search via `websearch_to_tsquery` (see §7.5). Cursor-paginated.
- PII redaction: `AuditLogRedaction` per business — fields listed there are masked at READ time (write stores the raw diff; consumer of the read mutates the diff JSON to mask).

### 5.2 Transaction PIN (#140) — DH port

- DH `src/services/auth-pin/*` (13 of 15 files in scope per Gap 7 reconciliation; the 2 excluded are dairy-specific).
- `UserAppSettings.pinHash` already exists. `pinAttempts/pinLockedUntil` per device extended; `PinPhoneLockout` table added for cross-device per-phone rolling lockout.
- Constants verbatim from DH `pin-auth.constants.ts`: 5 wrong → 30 min device lock, 20 wrong/hour → 1 hour phone lock.
- `PinResetToken` table for `POST /api/auth/pin/reset/request` → `POST /api/auth/pin/reset/finalize`.
- `pin-gc.job.ts` ported verbatim into cron-scheduler entry (DPDP §8(7) retention).

### 5.3 PIN grace via signed cookie (M4 closure — full design; v2.3 A02.2 + Q1/Q3 patches)

Express-session was rejected in v1's audit. v2 stores PIN grace state in a single httpOnly signed cookie. Design:

**Cookie name:** `pin_gate_grace`

**Payload (HMAC-signed JSON):**
```json
{
  "uid": "<userId>",
  "bid": "<businessId>",
  "rc":  "<routeClass>",
  "iat": 1736020100,
  "exp": 1736063300,
  "pf":  "<first 12 hex of sha256(currentPinHash)>"
}
```

> v2.3 A02.2 closure — `pf` (pin fingerprint) is computed at mint time from the user's current `UserAppSettings.pinHash` value (sha256, first 12 hex chars — 48 bits of binding, sufficient to make a stale pf indistinguishable from "wrong cookie" at audit-log volume). On every gated request, the verifier re-reads `pinHash` from the DB, recomputes `pf`, and compares. **Consequence:** any PIN change or reset rotates the underlying `pinHash`, which silently invalidates every cookie ever issued under the old PIN — no need for a session-revocation table, no need to clear cookies on every active session, no race window. A stolen cookie also becomes useless the moment the legitimate user rotates their PIN.

**Signing:**
- HMAC-SHA256 over `'pin-grace-cookie-v1:' + JSON.stringify(payload)` with `process.env.JWT_SECRET`.
- Boot-time check: `if (JWT_SECRET.length < 32) throw new Error('JWT_SECRET too short')`.

> v2.3 Q1 verdict — domain separation: prefixing the HMAC input with the literal string `'pin-grace-cookie-v1:'` ensures a JWT_SECRET-signed payload from ANY other surface (the JWT itself, a future csrf token signed with JWT_SECRET, a previous cookie schema version, etc.) cannot be replayed as a valid pin-grace cookie even if the attacker captures a matching byte-sequence. The `v1` tag lets us rotate the prefix as part of any future cookie-schema change without rotating JWT_SECRET. Per OWASP "Cryptographic Storage" cheat sheet — secret reuse is acceptable when domain-separated; without domain separation it is a vulnerability.

**Cookie attributes:**
- `httpOnly: true`
- `secure: true` (in prod)
- `sameSite: 'strict'`
- `path: '/api'`
- NO `Max-Age` — session-cookie semantics (browser-close clears). The `exp` field inside the payload is the server-side hard envelope (default 12h).

> v2.3 Q3 verdict — sameSite=strict + future OAuth interaction: HP currently has NO third-party OAuth callback. When one is added later (e.g. Google sign-in landing on `/api/auth/google/callback`), the `sameSite=strict` grace cookie WILL NOT be sent on the cross-site POST/GET that returns the user to HP. This is the correct fail-mode (security > convenience): post-OAuth, the next gated route triggers a fresh `requireRecentPin` re-verify and a new cookie is issued. Switching to `sameSite=lax` to "fix" the missing cookie symptom would be wrong — strict is the SSO-safe default. The note exists so a future engineer doesn't accidentally weaken this on the assumption that lax is harmless. Matches how Stripe / GitHub / Google handle their own grace cookies under strict.

**Verification (per gated request):**
1. Parse `req.cookies['pin_gate_grace']` (cookieParser is mounted at `server/src/app.ts:85`).
2. Split `<base64payload>.<base64hmac>`.
3. Recompute HMAC over `'pin-grace-cookie-v1:' + payload`; compare via `crypto.timingSafeEqual`.
4. Reject if `uid !== req.user.userId` (defeats cross-user cookie replay).
5. Reject if `bid !== req.user.businessId` (defeats cross-tenant replay).
6. Reject if `rc !== expectedRouteClass` (per-class grace — e.g. "delete-invoice" grace doesn't open "view-audit-log").
7. Reject if `exp < now()`.
8. Reject if `(now - iat) > GRACE_WINDOW_SECONDS[rc]` (e.g. 300 for "mutating", 3600 for "read-only").
9. Reject if `pf !== sha256(currentPinHash).slice(0,12)` — treats stale fingerprint as cookie-expired (PIN was rotated since this cookie was issued). v2.3 A02.2.

If any rejection: 403 `PIN_REQUIRED` (NOT 401 — sidesteps `src/lib/api.ts` 401-refresh interceptor). Steps 3-9 that fail HMAC, cross-user check, or domain-mismatch also emit `pin_gate.cookie_tamper_detected` security event (see §10.5).

**Issuance:**
- After successful PIN verify, the same response sets a fresh `pin_gate_grace` cookie with `iat=now`, `exp=now+12h`, `rc=<class user just unlocked>`, `pf=sha256(pinHash).slice(0,12)`.

**Invalidation matrix:**
| Event | Action |
|---|---|
| `POST /api/auth/logout` | Clear cookie via `res.clearCookie('pin_gate_grace', { path: '/api' })` |
| `POST /api/auth/logout-all` | Same as above on the originating session; other sessions natural-expire via `uid` mismatch on next request after pinHash rotation invalidates them |
| `POST /api/auth/pin/reset/finalize` | Automatic via `pf` mismatch (no DB write needed — every prior cookie's `pf` is now stale against the new pinHash); also `res.clearCookie` on the originating session as defense-in-depth |
| `POST /api/auth/pin/change` | Same as above — automatic via `pf` mismatch |
| **PIN change/reset (general)** | **Automatic via `pf` mismatch — no server-side session table touched, no per-session iteration needed (v2.3 A02.2)** |
| `POST /api/auth/switch-business` | Clear cookie (bid mismatch would 403 anyway; clearing avoids the user-visible 403 round-trip) |
| `POST /api/businesses/:id/suspend` (own) | Clear cookie if `req.user.userId === affected user` |
| JWT_SECRET rotation | All cookies invalidate via HMAC mismatch — safer fail-mode than session-based |

**Helper file:** `server/src/services/security-pin/pin-grace-cookie.ts` (~190L; v2.3 grew from ~180L by the pf compute/compare + domain-separated HMAC prefix). Exports:
```ts
export function issuePinGraceCookie(res, userId, businessId, routeClass, pinHash)
export function verifyPinGraceCookie(req, expectedClass, currentPinHash): { ok: true } | { ok: false, reason: 'missing' | 'malformed' | 'hmac_mismatch' | 'cross_user' | 'cross_tenant' | 'class_mismatch' | 'expired' | 'iat_too_old' | 'pin_rotated' }
export function clearPinGraceCookie(res)
```

The `currentPinHash` argument is fetched from `UserAppSettings` by the `requireRecentPin` middleware before calling `verifyPinGraceCookie` — one extra SELECT per gated request (acceptable per §15 budgets; can be cached behind the §17.4 S9 deferred cache).

**Cookie size budget:** payload ~170B (added `pf:` ~16B over v2.2), base64 + HMAC ~270B total. <10% of 4KB cookie limit.

**Test coverage:** `pin-grace-cookie.test.ts` (~210L; v2.3 grew from ~180L for `pf` + domain-separation tests) covers tamper, replay, expired, cross-user, cross-tenant, route-class-mismatch, valid, JWT_SECRET rotation, missing JWT_SECRET, sameSite/secure attribute audit, **`pf` mismatch after PIN change** (v2.3), **`pf` mismatch after PIN reset** (v2.3), **domain-separated HMAC prefix rejects a payload signed without the prefix** (v2.3 Q1), and **`pin_gate.cookie_tamper_detected` event emitted on each failure mode** (v2.3 Q2).

---

## 6. API Surface

### 6.1 Routes summary

| Method | Route | Middleware chain | Notes |
|---|---|---|---|
| GET | `/api/hr/employees` | requireActiveBusiness · requirePermission('hr.read') | paginated |
| POST | `/api/hr/employees` | requireActiveBusiness · requireRecentPin('mutating') · requirePermission('hr.write') · idempotency | creates Employee + paired STAFF Party in one tx (§8.5) |
| PATCH | `/api/hr/employees/:id` | same + idempotency | partyId never mutates |
| DELETE | `/api/hr/employees/:id` | same | soft-delete; STAFF Party also soft-deleted in same tx |
| POST | `/api/hr/attendance/batch` | requireActiveBusiness · requirePermission('hr.write') · idempotency | one tx of upserts |
| POST | `/api/payroll/run/preview` | requireActiveBusiness · requirePermission('hr.read') · per-business-rate-limit (10/min) | pure compute |
| POST | `/api/payroll/run/finalize` | requireActiveBusiness · requireRecentPin('mutating') · requirePermission('hr.payroll.run') · idempotency | writes PayrollRun + Payrolls + Payments + Snapshots in one tx |
| POST | `/api/payroll/run/:id/reverse` | same + requireRecentPin('mutating') | writes inverse Payment rows |
| GET | `/api/payroll/:id/snapshot` | requireActiveBusiness · requirePermission('hr.read') | immutable read |
| GET | `/api/audit` | requireActiveBusiness · requireRecentPin('read-only') · requirePermission('audit.read') | GIN search via websearch_to_tsquery, cursor pages |
| POST | `/api/audit/export` | requireActiveBusiness · requireRecentPin('mutating') · requirePermission('audit.export') | CSV stream |
| POST | `/api/auth/pin/verify` | (none — pre-PIN) · rate-limit per-phone | sets pin_gate_grace cookie on success |
| POST | `/api/auth/pin/change` | requireActiveBusiness · requireRecentPin('mutating') | clears + reissues cookie |
| POST | `/api/auth/pin/reset/request` | rate-limit per-phone | sends OTP |
| POST | `/api/auth/pin/reset/finalize` | rate-limit per-phone | rotates pinHash; clears cookie |
| POST | `/api/businesses/:id/suspend` | requireActiveBusiness · requireRecentPin('mutating') · platform-admin only | audit-logged |
| POST | `/api/businesses/:id/members/:userId/suspend` | same | audit-logged |

### 6.2 Error envelope

Standard project envelope `{ success: false, error: { code, message?, fields? } }`. New codes:

- `PIN_REQUIRED` (403) — missing/expired grace cookie
- `MEMBER_SUSPENDED` (403)
- `FIRM_SUSPENDED` (403)
- `NO_BUSINESS` (403)
- `NO_MEMBERSHIP` (403)
- `INVALID_PAYMENT_TYPE` (400) — single rejection path for PAYROLL_* on public endpoint (Zod + service-layer `assertCustomerPaymentType` both throw `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)` — M8 closure v2.2)
- `PAYROLL_ALREADY_FINALIZED` (409)
- `PAYROLL_ALREADY_REVERSED` (409) — second attempt to reverse the same PayrollRun triggers Prisma unique-constraint violation on `Payment.reversesPaymentId`; service translates to this code (v2.3 A04.1)
- `PAYROLL_PERIOD_OVERLAP` (409)
- `PIN_LOCKED_DEVICE` (423)
- `PIN_LOCKED_PHONE` (423)

FE round-trip for PIN_REQUIRED: `PinGateProvider` intercepts the 403, opens the PinPad sheet, on success retries the original request with the freshly issued cookie attached.

---

## 7. Audit Coverage SSOT

### 7.1 Concept

A single TS file lists every mutation operation that MUST write an `AuditLog` row. Pre-commit hook diff-checks: if any service in `audit-coverage.ts` lacks an `auditLog.create` call inside its `$transaction`, the commit is blocked.

### 7.2 File

```ts
// server/src/lib/audit/audit-coverage.ts (~250L cap)
export const AUDIT_COVERAGE = [
  // Phase-6 net new (6)
  { service: 'services/hr/employee.service.ts',           operation: 'createEmployee' },
  { service: 'services/hr/employee.service.ts',           operation: 'updateEmployee' },
  { service: 'services/hr/employee.service.ts',           operation: 'deleteEmployee' },
  { service: 'services/payroll/payroll-run.service.ts',   operation: 'finalizePayrollRun' },
  { service: 'services/payroll/payroll-run.service.ts',   operation: 'reversePayrollRun' },
  { service: 'services/security-pin/pin-verify.service.ts', operation: 'verifyPin' },

  // Phase-6 backfill (16) — pre-existing mutations that gain audit
  { service: 'services/party/update-delete.ts',           operation: 'updateParty' },
  { service: 'services/party/update-delete.ts',           operation: 'deleteParty' },
  { service: 'services/document/delete.ts',              operation: 'deleteDocument' },
  { service: 'services/document/update.ts',              operation: 'updateDocument' },
  { service: 'services/payment/update-delete.ts',        operation: 'updatePayment' },
  { service: 'services/payment/update-delete.ts',        operation: 'deletePayment' },
  { service: 'services/settings/staff.ts',               operation: 'inviteMember' },
  { service: 'services/settings/staff.ts',               operation: 'removeMember' },
  { service: 'services/settings/roles.ts',               operation: 'mutateRole' },
  { service: 'services/settings/app-settings.ts',        operation: 'updateAppSettings' },
  { service: 'services/settings/transaction-lock.ts',    operation: 'setTransactionLock' },
  { service: 'services/settings/approvals.ts',           operation: 'updateApprovalPolicy' },
  { service: 'services/settings/pin.ts',                 operation: 'pinHashRotation' },
  { service: 'services/shared-link.service.ts',          operation: 'revokeSharedLink' },
  { service: 'services/recurring/crud.ts',               operation: 'mutateRecurring' },
  { service: 'services/loyalty/loyalty-program.service.ts', operation: 'mutateLoyaltyProgram' },
] as const
```

**Total: 22 services backfilled** (6 Phase-6 + 16 pre-existing).

### 7.3 Pre-commit enforcer

`scripts/enforce-audit-coverage.mjs` parses each service file's AST, finds every named export listed in `AUDIT_COVERAGE`, walks every `prisma.$transaction(tx => {...})` block in that function, asserts at least one `tx.auditLog.create` call exists inside. Failures print path:line and exit 1.

### 7.4 Why one SSOT

22 services backfilled is too many to track in PR descriptions. The single SSOT is the source of truth; the enforcer ensures drift is caught at commit time.

### 7.5 Search

`searchVector` is auto-populated by a Postgres trigger. GIN index on the column. `GET /api/audit?q=...` uses `websearch_to_tsquery` cursor pagination.

> v2.3 A03.1 closure: `websearch_to_tsquery('english', $1)` accepts user-friendly Google-style queries (`apple OR banana`, `"exact phrase"`, `-exclude`) without parsing FTS operators (`&`/`|`/`!`/`(`) that would crash `to_tsquery` when a user types e.g. `R&D` or `(yes)`. Postgres 11+ supports `websearch_to_tsquery`; Neon is on 15+ so the dependency is satisfied without a server upgrade. The acceptance test at §17.3 includes a fuzz case (`R&D`, `(test)`, `it's`, `a|b`, `--`) that proves the endpoint returns 200 with empty-or-matching results, never 500.

### 7.6 Redaction

`AuditLogRedaction` per business defines field paths to mask. Read-time mutation; write-time stores raw diff (audit integrity). FE shows `<redacted>` placeholder.

---

## 8. Payroll — Money Flow Details

### 8.1 Finalize transaction

```ts
await prisma.$transaction(async (tx) => {
  const run = await tx.payrollRun.create({ data: { businessId, fromDate, toDate, status: 'FINALIZED', createdById, finalizedAt: new Date(), finalizedById: actor.userId }})
  for (const lineItem of preview.lines) {
    const payment = await tx.payment.create({
      data: {
        businessId,
        type: 'PAYROLL_OUT',
        partyId: lineItem.staffPartyId,    // §8.5 — paired STAFF Party
        amount: lineItem.netPaise,
        date: new Date(),
        mode: lineItem.mode ?? 'CASH',
        notes: `Payroll for ${lineItem.employeeName}, ${fromDate} to ${toDate}`,
        createdById: actor.userId,
      },
    })
    const payroll = await tx.payroll.create({ data: { businessId, payrollRunId: run.id, employeeId: lineItem.employeeId, paymentId: payment.id, ...lineItem.computed, status: 'FINALIZED' }})
    await tx.payslipSnapshot.create({ data: { businessId, payrollId: payroll.id, payload: lineItem.snapshotPayload }})
    await tx.auditLog.create({ data: { businessId, entityType: 'Payroll', entityId: payroll.id, action: 'FINALIZE', actorId: actor.userId, diff: { paymentId: payment.id, netPaise: lineItem.netPaise }}})
  }
})
```

### 8.2 Idempotency

Standard `idempotencyMiddleware` keyed off `Idempotency-Key` header. Cached response replays for 24h.

### 8.3 Reverse — inverse-direction-same-amount (M2; A04.1 schema fix v2.3)

Reversal NEVER writes negative paise. It writes inverse-direction Payment rows linked back to originals via `Payment.reversesPaymentId` (added to schema in PR1 per v2.3 A04.1 closure — see §2.2).

```ts
await prisma.$transaction(async (tx) => {
  const run = await tx.payrollRun.findUnique({ where: { id }, include: { payrolls: { include: { payment: true }}}})
  if (run.status !== 'FINALIZED') throw new AppError(ErrorCode.VALIDATION_ERROR, 422, 'PAYROLL_NOT_FINALIZED')
  for (const payroll of run.payrolls) {
    if (!payroll.payment) continue
    try {
      const reversalPayment = await tx.payment.create({
        data: {
          businessId,
          type: 'PAYROLL_IN',                       // inverse direction
          partyId: payroll.payment.partyId,         // SAME STAFF Party (§8.5)
          amount: payroll.payment.amount,           // positive paise — same magnitude
          date: new Date(),
          mode: payroll.payment.mode,
          reversesPaymentId: payroll.payment.id,    // FK back to original (§2.2 column added v2.3)
          notes: `Reversal of payroll #${payroll.id}`,
          createdById: actor.userId,
        },
      })
      await tx.payroll.update({ where: { id: payroll.id }, data: { status: 'REVERSED' }})
      await tx.auditLog.create({ data: { businessId, entityType: 'Payroll', entityId: payroll.id, action: 'REVERSE', actorId: actor.userId, diff: { reversalPaymentId: reversalPayment.id }}})
    } catch (e: any) {
      // v2.3 A04.1 — attempting to reverse a row that has already been reversed fails
      // with the @unique constraint on Payment.reversesPaymentId (Prisma error code P2002).
      // Translate to a typed 409 the FE can show as "Already reversed".
      if (e?.code === 'P2002' && (e?.meta?.target ?? []).includes('reversesPaymentId')) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 409, 'PAYMENT_ALREADY_REVERSED', { originalPaymentId: payroll.payment.id })
      }
      throw e
    }
  }
  await tx.payrollRun.update({ where: { id }, data: { status: 'REVERSED' }})
})
```

**Why inverse-direction-same-amount (M2 justifications):**
1. **Period totals stay clean** — `SUM(amount) WHERE type='PAYROLL_OUT'` gives gross; `SUM(amount) WHERE type='PAYROLL_OUT' OR type='PAYROLL_IN'` doesn't apply (use NET via the LEFT JOIN reversesPaymentId pattern below).
2. **Schema invariant** — `amount > 0` stays universally true; downstream code that assumes positive paise never breaks.
3. **Reversal traceability** — every reversal Payment has `reversesPaymentId` pointing at the original, enabling clean reconciliation.
4. **Audit integrity** — the audit row distinguishes FINALIZE from REVERSE via `action` field; the Payment row distinguishes via `type`.
5. **No reversal-of-reversal** — the `@unique` on `Payment.reversesPaymentId` (added v2.3) means a second reversal write against an already-reversed payment fails with Prisma P2002; the service translates to **409 PAYMENT_ALREADY_REVERSED** (see catch block above). Defense-in-depth at the DB level — no application-logic bug can produce a reversal-of-reversal flip-flop.

**Period-net SQL pattern:**
```sql
SELECT SUM(p.amount) AS net
FROM "Payment" p
LEFT JOIN "Payment" rev ON rev."reversesPaymentId" = p.id
WHERE p."businessId" = $1
  AND p.type IN ('PAYROLL_OUT', 'PAYMENT_OUT')
  AND p.date BETWEEN $2 AND $3
  AND rev.id IS NULL    -- exclude reversed originals
```

### 8.4 Rate limiting

`payrollPreviewRateLimit` = 10 calls/min per business. Implementation uses the real `createRateLimiter` factory at `server/src/middleware/rate-limit/factory.ts` plus a thin per-business helper:

```ts
// server/src/middleware/rate-limit/per-business-factory.ts (~80L)
import { createRateLimiter } from './factory.js'

export function perBusinessRateLimit(opts: { windowMs: number; max: number; messageCode: string }) {
  return createRateLimiter({
    windowMs: opts.windowMs,
    max: opts.max,
    keyFn: (req) => req.user?.businessId ?? req.ip ?? 'unknown',
    messageCode: opts.messageCode,
  })
}

// usage in routes/payroll.routes.ts:
const payrollPreviewRateLimit = perBusinessRateLimit({ windowMs: 60_000, max: 10, messageCode: 'PAYROLL_PREVIEW_RATE_LIMIT' })

router.post('/run/preview',
  requireActiveBusiness,   // guarantees req.user.businessId is present
  requirePermission('hr.read'),
  payrollPreviewRateLimit,
  payrollRunController.preview,
)
```

The `?? req.ip ?? 'unknown'` defensive fallback is documented as belt-and-braces — in practice `requireActiveBusiness` runs first and refuses on missing businessId.

### 8.5 Employee ↔ Party STAFF pairing (S8 closure — NEW; M7 corrected v2.2)

**Decision:** every Employee owns a paired Party row of `type='STAFF'`, created in the same `$transaction` as the Employee. Payroll Payments carry `partyId = <paired STAFF Party id>`. Customer ledger queries filter `WHERE party.type != 'STAFF'` to exclude payroll Payments naturally.

**Why this option** (vs nullable `Payment.partyId` + new `Employee.id` FK):
- **No migration risk:** `Payment.partyId` stays NOT NULL forever — no nullable transition, no backfill, no production-data nightmare.
- **Schema activated by PR1 (M7 closure v2.2):** `Party.type` field at `server/prisma/schema.prisma:365` currently enumerates `CUSTOMER | SUPPLIER | BOTH` ONLY (independently grep-verified — the v2.1 claim that STAFF was already in the schema was FALSE). PR1 widens both `shared/enums.ts` `PARTY_TYPES` (3 → 4 values) AND the inline schema comment to include `STAFF`. The string column accepts the value today; the Zod gate at `server/src/schemas/party.schemas.ts` lines 49, 71, 87 picks up the new value automatically once the enum widens (all three sites use `z.enum(PARTY_TYPES)`).
- **Reporting symmetry:** "Money paid to staff Anil over Q1" reuses the existing party-ledger query infrastructure — just filter on `party.type='STAFF'` instead of excluding it.
- **Cleaner consumer-side defenses:** customer-ledger code paths get `WHERE party.type != 'STAFF'` once at the query level; the helper `paymentTypeDirection` returns 0 for PAYROLL_* so the defense is double-layered.

**Pairing invariant (enforced by Employee schema + service):**
- `Employee.partyId` is `@unique` (PR1 schema).
- `Employee.createEmployee()` runs Party-create THEN Employee-create in ONE `$transaction` — failure of either rolls both back.
- `Employee.deleteEmployee()` soft-deletes BOTH the Employee row AND its paired Party row in ONE `$transaction`.
- `Employee` rows can NEVER swap `partyId`; only delete + re-create.
- `POST /api/parties` (customer-create endpoint) REFUSES `type: 'STAFF'` with 400 — STAFF parties are server-created only, paired to an Employee. The party-create service adds a 3-line guard (PR1 row in §18.2).

**Implementation:**

```ts
// server/src/services/hr/employee.service.ts (PR6) — createEmployee
export async function createEmployee(input, actor) {
  return prisma.$transaction(async (tx) => {
    const party = await tx.party.create({
      data: {
        businessId: actor.businessId,
        name: input.name,
        type: 'STAFF',
        phone: input.phone ?? null,
        createdById: actor.userId,
      },
    })
    const employee = await tx.employee.create({
      data: {
        businessId: actor.businessId,
        partyId: party.id,
        userId: input.userId ?? null,
        name: input.name,
        phone: input.phone ?? null,
        designation: input.designation ?? null,
        dailyRate: input.dailyRatePaise,
        createdById: actor.userId,
      },
    })
    await tx.auditLog.create({
      data: { businessId: actor.businessId, entityType: 'Employee', entityId: employee.id, action: 'CREATE', actorId: actor.userId, diff: { partyId: party.id, dailyRate: input.dailyRatePaise }},
    })
    return { employee, party }
  })
}
```

**Default-filter additions** (PR1 file plan rows — see §2.2 filter policy table for the complete enumeration of customer-facing pickers + HR opt-in surfaces):

| File | 1-line edit |
|---|---|
| `server/src/services/party/list-get.ts` | `where.type = { not: 'STAFF' }` added to the default list (caller can override for HR pages via `includeStaff=true`) |
| `server/src/services/party/ledger.service.ts` | wrapper checks `party.type` upstream; `assertCustomerPaymentType` (now throws `AppError(400 INVALID_PAYMENT_TYPE)`) belt-and-braces |
| `server/src/services/dashboard/home.ts` | recentPayments query gets `party: { type: { not: 'STAFF' } }` |
| `server/src/schemas/party.schemas.ts` | `partyListQuerySchema` gains optional `includeStaff?: boolean` (default false) |
| `server/src/services/party/create.ts` | rejects `type: 'STAFF'` with 400 — STAFF parties are server-created via Employee pairing only |
| `src/features/parties/party.constants.ts` (FE) | `PARTY_TYPE_OPTIONS` + `PARTY_TYPE_LABELS` — STAFF NOT added to customer pickers/labels (Employee management UI uses its own list) |
| `src/features/parties/components/PartyFilterBar.tsx` (FE) | uses `PARTY_TYPE_OPTIONS` (no new option) — STAFF naturally absent |
| `src/features/parties/components/PartyFormBasic.tsx` (FE) | type-select dropdown re-uses `PARTY_TYPE_OPTIONS` — STAFF cannot be set via Add Party form |

Note: the HR page (which DOES want STAFF parties for diagnostic cross-checks) opts in via `GET /api/parties?includeStaff=true`. The primary HR-page data source remains `GET /api/hr/employees`.

---

## 9. UI States, Tokens, & Mobile Discipline

Every Phase-6 screen ships all 4 UI states (loading skeleton, error, empty, success). Tokens-only design (no raw hex, no Tailwind palette). 320px tested. Bottom-nav clearance via `--bottom-nav-height`. Sticky bars use `top: var(--header-height)`. Per `.claude/rules/PAGE_AUDIT_CHECKLIST.md`.

Drawers (`<Drawer>`) for forms; `<ConfirmDialog>` for destructive actions; `<PinPad>` sheet for PIN entry; `<TenantChip>` in SideNav.

---

## 10. State Machines

### 10.1 PayrollRun

```
DRAFT --finalize--> FINALIZED --reverse--> REVERSED (terminal)
```

### 10.2 Payroll

```
DRAFT --finalize--> FINALIZED --reverse--> REVERSED (terminal)
```

### 10.3 PIN session (cookie-based)

```
NO_COOKIE --pin/verify success--> COOKIE_VALID (rc=mutating, 5-min sliding) --gated request before 5m--> COOKIE_VALID (sliding extended? NO — fixed iat)
                                                                              \--gated request after 5m--> EXPIRED --> NO_COOKIE
                                                                              \--PIN change/reset (pinHash rotated)--> PF_STALE --> NO_COOKIE (v2.3 A02.2)
```

Cookie does NOT slide. Each PIN entry sets a fresh `iat`. Re-PIN extends. **PIN change/reset silently invalidates every prior cookie via `pf` fingerprint mismatch — no DB session-table touched (v2.3 A02.2).**

### 10.4 BusinessUser suspend

```
ACTIVE --suspend--> SUSPENDED --reactivate--> ACTIVE
```

### 10.5 Security-event taxonomy (NEW — v2.3 Q2 closure)

PR1 introduces `server/src/lib/security-events.ts` as the SSOT for security-event names emitted to the observability backend (Prometheus counters + structured logs). The file is a thin enum + dispatcher so emit sites never typo an event name.

```ts
// server/src/lib/security-events.ts (~70L)
export const SECURITY_EVENT = {
  PIN_GATE_COOKIE_TAMPER_DETECTED:  'pin_gate.cookie_tamper_detected',
  PIN_GATE_PF_STALE:                'pin_gate.pf_stale',  // benign — PIN was rotated
  PIN_GATE_CROSS_USER:              'pin_gate.cross_user',
  PIN_GATE_CROSS_TENANT:            'pin_gate.cross_tenant',
  PIN_GATE_HMAC_MISMATCH:           'pin_gate.hmac_mismatch',
  PIN_GATE_DOMAIN_PREFIX_MISMATCH:  'pin_gate.domain_prefix_mismatch',
} as const

export function emitSecurityEvent(event: typeof SECURITY_EVENT[keyof typeof SECURITY_EVENT], labels: { userId?: string; ip?: string; reason?: string }) { ... }
```

**Alert rule:** `pin_gate.cookie_tamper_detected > 5/min sustained for 5min on same IP` → page on-call. The taxonomy distinguishes `pf_stale` (benign — legitimate PIN rotation) from `hmac_mismatch` / `cross_user` / `cross_tenant` / `domain_prefix_mismatch` (genuinely suspicious). Only the latter four roll up into `cookie_tamper_detected`.

---

## 11. Middleware chain

Standard order for every Phase-6 mutating route:

```
authMiddleware
  → requireActiveBusiness       (suspends + memberships)
  → requireRecentPin(class)     (cookie verify; 403 PIN_REQUIRED)
  → requirePermission(key)      (RBAC)
  → idempotencyMiddleware       (POST-only)
  → rateLimit (per-business, where applicable)
  → routeHandler
```

**Why PIN BEFORE idempotency:** if idempotency ran first, a replay of an idempotency-keyed request would burn the cache slot even though PIN refused — leaving the user unable to retry without a new key. PIN-first means refused requests don't touch the cache.

**GET PIN-gated routes** (e.g. `/api/audit`): use `requireRecentPin('read-only')` BUT skip `idempotencyMiddleware` (no mutation). The 60-min grace class makes GET audits feel non-friction.

---

## 12. Frontend Architecture

### 12.1 Pages

- `/hr/employees` — list + add
- `/hr/employees/:id` — detail (attendance history, payrolls)
- `/hr/attendance` — daily grid (Employee × Day, status pills)
- `/hr/payroll` — run list + new run wizard
- `/hr/payroll/:runId` — run detail with per-Employee net
- `/payslip/:payrollId` — read-only PDF preview + share
- `/settings/audit` — search + filter + per-row diff drawer
- `/settings/security/pin` — PIN change + reset request
- `/settings/firms` — multi-firm list + suspend/reactivate

### 12.2 PinGateProvider

Top-level provider wrapping `<App>`. Intercepts every `api()` call's `403 PIN_REQUIRED` response — opens the `<PinPad>` sheet, on success retries the original request, on cancel rejects the promise so the caller can clean up.

```ts
// src/providers/PinGateProvider.tsx — high-level pattern
export function PinGateProvider({ children }) {
  const [pending, setPending] = useState<{ retry: () => Promise<any>, routeClass: string } | null>(null)

  useEffect(() => {
    setApi403Handler((retry, routeClass) => new Promise((resolve, reject) => {
      setPending({ retry: () => retry().then(resolve, reject), routeClass })
    }))
    return () => setApi403Handler(null)
  }, [])

  return <>
    {children}
    {pending && <PinPadSheet routeClass={pending.routeClass} onSubmit={pin => callPinVerify(pin).then(pending.retry)} onCancel={() => setPending(null)} />}
  </>
}
```

### 12.3 Offline behavior

Per `.claude/rules/OFFLINE_RULES.md`:
- Every API call goes through `api()` from `@/lib/api`.
- Mutations pass `entityType` + `entityLabel` (e.g. `entityType: 'employee', entityLabel: 'Anil Yadav'`).
- Reads default network-only; opt into cache only for the dashboard summary tile.
- Payroll FINALIZE is online-only — gated by 403 PIN_REQUIRED which can't be served offline (no cookie revalidation path while offline). FE shows "Connect to internet to finalize payroll" if `navigator.onLine === false`.

### 12.4 Mobile-first acceptance

Every Phase-6 page tested at 320px width. Drawer used for forms (no bottom-floated CTAs in feature code). PinPad sits inside a Sheet (`<Drawer>`).

---

## 13. Cron / Scheduled Jobs

- `pin-gc.job.ts` (DH-port verbatim) — hourly. Deletes expired `PinResetToken` rows; resets stale `PinPhoneLockout.windowStart` past their cooldown. DPDP §8(7) retention.
- `auditlog-retention.job.ts` — daily. Soft-archives `AuditLog` rows older than 365 days (business-configurable) into `AuditLogArchive` (out of scope for Phase 6 — file plan row only for the job stub).

Scheduler: existing `server/src/jobs/cron-scheduler.ts` registers both.

---

## 14. Observability

- Every audit-log write counts toward a `audit_writes_total` Prometheus counter (label: entityType, action).
- PIN verify failures count toward `pin_verify_failures_total` (label: reason — wrong | locked-device | locked-phone).
- Cookie tamper attempts (HMAC mismatch, cross-user, cross-tenant, domain-prefix mismatch) count toward `pin_grace_cookie_tamper_total` and emit the structured event `pin_gate.cookie_tamper_detected` (per-IP, per-userId labels) via `emitSecurityEvent` from §10.5.
  - **Alert rule** (v2.3 Q2): `pin_gate.cookie_tamper_detected > 5/min sustained for 5min on same IP` → page on-call. Benign `pin_gate.pf_stale` (PIN rotation) is excluded from the alert rule but still incremented for trend visibility.
- PayrollRun FINALIZE/REVERSE count toward `payroll_run_total` (label: action).
- `payment_already_reversed_total` (NEW v2.3) — increments on every 409 PAYMENT_ALREADY_REVERSED. Sustained > 1/hr suggests a UI bug allowing double-reverse clicks; investigate.

---

## 15. Performance Budgets

| Endpoint | p95 budget | Notes |
|---|---|---|
| GET /api/hr/employees (50 rows) | <200ms | indexed (businessId, isDeleted) |
| POST /api/hr/attendance/batch (30 rows) | <400ms | one tx of upserts |
| POST /api/payroll/run/preview (30 employees, 30 days) | <800ms | pure compute; rate-limited 10/min/business |
| POST /api/payroll/run/finalize (30 employees) | <2s | one $transaction; 91 writes (1 + 30 + 30 + 30); within Render Starter envelope |
| POST /api/payroll/run/:id/reverse (30 employees) | <1.5s | one $transaction; 61 writes (30 + 30 + 1) |
| GET /api/audit?q=... (20 results) | <400ms | GIN-indexed full-text via websearch_to_tsquery |
| POST /api/auth/pin/verify | <250ms | bcrypt compare + cookie issue |
| FE PinPad sheet open | <100ms | already in bundle |
| FE TenantChip render | <50ms | reads from /me cache |

LCP for new pages: <2.5s on 4G. Bundle delta: ~30KB gzipped (mostly the audit-trail diff viewer + PayslipPDF + the new hr/payroll pages — each lazy-loaded per-route).

---

## 16. Rollout Strategy

Flag: `FEATURES.STAFF_HR` (backend) + `VITE_FEATURE_STAFF_HR` (frontend). Wraps every Phase-6 route and FE entry point.

| Stage | Audience | Flag | Verify before next |
|---|---|---|---|
| Internal | Sawan phone only | FEATURE_STAFF_HR=true on phone session | curl + screenshots all 9 pages + payroll FINALIZE + reverse |
| 10% | hash(userId) % 10 === 0 | percentage gate in middleware | 7d metrics; error rate <0.5% on Phase-6 routes; cookie tamper alerts clean |
| 50% | hash(userId) % 2 === 0 | same | 14d metrics + zero audit-coverage drift |
| 100% | all | FEATURE_STAFF_HR=true everywhere | 30d watch errors |

PIN feature has its own flag (`FEATURES.TRANSACTION_PIN`) so it can roll out independently — though tenancy + HR depend on it for FINALIZE protection so the staged rollout assumes both are on for whichever cohort.

---

## 17. Acceptance Gates (verifier-runs-this)

### 17.1 Tenancy (#138)

- [ ] PR0 produces `docs/TENANCY_AUDIT.md` listing every Prisma WHERE that lacks `businessId`.
- [ ] All PR0 violations resolved before PR1 lands.
- [ ] `requireActiveBusiness` REFUSES with 403 MEMBER_SUSPENDED if BusinessUser.suspendedAt is set.
- [ ] `requireActiveBusiness` REFUSES with 403 FIRM_SUSPENDED if Business.suspendedAt is set.
- [ ] `requireActiveBusiness` BusinessUser lookup uses `req.user.userId` (NOT `req.user.id` — A01.1 closure v2.3). Integration test: a malformed middleware that reads `req.user.id` fails the test (returns 200 by leaking a cross-tenant BusinessUser row).
- [ ] `/me` returns `business.suspendedAt` + `businessUser.suspendedAt`.
- [ ] Switch-business writes an `AuditLog` row with `action='SWITCH'`.
- [ ] Integration test: User A's switch from Biz1 to Biz2 cannot read Biz1 data on next request.

### 17.2 HR + Payroll (#135-#137 + M6 + S8 + M7 + M8 + A04.1 closures)

- [ ] Attendance row uniqueness enforced (insert-twice for same employee/date returns 409).
- [ ] Payroll FINALIZE writes exactly `1 PayrollRun + N Payroll + N Payment(type=PAYROLL_OUT) + N PayslipSnapshot + N AuditLog` rows in ONE transaction.
- [ ] Every payroll Payment row has `partyId = <paired STAFF Party id>` (NOT NULL, type='STAFF').
- [ ] `GET /api/parties` returns a STAFF Party row WITHOUT 500 (Zod accepts it once `PARTY_TYPES` is widened — M7 closure).
- [ ] `GET /api/parties` default response EXCLUDES STAFF parties (filter at `party/list-get.ts`).
- [ ] `GET /api/parties?includeStaff=true` INCLUDES STAFF parties (HR opt-in).
- [ ] `POST /api/parties` with `type: 'STAFF'` is REJECTED with 400 (server-created only via Employee pairing — M7).
- [ ] Party-ledger query for any customer/supplier party returns ZERO PAYROLL_OUT / PAYROLL_IN rows (verified: query joins on Party and filters `party.type != 'STAFF'`).
- [ ] Dashboard "Money Out" tile excludes PAYROLL_OUT (verified: recentPayments query filters `party.type != 'STAFF'`).
- [ ] POST /api/payments with `type='PAYROLL_OUT'` is rejected with **400 INVALID_PAYMENT_TYPE** (single rejection path — M8 closure; the `assertCustomerPaymentType` helper throws `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)` whether triggered by the route Zod schema or the in-service belt-and-braces call).
- [ ] POST /api/payments with `type='PAYROLL_IN'` is rejected with **400 INVALID_PAYMENT_TYPE** (same single path — M8 closure).
- [ ] Integration test: hitting `createPayment` with PAYROLL_* (bypassing Zod via direct invocation) produces 400 INVALID_PAYMENT_TYPE, NOT 500 (proves the assert was refactored to `AppError` per M8 closure).
- [ ] **Schema check (v2.3 A04.1):** `prisma migrate diff` shows `Payment.reversesPaymentId` column added as `Int? @unique` with FK self-ref to `Payment(id)`. Integration test: a Payment row created with `reversesPaymentId = X` succeeds; a second Payment row created with `reversesPaymentId = X` fails with Prisma P2002 unique-violation.
- [ ] Reversal writes inverse Payment row (`type='PAYROLL_IN'`, positive paise, `reversesPaymentId` set).
- [ ] **Reversal-of-reversal blocked (v2.3 A04.1):** attempting to reverse a PayrollRun that has already been reversed produces **409 PAYMENT_ALREADY_REVERSED** (NOT 500). Integration test exercises the catch-block translation of Prisma P2002 to AppError(VALIDATION_ERROR, 409, 'PAYMENT_ALREADY_REVERSED').
- [ ] No row in `Payment` table has `amount < 0` (database CHECK + integration test).
- [ ] `shared/payment-types.ts:paymentTypeDirection()` test asserts exhaustive switch (compile-time `never` check + runtime throw for unknown type).
- [ ] `assertCustomerPaymentType()` throws `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)` for PAYROLL_OUT and PAYROLL_IN; unit test verifies the thrown class + status code + ErrorCode value (M8 closure).
- [ ] `assertCustomerPaymentType()` is called at entry to every customer-ledger code path; verified at PR1 by grep against the 6 consumer files.
- [ ] FE party-list filter dropdown (`PARTY_TYPE_OPTIONS`) does NOT include STAFF.
- [ ] FE Add-Party form type-select does NOT include STAFF (visual check + DOM assertion).
- [ ] Period-net SQL via reversesPaymentId LEFT JOIN returns correct net for a Run with 1 reversal among 5 payrolls.

### 17.3 PIN + Audit (#139 + #140 + A02.2 + A03.1 + Q1/Q2 closures)

- [ ] PinPhoneLockout per-phone rolling lockout fires at 20 wrong in 1h.
- [ ] PinPhoneLockout cooldown: 1h after lockout, attempts reset, user can re-try.
- [ ] PIN device-lockout fires at 5 wrong (30 min).
- [ ] PIN reset round-trip: request → SMS-OTP → finalize → cookie cleared → fresh PIN required.
- [ ] **PIN change rotates pinHash → all prior cookies fail `pf` verification on next gated request (returns 403 PIN_REQUIRED). No DB session-table touched. v2.3 A02.2.**
- [ ] **PIN reset rotates pinHash → same `pf` invalidation behavior as above. v2.3 A02.2.**
- [ ] AuditLog `websearch_to_tsquery` search returns expected rows within 400ms p95. **v2.3 A03.1: fuzz test passes for inputs that would crash `to_tsquery` — `R&D`, `(test)`, `it's`, `a|b`, `--`, `&|!()` — endpoint returns 200 with empty-or-matching results, never 500.**
- [ ] AuditLogRedaction masks `phone` field on read (raw stored).
- [ ] 22 services in `audit-coverage.ts` SSOT have audit-write inside `$transaction` (pre-commit enforced).

### 17.4 Latency / S9 trade-off acceptance

- [ ] PIN-gated route p95 ≤ baseline + 50ms (since `requireActiveBusiness` adds 1 BusinessUser SELECT per request, and S9 caching deferred; v2.3 adds 1 UserAppSettings SELECT for pinHash → +1 select total, still within budget).
- [ ] If above breached: add Redis-store 60s cache per S9 recommended fix.

### 17.5 Cookie security (A02.2 + Q1 + Q2 closures v2.3)

- [ ] HMAC tamper: modified cookie returns 403 PIN_REQUIRED (logged as `pin_gate_grace_cookie_tamper` AND structured event `pin_gate.cookie_tamper_detected`).
- [ ] Cross-user replay: cookie issued for user A presented in user B's session returns 403 + emits `pin_gate.cross_user`.
- [ ] Cross-tenant replay: cookie issued for biz1 presented after switch-business returns 403 + emits `pin_gate.cross_tenant`.
- [ ] Route-class mismatch: read-only-grace cookie cannot bypass mutating-grace requirement.
- [ ] Expired cookie (iat older than grace window) returns 403.
- [ ] **Stale `pf` (v2.3 A02.2):** cookie issued before PIN change/reset returns 403 (treated as expired) + emits `pin_gate.pf_stale` (benign — excluded from tamper alert).
- [ ] **Domain-prefix mismatch (v2.3 Q1):** a payload signed with JWT_SECRET but WITHOUT the `'pin-grace-cookie-v1:'` prefix (e.g. a hypothetical leaked JWT replayed as a cookie) returns 403 + emits `pin_gate.domain_prefix_mismatch`.
- [ ] JWT_SECRET rotation invalidates all existing cookies (integration test).
- [ ] Cookie size <500B in HTTP headers (v2.3: +16B for `pf` field; total ~270B).

### 17.6 PIN verify integration

- [ ] Successful PIN-verify response sets `pin_gate_grace` cookie with correct attributes including the freshly computed `pf` from the just-saved pinHash.
- [ ] Failed PIN-verify increments per-device + per-phone counters atomically.
- [ ] PIN-locked phone returns 423 PIN_LOCKED_PHONE with retry-after.
- [ ] PIN verify writes AuditLog (success + failure + lockout).

---

## 18. File Plan (HARD GATE — every row ≤ 250L; total 223 rows)

> Format: `# | Path | Action | Est. Lines | Layer | Build phase`
> Build phase identifies which PR ships the file. PR ordering in §19.

### 18.1 PR0 — Tenancy audit (1 doc, 0 code)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 1 | `docs/TENANCY_AUDIT.md` | create | ~200 | doc | PR0 |

### 18.2 PR1 — Schema core + Payment.type + Party.type widening + helper SSOT (55 rows; v2.3 +1)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 2 | `server/prisma/schema.prisma` (v2.3 grows by +5L for `Payment.reversesPaymentId Int? @unique` + FK self-ref relation pair `reversesPayment Payment? @relation("PaymentReversal", ...)` + back-relation `reversedBy Payment[] @relation("PaymentReversal")`) | edit | +186 | schema | PR1 |
| 2a | `server/prisma/schema.prisma` (Party.type inline comment widening — M7 closure v2.2) | edit | +1 | schema | PR1 |
| 3 | `server/prisma/migrations/20260518_phase6_schema_core/migration.sql` (v2.3 includes `ADD COLUMN "reversesPaymentId" INTEGER NULL` + `CREATE UNIQUE INDEX "Payment_reversesPaymentId_key" ON "Payment"("reversesPaymentId")` + `ADD CONSTRAINT "Payment_reversesPaymentId_fkey" FOREIGN KEY ("reversesPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL`) | create | ~265 | migration | PR1 |
| 4 | `server/src/lib/audit/audit-coverage.ts` | create | ~120 | constants | PR1 |
| 5 | `scripts/enforce-audit-coverage.mjs` | create | ~200 | enforcer | PR1 |
| 6 | `shared/enums.ts` (PAYMENT_TYPES widen + PARTY_TYPES widen + CUSTOMER_PAYMENT_TYPES split — M7 closure v2.2 grows this row from +8L to +12L) | edit | +12 | constants | PR1 |
| 7 | `server/src/schemas/payment.schemas.ts` (PaymentTypePublic + PaymentTypeInternal — S7) | edit | +12 | schema | PR1 |
| 8 | `shared/payment-types.ts` (helpers; assertCustomerPaymentType throws AppError(INVALID_PAYMENT_TYPE, 400) — M8 closure v2.2 grows from ~90L to ~95L) | create | ~95 | utils (pure) | PR1 |
| 8a | `server/src/lib/errors.ts` (add INVALID_PAYMENT_TYPE to ErrorCode enum — M8 closure v2.2) | edit | +2 | constants | PR1 |
| 9 | `server/src/services/payment/create.ts` (top-of-handler assertCustomerPaymentType — M8 single-path; helper for arithmetic) | edit | +14 | service | PR1 |
| 10 | `server/src/services/payment/update-delete.ts` | edit | +12 | service | PR1 |
| 11 | `server/src/services/payment/get-list.ts` | edit | +8 | service | PR1 |
| 12 | `server/src/services/report/report-payment.ts` | edit | +8 | service | PR1 |
| 13 | `server/src/services/report/report-party.ts` | edit | +8 | service | PR1 |
| 14 | `server/src/services/party/ledger.service.ts` | edit | +10 | service | PR1 |
| 15 | `server/src/services/dashboard/home.ts` | edit | +6 | service | PR1 |
| 16 | `server/src/services/party/list-get.ts` (S10 closure v2.2 — renamed from list.service.ts which does not exist) | edit | +4 | service | PR1 |
| 16a | `server/src/services/party/create.ts` (reject `type: 'STAFF'` with 400 INVALID_PARTY_TYPE — STAFF parties are server-created only; M7 closure v2.2) | edit | +6 | service | PR1 |
| 17 | `server/src/schemas/party.schemas.ts` (partyListQuerySchema gains `includeStaff?: boolean` default false — M7 enables HR opt-in) | edit | +6 | schema | PR1 |
| 17a | `src/features/parties/party.constants.ts` (FE `PARTY_TYPE_OPTIONS` + `PARTY_TYPE_LABELS` — STAFF intentionally NOT added; M7 customer-facing-picker filter policy) | edit | +0 | constants | PR1 |
| 17b | `src/features/parties/components/PartyFilterBar.tsx` (FE — re-imports `PARTY_TYPE_OPTIONS`; STAFF naturally absent; M7) | edit | +0 | component | PR1 |
| 17c | `src/features/parties/components/PartyFormBasic.tsx` (FE — type-select dropdown re-uses `PARTY_TYPE_OPTIONS`; STAFF cannot be set via Add Party form; M7) | edit | +0 | component | PR1 |
| 18 | `server/src/middleware/rate-limit/per-business-factory.ts` | create | ~80 | middleware | PR1 |
| 19 | `server/src/middleware/require-active-business.ts` (v2.3 A01.1 — uses `req.user.userId`) | create | ~75 | middleware | PR1 |
| 20 | `server/src/services/settings/permissions-data.ts` | edit | +20 | constants | PR1 |
| 21 | `server/tests/migrations/20260518.test.ts` (v2.3 adds assertions for `Payment.reversesPaymentId` column + unique index + FK self-ref) | create | ~170 | test | PR1 |
| 22 | `server/tests/shared/payment-types.test.ts` (covers AppError throw + ErrorCode + 400 status — M8 verification) | create | ~200 | test | PR1 |
| 23 | `server/tests/middleware/require-active-business.test.ts` (v2.3 A01.1 — explicit case: middleware reading `req.user.id` (undefined) fails the cross-tenant leak assertion; correct middleware reading `req.user.userId` passes) | create | ~220 | test | PR1 |
| 24 | `server/tests/services/payment/payroll-type-guard.test.ts` (single-rejection-path acceptance gate; observes 400 not 500 — M8) | create | ~130 | test | PR1 |
| 24a | `server/tests/services/party/staff-party-create-guard.test.ts` (POST /api/parties with type=STAFF returns 400 — M7) | create | ~110 | test | PR1 |
| 24b | `server/tests/schemas/party-staff-roundtrip.test.ts` (PARTY_TYPES widening — Zod accepts STAFF round-trip per M7) | create | ~90 | test | PR1 |
| 24c | `server/src/lib/security-events.ts` (Q2 closure v2.3 — SSOT for emitted security-event names; pin_gate.* enum + emitSecurityEvent dispatcher) | create | ~70 | constants | PR1 |
| 25-55 | (26 supporting test fixtures + index updates) | create/edit | ~50 each avg | test | PR1 |

(Rows 25-55 enumerate per-file fixture scaffolds; total kept ≤250L per row by composition.)

> v2.2 row delta (M7 + M8 + S10 closures): 2a, 8a, 16a, 17a, 17b, 17c, 24a, 24b are NEW rows; rows 6, 8, 9, 16 grow by 4L/5L/2L/0L (filename only) respectively. Net new PR1 rows: +8 (5 real edits + 3 net-new test rows); 3 of those rows (17a/b/c) are +0L because they're constant-only edits or no-op re-import verifications.
> v2.3 row delta (A01.1 + A02.2 + A03.1 + A04.1 + Q1/Q2/Q3 closures): +1 NEW row 24c (`server/src/lib/security-events.ts` SSOT for Q2 telemetry). Row 2 (`schema.prisma`) grows +5L for `Payment.reversesPaymentId` column + relation pair (A04.1). Row 3 (migration.sql) grows +15L for the ADD COLUMN + UNIQUE INDEX + FK statements (A04.1). Row 19 (`require-active-business.ts`) text updated to call out `req.user.userId` (A01.1). Row 21 (migration test) grows +20L to assert the new column + unique index + FK (A04.1). Row 23 (require-active-business test) grows +20L for the A01.1 cross-tenant-leak counter-example. PR3 row 71/74/75 grow for `pf` + domain-separation tests (A02.2 + Q1) — captured in §18.4 v2.3 note.

### 18.3 PR2 — Tenancy elevation (15 rows)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 56 | `server/src/services/auth/switch-business.service.ts` | edit | +30 (audit hook) | service | PR2 |
| 57 | `server/src/services/business/suspend.service.ts` | create | ~140 | service | PR2 |
| 58 | `server/src/routes/businesses.routes.ts` | edit | +60 | route | PR2 |
| 59 | `server/src/services/auth/me.service.ts` | edit | +12 (suspendedAt fields) | service | PR2 |
| 60-65 | (frontend TenantChip + suspend FE + tests) | create | various | FE+test | PR2 |
| 66-70 | (integration tests for switch + suspend + reactivate) | create | ~200 each | test | PR2 |

### 18.4 PR3 — PIN port + cookie grace (35 rows; v2.3 expanded for pf + domain-separation)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 71 | `server/src/services/security-pin/pin-verify.service.ts` (v2.3: success-branch passes `pinHash` into `issuePinGraceCookie` so the cookie carries the fresh `pf`) | create (DH port) | ~220 | service | PR3 |
| 72 | `server/src/services/security-pin/pin-lockout.service.ts` | create (DH port) | ~210 | service | PR3 |
| 73 | `server/src/services/security-pin/pin-reset.service.ts` | create (DH port) | ~220 | service | PR3 |
| 74 | `server/src/services/security-pin/pin-grace-cookie.ts` (v2.3 grows from ~180L → ~190L: domain-separated HMAC prefix `'pin-grace-cookie-v1:'` + `pf` compute/compare in verify path; signature expands to take `pinHash` at issue and `currentPinHash` at verify) | create | ~190 | service | PR3 |
| 75 | `server/src/services/security-pin/pin-grace-cookie.test.ts` (v2.3 grows from ~180L → ~210L: covers `pf` mismatch after PIN change/reset + domain-prefix rejection + `pin_gate.cookie_tamper_detected` event emission on each fail mode) | create | ~210 | test | PR3 |
| 76 | `server/src/constants/pin-auth.constants.ts` | create (DH port) | ~60 | constants | PR3 |
| 77 | `server/src/jobs/pin-gc.job.ts` | create (DH port) | ~130 | job | PR3 |
| 78 | `server/src/middleware/require-recent-pin.ts` (v2.3: SELECT current `UserAppSettings.pinHash` before calling `verifyPinGraceCookie` so the verifier can compare `pf`) | create | ~130 | middleware | PR3 |
| 79 | `server/src/routes/auth-pin.routes.ts` | create | ~150 | route | PR3 |
| 80 | `server/src/schemas/pin.schemas.ts` | create | ~80 | schema | PR3 |
| 81 | `server/src/app.ts` | edit | +5 (cookieParser already mounted; verify) | bootstrap | PR3 |
| 82-105 | (FE PinGateProvider + PinPad components + tests) | create | various ≤250 | FE+test | PR3 |

> Pre-planned splits (S6 risk mitigation):
> - If `pin-verify.service.ts` lands >230L → extract `pin-verify-orchestrator.ts` (success branch + audit emit)
> - If `pin-reset.service.ts` lands >230L → extract `pin-reset-token-mint.ts`
> - If `pin-grace-cookie.ts` lands >230L → extract `pin-grace-cookie-verify.ts` (which would also house the `pf` compare + domain-prefix verify)

### 18.5 PR4 — Audit search + redaction UI (25 rows; v2.3 row 106 updated for websearch_to_tsquery)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 106 | `server/src/services/audit/audit-search.service.ts` (v2.3: uses `websearch_to_tsquery('english', $1)` per A03.1) | create | ~180 | service | PR4 |
| 107 | `server/src/services/audit/audit-redaction.service.ts` | create | ~150 | service | PR4 |
| 108 | `server/src/routes/audit.routes.ts` | create | ~120 | route | PR4 |
| 109 | `server/src/schemas/audit.schemas.ts` | create | ~90 | schema | PR4 |
| 110-130 | (FE audit page + filter drawer + diff viewer + tests — v2.3: test row includes the fuzz battery for to_tsquery-crashing inputs) | create | various ≤250 | FE+test | PR4 |

### 18.6 PR5 — Attendance domain (12 rows)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 131 | `server/src/services/hr/attendance.service.ts` | create | ~200 | service | PR5 |
| 132 | `server/src/routes/hr.routes.ts` | create | ~150 | route | PR5 |
| 133 | `server/src/schemas/attendance.schemas.ts` | create | ~80 | schema | PR5 |
| 134-142 | (FE attendance grid + tests) | create | various ≤250 | FE+test | PR5 |

### 18.7 PR6 — Employee + Payroll (35 rows, includes S8 pairing edit; v2.3 row 146 grows for P2002 catch)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 143 | `server/src/services/hr/employee.service.ts` | create | ~230 (includes STAFF-Party pairing — S8) | service | PR6 |
| 144 | `server/src/services/hr/employee.types.ts` | create | ~60 | types | PR6 |
| 145 | `server/src/services/payroll/payroll-compute.ts` | create | ~180 | utils (pure) | PR6 |
| 146 | `server/src/services/payroll/payroll-run.service.ts` (v2.3: reverse() includes try/catch translating Prisma P2002 on `reversesPaymentId` to `AppError(VALIDATION_ERROR, 409, 'PAYMENT_ALREADY_REVERSED')` per A04.1) | create | ~245 | service | PR6 |
| 147 | `server/src/services/payroll/payroll-snapshot.ts` | create | ~140 | service | PR6 |
| 148 | `server/src/routes/payroll.routes.ts` | create | ~180 | route | PR6 |
| 149 | `server/src/schemas/payroll.schemas.ts` | create | ~120 | schema | PR6 |
| 150-177 | (FE employee + payroll pages + tests + payslip PDF + share — v2.3: payroll reverse test asserts 409 PAYMENT_ALREADY_REVERSED on second-reverse attempt) | create | various ≤250 | FE+test | PR6 |

> S8 pairing edit explicitly captured at row 143 — `createEmployee` wraps Party-create + Employee-create in one tx.
> S6 pre-plan: if `payroll-run.service.ts` >245L → extract `payroll-run-reverse.ts` (v2.3 makes this likely given the +catch block).

### 18.8 PR7 — Audit backfill (22 rows)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 178-193 | 16 existing services gain audit-write inside their `$transaction` | edit | +10-20 each | service | PR7 |
| 194-199 | 6 Phase-6 services (already shipping audit in PR3/PR5/PR6) double-checked + tests added | edit/test | various | test | PR7 |

### 18.9 PR8 — Rollout + flags + docs (6 rows)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 200 | `server/src/config/features.ts` | edit | +6 | constants | PR8 |
| 201 | `src/config/features.ts` (FE) | edit | +6 | constants | PR8 |
| 202 | `docs/ROLLOUT_PHASE6.md` | create | ~250 | doc | PR8 |
| 203 | `docs/RUNBOOK_PHASE6.md` (v2.3: adds "PAYMENT_ALREADY_REVERSED 409s spike" + "pin_gate.cookie_tamper_detected alert fires" runbooks) | create | ~250 | doc | PR8 |
| 204-222 | (release-notes, telemetry dashboards, alert rules, etc.) | create | various ≤250 | doc/ops | PR8 |

**File-count tally: 223 rows** (v2 → v2.1 delta +8; v2.1 → v2.2 delta +5; v2.2 → v2.3 delta +1 (new row 24c `server/src/lib/security-events.ts`). Schema row 2 grew +5L for A04.1; multiple other rows grew without adding new file-plan rows — pf compute, websearch_to_tsquery swap, A01.1 rename, P2002 catch — captured inline.)

---

## 19. PR Queue

| PR | Title | File count | Depends on | Notes |
|---|---|---|---|---|
| PR0 | Cross-tenant leak audit | 1 doc | — | architect-led; produces TENANCY_AUDIT.md |
| PR1 | Schema core + Payment.type + Party.type + helper SSOT + security-events SSOT (v2.3 +A04.1 column +A01.1 userId fix) | 55 | PR0 | helper extraction + M7/M8 closures + A04.1 schema + Q2 SSOT land here |
| PR2 | Tenancy elevation (suspend/reactivate, /me, TenantChip) | 15 | PR1 | |
| PR3 | PIN port + cookie grace + middleware (v2.3 +pf +domain-separated HMAC +Q2 emit) | 35 | PR1 | DH-port heavy |
| PR4 | Audit search + redaction UI (v2.3 +websearch_to_tsquery) | 25 | PR3 (PIN gates audit read) | |
| PR5 | Attendance domain | 12 | PR1 | |
| PR6 | Employee + Payroll (with S8 STAFF Party pairing; v2.3 +PAYMENT_ALREADY_REVERSED 409 translation) | 35 | PR3 (PIN gates FINALIZE), PR5 | |
| PR7 | Audit backfill (22 services) | 22 | PR1 | enforce-audit-coverage active |
| PR8 | Rollout + flags + docs | 6 | all | |

**Total: 206 net file changes** (v2.3 adds 1 new file — `server/src/lib/security-events.ts`).

---

## 20. Postmortem Triggers

If any of these fire after Phase 6 ships, run a postmortem within 48h:

- **A `Payment` row appears in prod with `amount < 0`** — design said never. Means reversal logic was bypassed or a developer wrote a negative-amount workaround. Trace via `reversesPaymentId IS NULL` check.
- **A `Payment` row with `type='PAYROLL_*'` appears with `partyId` pointing at a `type='CUSTOMER'` or `type='SUPPLIER'` Party** — design said never. Means the pairing invariant in §8.5 was bypassed.
- **A customer ledger shows a PAYROLL_* row** — filter at the query level failed. Trace which consumer file (one of the 6 in §2.2) lost its STAFF-Party exclusion.
- **`POST /api/payments` returns 500 instead of 400 INVALID_PAYMENT_TYPE for PAYROLL_***  — `assertCustomerPaymentType` regressed to plain `Error`. Re-instate the `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)` throw per M8.
- **`GET /api/parties` returns 500 on a STAFF row** — `PARTY_TYPES` widening was reverted or the Zod schema diverged from `shared/enums.ts`. Re-instate per M7.
- **A `Party` row with `type='STAFF'` is created via `POST /api/parties`** — the M7 guard in `services/party/create.ts` was bypassed. STAFF parties must only be created via Employee pairing.
- **An audit row is missing for a service in `audit-coverage.ts`** — the pre-commit enforcer didn't fire. Trace the bypass and re-add the missing check.
- **`pin_grace_cookie_tamper_total` spikes** — investigate possible token leakage or active attack. Cross-reference with `pin_gate.cookie_tamper_detected` IP/userId labels to distinguish brute-force vs. targeted replay.
- **PIN-gated route p95 > baseline + 100ms** — S9 caching needs to ship (now even more justified: v2.3 added 1 pinHash SELECT per gated request).
- **`payment_already_reversed_total` spikes (v2.3)** — UI is letting users double-click the Reverse button OR background-job is racing. The 409 is the correct safety response; the trigger is a UI/race-condition postmortem.
- **A `req.user.id` reference appears anywhere in the diff (v2.3)** — A01.1 regression. The `enforce.js` script should be extended with a pattern check (`/req\.user\.id\b/` outside `req.user.userId`) to catch this at pre-commit.
- **A `to_tsquery(` call appears in any query file outside test code (v2.3)** — A03.1 regression. The pre-commit hook should ban that token in `server/src/services/audit/**` specifically.

---

## Revision Log

- **v1** (2026-05-17) — Initial publication.
- **v2** (2026-05-17) — Closed audit MUST_SHIPs M1-M5 (see frontmatter for full detail).
- **v2.1** (2026-05-17) — Closed v2 re-audit MUST_SHIP M6 + SHOULD_SHIPs S7, S8. Specifically:
  - M6: Added `shared/payment-types.ts` SSOT helper (~90L) exporting `paymentTypeDirection` / `isCustomerPaymentType` / `isPayrollPaymentType` / `assertCustomerPaymentType`. PR1 file plan grew by 7 consumer-edit rows (payment/create, payment/update-delete, payment/get-list, report-payment, report-party, party/ledger, dashboard/home) + 1 helper row + supporting test row. Exclusion documented: `cash-register/cash-entry.queries.ts` has zero `Payment.type` references; `collections/statement.service.ts` is partyId-scoped; `report-daybook.ts` narrows `type` in `where:`.
  - S7: Added public-vs-internal Zod split (`PaymentTypePublic` / `PaymentTypeInternal`) in `payment.schemas.ts` (+12L vs v2's +2L); defense-in-depth guard in `payment/create.ts` rejects PAYROLL_* with 400 INVALID_PAYMENT_TYPE.
  - S8: Decided Employee↔Party STAFF pairing (vs nullable partyId + new employeeId FK). Documented in new §8.5. PR1 picks up the party-list `where.type = { not: 'STAFF' }` default filter; PR6 row 138 ships the `createEmployee` tx that creates the paired Party. (v2.2 corrects the false schema claim — see below.)
  - Sweep-replaced "20 mutation services" → "22 mutation services" in §0, §7.4, §17.3.
  - File-count tally: 209 → 217 (+8).
  - Acceptance gates §17.2 expanded to cover STAFF Party invariants + Zod-split + helper exhaustiveness.
- **v2.2** (2026-05-17) — Closed v2.1 re-audit M7 + M8 + S10 (in-place surgical patch; no design rewrite):
  - M7 closure (PARTY_TYPES widening + customer-facing-picker filter policy):
    - v2.1 falsely asserted `Party.type` already enumerated STAFF (cited `schema.prisma:1015`). Independent verification: schema line 365 reads `type String @default("CUSTOMER") // CUSTOMER, SUPPLIER, BOTH` (no STAFF); `shared/enums.ts:68` has `PARTY_TYPES = ['CUSTOMER', 'SUPPLIER', 'BOTH']`; all 3 Zod schemas use `z.enum(PARTY_TYPES)` and would 500-reject a STAFF Party round-trip.
    - PR1 file plan now widens `shared/enums.ts` PARTY_TYPES from 3 → 4 values (existing row 6 grows +4L) AND the inline `schema.prisma:365` comment (new row 2a, +1L). Both edits are no-DDL (string column).
    - §2.2 column-changes table gains a `Party.type` row.
    - §8.5 "Schema already supports it" bullet replaced with the truthful widening narrative + comprehensive filter policy table covering: customer-facing pickers (HIDDEN — `party-list-get.ts` default filter, `party.constants.ts` PARTY_TYPE_OPTIONS, PartyFilterBar.tsx, PartyFormBasic.tsx), customer-create endpoint (REFUSED with 400 — server-created only via Employee pairing), HR opt-in (`?includeStaff=true`), and dedicated HR UI (SURFACED).
    - 3 new FE filter rows (17a/b/c) + 2 new test rows (24a/b) + 1 new service-side guard row (16a `party/create.ts`).
    - Fixed wrong schema-line citation `schema.prisma:1015` → `schema.prisma:365` in 2 sites (§0 line 59 + §8.5 line 792).
    - §17.2 acceptance gates expanded with 5 new STAFF-Party-specific checks (round-trip, default filter, includeStaff opt-in, customer-create rejection, FE dropdown verification).
  - M8 closure (single rejection path via AppError):
    - v2.1 documented both an explicit 400-guard at the `payment/create.ts` route boundary AND a `assertCustomerPaymentType` call inside the service. The assert threw a plain `Error` → bubbled to 500 via Express's default handler. The §17.2 acceptance gate said "rejected with 400" — collision was guaranteed.
    - HP error class survey: NO `BadRequestError` or `BusinessError` exists; the canonical pattern is `AppError(ErrorCode, statusCode, message, details?)` at `server/src/lib/errors.ts` with `errorHandler` middleware mapping it to a typed JSON response.
    - Picked option (b): refactor `assertCustomerPaymentType` (in `shared/payment-types.ts`) to throw `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ...)`. The 400-guard and the assert COLLAPSE into one path — both produce the same status code, ErrorCode, and message shape regardless of which fires first. Zod public-vs-internal split remains the first defense, the assert is the second.
    - Why option (b) over (a) or (c): preserves defense-in-depth (services should never trust callers — option (a) drops that), single rejection semantic (option (c) would document two paths but still allow them to disagree on message). (b) is the simplest path that closes the contradiction AND keeps M6's helper as the single SSOT for the rejection semantic.
    - New `INVALID_PAYMENT_TYPE` entry in `ErrorCode` enum at `server/src/lib/errors.ts` (PR1 row 8a, +2L).
    - `shared/payment-types.ts` grew from ~90L → ~95L (added the AppError import + threw error includes `details: { type }`).
    - Updated §2.2 line 308 (Defense-in-depth section), consumer-table row 358 (payment/create.ts), and §6.2 error-codes list to reflect the single path. §17.2 gates expanded with explicit 400-not-500 acceptance check + an integration test that bypasses Zod via direct invocation to prove the assert throws AppError.
  - S10 closure (filename):
    - PR1 row 16 + §8.5 default-filter table both cited `server/src/services/party/list.service.ts`. Real file is `server/src/services/party/list-get.ts` (verified: `ls server/src/services/party/` returns `addresses.ts, create.ts, custom-fields.ts, followups.service.ts, groups.ts, helpers.ts, last-contacted.service.ts, ledger.service.ts, ledger.types.ts, list-get.ts, pricing.ts, tags.service.ts, update-delete.ts`).
    - Renamed in 2 sites.
  - File-count tally: 217 → 222 (+5 new rows: 2a, 8a, 16a, 17a, 17b, 17c, 24a, 24b minus three +0L FE rows that ship file-plan slots without disk additions — but counted in row count for build-phase tracking).
  - Pre-existing rows that grew: row 6 (`shared/enums.ts`: +8L → +12L for PARTY_TYPES widening), row 8 (`shared/payment-types.ts`: ~90L → ~95L for AppError-throwing assert), row 9 (`payment/create.ts`: +12L → +14L for top-of-handler assertCustomerPaymentType), row 16 (filename: `list.service.ts` → `list-get.ts`).
- **v2.3** (2026-05-17) — Closed v2.2 security re-audit (4 MUST_FIX: A01.1, A02.2, A03.1, A04.1) + codified Q1/Q2/Q3 verdicts (in-place surgical patch; no design rewrite):
  - A01.1 closure (req.user.userId): replaced `req.user.id` → `req.user.userId` in §3.6 (requireActiveBusiness implementation, line 538), §5.3 verification step 4 (line 627), and §5.3 invalidation matrix row 6 (line 646). Glossary §1 wire conventions gains an explicit rule: "All references to the authenticated user's id use `req.user.userId`. Never `req.user.id`." §17.1 acceptance gate adds a counter-example test (middleware reading `req.user.id` MUST fail the cross-tenant-leak assertion). §20 postmortem trigger added (`req.user.id` regression caught at pre-commit by an enforce.js pattern).
  - A02.2 closure (PIN fingerprint `pf`): grace cookie payload gains a 6th field `pf` = first 12 hex of `sha256(currentPinHash)` at minting; verifier recomputes from current DB pinHash on every gated request and rejects on mismatch (treated as cookie-expired). PIN change/reset silently invalidates all prior cookies via `pf` mismatch — no session DB write needed, no per-session iteration. §5.3 payload schema, verification step list, and invalidation matrix all updated. §10.3 PIN-session state machine adds the `PF_STALE` transition. §17.3 + §17.5 acceptance gates expanded.
  - A03.1 closure (websearch_to_tsquery): §7.5 swaps `to_tsquery` → `websearch_to_tsquery('english', $1)`. §5.1 + §6.1 + §15 references updated for consistency. §17.3 acceptance gate adds a fuzz battery (`R&D`, `(test)`, `it's`, `a|b`, `--`, `&|!()`) that would crash `to_tsquery` on raw user input. §20 postmortem trigger added (any `to_tsquery(` in `services/audit/**` should be caught at pre-commit).
  - A04.1 closure (Payment.reversesPaymentId): §2.2 column-changes table gains `Payment | reversesPaymentId | NEW Int? @unique with FK self-ref` row; §2.4 PR1 migration bullet adds the ADD COLUMN + UNIQUE INDEX + FK self-ref SQL (nullable, no backfill); §2.3 indexes section notes the new `@unique`; §6.2 error envelope gains `PAYMENT_ALREADY_REVERSED` (409); §8.3 service code adds try/catch translating Prisma P2002 to AppError(VALIDATION_ERROR, 409, 'PAYMENT_ALREADY_REVERSED'); §18.2 row 2 grows +5L for the schema, row 3 grows +15L for the migration SQL, row 21 grows +20L for column/index/FK assertion test; §18.7 row 146 grows +5L for the catch block (+ S6 split note); §14 observability adds `payment_already_reversed_total` counter; §17.2 acceptance gate adds reversal-of-reversal block test + schema-diff check.
  - Q1 verdict (ACCEPTABLE with domain-separation tag): HMAC input prefixed with literal `'pin-grace-cookie-v1:'` before signing with JWT_SECRET. Documented in §5.3 signing section. The `v1` version tag allows prefix rotation without secret rotation if the cookie schema changes later.
  - Q2 verdict (telemetry + alert): cookie tamper events emit `pin_gate.cookie_tamper_detected` (per-IP, per-userId labels). Alert rule: `>5/min sustained for 5min on same IP`. §14 + §10.5 (NEW security-event taxonomy mini-section) document the event names; PR1 file plan adds new row 24c for `server/src/lib/security-events.ts` SSOT helper.
  - Q3 verdict (sameSite=strict + OAuth): §5.3 cookie-attribute section adds explicit note that strict will not be sent on cross-site OAuth callbacks; post-OAuth flow MUST trigger a fresh `requireRecentPin`. Future-engineer trap-door rationale included.
  - File-count tally: 222 → 223 (+1 new row 24c for security-events.ts). Schema row 2 grew +5L for `Payment.reversesPaymentId`. PR3 rows 71/74/75/78 grew for pf + domain-separation. PR4 row 106 grew for websearch_to_tsquery. PR6 row 146 grew for P2002 catch.
