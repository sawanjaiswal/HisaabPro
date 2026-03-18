# Feature Map: HisaabPro

Last updated: 2026-03-18 | Total: 95 | Done: 95 | Not Started: 0

> **Full Build**: Frontend (78 routes, 721 source files, 29 feature modules) + Backend (339 endpoints, 43 route modules, 67 Prisma models, 1696-line schema) built and wired. SSOT cleanup done (CSS variables, config constants). PWA complete (SW + manifest + cache strategies). Tests: 393 passing (23 test files). Remaining: expand test coverage, OTP activation, external integrations, staging deploy.

---

## 1A. Core & Reused (from DudhHisaab)

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 1 | Auth (OTP, JWT, refresh, 2FA, WebAuthn) | Done | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | FE: LoginPage · BE: 5 routes (send-otp, verify-otp, refresh, logout, me) · Rate limited · Token blacklist |
| 2 | Subscription & Billing (Razorpay, tiers) | Needs Integration | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | Requires Razorpay API credentials |
| 3 | Referral & Earn (codes, wallet, UPI) | Done | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 8 endpoints · Crypto code gen · Fraud detection · 7-day review window · UPI withdrawal stub · Cursor pagination |
| 4 | Notifications (push, email, WhatsApp, SMS) | Needs Integration | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | Stubs exist · Needs FCM, Aisensy, Resend credentials |
| 5 | Backup (local + Google Drive + email) | Done | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | BE: manual backup, list, download, cooldown · 90% reuse |
| 6 | Offline-first PWA (IndexedDB, sync, SW) | Done | P0 | [pwa-sw](../PRDs/pwa-service-worker-PLAN.md) | Dexie queue + offline banner + sync UI + SW (workbox) + manifest.json + cache strategies (SWR for API, cache-first for assets) + offline fallback + update prompt |
| 7 | Admin Panel Framework | Done | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 15 endpoints · Separate admin JWT (audience claim) · SUPER_ADMIN guard · User suspend/unsuspend · Platform stats · Feature flags · Audit trail |
| 8 | Dark Mode / Theming | Done | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | ThemeContext + `[data-theme="dark"]` CSS vars · Toggle in Settings · localStorage persist · System preference detection · Cross-tab sync |
| 9 | Multi-language (EN/HI) | Done | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | `translations.ts` 160 keys · LanguageContext · Toggle in Settings · localStorage persist · Cross-tab sync |
| 10 | Onboarding Flow (business setup wizard) | Done | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | BE: POST /businesses (creates business on first login) |

## 1B. Party Management

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 11 | Party CRUD (customers + suppliers, groups, contact import) | Done | P0 | [party-management](../PRDs/party-management-PLAN.md) | FE: 3 pages · BE: 10 routes · Groups + custom fields · Cursor pagination |
| 12 | Party Balances & Statements | Done | P0 | [party-management](../PRDs/party-management-PLAN.md) | FE: PartyStatementPage · BE: /reports/party-statement/:partyId |
| 13 | Multiple Addresses per Party | Done | P0 | [party-management](../PRDs/party-management-PLAN.md) | BE: CRUD on /parties/:id/addresses · Billing + Shipping types |
| 14 | Party Credit Limits | Done | P1 | [party-management](../PRDs/party-management-PLAN.md) | WARN + BLOCK modes in Party model |
| 15 | Party Custom Fields | Done | P2 | [party-management](../PRDs/party-management-PLAN.md) | BE: /custom-fields CRUD · entityType=PARTY |
| 16 | Party-wise Pricing | Done | P1 | [party-management](../PRDs/party-management-PLAN.md) | BE: /parties/:id/pricing · Bulk upsert · #1 MyBillBook gap |
| 17 | Opening Balances (migration) | Done | P0 | [party-management](../PRDs/party-management-PLAN.md) | OpeningBalance model · RECEIVABLE/PAYABLE types |

