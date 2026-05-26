# TASKS — Phase 5 Epic D: CRM + Loyalty + Commission

> **Source-of-truth:** `docs/ARCHITECTURE_EPIC_D_crm_loyalty.md` (v5, PASS) ·
> `docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md` (v3, PASS_WITH_GAPS, all 5 MUST
> + 4 SHOULD closed, 2 NEW_S folded into v4 §17.1) · `docs/SCOPE_EPIC_D_crm_loyalty.md`
>
> **Worktree:** `/Users/sawanjaiswal/Projects/HisaabPro-epic-d`
> **Branch:** `epic/phase-5-d-crm-loyalty`
> **Plan file:** `.claude/design-plan-active.md` (status: approved)
>
> Build queue. Each PR has its own proof gate. The task-manager / verifier
> reads this file to enforce that proof exists BEFORE QA runs and BEFORE
> the next PR opens.

## Conventions

- **Files touched:** row-numbers reference `ARCHITECTURE_EPIC_D §7.2 file plan`.
  53 create + 32 edit total = **85 files** across 7 PRs.
- **Owner agent:** `backend` for BE / schema / route / migration work,
  `frontend` for React/TS UI work. Cross-cutting integration sits with the PR's
  primary owner (PR2 + PR4 + PR6 are mixed; PR1 + PR3 + PR5 are BE-only;
  PR7 = security re-audit + targeted fixes).
- **Acceptance gate:** the §17.1 / §17.2 / §17.3 bullets from the architecture
  that THIS PR is responsible for. Proof artifact paths shown.
- **No PR opens without:** the previous PR in its dependency chain merged
  AND its proof file on disk.
- **PR5 critical rebase:** PR5 MUST be rebased on PR3 before final review.
  See architecture §8 PR5 callout — silent overwrite of loyalty restore logic
  is the failure mode. CI grep `applyRedemption|restoreForPosSale` is the gate.

---

## PR1 — Schema + Migration + Shared Types (FOUNDATION)

**Owner:** `backend`
**Depends on:** — (foundation)
**Goal:** PR1 establishes the schema, migration, shared types, Zod schemas,
errors, constants, permissions data, analytics wrapper, and translation
skeletons. Zero user-visible features ship in PR1.

**Files (approx 30):**
- `server/prisma/schema.prisma` (edit, +99L incl. M3 composite index) — row #1
- `server/prisma/migrations/20260518000000_phase5_epic_d_crm_loyalty_commission/migration.sql` (create, ~95L) — row #2
- `server/src/lib/analytics.ts` (create, ~60L) — row #2b
- `server/src/types/loyalty.types.ts` (create, ~80L) — row #3
- `server/src/services/loyalty/loyalty.constants.ts` (create, ~50L) — row #4
- `server/src/services/loyalty/loyalty.utils.ts` (create, ~90L, BigInt insurance) — row #4b
- `server/src/services/loyalty/loyalty.errors.ts` (create, ~50L) — row #5
- `server/src/schemas/loyalty.schema.ts` (create, ~90L) — row #6
- `server/src/types/party-crm.types.ts` (create, ~60L) — row #17
- `server/src/schemas/party.schemas.ts` (edit, +35L, M2 + M3 allow-list) — row #24
- `server/src/types/commission.types.ts` (create, ~80L) — row #28
- `server/src/services/commission/commission.constants.ts` (create, ~40L) — row #29
- `server/src/services/commission/commission.errors.ts` (create, ~55L, STAFF_NOT_FOUND + RATE_MAX) — row #30
- `server/src/schemas/commission.schema.ts` (create, ~125L, S2 rateBps.max(10000)) — row #31
- `server/src/services/settings/permissions-data.ts` (edit, +30L) — row #27b
- `src/lib/translations.en.ext38.ts` (create, ~140L) — row #40
- `src/lib/translations.hi.ext38.ts` (create, ~140L) — row #41
- `src/lib/translations.en.ext39.ts` (create, ~110L) — row #42
- `src/lib/translations.hi.ext39.ts` (create, ~110L) — row #43
- `src/lib/translations.en.ext40.ts` (create, ~120L) — row #44
- `src/lib/translations.hi.ext40.ts` (create, ~120L) — row #45
- `src/lib/translations.ts` (edit, +24L mount) — row #46

