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
