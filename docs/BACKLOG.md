# Backlog — resume 2026-05-17

> Snapshot at 2026-05-17 18:58 IST. **133/150 shipped — Phase 5 COMPLETE.** Phase 4 complete (16/16). **Phase 5 Epic A SHIPPED** (Marketing FE — 3 slices, 36 files, +221 EN/HI keys). **Phase 5 Epic B SHIPPED** (#122/#132/#133/#134). **Phase 5 Epic C SHIPPED** (#121/#129/#130/#131 — public surface at `/p/*`, SharedLink + HMAC tokens, UPI QR, storefront, invite/OTP). **Phase 5 Epic D SHIPPED** (#125 Loyalty + #127 CRM + #128 Commission — merge `63ccef4`, Security Pass-2 PASS, QA Gate GREEN 49/49). **Subscription port SHIPPED** (DH gating model: state machine, UPI Autopay, offline JWT, PRO_MAX tier — commit `3530e79`). **Responsive sweep complete** (Waves 0-7, `7c12683`..`5b8d3fe`). **Backend audit green** (0 P0/P1/P2 after `bf1d166` + `be574fd`).
>
> **Branch state:** `hisaabpro` is **64 commits ahead of `master`**. Production deploy at commit `89610b0`. Nothing since Phase 4 finish has been merged to master/prod.
>
> **Next up:** ship-to-prod (merge `hisaabpro` → `master`, set Render env vars) **OR** Phase 6 (#135-#140 Staff & HR — touches User model, mandatory `scope-writer → architect → security`). See "Resume order" below.

## Resume order

### 0. Ship-to-prod gate (NOT optional — recommend doing first)

`hisaabpro` carries 57 commits of unshipped work. Before starting any new epic, decide whether to:

- **Merge `hisaabpro` → `master`** to get Phase 5 Epic A/B/C + subscription port + responsive sweep + audit hardening into production
- **OR keep accumulating** on `hisaabpro` and ship Epic D first (riskier — bigger blast radius if a regression slips through)

Before merge: set Render env vars (`ENTITLEMENT_JWT_PRIVATE_KEY`, `ENTITLEMENT_JWT_PUBLIC_KEY`, `RAZORPAY_WEBHOOK_SECRET` for subscription; `MARKETING_ENABLED=true`, `AISENSY_API_KEY`, `AISENSY_WEBHOOK_SECRET`, `MSG91_WEBHOOK_TOKEN` for Epic A launch). Run `npx prisma migrate deploy` (subscription port added 4 new tables + UpiMandate). Smoke-test public surface at `/p/inv/<token>`, `/p/store/<slug>`, `/p/invite/<token>`.

---

### 1. Phase 5 Epic A — Marketing Comms FE ✅ SHIPPED 2026-05-15

Three slices on `hisaabpro`:
- Slice 1 — Hub + Templates — commit `9b1f096` (+63 EN/HI keys)
- Slice 2 — Campaigns wizard (3 pages + 5 wizard step components + AudiencePicker + RecipientTable + status badges + 4 hooks) — commit `016a1c8` (+108 keys)
- Slice 3 — Reminders + Opt-outs + party-row chip — commit `9d281de` (+50 keys)

Backend was already live (PR1-6 commits `3ea2cdc`..`5c2e3ca`). FE delivered i18n compliance, design-token-only colors, 4 UI states per page, real Hindi translations, EN/HI parity 980:980, ≤250 LOC/file, all enforce/tsc/offline gates green.

**Render env to set before launch endpoint goes live:** `MARKETING_ENABLED=true`, `AISENSY_WEBHOOK_SECRET`, `AISENSY_API_KEY`, `MSG91_WEBHOOK_TOKEN`.

---

### 1b. Subscription port ✅ SHIPPED 2026-05-15

Commit `3530e79` on `hisaabpro` (mission `subscription-port`).

- 7-state state machine (19 transitions) with writer SSOT + pg_advisory_xact_lock
- 4 new tables: SubscriptionEvent (immutable audit, unique razorpayEventId for idempotency), FeatureAddon, BusinessAddon, UpiMandate
- UPI Autopay mandate flow (create/status/cancel) with VPA last-4 masking
- RS256 offline entitlement JWT (24h TTL, trustedTime clock-rewind detect) + public-key endpoint
- Overflow grace period + cron jobs (trial-end, mandate-reminder, grace-expiry)
- Razorpay webhook hardening: HMAC + 5-min replay + businessId resolved server-side
- Admin grant routes (requireSuperAdmin + rate-limit + ledger row per action)
- FE: state-aware PlanGate, OverflowBanner, MandateSetupDrawer, SubscriptionManagePage at `/settings/subscription`
- enforce.js +2 checks (Writer-SSOT-ban, JWT-in-logs-ban)
- 5-step Prisma migration (nullable add → backfill → NOT NULL → indexes → new tables)

PRDs: `PRDs/subscription-port-{SCOPE,ARCHITECTURE,SECURITY,TASKS}.md`. Mission archive: `.claude/missions/subscription-port.md`.

**Render env to set before activation:** `ENTITLEMENT_JWT_PRIVATE_KEY` (RS256 PEM), `ENTITLEMENT_JWT_PUBLIC_KEY` (SPKI PEM), `RAZORPAY_WEBHOOK_SECRET`.

---

### 2. Phase 5 Epic B — Sales workflow ✅ SHIPPED 2026-05-15

Commits `6193d28` (PR1) + `3626a0c` (PR2+3+4) on `hisaabpro`.

- **#122 Sales pipeline** — lineage service walks sourceDocumentId/convertedTo (businessId-scoped, 10-hop cap); SalesHub + Estimate/SaleOrder/Challan list+detail+create pages; PipelineTimeline on every detail; CreateInvoicePage reused via `type?: DocumentType` prop.
- **#132 Multiple price lists** — additive `Document.priceListId` nullable FK; cross-tenant guard in create/update services; `usePriceListOverride` + `PriceListOverrideSelector` drawer (4 UI states).
- **#133 BOGO custom-role** — `roleRef.permissions` projected into `BusinessSummary.permissions`; `useBogoPermission` widened to allow `invoicing.bogo`.
- **#134 Invoice custom fields** — react-pdf `PdfCustomFieldsSection` rendered between line-items and totals; filtered by `showOnInvoice` + `documentTypes` + businessId.

Security findings 1.1, 2.1, 2.2, 3.2, 4.1 all FIXED (see `docs/SECURITY_AUDIT_EPIC_B.md`). Translation ext35 (sales), ext36 (price-list), ext37 (PDF custom fields) added.

---

### 3. Phase 5 Epic C — Customer-facing ✅ SHIPPED 2026-05-15

Commits `d78f7c9`..`237b551` on `hisaabpro`. Five-PR epic delivered as scoped in `docs/SCOPE_EPIC_C_customer_facing.md` + `docs/ARCHITECTURE_EPIC_C_customer_facing.md`.

- **PR1 — Shared infra** (`d78f7c9` + `35e060a` + `7fc8773`): `SharedLink` model, reserved-slugs registry, public router + `resolvePublicToken` middleware + rate limiter (60 rpm/IP), `PublicShell` + `/p/*` route scaffold + health page.
- **#129 UPI Payment Collection** (`a148ba3`, PR2): UPI QR + `upi://pay?...` deep-link on invoice detail. VPA validation. Adapted from DudhHisaab per reuse rule.
- **#130 Web Invoice Links** (`77c645a` BE + `9dbbf54` FE, PR3): HMAC-signed `/p/inv/:token`, share drawer, expiry + per-link revocation.
- **#121 Online Store / Digital Catalog** (`d47b84a` BE + `ea1b9ae` FE, PR4): public `/p/store/:slug`, StorefrontSettingsPage, slug-rules + reserved-slugs guard.
- **#131 Invite Parties** (`15fb596` BE + `ea37c19` FE, PR5): `/p/invite/:token` with OTP gate, one-shot signup token bound to businessId, party-invite service.
- **Refactor** (`237b551`): split invite routes + tighten party/storefront under 250 LOC + logger swap.

Security audit `docs/SECURITY_AUDIT_EPIC_C.md` cleared. Public surface is auth-free but rate-limited; tokens are HMAC + expiry + revocable.

---

### 4. Phase 5 Epic D — CRM + Loyalty + Commission ✅ SHIPPED 2026-05-17
**Merge commit:** `63ccef4` (7 commits: PR1 `b61e1a1` → PR6 `4f93808`)

Built on isolated git worktree `/Users/sawanjaiswal/Projects/HisaabPro-epic-d` to avoid colliding with other CLI sessions, then merged into `hisaabpro`.

- **#125 Loyalty** — PR3 `1bb2fcc` BE + PR4 `d8eb926` FE. `LoyaltyProgram` + `LoyaltyLedger` schemas, FIFO accrual ledger, `pg_try_advisory_xact_lock` for concurrent redemption safety, POS checkout step 10.5 (redeem) + 10.6 (accrue) inside `$transaction`, void writes VD (negative), restore writes VR (compensating), `'15 4 * * *' Asia/Kolkata` expiry cron. FE: program settings page, balance chip in PaymentSheet/CustomerSelector, redemption sheet, party-detail loyalty tab + ledger.
- **#127 CRM Basics** — PR2 `ea27525`. Party tags (server-side, filterable) + follow-ups query with `withinDays` cap (1..365) + `lastContactedAt` service. FE: PartyCrmTab + TagFilterBar + tag chip on party detail header.
- **#128 Staff Commission** — PR5 `340d5bc` BE + PR6 `4f93808` FE. Commission rule CRUD with PRODUCT > CATEGORY > ALL specificity, `JSON.parse(JSON.stringify(rule))` deep-clone at 2 sites (M1 — historical ledger integrity under admin edits), CommissionLedger row written inside SAME `$transaction` as POS sale or invoice, void/restore symmetry, `commissionLedgerAuth` factory middleware (M5), STAFF_NOT_FOUND 404 cross-tenant guard (M4), rate cap at 10000 bps with `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT` (S2). FE: CommissionRuleForm with yellow warn at 5000 bps + red block at 10000 bps, ledger, leaderboard (sortable), staff dashboard widget (hidden if no `commission.view` perm).

Architecture-audit Pass 5 PASS · Security Pass-2 PASS (0 MUST_FIX, 1 SHOULD_FIX deferred = cron multi-pod systemic, also affects other crons — fix in cross-cutting cron-hardening epic) · QA Gate GREEN (49/49 §17 acceptance criteria, 10/10 cross-cutting gates, 3/3 mechanical: tsc clean, enforce 0 errors, vitest baseline preserved 347/353).

Audit + design docs: `docs/SCOPE_EPIC_D_*.md`, `docs/ARCHITECTURE_EPIC_D_*.md` (v5), `docs/SECURITY_AUDIT_EPIC_D_*.md` (Pass 1 + Pass 2), `docs/ARCHITECTURE_AUDIT_EPIC_D_*.md`, `docs/QA_GATE_EPIC_D_*.md`, `docs/TASKS_EPIC_D_*.md`.

---

### 5. Phase 6 — Staff & HR (6 features)
- #135 Staff attendance (clock-in/out, geofence optional)
- #136 Payroll
- #137 Salary slips (PDF)
- #138 Multi-firm management (tenant switcher within one user)
- #139 Advanced audit trail (who changed what, when)
- #140 Transaction PIN (4-digit PIN gate on sensitive actions)

#138 touches User model + auth → mandatory `scope-writer → architect → security`.
#139 may extend existing audit log infra (search `services/audit*` first).
#140 reuses biometric gate pattern from DudhHisaab.

---

### 6. Phase 7 — AI & Differentiators (9 remaining; #141 OCR done)
- #142 Voice entry (browser SpeechRecognition + on-device fallback)
- #143 WhatsApp bot billing (Aisensy inbound webhook → invoice draft)
- #144 Smart GST filing assistant (build on Phase 3 GST data)
- #145 Industry vertical modes (preset templates per trade)
- #146 Predictive analytics (sales/stock forecast)
- #147 Auto-reconciliation (bank statement → payment match)
- #148 Smart inventory (reorder suggestions based on velocity)
- #149 Competitor data importers (Tally/Vyapar import)
- #150 Real-time multi-user collaboration (presence + conflict resolution)

Highest leverage: #143 (lock-in), #146 (margin story), #149 (acquisition).
Highest risk: #150 (CRDT or LWW — needs architecture spike).

---

### 7. Phase 1 cred-blocked unlocks (when keys land)
Razorpay · Aisensy (also unblocks Epic A webhooks) · Resend · FCM · Capacitor biometric.

### 8. Phase 3 deferred
#89 Bank Reconciliation — was deferred from Phase 3, fits naturally with Phase 7 #147.

---

### 9. Per-vertical depth (audit 2026-05-09)

Verticals are wired (nav filtering, terminology, defaults, Jobs flow, Custom Orders flow). Gap is **depth per vertical**, not coverage. Candidates:

| Epic | Verticals | Effort | Notes |
|---|---|---|---|
| **V1 — Services time tracking on Jobs** | services, freelancer, salon, clinic | ~1 wk | Add `hoursEstimated`, `hoursActual`, `ratePerHour` on Job; hour-based invoice line type. Plumber/freelancer cannot bill hourly today. |
| **V2 — Appointments calendar** | salon, clinic | ~2 wks (HIGH) | New `Appointment` model + slot picker + availability view + link to Job. Onboarding blocker for salon/clinic. |
| **V3 — Recipe cost dashboard** | restaurant, bakery, manufacturing | ~3 days | Derive cost-per-unit from existing BOM data. UI-only; no schema. Quick win. |
| **V4 — Staff assignment + commission split** | services, bakery, tailor, manufacturing | ~2 wks | Assign staff to Jobs/Orders/POS sales; commission rules per product/category. Overlaps Phase 6 #128. |
| **V5 — Customer delivery reminders** | bakery, tailor | ~3 days | Auto-trigger marketing-comms reminder N hours before delivery slot. Requires Epic A live. |
| **V6 — Table management + KOT** | restaurant | LARGE | Out of MSME billing scope. Defer to v2 product. |
| **V7 — Prescription field** | pharmacy, clinic | trivial | Likely solvable today via generic custom fields. Validate before scoping. |

Sequencing recommendation (after Phase 5 Epic A merges):
1. V3 (3 days, no schema, big restaurant/bakery win)
2. V1 (1 wk, unblocks hourly billing — biggest current user complaint)
3. V5 (3 days, depends on Epic A)
4. V2 (2 wks, salon/clinic onboarding)
5. V4 (2 wks, overlaps Phase 6 Staff & HR — fold together)

V1, V2, V4 touch schema → mandatory `scope-writer → architect → (security if billing path) → task-manager` ceremony.

---

## Open files to remember
- `.claude/design-plan-active.md` — last approved for Epic D (in the worktree, gitignored); replace before starting the next epic.
- Shipped epic docs (don't archive — referenced for context): `docs/SCOPE_phase5_marketing_comms.md`, `docs/SCOPE_EPIC_B_sales_workflow.md`, `docs/SCOPE_EPIC_C_customer_facing.md`, `docs/SCOPE_EPIC_D_crm_loyalty.md`, `docs/SCOPE_132_price_lists.md`. Companion `ARCHITECTURE_*.md` + `SECURITY_AUDIT_*.md` + `QA_GATE_EPIC_D_*.md` + `ARCHITECTURE_AUDIT_EPIC_D_*.md` next to each.
- Subscription port PRDs: `PRDs/subscription-port-{SCOPE,ARCHITECTURE,SECURITY,TASKS}.md`. Mission archive: `.claude/missions/subscription-port.md`.

## Quick commands
- **Ship-to-prod (recommended next):** merge `hisaabpro` → `master`, set Render env, `npx prisma migrate deploy` (Epic D added 4 new tables + 2 Party columns + composite index in migration `20260518000000_phase5_epic_d_crm_loyalty_commission`), smoke-test loyalty redemption + commission ledger + party CRM tab.
- **Worktree cleanup:** `git worktree remove /Users/sawanjaiswal/Projects/HisaabPro-epic-d` then `git branch -d epic/phase-5-d-crm-loyalty` (only after the merge is confirmed shipping).
- **Start Phase 6:** `/start-epic phase-6-staff-hr` — touches User model + auth (#138), mandatory `scope-writer → architect → security`.
- **Start vertical depth V3 (recipe cost):** `/start-epic vertical-v3-recipe-cost-dashboard`
- **Roadmap:** `docs/ROADMAP.md` — keep in sync after every epic.
- **Re-audit doc accuracy:** ask Claude "WHATS LEFT and whats done? deep audit, update the docs" — this re-runs the doc/code reconciliation that produced the latest snapshot.