**Acceptance gate (architecture §16 backend + §17 generic):**
- [ ] `cd server && npx prisma migrate dev --name phase5_epic_d_crm_loyalty_commission` succeeds against pristine DB
- [ ] `cd server && npx tsc -b --noEmit` returns 0
- [ ] `npx tsc -b --noEmit` (client) returns 0
- [ ] Translation parity check: every key in `translations.en.*.ts` exists in `translations.hi.*.ts`
- [ ] `PERMISSION_MATRIX` lints clean — new keys for `loyalty.*` and `commission.*` present per §6.4

**Proof file:** `/tmp/epic-d-pr1-proof.txt`
- Output of `npx prisma migrate dev` (or `migrate status` showing migration applied)
- Output of `npx tsc -b --noEmit` (server + client)
- Output of `node scripts/enforce.js` clean (no new violations)
- `ls -la server/prisma/migrations/20260518000000_phase5_epic_d_crm_loyalty_commission/`

---

## PR2 — CRM Basics #127 (BE + FE)

**Owner:** `backend` (lead — BE files dominate; FE is wired in same PR for `lastContactedAt` integration)
**Depends on:** PR1
**Goal:** Wire `lastContactedAt` to existing share + reminder flows. Add follow-up
queue route and FollowUpsPage. Tag filter bar on parties list. Ship the
pre-commit grep rule (M2) blocking server-only Party fields in input schemas.

**Files (approx 24):**

