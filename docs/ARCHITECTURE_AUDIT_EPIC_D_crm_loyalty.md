# ARCHITECTURE AUDIT — Phase 5 Epic D (CRM + Loyalty + Commission)

> Audited 2026-05-17 13:20 IST by architecture-auditor agent
> Against: `SCOPE_EPIC_D_crm_loyalty.md` (§19 Locked Decisions immutable)
> Subject: `ARCHITECTURE_EPIC_D_crm_loyalty.md` (1,476 lines, 17 sections)

## Verdict: **BLOCK**

`ARCHITECTURE_EPIC_D_crm_loyalty.md` cannot proceed to security review. Six MUST_SHIP gaps found, including two scope-conformance breaks (path deviations that don't compile against the worktree), one operational collision that will silently fail in production, and one money-equivalent ledger correctness gap.

---

## SCOPE Conformance Map (selected)

| SCOPE decision | Architecture artifact | Status |
|----------------|----------------------|--------|
| §19 Q1 — Per-business flat earn rate | §2.1 `Business.loyaltyEarnBps Int @default(100)` | OK |
| §19 Q2 — Cash-equivalent redemption (₹1 = 1 point) | §3.2 redemption logic + `redeemValuePaise = points` | OK |
| §19 Q12 — Sale creator only commission | §3.3 `createdById` on PosSale + `userId` on Document | OK |
| §19 Q18 — No-fold of tip/discount | §2 omits tip column, redemption isolated to dedicated payment line | OK |
| §6.4 Schema — `Party.lastContactedAt`, `lastContactedChannel` | §2 Party delta — 2 new nullable columns + 2 indexes | OK |
| §6.5 Schema — `LoyaltyLedger` AC/RD/EX/AD/VD entry types | §2 enum `LoyaltyEntryType` | OK |
| §10 File Plan — `src/features/parties/components/PartyDetailTabs.tsx` | §7 same path | **MISSING — file does not exist** |
| §10 File Plan — `src/features/parties/components/PartyDetailPage.tsx` | §7 same path | **MISSING — page lives at feature root** |
| §10 File Plan — `src/features/parties/components/PartyListPage.tsx` | §7 same path | **MISSING — real path `PartiesPage.tsx`** |
| §10 File Plan — `src/features/parties/components/PartyForm.tsx` | §7 same path | **MISSING — real form is 4 sub-components** |
| §10 File Plan — `src/features/dashboard/components/StaffDashboardSection.tsx` (edit) | §7 same path tagged "edit" | **DEVIATED — CREATE not EDIT** |
| §6 Schema — `Role.permissions` JSON | §6 names `server/src/services/staff/role.constants.ts` | **MISSING — real path `services/settings/permissions-data.ts`** |
| §13.2 — Loyalty expiry cron at 02:30 IST | §10 cron `'30 2 * * *'` | **CONFLICT — slot occupied by `runExpenseRecurringGenerator`** |
| §6.6 — Webhook for redemption telemetry | §10 `notificationManager.notify('loyalty_redeemed', …)` | **DEVIATED — user-facing only, typed `EventKey` enum** |
| §11 — Void/restore semantics | §3.4 covers `voidPosSale`; silent on `restorePosSale` | **MISSING — silently fails to re-accrue** |

**Scope conformance breaks: 6.** Automatic BLOCK per auditor rule.

---

## MUST_SHIP gaps (block epic — fix before security agent runs)

### M1 — Cron timeslot collision at 02:30 IST

- **Where:** Architecture §10 schedules `runLoyaltyExpiry` at `'30 2 * * *'` IST.
- **Reality:** `server/src/lib/cron-scheduler.ts:60` already runs `runExpenseRecurringGenerator` at exactly that slot.
- **Failure mode:** Render Starter Postgres has a single-replica connection pool. Two long-running jobs that each take an advisory lock will contend on connections, and stacked at the same minute they're a recipe for the slower job to never complete during the burst window.
- **Industry pattern:** `cron-scheduler.ts` already spaces jobs (subscription grace at 03:00, opt-in cleanup at 03:30). Pick an unused slot — 02:45 or 04:15 IST.
- **Fix:** Change to `'15 4 * * *'` IST. Amend doc + state rationale.
- **Severity:** MUST_SHIP. Cron collisions are silent until ledger drift, by which point reconstruction takes hours.

### M2 — Payment mode enum case mismatch (`LOYALTY_REDEMPTION` vs lowercase peers)

- **Where:** Architecture §3.2 proposes extending `paymentModeSchema` to include `'LOYALTY_REDEMPTION'`.
- **Reality:** `server/src/services/pos/pos.validators.ts:10` reads `z.enum(['cash', 'upi', 'card', 'bank_transfer', 'other'])` — all lowercase. DB column, route bodies, audit logs, FE switch statements all assume lowercase.
- **Failure mode:** Mixed-case enum values double the maintenance surface. Existing reporting queries (`WHERE mode = 'cash'`) won't match `'LOYALTY_REDEMPTION'` rows. Cash register count, mixed-payment ledger, and CSV exports all need branching.
- **Fix:** Rename to `'loyalty_redemption'` throughout §3.2 and §10.
- **Severity:** MUST_SHIP. Contract that lands in DB rows on day one of PR3, near-impossible to migrate later without a full table scan.

### M3 — Five non-existent FE file paths in §7 File Plan

- **Where:** Architecture §7 names files for PR4 (CRM lastContacted UI) and PR6 (loyalty redemption sheet wiring):
  - `src/features/parties/components/PartyDetailPage.tsx` — does NOT exist
  - `src/features/parties/components/PartyListPage.tsx` — does NOT exist
  - `src/features/parties/components/PartyDetailTabs.tsx` — does NOT exist
  - `src/features/parties/components/PartyForm.tsx` — does NOT exist
  - `src/features/dashboard/components/StaffDashboardSection.tsx` — does NOT exist (tagged `edit`)
- **Reality:** Worktree FE structure is:
  - `src/features/parties/PartiesPage.tsx` (list page)
  - `src/features/parties/PartyDetailPage.tsx` (feature root, NOT under `components/`)
  - `src/features/parties/EditPartyPage.tsx`
  - `src/features/parties/components/PartyFormBasic.tsx`, `PartyFormBusiness.tsx`, `PartyFormCredit.tsx`, `PartyFormPriceList.tsx` (4 form sub-components, no master `PartyForm.tsx`)
  - `src/features/dashboard/components/` has `DashboardHeader.tsx`, `AlertStrip.tsx`, `TxnRow.tsx` — no `StaffDashboardSection.tsx`
- **Failure mode:** Builder agent runs `Edit` against non-existent files, silently creates orphan files, or burns /garden cycles. PR4 and PR6 each lose half a day.
- **Fix:** Re-derive file plan from actual `src/features/parties/` and `src/features/dashboard/components/` trees. Replace 5 rows with real targets:
  - `src/features/parties/PartyDetailPage.tsx` (edit — add loyalty balance + last-contacted strip)
  - `src/features/parties/PartiesPage.tsx` (edit — add last-contacted chip in row)
  - NEW `src/features/parties/components/PartyDetailLoyaltyTab.tsx` (250L cap)
  - Confirm whether loyalty opt-out lives in PartyFormBasic or new sub-form
  - `src/features/dashboard/components/StaffDashboardSection.tsx` re-tag as CREATE not EDIT
- **Severity:** MUST_SHIP. Blocks PR4 and PR6 entirely.

### M4 — Wrong permission registry path

- **Where:** Architecture §6.1 specifies adding new permission keys into `server/src/services/staff/role.constants.ts`.
- **Reality:** That path does not exist. Real registry is `server/src/services/settings/permissions-data.ts` (289 lines, all 5 system roles defined: Salesman, Cashier, Stock Manager, Delivery Boy, Accountant).
- **Failure mode:** Builder creates NEW file at proposed path, real registry untouched. Permission middleware reads from `settings/permissions-data.ts`; new permissions never checked. Silent permission bypass — every staff member can hit every new endpoint regardless of role.
- **Fix:** Rewrite §6.1 to point at `server/src/services/settings/permissions-data.ts`. Update §6.3 — defaults per system role need merging into existing role definitions in that file.
- **Severity:** MUST_SHIP. Auth-adjacent. Cannot go to security with broken permission model.

### M5 — Analytics events routed through user-facing `notificationManager`

- **Where:** Architecture §10 emits `notificationManager.notify('loyalty_accrued', ctx)`, etc.
- **Reality:** `server/src/services/notifications/notification-manager.ts` is typed against `EventKey` from `notification-events.ts`, a closed `CORE_EVENT_KEYS` enum (`INVOICE_CREATED`, `PAYMENT_RECEIVED`, `OTP_REQUESTED`). User-facing — emits in-app toasts, push, email. New keys require enum entries + template rows + would notify users.
- **Failure mode:** Either (a) builder bypasses type-check with `as EventKey` and ships a runtime null-template crash, OR (b) builder adds keys to user-facing enum and we spam customers ("Your customer accrued 12 points").
- **Fix:** Use `server/src/lib/logger.ts` structured logging OR introduce dedicated `analyticsEmit('event_name', ctx)`. NOT `notificationManager`.
- **Severity:** MUST_SHIP. Misrouted telemetry = silent ops failure.

### M6 — `restorePosSale` not addressed

- **Where:** Architecture §3.4 covers void reversal but is silent on restore.
- **Reality:** `server/src/services/pos/pos-void.service.ts` exposes BOTH `voidPosSale` AND `restorePosSale`.
- **Failure mode:** Customer support voids a sale by mistake, then restores. Loyalty points stay deducted (VD entries stand). Commission stays deducted. Trust erodes silently.
- **Fix:** Add §3.4.1 covering `restorePosSale`. Either (i) write VR entries for both ledgers cancelling original VD; or (ii) forbid `restorePosSale` for posts with loyalty/commission attached, document operational workaround.
- **Severity:** MUST_SHIP. Money-equivalent ledger correctness.

---

## SHOULD_SHIP gaps (fix before relevant PR merges)

### S1 — Permission naming convention departs from house style

- Existing keys use `<resource>.<action>` (`parties.view`, `invoicing.create`). Architecture proposes `commission.read.self`, `commission.read.all`, `loyalty.config`, `crm.followup.write` — different sub-namespace style.
- **Fix:** Rename to fit (`commission.view`, `commission.view_all`, `loyalty.configure`, `crm_followup.create`) OR document new sub-action namespace.

### S2 — Loyalty unit math comment incorrect

- §2.1 comment "earnBps=100 means 1% so ₹100 → 1 point" glosses over paise conversion. A developer could implement `pointsEarned = subtotalPaise * earnBps / 10000` and get 100 points per ₹100 sale.
- **Fix:** Spell out `pointsEarned = floor(subtotalPaise * earnBps / 1_000_000)`. Add unit test for ₹100 → 1 point and ₹999 → 9 points (floor).

### S3 — Cash register accounting drift

- `pos-checkout.cash.ts:51` counts cash only when `mode === 'cash'`. Day-end reconciliation may show phantom shortfall if loyalty_redemption uncategorized.
- **Fix:** Verify `pos-reports.service.ts` path and document whether loyalty_redemption shows as "Other tenders" or dedicated category.

### S4 — "Mirrors exactly" claim about cron-grace-expiry is wrong

- §3.3 and §3.5 cite `cron-grace-expiry.ts` as advisory-lock pattern. Reality: that file is unguarded. Real pattern lives in `subscription.writer.ts:25-30` (`acquireAdvisoryLock`).
- **Fix:** Correct §3.3 and §3.5 to cite real source.

### S5 — System role defaults not updated for new permissions

- §6.3 specifies how 5 system roles should treat 7 new permission keys but doesn't tabulate which existing rows to edit.
- **Fix:** Add §6.4 table `(systemRole, newPermissionKey, defaultValue)` for all 5×7=35 cells.

---

## FUTURE_EPIC

- **F1** — Tiered earn rates → Epic E
- **F2** — Multi-currency loyalty → defer (Indian-only deployment)
- **F3** — Commission ladders → defer (flat-rate locked in SCOPE)
- **F4** — Loyalty point gifting → defer (new permission + ledger type needed)

---

## What the architecture got right

- Schema delta is additive only; migration order correct
- POS `$transaction` boundary insertion points (steps 10.5/10.6/10.7) surgically chosen
- Walk-in sentinel pattern respected (`isWalkIn` short-circuit)
- `document/create.ts` + `document/update.ts` insertion points correct (`!wasSaved && willBeSaved`)
- Bulk-reminder `touchLastContactedMany` slotted inside existing `$transaction` at line 166
- `/whatsapp` + `/email` share routes correctly identify existing `$transaction` blocks
- Cache-on-logout safety: `loyalty/balance/:partyId` safe to `cacheReads: true` (clearApiCache on logout)

---

## Spot-checked file paths

| Path | Exists |
|------|--------|
| `server/src/services/pos/pos-checkout.service.ts` | YES |
| `server/src/services/pos/pos-checkout.cash.ts` | YES |
| `server/src/services/pos/pos-checkout.walkin.ts` | YES |
| `server/src/services/pos/pos-void.service.ts` | YES (also `restorePosSale` — M6) |
| `server/src/services/pos/pos.validators.ts` | YES (lowercase enum — M2) |
| `server/src/services/document/create.ts` | YES |
| `server/src/services/document/update.ts` | YES |
| `server/src/services/document/convert.ts` | YES |
| `server/src/services/payment/reminders.ts` | YES |
| `server/src/services/collections/bulk-reminder.service.ts` | YES |
| `server/src/routes/documents/share.ts` | YES |
| `server/src/lib/cron-scheduler.ts` | YES (02:30 slot occupied — M1) |
| `server/src/services/subscription/cron-grace-expiry.ts` | YES (no advisory lock — S4) |
| `server/src/services/subscription/subscription.writer.ts` | YES (real advisory-lock source) |
| `server/src/services/staff/role.constants.ts` | **NO** (M4 — real: `services/settings/permissions-data.ts`) |
| `server/src/middleware/permission.ts` | YES |
| `server/src/services/notifications/notification-manager.ts` | YES (user-facing only — M5) |
| `src/features/parties/PartiesPage.tsx` | YES (arch said `components/PartyListPage.tsx`) |
| `src/features/parties/PartyDetailPage.tsx` | YES (at feature root) |
| `src/features/parties/components/PartyDetailTabs.tsx` | **NO** (M3) |
| `src/features/parties/components/PartyForm.tsx` | **NO** (M3) |
| `src/features/parties/EditPartyPage.tsx` | YES |
| `src/features/pos/components/payment/PaymentSheet.tsx` | YES |
| `src/features/pos/components/customer/CustomerSelector.tsx` | YES |
| `src/features/dashboard/components/StaffDashboardSection.tsx` | **NO** (M3 — CREATE not EDIT) |
| `src/lib/api-cache.ts` | YES |

---

## Summary

| Metric | Count |
|--------|-------|
| MUST_SHIP gaps | **6** |
| SHOULD_SHIP gaps | 5 |
| FUTURE_EPIC | 4 |
| Verdict | **BLOCK** |
| Next | Architect revises → re-audit → security |

**Recommendation:** security agent must NOT proceed until M1-M6 are resolved.

---

## Pass 2 (v2 re-audit) — 2026-05-17 PM

> Re-audited 2026-05-17 13:42 IST by architecture-auditor agent
> Subject: `ARCHITECTURE_EPIC_D_crm_loyalty.md` v2 (1,987 lines, +511 vs v1)
> v1 verdict: BLOCK (6 MUST_SHIP + 5 SHOULD_SHIP)
> Method: cross-check every M1-M6 + S1-S5 against source-of-truth files in the worktree

### Verdict: **PASS_WITH_GAPS** (FUTURE_EPIC + 1 NEW SHOULD_SHIP only)

All 6 MUST_SHIP gaps are PROPERLY resolved against real source files. All 5
SHOULD_SHIP gaps are PROPERLY resolved. v2 introduced TWO new files
(`analytics.ts`, `loyalty.utils.ts`) plus one new component
(`PartyDetailLoyaltyTab.tsx`) — all within 250-LOC cap, all properly slotted
in the file plan. One new SHOULD_SHIP gap found (DetailTab type duplicated in
two files — minor refactor needed). No new MUST_SHIP gaps. Security agent may
proceed.

### M1-M6 fix verification

| Gap | v1 finding | v2 location | Source-verified | Verdict |
|-----|------------|-------------|------------------|---------|
| M1 | 02:30 IST cron collision with `runExpenseRecurringGenerator` | §3.7 + §7.1 #13 + §13 risks table | `cron-scheduler.ts:60` confirms `'30 2 * * *'` belongs to `runExpenseRecurringGenerator`; `'15 4 * * *'` IS unused. Cron slot inventory in §3.7 matches real cron-scheduler.ts contents. | **PASS** |
| M2 | `LOYALTY_REDEMPTION` mixed-case in lowercase peer enum | §3.1.1 + §7.1 #15 + §17.1 | `pos.validators.ts:10` confirms `z.enum(['cash', 'upi', 'card', 'bank_transfer', 'other'])` — all lowercase. v2 adds `'loyalty_redemption'` (lowercase) — perfect parity. | **PASS** |
| M3 | Five phantom FE paths (PartyDetailTabs / PartyForm / PartyDetailPage in components/ / PartyListPage / StaffDashboardSection.tsx edit) | §0.2 path corrections table + §7.2 rows #61, #61b, #72, #73, #74, #88 | All FE paths confirmed real: `src/features/parties/PartiesPage.tsx` exists, `src/features/parties/PartyDetailPage.tsx` exists at feature root, `src/features/parties/components/PartyFormBasic.tsx` (98 LOC) exists with phone+tags layout (+28L for opt-out fits → 126L well under cap), `PartyOverviewTab.tsx`/`PartyTransactionsTab.tsx`/`PartyAddressesTab.tsx` siblings confirm tab-sibling pattern for new `PartyDetailLoyaltyTab.tsx`. `StaffDashboardSection.tsx` correctly re-tagged CREATE — not present in `src/features/dashboard/components/` today. | **PASS** |
| M4 | `services/staff/role.constants.ts` doesn't exist | §6.1 + §6.2 step procedure + §7.1 #27b | `permissions-data.ts` confirmed at `server/src/services/settings/permissions-data.ts`, 290 lines, 8 system roles (Owner, Partner, Manager, Salesman, Cashier, Stock Manager, Delivery Boy, Accountant). v2 §6.2 step-by-step merge procedure (lines 192/200 insertion points and lines 219-289 role array updates) cross-checks with real file structure — `pos` block ends line 192, `bom` starts line 194, Salesman starts line 230, Accountant ends line 288. ALL_PERMISSIONS auto-derivation is correct (line 209-211). | **PASS** |
| M5 | `notificationManager.notify` typed against closed `EventKey` enum | §3.8 + §10 (full rewrite) + new file `server/src/lib/analytics.ts` (§7.1 #2b, ~60 LOC) | `notification-events.ts:42` confirms `EventKey = (typeof EVENT_KEYS)[keyof typeof EVENT_KEYS]` is closed union — v1's risk is real. v2's new `analytics.ts` thin wrapper around `logger.info` with typed `AnalyticsEvent` union is the correct routing — no user-facing notification spam, no `as EventKey` runtime crash. All 9 events properly listed in §10 (was 7, grew to 9 with the two `*_restored` events added by M6). | **PASS** |
| M6 | `restorePosSale` not covered — VD entries leak | §3.4.1 (NEW section, ~80 lines) + §7.1 #16 amended + §10 rows 4 & 7 + §12.12 test + §13 risks table | `pos-void.service.ts:160-196` confirms `restorePosSale` exists alongside `voidPosSale`. v2's symmetric VR (void-reversal) pattern is consistent with AC/RD/VD entries — net effect over AC→RD→VD→VR is `+points - redeemed - (rd_neg + ac_neg) + (rd_pos + ac_pos) = post-original-sale value`. Restore window (4h) << expiry window (months) so no edge case where AC could expire mid-cycle. Permission gate (`pos.void`) already covers restore — confirmed at `permissions-data.ts:190` ("Void / Restore POS Sales"). | **PASS** |

**M1-M6 verdict: 6/6 PASS.**

### S1-S5 fix verification

| Gap | v1 finding | v2 location | Source-verified | Verdict |
|-----|------------|-------------|------------------|---------|
| S1 | Permission keys depart from `<resource>.<action>` house style | §6.1 v2 renames table | All 7 new keys conform to `<resource>.<action>` two-segment style: `loyalty.configure`, `loyalty.redeem`, `commission.configure`, `commission.view`, `commission.view_all`, `crm_followup.create`, with `parties.view` (existing) for reads. Matches `cashRegister` underscore-joiner precedent. | **PASS** |
| S2 | Loyalty unit math could be implemented wrong (off-by-10000) | §2.1 worked examples + §7.1 #4b `loyalty.utils.ts` (~80 LOC, hosts pure `computePointsEarned` with BigInt insurance) + §12.11 test sketch | Formula `pointsEarned = floor(subtotalPaise * earnBps / 1_000_000)` with denominator decomposition `(10_000 bps→fraction × 100 paise→rupee)` and 4 worked examples (₹100/₹999/₹0 at 1%, ₹100 at 2%). Test sketch covers floor at ₹500 @ 0.5% → 2.5 → 2. Math is bulletproof. | **PASS** |
| S3 | Cash register accounting drift — loyalty_redemption could pollute cash bucket | §3.1.2 + §7.1 #16b daybook edit + §16 acceptance + §17.3 | `pos-checkout.cash.ts:51` literally reads `payments.filter(p => p.mode === 'cash')` — confirmed. `loyalty_redemption` (lowercase) NATURALLY excluded by `!== 'cash'`; no code change to cash bucket. Day-end daybook gets a +15L edit (#16b) to surface `loyalty_redemption` as own tender row. PR5 acceptance criterion added. | **PASS** |
| S4 | Advisory-lock pattern incorrectly cited as `cron-grace-expiry.ts` | §1 caveat + §3.3 + §3.7 + §4.1 + revision history | `subscription.writer.ts:25-31` confirmed as canonical 64-bit `hashtextextended` advisory-lock source. `cron-grace-expiry.ts` correctly noted as unguarded (and v2 acknowledges this in §1). All four citations (§3.3, §3.5 implied, §3.7, §4.1) now point at the real source. | **PASS** |
| S5 | System role defaults table missing for 5×7 staff-role × permission cells | §6.4 (NEW table with full rationale) | 35 cells filled with rationale per role. Salesman gets `loyalty.redeem` + `commission.view` + `crm_followup.create`. Cashier gets same. Stock Manager / Delivery Boy get nothing (correctly — no sales floor exposure). Accountant gets `commission.view` only (read-only ledger access). Owner/Partner/Manager auto-get all via `ALL_PERMISSIONS` derivations — that's correct per `permissions-data.ts:219-228`. | **PASS** |

**S1-S5 verdict: 5/5 PASS.**

### New gaps introduced by v2

#### NEW_S1 — `DetailTab` type duplicated in two files (SHOULD_SHIP)

- **Where:** v2 §0.2 + §7.2 row #61b say "expand TABS array in `PartyDetailPage.tsx`" but the `DetailTab` type is defined TWICE in the worktree:
  - `src/features/parties/PartyDetailPage.tsx:32` — `type DetailTab = 'overview' | 'transactions' | 'addresses' | 'ledger'`
  - `src/features/parties/usePartyDetail.ts:10` — same type declared again
- **Failure mode:** Adding `'loyalty'` to one but not the other yields a TS narrowing error at the `setActiveTab` call. Builder will see the error, fix one file, then loop back to fix the other — small but real friction.
- **Fix:** Either (a) extract `DetailTab` into `src/features/parties/party.types.ts` (already exists) and import in both files; or (b) document in v2 §0.2 that the builder must update BOTH lines 32 and 10 in PR4.
- **Severity:** SHOULD_SHIP. Not a blocker — builder will discover and fix on first compile — but a 30-second pre-emptive note in the file plan saves the round-trip.

#### NEW_S2 — §6.4 wording about `parties.view` is confusing (SHOULD_SHIP, doc-only)

- **Where:** v2 §6.4 closing note: "`parties.view` (used by loyalty balance / ledger reads, and `GET /api/parties/tags`) is already granted to every staff role today **except** Stock Manager (which has it), so no new grants for `parties.view` are required for Epic D reads."
- **Reality:** `parties.view` appears 5 times in `permissions-data.ts` — once each for ALL 5 staff roles (Salesman line 234, Cashier line 247, Stock Manager line 259, Delivery Boy line 268, Accountant line 277). The "except Stock Manager (which has it)" parenthetical is self-contradicting and reads as a copy-paste error.
- **Failure mode:** None at runtime — the conclusion ("no new grants required") is correct. But the contradictory wording will confuse a reader auditing whether Stock Manager can call `/api/loyalty/balance/:partyId`.
- **Fix:** Replace the parenthetical with "(all 5 staff roles already have `parties.view`)" or just drop the "except" clause entirely.
- **Severity:** SHOULD_SHIP (doc clarity, not implementation).

#### No new MUST_SHIP gaps

The two `*_restored` analytics events (rolling Epic D telemetry to 9 events,
slightly over the 7-per-flow soft cap) are explicitly justified in §10 note —
restore is its own distinct flow. ACCEPTABLE.

The `VR` (Void-Restore) addition to `LoyaltyEntryType` constant set is NOT a
schema-domain change — the DB column is `String @db.VarChar(20)`, no enum at
the DB layer. The constant set lives in `loyalty.constants.ts` (file plan #4).
NOT a SCOPE-locked-decision break.

The cron-slot move from SCOPE §19 Q3 ("Daily cron 02:30 IST") to v2 04:15 IST
is an OPERATIONAL deviation from a SCOPE Locked Decision, but: (a) Q3 was a
"Default accepted" decision, not "Confirmed prompt"; (b) the deviation is
forced by M1 (collision with existing 02:30 cron); (c) v2 §3.7 documents the
deviation with full slot-inventory rationale. **ACCEPTABLE — should be
mentioned to Sawan at task-manager seeding time, but does not block.**

### Path spot-check (v2)

| Path | Action | Exists | Notes |
|------|--------|--------|-------|
| `server/src/lib/cron-scheduler.ts` | edit (+14L) | YES (232L existing) | 04:15 IST slot truly unused — confirmed |
| `server/src/services/pos/pos.validators.ts` | edit (+25L) | YES (113L existing) | lowercase enum confirmed at line 10 |
| `server/src/services/pos/pos-void.service.ts` | edit (+45L) | YES (197L existing) | `restorePosSale` at lines 160-196 — confirmed; +45L would put file at 242L, just under 250 cap |
| `server/src/services/settings/permissions-data.ts` | edit (+30L) | YES (290L existing) | +30L → 320L — **EXCEEDS 250-LOC CAP**. See observation below. |
| `server/src/services/subscription/subscription.writer.ts:25-31` | citation only | YES (132L) | Advisory-lock pattern at lines 25-31 confirmed (line 25 is fn signature, lock acquisition is lines 27-30) — citation off by one but spirit correct |
| `src/features/parties/PartiesPage.tsx` | edit (+30L) | YES | Real list page |
| `src/features/parties/PartyDetailPage.tsx` | edit (+22L + #61b +18L = +40L total) | YES | Both edits target same file (#73 + #61b) — combined +40L; size acceptable |
| `src/features/parties/components/PartyFormBasic.tsx` | edit (+28L) | YES (98L existing) | →126L well under cap |
| `src/features/parties/components/PartyDetailLoyaltyTab.tsx` | create (~190L) | NO (CREATE) | New sibling to PartyOverviewTab/PartyTransactionsTab/PartyAddressesTab — pattern confirmed |
| `src/features/dashboard/components/StaffDashboardSection.tsx` | create (~120L) | NO (correctly CREATE) | Not present in dashboard/components/; nearest siblings AlertStrip/TopDebtors confirm placement |
| `server/src/lib/analytics.ts` | create (~60L) | NO (CREATE) | Path is virgin — no collision risk |
| `server/src/services/loyalty/loyalty.utils.ts` | create (~80L) | NO (CREATE) | Path is virgin |
| `server/src/services/report/report-daybook.ts` | edit (+15L) | YES | Confirmed for #16b daybook tender-row edit |

**Observation on `permissions-data.ts` file size:** v2 §7.1 row #27b plans
+30L on a 290L file → final 320L, **OVER the 250-LOC project cap**. The CLAUDE.md
6-layer rule says "Each file ≤ 250 lines" but permissions-data is already
at 290L and PRE-EXISTS as legacy debt. This is NOT a new gap introduced by
v2 (it's pre-existing), but the merge would worsen the violation. v2 should
either: (a) extract `SYSTEM_ROLES` to `permissions-roles.ts` first (splitting
work into PR1 prep), or (b) accept the legacy debt and tag the file as
exempt in `scripts/enforce.js`. This is a FUTURE_EPIC / housekeeping
recommendation, NOT a v2 blocker — the file already violates the cap today.

### Critical-path soundness (v1 preservation check)

| v1 confirmation | v2 status | Verified |
|-----------------|-----------|----------|
| POS `$transaction` boundary at steps 10.5/10.6/10.7 | §3.1 retains step 10/11/12 insertion points | OK |
| Walk-in `isWalkIn` short-circuit | §11.4 retains | OK |
| `document/create.ts:228` + `update.ts:43-44` insertion | §3.3 retains `!wasSaved && willBeSaved` | OK |
| Bulk-reminder `touchLastContactedMany` at line 166 | §3.5 retains | OK |
| Share routes WhatsApp/email `$transaction` | §3.4 retains | OK |
| Cache-on-logout safety for `/loyalty/balance` | §5.1 + §5.4 retain `cacheReads: true` opt-in | OK |
| POS offline-block via `usePosCheckout.openCheckout` | §5.2 cites correctly — `usePosCheckout.ts:52-56` (v2 said 53-56, actual 52-56; 1-line drift) | OK (minor) |
| `pos-checkout.cash.ts:51` cash filter natural-exclude | §3.1.2 / S3 confirmed real | OK |
| Advisory-lock pattern from `subscription.writer.ts` | §4.1 cites correctly with corrected line range (25-31) | OK |

**Critical-path verdict: All v1 strengths preserved. No regression.**

### SCOPE deviations introduced/confirmed by v2

| SCOPE clause | v2 deviation | Justification | Acceptable? |
|--------------|--------------|---------------|-------------|
| §19 Q3 cron at 02:30 IST | v2 §3.7 uses 04:15 IST | M1 — slot collision with `runExpenseRecurringGenerator` | YES (forced by M1; documented) |
| §6 ledger type set `AC/RD/EX/AD/VD` (4-symbol set in SCOPE §6.5; "ACCRUED/REDEEMED/EXPIRED/ADJUSTED" longform in SCOPE §6 schema) | v2 §2.2 adds `VR` (Void-Restore) as 6th code | M6 — restore symmetry; type column is `String @db.VarChar(20)`, no DDL change | YES (additive constant only, no migration) |
| §10 file plan: 81 files | v2 §7: 83 (or 91 with sub-rows) files | M3+M5+S2 additions (PartyDetailLoyaltyTab.tsx, analytics.ts, loyalty.utils.ts) + #16b daybook + #27b permissions | YES (documented in §7.2 reconciliation) |

### Final recommendation

**Security agent CLEARED to proceed.**

All 6 MUST_SHIP gaps from v1 are resolved with proper source-of-truth
verification. All 5 SHOULD_SHIP gaps resolved. v2 introduced 2 minor
SHOULD_SHIP gaps (NEW_S1 `DetailTab` duplicate, NEW_S2 doc wording) and
1 pre-existing housekeeping note (permissions-data.ts size) — none block.
SCOPE Locked Decisions are preserved except for Q3 (cron slot), which is a
forced operational deviation explicitly justified in §3.7.

Security agent should focus on the items already listed in §11 + §15:
- §11.1 money-equivalent integrity (advisory lock + AC/RD/VD/VR symmetry)
- §11.3 cross-tenant leak (businessId scoping on every loyalty/commission query)
- §15 file list (13 specific files including the new `analytics.ts` and `loyalty.utils.ts`)

Optional: architect may close NEW_S1/NEW_S2 in same revision or defer to PR4
build-time fixes. Neither is a security concern.

### Summary table

| Metric | v1 | v2 |
|--------|----|----|
| MUST_SHIP gaps | 6 | 0 |
| SHOULD_SHIP gaps | 5 | 2 (both NEW, low-impact) |
| FUTURE_EPIC | 4 | 4 + 1 housekeeping note (permissions-data.ts size) |
| Scope conformance breaks | 6 | 0 (cron-slot deviation pre-approved by M1 fix) |
| Verdict | BLOCK | **PASS_WITH_GAPS** |
| Next | Architect revises → re-audit → security | **Security agent proceeds** |
