# Backlog — resume 2026-05-17

> Snapshot at 2026-05-17 12:25 IST. **130/150 shipped.** Phase 4 complete (16/16). **Phase 5 Epic A SHIPPED** (Marketing FE — 3 slices, 36 files, +221 EN/HI keys). **Phase 5 Epic B SHIPPED** (#122/#132/#133/#134). **Phase 5 Epic C SHIPPED** (#121/#129/#130/#131 — public surface at `/p/*`, SharedLink + HMAC tokens, UPI QR, storefront, invite/OTP). **Subscription port SHIPPED** (DH gating model: state machine, UPI Autopay, offline JWT, PRO_MAX tier — commit `3530e79`). **Responsive sweep complete** (Waves 0-7, `7c12683`..`5b8d3fe`). **Backend audit green** (0 P0/P1/P2 after `bf1d166` + `be574fd`).
>
> **Branch state:** `hisaabpro` is **57 commits ahead of `master`**. Production deploy at commit `89610b0`. Nothing since Phase 4 finish has been merged to master/prod.
>
> **Next up:** Phase 5 Epic D (#125 Loyalty + #127 CRM + #128 Staff Performance) **OR** ship-to-prod (merge `hisaabpro` → `master`, set Render env vars). See "Resume order" below.

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

### 4. Phase 5 Epic D — CRM + Loyalty (NEXT TO BUILD)
#125 loyalty/rewards · #127 CRM basics · #128 staff performance & commission. **3 features to close Phase 5.**

Notes:
- #125 schema: `LoyaltyProgram`, `LoyaltyLedger`. Points accrue on POS sale (hook into existing pos-checkout commit flow).
- #127 reuses Party model — just adds `tags`, `lastContactedAt`, `followUpAt`, `notes` (some may exist).
- #128 reuses staff/role infra; commission rule per-product or per-category. Overlaps Phase 6 #128 split-staff-commission work; consider folding.

Run `/start-epic phase-5-epic-d-crm-loyalty` to kick off the scope-writer → architect → security → task-manager sequence.

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
- `.claude/design-plan-active.md` — last approved for prior epic; **replace before starting Epic D** by running `/start-epic phase-5-epic-d-crm-loyalty`.
- Shipped epic docs (don't archive — referenced for context): `docs/SCOPE_phase5_marketing_comms.md`, `docs/SCOPE_EPIC_B_sales_workflow.md`, `docs/SCOPE_EPIC_C_customer_facing.md`, `docs/SCOPE_132_price_lists.md`. Companion `ARCHITECTURE_*.md` + `SECURITY_AUDIT_*.md` next to each.
- Subscription port PRDs: `PRDs/subscription-port-{SCOPE,ARCHITECTURE,SECURITY,TASKS}.md`. Mission archive: `.claude/missions/subscription-port.md`.

## Quick commands
- **Ship-to-prod (recommended first):** merge `hisaabpro` → `master`, set Render env, `npx prisma migrate deploy`, smoke-test `/p/*` + `/settings/subscription`.
- **Start Epic D:** `/start-epic phase-5-epic-d-crm-loyalty`
- **Start vertical depth V3 (recipe cost):** `/start-epic vertical-v3-recipe-cost-dashboard`
- **Roadmap:** `docs/ROADMAP.md` — keep in sync after every epic.
- **Re-audit doc accuracy:** ask Claude "WHATS LEFT and whats done? deep audit, update the docs" — this re-runs the doc/code reconciliation that produced the 2026-05-17 snapshot.