## 1C. Invoicing & Documents

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 18 | Sale Invoice (non-GST, line items, discounts) | Done | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | FE + BE wired · 7 doc types · Stock validation on save · Amounts in paise |
| 19 | Purchase Invoice | Done | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Shares document system (type toggle) |
| 20 | Estimates / Quotations | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Document type: QUOTATION · Convert to invoice supported |
| 21 | Proforma Invoices | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Document type: PROFORMA |
| 22 | Purchase Orders | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Document type: PURCHASE_ORDER |
| 23 | Sale Orders | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Document type: SALE_ORDER |
| 24 | Delivery Challans | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Document type: CHALLAN · Transport fields |
| 25 | Invoice Numbering (auto-increment, prefix) | Done | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE: DocumentNumberSeries · Per-type, per-financial-year |
| 26 | Additional Charges (shipping, freight) | Done | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE: DocumentAdditionalCharge · FIXED/PERCENTAGE |
| 27 | Due Dates (payment terms: 15/30/60 days) | Done | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | In DocumentSettings.defaultPaymentTerms |
| 28 | Terms & Conditions on Invoice | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE: TermsAndConditionsTemplate CRUD · Per doc type |
| 29 | Digital Signature Block | Done | P2 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE: /settings/documents/signature · Auto-apply option |
| 30 | Auto Invoice Sharing (WhatsApp/email) | Needs Integration | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE stubs exist · Needs Aisensy + Resend credentials |
| 31 | Invoice Image Export (JPG/PNG) | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | `useImageExport` hook · html-to-image (dynamic import) · Export button in InvoiceDetailPage |
| 32 | Share via Email with PDF | Needs Integration | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE stub exists · Needs Resend credentials |
| 33 | Invoice Recycle Bin | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE: soft delete + /recycle-bin + restore + permanent delete + empty bin |
| 34 | Show Profit During Sale | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | DocumentSettings.showProfitDuringBilling · Profit in line items |

## 1D. Invoice Templates & Printing

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 35 | Invoice Templates (30 templates across 7 categories) | Done | P0 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | 30 base templates: Essential (4), Modern (6), GST (2), Indian Business (4), Industry (6), Compact (6), Thermal (2) · Full customization editor |
| 36 | Template Customization (fonts, colors, columns) | Done | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | In TemplateEditorPage |
| 37 | Print Settings (page size, margins) | Done | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | In TemplateEditorPage |
| 38 | Round-off Settings | Done | P0 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | DocumentSettings.roundOffTo (NONE/NEAREST_1/NEAREST_50/NEAREST_10) |
| 39 | Decimal Precision Settings | Done | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | InventorySetting.decimalPrecision |

## 1E. Payment Tracking

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 40 | Payment In/Out (cash, UPI, bank, cheque) | Done | P0 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | FE: 3 pages · BE: 11 routes · Multi-invoice allocation · Idempotent · Soft delete + restore |
| 41 | Outstanding Tracking (aging buckets) | Done | P0 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | FE: OutstandingPage · BE: /outstanding/list + /:partyId · Aging: current/1-30/31-60/61-90/90+ |
| 42 | Payment Reminders (WhatsApp/SMS/push) | Needs Integration | P1 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | BE: send/send-bulk/list/config routes · Needs Aisensy + FCM credentials |
| 43 | Discount During Payment | Done | P2 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | PaymentDiscount model · PERCENTAGE/FIXED |

## 1F. Basic Inventory

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 44 | Products CRUD (name, price, unit, category) | Done | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | FE: 3 pages · BE: 10 routes · SKU auto-gen · Amounts in paise |
| 45 | Stock In/Out (auto on invoice, manual adjust) | Done | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | BE: /stock/adjust (idempotent) + /stock/movements · Immutable StockMovement log |
| 46 | Stock Validation (block if stock < qty) | Done | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | BE: POST /stock/validate · GLOBAL/WARN_ONLY/HARD_BLOCK modes |
| 47 | Low-Stock Alerts | Needs Integration | P1 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | InventorySetting.lowStockAlert config exists · Needs notification integration |
| 48 | Item Categories & Units (unit conversion) | Done | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | BE: /categories + /units + /units/conversions · Bidirectional conversion |
| 49 | Item Custom Fields | Done | P2 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | BE: /custom-fields CRUD · entityType=PRODUCT |

## 1G. Dashboard & Reports

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 50 | Dashboard (sales, outstanding, quick actions) | Done | P0 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | FE: DashboardPage · BE: /dashboard/home (single-call) + /dashboard/stats |
| 51 | Sale/Purchase Reports (filterable, exportable) | Done | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | BE: /reports/invoices + /reports/export (CSV) |
| 52 | Party Statements (per-party history) | Done | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | BE: /reports/party-statement/:partyId |
| 53 | Stock Summary Report | Done | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | BE: /reports/stock-summary |
| 54 | Day Book (all transactions for a day) | Done | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | BE: /reports/day-book |
| 55 | Payment History Report | Done | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | BE: /reports/payments |

