# Backlog — resume 2026-06-01

> **2026-07-12 update (UI/UX gold-standard audit + root-cause fix pass):** ✅ Audit COMPLETE —
> mechanical grep scan (844 `.tsx` files) + full browser sweep of all 133 static routes, published to
> artifact `159c87a8-be7b-47d4-a5d9-75ee2e9a6fd6`. Every "page silently redirects" claim from the
> parallel-agent sweep was independently re-verified in an isolated single session before being
> trusted (7 concurrent `agent-browser` sessions briefly shared one CDP port and produced false
> positives — methodology note for next time: don't run audits with >3-4 concurrent browser sessions
> without per-agent isolated ports).
>
> 🔵 IN FLIGHT — root-cause fix pass on the confirmed findings, following `/hp-design` as SSOT for any
> UI touched. **TOMORROW — pick up here:**
> 1. ✅ **`/settings/tax-rates` blank pane — FIXED 2026-07-12.** Root cause: `server/src/routes/tax-categories.ts`
>    sent `sendSuccess(res, { categories })` (wrapped), but the FE service (`src/lib/services/tax.service.ts`)
>    already typed the `api()` result as flat `TaxCategory[]` — `api()` only unwraps one `.data` level, so the
>    hook received `{ categories: [] }`, not an array; `categories.length` was `undefined`, so neither the
>    empty nor success branch in `TaxCategoriesPage.tsx` matched → blank pane. Codebase-wide check found the
>    convention genuinely mixed (~50/50 flat vs. wrapped by endpoint), but each pair is normally self-consistent
>    except two live mismatches: tax-categories AND `server/src/routes/party-groups.ts` (`{ groups }` wrapper
>    vs. `party-group.service.ts`'s flat-array typing). Fixed both routes to send flat arrays (matches sibling
>    `categories.ts`/`units.ts` convention; no FE change needed). 5-whys + hypothesis in
>    `.claude/fix-trace-tax-rates.md`. Failing-test-first: new integration contract test
>    `server/src/__tests__/integration/tax-categories-party-groups.contract.test.ts` — confirmed red before the
>    fix, green after. Verified: server tsc clean, FE tsc clean, both contract tests + the existing
>    `categories-units.contract.test.ts` pass. (Local test DB had unrelated drift — a failed `CREATE INDEX
>    CONCURRENTLY` migration from a prior session — reset via drop/recreate + manual-SQL-then-`migrate resolve`,
>    same pattern documented in `PRISMA_MIGRATION_RULES.md`; dev DB untouched.) Still needs a live-browser
>    re-screenshot of `/settings/tax-rates` to close out the "visually re-verified" bar from the original audit.
> 2. ✅ **`/settings/templates` 404 — FIXED 2026-07-13.** Root cause was a genuine missing backend, not a
>    routing bug: the FE (`src/features/templates/*`) was a full scaffold against
>    `PRDs/invoice-templates-PLAN.md` with zero backend — no `InvoiceTemplate`/`InvoiceSettings` Prisma
>    models, no service, no route registered anywhere in `server/src/app.routes.ts`. This touches
>    `prisma/schema.prisma`, a HIGH_RISK_PATH, so it was built via the full mandated sequence rather than
>    a stub: `scope-writer` → `docs/SCOPE_invoice-templates.md`, `architect` →
>    `docs/ARCHITECTURE_invoice-templates.md` + `docs/API_CONTRACTS_invoice-templates.md` +
>    `.claude/design-plan-active.md` (approved), then `backend` build per the 17-row File Plan. New
>    `InvoiceTemplate`/`InvoiceSettings`/`TemplateDefault` Prisma models (add-only migration
>    `20260712190000_invoice_templates`, applied via `prisma migrate dev` — never `db push`), routes at
>    `/api/templates` + `/api/invoice-settings` matching the shipped FE contract exactly (bare
>    arrays/objects, `baseTemplate` as String+Zod-allowlist not a Prisma enum, opaque JSON `config`/
>    `printSettings` capped at 10KB, `isDefault` derived from `TemplateDefault` join rows, round-off
>    mapped enum↔wire-string at the boundary). Tenant isolation via explicit `where:{businessId}` +
>    `isDeleted`/`deletedAt` soft-delete registration (this repo's actual pattern, not scoped-prisma).
>    Verified: server tsc clean; `enforce.js` shows only the 4 pre-existing oversized-file errors
>    (untouched by this change); curl proof for 200 (list/create/settings-get/settings-put), 401
>    (no-auth), and 400 (invalid body); visually confirmed via dev-login session — `/settings/templates`
>    renders real templates with no 404 and no console errors.
>    _(Superseded note, kept for history: previously deferred pending a user decision among skip /
>    `/start-epic` / stub — see git history for the original entry.)_
>    which of those three paths to take**, or just run `/start-epic invoice-templates` directly.
> 3. ✅ **Black-bar rendering bug (marketing pages) — FIXED 2026-07-12**, checkout instance still open.
>    Root cause: three landing sections (`before-after-section.tsx`, `cta-section.tsx`,
>    `invoice-templates-section.tsx`) each render Framer Motion `whileInView` blocks starting at
>    `initial={{ opacity: 0 }}`, gated by a duplicated local `viewport={{ once: true, amount: 0.15 }}`
>    config with no lead-time margin. A fast scroll (flick-scroll, anchor jump, or main-thread jank on a
>    low-end Android device) moves the section into the viewport faster than the IntersectionObserver
>    callback + re-render + repaint pipeline can catch up, leaving it rendered at `opacity: 0` for several
>    frames — reads as solid black against the dark landing theme. Also an SSOT violation (3 duplicated
>    reveal helpers). Fixed by consolidating into `src/components/ui/motion-reveal.ts`
>    (`REVEAL_VIEWPORT` + `revealProps()`), adding `margin: '0px 0px 300px 0px'` to pre-trigger the
>    reveal before the section is visually reached. 5-whys + hypothesis in
>    `.claude/fix-trace-blackbar.md`. Verified: FE tsc clean; reproduced pre-fix via `agent-browser`
>    fast-scroll on an unauthenticated session at 375px and 1440px, re-ran the same repro post-fix —
>    no black rectangle on either viewport.
>    **Checkout instance — FIXED 2026-07-12 (separate root cause from the landing-page bug).**
>    Confirmed via dev-login session (`admin`/`admin123`) that `subscription-checkout/**` has zero
>    `motion`/`whileInView` usage — not the same bug. Grepped all HisaabPro-authored CSS/components in
>    the feature for `black`/`#000`/`rgba(0,0,0` — zero matches, so the black region isn't this app's own
>    code. Root cause: `MobileRazorpayCheckout.tsx` and `NativeRazorpayCheckout.tsx` both pass a Razorpay
>    `theme` object with only `color` (accent) set — neither ever sets `backdrop_color`, so Razorpay's
>    widget (an iframe/native view outside this app's CSS cascade) falls back to its own default opaque
>    black modal backdrop, visible as a black band around/behind its bottom-sheet on mobile. Fixed by
>    adding a shared `getRazorpayBackdropColor()` helper
>    (`subscription-checkout/utils/checkout-theme.utils.ts`) that resolves the app's own
>    `--backdrop-color` token value per theme, and passing it as `backdrop_color` in both call sites.
>    5-whys + hypothesis in `.claude/fix-trace-checkout-blackbar.md`. Verified: FE tsc clean. **Caveat:**
>    the real Razorpay widget could not be opened live in this dev environment — `server/.env` has no
>    `RAZORPAY_*` credentials, so `POST /subscription/checkout` fails server-side before the widget ever
>    renders. This is a documented-SDK-option fix based on code review, not a pixel-verified before/after;
>    recommend a follow-up visual check once a sandbox Razorpay test key is available.
> 4. ✅ **`/settings/units` low contrast — FIXED 2026-07-12.** Root cause: `src/features/units/units.css`
>    used raw `--color-gray-N` values instead of the semantic `--color-text-primary/secondary/muted` +
>    `--color-border` tokens, then manually remapped grays for dark mode using a Tailwind-style mental
>    model (low N = light) — but this codebase's `tokens-dark.css` inverts the gray scale in dark mode
>    (gray-50 = darkest bg, gray-900 = lightest text) specifically so semantic tokens flip correctly with
>    zero manual overrides. The manual override picked `--color-gray-100` for the unit name, which in dark
>    mode resolves to `#1A2030` against a `#141922` background — near-zero contrast. Also found the
>    leftover dark block used `@media (prefers-color-scheme: dark)` instead of this app's actual
>    `[data-theme="dark"]` toggle (`src/context/ThemeContext.tsx`) — converted to match. 5-whys in
>    `.claude/fix-trace-units-contrast.md`. Verified: tsc clean, `enforce.js` clean, re-screenshotted
>    light + dark (via the real `data-theme` toggle, not OS media emulation) — text/dividers now legible
>    in both themes.
> 5. ✅ **`/settings/transaction-controls` overlap — FIXED 2026-07-12.** Root cause:
>    `LockPeriodSection.tsx` placed `<Select>` as a bare flex child of `.txn-control-row`. Radix's
>    `Select.Root` renders no DOM node, so `.rx-select-trigger` (`width: 100%`, `overlay.css:110`) was the
>    actual flex item — a flex item with `flex-basis:auto` + a definite `width` transfers that width to its
>    flex-basis (flexbox spec), so the trigger's basis became ~100% of the row, leaving the label/
>    description sibling (`flex: 1`) almost no space and forcing its text to wrap into a narrow, visually
>    overlapping column. Fixed by wrapping the Select in a `.txn-control-select` div
>    (`flex-shrink: 0; min-width: 112px`) — the same fixed-width-sibling pattern `ThresholdSection`
>    already uses via `.txn-threshold-input`. 5-whys in `.claude/fix-trace-txn-controls-overlap.md`.
>    Verified: tsc clean, re-screenshotted at 375px before/after — dropdown now sits in its own column.
> 6. ✅ **E-Invoice / E-Way-Bill "rebuild" — FIXED 2026-07-12, root cause was dead code, not a design
>    debt.** The 5 flagged files (`src/features/e-invoice/*`, `src/features/e-way-bill/*`) were never
>    reachable from any route — `grep -rl "EInvoiceCard\|EWayBillCard" src` showed the app's real
>    compliance UI (`EComplianceSection.tsx`) imports from `src/features/documents/components/*` instead,
>    which was introduced by a later i18n/design-token standardization commit
>    (`7095be5 feat: full i18n compliance + design system standardization across all features`) that never
>    deleted the superseded folders. Verified the live components already meet every checklist item
>    (tokens, `<Button>`, `t.*` i18n — 12-30 occurrences per file, zero raw hex/`alert`/`window.confirm`).
>    Deleted both orphaned folders (11 files) instead of rebuilding unreachable code. 5-whys in
>    `.claude/fix-trace-einvoice-eway-dead-code.md`. Verified: FE tsc clean; `node scripts/enforce.js`
>    error count unchanged (4 pre-existing, unrelated oversized-file errors, confirmed via `git stash`
>    diff before/after this change).
> 7. Every `fix:` commit above needs its own `.claude/fix-trace-<short>.md` (5-whys + failing test first)
>    per the root-cause discipline in `~/.claude/CLAUDE.md` — don't batch them into one commit.
> 8. Re-screenshot each fixed page (golden path) before marking done; this whole pass started from a
>    visual audit, so "done" means visually confirmed, not just tsc-clean.

> **2026-05-31 update (V2 Appointments):** 🔵 IN FLIGHT — full BE + FE + reminder trigger + migration **committed `b6b33e3`** (101 files, +11,159 LOC; pre-commit clean: enforce.js + tsc + ratchets). Tests: 49/49 BE (incl. cross-tenant, public-booking-signature, soft-delete-guard) + 46/46 FE. Multi-agent ceremony PASS (scope-auditor, architecture-auditor, security).
>
> **TOMORROW (2026-06-01) — pick up here:**
> 1. **Verifier pass** — curl evidence (200/401/404/409/400) for `/appointments`, `/appointments/:id/convert`, `/appointments/:id/waitlist`, `/p/book/:slug`. Screenshot evidence at 320 / 375 / 768 / 1024 (capture artifacts only — **no live Chrome driving**, another session is using the browser).
> 2. **QA pass** — cross-tenant isolation, soft-delete guard re-verify, offline-replay (replay-bus + api-queue-replay), HMAC signature rejection.
> 3. **Ramp plan** — write `docs/ROLLOUT_V2_APPOINTMENTS.md`: 4-stage cohort behind `featureV2Appointments` (internal → 10% → 50% → 100%). Mirrors Phase 6 rollout doc structure.
> 4. **Doc sync** — once verifier + QA green, move V2 row in HISAABPRO.md §5 from 🔵 IN FLIGHT to ✅ SHIPPED, update sequence line.
>
> **2026-05-30 update:** P4 Consistency Sweep COMPLETE. Waves 17–20 ratcheted all 6 enforce-primitives surfaces to zero (`rawSelect` 58→0, `rawTextarea` 30→0, `rawInput` 294→0, `rawButton` 594→0; `nativeConfirm`/`missing*State` already zero). New primitives: `<Textarea>` (naked + wrapped). New modes: `<Input>` naked, `<Button variant="none"` + forwardRef. Pre-commit blocks regressions. Wave 20 is a mechanical wrap — semantic variant upgrade is a follow-up workstream.

> **2026-05-30 update (V7):** ✅ FULLY SHIPPED. (1) MULTILINE custom-field fieldType (additive — no migration), DOCUMENT-scoped (d2d9a0c). (2) Party-scoped FE wiring: PartyFormCustomFields + 4th tab on Create/Edit + read-render on Overview (9301c5d). Server `customFieldValues` shape now matches FE PartyDetail.

> **Next autonomous-doable (no creds, no multi-week ceremony):** V2 verifier + QA + rollout doc (above), then P4 semantic upgrade pass (convert `<Button variant="none">` to real variants page-by-page).



> Snapshot at 2026-05-28. **141/150 shipped — Phase 6 COMPLETE + Phase 7 9/10.**
> Phase 1 (60/70 code-complete, 10 cred-blocked) · Phase 2 (20/20) · Phase 3 (21/22, #89 deferred → folds into #147) · Phase 4 (16/16) · **Phase 5 (14/14)** · **Phase 6 (6/6) ✅ SHIPPED** (merge `caa390d`, 9 PRs + 2 hardening commits, BE/FE/security/QA all green) · Phase 7 (**9/10** — #141 OCR + #142 voice + #144 GST + #145 Verticals + #146 predictive + #147 auto-recon + #148 smart-inv + #149 Competitor imports + #150 multi-user collab). Remaining: #143 (creds-blocked).
>
> **Branch state:** `hisaabpro` is **0 commits ahead of `master`** (merged 2026-05-26 `caa390d`). Subsequent pre-beta hardening landed directly on master: money-SSOT PR #2 (`7c97b33`), refresh-token family rotation, security batch A (CSV + Sentry/logger PII scrub), W4b FE test-contract sweep (1306/1306). **Render production deploy still trails master — push to redeploy is the only remaining ship step.**
>
> **Next up:** Render redeploy + set env vars (subscription, Aisensy, MSG91). Phase 7 only #143 left (creds-blocked). See "Resume order" below.

> **Done (2026-07-13):** Onboarding 6-step journey rebuild — Welcome → Business
> Details (name/phone/location) → Business Type (existing `VerticalPicker`) →
> How do you work? → Choose your path → Ready, replacing the old 3-step flow.
> New fields (`businessLocation`, `dataSource`, `startPath`) are frontend-only,
> not sent to `POST /businesses` (no backend field yet — out of scope, would
> touch Prisma/HIGH_RISK). Browser-verified end-to-end incl. real business
> creation. Found + fixed a real bug during verification: `goToDashboard`
> bounced back to `/onboarding` because `AuthContext.businesses` wasn't
> refreshed post-creation — fixed via the existing `refreshActiveBusiness()`.

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

### 6. Phase 7 — AI & Differentiators (1 remaining: #143 creds-blocked; #141 OCR + #142 voice + #144 GST + #145 verticals + #146 predictive + #147 auto-recon + #148 smart-inv + #149 importers + #150 multi-user done)
- ~~#142 Voice entry (browser SpeechRecognition + on-device fallback)~~ — **DONE 2026-05-28**: speak-or-type a money entry → pure transcript parser (Hindi+English Indian phrasing: "do hazaar paanch sau", "1.5 lakh", "rent mila 5000 upi") → editable preview → saves directly via expense/other-income services. Web Speech API (`en-IN`) with typed-textarea fallback when unsupported/denied. `/voice-entry` FE (PRO + expenses gate), 22 parser tests. Live mic needs a real device to verify.
- #143 WhatsApp bot billing (Aisensy inbound webhook → invoice draft) — **high leverage / lock-in** — blocked: webhook high-risk gate + missing Aisensy creds
- ~~#144 Smart GST filing assistant (rules engine on Phase 2 data)~~ — **DONE 2026-05-28**: deterministic pre-filing readiness validator over a period's sale/note docs. 7 rules (B2B GSTIN, GSTIN format, place-of-supply, HSN/SAC, interstate split, composition-charging-GST, zero-tax). `/api/gst/filing-readiness` (PRO + reports.view); `/gst/filing-readiness` FE with blocker/warning tiers + deep-links to offending invoices. 18 tests.
- ~~#146 Predictive analytics (sales/stock forecast)~~ — **DONE 2026-05-28**: deterministic OLS revenue trend + sales-velocity stock-out forecast. `/api/analytics/*` gated on `advancedReports`; `/insights` FE (no charting lib — tiny SVG sparkline).
- ~~#147 Auto-reconciliation (bank statement → payment match)~~ — **DONE 2026-05-28** (absorbs #89 bank rec): upload a bank CSV → client-side parser → staged `BankStatementLine` rows → deterministic match engine (amount exact +60/≤1% +30; date 0d+25→≤14d+0; ref/party token +15; direction CREDIT↔PAYMENT_IN, DEBIT↔PAYMENT_OUT; ≥70 SUGGESTED / 50-69 WEAK / <50 UNMATCHED) → confirm/manual-match/ignore/un-reconcile. Annotation-only join table (`ReconciliationMatch`, `lineId @unique` idempotency) — never mutates Payment/ledger. Bounded pool (±14d, 5000 ceiling, poolTruncated flag), TOCTOU `updateMany count===1` + P2002→409 guards. `/api/bank-reconciliation/*` (PRO + reports.view); `/bank-reconciliation` FE (More→Accounting card). 23 unit tests on the pure core.
- ~~#148 Smart inventory (reorder suggestions based on velocity)~~ — **DONE 2026-05-28**: velocity-based reorder *suggestions* layer over static #114 reorderQty. Reuses #146 `forecast.math.ts`. `/api/inventory/reorder-suggestions` (auth-only, reads, products gate FE); `/inventory/reorder-suggestions` FE with urgency tiers (out/critical/low/ok), lead-time + coverage params. 15 tests.
- ~~#149 Competitor data importers (Tally/Vyapar/MyBillBook)~~ — DONE (legacy retired #149c 2026-05-28)
- ~~#150 Real-time multi-user collaboration (presence + conflict resolution)~~ — **DONE 2026-05-28**: spike decided **LWW + optimistic locking (NOT CRDT)** — money records must not silently auto-merge. Monotonic `version Int @default(0)` on Document/Payment/Party/Product; the lock lives IN the write (`bumpVersionOrConflict` runs an atomic conditional `updateMany WHERE version=expected` inside the field-write transaction — count!==1 → 409 `CONFLICT` with `{serverVersion, updatedBy}`, tenant-scoped to avoid cross-tenant id leakage). Client sends last-read version via `X-Entity-Version` (absent/malformed → unguarded back-compat write). Presence is in-memory + oracle-free (`Map<businessId,Map<userId,entry>>`, 45s TTL, GET peers does no DB hit). FE: `useConflictReconcile` → `<ConflictDialog>` (reload / overwrite) wired into all 4 edit flows (party/product/payment/invoice), `usePresence` + `<PresenceAvatars>` in each edit Header. FE+BE tsc clean, enforce green, presence routes 401/403 guarded.

Next: #143 WhatsApp bot — blocked on creds + webhook high-risk gate.

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
| ~~**V1 — Services time tracking on Jobs**~~ ✅ SHIPPED 2026-05-29 | services, freelancer, salon, clinic | — | `JobItemKind` enum (`ITEM`\|`HOURLY`, default ITEM) discriminator + `Job.estimatedHours`/`actualHours` (Decimal, nullable, tracking-only). HOURLY reuses the exact existing line math (`round(qty×rate)−discount`) — quantity=hours, rate=rate/hr; hours never summed into money. Additive migration. FE: per-line Item/Hourly toggle (relabels qty→Hours, rate→Rate/hr), estimate-vs-actual variance chip, detail-page "Xh @ ₹Y/hr" sub-label. 6 BE route proofs. **Convert-to-invoice deviation:** the hourly `(Xh @ ₹Y/hr)` description annotation was dropped — the document line schema has no per-line description field and editing it was outside approved scope; the money base (`round(hours×rate)`) carries through unchanged. |
| **V2 — Appointments calendar** | salon, clinic | ~2 wks (HIGH) | New `Appointment` model + slot picker + availability view. Onboarding blocker. |
| ~~**V3 — Recipe cost dashboard**~~ ✅ SHIPPED 2026-05-28 | restaurant, bakery, manufacturing | — | Derives cost-per-unit + margin from active BOMs (`weightedAvgCostPaise`, fallback `purchasePrice`). Read-only, auth-gated like BOM, no schema. `GET /api/recipe-cost`, `/recipe-cost` page, More→Production card (navKey `bom`). 13 math unit tests. |
| **V4 — Staff assignment + commission split** | services, bakery, tailor, manufacturing | ~2 wks | Assign staff to Jobs/Orders/POS sales. Builds on Phase 6 #128 commission ledger. |
| ~~**V5 — Customer delivery reminders**~~ ✅ SHIPPED 2026-05-29 | bakery, tailor | — | Added `ORDER_DELIVERY` to `ReminderRuleTrigger` (enum migration `ADD VALUE`); `orderDeliveryCandidates()` fires `offsetDays` **days** before `CustomOrder.deliveryAt` (RECEIVED/IN_PRODUCTION/READY, isDeleted:false, deduped by party), reusing the entire Epic A reminder-cron/dispatch pipeline. FE: 6th trigger option in picker + list label + i18n (en/hi). 3 candidate tests. Day-granular — hour-precision "N hours before" deferred → FUTURE_EPIC (needs `offsetHours` + idempotency-key redesign). Live send still cred-blocked (AISENSY/MSG91 unset). Plan deviation: `ReminderRuleListPage.tsx` exhaustive map also needed widening (not in files_planned; non-high-risk FE, gate-permitted). |
| **V6 — Table management + KOT** | restaurant | LARGE | Out of MSME billing scope. Defer to v2 product. |
| ~~**V7 — Prescription field**~~ ✅ FULLY SHIPPED 2026-05-30 | pharmacy, clinic | — | (1) MULTILINE fieldType (additive — no migration), DOCUMENT-scoped (Textarea render, max 2000 chars, PDF resolver). (2) PARTY-scoped FE wiring: PartyFormCustomFields component + 4th tab on Create/Edit + read-render card on Overview. Server `customFieldValues` shape now matches FE PartyDetail. |

Recommended sequence (post merge-to-prod):
1. ~~V3 (3 days, no schema, big restaurant/bakery win)~~ ✅ SHIPPED 2026-05-28
2. ~~V1 (1 wk, unblocks hourly billing — biggest current user complaint)~~ ✅ SHIPPED 2026-05-29
3. ~~V5 (3 days, depends on Epic A)~~ ✅ SHIPPED 2026-05-29
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
