# Backlog — resume 2026-05-28

> Snapshot at 2026-05-28. **140/150 shipped — Phase 6 COMPLETE + Phase 7 3/10.**
> Phase 1 (60/70 code-complete, 10 cred-blocked) · Phase 2 (20/20) · Phase 3 (21/22, #89 deferred → folds into #147) · Phase 4 (16/16) · **Phase 5 (14/14)** · **Phase 6 (6/6) ✅ SHIPPED** (merge `caa390d`, 9 PRs + 2 hardening commits, BE/FE/security/QA all green) · Phase 7 (**3/10** — #141 OCR + #145 Verticals + #149 Competitor imports `9a3c98e`).
>
> **Branch state:** `hisaabpro` is **0 commits ahead of `master`** (merged 2026-05-26 `caa390d`). Subsequent pre-beta hardening landed directly on master: money-SSOT PR #2 (`7c97b33`), refresh-token family rotation, security batch A (CSV + Sentry/logger PII scrub), W4b FE test-contract sweep (1306/1306). **Render production deploy still trails master — push to redeploy is the only remaining ship step.**
>
> **Next up:** Render redeploy + set env vars (subscription, Aisensy, MSG91) **OR** Phase 7 AI features (#142, #143, #144, #146, #147, #148, #150). See "Resume order" below.

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

### 6. Phase 7 — AI & Differentiators (3 remaining; #141 OCR + #142 voice + #144 GST + #145 verticals + #146 predictive + #148 smart-inv + #149 importers done)
- ~~#142 Voice entry (browser SpeechRecognition + on-device fallback)~~ — **DONE 2026-05-28**: speak-or-type a money entry → pure transcript parser (Hindi+English Indian phrasing: "do hazaar paanch sau", "1.5 lakh", "rent mila 5000 upi") → editable preview → saves directly via expense/other-income services. Web Speech API (`en-IN`) with typed-textarea fallback when unsupported/denied. `/voice-entry` FE (PRO + expenses gate), 22 parser tests. Live mic needs a real device to verify.
- #143 WhatsApp bot billing (Aisensy inbound webhook → invoice draft) — **high leverage / lock-in** — blocked: webhook high-risk gate + missing Aisensy creds
- ~~#144 Smart GST filing assistant (rules engine on Phase 2 data)~~ — **DONE 2026-05-28**: deterministic pre-filing readiness validator over a period's sale/note docs. 7 rules (B2B GSTIN, GSTIN format, place-of-supply, HSN/SAC, interstate split, composition-charging-GST, zero-tax). `/api/gst/filing-readiness` (PRO + reports.view); `/gst/filing-readiness` FE with blocker/warning tiers + deep-links to offending invoices. 18 tests.
- ~~#146 Predictive analytics (sales/stock forecast)~~ — **DONE 2026-05-28**: deterministic OLS revenue trend + sales-velocity stock-out forecast. `/api/analytics/*` gated on `advancedReports`; `/insights` FE (no charting lib — tiny SVG sparkline).
- #147 Auto-reconciliation (bank statement → payment match)
- ~~#148 Smart inventory (reorder suggestions based on velocity)~~ — **DONE 2026-05-28**: velocity-based reorder *suggestions* layer over static #114 reorderQty. Reuses #146 `forecast.math.ts`. `/api/inventory/reorder-suggestions` (auth-only, reads, products gate FE); `/inventory/reorder-suggestions` FE with urgency tiers (out/critical/low/ok), lead-time + coverage params. 15 tests.
- ~~#149 Competitor data importers (Tally/Vyapar/MyBillBook)~~ — DONE (legacy retired #149c 2026-05-28)
- #150 Real-time multi-user collaboration (presence + conflict resolution) — **needs architecture spike, CRDT vs LWW decision**

Highest leverage next: #147 Auto-recon (absorbs #89 bank rec). #143 blocked on creds + webhook gate. Highest risk: #150.

#### 6a. #149 Phase 7 Import Engine — slice tracker (2026-05-19)

Branch: `hisaabpro` (worktree `HisaabPro-phase7-import`). Epic ceremony PASS_v2 across 7.1A/B/C/D (scope-writer → scope-auditor → architect → architecture-auditor → security → task-manager). Cross-ref docs: `SCOPE_PHASE7_IMPORT_7_1{A,B,C,D}.md`, `ARCHITECTURE_PHASE7_IMPORT_7_1{A,B,C,D}.md`, `SECURITY_AUDIT_PHASE7_IMPORT_7_1{A,B,C,D}.md`.

**Shipped:**
- **7.1A Parties** — BE + FE + QA gate (Tally XML + Vyapar/Generic CSV + Busy XLSX → Party). M1-M5 audit MUST_FIX landed.
- **7.1B Products** — BE + FE + QA gate (price precision regex + HSN charset + paise BigInt cap). M6-M9 audit MUST_FIX landed.
- **7.1C Invoices** — BE + FE + QA gate (Document/DocumentLineItem nested, per-entity client-version floor 7.1.2, P2002 dual-shape catch). M10-M11 audit MUST_FIX landed.
- **7.1D Payments — COMPLETE** (commits `06279ee` D0, `c802e2c`+`730a794` D1, `1dbe3a5` D2a, `c3a5b4b` D2b, `1a10701` D3, `a5425a7` D4, `37651d7` D5):
  - Prisma migration `20260519161000_phase7_1d_a_payment_import_addendum` — additive `Payment.importJobId` + `importedBy` SetNull FKs + 2 indexes
  - Zod schema extended (`entity: 'payments'`, optional `strictMode`); per-entity client floor `payments: '7.1.3'` wired through 4 services
  - `payment-mode-map.{constants,ts}` — M12 fix (frozen Map, prototype-clean lookup; EN + Devanagari aliases)
  - `payment-utils.ts` — M13 fix (Tally 8-digit DATE calendar round-trip) + tail-100 `truncateReference` SSOT
  - **PR-D2b** — 4 payment parsers (`{tally,vyapar,busy,generic}-payments.parser.ts`) + `payment-column-dict.constants.ts` + normalizer + dedup
  - **PR-D3** — commit ladder (`over-allocation-guard`, `allocate-one`, `commit-payments.service`, `audit-emit`, `enum-guard`) + Σ-overflow guard + S9 audit homogeneity
  - **PR-D4** — payments routes + `enforce-audit-coverage` `payments.imported_batch` + `enforce.js` Promise.all ban + 13 integration tests
  - **PR-D5** — payments import wizard FE (EntityPicker 4 tiles, PaymentRowCard, CommitBlockedBanner deep-link, ResumeFromInvoicesBanner, EN/HI keys, offlineQueue:false)

**Post-7.1D cleanup:**
- **#149c COMPLETE (2026-05-28)** — legacy `src/features/data-import` deleted; `ROUTES.DATA_IMPORT` now `<Navigate replace>` → `/imports`; lazy import + App.tsx barrel entry removed; More nav card repointed to `ROUTES.IMPORTS`. `bulk-import` kept. (Also fixed a latent tsc error: checkout FSM test imported its type from `../` instead of `../../`.)

**Audit findings — all CLEAR:**
- M12 (CLEAR — PR-D2a) · M13 (CLEAR — PR-D2a) · S9 (CLEAR — PR-D3)
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
