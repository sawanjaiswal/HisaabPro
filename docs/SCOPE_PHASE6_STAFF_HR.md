---
feature: phase-6-staff-hr
status: DRAFT — awaiting Sawan answers to §11 + scope-auditor pass
created: 2026-05-17T22:48:00+05:30
scope: backlog #135 Attendance + #136 Payroll + #137 Salary Slips + #138 Multi-firm + #139 Audit Trail + #140 Transaction PIN
gates: scope-auditor required before architect; architect → security MANDATORY before any build PR (#138 touches User model + JWT claim shape + tenancy boundary on every query — high-risk path per `~/.claude/rules/HIGH_RISK_PATHS.md`)
sibling_docs:
  - docs/SCOPE_EPIC_D_crm_loyalty.md (format template + permission-aware ledger pattern to mirror for #139 / #136)
  - PRDs/multi-business-user-management-PLAN.md (existing tenancy plumbing — #138 elevates, does not invent)
  - PRDs/settings-security-PLAN.md (existing user-PIN + operation-PIN — #140 extends, does not invent)
high_risk_paths_touched:
  - server/prisma/schema.prisma (8 new tables + 2 User columns + 1 Business column)
  - server/src/lib/jwt.ts (claim-shape decision in §3, may stay unchanged)
  - server/src/services/auth.service.ts (switch-business already exists; we add audit logging + PIN gate)
  - server/src/middleware/auth.ts (PIN-gate decorator)
  - server/src/middleware/permission.ts (new keys: hr.*, audit.*, pin.*)
dudhhisaab_reuse:
  - src/services/auth-pin/* (15 files — verbatim-adapt for #140; strip dairy nothing — these are auth-domain pure)
  - src/constants/pin-auth.constants.ts (lockout policy SSOT — adopt verbatim)
  - src/services/auth-pin/turnstile-gate.service.ts (Cloudflare Turnstile after N failures across IPs)
  - src/jobs/pin-gc.job.ts (PIN lockout + device retention GC — DPDP §8(7) compliance)
---

# SCOPE — Phase 6: Staff & HR (6 features)

> **Phase 5 SHIPPED** (Epic A/B/C/D — merge `63ccef4`, 133/150). Phase 6
> closes 6 of the 17 remaining features. After Phase 6 we are at **139/150**,
> with Phase 7 (AI & Differentiators, 8 remaining) the last build epic.

---

## Executive Summary

Phase 6 introduces **employees** as a managed entity (not just `BusinessUser`
membership rows), the **HR clock** that tracks attendance and converts to
payroll, the **payslip PDF** generated client-side, the **multi-firm
elevation** that promotes the existing business switcher to a first-class
session/UI concept with audit + revoke, the **advanced audit trail** that
upgrades the existing `AuditLog` table with diff view + PII redaction + search
+ retention policy, and the **transaction PIN** gate that protects sensitive
actions (delete invoice, void payment, payroll run, audit log view) using the
already-shipped `UserAppSettings.pinHash` extended with the DudhHisaab
lockout state machine (per-device 5/30min, per-phone 20/1h rolling).

**Success criteria (binary, testable):**

1. Raju marks his shop-boy Anil present, runs monthly payroll for him at
   Rs 15,000 with Rs 2,000 advance deducted, downloads/shares the PDF
   payslip on WhatsApp. End-to-end demo passes on a 320px Android phone.
2. Priya switches between her 3 firms ("Priya Wholesale", "Priya Retail",
   "Priya Online"). Each switch writes an audit row; data leaks are zero
   (verified by integration tests asserting `where: { businessId }` on
   every payroll/attendance/payslip query).
3. Amit opens audit trail, filters by "Manager Rajesh deleted invoices
   last week", sees a per-field diff (Rs 12,400 → DELETED), exports CSV.
4. Anyone trying to delete an invoice / void a payment / view audit log /
   run payroll without entering the 4-digit Transaction PIN is blocked
   with the standard PinPad sheet. Lockout after 5 wrong → 30 min device
   lock, 20 wrong/hour → 1 hour phone lock.

**Total backend file count estimate:** ~55 files. **Frontend:** ~75 files.
**Total est:** ~130 files — within architect's normal sizing band.

---

## 1. Personas — Which Features Are Critical for Each?

| Persona | #135 Attendance | #136 Payroll | #137 Slip | #138 Multi-firm | #139 Audit | #140 PIN |
|---------|-----------------|--------------|-----------|------------------|------------|----------|
| **Raju** (micro, 0-1 staff) | NICE_TO_HAVE | MUST_SHIP (1 staff) | MUST_SHIP | NICE_TO_HAVE (1 firm) | NICE_TO_HAVE | MUST_SHIP (shared phone) |
| **Priya** (growing, 2-5 staff) | MUST_SHIP | MUST_SHIP | MUST_SHIP | MUST_SHIP (3 firms) | MUST_SHIP | MUST_SHIP |
| **Amit** (distributor, 5-20 staff) | MUST_SHIP | MUST_SHIP | MUST_SHIP | MUST_SHIP (multi-location = multi-firm) | MUST_SHIP | MUST_SHIP (multi-role staff) |

**Implication:** Every feature must work for a 1-staff business (Raju) up to
a 20-staff business (Amit). No per-firm minimum, no "team plan" gating.

---

## 2. Schema Audit — What Already Exists

Critical to avoid greenfield duplication. Findings:

### #135 Staff Attendance — schema gap
- **`Employee` model:** **NONE.** Staff identity today = `BusinessUser`
  (userId + businessId + roleId). Employees are humans the business pays,
  who may not have a HisaabPro login (delivery boy, helper, accountant).
  → New `Employee` model REQUIRED, with optional `userId` link.
- **`Attendance` / `AttendanceShift`:** NONE. New tables.

### #136 Payroll — schema gap
- **`Payroll` / `PayrollRun` / `PayrollAdvance`:** NONE. New tables.
- **`PaymentLedger`-style accrual:** already exists for commission
  (`CommissionLedger`, Epic D). Pattern to mirror.

### #137 Salary Slips — schema gap
- **`PayslipDoc`:** NONE. PDF is generated client-side via `@react-pdf/renderer`
  (project default). Server stores a compact `PayslipSnapshot` (line items
  frozen for legal reproducibility) — not the PDF blob itself.

### #138 Multi-firm — **mostly exists already, this is elevation work**
- **`Business`** + **`BusinessUser`** + **`Role`**: shipped (PRD #9 #96-#102).
- **`User.lastActiveBusinessId`**: shipped (line 46-47 of schema).
- **JWT carries `businessId` claim**: shipped (`server/src/lib/jwt.ts:17`).
- **`POST /api/auth/switch-business`**: shipped
  (`server/src/routes/auth/switch-business.ts`) — blacklists old tokens,
  rotates cookies, logs to logger.
- **`<BusinessSwitcher>` bottom-sheet**: shipped
  (`src/features/business/components/BusinessSwitcher.tsx`).
- **`<AuthContext>` exposes `switchBusiness()` + `businesses[]`**: shipped.
- **Tenancy enforcement on every query**: SPOT-CHECKED below — already
  enforced via `req.user.businessId` in services.
- **What is MISSING for #138:** (a) `AuditLog` row written on every switch
  (currently only `logger.info`), (b) cross-business revoke list ("Sign
  out of all my businesses everywhere"), (c) Membership-revoke flow
  ("Priya was a partner in Amit's business but left — Amit needs an admin
  way to suspend Priya"), (d) bulletproof same-tenant precheck helper
  used CONSISTENTLY (an architect-level review of every Phase 1-5
  service to confirm `businessId` from `req.user`, not request body).

→ #138 = **elevation epic**, not a build. Schema delta is **1 column**
(`Business.invitationSlug`, optional, for shareable join links) **+ 1
column** (`BusinessUser.suspendedAt DateTime?`, optional, for revoke).
The bulk of #138 work is **architect-led review** + UI polish + audit
hooks.

### #139 Advanced Audit Trail — schema gap is small
- **`AuditLog`** table already exists (line 1579-1601 of schema).
- **`createAuditEntry()`** helper exists
  (`server/src/services/settings/audit.ts:45`).
- **`listAuditLog()`** with filtering (userId / entityType / action / date
  range / pagination) exists (line 8).
- **`<AuditLogPage>`** FE page exists (`src/features/settings/AuditLogPage.tsx`).
- **What's MISSING:** (a) diff view (`changes` JSON is written by some
  services but no UI renders before/after side-by-side), (b) PII redaction
  on `changes` (phone numbers, GSTIN, opening balance can leak to a
  user-with-audit-view permission who shouldn't see those fields), (c)
  search by entityLabel / entityId, (d) CSV export, (e) retention policy
  (90/180/365 days hot in Postgres + S3-cold archive — Phase 7 work, so
  Phase 6 ships the 180-day default + the archive HOOK, archive bucket
  itself is deferred), (f) **systematic backfill** — many existing
  services do NOT write audit rows on mutations (e.g. payroll won't have
  history without it). Phase 6 audits the 20 highest-leverage mutation
  sites and adds `createAuditEntry()` calls in the same `$transaction`.

### #140 Transaction PIN — schema gap is small
- **`UserAppSettings.pinHash` + `pinAttempts` + `pinLockedUntil`** exist
  (line 1697-1699 of schema).
- **`setPin` + `verifyPin`** services exist
  (`server/src/services/settings/pin.ts:10,33`).
- **`TransactionLockConfig.operationPinHash`** exists (business-level PIN
  for approval overrides — line 1548).
- **`<PinSetupPage>` + `<PinPad>`** FE exist (`src/features/settings/`).
- **What's MISSING:** (a) PIN-gate middleware (decorator that requires
  a fresh PIN verify within the last N minutes for sensitive routes),
  (b) DudhHisaab lockout policy port (per-device + per-phone + Turnstile
  escalation — current HP `verifyPin` only does per-user 5-attempts/30min,
  no per-phone / IP throttling), (c) `<PinGateSheet>` FE component that
  intercepts gated actions and pops the PinPad inline (today PIN is only
  on app-unlock), (d) audit row on every PIN verify success + failure +
  lockout (zero today), (e) **per-action grace period** — owner doesn't
  re-enter PIN for every delete in a session; one verify is good for the
  next N minutes per route-class (delete-invoice, void-payment,
  view-audit-log, run-payroll all get their own grace timer).

---

## 3. Goals (every line ends with a tier tag — blindspot #9 closure)

### #135 Staff Attendance

- **[MUST_SHIP]** New `Employee` model with optional `userId` link
  (a delivery boy doesn't need a HisaabPro account to be paid).
- **[MUST_SHIP]** Daily attendance with PRESENT / ABSENT / HALF_DAY /
  PAID_LEAVE / UNPAID_LEAVE / HOLIDAY status enum.
- **[MUST_SHIP]** Clock-in / clock-out timestamps on PRESENT days
  (computes `hoursWorked = clockOutAt - clockInAt`).
- **[MUST_SHIP]** Monthly grid view: rows = employees, cols = days of
  month, cells = status icon. Mobile-responsive (cards <md, grid ≥md).
- **[MUST_SHIP]** Manual override by manager — "mark Anil present even
  though he didn't clock in" with reason. Audit-logged.
- **[SHOULD_SHIP]** Geofence (optional per employee): if business config
  has `attendanceGeofence` set, clock-in compares device geolocation
  against business address + radius; mismatch → silent flag in audit,
  NOT a hard block (per blindspot #13 — distinguish detection from
  enforcement).
- **[SHOULD_SHIP]** Monthly attendance % computed (PRESENT + HALF_DAY*0.5
  + PAID_LEAVE) / WORKING_DAYS — surfaced on staff dashboard widget.
- **[NICE_TO_HAVE]** Per-employee shift schedules (Mon-Sat working,
  Sun off). MVP assumes 26-day month standard.
- **[FUTURE_EPIC]** Biometric / face-recognition attendance.
- **[FUTURE_EPIC]** Self-service "I'm working from home today" employee
  PWA. MVP is manager-driven entry.

### #136 Payroll

- **[MUST_SHIP]** `EmployeeSalaryComponent` — per-employee structure:
  basic, HRA, allowances (JSON), deductions (JSON), gross, net.
- **[MUST_SHIP]** Monthly `PayrollRun` per business → fans out to one
  `Payroll` row per employee. Idempotent: re-running for same month
  with same params returns 200 with `alreadyRun: true`, NEVER creates
  duplicate ledger rows (blindspot #5 / idempotency).
- **[MUST_SHIP]** Pro-rated salary based on attendance: 
  `netPaid = baseNet * (presentDays + halfDays*0.5 + paidLeave) / workingDays`.
- **[MUST_SHIP]** `EmployeeAdvance` — record advance/loan; auto-deducted
  from next payroll run; partial deductions across multiple runs supported.
- **[MUST_SHIP]** Payroll run requires Transaction PIN (#140 gate).
- **[MUST_SHIP]** Payroll generates a `Payment` ledger row (existing
  table) of type `PAYROLL_OUT` so the cash register and dashboards
  reflect the cash outflow.
- **[SHOULD_SHIP]** Payroll-month cycle pluggable (monthly / weekly /
  biweekly) but MVP ships MONTHLY only with the cycle enum scaffolded
  (blindspot #8 — schema-level future-proofing).
- **[SHOULD_SHIP]** "Skip this employee" toggle on the run preview
  screen (resigned mid-month, on leave, etc.).
- **[NICE_TO_HAVE]** PF / ESI deductions auto-computed. Hard-coded slabs
  are a regulatory liability (blindspot — they change). MVP exposes
  custom deduction lines only.
- **[FUTURE_EPIC]** Direct UPI / bank transfer payout via Razorpay
  RazorpayX. MVP records cash-paid + ticks "paid" manually.
- **[FUTURE_EPIC]** TDS computation + Form 16. Defer to Phase 7 GST
  expansion epic.

### #137 Salary Slips (PDF)

- **[MUST_SHIP]** `@react-pdf/renderer` per-employee slip with: business
  letterhead, employee name + ID, period (e.g. "May 2026"), gross,
  earnings table (basic / HRA / allowances), deductions table (PF / advance
  / leave), net, words-in-rupees, attendance % from #135, signature line.
- **[MUST_SHIP]** Share-WhatsApp button (existing `share-doc` utility).
- **[MUST_SHIP]** Server stores `PayslipSnapshot` (the structured data that
  PRODUCED the PDF) — never the PDF blob. Regenerating produces an
  identical PDF (legally important).
- **[SHOULD_SHIP]** Bulk download — owner exports all payslips for a
  month as one ZIP (client-side `jszip`).
- **[NICE_TO_HAVE]** Email payslip to employee (requires their email; MVP
  WhatsApp is enough).
- **[FUTURE_EPIC]** Digital signature (DigiLocker / e-signature).

### #138 Multi-firm Management

- **[MUST_SHIP]** Verify with architect-led code review that EVERY
  Phase 1-5 service scopes by `req.user.businessId` (NOT request body).
  This is the cross-tenant-leak audit. Output: `docs/TENANCY_AUDIT.md`.
- **[MUST_SHIP]** Audit log row written on every `POST
  /api/auth/switch-business` call (currently only `logger.info`). Action
  `BUSINESS_SWITCHED`, with `from` + `to` businessIds in `changes` JSON.
- **[MUST_SHIP]** Polish the existing `<BusinessSwitcher>`: show count
  badge on avatar ("3 firms"), role per firm, last active timestamp,
  "Suspended in this firm" badge for revoked memberships.
- **[MUST_SHIP]** Membership revoke flow — owner of Business B can
  suspend a `BusinessUser` row (sets `suspendedAt`). Suspended user's
  next `getMe` removes B from `businesses[]`. Audit-logged.
- **[MUST_SHIP]** "Sign out of all my businesses everywhere" button on
  Account settings — blacklists user globally (existing
  `blacklistUser` helper, used carefully to avoid the
  multi-device-logout footgun documented in
  `~/.claude/contexts/auth-patterns.md` line 76-78).
- **[SHOULD_SHIP]** First-class active-firm chip in the SideNav header
  (today the firm name lives only inside the bottom-sheet). Tap the
  chip → opens the switcher.
- **[NICE_TO_HAVE]** Firm-icon color theme tint on the app header
  ("Priya Retail" = pink rail, "Priya Online" = blue rail) so the
  active firm is unmistakable mid-task. Solves the "I just entered
  invoice in the wrong firm" mistake.
- **[FUTURE_EPIC]** Shared parties across firms (Priya's wholesale
  party `Asha Traders` also exists in Priya's retail firm). Today each
  firm has its own Party rows; merging is non-trivial because of
  outstandingBalance + payment history split. Defer.
- **[FUTURE_EPIC]** Per-firm subscription/plan (today the User's
  subscription covers ALL their firms — fine for MVP, may revisit).

### #139 Advanced Audit Trail

- **[MUST_SHIP]** Diff view UI — `changes` JSON rendered as `Field →
  Before → After` table with monospace fonts, additions in green,
  removals in red, value-changes in amber.
- **[MUST_SHIP]** PII redaction layer applied SERVER-SIDE based on
  caller's permission. A user with `audit.view` but no
  `fields.viewPartyPhone` sees `phone: ████` in the diff. A user
  with `audit.view_full` sees raw values. New permission key
  `audit.view_full` (audit-master role, owner default).
- **[MUST_SHIP]** Search by free-text — backend `tsvector` index on
  (entityLabel, reason, action) for full-text search; cursor pagination.
- **[MUST_SHIP]** Filter by user, entity type, action type, date range
  (already exists for filter; verify SSR matches the new search).
- **[MUST_SHIP]** **Audit coverage backfill** — every mutation in the
  20 highest-leverage services (Payroll-run, advance-create, party-edit,
  invoice-delete, payment-void, role-edit, settings-modify, business-switch,
  staff-invite, staff-suspend, pin-set, pin-reset, transaction-lock-edit,
  approval-respond, refund-create, document-share, recurring-pause,
  loyalty-program-edit, commission-rule-edit, posSale-void) MUST write
  an `AuditLog` row inside the same `$transaction` as the mutation.
  This is part of #139's "advanced" promise — without backfill, the
  trail has holes.
- **[MUST_SHIP]** CSV export — owner can download last-N-days as CSV
  for compliance / accountant. Audit-logged itself.
- **[SHOULD_SHIP]** Retention policy — hot 180 days in Postgres,
  archive script HOOK ready. Archive bucket (S3) is FUTURE_EPIC; the
  hook means we can flip a switch later without schema change.
- **[SHOULD_SHIP]** Per-row "Revert this change?" stub — UI affordance,
  server returns 501 NOT_IMPLEMENTED. Implementation is FUTURE_EPIC
  but the UI placeholder lets users know the feature is coming and
  surfaces support requests.
- **[FUTURE_EPIC]** Actual revert/rollback execution (hard — requires
  per-entity reversal logic).
- **[FUTURE_EPIC]** Tamper-evident chain (Merkle / hash-chain so a
  malicious admin can't silently delete rows). Today the table is
  append-only by convention (`@@no updatedAt`); cryptographic proof
  is a Phase 7+ compliance epic.

### #140 Transaction PIN

- **[MUST_SHIP]** Port DudhHisaab's `auth-pin` service tree
  (`/Users/sawanjaiswal/DudhHisaab/src/services/auth-pin/*`, 15 files)
  as `server/src/services/security-pin/*`. Adapt the schema to use
  the existing `UserAppSettings.pinHash` instead of `UserDevicePin`
  for MVP (per-user PIN, not per-device — Q4 default below).
- **[MUST_SHIP]** Lockout policy SSOT — `server/src/constants/pin-auth.constants.ts`
  ported verbatim from DH (`PIN_VERIFY_DEVICE_MAX_ATTEMPTS=5`,
  `PIN_VERIFY_DEVICE_LOCKOUT_MS=30min`, `PIN_PHONE_LOCKOUT_THRESHOLD=20`,
  `PIN_PHONE_LOCKOUT_WINDOW_MS=1h`, `PIN_PHONE_LOCKOUT_MS=1h`).
- **[MUST_SHIP]** New table `PinPhoneLockout` (port DH model verbatim:
  phone + windowStart + failCount + lockedUntil + createdAt + updatedAt)
  with daily GC retaining 48h (DPDP §8(7) — DH constant `PIN_GC_LOCKOUT_RETENTION_MS`).
- **[MUST_SHIP]** PIN-gate middleware
  `requireRecentPin(routeClass: string, graceMinutes = 5)` — checks
  `req.session.pinVerifiedAt[routeClass]`; if missing or > N min ago,
  returns 401 with `code: PIN_REQUIRED, routeClass`. FE intercepts and
  shows `<PinGateSheet>` inline. Per-route-class grace timer prevents
  PIN-fatigue (one verify covers all deletes in a 5-min window).
- **[MUST_SHIP]** Sensitive route gating — applied to: delete invoice,
  void payment, delete payment, payroll-run, audit-log view (#139),
  audit-log CSV export, role-permissions edit, transaction-lock edit,
  Business suspend/delete, account-recovery (existing).
- **[MUST_SHIP]** `<PinGateSheet>` FE component (Drawer with PinPad,
  forwards retry until verify succeeds, calls original mutation on
  success, dismisses on cancel).
- **[MUST_SHIP]** Audit row on every PIN verify success + failure +
  lockout (`action: PIN_VERIFY_SUCCESS | PIN_VERIFY_FAILED | PIN_LOCKED`).
  Cross-cuts #139.
- **[SHOULD_SHIP]** Cloudflare Turnstile escalation after 3 distinct-IP
  failures in 5 min — port DH `turnstile-gate.service.ts`. (DH
  constant `TURNSTILE_FAIL_THRESHOLD=3`, `TURNSTILE_FAIL_WINDOW_MS=5min`.)
  Requires Turnstile keys in env; off by default if unset, on if set.
- **[SHOULD_SHIP]** PIN reset flow — OTP to user's phone → server
  issues a single-use reset token (TTL 10 min, DH constant
  `PIN_RESET_TOKEN_TTL_MS`) → client re-runs PinSetup. Audit-logged.
- **[NICE_TO_HAVE]** Biometric unlock for the gate (already exists on
  PinSetup for app-unlock — extend to inline gate). Capacitor
  `BiometricAuth` plugin.
- **[FUTURE_EPIC]** Per-business operation PIN (`operationPinHash` on
  TransactionLockConfig already exists for approval-override use; we
  keep that as a separate flow with its own SCOPE).
- **[FUTURE_EPIC]** Hardware-key (WebAuthn) gate. WebAuthn infra ships
  in HP already (`webauthn.service.ts`) but tying it to the
  Transaction PIN gate is a v2 polish.

---

## 4. In Scope — Per-Feature Details

### #135 Staff Attendance

**User story (Priya):** "It's 1st of June. I open Attendance, see the
May grid, mark Anil PRESENT for 24 days, HALF_DAY for 2, ABSENT for 1.
I tap Run Payroll and the calculation pulls these days automatically."

**Acceptance criteria (mobile):**
- Monthly grid renders in <500ms on a 5-employee × 30-day matrix at 375px
- Tap a cell → 4-button status picker (P / A / HD / L) with icon-only
  buttons (≥44px touch target)
- Long-press a cell → reason picker for manager override
- Geofence-flagged days show a small amber dot (silent flag, not block)
- 320px: grid scrolls horizontally with sticky employee-name column
- Loading / Error / Empty / Success states all visible at 320px

**Acceptance criteria (desktop ≥md):**
- Full grid visible without horizontal scroll for ≤30 employees
- Keyboard nav: arrow keys move between cells, space cycles status
- Bulk-select column → mark range PRESENT

**Data shape sketch (additive to existing schema):**
```prisma
model Employee {
  id              String    @id @default(cuid())
  businessId      String
  userId          String?   // optional link to HisaabPro user
  name            String
  phone           String?
  designation     String?
  joinedAt        DateTime
  resignedAt      DateTime?
  isActive        Boolean   @default(true)
  // Comp structure — JSON for forward-compat (PF/ESI slabs etc.)
  baseSalaryPaise Int       // monthly gross in paise
  components      Json      @default("{}")  // {hra, allowances[], deductions[]}
  // Attendance config
  workingDaysPerMonth Int   @default(26)
  geofenceEnabled     Boolean @default(false)
  geofenceLat         Decimal? @db.Decimal(10, 6)
  geofenceLng         Decimal? @db.Decimal(10, 6)
  geofenceRadiusM     Int?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  user     User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  attendances Attendance[]
  payrolls    Payroll[]
  advances    EmployeeAdvance[]
  @@unique([businessId, phone])
  @@index([businessId, isActive])
}

model Attendance {
  id             String   @id @default(cuid())
  businessId     String
  employeeId     String
  date           DateTime @db.Date          // YYYY-MM-DD only
  status         String   @db.VarChar(20)   // PRESENT|ABSENT|HALF_DAY|PAID_LEAVE|UNPAID_LEAVE|HOLIDAY
  clockInAt      DateTime?
  clockOutAt     DateTime?
  hoursWorked    Decimal? @db.Decimal(4, 2)
  geofenceFlag   Boolean  @default(false)   // soft-flag, not block
  overrideById   String?                    // userId who overrode
  overrideReason String?  @db.VarChar(200)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  @@unique([businessId, employeeId, date])
  @@index([businessId, date])
}
```

**Key endpoints:**
- `GET /api/employees?cursor=&limit=&isActive=` (parties.view-like)
- `POST /api/employees` (settings.manageStaff)
- `PATCH /api/employees/:id` (settings.manageStaff)
- `DELETE /api/employees/:id` (soft-delete via isActive=false) (settings.manageStaff + PIN GATE)
- `GET /api/attendance?employeeId=&fromDate=&toDate=` (hr.view)
- `PUT /api/attendance/:employeeId/:date` (hr.attendance.write)
- `POST /api/attendance/clock-in` (hr.attendance.write, employee self-service if userId match)
- `POST /api/attendance/clock-out` (same)

**FE pages affected:**
- New: `/hr/employees` (list), `/hr/employees/:id` (detail + payroll history),
  `/hr/attendance` (grid)
- Edited: SideNav adds "HR" section. Dashboard staff widget extended.

---

### #136 Payroll

**User story (Amit):** "End of May. I open Payroll, see all 12 employees
with computed gross (based on May attendance + advances). I click 'Run
Payroll for May 2026', enter Transaction PIN, the system writes 12
Payroll rows + 12 Payment rows (PAYROLL_OUT) + 12 PayslipSnapshots.
Cash register shows -Rs 1,80,000 outflow."

**Acceptance criteria:**
- Payroll-run is idempotent — second click with same params → 200 with
  `alreadyRun: true` + same `runId`; no duplicate ledger
- Pro-ration formula visible in the preview row: "26 working days × Rs
  15,000 / 26 = Rs 15,000 base. Present 24 + halfDay 2 = 25 → Rs 14,423"
- Advance auto-deducted: if Anil has outstanding Rs 5,000 advance, payroll
  preview shows -Rs 5,000 line, advance balance decremented by 5,000
- Transaction PIN required to RUN; not required to PREVIEW
- Lock-after-run: a finalized payroll is immutable; revisions require
  Approval (existing ApprovalRequest infra)

**Data shape sketch:**
```prisma
model PayrollRun {
  id              String   @id @default(cuid())
  businessId      String
  periodYearMonth String   @db.VarChar(7)  // "2026-05"
  cycle           String   @db.VarChar(20) @default("MONTHLY")  // enum scaffold
  workingDays     Int                       // snapshot at run time
  status          String   @db.VarChar(20) @default("DRAFT")    // DRAFT|FINALIZED|REVERSED
  runBy           String                    // userId
  runAt           DateTime?
  totalGrossPaise Int      @default(0)
  totalNetPaise   Int      @default(0)
  totalAdvancesPaise Int   @default(0)
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  business Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  payrolls Payroll[]
  @@unique([businessId, periodYearMonth, cycle])   // idempotency anchor
  @@index([businessId, runAt])
}

model Payroll {
  id              String   @id @default(cuid())
  businessId      String
  runId           String
  employeeId      String
  // Snapshot from Employee at run time (immutable)
  baseSalaryPaise Int
  componentsSnapshot Json
  // Computed
  workingDays     Int
  presentEquivalent Decimal @db.Decimal(5, 2)   // present + halfDay*0.5 + paidLeave
  grossPaise      Int
  earningsBreakdown Json    // {basic, hra, allowances[], leaveEncashment}
  deductionsBreakdown Json  // {pfStub, esiStub, advancesApplied[], custom[]}
  advancesAppliedPaise Int  @default(0)
  netPaise        Int
  paidAt          DateTime?
  paymentId       String?   // FK to Payment ledger row (PAYROLL_OUT)
  payslipId       String?   // FK to PayslipSnapshot
  createdAt       DateTime @default(now())
  business Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  run      PayrollRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  employee Employee   @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  @@unique([runId, employeeId])
  @@index([businessId, employeeId, createdAt])
  @@index([businessId, periodYearMonth])  // see migration: derive via runId join in v1
}

model EmployeeAdvance {
  id              String   @id @default(cuid())
  businessId      String
  employeeId      String
  amountPaise     Int                   // positive on grant
  appliedPaise    Int      @default(0)  // running total deducted via payrolls
  status          String   @db.VarChar(20) @default("OPEN")   // OPEN|CLOSED|WRITTEN_OFF
  grantedAt       DateTime @default(now())
  grantedBy       String                // userId
  closedAt        DateTime?
  notes           String?
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  @@index([businessId, employeeId, status])
}
```

**Key endpoints:**
- `GET /api/payroll/runs?cursor=&limit=` (hr.payroll.view)
- `POST /api/payroll/runs/preview` (hr.payroll.view) — pure compute, no writes
- `POST /api/payroll/runs` (hr.payroll.run + PIN GATE) — idempotent via `@@unique`
- `POST /api/payroll/runs/:id/reverse` (hr.payroll.run + PIN GATE + Approval)
- `GET /api/payroll/:id` (hr.payroll.view)
- `GET /api/payroll/employee/:employeeId/history` (hr.payroll.view OR self)
- `POST /api/advances` (hr.advance.write + PIN GATE)
- `GET /api/advances?employeeId=` (hr.advance.view)
- `PATCH /api/advances/:id` (hr.advance.write)

**FE pages affected:**
- New: `/hr/payroll` (list runs), `/hr/payroll/runs/:id` (run detail with
  per-employee rows + reverse action), `/hr/payroll/new` (run wizard:
  preview → PIN → confirm), `/hr/advances` (advance log)
- Dashboard staff widget: "This month's payroll: Rs 1,80,000 across 12
  staff" tile (owner only).

---

### #137 Salary Slips

**User story (Raju):** "After running payroll, I tap on Anil's row, see
his payslip PDF preview, tap Share-WhatsApp, choose his contact, send."

**Acceptance criteria:**
- PDF generates in <2s on mid-Android (entry-level phone)
- Layout: business header with logo + name + address, employee block
  (name + designation + employee code), period block, earnings table,
  deductions table, net (bold), words-in-rupees (`numberToWords()`),
  attendance summary (present X / working Y → Z%), signature line
- Mobile: PDF preview is full-screen sheet with Share button at bottom
- Server-side `PayslipSnapshot` is the SSOT — regen produces byte-stable
  PDF (deterministic fonts, no current-time stamps in body)

**Data shape sketch:**
```prisma
model PayslipSnapshot {
  id              String   @id @default(cuid())
  businessId      String
  payrollId       String   @unique
  employeeId      String
  periodYearMonth String   @db.VarChar(7)
  // Frozen snapshot — never reflects later edits to Employee
  businessNameSnapshot   String
  businessLogoUrlSnapshot String?
  employeeNameSnapshot   String
  employeeCodeSnapshot   String?
  designationSnapshot    String?
  // Money breakdown (paise)
  earnings Json   // [{label, paise}]
  deductions Json // [{label, paise}]
  grossPaise Int
  netPaise   Int
  attendanceSummary Json // {workingDays, presentEquivalent, attendancePct}
  generatedAt DateTime @default(now())
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  payroll  Payroll  @relation(fields: [payrollId], references: [id], onDelete: Cascade)
  @@index([businessId, employeeId, periodYearMonth])
}
```

**Key endpoints:**
- `GET /api/payslips/:payrollId` (hr.payroll.view OR self) — returns PayslipSnapshot
- `POST /api/payslips/:payrollId/share-log` (hr.payroll.view) — records that
  the employee was sent the slip (mirrors DocumentShareLog pattern)

**FE pages affected:**
- New: `<PayslipDocument>` react-pdf component (~200L), `<PayslipPreviewSheet>`
- Reuses existing `share-doc` utility (WhatsApp / email / native share)

---

### #138 Multi-firm Management

**User story (Priya):** "I tap my avatar → see my 3 firms with their roles.
Tap Priya Retail → fast switch (<1s including JWT rotation). The header
chip now reads 'Priya Retail' with a pink tint. The Audit log on the
previous firm shows 'Priya switched away at 10:30 AM'."

**Acceptance criteria:**
- Switch latency p95 < 1.5s (includes blacklist, rotate, re-fetch /me)
- Switching writes an AuditLog row in BOTH businesses (one for "switched
  out of" and one for "switched into")
- The active-firm chip in SideNav header is keyboard-focusable and screen-reader
  announces "Active firm: Priya Retail. Tap to switch."
- Suspended `BusinessUser` rows disappear from `businesses[]` immediately
  on next `/me`
- Cross-tenant audit: 100% of Phase 1-5 mutation endpoints verified to
  use `req.user.businessId` not body-supplied (architect deliverable)

**Data shape sketch (delta only — most exists):**
```prisma
// Additive: BusinessUser
model BusinessUser {
  // ... existing ...
  suspendedAt   DateTime?
  suspendedById String?       // who suspended this membership
  suspendedReason String?
  @@index([businessId, suspendedAt])
}
```

**Key endpoints:**
- `POST /api/auth/switch-business` (already shipped — add audit row + AuditLog
  side-effect)
- `POST /api/businesses/:id/members/:userId/suspend` (settings.manageStaff
  + PIN GATE)
- `POST /api/businesses/:id/members/:userId/reactivate` (settings.manageStaff
  + PIN GATE)
- `POST /api/auth/logout-all` (already shipped via `blacklistUser`; surface
  in UI)

**FE pages affected:**
- `<BusinessSwitcher>` (edit) — show suspended badges, count
- `<SideNav>` (edit) — active-firm chip in header
- New: `/settings/team` — staff list with suspend/reactivate (per firm)
- New: `<TenantChip>` primitive component for header (color tint per firm)

---

### #139 Advanced Audit Trail

**User story (Amit):** "I open Audit → search 'invoice deleted' →
filter user=Rajesh → date=last week. I see 3 rows. Click one →
diff view shows `total: Rs 12,400 → DELETED, party: Asha Traders`.
I export the week as CSV for my accountant."

**Acceptance criteria:**
- Search latency p95 < 400ms at 100k audit rows per business (composite
  GIN index on tsvector)
- Diff view UI renders before/after side-by-side with monospace fonts;
  added fields green, removed red, changed amber
- PII redaction works server-side: a user with `audit.view` but no
  `fields.viewPartyPhone` gets `"phone": "████"` in `changes`
- CSV export honours redaction and is itself audit-logged
- 20 highest-leverage mutation sites have backfill PRs to write audit rows
  inside their existing `$transaction`s (gap analysis in §10 file plan)

**Data shape sketch (delta only):**
```prisma
model AuditLog {
  // ... existing ...
  searchVector Unsupported("tsvector")?  // GIN-indexed full-text
  redactedFields String[] @default([])    // server tags fields it redacted before write (so the same caller's diff is consistent over time)
  @@index([searchVector], type: Gin, map: "idx_audit_log_search_vec")
}
```

**Key endpoints (additions):**
- `GET /api/audit-log/search?q=&user=&entity=&action=&from=&to=&cursor=` (audit.view + PIN GATE)
- `GET /api/audit-log/:id` (audit.view + PIN GATE) — returns full diff + redaction-aware
- `POST /api/audit-log/export` (audit.view_full + PIN GATE) — kicks off CSV generation, returns download URL

**FE pages affected:**
- `<AuditLogPage>` (edit) — add search bar + diff view drawer
- New: `<AuditDiffView>` component, `<AuditExportSheet>` component

---

### #140 Transaction PIN

**User story (Raju):** "I tap Delete on an invoice. The PinPad sheet
slides up. I enter 4123. The invoice deletes. Next delete in the same
5-minute window doesn't ask again."

**Acceptance criteria:**
- PinPad sheet enforces a 4-digit (length configurable to 6) numeric PIN
- Lockout policy matches DH (per-device 5/30min, per-phone 20/1h rolling)
- Grace timer is per-route-class (delete-invoice / void-payment /
  view-audit / run-payroll all separate); configurable via constants
- PinGate failures are audit-logged
- Setup flow exists for first-time users; reset via phone-OTP (existing
  OTP infra, MSG91)
- 320px PinPad keypad is fully usable (44px touch targets)
- Cloudflare Turnstile gate triggers after 3 distinct-IP failures in 5min
  (when env keys set; off by default)

**Data shape sketch (delta — mostly DH port):**
```prisma
model PinPhoneLockout {
  id           String   @id @default(cuid())
  phone        String
  windowStart  DateTime @default(now())
  failCount    Int      @default(0)
  lockedUntil  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([phone, windowStart])
  @@index([lockedUntil])  // GC cron scan
}

model PinResetToken {
  id          String   @id @default(cuid())
  userId      String
  tokenHash   String   @unique          // SHA-256 of single-use token
  consumedAt  DateTime?
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  ipAddress   String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([expiresAt])  // GC scan
}
```

**Key endpoints:**
- `POST /api/pin-gate/verify` (auth) — body: `{routeClass, pin, turnstileToken?}`
- `GET /api/pin-gate/status?routeClass=` (auth) — `{requiresPin, lockedUntil?, graceExpiresAt?}`
- `POST /api/pin-gate/reset/request` (auth) — sends OTP to user's phone
- `POST /api/pin-gate/reset/verify` (auth) — verifies OTP, returns reset token
- `POST /api/pin-gate/reset/finalize` (auth) — body: `{resetToken, newPin}`

**FE pages affected:**
- New: `<PinGateSheet>` Drawer
- New: `<PinResetDrawer>` (OTP → new PIN)
- Edited: `<DeleteInvoiceButton>`, `<VoidPaymentButton>`, `<AuditLogPage>`,
  `<PayrollRunButton>` — each wraps action in `withPinGate(routeClass, fn)`
- Edited: `<SettingsSecurityPage>` — add "Transaction PIN" section + reset

---

## 5. Out of Scope (Future Epic) — tier-tagged

- **Biometric / face-recognition attendance** **[FUTURE_EPIC]** — needs
  device camera + ML model + GDPR/DPDP biometric consent flow
- **Employee self-service mobile app** **[FUTURE_EPIC]** — separate
  Capacitor app or expanded PWA scope
- **Advanced payroll tax slabs (PF / ESI / TDS auto-compute)**
  **[FUTURE_EPIC]** — slabs change yearly; regulatory liability; ship
  custom-deduction-lines instead
- **Direct UPI / bank transfer payroll payout** **[FUTURE_EPIC]** —
  Razorpay RazorpayX integration is its own SCOPE
- **Form 16 / Form 24Q generation** **[FUTURE_EPIC]** — Phase 7 GST
  expansion epic
- **Shared parties across firms** **[FUTURE_EPIC]** — non-trivial
  outstandingBalance merge
- **Per-firm subscription/plan** **[FUTURE_EPIC]** — today User-level plan
  covers all firms
- **Audit-trail revert/rollback execution** **[FUTURE_EPIC]** — per-entity
  reversal logic is large
- **Tamper-evident audit chain (Merkle hash)** **[FUTURE_EPIC]** —
  compliance epic post-ISO 27001
- **Full ISO 27001 audit retention** **[FUTURE_EPIC]** — 7-year archive
  with cold-storage; Phase 6 ships 180-day hot + archive hook only
- **S3 archive bucket** **[FUTURE_EPIC]** — Phase 7 ops epic
- **Per-business operation PIN replacing approval overrides**
  **[FUTURE_EPIC]** — different gate, different SCOPE
- **WebAuthn / hardware-key transaction gate** **[FUTURE_EPIC]** — infra
  exists, wiring is a v2 polish
- **Per-employee shift schedules + overtime rules** **[NICE_TO_HAVE]**
- **Bulk-import employees from CSV** **[NICE_TO_HAVE]** — manual create
  for MVP
- **Annual leave-balance carry-forward** **[FUTURE_EPIC]** — yearly cycle
- **PayslipDoc email (vs WhatsApp only)** **[NICE_TO_HAVE]** — WhatsApp
  is the Indian standard

---

## 6. Cross-Cutting Concerns

### 6.1 Translations (EN + HI parity)

Three new namespaces, mirroring Epic D convention:

| Namespace | Feature | Est. key count | Files |
|-----------|---------|----------------|-------|
| `ext41.hr.*` | #135 + #136 + #137 | ~120 | `src/lib/translations.{en,hi}.ext41.ts` |
| `ext42.firm.*` | #138 elevation | ~35 | `src/lib/translations.{en,hi}.ext42.ts` |
| `ext43.audit.*` | #139 advanced trail | ~55 | `src/lib/translations.{en,hi}.ext43.ts` |
| `ext44.pin.*` | #140 transaction PIN | ~45 | `src/lib/translations.{en,hi}.ext44.ts` |

**Total ~255 keys**, EN ↔ HI 1:1 enforced by `scripts/check-translations.mjs`.

### 6.2 Offline Support (per `.claude/rules/OFFLINE_RULES.md`)

| Operation | Offline behaviour |
|-----------|-------------------|
| Mark attendance (manager grid) | Queued via `entityType: 'attendance'`, `entityLabel: '<employee> <YYYY-MM-DD>'` |
| Clock-in / out (self-service) | Queued; server reconciles on flush (last-write-wins by clientTimestamp) |
| Create / edit employee | Queued; `entityType: 'employee'` |
| Run payroll | **ONLINE-ONLY** — refuses if `!navigator.onLine` (mirrors POS checkout pattern). Money-out flow MUST be authoritative. |
| Create advance | Queued; `entityType: 'advance'` |
| Generate payslip PDF | Works offline IF the Payroll row is cached (read with `cacheReads: true`) |
| Switch firm | **ONLINE-ONLY** — JWT rotation requires server. UI shows "Internet required to switch firm." |
| Audit-log search | Network-only (PII surface — no cache) |
| Audit-log diff view | Cacheable per-row (already-redacted) for last-viewed only |
| PIN verify | **ONLINE-ONLY** — server-side lockout state matters |
| PIN setup | Online-only |

**Reads cached** (`cacheReads: true`): employee list, employee detail,
attendance month grid, payroll run list, payroll detail (own employee only).

**Reads NOT cached**: all audit queries, all PIN-status queries, all
cross-tenant queries.

### 6.3 File-Plan Layers — 6-layer Backend, 7-layer Frontend

| Backend layer | Phase 6 example files |
|---------------|----------------------|
| **types** | `server/src/types/hr.types.ts`, `audit-advanced.types.ts`, `pin-gate.types.ts` |
| **constants** | `server/src/constants/pin-auth.constants.ts` (DH port), `hr.constants.ts` (status enums, working-days defaults) |
| **schemas (Zod)** | `server/src/schemas/employee.schemas.ts`, `attendance.schemas.ts`, `payroll.schemas.ts`, `pin-gate.schemas.ts` |
| **utils (pure)** | `server/src/utils/payroll-pro-rate.util.ts`, `attendance-pct.util.ts`, `audit-redact.util.ts` (PII redaction is pure) |
| **service** | `server/src/services/hr/*` (8 files), `security-pin/*` (8 files DH-ported), `audit-advanced/*` (5 files) |
| **route** | `server/src/routes/hr.routes.ts`, `pin-gate.routes.ts`, `audit-advanced.routes.ts` |

| Frontend layer | Phase 6 example files |
|----------------|----------------------|
| **types** | `src/features/hr/hr.types.ts`, `pin/pin.types.ts`, `audit/audit.types.ts` |
| **constants** | display labels, status colour maps |
| **utils** | display formatters for attendance % |
| **hooks** | `useEmployees`, `useAttendanceGrid`, `usePayrollRuns`, `usePinGate`, `useAuditSearch` |
| **sub-components** | `<AttendanceCell>`, `<PayslipDocument>`, `<PinGateSheet>`, `<AuditDiffView>`, `<TenantChip>` |
| **page** | `/hr/employees`, `/hr/attendance`, `/hr/payroll`, `/settings/team`, plus edits to existing pages |
| **css** | `src/styles/components.hr.css`, `components.audit.css`, `components.pin-gate.css` |

Every row ≤ 250L. Architect will materialise the full File Plan table.

### 6.4 Permission Model — NEW keys + role assignments

PR1 of Phase 6 adds these keys to `server/src/services/settings/permissions-data.ts`:

```ts
// === HR (Phase 6 #135 #136 #137) ===
{
  key: 'hr', label: 'HR (Staff & Payroll)',
  actions: [
    { key: 'view',             label: 'View Employees & Attendance' },
    { key: 'employee.write',   label: 'Create / Edit / Delete Employees' },
    { key: 'attendance.write', label: 'Mark Attendance (Manager Override)' },
    { key: 'attendance.self',  label: 'Clock In / Out (Self Only)' },
    { key: 'payroll.view',     label: 'View Payroll Runs & History' },
    { key: 'payroll.run',      label: 'Run Payroll (Requires Transaction PIN)' },
    { key: 'advance.view',     label: 'View Employee Advances' },
    { key: 'advance.write',    label: 'Grant / Adjust Advances (Requires Transaction PIN)' },
  ],
},

// === Audit Trail (Phase 6 #139) ===
{
  key: 'audit', label: 'Audit Trail',
  actions: [
    { key: 'view',      label: 'View Audit Log (PII Redacted by Default)' },
    { key: 'view_full', label: 'View Audit Log with Full PII (Owner)' },
    { key: 'export',    label: 'Export Audit Log CSV' },
  ],
},
```

**Default role assignments:**
- Owner: ALL hr.*, audit.*, audit.view_full
- Manager: hr.view, hr.attendance.write, hr.payroll.view, hr.advance.view,
  audit.view (redacted)
- Accountant: hr.payroll.view (read-only for reconciliation), audit.view
  (redacted)
- Cashier / Salesman / Stock Manager / Delivery Boy: hr.attendance.self
  ONLY (clock-in for themselves if linked to an Employee record)

### 6.5 Session / Token Shape — does #138 force a JWT change?

**Default: NO.** The JWT already carries `businessId` (line 17 of
`server/src/lib/jwt.ts`). The existing `POST /api/auth/switch-business`
issues a NEW token pair with the new `businessId` and blacklists the
old. This is correct.

**Phase 6 deltas to JWT (rejected — too risky):**
- ~~Add `firms[]` claim listing all the user's businesses~~ — REJECTED,
  bloats every request, and `/me` already provides this
- ~~Add `pinVerifiedAt` claim per route-class~~ — REJECTED, claims are
  immutable for token lifetime; PIN grace is dynamic. Use server-side
  session map keyed by `userId + routeClass`.

**Phase 6 deltas to JWT (accepted):**
- **None.** Keep `TokenPayload` shape stable. PIN grace lives in
  `req.session.pinVerifiedAt` (express-session, already used). All
  multi-firm work stays on the existing claim.

This decision means **#138 does NOT trigger the token-shape change rule**
in CLAUDE.md (line 181). Still triggers `User` model rule (#138 adds 0
User columns; #136 adds 0 User columns; #140 adds 0 User columns; #135
adds 0 User columns — therefore no User mutation Phase 6 either!). The
high-risk path triggers come solely from `schema.prisma` (8 new models),
`auth.service.ts` edits (audit row on switch), and the
`audit*.ts` services + permission.ts edits.

---

## 7. Risks + Mitigations

### Risk A01 — Cross-tenant data leak via #138

**Scenario:** A bug in a Phase 1-5 service uses `req.body.businessId`
instead of `req.user.businessId`. A malicious user with multi-firm
membership crafts a request claiming firm B while authenticated for
firm A and reads firm B's data without being a member.

**Mitigation:**
1. **architect-led code review** of every Phase 1-5 service for the
   `where: { businessId: ... }` pattern. Output `docs/TENANCY_AUDIT.md`
   in Phase 6 PR0.
2. **`assertBusinessMatch(req, requestedBusinessId)` helper** in
   `server/src/lib/assert-business-match.ts` (already exists — verify
   used everywhere).
3. **ESLint rule** added to `scripts/enforce.js`: any service file
   referencing `req.body.businessId` is flagged.
4. **Integration test per service**: "request firm B's invoice while
   authenticated for firm A → expect 403". Codified in
   `server/src/__tests__/cross-tenant/*`.
5. **PIN GATE on suspend/reactivate** prevents accidental membership
   self-grant.

### Risk A07 — PIN bypass via #140

**Scenario:** Engineer ships a sensitive route forgetting the
`requireRecentPin()` middleware. Or: the PinGateSheet allows the user
to bypass by closing the drawer and re-submitting the original
mutation without the gate header (`x-pin-verified-at`).

**Mitigation:**
1. **Server is authoritative** — `requireRecentPin` reads from the
   session map (`req.session.pinVerifiedAt[routeClass]`), NEVER from
   a client header. Client cannot lie.
2. **ESLint rule**: any route mounted under `/api/payroll/*`,
   `/api/audit-log/*`, or matching `/delete|void|suspend/` regex MUST
   include `requireRecentPin` in its middleware chain. Enforced via
   AST scan in `scripts/enforce-pin-gate.mjs`.
3. **Lockout policy** (DH-ported) caps the brute-force surface.
4. **Audit row** on every verify success/fail/lockout — anomaly detection.
5. **Per-route-class grace** prevents PIN-fatigue → users disabling PIN
   entirely.

### Risk A09 — Audit-log gap during #139 hot path

**Scenario:** New audit-coverage backfill PR introduces a bug — payroll
run double-writes an audit row (one in the route, one in the service)
OR misses the row when the route throws inside the `$transaction`.

**Mitigation:**
1. **Audit row INSIDE the `$transaction`** for every service-level write
   (mirrors Epic D pattern from `services/loyalty/loyalty-accrual.service.ts`).
   Throw → rollback → no audit row written → no false trail.
2. **One write site per action** — route handlers never call
   `createAuditEntry` directly; only service-layer functions do.
3. **Integration test per backfilled service**: "mutation succeeds →
   audit row exists; mutation fails → no audit row".
4. **Audit-coverage report**: `scripts/audit-coverage.mjs` lists every
   service mutation function and whether it calls `createAuditEntry`.
   Pre-commit fails if a NEW service file appears without the call.

### Risk N1 — Geofence-on-attendance privacy + DPDP

**Scenario:** Geofencing requires GPS coordinates from employee device.
Indian DPDP Act 2023 §6 requires explicit consent for personal data
processing.

**Mitigation:**
1. Geofence DEFAULTS OFF per-employee. Owner must enable per-employee
   with a consent acknowledgement screen.
2. Clock-in payload sends `{lat, lng}` only when geofenceEnabled=true.
3. Coordinates stored in `Attendance.geofenceFlag` ONLY (boolean — was
   the device inside the radius?), NOT raw coords. Raw coords are
   compared in-memory and discarded.
4. Privacy notice in employee-onboarding flow when geofence toggled on.

### Risk N2 — Payroll computation drift across migrations

**Scenario:** A future migration changes `Employee.componentsSnapshot`
shape. Old `Payroll` rows reference the old shape; payslip
regeneration breaks.

**Mitigation:**
1. `Payroll` and `PayslipSnapshot` store IMMUTABLE snapshots of comp at
   run time — never reach back to `Employee` for display fields.
2. `componentsSnapshot` is `Json` (not Prisma-typed) — schema evolution
   is content-typed via a `_version` field inside the JSON.
3. Payslip render code branches on `componentsSnapshot._version`.

---

## 8. Migration Impact

### New tables (8)

1. `Employee`
2. `Attendance`
3. `EmployeeAdvance`
4. `PayrollRun`
5. `Payroll`
6. `PayslipSnapshot`
7. `PinPhoneLockout` (DH port)
8. `PinResetToken` (DH port)

### Modified tables (1 + 1)

- `BusinessUser`: + `suspendedAt`, `suspendedById`, `suspendedReason` (all nullable, additive only)
- `AuditLog`: + `searchVector` (`Unsupported("tsvector")`), `redactedFields String[]` (default `[]`)

### No User model changes

Per §6.5 design decision, Phase 6 does not modify `User`. This is a
deliberate constraint — the existing `User.pinHash` (line 19) +
`UserAppSettings.pinHash` (line 1697) are the PIN homes; #140 adds
lockout side-tables (`PinPhoneLockout`) but not User columns.

### Migration ordering

**Per `.claude/rules/PRISMA_MIGRATION_RULES.md`:**

1. **PR1 (perms + types):** add permission keys + Zod schemas + types.
   No schema migration.
2. **PR2 (schema add):** `npx prisma migrate dev --name phase6_hr_pin_audit_columns`
   Creates 8 new tables + 5 new nullable columns. NO backfill (all
   nullable / default values).
3. **PR3 (services + routes):** purely application code; depends on PR2 schema.
4. **PR4 (audit backfill):** add `createAuditEntry()` calls in 20 services.
   Each is a small diff; no schema change.
5. **PR5 (FE pages):** consume the routes from PR3.
6. **PR6 (PIN-gate wiring):** apply `requireRecentPin` to sensitive
   routes; ship `<PinGateSheet>`.
7. **PR7 (tsvector + GIN index):** raw SQL migration (per
   `PRISMA_MIGRATION_RULES.md` — GIN/trgm = raw SQL only, no
   `@@index`); index name `idx_audit_log_search_vec`.

No backfill cron is needed for any of the new tables.

### Cleanup cron specs (per blindspot #5 — ephemeral tables)

| Table | Why ephemeral | Cleanup script | Frequency | Retention | Index |
|-------|---------------|----------------|-----------|-----------|-------|
| `PinPhoneLockout` | Sliding-window failure counter | `server/src/jobs/pin-phone-lockout-gc.cron.ts` | Hourly :30 | 48 h (DH `PIN_GC_LOCKOUT_RETENTION_MS`, DPDP §8(7)) | `@@index([lockedUntil])` |
| `PinResetToken` | Single-use OTP-derived token | `server/src/jobs/pin-reset-token-gc.cron.ts` | Every 15 min | 24 h post-expiry | `@@index([expiresAt])` |
| `AuditLog` (hot tier) | Compliance retention | `server/src/jobs/audit-log-archive.cron.ts` (HOOK ONLY in Phase 6) | Daily 02:00 IST | 180 days hot in Postgres; archive to S3 deferred to Phase 7 | `@@index([businessId, createdAt])` (exists) |

`Attendance` / `Payroll` / `PayslipSnapshot` / `Employee` / `EmployeeAdvance`
are **NOT ephemeral** (financial / HR truth — retained forever per business).
No cleanup cron.

### Test infrastructure (per blindspot #1)

- **Reserved test employees** for CI: `9999999990` - `9999999999` reused
  from existing auth test range. Employee phone in this range bypasses
  phone-uniqueness check across firms (test fixture only).
- **Mock payroll dates** — `process.env.PAYROLL_NOW_OVERRIDE_ISO` lets
  CI freeze time for run-payroll idempotency tests.
- **PIN bypass token** in non-prod — `process.env.PIN_GATE_TEST_BYPASS`
  (32-char minimum) shortcuts `requireRecentPin` when the request
  header `x-pin-test-bypass` matches. Hard-fail boot in production if
  set.
- **Turnstile test keys** — Cloudflare publishes test site/secret keys
  (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`)
  used in CI.

---

## 9. Acceptance Gate (testable per feature)

### #135 Attendance

- [ ] `POST /api/employees` creates row, returns 201
- [ ] `POST /api/employees` with duplicate phone in same business → 400 `EMPLOYEE_PHONE_DUPLICATE`
- [ ] `PUT /api/attendance/:employeeId/:date` upserts (idempotent on (businessId, employeeId, date))
- [ ] `POST /api/attendance/clock-in` with geofence mismatch sets `geofenceFlag=true`, returns 200 NOT 403
- [ ] Attendance % = (PRESENT + HALF_DAY*0.5 + PAID_LEAVE) / workingDays — unit-tested
- [ ] Grid renders ≤ 30 employees × 31 days at 320px without horizontal overflow on the EMPLOYEE NAME column
- [ ] 4 UI states pass at 320px

### #136 Payroll

- [ ] `POST /api/payroll/runs/preview` returns expected gross/net for a synthetic 1-employee fixture
- [ ] `POST /api/payroll/runs` is idempotent — second call same (businessId, periodYearMonth, cycle) → 200 `{alreadyRun: true}`
- [ ] Without PIN gate → 401 `PIN_REQUIRED`
- [ ] Outstanding advance Rs 5,000 deducted automatically; advance `appliedPaise` increments
- [ ] Run creates one `Payment` ledger row (PAYROLL_OUT) per employee — verified via integration test
- [ ] Reverse run requires Approval + PIN gate
- [ ] 4 UI states pass at 320px on `/hr/payroll/new`

### #137 Slip

- [ ] `GET /api/payslips/:payrollId` returns PayslipSnapshot
- [ ] PDF render output is byte-stable across two regenerations (no current-time stamps in body)
- [ ] PDF includes attendance summary from #135
- [ ] Share-WhatsApp button opens native share with the PDF attachment
- [ ] Snapshot fields freeze at run time — editing the Employee name later does NOT change the slip name

### #138 Multi-firm

- [ ] `POST /api/auth/switch-business` writes 2 AuditLog rows (one per firm)
- [ ] Suspended `BusinessUser` row absent from `/me`'s `businesses[]`
- [ ] `<TenantChip>` color tint matches firm — verified via Playwright snapshot
- [ ] Tenancy audit: 100% of Phase 1-5 mutation services pass the `req.user.businessId` lint
- [ ] Cross-tenant integration test (200+ services) all pass

### #139 Audit

- [ ] Search `q=invoice` returns rows containing "invoice" in entityLabel
- [ ] Diff view renders changes as `field: before → after`
- [ ] User with `audit.view` (no `audit.view_full`) sees `phone: ████` in payload
- [ ] CSV export honours redaction (no raw phones in export)
- [ ] CSV export is itself audit-logged
- [ ] Backfill: 20 services each have a "writes audit row on success" integration test
- [ ] Audit search p95 < 400ms at 100k rows

### #140 PIN

- [ ] Setting a new PIN with `<` 4 digits → 400
- [ ] Verifying correct PIN → 200, sets `req.session.pinVerifiedAt[routeClass] = now`
- [ ] 5 wrong PINs → `pinLockedUntil` set to +30min, 403 `PIN_LOCKED`
- [ ] 20 wrong PINs across devices same phone in 1h → `PinPhoneLockout.lockedUntil` set
- [ ] Within 5 min of a successful verify, the same routeClass action does NOT prompt
- [ ] Different routeClass action DOES prompt
- [ ] PIN reset via OTP flow → new PIN works, old PIN does not
- [ ] PIN verify writes AuditLog row (success + failure + lockout)
- [ ] Turnstile token required after 3 distinct-IP failures in 5 min (when env set)
- [ ] 320px PinPad: all 12 keys ≥44px touch targets

---

## 10. Build Sequencing Hint (non-binding — architect refines)

Suggested PR order:

- **PR0 — Tenancy audit + permission keys** (deliverable: `docs/TENANCY_AUDIT.md`,
  `permissions-data.ts` edit). No schema. Reveals A01 risks pre-build.
- **PR1 — Schema + types + Zod** (1 migration: 8 tables + 5 columns).
  Migration runs cleanly; tsc green; no service impl yet.
- **PR2 — `security-pin` service (DH port)** — backend only. Internal
  service callable from tests; no routes yet.
- **PR3 — PIN gate middleware + routes** — `requireRecentPin` middleware
  + `/api/pin-gate/*` routes. Integration tests for lockout / grace /
  Turnstile.
- **PR4 — `<PinGateSheet>` + `<PinResetDrawer>` FE** — sheet wires
  into existing PinPad component; reset uses MSG91 OTP.
- **PR5 — HR backend** (employee + attendance + payroll + advance +
  payslip services + routes). Payroll-run uses PIN gate from PR3.
- **PR6 — HR frontend** (`/hr/employees`, `/hr/attendance`, `/hr/payroll`,
  `<PayslipDocument>`, share buttons + ext41 translations).
- **PR7 — Multi-firm elevation** — `<TenantChip>`, `<BusinessSwitcher>`
  polish, suspend/reactivate routes, AuditLog wiring on switch + ext42.
- **PR8 — Advanced audit trail backend** — search route + diff
  endpoint + CSV export + tsvector raw-SQL migration + redaction utility
  + 20-service audit backfill (split into PR8a + PR8b if too large).
- **PR9 — Advanced audit trail frontend** — `<AuditDiffView>`,
  search bar, CSV export drawer, ext43 translations.
- **PR10 — Cross-cutting tests + security audit fixes** — output
  `docs/SECURITY_AUDIT_PHASE6.md`.

Each PR green per the Acceptance Gate matrix.

---

## 11. Open Clarifying Questions for Sawan

The following decisions are too important to silently default. **Please
answer each — defaults shown so we ship if you only address half.**

### Attendance / Payroll (#135 #136 #137)

1. **Geofence default?** Default: **OFF per-employee**, opt-in by owner
   with DPDP consent screen. Mismatch is a SILENT FLAG, never a block.
   **OK?**
2. **Working-days default?** Default: **26 per month** (industry standard
   for Indian MSME); configurable per employee. **OK?**
3. **Payroll cycle?** Default: **MONTHLY only in MVP**, enum scaffolded
   for weekly/biweekly. **OK?**
4. **Pro-ration formula?** Default:
   `net = baseNet * (present + halfDay*0.5 + paidLeave) / workingDays`.
   No "overtime" multiplier. **OK?**
5. **Advance auto-deduct policy?** Default: **deduct in FULL on next
   payroll** until advance is zero; owner can mark advance "WRITTEN_OFF"
   to stop. No partial-monthly-installment UI in MVP. **OK?**
6. **PF / ESI / TDS?** Default: **NOT in MVP** — custom-deduction lines
   only. **OK?** (regulatory slabs change yearly and are a liability to
   hard-code)
7. **Payslip language?** Default: **English only in MVP** (matches
   invoice template default). Hindi/Hinglish slip = FUTURE_EPIC. **OK?**
8. **Bulk payslip ZIP download?** Default: **yes, client-side jszip**
   (no server burden). **OK?**

### Multi-firm (#138)

9. **JWT carries `firms[]` claim?** Default: **NO** — bloats every request;
   `/me` provides the list. **OK?**
10. **Switch requires re-auth?** Default: **NO** — current
    blacklist-old + rotate-new is enough; PIN required on suspend/reactivate
    actions only. **OK?**
11. **Per-firm color tint in header?** Default: **YES, NICE_TO_HAVE** —
    8 preset firm colors auto-assigned by hash. **OK?**
12. **Suspend membership requires what?** Default: **PIN gate + audit row
    + email/SMS to the suspended user**. **OK?** (SMS via MSG91; cheap)

### Audit Trail (#139)

13. **Retention?** Default: **180 days hot in Postgres**, archive HOOK
    only in Phase 6 (S3 bucket = Phase 7). **OK?**
14. **PII redaction permission key?** Default: **new `audit.view_full`
    key** (owner default); plain `audit.view` returns redacted payload.
    **OK?**
15. **Audit-coverage backfill in same epic?** Default: **YES, 20 services
    in PR8b**. Without backfill the trail has holes. Alternative: defer
    to Phase 7 (audit-coverage epic). **OK to include in Phase 6?**
16. **CSV export max rows per call?** Default: **10,000 rows**; larger
    requests return a `ASYNC_EXPORT_REQUIRED` 202 (deferred). **OK?**

### Transaction PIN (#140)

17. **Per-user or per-business PIN?** Default: **per-user** — same PIN
    works across the user's firms (Q4 of original prompt). Different
    PIN per firm = FUTURE_EPIC (per-firm operation PIN already exists
    via `TransactionLockConfig.operationPinHash` for the approval flow,
    which is a separate gate). **OK?**
18. **PIN length?** Default: **4 digits MVP**, enum scaffolded for 6.
    Indian SMB convention is 4. **OK?**
19. **Grace duration?** Default: **5 min per route-class**, configurable
    in `pin-auth.constants.ts`. **OK?**
20. **Route classes?** Default list: `DELETE_INVOICE`, `VOID_PAYMENT`,
    `RUN_PAYROLL`, `VIEW_AUDIT_LOG`, `EXPORT_AUDIT_LOG`,
    `EDIT_TRANSACTION_LOCK`, `EDIT_ROLE_PERMISSIONS`, `SUSPEND_STAFF`,
    `DELETE_EMPLOYEE`, `GRANT_ADVANCE`. Each gets its own grace timer.
    **Add or remove?**
21. **Turnstile enabled?** Default: **OFF in MVP** (no Cloudflare env keys
    yet); SCOPE includes the wiring so flipping to ON is one env var.
    **OK?**
22. **PIN reset OTP cost?** Per blindspot #1: reserved test-phone range
    `9999999990-9999999999` bypasses MSG91 in non-prod. **OK to confirm?**
23. **Weak-PIN list?** DH ships `weak-pin.util.ts` rejecting `0000`,
    `1111`, `1234`, `4321`, etc. Default: **port verbatim**. **OK?**

---

## 12. Resolved Decisions (blindspot checklist)

| Blindspot | Resolution |
|-----------|------------|
| #1 Test/dev magic OTP — for PIN reset | Reuse `9999999990-9999999999` range; same `src/constants/test-phones.ts` already used by existing auth |
| #2 Lockout policy (not just primitive) | PIN: per-device 5/30min + per-phone 20/1h rolling + Turnstile after 3 distinct-IP/5min — DH port verbatim, constants in `pin-auth.constants.ts` |
| #3 SIM-swap detection | Out of scope for PIN-gate alone (PIN gates an already-authenticated session). SIM-swap detection lives in the OTP login flow (existing). **N/A for Phase 6.** |
| #4 Adapter pattern over deprecation | All Phase 6 routes are additive. No deprecations. |
| #5 Ephemeral-table cleanup cron | `PinPhoneLockout` + `PinResetToken` + audit archive HOOK — all specified in §8 cleanup table |
| #6 Adapter telemetry | N/A — no adapters in Phase 6 |
| #7 First-time vs existing-user failures | PIN setup is for ALREADY-authenticated users; no first-time signup flow. Reset = OTP (existing-user only). N/A. |
| #8 Provider abstraction | Payroll cycle enum scaffolded MONTHLY-only; weekly/biweekly future. PinGate is provider-agnostic (no MSG91 dep — only reset uses MSG91, existing). |
| #9 Tier every recommendation | Every line in §3 ends with `[MUST_SHIP]` / `[SHOULD_SHIP]` / `[NICE_TO_HAVE]` / `[FUTURE_EPIC]` |
| #10 Auto-fill / autocomplete | PIN input: `inputmode="numeric"` + `autocomplete="one-time-code"` on PinPad + `aria-label`; clock-in time inputs `inputmode="numeric"` |
| #11 SMS template multi-channel | PIN reset OTP reuses existing MSG91 template — no new templates |
| #12 Stateful-gate collisions | `requireRecentPin` runs AFTER `auth` + `requirePermission`; ordering tested. No global pre-route gate. |
| #13 Self-X check leak analysis | Geofence-flag is SILENT (not a block); avoids leaking employee's exact location to the cashier UI. Only owner sees the flag in audit. |
| #14 Analytics events ≤ 7/flow | Attendance: 3 (`attendance_marked`, `attendance_clock_in`, `attendance_override`). Payroll: 4 (`payroll_run_started`, `payroll_run_completed`, `payroll_reversed`, `advance_granted`). Slip: 1 (`payslip_shared`). Multi-firm: 2 (`firm_switched`, `firm_member_suspended`). Audit: 3 (`audit_searched`, `audit_diff_viewed`, `audit_exported`). PIN: 5 (`pin_set`, `pin_verified`, `pin_failed`, `pin_locked`, `pin_reset`). |
| Auth/billing lockout policy (v2 hard gate) | §3 #140 specifies primitive (`PinPhoneLockout` table) + policy (5/30min device, 20/1h phone, Turnstile escalation) explicitly |
| Failure-mode walkthrough (v2 hard gate) | §13 below |

---

## 13. Failure Mode Walkthrough (v2 MANDATORY)

Six-month-out scenarios with concrete mitigations:

1. **Provider/dependency outage (MSG91 down 30 min during PIN reset)** —
   PIN reset blocked for the window. **Mitigation**: WhatsApp fallback
   (Aisensy, already integrated for Marketing Comms); if both down,
   "support contact" CTA in PinResetDrawer → user opens WhatsApp to
   `support@hisaabpro.in`. PIN gates on existing PINs CONTINUE TO WORK
   during MSG91 outage (only reset is blocked).

2. **Abuse spike — 100x clock-in attempts from rotating IPs** — Employee
   self-service clock-in is rate-limited per-user (60/hr is already enough;
   we add 5/min new throttle). The Cloudflare Turnstile gate
   (`SHOULD_SHIP`) catches automated requests at the PIN-gate level.
   For attendance: payload size cap (1KB) + per-employee + per-IP
   throttle in `nic-rate-limit` middleware (existing).

3. **Database bloat — Attendance reaches 100M rows** — Worst case:
   20 employees × 365 days × 10 years × 1000 businesses = 73M rows.
   **Mitigation**: composite index `(businessId, date)` keeps month-grid
   queries O(employees × days) regardless of total table size.
   PostgreSQL handles 100M rows on Render Starter; partitioning is a
   Phase 7+ optimisation. Auto-purge for businesses that
   delete-and-recreate is governed by `onDelete: Cascade` on `Business`.

4. **Client-version lag — 30% of users on app 6+ months old** — Old
   client predates PIN-gate. The server returns 401 `PIN_REQUIRED` on
   gated routes; old client surfaces a generic 401 → user redirected
   to login. **Mitigation**: server-side header `X-Min-App-Version`
   on 401 PIN_REQUIRED responses; old clients on /settings show a
   "Update to enable Transaction PIN" banner. PIN gate is OFF for
   users without a PIN set — old clients without PIN setup are
   unaffected. New clients with PIN set MUST use new app.

5. **Regulatory change — DPDP §8 amendment requires shorter retention** —
   Audit retention is one constant (`AUDIT_HOT_DAYS = 180` in
   `audit-advanced.constants.ts`). Change the constant + deploy =
   shorter retention; archive cron handles deletion automatically.
   Per-employee biometric (geofence GPS) — already DPDP-compliant
   (consent + minimal data).

6. **Cost runaway — payroll cron generates 1000s of PDFs at month-end** —
   PDFs are CLIENT-SIDE (react-pdf); zero server CPU on generation.
   `PayslipSnapshot` is ~1 KB per row × 10,000 employees/business × 12 months
   = 120 KB/business/year — negligible. SMS for payslip share? Owner
   chooses WhatsApp (free for them, cost-to-Aisensy ~₹0.50 utility).
   `AISENSY_MONTHLY_BUDGET_CAP_RUPEES` env var + alert via
   `notifications-engine` if exceeded.

7. **Insider abuse — engineer with DB access grants themselves
   `audit.view_full` permission and reads everyone's PII** —
   **Mitigation**: (a) every permission change writes an `AuditLog` row
   (`action: ROLE_CHANGE`, includes the before/after permission diff);
   (b) `AdminAction` audit trail for super-admin operations (admin
   panel); (c) quarterly admin-DB-access review process documented
   in `docs/RUNBOOK.md` — Phase 6 PR0 adds this doc; (d) Phase 7+
   tamper-evident chain on AuditLog to detect after-the-fact deletions.

---

## 14. DudhHisaab Reuse — verbatim candidates found

> Per `/Users/sawanjaiswal/Projects/HisaabPro/CLAUDE.md` mandate: search
> DudhHisaab FIRST → adapt → strip DH-specific fields.

| Target | DH Source | Reuse mode | Notes |
|--------|-----------|------------|-------|
| `server/src/services/security-pin/pin-lockout.service.ts` | `DudhHisaab/src/services/auth-pin/pin-lockout.service.ts` | **Verbatim port** (rename Prisma model from `UserDevicePin` → use existing `UserAppSettings.pinAttempts/pinLockedUntil`; keep `PinPhoneLockout` model name) | 200 LOC, no DH-specific fields |
| `server/src/services/security-pin/pin-verify.service.ts` | `DudhHisaab/src/services/auth-pin/pin-verify.service.ts` | Verbatim port | timingSafeEqual on hash, atomic update |
| `server/src/services/security-pin/pin-set.service.ts` | `DudhHisaab/src/services/auth-pin/pin-set.service.ts` | Adapt to use existing `setPin` from `services/settings/pin.ts` | Don't duplicate hash logic |
| `server/src/services/security-pin/pin-reset.service.ts` | `DudhHisaab/src/services/auth-pin/pin-reset.service.ts` | Verbatim port | Uses OTP infra; HP has same |
| `server/src/services/security-pin/pin-biometric.service.ts` | `DudhHisaab/src/services/auth-pin/pin-biometric.service.ts` | Verbatim port + integrate with HP's `webauthn.service.ts` | WebAuthn pattern compatible |
| `server/src/services/security-pin/turnstile-gate.service.ts` | `DudhHisaab/src/services/auth-pin/turnstile-gate.service.ts` | Verbatim port | Cloudflare verify endpoint |
| `server/src/services/security-pin/dummy-hash.ts` | `DudhHisaab/src/services/auth-pin/dummy-hash.ts` | Verbatim port | Timing-attack defense for missing PIN |
| `server/src/services/security-pin/weak-pin.util.ts` | `DudhHisaab/src/services/auth-pin/weak-pin.util.ts` | Verbatim port | Rejects 0000/1234/etc. |
| `server/src/constants/pin-auth.constants.ts` | `DudhHisaab/src/constants/pin-auth.constants.ts` | Verbatim port (41 LOC) | DPDP-aligned retention constants |
| `server/src/jobs/pin-gc.cron.ts` | `DudhHisaab/src/jobs/pin-gc.job.ts` | Verbatim port | Cleans PinPhoneLockout + PinResetToken |
| `src/features/pin/components/PinGateSheet.tsx` (HP path) | `DudhHisaab/frontend/src/features/auth-pin/components/PinPad.tsx` + `usePinVerify.ts` | Adapt — HP already has `<PinPad>`, wrap in a Drawer | HP PinPad is already aligned to design tokens |
| `src/features/pin/hooks/usePinGate.ts` | `DudhHisaab/frontend/src/features/auth-pin/hooks/usePinVerify.ts` + `usePinStatusGate.ts` | Verbatim adapt | Returns `withPinGate(routeClass, fn)` HOC |
| `src/features/pin/hooks/useAppLockTimeout.ts` | `DudhHisaab/frontend/src/features/auth-pin/hooks/useAppLockTimeout.ts` | NICE_TO_HAVE port — auto-lock app after 5min idle | Different from per-route grace; separate concern |

**NO reuse found in DH for:** attendance, payroll, salary slips, multi-firm
elevation, advanced audit trail. These are net-new (or HP-template-based —
e.g. Epic D's ledger-in-transaction pattern for payroll).

---

## 15. QA Checklist

Verifier runs this BEFORE merge — see also §9 per-feature gates.

### Backend
- [ ] `npx tsc -b --noEmit` clean (server + client)
- [ ] `node scripts/enforce.js` 0 errors
- [ ] `node scripts/enforce-offline.mjs` 0 new violations
- [ ] `node scripts/manifest-score.js --brief` exits 0
- [ ] `node scripts/audit-coverage.mjs` reports 100% of mutation services have audit hooks
- [ ] Reserved test-phone range respected (`PIN_GATE_TEST_BYPASS` boot-fails in prod)
- [ ] All 11 backend file-plan rows ≤ 250L (architect verifies)
- [ ] Cross-tenant integration tests for each new route: 200 (own firm), 403 (other firm), 401 (no auth), 400 (bad input)

### Frontend
- [ ] All translation keys EN ↔ HI 1:1 across ext41 / ext42 / ext43 / ext44
- [ ] Every new page passes `.claude/rules/PAGE_AUDIT_CHECKLIST.md` A→N
- [ ] 4 UI states visible at 320px on every new page
- [ ] PIN gate sheet usable at 320px (12-key pad ≥ 44px each)
- [ ] Attendance grid scrolls cleanly with sticky employee-name column at 320px
- [ ] Tenant chip colour tint matches firm hash deterministically

### Security
- [ ] `docs/SECURITY_AUDIT_PHASE6.md` produced by security agent — 0 P0/P1
- [ ] `docs/TENANCY_AUDIT.md` produced by architect — 100% coverage
- [ ] DPDP geofence consent screen verified on first toggle-on
- [ ] PIN gate audit row written on every verify success / fail / lock

---

## 16. Revision Log

(empty — first publication)

---

**End of SCOPE.**
