# HisaabPro — Master PRD + TRD

> **Single source of truth** for product and technical specification. Combines every prior PRD, architecture, scope, security audit, and runbook into one document. Source docs preserved under `docs/archive/` for blame/history.
>
> **Last updated:** 2026-05-30
> **Owner:** Sawan Jaiswal
> **Status:** Phase 1–6 complete on `master`; Phase 7 **9/10** — #141 OCR, #142 Voice, #144 Smart GST, #145 Vertical Modes, #146 Predictive, #147 Auto-reconciliation, #148 Smart inventory, #149 Competitor imports, #150 Multi-user collaboration. Remaining: #143 (creds-blocked). Pre-beta hardening landed 2026-05-27: money-SSOT (paise Int) merged via PR #2, refresh-token family rotation per RFC 6819, security batch A (CSV injection guard + Sentry/logger PII scrub), W4b FE test-contract sweep (1306/1306 passing). Vertical-depth **V3 Recipe Cost dashboard shipped 2026-05-28** (BOM-derived cost/margin, no schema) and **V1 Hourly billing on Jobs shipped 2026-05-29** (`JobItemKind` discriminator + tracking-only Job hours, additive migration, money math unchanged). `hisaabpro` branch is **0 commits ahead** of `master` — Render redeploy pending.
> **Frontend UI:** complete for all 141 shipped features (the remaining 9 are either cred-blocked backend stubs or unbuilt vertical-depth epics — no UI yet).

---

## Table of Contents