## 1H. Settings & Security

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 56 | Custom User Roles/Permissions | Done | P0 | [settings-security](../PRDs/settings-security-PLAN.md) | BE: Role CRUD + permission matrix + staff management + invites |
| 57 | Transaction Edit/Delete Controls | Done | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | BE: TransactionLockConfig + ApprovalRequest flow |
| 58 | Passcode / PIN Protection | Done | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | BE: /users/:id/pin (set/verify/reset) + operation PIN on business |
| 59 | Biometric Auth | Needs Integration | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | UserAppSettings.biometricEnabled · Needs Capacitor plugin |
| 60 | Date Format Customization | Done | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | UserAppSettings.dateFormat |
| 61 | Keyboard Shortcuts for Billing | Done | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | FE: ShortcutsPage |
| 62 | Built-in Calculator | Done | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | FE: CalculatorOverlay (global FAB) |

---

## 1I. Security Hardening & Scalability

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 63 | CSRF Middleware + Cookie Parser | Done | P0 | — | `middleware/csrf.ts` double-submit cookie · `routes/auth.ts` `/csrf-token` endpoint · cookie-parser wired in `index.ts` |
| 64 | Account Lockout (5 failed attempts, 15min lock) | Done | P0 | — | `auth.service.ts` `recordFailedLogin()` + `resetLoginAttempts()` · 5 attempts · 15min lock · progressive delay (500ms/attempt) |
| 65 | Redis-backed Rate Limiter | Done | P0 | — | `middleware/rate-limit.ts` pluggable `RateLimitStore` · `MemoryStore` default + `RedisStore` when `REDIS_URL` set · 4 limiters (api/auth/otp/sensitive) |
| 66 | httpOnly Cookie Tokens (migrate from sessionStorage) | Done | P0 | — | `__Host-at` + `__Host-rt` httpOnly cookies · `setTokenCookies()`/`clearTokenCookies()` · Bearer fallback for migration |
| 67 | CAPTCHA on Login (after 3 failures) | Done | P1 | — | Cloudflare Turnstile · `captcha.ts` middleware tracks failed attempts per IP · Frontend `Turnstile.tsx` widget · Dev-mode skip when env vars unset |
| 68 | Suspicious Pattern Logging | Done | P1 | — | Winston structured JSON logging · `logger.warn()` on CSRF fail, rate limit hit, login fail · File transports in production |
| 69 | Request Signing / Replay Protection | Done | P2 | — | `replay-protection.ts` middleware · Nonce + timestamp (5min window) · In-memory store with auto-eviction · Wired on payment + document mutations |
| 70 | Security Headers Hardening | Done | P1 | — | Helmet with full CSP directives · HSTS (prod) · CORP · COOP · Referrer-Policy · X-Frame via frameAncestors:'none' |

## 2. Phase 2 — GST & Compliance

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| 63 | GST Invoice Engine (CGST/SGST/IGST auto-calc) | Done | P0 | `tax-calc.ts` + `document-calc.ts` · Place of supply determines IGST vs CGST+SGST · Amounts in paise, rates in basis points |
| 64 | Tax Categories / Tax Groups | Done | P0 | `TaxCategory` model · 0%/5%/12%/18%/28% defaults · Cess support (% or fixed/unit) |
| 65 | Place of Supply | Done | P0 | `placeOfSupply` on Document · 2-digit state codes · Determines inter/intra-state |
| 66 | GSTR-1 Export (JSON for filing) | Done | P1 | `gst-return.service.ts` · B2B/B2CL/B2CS/CDNR/CDNUR categories · JSON export |
| 67 | GSTR-1 Auto-Reconciliation | Done | P1 | `reconciliation.service.ts` · Upload GSTR data → match against books · 4 statuses: Matched/Mismatched/Missing/Extra |
| 68 | GSTR-3B Report | Done | P1 | Outward supplies (RCM/non-RCM split) + ITC + CN adjustment + net payable |
| 69 | GSTR-9 Annual Return | Done | P1 | Full FY summary: sales/purchases/CN/DN with tax breakup |
| 70 | Tax Summary + HSN Summary + Tax Ledger | Done | P1 | FE: TaxSummaryPage + GstReturnsPage · 3 report endpoints |
| 71 | E-Invoicing (IRN generation, QR code) | Done | P0 | `einvoice.service.ts` · NIC IRP sandbox mock · 64-char IRN · QR code · 24h cancel · FE: EInvoiceCard in document detail |
| 72 | E-Way Bill (auto-generate, transport details) | Done | P0 | `ewaybill.service.ts` · Rs 50K threshold · Part-B updates · 24h cancel · FE: EWayBillCard with generate form |
| 73 | Reverse Charge Mechanism | Done | P1 | `isReverseCharge` on Document · GSTR-3B RCM split |
| 74 | Composite Scheme Support | Done | P1 | `composition.service.ts` · Flat rates by business type · "Bill of Supply" label · No tax breakup |
| 75 | Additional Cess | Done | P1 | `cessRate`/`cessAmount` on line items · PERCENTAGE or FIXED_PER_UNIT · Flows through to GSTR |
| 76 | HSN Auto-fill | Done | P2 | `HsnCode` model (12K pre-seeded) · `/api/hsn/search` · Auto-carry per product |
| 77 | TDS/TCS Support | Done | P1 | `tds-tcs.service.ts` · tdsRate/tdsAmount/tcsRate/tcsAmount on Document · FE: TdsTcsReportPage |
| 78 | GSTIN Verification | Done | P1 | `/api/gstin/verify` · Party GSTIN validation |
| 79 | Tax Reports | Done | P1 | Tax Summary, HSN Summary, Tax Ledger · FE: 2 pages + report hub cards |
| 80 | Credit Notes / Debit Notes | Done | P0 | CN/DN in document service · Stock effects (CN = return) · Outstanding effects · Bi-directional linking |
| 81 | Multi-currency Support | Done | P2 | `ExchangeRate` model · `currency.service.ts` · Rate * 10000 precision · INR base · 11 currencies · FE: CurrencySettingsPage (building) |
| 82 | Recurring Invoices | Done | P2 | `RecurringInvoice` model · `recurring.service.ts` · 4 frequencies · Template cloning · Scheduler · FE: RecurringListPage (building) |

