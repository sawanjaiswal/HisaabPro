# Backlog — resume 2026-05-26

> Snapshot at 2026-05-26 09:22 IST. **139/150 shipped — Phase 6 COMPLETE.**
> Phase 1 (60/70 code-complete, 10 cred-blocked) · Phase 2 (20/20) · Phase 3 (21/22, #89 deferred) · Phase 4 (16/16) · **Phase 5 (14/14)** · **Phase 6 (6/6) ✅ SHIPPED** (merge `caa390d`, 9 PRs + 2 hardening commits, BE/FE/security/QA all green) · Phase 7 (2/10 — #141 OCR + #145 verticals).
>
> **Branch state:** `hisaabpro` is **38 commits ahead of `master`**. Master HEAD `af44d50` (pre-Phase-5). Production deploy still at `89610b0`. Nothing since the responsive sweep + Phase 5 Epic A/B/C/D + subscription port + Phase 6 has been merged to master/prod.
>
> **Next up:** ship-to-prod (merge `hisaabpro` → `master`, set Render env vars, run Phase 6 migration + ramp playbook) **OR** Phase 7 AI features (#142–#150). See "Resume order" below.

## Resume order

### 0. Ship-to-prod gate (RECOMMENDED — biggest backlog of unshipped value)

`hisaabpro` carries 38 commits of unshipped work spanning Phase 5 (A/B/C/D) + subscription port + responsive sweep + **Phase 6 Staff & HR + Multi-firm + Audit + PIN**. Before any new epic, decide whether to:

- **Merge `hisaabpro` → `master`** and ramp Phase 6 per `docs/ROLLOUT_PHASE6.md` (5-stage cohort ramp: internal → 10% → 25% → 50% → 100%)
- **OR keep accumulating** on `hisaabpro` and ship Phase 7 first (risky — Phase 6 touched every authenticated request path; longer it sits unmerged, harder to bisect a future regression)

**Pre-merge env vars to set on Render:**
- Phase 6: `FEATURE_STAFF_HR=false` (off by default), `FEATURE_STAFF_HR_COHORT_PCT=0`, `FEATURE_TRANSACTION_PIN=true`, `FEATURE_TRANSACTION_PIN_COHORT_PCT=100` (PR3 already enrolled all users), `PIN_GATE_DOMAIN` (cookie domain SSOT). See `docs/ROLLOUT_PHASE6.md` §0.
- Subscription port: `ENTITLEMENT_JWT_PRIVATE_KEY` (RS256 PEM), `ENTITLEMENT_JWT_PUBLIC_KEY` (SPKI PEM), `RAZORPAY_WEBHOOK_SECRET`
- Epic A launch: `MARKETING_ENABLED=true`, `AISENSY_API_KEY`, `AISENSY_WEBHOOK_SECRET`, `MSG91_WEBHOOK_TOKEN`

**Pre-merge migrations:** Phase 6 PR1A added 9 tables + 28 column adds (Employee, PayrollRun, Payslip, AttendanceEntry, AuditLog extensions, PinCredential, BusinessTenancy elevation cols, etc.). Subscription port added 4 tables + UpiMandate. Epic D added 4 tables + 2 Party cols. Run `npx prisma migrate deploy` and smoke-test:
- Phase 6: PIN set/verify, attendance daily grid, payroll run + payslip PDF, audit search + CSV export, suspend/reactivate banner
- Epic D: loyalty redemption in POS, commission ledger row on sale, party CRM tab
- Public surface: `/p/inv/<token>`, `/p/store/<slug>`, `/p/invite/<token>`

---

### 1. Phase 5 Epic A — Marketing Comms FE ✅ SHIPPED 2026-05-15

Three slices on `hisaabpro`:
- Slice 1 — Hub + Templates — commit `9b1f096` (+63 EN/HI keys)
- Slice 2 — Campaigns wizard — commit `016a1c8` (+108 keys)
- Slice 3 — Reminders + Opt-outs + party-row chip — commit `9d281de` (+50 keys)

Backend already live (PR1-6 commits `3ea2cdc`..`5c2e3ca`). Activation needs `MARKETING_ENABLED=true` + `AISENSY_API_KEY` + `AISENSY_WEBHOOK_SECRET` + `MSG91_WEBHOOK_TOKEN` on Render.

---

### 1b. Subscription port ✅ SHIPPED 2026-05-15

Commit `3530e79` on `hisaabpro` (mission `subscription-port`). 7-state machine + UPI Autopay + RS256 offline JWT + PRO_MAX tier + SubscriptionEvent audit + OverflowBanner + MandateSetupDrawer + `/settings/subscription`. Needs `ENTITLEMENT_JWT_PRIVATE_KEY` + `ENTITLEMENT_JWT_PUBLIC_KEY` + `RAZORPAY_WEBHOOK_SECRET` on Render.

---

### 2. Phase 5 Epic B — Sales workflow ✅ SHIPPED 2026-05-15

Commits `6193d28` + `3626a0c`. #122 Sales pipeline, #132 Multiple price lists, #133 BOGO custom-role, #134 Invoice custom fields. Security findings 1.1/2.1/2.2/3.2/4.1 all FIXED.

---

### 3. Phase 5 Epic C — Customer-facing ✅ SHIPPED 2026-05-15

Commits `d78f7c9`..`237b551`. SharedLink infra, #129 UPI QR, #130 Web invoice links (HMAC), #121 Online store, #131 Party invite (OTP). Public surface rate-limited (60 rpm/IP), tokens HMAC + expiry + revocable.

---

### 4. Phase 5 Epic D — CRM + Loyalty + Commission ✅ SHIPPED 2026-05-17

Merge `63ccef4`. #125 Loyalty (FIFO accrual, advisory-locked redeem, POS step 10.5/10.6, expiry cron), #127 CRM Basics (tags + follow-ups + lastContactedAt), #128 Commission (ruleSnapshot deep-clone, PRODUCT > CATEGORY > ALL, factory ledger auth, rate-cap UX). Pass 5 architecture audit + Pass 2 security PASS + QA Gate GREEN (49/49).

---

### 5. Phase 6 — Staff & HR + Multi-Firm + Audit + PIN ✅ SHIPPED 2026-05-26
**Merge commit:** `caa390d` (12 commits total: design ceremony `e36812e` → PR0 audit `26c4665` → PR1A/B schema+middleware `d036036`/`ce805d6` → PR2 tenancy `c718490`/`8f0a06e` → PR3 PIN `5f802b9`/`3fc3802` → PR4 audit search `c0f54a2`/`78e1a5e` → PR5 attendance `0e2b78a`/`2f78154` → PR6 employee+payroll `1b27829`/`a83b4d9` → PR7 audit-backfill+enforcer-block `025d037` → PR8 rollout flags+runbook `60651d7` → Pass-2 fix `e3a93d0` → 6.1 hardening `ba56470`/`0bd1881`)

- **#135 Staff Attendance** — PR5. Daily employee×day grid, batch + range list endpoints, businessId-scoped.
- **#136 Payroll** — PR6. Employee model + Payroll wizard + STAFF Party pairing + reversal flow.
- **#137 Salary Slips** — PR6. Payslip viewer + PDF generation + reverse action.
- **#138 Multi-firm Management** — PR1A schema (BusinessTenancy elevation), PR1B middleware (`requireActiveBusiness`), PR2 suspend/reactivate flow (TenantChip + SuspendBanner + ReactivationModal). PR0 audit confirmed **0 cross-tenant leaks across 1,033 sites**.
- **#139 Advanced Audit Trail** — PR4. Audit search (websearch_to_tsquery for safety, no plain to_tsquery), redaction layer, buffered CSV export, filter + diff drawers. PR7 backfilled 13 missing mutations + flipped `enforce-audit-coverage.mjs` to `--block`.
- **#140 Transaction PIN** — PR3. PinCredential schema (port from DH), `/api/auth/pin/*` routes (set/verify/reset), `requireRecentPin` middleware on gated routes, PinGateProvider + PinPad sheet + api.ts 403 interceptor for re-auth.

**Rollout artefacts:**
- `docs/ROLLOUT_PHASE6.md` — 5-stage cohort ramp (internal → 10% → 25% → 50% → 100%) with promotion gates + hold/rollback triggers
- `docs/RUNBOOK_PHASE6.md` — incident-response playbook per failure class
- `docs/VERIFIER_REPORT_PHASE6.md` — 7 mechanical proofs all exit 0 (FE tsc, BE tsc, enforce.js, enforce-offline, audit-coverage --block, regression greps for `req.user.id` and plain `to_tsquery`)
- `docs/SECURITY_AUDIT_PHASE6_PASS2.md` — Pass-2 PASS (kill-switch `requireFeature('STAFF_HR')` wired into 3 aggregator routers between `requireActiveBusiness` and handler)
- Feature flags: `FEATURE_STAFF_HR` + `FEATURE_STAFF_HR_COHORT_PCT` + `FEATURE_TRANSACTION_PIN` + `FEATURE_TRANSACTION_PIN_COHORT_PCT` with djb2 sticky cohort bucketing in `server/src/config/features.ts`
- 6.1 hardening: dropped unused `PinPhoneLockout` table (SHOULD_FIX-2) + removed dead `PIN_GATE_DOMAIN_PREFIX_MISMATCH` code path (SHOULD_FIX-3)

Audit + design docs: `docs/SCOPE_PHASE6_STAFF_HR.md`, `docs/SCOPE_AUDIT_PHASE6_STAFF_HR.md`, `docs/ARCHITECTURE_PHASE6_STAFF_HR.md`, `docs/ARCHITECTURE_AUDIT_PHASE6_STAFF_HR.md`, `docs/SECURITY_AUDIT_PHASE6_STAFF_HR.md`, `docs/SECURITY_AUDIT_PHASE6_PASS2.md`, `docs/TASKS_PHASE6_STAFF_HR.md`, `docs/VERIFIER_REPORT_PHASE6.md`.

---

### 6. Phase 7 — AI & Differentiators (8 remaining; #141 OCR + #145 verticals done)
- #142 Voice entry (browser SpeechRecognition + on-device fallback)
- #143 WhatsApp bot billing (Aisensy inbound webhook → invoice draft) — **high leverage / lock-in**
- #144 Smart GST filing assistant (rules engine on Phase 2 data)
- #146 Predictive analytics (sales/stock forecast) — **margin story**
- #147 Auto-reconciliation (bank statement → payment match)
- #148 Smart inventory (reorder suggestions based on velocity)
- #149 Competitor data importers (Tally/Vyapar/MyBillBook) — **acquisition unlock**
- #150 Real-time multi-user collaboration (presence + conflict resolution) — **needs architecture spike, CRDT vs LWW decision**

Highest leverage next: #143 → #149 → #146. Highest risk: #150.

#### 6a. #149 Phase 7 Import Engine — slice tracker (2026-05-19)

Branch: `hisaabpro` (worktree `HisaabPro-phase7-import`). Epic ceremony PASS_v2 across 7.1A/B/C/D (scope-writer → scope-auditor → architect → architecture-auditor → security → task-manager). Cross-ref docs: `SCOPE_PHASE7_IMPORT_7_1{A,B,C,D}.md`, `ARCHITECTURE_PHASE7_IMPORT_7_1{A,B,C,D}.md`, `SECURITY_AUDIT_PHASE7_IMPORT_7_1{A,B,C,D}.md`.

**Shipped:**
- **7.1A Parties** — BE + FE + QA gate (Tally XML + Vyapar/Generic CSV + Busy XLSX → Party). M1-M5 audit MUST_FIX landed.
- **7.1B Products** — BE + FE + QA gate (price precision regex + HSN charset + paise BigInt cap). M6-M9 audit MUST_FIX landed.
- **7.1C Invoices** — BE + FE + QA gate (Document/DocumentLineItem nested, per-entity client-version floor 7.1.2, P2002 dual-shape catch). M10-M11 audit MUST_FIX landed.
- **7.1D Payments — PR-D0 + PR-D1 + PR-D2a** (commits `06279ee`, `c802e2c`, `730a794`, `1dbe3a5`):
  - Prisma migration `20260519161000_phase7_1d_a_payment_import_addendum` — additive `Payment.importJobId` + `importedBy` SetNull FKs + 2 indexes
  - Zod schema extended (`entity: 'payments'`, optional `strictMode`)
  - `payment-mode-map.{constants,ts}` — M12 fix (frozen Map, prototype-clean lookup; EN + Devanagari aliases)
  - `payment-utils.ts` — M13 fix (Tally 8-digit DATE calendar round-trip) + tail-100 `truncateReference` SSOT
  - `commit-payments/{types,commit-payments.service.ts}` stubs; commit-dispatcher extended
  - Per-entity client floor `payments: '7.1.3'` wired through 4 services
  - **27/27 unit tests green** (M12 prototype-pollution suite 14, M13 calendar + tail-100 truncation suite 13)

**Pending (queued):**

| Slice | Scope | Key files | Acceptance |
|---|---|---|---|
| **PR-D2b** Payments parsers | Tally Receipt voucher branch (PARTYLEDGERNAME, BILLALLOCATIONS, CHEQUENO; wire `tallyPreformatDate`); Vyapar payments CSV (header-alias dict); Busy ReceiptRegister XLSX (`cellDates:true, dateNF:'yyyy-mm-dd'`); Generic CSV mapping-driven | `services/import/parsers/{tally,vyapar,busy,generic}-payments.parser.ts`, `payment-column-dict.constants.ts`, `parsers/index.ts`, `payment-normalizer.ts`, `payment-invoice-resolver.ts`, `payment-dedup.ts`, `dedup/index.ts`, fixtures + tests | tsc clean · 4 parsers × happy/malicious · M13 integration through full parse |
| **PR-D3** Payments commit ladder | Σ-over-allocation guard (SELECT FOR UPDATE Document + JOIN Payment for soft-delete filter); per-row `allocate-one.ts` (Σ-guard BEFORE INSERT Payment → INSERT PaymentAllocation, dual-shape P2002, row-local markRowError); orchestrator (chunk tx, sequential `for...of`, batched audit emit); **S9** assertEqualLengths type-homogeneity (1 LOC + test); `COMMIT_BLOCKED_INVOICE_NOT_FOUND` surface | `services/import/commit-payments/{over-allocation-guard,allocate-one,commit-payments.service,audit-emit,enum-guard}.ts`, `commit.service.ts` | tsc clean · S9 landed (auto-promotes audit to CLEAR) · integration 50×Rs250 Σ-overflow → 40 COMMITTED + 10 OVER_ALLOCATION |
| **PR-D4** Routes + integration | `routes/imports/create.route.ts` Zod payments + 7.1.3 floor; `get.route.ts` polymorphic; `routes/payments/list.route.ts` `?importJobId=` filter; `scripts/enforce-audit-coverage.mjs` adds `payments.imported_batch`; `scripts/enforce.js` bans `Promise.all` across `services/import/commit-payments/**` | routes + enforce scripts | enforce-offline clean · enforce-audit-coverage --block exit 0 · 13 integration tests (incl. ALLOCATION_INTERNAL_CONFLICT, dual-shape P2002, tail-100 collision-permissive, cross-tenant existence-leak, advisory-lock race, mid-tx crash idempotency, DPDP cascade) |
| **PR-D5** Frontend | `EntityPicker` extends to 4 tiles; `PaymentRowCard` (party/invoice/issue chips); `CommitBlockedBanner` deep-link `/import?entity=invoice&resumeImportJobId=<id>`; `ResumeFromInvoicesBanner` reverse-direction; translations EN/HI extensions; `useImportCommit` extension; `offlineQueue:false` on upload+commit | `features/import/**` (6-layer split, ≤250L each) | 4 UI states · 320px responsive · offline rules pass · screenshots |

**Post-7.1D cleanup:**
- **#149c** Retire legacy `src/features/data-import` after 7.1D ships — redirect `ROUTES.DATA_IMPORT → /imports`, remove legacy lazy import. Keep `bulk-import`.

**Open audit findings auto-promote on PR-D3 land:**
- M12 (CLEAR — code + tests landed in PR-D2a)
- M13 (CLEAR — code + tests landed in PR-D2a)
- S9 (1 LOC in `audit-emit.ts` per-element type-homogeneity assertion) — promotes CLEAR on PR-D3
- F12 (settings-UI dictionary edit) — FUTURE_EPIC, not blocking

**Process constraints (preserve across slice boundaries):**
- `req.user.userId` not `req.user.id` · `websearch_to_tsquery` not `to_tsquery` · 403 PIN_REQUIRED not 401
- All API calls via `api()`; mutations pass `entityType` + `entityLabel`; `offlineQueue:false` on import endpoints
- Files ≤250L · 6-layer FE split · PII-safe audit (jobId/rowIndex/code only)
- All Prisma queries scoped by businessId · paise Int wire format

---

### 7. Phase 1 cred-blocked unlocks (when keys land)
Razorpay (subscription port code is shipped, just needs keys) · Aisensy (also unblocks Epic A webhooks + #143) · Resend (email PDF #32 + reminders) · FCM (push #4/#42/#47) · Capacitor biometric plugin (#59) · MSG91 (SMS marketing #124 + OTP — see IDEAS_BACKLOG STPL setup).

### 8. Phase 3 deferred
#89 Bank Reconciliation — fits naturally with Phase 7 #147.

---

### 9. Per-vertical depth (audit 2026-05-09, still current)

Verticals are wired (nav filtering, terminology, defaults, Jobs flow, Custom Orders flow). Gap is **depth per vertical**, not coverage. Candidates:

| Epic | Verticals | Effort | Notes |
|---|---|---|---|
| **V1 — Services time tracking on Jobs** | services, freelancer, salon, clinic | ~1 wk | Add `hoursEstimated`, `hoursActual`, `ratePerHour` on Job; hour-based invoice line. Plumber/freelancer cannot bill hourly today. |
| **V2 — Appointments calendar** | salon, clinic | ~2 wks (HIGH) | New `Appointment` model + slot picker + availability view. Onboarding blocker. |
| **V3 — Recipe cost dashboard** | restaurant, bakery, manufacturing | ~3 days | Derive cost-per-unit from existing BOM data. UI-only. Quick win. |
| **V4 — Staff assignment + commission split** | services, bakery, tailor, manufacturing | ~2 wks | Assign staff to Jobs/Orders/POS sales. Builds on Phase 6 #128 commission ledger. |
| **V5 — Customer delivery reminders** | bakery, tailor | ~3 days | Trigger marketing-comms reminder N hours before delivery. Requires Epic A live. |
| **V6 — Table management + KOT** | restaurant | LARGE | Out of MSME billing scope. Defer to v2 product. |
| **V7 — Prescription field** | pharmacy, clinic | trivial | Likely solvable today via generic custom fields. Validate before scoping. |

Recommended sequence (post merge-to-prod):
1. V3 (3 days, no schema, big restaurant/bakery win)
2. V1 (1 wk, unblocks hourly billing — biggest current user complaint)
3. V5 (3 days, depends on Epic A)
4. V2 (2 wks, salon/clinic onboarding)
5. V4 (2 wks, naturally extends Phase 6 commission ledger)

V1, V2 touch schema → mandatory `scope-writer → architect → task-manager` ceremony. V4 also touches commission paths → add `security`.

---

## Open files to remember
- `.claude/design-plan-active.md` — last approved for Phase 6 Staff & HR. Replace before starting Phase 7 / verticals.
- Shipped epic docs (don't archive — referenced for context):
  - Phase 5: `docs/SCOPE_phase5_marketing_comms.md`, `docs/SCOPE_EPIC_B_sales_workflow.md`, `docs/SCOPE_EPIC_C_customer_facing.md`, `docs/SCOPE_EPIC_D_crm_loyalty.md`, companions `ARCHITECTURE_*`, `SECURITY_AUDIT_*`, `QA_GATE_EPIC_D_*`, `ARCHITECTURE_AUDIT_EPIC_D_*`.
  - Phase 6: `docs/SCOPE_PHASE6_STAFF_HR.md`, `docs/ARCHITECTURE_PHASE6_STAFF_HR.md`, `docs/SECURITY_AUDIT_PHASE6_STAFF_HR.md` + `PASS2`, `docs/SCOPE_AUDIT_PHASE6_STAFF_HR.md`, `docs/ARCHITECTURE_AUDIT_PHASE6_STAFF_HR.md`, `docs/TASKS_PHASE6_STAFF_HR.md`, `docs/VERIFIER_REPORT_PHASE6.md`, `docs/ROLLOUT_PHASE6.md`, `docs/RUNBOOK_PHASE6.md`.
- Subscription port PRDs: `PRDs/subscription-port-{SCOPE,ARCHITECTURE,SECURITY,TASKS}.md`. Mission archive: `.claude/missions/subscription-port.md`.

## Quick commands
- **Ship-to-prod (recommended next):** merge `hisaabpro` → `master`, set Render env, `npx prisma migrate deploy` (Phase 6 added 9 tables + 28 cols on top of Epic D's 4 tables + subscription port's 4 tables), then follow `docs/ROLLOUT_PHASE6.md` Stage 0 (internal 48h) → Stage 1 (10%) → … → Stage 4 (100%).
- **Start Phase 7 #143 (WhatsApp bot billing):** `/start-epic phase-7-whatsapp-bot-billing` — touches webhook handling + Aisensy creds.
- **Start vertical V3 (recipe cost):** `/start-epic vertical-v3-recipe-cost-dashboard`
- **Roadmap:** `docs/ROADMAP.md` — keep in sync after every epic.
- **Re-audit doc accuracy:** ask Claude "WHATS LEFT and whats done? deep audit, update the docs."