Backend:
- `server/src/services/party/followups.service.ts` (create, ~140L, M3 service-layer clamp) — row #18
- `server/src/services/party/tags.service.ts` (create, ~90L) — row #19
- `server/src/services/party/last-contacted.service.ts` (create, ~80L) — row #20
- `server/src/routes/documents/share.ts` (edit, +8L, wire lastContactedAt) — row #21
- `server/src/services/collections/bulk-reminder.service.ts` (edit, +8L) — row #22
- `server/src/services/payment/reminders.ts` (edit, +12L) — row #23
- `server/src/services/party/list-get.ts` (edit, +18L, tag query) — row #25
- `server/src/services/party/update-delete.ts` (edit, +6L) — row #26
- `server/src/routes/party.ts` (edit, +70L, M3 followUpsQuerySchema + INVALID_WITHIN_DAYS_RANGE) — row #27
- `scripts/enforce.js` (edit, +25L, M2 grep rule #91b) — row #91b

Frontend:
- `src/features/crm/crm.types.ts` (create, ~60L) — row #64
- `src/features/crm/api/crm.service.ts` (create, ~100L) — row #65
- `src/features/crm/hooks/useTagSummary.ts` (create, ~60L) — row #66
- `src/features/crm/hooks/useFollowUps.ts` (create, ~85L, M3 error mapping) — row #67
- `src/features/crm/components/TagFilterBar.tsx` (create, ~150L) — row #68
- `src/features/crm/components/FollowUpDatePicker.tsx` (create, ~130L) — row #69
- `src/features/crm/components/FollowUpRow.tsx` (create, ~120L) — row #70
- `src/features/crm/pages/FollowUpsPage.tsx` (create, ~160L) — row #71
- `src/features/parties/PartiesPage.tsx` (edit, +30L, TagFilterBar mount) — row #72
- `src/features/parties/PartyDetailPage.tsx` (edit, +22L, CRM landing) — row #73
- `src/features/parties/components/PartyFormBasic.tsx` (edit, +28L, opt-out toggle no-op) — row #74
- `src/styles/components.crm.css` (create, ~130L) — row #89

**Acceptance gate (architecture §17.2):**
- [ ] `GET /api/parties?tag=vip` returns only matching parties
- [ ] `GET /api/parties/tags` returns aggregated tags with counts
- [ ] `GET /api/parties/follow-ups?withinDays=7` returns parties where `followUpAt <= now + 7d AND followUpAt IS NOT NULL`
- [ ] Sharing an invoice triggers `lastContactedAt = now()`
- [ ] `PATCH /api/parties/:id` with past `followUpAt` returns 400 `INVALID_FOLLOWUP_PAST`
- [ ] **(v3 / M2)** PATCH `{ lastContactedAt: '1970-01-01' }` returns 400 ZodError; party row UNCHANGED (test 12.13)
- [ ] **(v3 / M2)** Pre-commit grep blocks `lastContactedAt|loyaltyPointsCache|loyaltyOptOut` in `server/src/schemas/party.schemas.ts` (rule #91b)
- [ ] **(v3 / M3)** `GET /api/parties/follow-ups?withinDays=400` → 400 `INVALID_WITHIN_DAYS_RANGE`; `?withinDays=365` → 200 (test 12.14)
- [ ] FollowUpsPage 4 UI states pass at 320px
- [ ] TagFilterBar handles 0-tag / 1-tag / 50-tag states
- [ ] All 5 FE edits target REAL worktree files (no phantom paths — v2 / M3)
- [ ] All API calls via `api()` from `@/lib/api`; mutations carry `entityType` + `entityLabel`

**Proof file:** `/tmp/epic-d-pr2-proof.txt`
- curl 200 success path on `/api/parties?tag=vip`, `/api/parties/tags`, `/api/parties/follow-ups?withinDays=7`
- curl 400 ZodError on PATCH with lastContactedAt, and on follow-ups withinDays=400
- curl 401 unauthenticated on each new route
- Screenshots (320px + 375px + dark mode): FollowUpsPage 4 UI states, TagFilterBar 0/1/50-tag states, PartyDetailPage CRM landing
- Grep output confirming pre-commit rule blocks server-only fields

---

## PR3 — Loyalty #125 backend

**Owner:** `backend`
**Depends on:** PR1
**Goal:** Loyalty program CRUD, balance/ledger reads (with cross-tenant 404
precheck per NEW_S1), accrual + redemption services hooked into POS checkout
inside the existing `$transaction`. Cron at 04:15 IST. Void/restore symmetry.
Route-layer `posCheckoutAuth` for S3.

**Files (approx 14):**
- `server/src/services/loyalty/loyalty-balance.service.ts` (create, ~110L) — row #7
- `server/src/services/loyalty/loyalty-accrual.service.ts` (create, ~180L) — row #8
- `server/src/services/loyalty/loyalty-redeem.service.ts` (create, ~170L) — row #9
- `server/src/services/loyalty/loyalty-program.service.ts` (create, ~130L) — row #10
- `server/src/services/loyalty/loyalty-expiry.cron.ts` (create, ~150L) — row #11
- `server/src/routes/loyalty.routes.ts` (create, ~150L) — row #12
- `server/src/lib/cron-scheduler.ts` (edit, +14L, mount cron at 04:15 IST) — row #13
- `server/src/services/pos/pos-checkout.service.ts` (edit, +35L, splice loyalty steps 10.5/10.6) — row #14
- `server/src/routes/pos-sales.ts` (edit, +25L, posCheckoutAuth between `auth` and `requireIdempotencyKey`) — row #14b
- `server/src/services/pos/pos.validators.ts` (edit, +30L, BigInt cross-multiply) — row #15
- `server/src/services/pos/pos-void.service.ts` (edit, +50L, void + restore symmetry, deep-clone re-snapshot) — row #16
- `server/src/services/report/report-daybook.ts` (edit, +15L, loyalty_redemption tender line) — row #16b
- `server/src/app.ts` (edit partial, +3L, mount loyalty routes) — row #39 (partial)

**Acceptance gate (architecture §17.1):**
- [ ] `GET /api/loyalty/program` returns `null` for businesses with no program
- [ ] `PUT /api/loyalty/program` rejects negative rates
- [ ] `LoyaltyLedger` row written inside the SAME `$transaction` as `PosSale` (test 12.1)
- [ ] Redemption uses FIFO oldest-AC-first
- [ ] Expiry cron writes EX rows for entries where `expiresAt < now`
- [ ] Walk-in party does NOT accrue points
- [ ] `loyalty_redemption` is **lowercase** in every wire-format and DB row (M2)
- [ ] Restore reverses negation rows symmetrically (M6 / test 12.12)
- [ ] Cron registered at **04:15 IST** in `cron-scheduler.ts` (M1)
- [ ] **(v3 / S1)** `computePointsEarned(1_000_000_000_000, 10_000) === 10_000_000_000` (BigInt overflow test 12.11)
- [ ] **(v3 / S3)** POS POST with `payments[].mode === 'loyalty_redemption'` by user lacking `loyalty.redeem` → 403 `PERMISSION_DENIED` AT ROUTE LAYER (BEFORE tx opens; test 12.15: zero PosSale rows + zero idempotency rows)
- [ ] **(v3 / S3)** `posCheckoutAuth` mounted between `auth` and `requireIdempotencyKey` in `pos-sales.ts:62`; existing `requirePermission('pos.create')` and `idempotencyCheck()` preserved AFTER the new middleware
- [ ] **(v4 / NEW_S1)** `GET /api/loyalty/balance/:partyId` and `GET /api/loyalty/ledger/:partyId` with cross-tenant `partyId` return 404 `PARTY_NOT_FOUND` (test 12.16)
- [ ] **(v4 / NEW_S2)** POS POST with `loyalty_redemption` payment AND cross-tenant `partyId` returns 400 `PARTY_NOT_IN_TENANT` BEFORE tx opens; idempotency token NOT consumed (test 12.17)
- [ ] Day-end report shows `loyalty_redemption` as its own tender line (S3)
- [ ] Analytics emitted via `analyticsEmit(...)` (M5)

**Proof file:** `/tmp/epic-d-pr3-proof.txt`
- Integration tests §12.1, §12.11, §12.12, §12.15, §12.16, §12.17 — all pass
- curl 200/401/400/403/404 on each new route (loyalty.routes)
- Cron dry-run output showing 04:15 IST registration
- Grep: `git grep -n "posCheckoutAuth" server/src/routes/pos-sales.ts` returns match line 62 area
- Grep: `git grep -n "applyRedemption\|restoreForPosSale" server/src/services/pos/` returns matches (baseline for S4)

---

## PR4 — Loyalty #125 frontend

**Owner:** `frontend`
**Depends on:** PR3 (PR4 is built against PR3's shipped API contracts)
**Goal:** Loyalty UI — program settings page, balance chip, redeem sheet,
ledger list, Party detail loyalty tab. PaymentSheet wires `loyalty_redemption`
payment mode. CustomerSelector shows balance chip.

**Files (approx 19):**
- `src/features/loyalty/loyalty.types.ts` (create, ~80L) — row #47
- `src/features/loyalty/loyalty.constants.ts` (create, ~40L) — row #48
- `src/features/loyalty/loyalty.utils.ts` (create, ~80L) — row #49
- `src/features/loyalty/api/loyalty.service.ts` (create, ~130L) — row #50
- `src/features/loyalty/hooks/useLoyaltyProgram.ts` (create, ~90L) — row #51
- `src/features/loyalty/hooks/useLoyaltyBalance.ts` (create, ~80L) — row #52
- `src/features/loyalty/hooks/useLoyaltyLedger.ts` (create, ~90L) — row #53
- `src/features/loyalty/components/LoyaltyProgramForm.tsx` (create, ~210L) — row #54
- `src/features/loyalty/components/LoyaltyBalanceChip.tsx` (create, ~90L) — row #55
- `src/features/loyalty/components/LoyaltyRedeemSheet.tsx` (create, ~210L) — row #56
- `src/features/loyalty/components/LoyaltyLedgerList.tsx` (create, ~170L) — row #57
- `src/features/loyalty/pages/LoyaltyProgramPage.tsx` (create, ~150L) — row #58
- `src/features/pos/components/payment/PaymentSheet.tsx` (edit, +35L, loyalty payment mode) — row #59
- `src/features/pos/components/customer/CustomerSelector.tsx` (edit, +25L, balance chip) — row #60
- `src/features/parties/components/PartyDetailLoyaltyTab.tsx` (create, ~190L) — row #61
- `src/features/parties/PartyDetailPage.tsx` (edit, +18L, TABS array + render — NEW_S1 union update) — row #61b
- `src/features/parties/usePartyDetail.ts` (edit, +2L, DetailTab union 'loyalty') — row #61c
- `src/features/pos/api/pos.service.ts` (edit, +15L, build payments[] payload) — row #62
- `src/features/pos/state/pos.store.ts` (edit, +20L, loyaltyPointsRedeemed) — row #63
- `src/styles/components.loyalty.css` (create, ~110L) — row #90

**Acceptance gate (architecture §17.1 frontend):**
- [ ] Loyalty UI page passes 4 UI states (Loading / Error / Empty / Success) at 320px
- [ ] PartyDetailPage Loyalty tab visible only when `LoyaltyProgram.enabled === true`
- [ ] LoyaltyRedeemSheet — points → discount preview live; FIFO order shown
- [ ] LoyaltyBalanceChip on CustomerSelector — opt-in `cacheReads: true` for balance read
- [ ] Offline simulation: redeem mutation queues with `entityType: 'loyalty'` + meaningful `entityLabel`
- [ ] Dark-mode parity (no `dark:` classes; CSS-var swap auto)
- [ ] All API calls via `api()`; no raw `fetch()`
- [ ] **(v3 NEW_S1 pre-merge grep)** `git grep "type DetailTab" src/features/parties/` returns matches in BOTH `PartyDetailPage.tsx` AND `usePartyDetail.ts` with `'loyalty'` present (or single import from shared `party.types.ts`)
- [ ] Console clean at every page load (no warnings)

**Proof file:** `/tmp/epic-d-pr4-proof.txt`
- Screenshots (320px + 375px + 1280px + dark mode): LoyaltyProgramPage 4 states, LoyaltyRedeemSheet 4 states, PartyDetailLoyaltyTab 4 states, CustomerSelector with balance chip, PaymentSheet with loyalty_redemption mode
- DevTools network panel showing `api()` used (no raw `fetch()`)
- Offline-mode screenshot: queued mutation showing "Saving loyalty redeem — Raju Traders"
- Grep output for DetailTab parity check

---

## PR5 — Commission #128 backend  ⚠️ MUST rebase on PR3

**Owner:** `backend`
**Depends on:** PR3 (MUST rebase per architecture §8 / v3 / S4) + PR1
**Goal:** Commission rule CRUD, accrual service with deep-clone ruleSnapshot
(M1), ledger reads with factory middleware (M5) + cross-tenant precheck (M4),
leaderboard route. Splices into POS checkout AS step 10.7 (alongside loyalty
steps 10.5/10.6 from PR3).

> **CRITICAL REBASE:** PR5 edits `server/src/services/pos/pos-checkout.service.ts`
> AND `server/src/services/pos/pos-void.service.ts` — both ALREADY edited in
> PR3. If PR5's branch is stale, the merge will look clean but silently
> overwrite PR3's loyalty restore-refund logic. Rebase PR5 onto post-PR3
> `epic/phase-5-d-crm-loyalty` HEAD BEFORE the final review pass. Verify with:
> `git grep "applyRedemption\|restoreForPosSale" server/src/services/pos/`
> — MUST still return PR3's matches after rebase.

**Files (approx 10):**
- `server/src/services/commission/commission-rule.service.ts` (create, ~180L) — row #32
- `server/src/services/commission/commission-accrual.service.ts` (create, ~240L, M1 deep-clone × 3 sites) — row #33
- `server/src/services/commission/commission-ledger.service.ts` (create, ~150L, M4 precheck helper) — row #34
- `server/src/routes/commission.routes.ts` (create, ~225L, M4 + M5) — row #35
- `server/src/middleware/commission-ledger-auth.ts` (create, ~50L, M5 factory) — row #27c
- `server/src/services/pos/pos-checkout.service.ts` (re-edit, splice commission step 10.7) — row #14/36 (same file as PR3)
- `server/src/services/pos/pos-void.service.ts` (re-edit, commission void/restore symmetry) — row #16 (same file as PR3)
- `server/src/services/document/create.ts` (edit, +18L, hook commission on invoice issue) — row #37
- `server/src/services/document/update.ts` (edit, +14L) — row #38
- `server/src/app.ts` (edit partial, +3L, mount commission routes) — row #39 (partial)

**Acceptance gate (architecture §17.3):**
- [ ] `POST /api/commission/rules` creates rule
- [ ] CommissionLedger row written inside SAME `$transaction` as POS sale / invoice
- [ ] PRODUCT > CATEGORY > ALL rule specificity (test 12.4)
- [ ] Voiding writes a NEGATIVE commission row (sum nets to 0)
- [ ] **Restoring** writes a COMPENSATING commission row (sum returns to original) (M6)
- [ ] `GET /api/commission/ledger?staffUserId=X` returns 403 when caller has `commission.view` but is not staffUserId X AND X is same-tenant
- [ ] `GET /api/commission/leaderboard` returns 403 without `commission.view_all`
- [ ] Day-end report shows `loyalty_redemption` as own tender line (S3 — verified in PR3, regression-tested here)
- [ ] Analytics emitted via `analyticsEmit(...)` — NOT `notificationManager.notify` (M5)
- [ ] **(v3 / M1)** `commission-accrual.service.ts` calls `JSON.parse(JSON.stringify(...))` at ledger.create site. Grep: `git grep -n "JSON.parse(JSON.stringify" server/src/services/commission/commission-accrual.service.ts` ≥ 2 matches (accrue + re-snapshot in void/restore)
- [ ] **(v3 / M1)** Test 12.12 step 5: admin-editing the rule mid-flight does NOT change historical ledger rows' `meta.ruleSnapshot.rateBps`
- [ ] **(v3 / M4)** `GET /api/commission/ledger?staffUserId=<other_tenant_user_uuid>` returns **404 STAFF_NOT_FOUND** (test 12.8 step 6)
- [ ] **(v3 / M4)** Same-tenant precheck not bypassed for owners — owner requesting other-tenant user's UUID still gets 404 (test 12.8 step 8)
- [ ] **(v3 / M5)** `server/src/middleware/commission-ledger-auth.ts` exists (file plan #27c)
- [ ] **(v3 / M5)** `git grep -n "commissionLedgerAuth\|res.headersSent" server/src/routes/commission.routes.ts` — factory imported AND used; `res.headersSent` MUST NOT appear
- [ ] **(v3 / S2)** `POST /api/commission/rules` with `rateBps: 15000` → 400 `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT`
- [ ] **(v3 / S4)** Post-PR5-merge: `git grep -n "applyRedemption\|restoreForPosSale" server/src/services/pos/` STILL returns the loyalty service calls. (If empty, PR5 silently overwrote PR3 — block merge.)

**Proof file:** `/tmp/epic-d-pr5-proof.txt`
- Integration tests §12.4, §12.12 (all 13 steps), §12.8 — all pass
- curl 200/401/400 (rateBps cap)/403 (factory denies cross-staff)/404 (cross-tenant) on commission routes
- Grep output: deep-clone grep ≥ 2 matches; factory grep matches; headersSent grep empty
- S4 rebase grep output confirming loyalty calls still present
- Permissions matrix test output

---

## PR6 — Commission #128 frontend

**Owner:** `frontend`
**Depends on:** PR5
**Goal:** Commission UI — rule CRUD form (with 50% / 100% rate warnings),
ledger page, leaderboard table, staff dashboard widget.

**Files (approx 16):**
- `src/features/commission/commission.types.ts` (create, ~80L) — row #75
- `src/features/commission/commission.constants.ts` (create, ~40L) — row #76
- `src/features/commission/api/commission.service.ts` (create, ~135L, M4 STAFF_NOT_FOUND toast) — row #77
- `src/features/commission/hooks/useCommissionRules.ts` (create, ~115L, S2 rate warnings) — row #78
- `src/features/commission/hooks/useCommissionLedger.ts` (create, ~110L) — row #79
- `src/features/commission/hooks/useLeaderboard.ts` (create, ~80L) — row #80
- `src/features/commission/components/CommissionRuleForm.tsx` (create, ~235L, S2 UI warning + hard block) — row #81
- `src/features/commission/components/CommissionRuleList.tsx` (create, ~140L) — row #82
- `src/features/commission/components/CommissionWidget.tsx` (create, ~130L) — row #83
- `src/features/commission/components/LeaderboardTable.tsx` (create, ~190L) — row #84
- `src/features/commission/pages/CommissionSettingsPage.tsx` (create, ~160L) — row #85
- `src/features/commission/pages/CommissionLedgerPage.tsx` (create, ~150L) — row #86
- `src/features/commission/pages/LeaderboardPage.tsx` (create, ~130L) — row #87
- `src/features/dashboard/components/StaffDashboardSection.tsx` (create, ~120L) — row #88
- `src/features/dashboard/DashboardPage.tsx` (edit, +10L, mount StaffDashboardSection) — row #88b
- `src/styles/components.commission.css` (create, ~120L) — row #91

**Acceptance gate (architecture §17.3 frontend):**
- [ ] Staff widget hidden when user lacks `commission.view`
- [ ] All 4 UI states pass on CommissionSettingsPage, CommissionLedgerPage, LeaderboardPage, StaffDashboardSection
- [ ] **(v3 / S2)** FE CommissionRuleForm shows warning at 5000 bps (50%) and hard-blocks save at 10000 bps (100%)
- [ ] Sortable leaderboard (by amount, sale-count, name)
- [ ] Rate form blocks at 100% — server returns `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT` (FE handles error toast)
- [ ] Commission leaderboard pagination cap honored (`take ≤ 50`)
- [ ] All API calls via `api()`; mutations carry `entityType: 'commission_rule'` + `entityLabel`
- [ ] 320px renders without horizontal scroll
- [ ] Dark-mode parity (no `dark:` classes)
- [ ] i18n keys in BOTH `translations.en.ts` AND `translations.hi.ts`
- [ ] Console clean

**Proof file:** `/tmp/epic-d-pr6-proof.txt`
- Screenshots (320px + 375px + 1280px + dark mode): CommissionSettingsPage 4 states, CommissionLedgerPage 4 states, LeaderboardPage 4 states, StaffDashboardSection
- Rate form screenshots showing 50% warning + 100% hard block
- Widget-hidden test (login as user without `commission.view`)
- Sortable leaderboard screenshot

---

## PR7 — Security audit re-run + fixes

**Owner:** `security` (audit) + `backend` / `frontend` (any fixes)
**Depends on:** PR1-PR6 merged
**Goal:** Re-run security audit against the shipped code. Land any
remediation items the auditor surfaces. Produce Pass-2 verdict.

**Files:** TBD by security agent's re-audit. Expected to be small targeted
fixes if any (the v3 audit already cleared MUST + SHOULD).

**Acceptance gate:**
- [ ] `docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md` Pass-2 produced with verdict PASS or CONDITIONAL_PASS
- [ ] All §17.1/§17.2/§17.3 grep tests re-confirmed against shipped code:
  - [ ] `git grep -n "JSON.parse(JSON.stringify" server/src/services/commission/commission-accrual.service.ts` ≥ 2
  - [ ] `git grep -n "posCheckoutAuth" server/src/routes/pos-sales.ts` ≥ 1
  - [ ] `git grep -n "applyRedemption\|restoreForPosSale" server/src/services/pos/` ≥ 2
  - [ ] `git grep -n "commissionLedgerAuth" server/src/routes/commission.routes.ts` ≥ 1
  - [ ] `git grep -n "res.headersSent" server/src/routes/commission.routes.ts` returns empty
- [ ] All MUST_FIX / SHOULD_FIX items closed (Pass-2 PASS)
- [ ] BACKLOG.md / ROADMAP.md / CHANGELOG.md updated

**Proof file:** `/tmp/epic-d-pr7-proof.txt`
- Security audit Pass-2 file path + verdict
- Output of every §17 grep test
- BACKLOG diff showing #125, #127, #128 marked shipped
- Stage-1 internal rollout note (Sawan's test business — 24h)

---

## Build queue summary

```
PR1 → PR2 ─┐
           │
   PR1 → PR3 → PR4 ─┐
                    │
   PR1 + PR3 → PR5 (rebase!) → PR6 → PR7
```

| # | PR | Owner | Depends on | Proof file |
|---|----|-------|-----------|-----------|
| 1 | PR1 — Schema + migration + shared types | backend | — | /tmp/epic-d-pr1-proof.txt |
| 2 | PR2 — CRM #127 (BE + FE) | backend (lead) | PR1 | /tmp/epic-d-pr2-proof.txt |
| 3 | PR3 — Loyalty BE #125 | backend | PR1 | /tmp/epic-d-pr3-proof.txt |
| 4 | PR4 — Loyalty FE #125 | frontend | PR3 | /tmp/epic-d-pr4-proof.txt |
| 5 | PR5 — Commission BE #128 (⚠ rebase on PR3) | backend | PR3 + PR1 | /tmp/epic-d-pr5-proof.txt |
| 6 | PR6 — Commission FE #128 | frontend | PR5 | /tmp/epic-d-pr6-proof.txt |
| 7 | PR7 — Security audit re-run + fixes | security + backend | PR1-PR6 | /tmp/epic-d-pr7-proof.txt |

**Total:** 85 files (53 create + 32 edit). Largest BE file: `commission-accrual.service.ts`
at 240 LOC. Largest FE file: `CommissionRuleForm.tsx` at 235 LOC. **No row >
250 LOC.**

---

## Stop-for-human signals (per task-manager rule)

This epic does NOT trigger any stop-for-human conditions:
- No DB column drops (purely additive)
- No data deletion
- No paid-service enable (Razorpay etc. unchanged)
- No shared-contract break (POS checkout extends, doesn't replace)

The task-manager resolves all blocked / redo / verifier states autonomously
per the workflow header in this project's task-manager agent file.

## Postmortem triggers

Auto-invoke Postmortem Agent if:
- QA rejects any of PR1-PR7 (any BLOCKERs)
- Redo Agent runs more than once on the same PR
- Verifier fails more than twice on the same feature (loyalty/CRM/commission)

Postmortem updates land back into `docs/POSTMORTEM_EPIC_D_*.md` and feed
agent-file improvements.