### Part I — PRD (Product)
1. [Vision & positioning](#1-vision--positioning)
2. [Personas](#2-personas)
3. [Problem & competitive landscape](#3-problem--competitive-landscape)
4. [Phases & feature catalogue (1–150)](#4-phases--feature-catalogue-1150)
5. [Verticals](#5-verticals)
6. [Success metrics](#6-success-metrics)
7. [Pricing tiers](#7-pricing-tiers)
8. [Remaining work](#8-remaining-work)

### Part II — TRD (Technical)
9. [Stack & topology](#9-stack--topology)
10. [Data model (134 Prisma models)](#10-data-model-134-prisma-models)
11. [Service & route layout](#11-service--route-layout)
12. [Frontend architecture](#12-frontend-architecture)
13. [Auth, tenancy, PIN, admin](#13-auth-tenancy-pin-admin)
14. [Subscription state machine](#14-subscription-state-machine)
15. [Offline-first contract](#15-offline-first-contract)
16. [Design system](#16-design-system)
17. [Platform shell (mobile)](#17-platform-shell-mobile)
18. [Enforcement & gates](#18-enforcement--gates)
19. [Security posture](#19-security-posture)
20. [Rollout & feature flags](#20-rollout--feature-flags)
21. [Deployment & ops](#21-deployment--ops)
22. [High-risk paths](#22-high-risk-paths)
23. [Glossary](#23-glossary)

---

# Part I — PRD (Product)

## 1. Vision & positioning

HisaabPro is a **mobile-first, offline-first business management app for Indian MSMEs** — billing, inventory, payments, GST, accounting, POS, multi-firm, staff & HR in one app. Replaces paper registers, Excel, and the unreliable incumbent apps (Vyapar, MyBillBook).

**Positioning slogans:**
- vs paper/Khatabook: "Professional invoice in 5 seconds, sent on WhatsApp"
- vs Vyapar/MyBillBook: "Your data never disappears — offline + auto-backup"
- vs Tally/Busy: "Same power on your phone, half the price"

**Brand:**
- App Name: **HisaabPro**
- Domain: **hisaabpro.in**
- Tagline: *Billing, Inventory & Payments for Indian Businesses*
- Subdomains: `hisaabpro.in` (marketing/Vercel), `app.hisaabpro.in` (PWA/Vercel), `admin.hisaabpro.in` (admin/Vercel), `api.hisaabpro.in` (backend/Render)
- Support email: `support@hisaabpro.in` (ImprovMX → Sawan)

---

## 2. Personas

| Persona | Profile | Tech | Current tool | Revenue/mo | Staff |
|---|---|---|---|---|---|
| **Raju — Retailer** | Kirana / electronics / hardware. Solo or 1 helper. 20–50 txn/day. Wants simple billing + "who owes me" tracking. | Low — WhatsApp daily, apps OK, not spreadsheets | Paper, Khatabook, nothing | Rs 1–5 L | 0–1 |
| **Priya — Wholesaler** | Wholesale/distribution. 2–5 staff who bill. 50–200 txn/day. Wants multi-user, inventory, party-wise pricing. | Medium — tried Vyapar/MyBillBook, frustrated | Vyapar free / MyBillBook basic | Rs 5–25 L | 2–5 |
| **Amit — Distributor** | Multi-location distribution/manufacturing. 10+ staff. Wants GST compliance, warehouse mgmt, accounting, Tally export. | High — knows TDS/TCS, has CA | MyBillBook paid / Tally / Busy | Rs 25 L – 2 Cr | 5–20 |

**Secondary users:** CA/accountant (GST filing, Tally export), salesperson/staff (restricted access via custom roles + PIN gate).

---

## 3. Problem & competitive landscape

| Problem | Impact | Prevalence |
|---|---|---|
| No record of who owes what | Rs 10–50K/mo uncollected | 80% of micro |
| Paper or no billing | Lose to competitors who send invoices | 60% on paper |
| GST compliance confusion | Penalties; expensive CA visits | Every GST-registered biz |
| Inventory guesswork | Cash stuck or lost sales | 70% of product biz |
| Untrustworthy apps | Vyapar data loss; MyBillBook broken inv; no offline | 30–40% complaints |
| Staff edits everything | Price changes, deletions | Every multi-staff biz |

**Competitive matrix:**

| Competitor | Rating | Downloads | Weakness we exploit |
|---|---|---|---|
| Vyapar | 4.67 | 15M+ | Data loss, no offline, rigid roles, dated UI, no iOS |
| MyBillBook | 4.41 | 9.7M+ | Broken inventory, terrible support, bugs unfixed for months |
| Khatabook | 4.5 | 50M+ | Too simple, no invoicing, not scalable |
| Zoho Books | 4.6 | — | 3.5× more expensive, not India-focused |
| TallyPrime | — | — | Desktop-only, complex, expensive |

**Positioning recap:** mobile-first + offline-first + modern UI + reliable data + WhatsApp support.

---

## 4. Phases & feature catalogue (1–150)

Status legend: `[x]` shipped · `[B]` blocked on creds · `[ ]` not started · `[S]` deferred.

### Phase 1 — MVP (70 features, 60 shipped · 10 cred-blocked)

**1A. Reused from DudhHisaab (10)**

| # | Feature | Status | Notes |
|---|---|---|---|
| 1 | Auth (OTP, JWT, refresh, 2FA, WebAuthn) | [x] | Dev login + httpOnly cookies + account lockout + CAPTCHA |
| 2 | Subscription & Billing (Razorpay) | [B] | Port shipped 2026-05-15 (`3530e79`) — 7-state machine, UPI Autopay, RS256 offline JWT, PRO_MAX tier. Needs `ENTITLEMENT_JWT_PRIVATE_KEY` + `ENTITLEMENT_JWT_PUBLIC_KEY` + `RAZORPAY_WEBHOOK_SECRET` |
| 3 | Referral & Earn (codes, wallet, UPI withdraw, fraud) | [x] | 8 endpoints, crypto code gen, UPI stub |
| 4 | Notifications (push/email/WA/SMS, quiet hours) | [B] | Needs FCM + Aisensy + Resend |
| 5 | Backup (local + Google Drive + email export) | [x] | Manual backup + list + download + cooldown |
| 6 | Offline-first PWA (IndexedDB, sync queue, SW) | [x] | SW registered, Dexie, banner, sync queue |
| 7 | Admin Panel framework | [x] | 15 endpoints, separate admin JWT, SUPER_ADMIN guard |
| 8 | Dark Mode / Theming | [x] | CSS vars + `data-variant` Classic/Modern/Minimal palettes, ThemePicker at `/settings/theme` |
| 9 | Multi-language (EN/HI) | [x] | 980+ keys |
| 10 | Onboarding wizard | [x] | Business creation on first login |

**1B. Party Management (7)** — all [x]
11 Party CRUD · 12 Balances/Statements · 13 Multi-addresses · 14 Credit limits · 15 Custom fields · 16 Party-wise pricing · 17 Opening balances.

**1C. Invoicing & Documents (17)** — 15 [x], 2 [B]
18 Sale invoice · 19 Purchase invoice · 20 Estimates · 21 Proforma · 22 PO · 23 SO · 24 Delivery challan · 25 Numbering (per FY series) · 26 Additional charges · 27 Due dates · 28 T&C · 29 Digital signature · **30 Auto WA/email share [B]** · 31 Image export (JPG/PNG) · **32 Email PDF [B]** · 33 Recycle bin · 34 Profit-during-sale.

**1D. Templates & Printing (5)** — all [x]
35 Templates (5+ base) · 36 Customization editor · 37 Print settings · 38 Round-off · 39 Decimal precision.

**1E. Payment Tracking (4)** — 3 [x], 1 [B]
40 Payment in/out (cash/UPI/bank/cheque, multi-invoice allocation) · 41 Outstanding + aging buckets · **42 Reminders [B]** · 43 Discount during payment.

**1F. Basic Inventory (6)** — all [x]
44 Products CRUD (paise) · 45 Stock in/out (immutable StockMovement) · 46 Stock validation (GLOBAL/WARN_ONLY/HARD_BLOCK) · **47 Low-stock alerts [B]** · 48 Categories + Units + conversions · 49 Item custom fields.

Wait — 47 is [B]; rest of 1F are [x].

**1G. Dashboard & Reports (6)** — all [x]
50 Dashboard (single `/dashboard/home`) · 51 Sale/Purchase reports + CSV · 52 Party statements · 53 Stock summary · 54 Day book · 55 Payment history.

**1H. Settings & Security (7)** — 6 [x], 1 [B]
56 Custom roles + permission matrix · 57 Txn lock + approvals · 58 PIN/passcode (app-level) · **59 Biometric [B]** (needs Capacitor plugin) · 60 Date format · 61 Keyboard shortcuts · 62 Calculator FAB.

**Phase 1 acceptance:** signup → onboarding → opening balances → add parties + products → create invoice + WA share in <10s → record payment → see outstanding → dashboard summary → works offline → auto-backup → role restrictions → PIN protect → recycle bin restore.

### Phase 2 — GST & Compliance (20 features, 20/20)

| # | Feature | Notes |
|---|---|---|
| 63 | GST Invoice Engine (CGST/SGST/IGST auto-calc, HSN/SAC) | `tax-calc.ts` + `document-calc.ts`, basis points + paise |
| 64 | Tax categories (5/12/18/exempt, cess) | TaxCategory model · 5 defaults |
| 65 | Place of Supply (2-digit state code) | IGST vs CGST+SGST gate |
| 66 | GSTR-1 Export (JSON) | B2B/B2CL/B2CS/CDNR/CDNUR |
| 67 | GSTR-1 Reconciliation (filed vs books) | 4-way match · FE: ReconciliationListPage + Detail |
| 68 | GSTR-3B (with RCM split) | Outward + ITC + CN adj + net payable |
| 69 | GSTR-9 (annual) | Full FY summary |
| 70 | Tax reports (Summary + HSN + Ledger) | 3 endpoints + FE |
| 71 | E-Invoice (IRN + QR) | NIC sandbox · 64-char IRN · 24h cancel |
| 72 | E-Way Bill | Rs 50K threshold · Part-B updates |
| 73 | Reverse Charge | `isReverseCharge` flag |
| 74 | Composite Scheme | Flat rates · "Bill of Supply" |
| 75 | Additional Cess | cessRate/cessAmount on line items |
| 76 | HSN Auto-fill | curated subset seeded (126 codes) · `/api/hsn/search` · trgm GIN on description (full 12K master = FUTURE) |
| 77 | TDS/TCS | Rate+Amount on Document · FE: TdsTcsReportPage |
| 78 | GSTIN verification | `/api/gstin/verify` |
| 79 | Credit/Debit Notes | Stock + outstanding + bi-directional linking |
| 80 | Multi-currency | ExchangeRate · 11 currencies · rate×10000 precision |
| 81 | Recurring Invoices | RecurringInvoice + 4 frequencies + scheduler |
| 82 | GST Returns viewer (tab pills + month selector) | FE: GstReturnsPage |

### Phase 3 — Accounting & Finance (22 features, 21/22 · #89 deferred)

83 Double-entry ledger (15 system accounts) · 84 P&L · 85 Balance Sheet · 86 Cash Flow · 87 Accounting Day Book · 88 Journal Entries (DRAFT→POST→VOID) · **89 Bank Reconciliation** (shipped inside #147, Phase 7) · 90 Receipt vouchers · 91 Payment vouchers · 92 Cheque register (PENDING/CLEARED/BOUNCED/CANCELLED) · 93 Multiple bank accounts · 94 Cash-in-hand · 95 Cash book / Bank book · 96 Expense tracking (10 categories) · 97 Other income · 98 Loans (LOAN_GIVEN/TAKEN, EMI) · 99 FY closure (carry-forward to Retained Earnings) · 100 Tally Export (XML) · 101 Aging reports (4 buckets) · 102 Profitability (bill/party/product) · 103 Discount reports · 104 COGS tracking.

### Phase 4 — Advanced Inventory & POS (16 features, 16/16)

105 Barcode gen · 106 Barcode scan (native ML Kit + zxing fallback) · 107 Batch tracking (BAT-01..07, FEFO) · 108 Serial numbers · 109 Multi-godown + transfers · 110 Stock adjustment (reason codes) · 111 Label printing (THERMAL_40x30 / A4_3x8 / A5_2x5) · 112 Bulk import/export · 113 Expiry cron + alerts · 114 Reorder points · 115 BOM + ProductionRun (atomic, WAC propagation, cancel-reverse) · 116 Item images · 117 MOQ enforcement · 118 POS billing mode (sales/void/restore/receipts 58/80/A5) · 119 Stock verification (atomic batch adjustments) · 120 Party ledger (DR/CR/Running Balance, PDF export).

### Phase 5 — Sales & Marketing (14 features, 14/14)

| # | Feature | Epic | Commit |
|---|---|---|---|
| 121 | Online Store (`/p/store/:slug`) | C PR4 | `d47b84a` + `ea1b9ae` |
| 122 | Sales Pipeline (Estimate→SO→Challan→Invoice, lineage) | B PR1 | `6193d28` |
| 123 | WhatsApp Marketing (templates + campaigns wizard + reminders) | A | `9b1f096` + `016a1c8` + `9d281de` |
| 124 | SMS Marketing (MSG91) | A | same |
| 125 | Loyalty (FIFO accrual, advisory-locked redeem, POS step 10.5/10.6, expiry cron) | D PR3/4 | `1bb2fcc` + `d8eb926` |
| 126 | Service Reminders (rules + 30-min cron + PII purge + opt-out) | A slice 3 | `9d281de` |
| 127 | CRM Basics (tags + follow-ups + lastContactedAt) | D PR2 | `ea27525` |
| 128 | Commission (rules CRUD, ruleSnapshot deep-clone, factory ledger auth, rate-cap UX) | D PR5/6 | `340d5bc` + `4f93808` |
| 129 | UPI QR + deep-link on invoice | C PR2 | `a148ba3` |
| 130 | Web invoice links (HMAC) | C PR3 | `77c645a` + `9dbbf54` |
| 131 | Party invite (OTP, one-shot signup binding) | C PR5 | `15fb596` + `ea37c19` |
| 132 | Multiple price lists (per-invoice override + cross-tenant guard) | B | `3626a0c` |
| 133 | BOGO (custom-role permission `invoicing.bogo`) | B | `3626a0c` |
| 134 | Invoice custom fields (react-pdf section) | B | `3626a0c` |

Phase 5 Epic D merge: `63ccef4`. QA Gate GREEN 49/49.

### Phase 6 — Staff & HR + Multi-Firm + Audit + PIN (6 features, 6/6) ✅ NEW

Merge `caa390d` (2026-05-26), 12 commits + 2 hardening (`ba56470`/`0bd1881`).

| # | Feature | PR | Commits | Notes |
|---|---|---|---|---|
| 135 | Staff Attendance (employee×day matrix) | PR5 | `0e2b78a` BE + `2f78154` FE | batch + range endpoints, businessId-scoped |
| 136 | Payroll (wizard + STAFF Party pairing + reversal) | PR6 | `1b27829` BE + `a83b4d9` FE | Employee + PayrollRun + Payslip |
| 137 | Salary Slips (viewer + PDF + reverse) | PR6 | same | PayslipSnapshot model |
| 138 | Multi-firm (suspend/reactivate, tenancy elevation) | PR0/1A/1B/2 | `26c4665` audit · `d036036` schema · `ce805d6` middleware · `c718490` + `8f0a06e` UI | 0 cross-tenant leaks / 1,033 sites; TenantChip + SuspendBanner + ReactivationModal + `requireActiveBusiness` |
| 139 | Advanced Audit Trail (search + diff + redaction + CSV) | PR4/7 | `c0f54a2` BE + `78e1a5e` FE; PR7 `025d037` backfilled 13 mutations + flipped enforcer `--block` | websearch_to_tsquery (no plain to_tsquery), buffered CSV |
| 140 | Transaction PIN (`requireRecentPin` middleware) | PR3 | `5f802b9` BE + `3fc3802` FE | PinCredential, `/api/auth/pin/*`, PinGateProvider + PinPad + 403 interceptor |

**Phase 6 verifier (`VERIFIER_REPORT_PHASE6.md`):** 7 mechanical proofs exit 0 — FE tsc, BE tsc, enforce.js, enforce-offline (1532 files), enforce-audit-coverage `--block`, regression greps for `req.user.id` and plain `to_tsquery`. **Security Pass-2 PASS** — `requireFeature('STAFF_HR')` kill-switch wired into 3 aggregator routers between `requireActiveBusiness` and handler.

### Phase 7 — AI & Differentiators (10 features, 9/10)

| # | Feature | Status | Notes |
|---|---|---|---|
| 141 | AI auto-categorize receipts | [x] | Anthropic haiku OCR · 5 MB cap · graceful unavailable (`e11caf9`) |
| 142 | Voice entry | [x] | Web Speech API (en-IN) + typed fallback; pure Hindi/English amount parser → preview → save |
| 143 | WhatsApp bot billing | [ ] | Aisensy inbound webhook → invoice draft — **highest leverage / lock-in** |
| 144 | Smart GST filing assistant | [x] | Deterministic pre-filing readiness validator (7 rules, blocker/warning tiers). `/api/gst/filing-readiness` (PRO); `/gst/filing-readiness` FE with deep-links to offending invoices, 18 tests |
| 145 | Industry Vertical Modes | [x] | 13 verticals via `verticals.config.ts` — nav filter + terminology + defaults + Jobs + Custom Orders |
| 146 | Predictive analytics | [x] | Deterministic OLS revenue trend + sales-velocity stock-out forecast. `/api/analytics/*` (advancedReports gate); `/insights` FE, no charting lib (SVG sparkline) |
| 147 | Auto-reconciliation | [x] | Bank CSV → client parser → staged lines → deterministic match engine (amount/date/ref/party/direction → SUGGESTED/WEAK/UNMATCHED) → confirm/manual/ignore/un-reconcile. Annotation-only join table (`lineId @unique`), never mutates ledger; bounded pool + TOCTOU/P2002 guards. `/api/bank-reconciliation/*` (PRO); `/bank-reconciliation` FE, 23 tests. Absorbs #89 |
| 148 | Smart inventory | [x] | Velocity-based reorder suggestions over #146 forecast math. `/api/inventory/reorder-suggestions` (auth); `/inventory/reorder-suggestions` FE, urgency tiers + lead-time/coverage params, 15 tests |
| 149 | Competitor importers (Vyapar/MyBillBook/Tally) | [x] | **acquisition unlock** — shipped 2026-05-26 `9a3c98e` (PR-D2b/D3/D4/D5) |
| 150 | Real-time multi-user | [x] | Spike → **LWW + optimistic lock (not CRDT)** — money must not auto-merge. `version Int` on Document/Payment/Party/Product; lock lives in the write (`bumpVersionOrConflict`: atomic conditional `updateMany WHERE version=expected` in-tx → count!==1 → 409 `CONFLICT {serverVersion,updatedBy}`, tenant-scoped). Client sends `X-Entity-Version` (absent → back-compat unguarded write). Presence in-memory + oracle-free (45s TTL, no DB hit). FE `useConflictReconcile`/`<ConflictDialog>` + `usePresence`/`<PresenceAvatars>` in all 4 edit flows |

---

## 5. Verticals

13 verticals wired via `src/config/verticals.config.ts` — nav filtering + terminology + defaults seeder + per-vertical onboarding.

**Shipped per-vertical depth:**

| Vertical group | Feature |
|---|---|
| Services / Freelancer / Salon / Clinic | Jobs flow (QUOTED→SCHEDULED→IN_PROGRESS→COMPLETED→INVOICED) + 4 pages + dashboard widget + convert-to-invoice. **Hourly billing (V1, shipped 2026-05-29)** — `JobItemKind` enum (`ITEM`\|`HOURLY`) + `Job.estimatedHours`/`actualHours` (Decimal, tracking-only); HOURLY relabels qty→Hours, rate→Rate/hr and reuses the exact `round(qty×rate)−discount` line math (hours never summed into money); per-line toggle + variance chip + "Xh @ ₹Y/hr" detail label. Additive migration. |
| Bakery / Tailor | Custom Orders (RECEIVED→IN_PRODUCTION→READY→DELIVERED→INVOICED) + delivery date/slot + custom fields + Today/Tomorrow widgets |
| Pharmacy | Batch + expiry tracking ON by default, FEFO claim, daily expiry cron |
| Restaurant | Nav-hide serial/verify, terminology="Bill", POS access |
| Manufacturing | Stock + batch + serial defaults ON, BOM, ProductionRun with WAC |
| Restaurant / Bakery / Manufacturing | **Recipe Cost dashboard (V3, shipped 2026-05-28)** — `GET /api/recipe-cost` derives cost-per-unit + margin from active BOMs (component `weightedAvgCostPaise`, fallback `purchasePrice`); flags loss-making + incomplete-costing recipes; `/recipe-cost` page, More→Production card. Read-only, auth-gated like BOM, no schema. |
| Wholesale | Batch default ON |
| Retail | Standard nav, stock default ON |

**Vertical-depth backlog (next-epic candidates):**

| Epic | Verticals | Effort | Severity |
|---|---|---|---|
| ~~V1 — Hourly billing on Jobs~~ ✅ SHIPPED 2026-05-29 | Services/Freelancer/Salon/Clinic | — | done |
| V2 — Appointment calendar + slot picker | Salon/Clinic | ~2 wks | HIGH (onboarding blocker) |
| ~~V3 — Recipe cost dashboard (BOM-derived)~~ ✅ SHIPPED 2026-05-28 | Restaurant/Bakery/Manufacturing | — | done |
| V4 — Staff assignment + commission split on Jobs/Orders | Services/Bakery/Tailor/Manufacturing | ~2 wks | MEDIUM (extends Phase 6 #128) |
| ~~V5 — Customer delivery reminders (`offsetDays` before delivery)~~ ✅ SHIPPED 2026-05-29 | Bakery/Tailor | — | done (day-granular; hour-precision → FUTURE_EPIC) |
| V6 — Table mgmt + KOT | Restaurant | LARGE | LOW (out of scope) |
| V7 — Prescription field | Pharmacy/Clinic | trivial | LOW (custom-fields today) |

Recommended sequence post merge-to-prod: ~~V3~~ ✅ → ~~V1~~ ✅ → ~~V5~~ ✅ → V2 → V4.

---

## 6. Success metrics

| Milestone | Target Week | Criteria |
|---|---|---|
| MVP feature-complete | 10 | All 62 features pass `/verify` |
| Beta (5–10 businesses) | 11 | Zero data loss / 1 week |
| MVP ship | 12 | Beta feedback addressed |
| GST-compliant | 18 | CA-validated reports |
| 100 paying users | 24 | Product-market fit signal |
| Full accounting | 30 | P&L + Balance Sheet CA-verified |
| 1000 users | 36 | Growth marketing on |
| AI features live | 48 | Voice + receipt scan |

**Top 5 user pain points we exploit:**
1. Data loss → auto-backup + offline-first + zero data loss
2. Terrible support (3–4 month resolution) → WhatsApp support, fix in days
3. Broken inventory (stock 0, bills still generate) → atomic validation
4. Rigid roles → granular role builder
5. No offline → full offline-first

**Top 5 features users love (must match):**
1. Simple interface for beginners
2. WhatsApp invoice sharing (one tap)
3. Payment reminders (automated)
4. Multi-device access
5. Daily/monthly reports

**Critical migration feature:** Opening balances (#17) — without this, zero users migrate from Vyapar/MyBillBook/manual books.

---

## 7. Pricing tiers

Ported from DudhHisaab subscription model (commit `3530e79`):

| Tier | Target | Key gates |
|---|---|---|
| FREE | Raju trying it out | Limited parties/products/invoices/mo, single business, no GST exports |
| STARTER | Raju steady | Unlimited basics, manual backup, no marketing comms |
| PRO | Priya | Multi-staff (custom roles), all GST, marketing comms, multi-godown |
| PRO_MAX | Amit | Multi-firm (Phase 6 #138), advanced audit, commission, BOM, e-invoice/e-way bill, API |

**State machine** (7 states, 19 transitions): TRIAL → ACTIVE → PAST_DUE → GRACE → SUSPENDED → CANCELLED → EXPIRED, with OVERFLOW pseudo-state for usage-cap breaches. Writer SSOT enforced via `pg_advisory_xact_lock`. SubscriptionEvent (unique `razorpayEventId`) gives idempotent webhook handling.

**Add-ons:** FeatureAddon (catalogue) + BusinessAddon (per-tenant). UPI Autopay mandate flow via Razorpay (create / status / cancel, VPA last-4 masked in logs).

**Offline entitlement:** RS256-signed JWT, 24h TTL, `trustedTime` clock-rewind detection.

---

## 8. Remaining work

**Build (no creds needed):**
- Phase 7 (remaining 1): #143 WA bot (creds-blocked). Done: #142 Voice · #144 Smart GST · #146 Predictive · #147 Auto-recon · #148 Smart inv · #149 Competitor imports · #150 Multi-user collab (LWW + optimistic lock).
- Phase 3 deferred #89 Bank Reconciliation — shipped inside #147.
- Vertical depth: V1–V7 (see §5).

**Activate (code shipped, env vars needed on Render):**
- #2 Subscription — `ENTITLEMENT_JWT_PRIVATE_KEY`, `ENTITLEMENT_JWT_PUBLIC_KEY`, `RAZORPAY_WEBHOOK_SECRET`.
- Epic A — `MARKETING_ENABLED=true`, `AISENSY_API_KEY`, `AISENSY_WEBHOOK_SECRET`, `MSG91_WEBHOOK_TOKEN`.
- #4 Notifications + #30 Auto-share + #32 Email PDF + #42 Reminders + #47 Low-stock — FCM / Aisensy / Resend / MSG91 keys.
- #59 Biometric — Capacitor plugin install.
- Phase 6 — `FEATURE_STAFF_HR` (default off), `FEATURE_TRANSACTION_PIN` (default on), cohort_pct flags, `PIN_GATE_DOMAIN`.

**Ship (built ≠ deployed):** `hisaabpro` is **0 commits ahead** of `master` (merged 2026-05-26 `caa390d` + subsequent pre-beta hardening on master). Render production deploy still trails — push to redeploy to ship Phase 5 + subscription port + responsive sweep + **Phase 6** + money-SSOT. Phase 6 ramps per `ROLLOUT_PHASE6.md` (see §20).

---

# Part II — TRD (Technical)

## 9. Stack & topology

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript + Tailwind 4 | 64 feature folders, ~221 files Phase 1 + Phase 4–6 additions |
| Mobile shell | Capacitor 8 | Android target; iOS later (CSS variables already cross-platform) |
| State | TanStack Query · Zustand (sparingly) | Query is the canonical server-state SSOT |
| Local DB | IndexedDB via Dexie | Mutation queue + opt-in read cache |
| PDF | @react-pdf/renderer | Client-side; no Puppeteer on server |
| Backend | Node + Express + TypeScript | 140 route files, 466 service files |
| ORM | Prisma | 134 models, 49 migrations, `migrate dev` only (db push blocked by pre-tool-gate) |
| DB | PostgreSQL | Render Postgres; pg_trgm + tsvector for search; `pg_advisory_xact_lock` for serial invariants |
| Auth | JWT + httpOnly cookies + CSRF | Refresh tokens, account lockout, CAPTCHA, replay protection |
| Payments | Razorpay | Subscription + UPI Autopay; HMAC + 5-min replay; businessId resolved server-side |
| Notifications | Aisensy (WA) · MSG91 (SMS) · Resend (email) · FCM (push) | Strategy pattern |
| OCR / AI | Anthropic Haiku | Receipt OCR (#141); future #142/#146 ports |
| Hosting | Vercel (FE) · Render (API) | `api.hisaabpro.in` (API), `app.hisaabpro.in` (PWA), `admin.hisaabpro.in` (admin), `hisaabpro.in` (marketing) |

**Topology:** monolith — single Express service backed by a single Postgres DB. **Not** microservices. Multi-tenant via `businessId` scoping on every model that holds business-owned data.

**Architectural invariants:**
- Amounts in **paise** (integer) on the wire and in DB. Display via `formatCurrency()` with `Intl.NumberFormat('en-IN')` (Rs 1,00,000 format).
- Tax rates in **basis points** (5% = 500 bps; commission cap = 10,000 bps).
- Currency exchange rates stored as `rate × 10000` (4 decimals).
- All write paths through Express services — no direct Prisma from routes. Services receive `businessId` from `req.user.activeBusinessId` (Phase 6 elevation).

---

## 10. Data model (134 Prisma models)

Grouped by domain. Full schema at `server/prisma/schema.prisma`. 49 migrations under `server/prisma/migrations/`.

**Auth & Tenancy (13):** User · BusinessUser · Business · Role · StaffInvite · UserAppSettings · RefreshToken · WebAuthnCredential · OtpCode · PinCredential · PinResetToken · UserSuspension · IdempotencyLog.

**Subscription & Billing (8):** Subscription · SubscriptionEvent (immutable audit, unique `razorpayEventId`) · FeatureAddon · BusinessAddon · UpiMandate · Coupon · CouponRedemption · WebhookEvent.

**Party & Pricing (8):** Party · PartyAddress · PartyGroup · PartyCustomFieldValue · PartyPricing · CreditLimit (on Party) · PriceList · PriceListEntry.

**Documents & Invoicing (10):** Document · DocumentLineItem · DocumentAdditionalCharge · DocumentCustomFieldValue · DocumentNumberSeries · DocumentSettings · DocumentShareLog · DigitalSignature · TermsAndConditionsTemplate · SharedLink (HMAC-signed public tokens).

**Products & Inventory (16):** Product · ProductCustomFieldValue · Category · Unit · UnitConversion · CustomFieldDefinition · InventorySetting · StockMovement (immutable) · StockAlert · Batch · SerialNumber · Godown · GodownStock · GodownTransfer · StockVerification · StockVerificationItem.

**POS & BOM (9):** PosSale · PosSaleItem · PosSaleEvent · PosReceiptCounter · PosSetting · Bom · BomComponent · ProductionRun · ProductionRunComponent.

**Payments (7):** Payment · PaymentAllocation · PaymentDiscount · PaymentLink · PaymentReminder · Cheque · BankAccount.

**Tax & Compliance (8):** TaxCategory · HsnCode (12K seeded) · EInvoice · EWayBill · GstReturn · GstReconciliation · GstReconciliationEntry · ExchangeRate.

**Accounting (8):** LedgerAccount · JournalEntry · JournalEntryLine · LoanAccount · LoanTransaction · FinancialYearClosure · OpeningBalance · Expense (+ ExpenseCategory + ExpenseBudget + ExpenseTemplate + OtherIncome).

**Marketing & CRM (10):** MarketingTemplate · MarketingCampaign · MarketingCampaignRecipient · ReminderRule · ReminderInstance · ReminderConfig · ReminderLog · NotificationPreference · CollectionCadence · PromiseToPay.

**Loyalty & Commission (4):** LoyaltyProgram · LoyaltyLedger (FIFO) · CommissionRule · CommissionLedger.

**Storefront & Verticals (4):** StorefrontProduct · Job · JobItem · CustomOrder + CustomOrderItem + CustomOrderAdvance.

**Staff & HR (Phase 6, 6):** Employee · EmployeeAdvance · Attendance · PayrollRun · Payroll · PayslipSnapshot.

**Audit & Admin (8):** AuditLog · AuditLogRedaction · AdminAction · AdminUser · ApprovalRequest · TransactionLockConfig · CashEntry · CashEntryEvent.

**Referral & Misc (8):** ReferralCode · ReferralEvent · ReferralReward · ReferralWithdrawal · Notification · NotificationCostTally · NotificationJob · PushToken · Feedback · RecurringInvoice · RecurringInvoiceRun.

**Multi-tenancy invariant:** every business-owned model carries `businessId` and is queried with `where: { businessId, ... }`. Cross-tenant guard: any service that takes an entity ID must verify it belongs to `req.user.activeBusinessId` before mutating. **PR0 audit (Phase 6) confirmed 0 cross-tenant leaks across 1,033 sites.**

**Money SSOT (2026-05-27, PR #2):** every monetary column is paise as `Int` (or `BigInt` for lifetime sums — `User.referralTotalEarnedPaise`, `ReferralCode.totalEarnedPaise`). Legacy `Decimal`/`Float` columns (`User.referralBalance`, `ReferralReward.amount`, `ReferralWithdrawal.amount`, `PaymentDiscount.value`, etc.) were dropped via a 3-migration ladder: additive paise columns (NULL-first) → backfill + `SET NOT NULL` with inline `COALESCE` safety + XOR `CHECK` constraint on `PaymentDiscount` (FIXED → `valuePaise`, PERCENTAGE → `percentBps` in basis points) → drop legacy columns. Wire shape (request/response JSON) still carries rupees for FE compatibility, converted at the service boundary. Never store, sum, or compare money as floating point.

---

## 11. Service & route layout

```
server/src/
├── routes/                  140 .ts files — Express routers, thin shells
│   ├── auth/                login, refresh, OTP, PIN, WebAuthn, 2FA
│   ├── webhooks/            stripe-style/razorpay/aisensy/msg91 (HMAC + replay)
│   ├── admin/               separate admin JWT path
│   ├── public/              /p/* — auth-free, rate-limited (60 rpm/IP)
│   └── (per-feature)        parties, documents, payments, inventory, etc.
├── services/                466 .ts files — business logic SSOT
│   ├── auth/                token mint/verify, lockout, CAPTCHA, PIN
│   ├── subscription/        state machine, writer-SSOT, advisory lock
│   ├── notifications/       strategy pattern (WA/SMS/Email/Push)
│   ├── audit/               AuditLog write + redaction + search (tsvector)
│   ├── tax-calc/            CGST/SGST/IGST, basis points
│   └── (per-feature)        documents, payments, inventory, etc.
├── middleware/
│   ├── auth.ts              JWT verify → req.user.userId
│   ├── requireActiveBusiness.ts  Phase 6 — verify tenancy + suspension
│   ├── requireFeature.ts    Phase 6 — flag + cohort gate
│   ├── requireRecentPin.ts  Phase 6 — PIN gate on sensitive routes
│   ├── csrf.ts              double-submit cookie pattern
│   ├── idempotency.ts       Idempotency-Key header → IdempotencyLog
│   └── replay-protection.ts X-Request-Id / nonce
├── config/
│   ├── env.ts               env contract (HIGH-RISK PATH)
│   ├── features.ts          flag bucketing (djb2 sticky hash)
│   └── verticals.config.ts  13 verticals SSOT
└── lib/
    ├── jwt.ts               sign/verify (HIGH-RISK PATH)
    ├── admin-auth.ts        SUPER_ADMIN guard (HIGH-RISK PATH)
    └── prisma.ts            singleton client
```

**Route conventions:**
- Every authenticated route chain: `auth → requireActiveBusiness → [requireFeature?] → [requireRecentPin?] → handler`.
- Validation: Zod schema at route entry; service receives parsed input.
- Errors: handler throws → centralised `errorMiddleware` maps to JSON `{ code, message }`. 401 vs 403 vs 400 vs 404 vs 409 vs 422.
- POSTs that mutate: `idempotencyCheck + replayProtection` (17+ routes hardened in 2026-05-15 audit, all new POSTs in Phase 6+).
- Webhooks: HMAC verify + 5-min replay window + per-event idempotency via `WebhookEvent.uniqueEventId`.

---

## 12. Frontend architecture

**6-layer split per feature** (mandatory, ≤250 LOC/file, enforced):

```
src/features/<feature>/
├── types.ts                 // interfaces + DTOs
├── constants.ts             // tokens, defaults, enums
├── utils.ts                 // pure functions
├── hooks/                   // useQuery / useMutation / form hooks
├── components/              // sub-components
└── <Feature>Page.tsx        // page composition
```

64 feature folders today. Translations excluded from file-length enforcement (`feedback_translations_ignore`).

**Network:** every API call goes through `api()` from `src/lib/api.ts` — handles cookie auth, CSRF, refresh-on-401, idempotency, offline queue, optional read cache. Raw `fetch()` allowed only in `api.ts`, `useOnlineStatus.ts`, `auth.ts`, `serviceWorkerRegistration.ts`, tests.

**State:** TanStack Query is server-state SSOT. Mutations return `{}` when queued offline — handlers must tolerate this (invalidate + toast, do NOT deref response fields).

**Routing:** React Router v6 with nested layouts. PublicShell at `/p/*` (auth-free). AdminShell at `/admin/*`. AuthGate on the rest.

**i18n:** `useLanguage()` hook + `t.keyName` selectors. EN/HI parity enforced (980:980 today). Keys live in `src/lib/translations.en.ts` + `translations.hi.ts`. App name from `APP_NAME` constant (never hardcoded).

**Money:** all amounts in paise on the wire; `formatCurrency()` for display; `tabular-nums` class on numeric columns; native spinner blocked on number inputs (block e/E/+/-).

---

## 13. Auth, tenancy, PIN, admin

### 13.1 User auth
- Login: OTP (MSG91) or dev login (admin/admin123, gated by `ALLOW_DEV_LOGIN` for closed testing).
- Tokens: short-lived access JWT (15 min) + long-lived refresh in httpOnly cookie.
- CSRF: double-submit cookie pattern via `csrf.ts` middleware.
- Account lockout: 5 fails → 15-min lockout. CAPTCHA after 3 fails.
- 2FA: TOTP + WebAuthn (`WebAuthnCredential`).
- Refresh tokens stored in `RefreshToken` (revocable).
- **Family rotation (2026-05-27, RFC 6819 §5.2.2.3):** each refresh issues a new token in the same `family` lineage and revokes the prior one. Re-use of a revoked token = stolen credential — the entire family is invalidated and the user is forced to re-login. Implementation: `RefreshToken.familyId` + `replacedByTokenId`; detection at `services/auth/refresh.service.ts`.

### 13.2 Tenancy (Phase 6 #138)
- `Business` is the tenant. A `User` belongs to ≥1 Business via `BusinessUser` (with `Role`).
- `User.activeBusinessId` (cookie-pinned, Phase 6 elevation) selects the active tenant per session.
- `requireActiveBusiness` middleware: verifies membership, blocks if `UserSuspension` row active for `(userId, businessId)`.
- Suspension UX: `SuspendBanner` + `ReactivationModal`; admin-initiated suspend writes audit row + sets cookie domain via `PIN_GATE_DOMAIN` SSOT.
- TenantChip in header shows active business + switcher.

### 13.3 PIN gate (Phase 6 #140)
- `PinCredential` (6-digit, bcrypt-hashed, per-user).
- `/api/auth/pin/set | verify | reset` routes; `PinResetToken` for recovery via OTP.
- `requireRecentPin` middleware: checks `pin_verified_at` cookie ≤ N minutes old. 403 with `{ code: 'PIN_REQUIRED' }` triggers FE PinPad sheet via api.ts interceptor.
- Default ON for all users (`FEATURE_TRANSACTION_PIN_COHORT_PCT=100`).
- 6.1 hardening: dropped unused `PinPhoneLockout` table (SHOULD_FIX-2), removed dead `PIN_GATE_DOMAIN_PREFIX_MISMATCH` (SHOULD_FIX-3).

### 13.4 Admin panel
- **Separate JWT** (`AdminUser` table, `lib/admin-auth.ts`). HIGH-RISK PATH.
- `SUPER_ADMIN` guard on platform-level routes (grant subscription, impersonation).
- AdminAction audit log on every privileged op.
- Hosted at `admin.hisaabpro.in` (Vercel).

### 13.5 Custom roles (#56)
- `Role` model holds `permissions: Json` (granular: `invoicing.create`, `invoicing.bogo`, `commission.view`, etc.).
- `BusinessSummary.permissions` projected into JWT claims for FE gate checks.
- Owner-defined; staff invites bind to a Role.

---

## 14. Subscription state machine

Ported from DudhHisaab (commit `3530e79`). PRDs in `PRDs/subscription-port-*.md`.

**7 states:** `TRIAL → ACTIVE → PAST_DUE → GRACE → SUSPENDED → CANCELLED → EXPIRED`. **OVERFLOW** pseudo-state for usage-cap breach.

**19 transitions** orchestrated by `subscription.writer.service.ts`:
- TRIAL → ACTIVE on first successful payment.
- ACTIVE → PAST_DUE on payment fail.
- PAST_DUE → GRACE after N days (configurable).
- GRACE → SUSPENDED on grace expiry (cron).
- Any → CANCELLED on user/admin cancel.
- ACTIVE/PAST_DUE/GRACE → ACTIVE on successful retry.

**SSOT enforcement:** writer service is the ONLY caller of `prisma.subscription.update`. `enforce.js` Writer-SSOT-ban check blocks any other write. Per-business serialisation via `pg_try_advisory_xact_lock(hashtext(businessId))` to prevent concurrent state corruption.

**SubscriptionEvent (audit):** immutable; unique `razorpayEventId` for idempotent webhook handling. Every state change writes a row.

**UPI Autopay mandate:** `UpiMandate` model. Flow: create → status → cancel. VPA masked to last-4 in logs (`enforce.js` JWT-in-logs-ban + VPA redaction).

**Offline entitlement JWT:** RS256-signed (PEM keys in env), 24 h TTL, embedded `trustedTime` for clock-rewind detection. Public-key endpoint `/api/.well-known/entitlement-pubkey`.

**Grace + crons:**
- `trial-end` (daily, 03:00 IST) — TRIAL → PAST_DUE if no payment.
- `mandate-reminder` (daily, 09:00 IST) — notify before debit.
- `grace-expiry` (daily, 04:00 IST) — GRACE → SUSPENDED.

**FE:** PlanGate (HOC), OverflowBanner, MandateSetupDrawer, `SubscriptionManagePage` at `/settings/subscription`.

---

## 15. Offline-first contract

Source: `.claude/rules/OFFLINE_RULES.md`. Enforced by `scripts/enforce-offline.mjs` (pre-commit ratchet).

**Rule 1 — All API calls go through `api()`.** Raw `fetch()` blocked outside the allowlist (`api.ts`, `useOnlineStatus.ts`, `auth.ts`, `serviceWorkerRegistration.ts`, tests).

**Rule 2 — Mutations carry `entityType` + `entityLabel`** so the offline queue UI says "Saving party — Raju Traders" not "Offline change".

**Rule 3 — Reads default network-only.** Opt in with `cacheReads: true` only when PII-safe. Never cache: `/auth/*`, `/me`, `/csrf-token`, search results, exports.

**Rule 4 — No `localStorage` for entity data.** Use Dexie (`src/lib/offline.ts` + `api-cache.ts`). `sessionStorage` only for short-lived auth artefacts (`cachedUser`).

**Rule 5 — Mutation handlers tolerate optimistic `{}` return.** When `api()` queues offline it returns `{} as T`. Handlers must invalidate cache + toast, NOT deref `created.id`.

**Sync queue:** Dexie table `mutationQueue` keyed by uuid. On reconnect, replay in order. Idempotency-Key header carries the uuid → server `IdempotencyLog` dedupes.

**Service Worker:** registered in `serviceWorkerRegistration.ts`. Caches static reference data (units, tax categories, HSN) via Workbox-style rules in `vite.config.ts`. App shell precached. PII never SW-cached.

---

## 16. Design system

Source: `.claude/skills/hp-design/SKILL.md` + `docs/DESIGN_LANGUAGE.md` + `docs/DESIGN_SYSTEM.md` + `docs/PAGE_DESIGN_GUIDE.md`. Per-page checklist: `.claude/rules/PAGE_AUDIT_CHECKLIST.md`.

**Aesthetic:** premium Cred/Jupiter polish. Light primary, dark secondary. Blue/teal trust colour. Inter font, 16 px min body. Generous whitespace, soft shadows, 8–12 px radius, subtle micro-interactions. Mobile 375 px primary, 320 px minimum.

**Tokens (no raw values allowed):**
- Colour: `var(--color-*)` only — no hex, no Tailwind palette (`text-red-500` banned).
- Radius: `rounded-[var(--radius-*)]` (xl=cards, md=inputs, sm=buttons, lg=modals, full=chips).
- Font size: `text-[var(--fs-*)]`.
- Shadow: `var(--shadow-*)`.
- Duration: `var(--duration-*)` / `TIMINGS.*`.
- Easing: `var(--ease-*)`.
- Z-index: `Z.*` from `src/config/zIndexes.ts` (no `z-50` literals).

**Primitives (no raw HTML for interactive):** `<Button>` (primary/secondary/outline/text/ghost/danger), `<Input>`, `<Textarea>`, `<Select>` / `<SelectItem>` (Radix; sentinel values `__all__` / `__none__` / `__overall__` / `__any__` / `__never__` for empty-state slots), `<Card>`, `<ConfirmDialog>` (never `window.confirm`), `<Modal>` / `<Drawer>`, `<Badge>`, `<PartyAvatar>` / `<Avatar>`, `<Accordion>`, `useToast()` (never `alert`), `<BarcodeScanner>`, `<OfflineBanner>`.

**P4 Consistency Sweep (in-progress, ratchet via `scripts/enforce-primitives.mjs`):** `rawSelect` 58 → **0** across waves 13–17, `rawTextarea` 30 → **0** in wave 18, `rawInput` 294 → **0** in wave 19 (146 files; added naked mode to `<Input>` to preserve filter-bar / table-cell layouts, batch `d837ad6`). Remaining baseline: `rawButton=594`, `nativeConfirm=0`, `missingEmptyState=0`, `missingErrorState=0`. Pre-commit refuses regressions; new waves ratchet baseline downward.

**Layout discipline:**
- Page padding: `px-4` only.
- Section gap: `space-y-6` / `gap-6` (24 px).
- Form fields: `space-y-4`.
- Label→input gap: `mb-1.5`.
- Bottom-nav clearance: `pb-[calc(var(--bottom-nav-height)+2rem)]`.
- Touch targets ≥ 44 px.

**Responsive:** every page wrapped in `<PageContainer variant="list|detail|form|dashboard|split">`. Grid breakpoints 1/2/3/4 across sm→xl. Forms `max-w-2xl mx-auto` ≥md. No horizontal scroll at 320/375/768/1024/1280/1536. `<ResponsiveTable>` switches card↔table at md. SideNav rail ≥lg.

**4 UI states mandatory per screen:** loading (`<Skeleton>`), error (`<ErrorState onRetry>`), empty (`<EmptyState action>`), success.

**Icons:** lucide-react only. Sizes: form `w-4 h-4`, action `w-5 h-5`, dialog header `w-6 h-6`.

**Money:** paise on wire, `formatCurrency()` for display, `tabular-nums`, Indian `1,00,000` format.

**Dark mode:** CSS-var swap (no `dark:` Tailwind classes). Tested in both.

---

## 17. Platform shell (mobile)

Source: `.claude/rules/PLATFORM_SHELL.md`. Enforced by `scripts/enforce.js` checks 9, 10, 11, 12.

**Mental model:** Android 15+ mandates edge-to-edge. WebView spans full screen. Capacitor injects `--safe-area-inset-{top,right,bottom,left}` on `viewport-fit=cover`. **Platform primitives** (header, BottomNav, drawers, side-nav) pad themselves by those insets. Feature code lives between the padded primitives and never references insets.

**Invariants:**
- **C1** `viewport-fit=cover` in `index.html` (without this, Capacitor doesn't inject vars).
- **C2** No fictional capacitor.config keys (e.g. `adjustMarginsForEdgeToEdge` doesn't exist in 8.2.0). Plugins block: `Keyboard.resize: 'native'` + `resizeOnFullScreen: false` + Splash + BarcodeScanning.
- **C3** `MainActivity` is plain `BridgeActivity` — no `WindowCompat`, no `EdgeToEdge.enable`. Configuration theme-only. Enforce check 11 bans `setStatusBarColor` / `setNavigationBarColor` / `setDecorFitsSystemWindows` in Java/Kotlin.
- **C4** Theme `AppTheme.NoActionBar`: `windowLightStatusBar=true`, `windowLightNavigationBar=true`, transparent status + nav bars. No `fitsSystemWindows`, no Android 15-deprecated APIs.
- **C5** `var(--safe-area-inset-*)` allowed only in primitives. Banned everywhere: native `env(safe-area-inset-*)` (iOS-only, yields 0 on Android). Banned in feature code: `var(--safe-area-inset-*)` direct usage.
- **C6** `position: fixed; bottom: 0` is a primitive responsibility (allowlist in enforce.js). Feature pages consume `<Drawer>` / `<BottomActionBar>`.
- **C7** `@capacitor-community/safe-area` MUST NOT be installed (duplicates native).
- **C8** `Keyboard.resize: 'native'` (not fullscreen).
- **C9** `--bottom-nav-height = 112px + var(--bottom-nav-safe-inset)`. Page bodies `padding-bottom: var(--bottom-nav-height)`. Floating elements `bottom: calc(var(--bottom-nav-height) + <gap>)` — never hardcoded.
- **C10** `--header-height = 56px + var(--header-safe-inset)`. Sticky bars below header use `top: var(--header-height)`, not `top: 0`. Enforce check 12.
- **C11** `overscroll-behavior: none` on `html` + `body` — kills Chromium rubber-band that translates the whole viewport past OS bars.

---

## 18. Enforcement & gates

Source: `~/.claude/rules/RULES.md` + project `scripts/`.

**Pre-edit gate** (`~/.claude/hooks/pre-tool-gate.sh`): blocks frozen files, `db push`, force push, `.env`, `rm -rf`.

**High-risk path gate** (`~/.claude/hooks/check-plan-required.cjs`): blocks edits to schema/auth/billing/env/webhooks/admin paths without an approved `<project>/.claude/design-plan-active.md`. See §22.

**Post-edit hook** (`~/.claude/hooks/post-write-enforce.sh`): auto-fix → detect → escalate → log (0.5 s, 0 tokens).

**Pre-commit** (`.husky/pre-commit` → `scripts/enforce.js`): 24 ESLint rules + tsc + 31+ patterns + 6 fixers + ratchet. Notable checks:
- **9–12** Platform shell (safe-area-insets, fixed-bottom, fixed-top discipline)
- **Writer-SSOT-ban** subscription/loyalty/commission writers
- **JWT-in-logs-ban** no JWT/refresh tokens in `console.*` / logger calls
- **enforce-offline.mjs** raw fetch / entityType / cacheReads / localStorage / mutation handlers
- **enforce-primitives.mjs** ratcheted ban on `<button>` / `<input>` / `<select>` / `<textarea>` + `window.confirm` / `alert` in feature `.tsx`. Baseline lives in `.claude/primitives-baseline.json`. Wave 17 (2026-05-30) ratcheted `rawSelect` to 0; Wave 18 (2026-05-30) ratcheted `rawTextarea` to 0 and introduced `<Textarea>` primitive; Wave 19 (2026-05-30) ratcheted `rawInput` to 0 and added naked mode to `<Input>`.
- **enforce-audit-coverage.mjs --block** every Phase 6 mutation route must write an AuditLog row

**Commit-msg hook** (`.husky/commit-msg`): rejects `fix(...)` commits unless body contains `Root cause:` line with `<file>:<line>` ref + reference to fix-trace file or new test file.

**Auto-evolve** (`scripts/auto-evolve.js`): cross-session learning → promotion → decay → rotation. Lessons promote to ESLint > pattern checker > auto-fixer.

**Health** (`scripts/system-health.js --gold-standard --brief`): periodic codebase-quality snapshot. NOT a per-feature gate.

**Manifest score** (`scripts/manifest-score.js --brief`): periodic feature-completeness snapshot.

---

## 19. Security posture

Aggregates `SECURITY_AUDIT_*.md` per epic. All passes GREEN.

**OWASP top 10 coverage:**
- A01 Broken access control: tenancy guard on every business-scoped query (`req.user.activeBusinessId`, never `req.user.id` — see memory `feedback_auth_req_user_shape`). 0 cross-tenant leaks (Phase 6 PR0 audit, 1,033 sites).
- A02 Crypto failures: bcrypt for passwords + PINs. RS256 for entitlement JWT. HMAC-SHA256 for SharedLink tokens + webhook signatures. timingSafeEqual for OTP/PIN comparisons.
- A03 Injection: Prisma parametric queries throughout. Full-text search uses `websearch_to_tsquery` (Phase 6 audit search), never plain `to_tsquery`. No raw SQL outside seeded HSN.
- A04 Insecure design: writer-SSOT for subscription state. Advisory locks for serial invariants (subscription transitions, loyalty redeem). Idempotency on POSTs.
- A05 Misconfig: `lib/env.ts` is HIGH-RISK PATH; missing required var → boot failure. Helmet headers. CSP locked.
- A06 Vulnerable deps: monthly `npm audit`. Capacitor 8 + Prisma latest.
- A07 Auth: account lockout after 5 fails, CAPTCHA after 3. **Refresh-token family rotation** (RFC 6819 §5.2.2.3, 2026-05-27 `cf9bcb6`) — reuse of a revoked refresh token invalidates the entire family + forces re-login. WebAuthn supported.
- A08 SSRF / integrity: webhooks verify HMAC + 5-min replay + `WebhookEvent.uniqueEventId`.
- A09 Logging: AuditLog covers 100% mutations (enforcer `--block`). PII redaction layer (`AuditLogRedaction`). No JWT/VPA/PII in `console.*` (enforce check). **Security batch A (2026-05-27 `5481f6b`):** CSV-export injection guard (formula-prefix sanitiser), Sentry/logger PII scrubber, single SSOT for phone-PII regex.
- A10 SSRF: no user-supplied URLs server-side fetched (storefront serves only catalogue images uploaded to our R2/S3).

**Public surface (`/p/*`):** auth-free, rate-limited 60 rpm/IP, HMAC tokens with expiry + revocation. Reserved-slugs registry blocks storefront slug squatting.

**PIN gate:** sensitive routes (delete invoice, edit locked txn, payroll reverse, suspend/reactivate) require `requireRecentPin` (cookie window N min).

**Admin:** separate JWT, `SUPER_ADMIN` guard, every action writes `AdminAction` audit row.

**Per-epic security passes (PASS):** GST Phase 2, Notifications, Phase 5 Marketing, Phase 5 Sales (B), Customer-facing (C), CRM/Loyalty/Commission (D), Phase 6 Pass-1 + Pass-2. Files: `docs/archive/SECURITY_AUDIT_*.md`.

---

## 20. Rollout & feature flags

Source: `docs/archive/ROLLOUT_PHASE6.md` + `docs/archive/RUNBOOK_PHASE6.md`.

**Flag inventory (Phase 6):**

| Flag (BE / FE) | Default | Gates | Independent of |
|---|---|---|---|
| `FEATURE_STAFF_HR` / `VITE_FEATURE_STAFF_HR` | `false` | All Phase-6 HR routes + tenancy elevation + audit-search UI | TRANSACTION_PIN |
| `FEATURE_STAFF_HR_COHORT_PCT` / `VITE_…` | `0` | Sticky % gate, server-bucketed `hash(userId) % 100 < pct` | — |
| `FEATURE_TRANSACTION_PIN` / `VITE_…` | `true` | `requireRecentPin` active | STAFF_HR |
| `FEATURE_TRANSACTION_PIN_COHORT_PCT` / `VITE_…` | `100` | PIN cohort (default 100 because PR3 enrolled all users) | — |

Implementation: `server/src/config/features.ts` djb2 sticky hash.

**5-stage cohort ramp:**

| Stage | Audience | Flag | Duration | Promotion gate |
|---|---|---|---|---|
| 0 — Internal | Sawan's phone + 1 QA | `FEATURE_STAFF_HR=true` session env, cohort_pct=0, manual allowlist | 48 h | 17/17 acceptance checks (curl + screenshots); zero `pin_gate.cookie_tamper_detected`; zero `payment_already_reversed_total` false-positives |
| 1 — 10 % | Random hash-bucketed | cohort_pct=10 | 72 h | error rate < 0.1 %, no P0/P1 |
| 2 — 25 % | … | 25 | 72 h | same |
| 3 — 50 % | … | 50 | 72 h | same |
| 4 — 100 % | All | 100 | — | — |

**Hold triggers:** error rate spike >5×, audit-log write latency p99 >500 ms, PIN-gate cookie-tamper events >0.
**Rollback triggers:** any P0; cross-tenant leak; data loss. Set cohort_pct back to previous stage. Full off = set `FEATURE_STAFF_HR=false`.

**Runbook playbooks** (per failure class): tenancy elevation failure, PIN gate lockout, audit-log write storm, payroll reversal divergence, attendance batch corruption. See `docs/archive/RUNBOOK_PHASE6.md`.

**Other epics — kill switches:**
- Subscription: `SUBSCRIPTION_ENABLED` env (default true once keys land); webhook handler is idempotent so disabling is safe.
- Marketing: `MARKETING_ENABLED=false` blocks campaign send + reminder cron entry-points.

---

## 21. Deployment & ops

**Topology:**
- Marketing site → Vercel (`hisaabpro.in`, `www.hisaabpro.in`)
- PWA → Vercel (`app.hisaabpro.in`)
- Admin → Vercel (`admin.hisaabpro.in`)
- API → Render (`api.hisaabpro.in`)
- DB → Render Postgres
- Email → ImprovMX → Sawan's Gmail
- DNS → Hostinger

**Branches:**
- `master` — production HEAD. Render auto-deploys API. Vercel auto-deploys FE.
- `hisaabpro` — current dev branch. **38 commits ahead of master.** Production deploy is at `89610b0`.

**Pre-merge to-do (next ship-to-prod):**
1. Set Render env vars:
   - Phase 6: `FEATURE_STAFF_HR=false`, `FEATURE_STAFF_HR_COHORT_PCT=0`, `FEATURE_TRANSACTION_PIN=true`, `FEATURE_TRANSACTION_PIN_COHORT_PCT=100`, `PIN_GATE_DOMAIN=.hisaabpro.in`
   - Subscription: `ENTITLEMENT_JWT_PRIVATE_KEY` (RS256 PEM), `ENTITLEMENT_JWT_PUBLIC_KEY` (SPKI PEM), `RAZORPAY_WEBHOOK_SECRET`
   - Marketing: `MARKETING_ENABLED=true`, `AISENSY_API_KEY`, `AISENSY_WEBHOOK_SECRET`, `MSG91_WEBHOOK_TOKEN`
2. `npx prisma migrate deploy` (Phase 6 adds 9 tables + 28 cols; subscription port + Epic D already in migration history).
3. Merge `hisaabpro` → `master` (fast-forward possible — confirmed `master` is ancestor of `hisaabpro`).
4. Smoke-test:
   - Phase 6: PIN set/verify, attendance daily grid, payroll run + payslip PDF, audit search + CSV, suspend/reactivate banner.
   - Epic D: loyalty redeem in POS, commission ledger row on sale, party CRM tab.
   - Public: `/p/inv/<token>`, `/p/store/<slug>`, `/p/invite/<token>`.
5. Start Phase 6 cohort ramp (Stage 0 internal 48 h → Stage 1 10 %).

**Migrations contract:**
- `prisma migrate dev --name X` only. `db push` blocked by pre-tool-gate.
- Add-column → backfill → make-NOT-NULL ordering.
- GIN indexes (trgm + tsvector) via raw SQL only — no `@@index` (duplicate B-tree).
- Already-shipped migrations are immutable history.

**Mobile release (Android):** `cap sync → versionCode bump → signed AAB → Play Store internal track`. See `.claude/agents/android-release` agent.

---

## 22. High-risk paths

Source: `~/.claude/rules/HIGH_RISK_PATHS.md`. Edits to these paths require an approved `<project>/.claude/design-plan-active.md` proving the right agents ran (`scope-writer → architect → security → task-manager`).

**Schema & migrations:** `prisma/schema.prisma`, `prisma/migrations/**` → requires `architect`.

**Auth:** `services/auth.service.ts`, `services/sso.service.ts`, `services/oauth*.ts`, `lib/jwt.ts`, `middleware/auth*.ts` → requires `architect, security`.

**Billing:** `services/stripe.service.ts`, `services/refund.service.ts`, `routes/**/webhooks.ts`, `routes/**/stripe*.ts` → requires `architect, security`. (Razorpay equivalents fall here.)

**Env & secrets:** `lib/env.ts`, `config/secrets*.ts` → requires `architect` (+ `security` for secrets).

**User & impersonation:** `services/user.service.ts` → `scope-writer, architect`. `services/impersonation.service.ts`, `services/admin-auth.ts`, `lib/admin-auth.ts` → `architect, security`.

**Hook chain & gate SSOT:** `hooks/pre-tool-gate.sh`, `rules/HIGH_RISK_PATHS.md`, `hooks/lib/bypass.cjs`, `hooks/refuse-bare-tree.cjs`, `hooks/check-plan-required.cjs` → `architect, security` (gates protect themselves).

Emergency bypass: `CLAUDE_HIGHRISK_BYPASS=1` (audited weekly).

---

## 23. Glossary

- **paise** — 1/100 of a rupee. All money on wire/DB is integer paise.
- **bps (basis points)** — 1/100 of a percent. Tax rates and commission caps live here.
- **FEFO** — First-Expired-First-Out batch claim (pharmacy + perishables).
- **HSN** — Harmonised System Nomenclature; product code for GST.
- **GSTR** — GST Return (1 = outward, 3B = monthly summary, 9 = annual).
- **IRN** — Invoice Reference Number (64 chars, from NIC e-invoice portal).
- **VPA** — Virtual Payment Address (UPI handle, e.g. `name@hdfcbank`).
- **UPI Autopay mandate** — recurring debit authorisation via Razorpay.
- **Writer SSOT** — only one service file may call `prisma.<model>.update` for a state-managed model. Enforced.
- **Cohort bucketing** — `djb2(userId) % 100 < pct` sticky hash, deterministic.
- **Tenant elevation** — Phase 6 promotion of `(userId, businessId)` from session to first-class cookie-pinned context.
- **BOGO** — Buy-One-Get-One free; tracked as custom-role permission `invoicing.bogo`.
- **WAC** — Weighted Average Cost; propagated through `ProductionRun` on BOM consumption.

---

## Appendix A — Source documents (archived)

The following prior PRDs / architectures / audits are preserved under `docs/archive/` for blame history. Each was distilled into the relevant section above.

**Scope (PRDs):** `SCOPE_phase5_marketing_comms`, `SCOPE_phase5_sales_workflow`, `SCOPE_EPIC_B_sales_workflow`, `SCOPE_EPIC_C_customer_facing`, `SCOPE_EPIC_D_crm_loyalty`, `SCOPE_PHASE6_STAFF_HR`, `SCOPE_pos_checkout`, `SCOPE_bom_manufacturing`, `SCOPE_barcode_and_label`, `SCOPE_catalog_enrichment`, `SCOPE_cash_register`, `SCOPE_expenses_upgrade`, `SCOPE_gst_phase_2`, `SCOPE_notifications_engine`, `SCOPE_132_price_lists`.

**Architecture:** `ARCHITECTURE_phase5_marketing_comms`, `ARCHITECTURE_phase5_sales_workflow`, `ARCHITECTURE_EPIC_B`, `ARCHITECTURE_EPIC_C`, `ARCHITECTURE_EPIC_D`, `ARCHITECTURE_PHASE6_STAFF_HR`, `ARCHITECTURE_pos_checkout`, `ARCHITECTURE_bom_manufacturing`, `ARCHITECTURE_barcode_and_label`, `ARCHITECTURE_catalog_enrichment`, `ARCHITECTURE_cash_register`, `ARCHITECTURE_expenses_upgrade`, `ARCHITECTURE_gst_phase_2`, `ARCHITECTURE_notifications_engine`, `ARCHITECTURE_132_price_lists`.

**Security audits (all PASS):** `SECURITY_AUDIT_phase5_marketing_comms`, `SECURITY_AUDIT_phase5_sales_workflow`, `SECURITY_AUDIT_EPIC_B`, `SECURITY_AUDIT_EPIC_C`, `SECURITY_AUDIT_EPIC_D_crm_loyalty`, `SECURITY_AUDIT_PHASE6_STAFF_HR`, `SECURITY_AUDIT_PHASE6_PASS2`, `SECURITY_AUDIT_gst_phase_2`, `SECURITY_AUDIT_notifications_engine`.

**Audits (architecture + scope):** `ARCHITECTURE_AUDIT_EPIC_D_crm_loyalty`, `ARCHITECTURE_AUDIT_PHASE6_STAFF_HR`, `SCOPE_AUDIT_PHASE6_STAFF_HR`.

**QA / verifier:** `QA_GATE_EPIC_D_crm_loyalty`, `QA_cash_register`, `QA_USER_JOURNEY_2026-04-23`, `VERIFIER_REPORT_PHASE6`, `VERIFIER_cash_register`, `VERIFIER_expenses_upgrade`.

**Tasks:** `TASKS_EPIC_B`, `TASKS_EPIC_C`, `TASKS_EPIC_D`, `TASKS_PHASE6_STAFF_HR`, `TASKS_cash_register`, `TASKS_expenses_upgrade`, `TASKS_gst_phase_2`, `TASKS_notifications_engine`, `TASKS_pos_checkout`, `TASKS_132_price_lists`.

**Rollout & runbook:** `ROLLOUT_PHASE6`, `RUNBOOK_PHASE6`.

**Other:** `TENANCY_AUDIT`, `USER_JOURNEYS`, `EDGE_CASES_ANALYSIS`, `GST_v7_DEPLOYMENT`, `PRODUCT_BRIEF` (predecessor of Part I), `FEATURE_MAP` (legacy F001–F152 numbering, superseded by §4 above).

**Kept at root (still active operational docs):**
- `docs/HISAABPRO.md` ← this document
- `docs/ROADMAP.md` — live status table, updated per epic
- `docs/BACKLOG.md` — live resume order + ship-to-prod checklist
- `docs/IDEAS_BACKLOG.md` — unsequenced future ideas
- `docs/APP_CONFIG.md` — brand SSOT (name/domain/email)
- `docs/DESIGN_LANGUAGE.md`, `docs/DESIGN_SYSTEM.md`, `docs/PAGE_DESIGN_GUIDE.md` — design references (Part II §16 distils into the spec)

---

## 24. Feature Status Matrix (audited 2026-05-26, header refreshed 2026-05-27, line-by-line re-audit 2026-05-29)

> **Line-by-line code re-audit 2026-05-29** (`docs/audit/FEATURE_AUDIT_SUMMARY.md`):
> 150/165 rows verified exactly. Corrected this pass — drift rows now carry an
> inline `audit 2026-05-29:` note: #5 (Drive backup fixed 2026-05-29 — OAuth+PKCE,
> AES-256-GCM token-at-rest, env-gated; email-export still CSV),
> #8 (fixed 2026-05-29 — theme variants shipped), #32 (fixed 2026-05-29 — client-render+upload),
> #61 (fixed 2026-05-29 — global listener) & #78 (fixed 2026-05-29 — real GSP
> lookup, cred-blocked), #76 (fixed 2026-05-29 — curated
> 126-code seed + trgm GIN), #90/#91 (no voucher endpoint), #92 (RETURNED≠BOUNCED), #100/#127/
> #130/#133/#140 (path/label fixes), #104/#114 (field/branch fixes). Two real
> bugs were flagged with `*`: **S1** (#84–#87, #104 — GL reports read a journal
> that transactions didn't auto-post to) and **N4** (#99 — FY-closure threw on a
> seeded business). **Both fixed 2026-05-29**: S1 wires invoice/payment/expense
> mutations to synchronous hard-atomic GL posting (`services/accounting/posting/*`,
> idempotency index `JournalEntry_source_posted_key`, COGS leg, VOID-in-place
> reversal, `scripts/backfill-gl.ts` for history); N4 resolves Retained Earnings
> by seeded code 3100.
>
> Authoritative per-feature × per-sub-feature status, audited against the live
> codebase on `master` (HEAD `6ba7c0f`, originally audited at `6134b9b`; commits since are pre-beta hardening only — money-SSOT merge, refresh-token rotation, security batch A, W4b test sweep — no feature-row changes). For each row: route+service+model+page
> are grep-verified; commit attribution uses the most recent meaningful
> commit that touched a representative file. `[B]` cred-blocked features
> have shipped code — listed as **In-Progress** here because production
> activation requires env vars (Razorpay / Aisensy / FCM / MSG91 / Resend) or
> a Capacitor plugin install.

**Summary — 150 features, ~180 sub-feature rows tracked + 7 vertical-depth epics:**
- **Done:** 139 features (all layers present + shipped on `master`; #142 voice + #147 auto-reconciliation + #150 multi-user collab 2026-05-28).
- **In-Progress (cred-blocked):** 9 features (code shipped, awaiting env vars / plugin install: #2, #4, #30, #32, #42, #47, #59, #78, #123/#124 providers).
- **Not Started:** 1 feature (#143) + 5 vertical-depth epics (V3 shipped 2026-05-28, V1 shipped 2026-05-29).
- **Deferred:** #89 Bank Reconciliation — shipped inside #147 (2026-05-28).
- **Audit timestamp:** 2026-05-26 19:12 IST · branch `master` · HEAD `9a3c98e` (#149 merged 2026-05-26 via PR-D2b/D3/D4/D5)
- **Post-audit hardening on master @ `6ba7c0f` (2026-05-27):** money-SSOT (PR #2 `7c97b33`) · refresh-token family rotation (`cf9bcb6`) · security batch A (`5481f6b`) · W4b FE test sweep (`c43babc` + `6ba7c0f`). No feature-row state changes.

---

### Phase 1A — Reused from DudhHisaab

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 1 | Auth | OTP login (MSG91) | Done | `bfbe6b2` · 2026-03 | `routes/auth/login.ts` + `services/auth.service.ts` + OtpCode model + LoginPage.tsx |
| 1 | Auth | JWT + refresh + httpOnly cookies | Done | `eb132ab` · 2026-03 | `routes/auth/refresh.ts` + RefreshToken model + 401 interceptor in `lib/api.ts` |
| 1 | Auth | Account lockout + CAPTCHA | Done | `bfbe6b2` · 2026-03 | `services/auth.service.ts` lockout helpers; tested under `__tests__` |
| 1 | Auth | 2FA (TOTP + WebAuthn) | Done | `bfbe6b2` · 2026-03 | `services/webauthn.service.ts` + `services/webauthn/*` + WebAuthnCredential model |
| 1 | Auth | Dev login (closed testing) | Done | `bfbe6b2` · 2026-03 | `routes/auth/dev-login.ts` (gated by `ALLOW_DEV_LOGIN`) |
| 2 | Subscription | State machine (7 states) + writer SSOT | In-Progress (cred-blocked) | `3530e79` · 2026-05-15 | `services/subscription/*` + Subscription/SubscriptionEvent models + SubscriptionManagePage.tsx — needs `ENTITLEMENT_JWT_PRIVATE_KEY` |
| 2 | Subscription | Razorpay webhook | In-Progress (cred-blocked) | `3530e79` · 2026-05-15 | `services/razorpay-webhook.service.ts` + WebhookEvent — needs `RAZORPAY_WEBHOOK_SECRET` |
| 2 | Subscription | UPI Autopay mandate | In-Progress (cred-blocked) | `3530e79` · 2026-05-15 | `routes/subscription/mandate.routes.ts` + UpiMandate + MandateSetupDrawer.tsx |
| 2 | Subscription | Offline entitlement JWT (RS256) | In-Progress (cred-blocked) | `3530e79` · 2026-05-15 | `entitlement-pubkey.route.ts` + `entitlement-verify.utils.ts` + IDB cache |
| 2 | Subscription | PRO_MAX tier + add-ons | In-Progress (cred-blocked) | `3530e79` · 2026-05-15 | FeatureAddon + BusinessAddon + AddonBadge.tsx |
| 3 | Referral & Earn | Code generation + crypto | Done | `3d316be` · 2026-04 | `services/referral/*` + ReferralCode/Event/Reward/Withdrawal models |
| 3 | Referral & Earn | Wallet + UPI withdraw (stub) | Done | `3d316be` · 2026-04 | `routes/referral.ts` 8 endpoints |
| 3 | Referral & Earn | Fraud guards | Done | `3d316be` · 2026-04 | `services/coupon-fraud.ts` adjacent + audit in service folder |
| 4 | Notifications | Engine (inbox + dispatch queue) | In-Progress (cred-blocked) | `bea1093` · 2026-04 | `services/notification.service.ts` + Notification/NotificationJob/PushToken models + NotificationsPage |
| 4 | Notifications | Push (FCM) provider | In-Progress (cred-blocked) | `bea1093` · 2026-04 | `routes/webhooks/notifications-fcm.routes.ts` — needs `FCM_*` creds |
| 4 | Notifications | WhatsApp (Aisensy) provider | In-Progress (cred-blocked) | `bea1093` · 2026-04 | `notifications-aisensy.routes.ts` — needs `AISENSY_API_KEY` |
| 4 | Notifications | Email (Resend) provider | In-Progress (cred-blocked) | `bea1093` · 2026-04 | `notifications-resend.routes.ts` — needs `RESEND_API_KEY` |
| 4 | Notifications | SMS (MSG91) provider | In-Progress (cred-blocked) | `bea1093` · 2026-04 | `notifications-msg91.routes.ts` — needs `MSG91_WEBHOOK_TOKEN` |
| 4 | Notifications | Quiet hours + preferences | Done | `bea1093` · 2026-04 | NotificationPreference model + settings UI |
| 5 | Backup | Local (manual) backup + list + download | Done | `bfbe6b2` · 2026-03 | `routes/backup.ts` + `services/backup.service.ts` |
| 5 | Backup | Google Drive backup | Done | 2026-05-29 | OAuth+PKCE S256, `drive.file` scope, env-gated 503; refresh token AES-256-GCM at rest; user-bound single-use state; `services/backup/` + `/api/backup/drive/*` (5 routes) + FE `features/backup/`. Cred-blocked on real Google client for E2E |
| 5 | Backup | Email export | Partial | `bfbe6b2` · 2026-03 | audit 2026-05-29: `export.service.generateFullExport` is a CSV-of-all-data download — emails nothing |
| 5 | Backup | Cooldown enforcement | Done | `bfbe6b2` · 2026-03 | service-level rate guard |
| 6 | Offline-first PWA | Service worker + Workbox cache | Done | `bfbe6b2` · 2026-03 | `serviceWorkerRegistration.ts` + `vite.config.ts` SW rules |
| 6 | Offline-first PWA | Dexie mutation queue | Done | `bfbe6b2` · 2026-03 | `lib/offline.ts` + `lib/api-cache.ts` |
| 6 | Offline-first PWA | OfflineBanner + sync UI | Done | `bfbe6b2` · 2026-03 | `components/feedback/OfflineBanner.tsx` |
| 6 | Offline-first PWA | Idempotency middleware | Done | `bf1d166` · 2026-04 | `middleware/idempotency.ts` + IdempotencyLog model (17 POSTs) |
| 7 | Admin Panel | Framework (15 endpoints) | Done | `bfbe6b2` · 2026-03 | `routes/admin/*` + AdminUser/AdminAction models + admin shell at admin.hisaabpro.in |
| 7 | Admin Panel | SUPER_ADMIN guard | Done | `bfbe6b2` · 2026-03 | `lib/admin-auth.ts` (HIGH-RISK PATH) |
| 7 | Admin Panel | Coupons + broadcasts + impersonation | Done | `bfbe6b2` · 2026-03 | `admin-coupons.ts` + `notifications-broadcast.ts` |
| 8 | Dark Mode / Theming | CSS-var palette swap | Done | `2769806` · 2026-04 | `src/styles/tokens-dark.css` + theme toggle |
| 8 | Dark Mode / Theming | Classic/Modern/Minimal variants | Done | 2026-05-29 | `ThemeContext` adds a `variant` dimension → `data-variant` attr; `src/styles/tokens-variants.css` re-tints brand ramps only (semantic/neutral shared) for both light+dark; ThemePicker page at `/settings/theme` (`features/settings/theme/`). localStorage `theme-variant`, cross-tab synced |
| 9 | Multi-language (EN/HI) | 980+ keys + `useLanguage()` | Done | `bfbe6b2` · 2026-03 | `lib/translations.en.ts` + `translations.hi.ts` (parity enforced) |
| 10 | Onboarding wizard | Business creation on first login | Done | `b69067b` · 2026-04 | `features/onboarding/` + verticals step + business defaults |

### Phase 1B — Party Management

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 11 | Party CRUD | Create/edit/delete + soft-delete | Done | `ea27525` · 2026-05 | `services/party.service.ts` + Party model + PartiesPage.tsx |
| 12 | Party | Balances + statements | Done | `bfbe6b2` · 2026-03 | `collections/statement.route.ts` + PartyDetailPage |
| 13 | Party | Multi-addresses | Done | `bfbe6b2` · 2026-03 | PartyAddress model + Addresses tab |
| 14 | Party | Credit limits | Done | `bfbe6b2` · 2026-03 | `creditLimit` on Party + credit-warning logic |
| 15 | Party | Custom fields | Done | `bfbe6b2` · 2026-03 | PartyCustomFieldValue + CustomFieldDefinition + form |
| 16 | Party | Party-wise pricing | Done | `3626a0c` · 2026-05 | PartyPricing + `pricing-resolver.ts` |
| 17 | Party | Opening balances | Done | `bfbe6b2` · 2026-03 | OpeningBalance model + onboarding step |

### Phase 1C — Invoicing & Documents

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 18 | Sale invoice | Create + edit + duplicate | Done | `ea27525` · 2026-05 | `services/document.service.ts` + Document(type=SALE) + invoices pages |
| 19 | Purchase invoice | Create + edit | Done | `1b8e18f` · 2026-03 | Document(type=PURCHASE) + purchases feature folder |
| 20 | Estimates | CRUD + convert | Done | `6193d28` · 2026-05 | `routes/documents/convert-restore.ts` + EstimatesPage |
| 21 | Proforma | CRUD | Done | `1b8e18f` · 2026-03 | Document(type=PROFORMA) |
| 22 | Purchase Orders | CRUD | Done | `1b8e18f` · 2026-03 | Document(type=PO) |
| 23 | Sale Orders | CRUD + convert | Done | `6193d28` · 2026-05 | Document(type=SO) + SaleOrdersPage |
| 24 | Delivery challan | CRUD + convert to invoice | Done | `6193d28` · 2026-05 | Document(type=CHALLAN) + DeliveryChallansPage |
| 25 | Document numbering | Per-FY series + per-type | Done | `1b8e18f` · 2026-03 | DocumentNumberSeries + `document-number.service.ts` |
| 26 | Additional charges | Per-doc line | Done | `1b8e18f` · 2026-03 | DocumentAdditionalCharge model |
| 27 | Due dates | Auto + manual | Done | `1b8e18f` · 2026-03 | Document.dueDate + reminder calc |
| 28 | Terms & Conditions | Templates | Done | `1b8e18f` · 2026-03 | TermsAndConditionsTemplate model + settings UI |
| 29 | Digital signature | Per-business signature image | Done | `1b8e18f` · 2026-03 | DigitalSignature model + react-pdf integration |
| 30 | Auto WA/Email share | Triggered on doc create | In-Progress (cred-blocked) | `bea1093` · 2026-04 | DocumentShareLog + `share.ts` route — needs Aisensy/Resend creds |
| 31 | Image export | JPG/PNG | Done | `1b8e18f` · 2026-03 | client-side canvas export in template viewer |
| 32 | Email PDF | Send invoice PDF over email | In-Progress (cred-blocked) | `bea1093` · 2026-04 → fixed 2026-05-29 | null-stub `pdf.service` deleted; PDF rendered client-side (React-PDF) → base64 → uploaded to `:id/share/email`, attached via Resend. EmailShareForm + ShareInvoiceDrawer email view. Needs Resend creds to deliver |
| 33 | Recycle bin | Soft-delete + restore | Done | `1b8e18f` · 2026-03 | `routes/recycle-bin.ts` + `services/recycle-bin.service.ts` |
| 34 | Profit-during-sale | Margin chip on line items | Done | `1b8e18f` · 2026-03 | `document-calc.ts` margin field + UI chip |

### Phase 1D — Templates & Printing

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 35 | Templates | 5+ base templates | Done | `bfbe6b2` · 2026-03 | `features/templates/template-gallery*.configs.ts` |
| 36 | Templates | Customization editor | Done | `bfbe6b2` · 2026-03 | TemplateConfigPage + react-pdf renderer |
| 37 | Print settings | Per-business defaults | Done | `bfbe6b2` · 2026-03 | DocumentSettings model + settings UI |
| 38 | Round-off | Per-invoice toggle | Done | `1b8e18f` · 2026-03 | `document-calc.ts` round-off branch |
| 39 | Decimal precision | Per-business config | Done | `1b8e18f` · 2026-03 | DocumentSettings.decimalPlaces |

### Phase 1E — Payment Tracking

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 40 | Payment in/out | Multi-invoice allocation | Done | `5ce6d0f` · 2026-03 | `services/payment.service.ts` + Payment + PaymentAllocation |
| 40 | Payment in/out | Cash/UPI/bank/cheque modes | Done | `5ce6d0f` · 2026-03 | Payment.mode enum + Cheque model |
| 41 | Outstanding + aging | 4-bucket aging | Done | `5ce6d0f` · 2026-03 | `collections/aging.route.ts` + AgingReport UI |
| 42 | Payment reminders | Auto WA/SMS | In-Progress (cred-blocked) | `9d281de` · 2026-05 | PaymentReminder + ReminderInstance — needs Aisensy/MSG91 |
| 43 | Discount during payment | Per-allocation | Done | `5ce6d0f` · 2026-03 | PaymentDiscount model |

### Phase 1F — Basic Inventory

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 44 | Products CRUD | Paise pricing | Done | `f8a77bc` · 2026-03 | `services/product.service.ts` + Product model + products pages |
| 45 | Stock in/out | Immutable StockMovement | Done | `f8a77bc` · 2026-03 | StockMovement model + atomic write |
| 46 | Stock validation | GLOBAL/WARN_ONLY/HARD_BLOCK | Done | `ac04759` · 2026-03 | InventorySetting + `stock.service.ts` validation |
| 47 | Low-stock alerts | Cron + notification | In-Progress (cred-blocked) | `bea1093` · 2026-04 | StockAlert + `stock-alert.service.ts` — needs notification creds |
| 48 | Categories + Units | + Conversions | Done | `3ec14f4` · 2026-03 | Category + Unit + UnitConversion + units feature |
| 49 | Item custom fields | Per-product extras | Done | `f8a77bc` · 2026-03 | ProductCustomFieldValue + UI |

### Phase 1G — Dashboard & Reports

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 50 | Dashboard | Single `/dashboard/home` endpoint | Done | `46c7bee` · 2026-04 | `routes/dashboard.ts` + DashboardPage + AlertStrip |
| 51 | Sale/Purchase reports | + CSV export | Done | `7e7967d` · 2026-03 | `routes/reports.ts` + `report.service.ts` |
| 52 | Party statements | PDF + CSV | Done | `7e7967d` · 2026-03 | `collections/statement.route.ts` |
| 53 | Stock summary | Report | Done | `7e7967d` · 2026-03 | `routes/reports.ts` stock-summary |
| 54 | Day book | Daily ledger view | Done | `7e7967d` · 2026-03 | reports + DayBookPage |
| 55 | Payment history | Per-party log | Done | `5ce6d0f` · 2026-03 | Payment list + PartyDetailPage tab |

### Phase 1H — Settings & Security

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 56 | Custom roles | Permission matrix (JSON) | Done | `0360b96` · 2026-03 | Role model + JWT claims projection |
| 57 | Txn lock + approvals | Cutoff date + ApprovalRequest | Done | `0360b96` · 2026-03 | TransactionLockConfig + ApprovalRequest + UI |
| 58 | PIN/passcode | App-level lock | Done | `5f802b9` · 2026-05 | `User.pinHash` + `routes/auth-pin.routes.ts` + PinPad.tsx (audit 2026-05-29: no PinCredential model — PIN is a hash column on User) |
| 59 | Biometric | Capacitor plugin | In-Progress (cred-blocked) | `bfbe6b2` · 2026-03 | `routes/biometric.ts` + Settings UI — needs Capacitor plugin install |
| 60 | Date format | Per-business | Done | `0360b96` · 2026-03 | UserAppSettings.dateFormat |
| 61 | Keyboard shortcuts | Global hotkeys | Done | `0360b96` · 2026-03 → fixed 2026-05-29 | `useKeyboardShortcuts` global keydown listener (src/hooks), mounted in PersistentNav (auth-gated); wires alt+1..5 nav, ctrl+n new invoice, ctrl+. calculator. Modifier-only matching keeps it input-safe. 7 unit tests. ctrl+k search awaits a command palette |
| 62 | Calculator | Launcher | Done | `0360b96` · 2026-03 | `features/settings/CalculatorOverlay.tsx` launched from SideNav (audit 2026-05-29: it's an overlay, not a floating FAB) |

### Phase 2 — GST & Compliance

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 63 | GST Invoice Engine | CGST/SGST/IGST auto-calc | Done | `8924109` · 2026-04 | `services/tax-calc.ts` + `document-calc.ts` (basis points + paise) |
| 64 | Tax categories | 5/12/18/exempt/cess | Done | `8924109` · 2026-04 | TaxCategory model + 5 seeded defaults |
| 65 | Place of Supply | IGST vs CGST+SGST gate | Done | `8924109` · 2026-04 | `tax-calc.ts` POS branch |
| 66 | GSTR-1 Export | JSON (B2B/B2CL/B2CS/CDNR/CDNUR) | Done | `8924109` · 2026-04 | `routes/gst-returns.ts` + GstReturn model |
| 67 | GSTR-1 Reconciliation | 4-way match | Done | `8924109` · 2026-04 | `routes/reconciliation.ts` + GstReconciliation + ReconciliationListPage |
| 68 | GSTR-3B | Outward + ITC + CN + net | Done | `8924109` · 2026-04 | Gstr3bPage + `gst-return.service.ts` |
| 69 | GSTR-9 | Annual | Done | `8924109` · 2026-04 | `gst-returns.ts` gstr9 endpoint |
| 70 | Tax reports | Summary + HSN + Ledger | Done | `8924109` · 2026-04 | `routes/tax-reports.ts` + `tax-report.service.ts` |
| 71 | E-Invoice | IRN + QR (NIC sandbox) | Done | `8924109` · 2026-04 | `services/einvoice/*` + EInvoice model + e-invoice feature |
| 72 | E-Way Bill | Rs 50K threshold + Part-B | Done | `8924109` · 2026-04 | `services/ewaybill/*` + EWayBill model + e-way-bill feature |
| 73 | Reverse Charge | `isReverseCharge` flag | Done | `8924109` · 2026-04 | Document.isReverseCharge + 3B handling |
| 74 | Composite Scheme | Flat rate "Bill of Supply" | Done | `8924109` · 2026-04 | `composition.service.ts` + composition.constants.ts |
| 75 | Additional Cess | Per line item | Done | `8924109` · 2026-04 | DocumentLineItem.cessRate/cessAmount |
| 76 | HSN Auto-fill | search | Done (subset) | `8924109` · 2026-04 / fixed 2026-05-29 | HsnCode + `/api/hsn/search`. 2026-05-29: curated 126-code seed (`prisma/seed.hsn.ts`, idempotent upsert, `npm run db:seed:hsn`); B-tree `@@index([description])` → pg_trgm GIN `hsn_description_trgm` (migration `20260529163000`); EXPLAIN confirms GIN on `ILIKE '%q%'`. FUTURE: full ~12K master load |
| 77 | TDS/TCS | Per-doc rate+amount | Done | `8924109` · 2026-04 | `services/tds-tcs.service.ts` + TdsTcsReportPage |
| 78 | GSTIN verification | Mod-36 checksum (local) + GSP registry | In-Progress (cred-blocked) | `8924109` · 2026-04 → fixed 2026-05-29 | `gstin.utils.ts` checksum real; `gstin-verify.service.ts` now does a real GSP lookup (env `GSTIN_VERIFY_API_URL/KEY`). `verified` true only on active-registration confirmation; unconfigured → `verified:false, providerConfigured:false` (no fabricated pass). 5 unit tests. Needs GSP creds to deliver |
| 79 | Credit/Debit Notes | Bi-directional linking | Done | `8924109` · 2026-04 | Document(type=CN/DN) + stock + outstanding adj |
| 80 | Multi-currency | 11 currencies, rate×10000 | Done | `8924109` · 2026-04 | ExchangeRate + `currency.service.ts` |
| 81 | Recurring Invoices | 4 frequencies + scheduler | Done | `8924109` · 2026-04 | RecurringInvoice + RecurringInvoiceRun + recurring feature |
| 82 | GST Returns viewer | Tab pills + month selector | Done | `8924109` · 2026-04 | GstReturnsPage |

### Phase 3 — Accounting & Finance

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 83 | Double-entry ledger | 15 system accounts | Done | `2b1d872` · 2026-05 | `services/accounting/*` + LedgerAccount + JournalEntry/Line |
| 84 | P&L | Statement endpoint + UI | Done | `2b1d872` · 2026-05 | `financial-reports.service.ts` + ProfitLossPage — GL now auto-fed by S1 (2026-05-29) |
| 85 | Balance Sheet | Statement endpoint + UI | Done | `2b1d872` · 2026-05 | `financial-reports.service.ts` + BalanceSheetPage — GL-backed, fed by S1 |
| 86 | Cash Flow | Statement endpoint + UI | Done | `2b1d872` · 2026-05 | `financial-reports.service.ts` + CashFlowPage — GL-backed, fed by S1 |
| 87 | Accounting Day Book | Per-day journal view | Done | `2b1d872` · 2026-05 | accounting/index.ts + DayBookPage — GL-backed, fed by S1 |
| 88 | Journal Entries | DRAFT→POST→VOID | Done | `2b1d872` · 2026-05 | `accounting/journal-entries.ts` + JournalEntriesPage |
| 89 | Bank Reconciliation | Match payments↔bank | Done | 2026-05-28 | Shipped inside #147 Auto-reconciliation (Phase 7) |
| 90 | Receipt vouchers | Voucher download/print | Done | 2026-05-29 | Client-side React-PDF (`features/payments/voucher/`): RECEIPT template for PAYMENT_IN/PAYROLL_IN. Download via PDFDownloadLink + Print via pdf().toBlob(), wired into PaymentDetailPage. Amount-in-words (Indian system), allocations table. No server endpoint — all PDF is client-side (audit's "no endpoint" framing assumed server rendering; project renders 100% client-side) |
| 91 | Payment vouchers | Voucher download/print | Done | 2026-05-29 | Same component as #90, PAYMENT template for PAYMENT_OUT/PAYROLL_OUT (kind derived by `voucherKindFor`) |
| 92 | Cheque register | PENDING + terminal CLEARED/BOUNCED/CANCELLED/RETURNED | Done | `2b1d872` · 2026-05 | `services/cheque.service.ts` + Cheque + cheques feature — #92 fixed 2026-05-29: terminal-state guard now keys on PENDING (only live state), so a BOUNCED cheque can no longer be flipped back to CLEARED |
| 93 | Multiple bank accounts | Per-business banks | Done | `2b1d872` · 2026-05 | BankAccount + bank-accounts feature |
| 94 | Cash-in-hand | Cash account + entries | Done | `2b1d872` · 2026-05 | CashEntry + CashEntryEvent + cash-register feature |
| 95 | Cash book / Bank book | Per-account ledger | Done | `2b1d872` · 2026-05 | financial-reports + bank-accounts UI |
| 96 | Expense tracking | 10 categories | Done | `e11caf9` · 2026-04 | `services/expense/*` + Expense + ExpenseCategory + expenses feature |
| 97 | Other income | OtherIncome model | Done | `2b1d872` · 2026-05 | `services/other-income.service.ts` + other-income feature |
| 98 | Loans | LOAN_GIVEN/TAKEN + EMI | Done | `be574fd` · 2026-04 | `services/loan/*` + LoanAccount + LoanTransaction + loans feature |
| 99 | FY closure | Carry-forward to RE | Done | `2b1d872` · 2026-05 | `services/fy-closure/*` + FinancialYearClosure + FYClosurePage — N4 fixed 2026-05-29 (RE resolved by seeded code 3100); GL now fed by S1 |
| 100 | Tally Export | XML format | Done | `2b1d872` · 2026-05 | `services/reports/tally-export.ts` (audit 2026-05-29: lives in reports/, not the cited routes/export.ts) |
| 101 | Aging reports | 4 buckets | Done | `2b1d872` · 2026-05 | `collections/aging.route.ts` (shared with #41) |
| 102 | Profitability | Bill/party/product | Done | `2b1d872` · 2026-05 | `financial-reports.service.ts` profitability endpoints |
| 103 | Discount reports | Per-doc + per-party | Done | `2b1d872` · 2026-05 | `report.service.ts` discount endpoint |
| 104 | COGS tracking | WAC-based | Done | `2b1d872` · 2026-05 | WAC real in inventory/bom services; S1 (2026-05-29) posts the COGS leg (Dr 5050 / Cr 1300 = Document.totalCost) on every SALE_INVOICE |

### Phase 4 — Advanced Inventory & POS

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 105 | Barcode generation | Per-product | Done | `0bb1db3` · 2026-04 | `barcode-and-label` arch + label printing |
| 106 | Barcode scan | ML Kit + zxing fallback | Done | `0bb1db3` · 2026-04 | `<BarcodeScanner>` + Capacitor BarcodeScanning plugin |
| 107 | Batch tracking | BAT-01..07 + FEFO | Done | `0bb1db3` · 2026-04 | `services/batch.service.ts` + Batch model + batches feature |
| 108 | Serial numbers | Per-unit tracking | Done | `0bb1db3` · 2026-04 | `services/serial-number.service.ts` + SerialNumber + serial-numbers feature |
| 109 | Multi-godown + transfers | GodownTransfer | Done | `0bb1db3` · 2026-04 | `godown.service.ts` + `godown-transfer.service.ts` + godowns feature |
| 110 | Stock adjustment | Reason codes | Done | `0bb1db3` · 2026-04 | `stock.service.ts` adjustment branch |
| 111 | Label printing | THERMAL_40x30 / A4_3x8 / A5_2x5 | Done | `0bb1db3` · 2026-04 | label print templates in templates feature |
| 112 | Bulk import/export | CSV | Done | `0bb1db3` · 2026-04 | `product-bulk.service.ts` + bulk-import feature |
| 113 | Expiry cron + alerts | Daily | Done | `0bb1db3` · 2026-04 | InventorySetting expiry policy + cron in `services/stock` |
| 114 | Reorder points | Auto reorder flag | Done | `0bb1db3` · 2026-04 | `Product.reorderQty` + `stock-alert.service.ts` (audit 2026-05-29: field is `reorderQty`, doc previously named nonexistent `reorderPoint`) |
| 115 | BOM + ProductionRun | Atomic + WAC + reverse | Done | `0bb1db3` · 2026-04 | `services/bom/*` + Bom/BomComponent/ProductionRun + bom feature |
| 116 | Item images | Multi-image | Done | `0bb1db3` · 2026-04 | `routes/products/images.ts` |
| 117 | MOQ enforcement | Min order qty | Done | `0bb1db3` · 2026-04 | Product.moq + service validation |
| 118 | POS billing mode | 58/80/A5 receipts + void/restore | Done | `264d113` · 2026-04 | `services/pos/*` + PosSale + pos feature + PosPage |
| 119 | Stock verification | Atomic batch adjustments | Done | `0bb1db3` · 2026-04 | `stock-verification.service.ts` + StockVerification + stock-verification feature |
| 120 | Party ledger | DR/CR + running balance + PDF | Done | `0bb1db3` · 2026-04 | `collections/statement.route.ts` + shared-ledger feature |

### Phase 5 — Sales & Marketing

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 121 | Online Store | `/p/store/:slug` | Done | `d47b84a` · 2026-05 | `routes/public/store.routes.ts` + `storefront.service.ts` + StorefrontProduct + storefront feature |
| 121 | Online Store | Slug rules + reserved registry | Done | `ea1b9ae` · 2026-05 | `slug-rules.ts` |
| 122 | Sales Pipeline | Estimate→SO→Challan→Invoice lineage | Done | `6193d28` · 2026-05 | `routes/documents/lineage.ts` + convert-restore.ts |
| 123 | WhatsApp Marketing | Templates | Done | `9b1f096` · 2026-05 | `services/marketing/*` + MarketingTemplate + marketing feature |
| 123 | WhatsApp Marketing | Campaigns wizard | Done | `016a1c8` · 2026-05 | MarketingCampaign + MarketingCampaignRecipient + CampaignWizard |
| 123 | WhatsApp Marketing | Aisensy provider | In-Progress (cred-blocked) | `9b1f096` · 2026-05 | `marketing-aisensy.routes.ts` — needs Aisensy creds + `MARKETING_ENABLED=true` |
| 124 | SMS Marketing | MSG91 provider | In-Progress (cred-blocked) | `9b1f096` · 2026-05 | `marketing-msg91.routes.ts` — needs MSG91 creds |
| 125 | Loyalty | FIFO accrual + advisory-locked redeem | Done | `1bb2fcc` · 2026-05 | `services/loyalty/*` + LoyaltyProgram + LoyaltyLedger + loyalty feature |
| 125 | Loyalty | POS step 10.5/10.6 + expiry cron | Done | `d8eb926` · 2026-05 | pos integration + loyalty cron |
| 126 | Service Reminders | Rules + 30-min cron + opt-out | Done | `9d281de` · 2026-05 | ReminderRule + ReminderInstance + ReminderConfig + reminder cron |
| 127 | CRM Basics | Tags + follow-ups + lastContactedAt | Done | `ea27525` · 2026-05 | `routes/parties/crm.routes.ts` + crm feature (audit 2026-05-29: path corrected from collections/) |
| 128 | Commission | Rules CRUD + ruleSnapshot + ledger | Done | `340d5bc` · 2026-05 | `services/commission/*` + CommissionRule + CommissionLedger + commission feature |
| 129 | UPI QR | + Deep-link on invoice | Done | `a148ba3` · 2026-05 | `services/upi-link.service.ts` + invoice template QR |
| 130 | Web invoice links | Opaque token (sha256 tokenHash) | Done | `77c645a` · 2026-05 | `routes/public/invoice.routes.ts` + SharedLink + `shared-link.service.ts` (audit 2026-05-29: 32-byte crypto-random token + sha256 hash, not HMAC; expiry/revoke + businessId IDOR guard present) |
| 131 | Party invite | OTP + one-shot signup binding | Done | `15fb596` · 2026-05 | `routes/public/invite/` + `party-invite.service.ts` + invite-claim feature |
| 132 | Multiple price lists | Per-invoice override + cross-tenant guard | Done | `3626a0c` · 2026-05 | `services/price-list*.service.ts` + PriceList + PriceListEntry + price-lists feature |
| 133 | BOGO | Custom-role permission `invoicing.bogo` | Done | `3626a0c` · 2026-05 | `document/` services + `middleware/permission.ts` (audit 2026-05-29: BOGO logic is in document services, not pricing-resolver.ts) |
| 134 | Invoice custom fields | react-pdf section | Done | `3626a0c` · 2026-05 | DocumentCustomFieldValue + template renderer |

### Phase 6 — Staff & HR + Multi-Firm + Audit + PIN

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 135 | Staff Attendance | Employee × day matrix + batch endpoint | Done | `0e2b78a` · 2026-05 | `routes/hr-attendance.routes.ts` + Attendance + AttendancePage |
| 136 | Payroll | Wizard + STAFF Party pairing + reversal | Done | `1b27829` · 2026-05 | `services/payroll/*` + Employee + PayrollRun + Payroll + PayrollWizardPage |
| 137 | Salary Slips | Viewer + PDF + reverse | Done | `1b27829` · 2026-05 | PayslipSnapshot + PayslipPage |
| 138 | Multi-firm | PR0 tenancy audit (0 leaks / 1,033 sites) | Done | `26c4665` · 2026-05 | `docs/archive/TENANCY_AUDIT.md` |
| 138 | Multi-firm | Schema (9 tables + 28 cols) | Done | `d036036` · 2026-05 | `prisma/schema.prisma` + migration |
| 138 | Multi-firm | `requireActiveBusiness` middleware | Done | `ce805d6` · 2026-05 | `middleware/requireActiveBusiness.ts` |
| 138 | Multi-firm | Suspend/reactivate UX | Done | `8f0a06e` · 2026-05 | `c718490` BE + TenantChip + SuspendBanner + ReactivationModal |
| 139 | Advanced Audit Trail | Search (websearch_to_tsquery) + diff + redaction + CSV | Done | `c0f54a2` · 2026-05 | `services/audit/*` + AuditLog + AuditLogRedaction + audit feature |
| 139 | Advanced Audit Trail | 13 mutations backfilled + `--block` enforcer | Done | `025d037` · 2026-05 | `scripts/enforce-audit-coverage.mjs --block` |
| 140 | Transaction PIN | `requireRecentPin` middleware | Done | `5f802b9` · 2026-05 | `middleware/require-recent-pin.ts` + `User.pinHash` + `services/security-pin/*` (audit 2026-05-29: no PinCredential model; kebab-case filename) |
| 140 | Transaction PIN | PinGateProvider + PinPad + 403 interceptor | Done | `3fc3802` · 2026-05 | `features/pin-gate/*` + api.ts PIN_REQUIRED handler |

### Phase 7 — AI & Differentiators

| # | Feature | Sub-feature | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| 141 | AI auto-categorize receipts | Anthropic Haiku OCR | Done | `e11caf9` · 2026-04 | `services/expense/expense-ocr.service.ts` + `expense-ocr.client.ts` + bill-scan feature |
| 141 | AI auto-categorize receipts | 5 MB cap + graceful unavailable | Done | `e11caf9` · 2026-04 | `routes/expense-ocr.route.ts` + size guard |
| 142 | Voice entry | Web Speech API + typed fallback; pure parser → preview → save | Done 2026-05-28 | src/features/voice/* | 22 parser tests |
| 143 | WhatsApp bot billing | Aisensy inbound webhook → draft | Not Started | — | — |
| 144 | Smart GST filing assistant | Pre-filing readiness validator | Done | 2026-05-28 | `services/gst-validation/*` (7 pure rules over period docs, reuses gst-returns period.utils, 18 tests) · `/api/gst/filing-readiness` PRO+reports.view · `features/gst-validation/*` → `/gst/filing-readiness`, blocker/warning tiers + invoice deep-links |
| 145 | Industry Vertical Modes | 13 verticals SSOT + nav filter + terminology | Done | `b69067b` · 2026-04 | `src/config/verticals.config.ts` + onboarding step |
| 145 | Industry Vertical Modes | Jobs flow (services/freelancer/salon/clinic) | Done | `1d39ab0` · 2026-04 | `services/job/*` + Job + JobItem + jobs feature |
| 145 | Industry Vertical Modes | Custom Orders (bakery/tailor) | Done | `cb9b1dc` · 2026-04 | `services/custom-order/*` + CustomOrder + custom-orders feature |
| 146 | Predictive analytics | Revenue trend + stock-out forecast | Done | `4aab510` (BE) · 2026-05-28 | `services/analytics/forecast.*` (OLS + velocity, 23 tests) · `/api/analytics/*` advancedReports gate · `features/analytics/*` → `/insights`, SVG sparkline (no chart lib) |
| 147 | Auto-reconciliation | Bank CSV → match → confirm/ignore/un-reconcile (absorbs #89) | Done | 2026-05-28 | `services/bank-reconciliation/*` + `routes/bank-reconciliation.routes.ts` + `features/bank-reconciliation/*` |
| 148 | Smart inventory | Velocity-based reorder | Done | 2026-05-28 | `services/inventory/reorder.*` (velocity → suggested qty over #114 static reorderQty, reuses #146 forecast math, 15 tests) · `/api/inventory/reorder-suggestions` auth · `features/reorder/*` → `/inventory/reorder-suggestions`, urgency tiers + lead-time/coverage params |
| 149 | Competitor importers (Vyapar/MyBillBook/Tally) | Parties import (7.1A) | Done | `d44ae49` · 2026-05-26 | ImportJob + 4 parsers — merged to master via `9a3c98e` |
| 149 | Competitor importers | Products import (7.1B) | Done | `214f769` · 2026-05-26 | merged to master via `9a3c98e` |
| 149 | Competitor importers | Invoices import (7.1C) | Done | `4104ecd` · 2026-05-26 | merged to master via `9a3c98e` |
| 149 | Competitor importers | Payments import (7.1D) | Done | `c3a5b4b`/`1a10701`/`a5425a7`/`37651d7` · 2026-05-26 | PR-D2b parsers + PR-D3 Σ-guard commit ladder + PR-D4 routes/audit + PR-D5 frontend — merged via `9a3c98e` |
| 149 | Competitor importers | Legacy retirement (#149c) | Done | 2026-05-28 | Deleted `features/data-import`; `ROUTES.DATA_IMPORT` → `<Navigate>` `/imports`; More nav card repointed; new engine is sole import surface |
| 150 | Real-time multi-user | LWW + optimistic lock + presence | Done | 2026-05-28 | Spike chose LWW (not CRDT — money must not auto-merge). `version Int` + in-write `bumpVersionOrConflict` (409 `CONFLICT`), `X-Entity-Version` header, oracle-free in-memory presence (45s TTL). FE reconcile dialog + presence avatars in all 4 edit flows |

### Verticals depth (post-MVP candidates — see §5)

| # | Epic | Verticals | Status | Commit · Date | Evidence |
|---|---|---|---|---|---|
| V1 | Hourly billing on Jobs | Services/Freelancer/Salon/Clinic | Done | 2026-05-29 | audit 2026-05-29: §24 row was stale vs §5. `JobItemKind` enum (`ITEM`\|`HOURLY`, schema:2990) + `Job.estimatedHours`/`actualHours` Decimal(10,2) (schema:3018-19) + per-line toggle; HOURLY reuses `round(qty×rate)−discount` (hours never summed into money). Additive migration |
| V2 | Appointment calendar + slot picker | Salon/Clinic | Not Started | — | Listed in §5 backlog (HIGH — onboarding blocker) |
| V3 | Recipe cost dashboard (BOM-derived) | Restaurant/Bakery/Manufacturing | Done | 2026-05-28 | audit 2026-05-29: §24 row was stale vs §5. `GET /api/recipe-cost` (`routes/recipe-cost.ts` + `services/recipe-cost/`) derives cost/unit + margin from active BOMs; `src/features/recipe-cost/` → `/recipe-cost` page, More→Production card. Read-only, no schema |
| V4 | Staff assignment + commission split | Services/Bakery/Tailor/Mfg | Not Started | — | Extends #128 |
| V5 | Customer delivery reminders | Bakery/Tailor | ✅ Shipped 2026-05-29 | — | ORDER_DELIVERY trigger + day-granular candidate fn. arch-audit PASS (1 rev: isDeleted guard). Hour-precision → FUTURE_EPIC |
| V6 | Table mgmt + KOT | Restaurant | Not Started | — | Out of scope |
| V7 | Prescription field | Pharmacy/Clinic | Not Started | — | Custom-fields today |