## Phase 5: Growth & Competitive Features

> Inspired by [BillBook competitor analysis](../docs/design-references/billbook/) — 10 feature gaps identified, 2 already done (#16 Party-wise Pricing, #33 Invoice Recycle Bin). 8 new features below.

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| 83 | GST Autofill (GSTIN → party details) | Done | P1 | [gst-autofill](../PRDs/gst-autofill-PLAN.md) | useGstinVerify hook · debounced API verify · auto-populate companyName/PAN/state · verified badge on detail page · dark mode + reduced motion |
| 84 | Bulk Add Parties from Contacts | Done | P2 | Contact Picker API + CSV import. Multi-select → type assignment → batch create. Route: `/parties/import` |
| 85 | Shared Ledgers | Done | P2 | Share party ledger via read-only link. Generate/revoke/copy share URLs. Public ledger viewer. Backend endpoints pending. Route: `/public/ledger/:token` |
| 86 | Bill Scanning (OCR → Items) | Done | P1 | Client-side OCR via Tesseract.js v7. Camera/gallery capture → preprocessing → OCR → editable review → add to invoice. Route: `/bill-scan` |
| 87 | Items Library (100K+ database) | Done | P2 | Curated Indian product database (67 seed items across 10 categories). Search + category filter + add to products. Route: `/products/library`. Expandable with API/dataset |
| 88 | Competitor Data Import | Done | P3 | CSV/Excel import with auto column mapping. Sources: Vyapar, Tally, Busy, Marg, Excel. Parties import live, products/invoices need backend. Route: `/settings/import` |
| 89 | Smart Greetings (WhatsApp templates) | Done | P3 | 12 templates for Indian festivals + business. Template grid → customize message → pick recipient → WhatsApp deep link. Route: `/greetings`. Accessible from More hub |
| 90 | Categorized Feature Discovery ("For You") | Done | P3 | More page reorganized into 5 categories: Efficiency, Money & Payments, Accounting & Tax, Marketing & CRM, Tools. Each item has label + description. Staggered section animations |

## Phase 6: BillBook User Requests (Competitive Parity)

> From BillBook Play Store feature request analysis. Users switching from BillBook expect these.

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| 91 | Custom Units (user-defined: Bags, Cans, Hours, variable box sizes) | Done | P0 | UnitsPage + AddUnitSheet + category/decimalAllowed/baseUnit fields. Schema migration + backend service + Zod validation. Route /settings/units |
| 92 | Payment Status Stamps on Invoice PDF | Done | P1 | PreviewPaymentStamp (badge/watermark/none). Template toggle + print settings. CSS for both styles |
| 93 | Vehicle Number & Udyam Aadhar on Invoice | Done | P1 | Vehicle Number on invoice form (create+edit). Udyam in preview header. Total Quantity row in preview. Business schema udyamNumber field |
| 94 | PDF Quality Enhancement | Done | P1 | 5-level font scale (xs→xl), 3-level line height, pixelRatio 3 for exports. DeepPartial type for gallery configs |
| 95 | Duplicate Bill Copy Labels | Done | P2 | PreviewCopyLabel component. Print settings: copyLabels toggle, auto/manual mode, custom label names |

## Status Summary

| Status | Count | Details |
|--------|-------|---------|
| **Done** | 95 | Phase 1 (62) + Security (8) + Phase 2 GST (20) + Phase 5 Growth (8) + Phase 6 BillBook (5) — includes 8 "Needs Integration" (code done, awaiting external credentials) |
| **Not Started** | 0 | All features complete |

## Needs Integration (external credentials required)

| # | Feature | What's needed |
|---|---------|--------------|
| 1 | OTP Auth (enable) | MSG91 auth key + template ID (set `VITE_AUTH_MODE=otp`) |
| 2 | Subscription & Billing | Razorpay API key + webhook secret |
| 4 | Notifications | FCM server key + Aisensy API key + Resend API key |
| 30 | Auto Invoice Sharing | Aisensy (WhatsApp) + Resend (email) |
| 32 | Share via Email with PDF | Resend API key |
| 42 | Payment Reminders | Aisensy + FCM credentials |
| 47 | Low-Stock Alerts | Notification integration (depends on #4) |
| 59 | Biometric Auth | Capacitor Biometric plugin |

## Code Quality (2026-03-17)

| Area | Status |
|------|--------|
| SSOT: `FALLBACK_BUSINESS_ID` | Extracted to `app.config.ts`, 6 files import from single source |
| SSOT: Gradient hex colors | Extracted to CSS variables in `globals.css`, 10 CSS files updated |
| SSOT: WhatsApp brand color | `--color-whatsapp` CSS variable, no inline hex |
| Auth context: businessId | All 6 settings pages use `useAuth()` instead of hardcoded value |
| TypeScript | Zero errors (`tsc --noEmit` clean) |
| Build | Passes clean (440KB gzipped main bundle) |
| Console.log / TODOs | Zero remaining |

## Testing Status

| Layer | Status | Coverage |
|-------|--------|----------|
| Unit tests (Vitest) | **Active** | 611 tests across 38 files · 20 feature utils + 4 shared hooks + 4 lib validators |
| Integration tests (API) | **Not started** | 0% — no backend route tests |
| E2E tests (Playwright) | **Configured** | Framework ready (`npm run test:e2e`) · No test files yet |
| Type checking | **Passing** | `tsc --noEmit` zero errors |
| Build | **Passing** | `npm run build` clean |

## Architecture

```
Frontend (React 19 + Vite)          Backend (Express + Prisma)
─────────────────────────           ──────────────────────────
78 routes · 721 source files         339 endpoints · 43 route modules
29 feature modules · 38 test files   67 Prisma models · 1696-line schema
Tailwind CSS 4 + CSS variables       PostgreSQL + cursor pagination
React-PDF (client-side)              JWT auth (httpOnly cookies)
Dexie (IndexedDB queue)              Rate limiting (4 tiers)
Capacitor 8 (mobile)                 CSRF + CAPTCHA + Audit log
Offline banner + sync UI             Multi-tenant (businessId isolation)
                                     GST engine (CGST/SGST/IGST/Cess)
                                     E-Invoice + E-Way Bill (NIC sandbox)
```

## Next Steps (Priority Order)

### Ship-blocking
1. ~~**Service Worker + PWA manifest**~~ Done
2. **Unit tests (Vitest)** — 611 tests passing (38 files, 20 features). All pure utils tested. Remaining: hook tests, component tests, service mocks.
3. **Enable OTP auth flow** — code ready. Set `VITE_AUTH_MODE=otp` + uncomment routes.

### Production readiness
4. **Staging deploy** — Vercel (FE) + Render (BE) + Neon (DB).
5. **External credentials** — Razorpay, FCM, Aisensy, Resend, MSG91, Turnstile.
6. **E2E test coverage** — expand from 4 basic suites to per-feature journeys.

### Next phases
7. ~~**Phase 2: GST**~~ Done — 20 features (tax engine, GSTR-1/3B/9, e-invoice, e-way bill, TDS/TCS, CN/DN, multi-currency, recurring)
8. ~~**Phase 3: Accounting & Finance**~~ Done — 22 features (double-entry ledger, journal entries, trial balance, P&L, balance sheet, cash flow, bank accounts, expenses, other income, cheques, loans, aging reports, profitability, discounts, Tally export, FY closure)
9. **Phase 4: Advanced Inventory & POS** — Barcode, batch tracking, multi-godown, POS mode (16 features)
10. ~~**Phase 5: Growth & Competitive Features**~~ Done — BillBook-inspired gaps + feature discovery (10 features)
11. ~~**Phase 6: BillBook User Requests**~~ Done — Custom units, payment stamps, vehicle/Udyam fields, PDF quality, duplicate copies (5 features)
