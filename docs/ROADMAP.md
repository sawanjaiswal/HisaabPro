# HisaabPro — Master Feature Roadmap

> **Last Updated:** 2026-05-26
> **Status (2026-05-26):** Phase 1 (60/70 code-complete, 10 blocked on creds) · Phase 2 done (20/20) · Phase 3 done (21/22, #89 deferred) · Phase 4 done (16/16) · **Phase 5 14/14 COMPLETE** (Epic A Marketing FE + Epic B Sales Workflow + Epic C Customer-Facing + Epic D CRM/Loyalty/Commission — merge `63ccef4`) · **Subscription port SHIPPED** (commit `3530e79`) · **Phase 6 6/6 COMPLETE** (Staff Attendance + Payroll + Salary Slips + Multi-firm + Audit Trail + Transaction PIN — merge `caa390d`, 12 commits, verifier + Pass-2 security PASS) · Phase 7 2/10 (#141 OCR + #145 Vertical Modes shipped) · **Vertical features**: Jobs (services/freelancer/salon/clinic) + Custom Orders (bakery/tailor) fully wired · **Responsive sweep Waves 0-7 complete**
> **Branch:** `hisaabpro` is 38 commits ahead of `master` (Phase 6 added 12 commits on top of Epic D). Production deploy still at `89610b0`. Nothing since the responsive sweep, Epic A/B/C/D, subscription port, or Phase 6 has been merged to `master`.
> **Owner:** Sawan Jaiswal
> **Architecture:** Monolith — React 19 frontend + Express backend + Prisma + PostgreSQL
> **Total Features:** 150 across 7 phases
> **Build Status:** Frontend 60+ feature folders | Backend 70+ route files, ~84 Prisma models (Phase 6 added 9)
> **Total shipped:** **139/150**

## Status Legend
- [ ] Not Started
- [~] In Progress
- [x] Complete
- [S] Skipped/Deferred
- [B] Blocked

---

## COMPETITIVE CONTEXT

| Competitor | Rating | Downloads | Weakness We Exploit |
|-----------|--------|-----------|-------------------|
| Vyapar | 4.67/5 | 15M+ | Data loss, no offline, rigid roles, dated UI, no iOS |
| MyBillBook | 4.41/5 | 9.7M+ | Broken inventory, terrible support, bugs unfixed for months |
| Khatabook | 4.5/5 | 50M+ | Too simple, no invoicing, not scalable |
| Zoho Books | 4.6/5 | — | 3.5x more expensive, not India-focused |
| TallyPrime | — | — | Desktop-only, complex, expensive |

**Our positioning:** Mobile-first + Offline-first + Modern UI + Reliable data + Fast support

---

## PHASE 1 — MVP (Weeks 1-12)
**Goal:** A small business owner can run daily operations on their phone
**Status:** 60/70 Done — All code work complete, 10 need external credentials
**Features:** 70 (10 reused + 60 new)

### 1A. Reused from DudhHisaab (~10-14 days)

| # | Feature | Status | Source | Notes |
|---|---------|--------|--------|-------|
| 1 | Auth (OTP, login, JWT, refresh, 2FA, WebAuthn) | [x] | DudhHisaab | Dev login + httpOnly cookies + account lockout + CAPTCHA |
| 2 | Subscription & Billing (Razorpay, tiers, add-ons) | [B] | DudhHisaab (ported) | **Port shipped 2026-05-15 (`3530e79`)** — 7-state machine, UPI Autopay mandate, RS256 offline JWT, PRO_MAX tier, SubscriptionEvent audit, OverflowBanner, MandateSetupDrawer, `/settings/subscription`. Still cred-blocked: needs `ENTITLEMENT_JWT_PRIVATE_KEY` + `ENTITLEMENT_JWT_PUBLIC_KEY` + `RAZORPAY_WEBHOOK_SECRET` |
| 3 | Referral & Earn (codes, wallet, UPI withdrawal, fraud detection) | [x] | DudhHisaab | 8 endpoints, crypto code gen, fraud detection, UPI stub |
| 4 | Notifications (push, email, WhatsApp, SMS, quiet hours) | [B] | DudhHisaab | Needs FCM + Aisensy + Resend credentials |
| 5 | Backup (local device + Google Drive + email export, encryption, restore) | [x] | DudhHisaab | Manual backup + list + download + cooldown |
| 6 | Offline-first PWA (IndexedDB, sync queue, service worker) | [x] | DudhHisaab | SW registered, Dexie, offline banner, sync queue |
| 7 | Admin Panel Framework (users, analytics, monitoring, audit) | [x] | DudhHisaab | 15 endpoints, separate admin JWT, SUPER_ADMIN guard, audit trail |
| 8 | Dark Mode / Theming (CSS vars, theme selection: classic/modern/minimal) | [x] | DudhHisaab | ThemeContext + toggle + localStorage + system pref |
| 9 | Multi-language (EN/HI) | [x] | DudhHisaab | 160 translation keys + LanguageContext + toggle |
| 10 | Onboarding Flow (business setup wizard + opening balances entry) | [x] | DudhHisaab | Business creation on first login |

### 1B. Party Management

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 11 | Party CRUD (Customer + Supplier, groups, tags, contact import) | [x] | LOW | [x] | 3 pages, 10 routes, groups + custom fields, cursor pagination |
| 12 | Party Balances & Statements (outstanding, transaction history) | [x] | LOW | [x] | PartyStatementPage + /reports/party-statement/:partyId |
| 13 | Multiple Addresses per Party (billing + shipping addresses) | [x] | LOW | [x] | CRUD on /parties/:id/addresses |
| 14 | Party Credit Limits (block invoicing beyond limit, configurable) | [x] | LOW | [x] | CreditLimit model + validation on invoice |
| 15 | Party Custom Fields (user-defined additional fields) | [x] | LOW | [x] | /custom-fields CRUD, entityType=PARTY |
| 16 | Party-wise Pricing (retailer/wholesale/regular rates per product) | [x] | MEDIUM | [x] | PriceList model + party-product pricing |
| 17 | Opening Balances (party balances, stock, bank — for migration) | [x] | MEDIUM | [x] | OpeningBalance model + onboarding flow |

### 1C. Invoicing & Documents

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 18 | Sale Invoice (non-GST, with line items, discounts, additional charges) | [x] | MEDIUM | [x] | 7 document types via unified Document model |
| 19 | Purchase Invoice (record purchases from suppliers) | [x] | MEDIUM | [x] | Same unified model |
| 20 | Estimates / Quotations (pre-sale proposals) | [x] | LOW | [x] | Document type: ESTIMATE |
| 21 | Proforma Invoices (formal quote before final invoice) | [x] | LOW | [x] | Document type: PROFORMA |
| 22 | Purchase Orders (order before receiving goods) | [x] | LOW | [x] | Document type: PURCHASE_ORDER |
| 23 | Sale Orders (confirmed order before invoicing) | [x] | LOW | [x] | Document type: SALE_ORDER |
| 24 | Delivery Challans (goods movement without invoice) | [x] | LOW | [x] | Document type: DELIVERY_CHALLAN |
| 25 | Invoice Numbering (auto-increment, custom prefix/suffix, per FY series) | [x] | LOW | [x] | DocumentNumberSeries model |
| 26 | Additional Charges on Invoice (shipping, packaging, freight, loading) | [x] | LOW | [x] | DocumentCharge model |
| 27 | Due Dates on Invoices (payment terms: 15/30/60 days) | [x] | LOW | [x] | dueDate field + payment terms |
| 28 | Terms & Conditions on Invoice (customizable per template) | [x] | LOW | [x] | termsAndConditions on Document |
| 29 | Digital Signature Block (image/drawn signature on invoice) | [x] | LOW | [x] | signatureUrl on Document |
| 30 | Auto Invoice Sharing (auto-send via WhatsApp/email on save) | [B] | LOW | [x] | Needs Aisensy + Resend credentials |
| 31 | Invoice Image Export (JPG/PNG for WhatsApp — not just PDF) | [x] | LOW | [x] | useImageExport hook + html-to-image |
| 32 | Share via Email with PDF Attachment | [B] | LOW | [x] | Needs Resend API key |
| 33 | Invoice Recovery / Recycle Bin (recover deleted invoices) | [x] | LOW | [x] | Soft delete + recycle bin + restore |
| 34 | Show Profit During Sale (real-time margin display while billing) | [x] | LOW | [x] | showProfitDuringBilling setting |

### 1D. Invoice Templates & Printing

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 35 | Invoice Templates (thermal, A4, A5, modern — 5+ base templates) | [x] | MEDIUM | [x] | TemplateGalleryPage + TemplateEditorPage, React-PDF |
| 36 | Template Customization (fonts, colors, column toggles, field visibility) | [x] | MEDIUM | [x] | Full editor with live preview |
| 37 | Print Settings (page size, margins, font size, header/footer) | [x] | LOW | [x] | In TemplateEditorPage |
| 38 | Round-off Settings (nearest 1, 0.50, 0.10 — configurable) | [x] | LOW | [x] | DocumentSettings.roundOffTo |
| 39 | Decimal Precision Settings (2 vs 3 decimal places for qty/rate/amount) | [x] | LOW | [x] | InventorySetting.decimalPrecision |

### 1E. Payment Tracking

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 40 | Payment In/Out (cash, UPI, bank transfer, cheque — link to invoices) | [x] | LOW | [x] | 3 pages, 11 routes, multi-invoice allocation, soft delete + restore |
| 41 | Outstanding Tracking (who owes how much, aging preview) | [x] | LOW | [x] | OutstandingPage + aging buckets (current/1-30/31-60/61-90/90+) |
| 42 | Payment Reminders (automated via WhatsApp/SMS/push) | [B] | LOW | [x] | Routes built, needs Aisensy + FCM credentials |
| 43 | Discount During Payment (apply discount at payment time) | [x] | LOW | [x] | PaymentDiscount model, PERCENTAGE/FIXED |

### 1F. Basic Inventory

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 44 | Products CRUD (name, price, unit, category, opening stock) | [x] | MEDIUM | [x] | 3 pages, 10 routes, SKU auto-gen, amounts in paise |
| 45 | Stock In/Out (auto-update on invoice, manual adjustment) | [x] | MEDIUM | [x] | /stock/adjust + immutable StockMovement log |
| 46 | Stock Validation (block invoice if stock < qty, configurable) | [x] | LOW | [x] | GLOBAL/WARN_ONLY/HARD_BLOCK modes |
| 47 | Low-Stock Alerts (configurable minimum qty, push notification) | [B] | LOW | [x] | Config exists, needs notification integration |
| 48 | Item Categories & Units (with unit conversion: 1 box = 12 pcs) | [x] | MEDIUM | [x] | /categories + /units + /units/conversions |
| 49 | Item Custom Fields (user-defined fields per product) | [x] | LOW | [x] | /custom-fields CRUD, entityType=PRODUCT |

### 1G. Dashboard & Reports

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 50 | Dashboard (today's sales, outstanding, top customers, quick actions) | [x] | LOW | [x] | Premium Figma-based UI, single-call /dashboard/home |
| 51 | Sale/Purchase Reports (by date range, party, product) | [x] | MEDIUM | [x] | /reports/invoices + CSV export |
| 52 | Party Statements (transaction history per customer/supplier) | [x] | LOW | [x] | /reports/party-statement/:partyId |
| 53 | Stock Summary Report (current stock, value, movement) | [x] | MEDIUM | [x] | /reports/stock-summary |
| 54 | Day Book (all transactions for a day — simple list, not accounting) | [x] | LOW | [x] | /reports/day-book |
| 55 | Payment History Report | [x] | LOW | [x] | /reports/payments |

### 1H. Settings & Security

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 56 | Custom User Roles/Permissions (granular role builder, field-level access) | [x] | MEDIUM | [x] | Role CRUD + permission matrix + staff management + invites |
| 57 | Transaction Edit/Delete Controls (lock old transactions, require approval) | [x] | LOW | [x] | TransactionLockConfig + ApprovalRequest flow |
| 58 | Passcode / PIN Protection (app-level lock) | [x] | LOW | [x] | /users/:id/pin (set/verify/reset) + operation PIN |
| 59 | Biometric Auth (fingerprint/face for app access) | [B] | LOW | [x] | Setting exists, needs Capacitor plugin |
| 60 | Date Format Customization (DD/MM/YYYY, MM/DD/YYYY) | [x] | LOW | [x] | UserAppSettings.dateFormat |
| 61 | Keyboard Shortcuts for billing (Tab, Enter, hotkeys) | [x] | LOW | [x] | ShortcutsPage |
| 62 | Built-in Calculator (utility accessible from any screen) | [x] | LOW | [x] | CalculatorOverlay global FAB |

### Phase 1 Acceptance Criteria
- [ ] Business owner can sign up, set up profile, add logo
- [ ] Can enter opening balances (migrate from manual books / other app)
- [ ] Can add customers and suppliers (manual + contact import)
- [ ] Can add products with stock and custom fields
- [ ] Can create sale invoice with additional charges and share via WhatsApp in < 10 sec
- [ ] Can create purchase invoice, estimate, proforma, PO, SO, challan
- [ ] Can record payments, link to invoices, see outstanding
- [ ] Dashboard shows real-time business summary
- [ ] Real-time profit display during billing
- [ ] Works fully offline — syncs when connected
- [ ] Auto-backup to Google Drive + local
- [ ] Custom roles: owner can restrict staff access, lock old transactions
- [ ] PIN/biometric protection on app
- [ ] Recover deleted invoices from recycle bin
- [ ] 5 real businesses beta-testing for 1 week with zero data loss

---

## PHASE 2 — GST & Compliance (Weeks 13-18)
**Goal:** Fully GST-compliant billing that accountants trust
**Status:** Done (20/20 features)
**Features:** 20

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 63 | GST Invoice Engine (CGST/SGST/IGST auto-calc, HSN/SAC codes) | [x] | HIGH | [x] | `tax-calc.ts` + `document-calc.ts` · Basis points + paise |
| 64 | Tax Categories / Tax Groups (5% GST, 12% GST, exempt — assign to items) | [x] | MEDIUM | [x] | TaxCategory model · 5 defaults · Cess support |
| 65 | Place of Supply (determines IGST vs CGST+SGST — legally required) | [x] | MEDIUM | [x] | 2-digit state code on Document |
| 66 | GSTR-1 Export (JSON for filing) | [x] | MEDIUM | [x] | B2B/B2CL/B2CS/CDNR/CDNUR categories |
| 67 | GSTR-1 Auto-Reconciliation (match filed vs books) | [x] | MEDIUM | [x] | Upload GSTR JSON → 4-way match · FE: ReconciliationListPage + DetailPage |
| 68 | GSTR-3B Report (with RCM split) | [x] | MEDIUM | [x] | Outward (RCM/non-RCM) + ITC + CN adj + net payable |
| 69 | GSTR-9 Annual Return | [x] | MEDIUM | [x] | Full FY summary |
| 70 | Tax Reports (Tax Summary, HSN Summary, Tax Ledger) | [x] | MEDIUM | [x] | 3 endpoints + FE: TaxSummaryPage |
| 71 | E-Invoicing (IRN generation, QR code on invoice) | [x] | HIGH | [x] | NIC sandbox mock · 64-char IRN · QR · 24h cancel · FE: EInvoiceCard |
| 72 | E-Way Bill (auto-generate, transport/vehicle details) | [x] | HIGH | [x] | Rs 50K threshold · Part-B updates · FE: EWayBillCard + forms |
| 73 | Reverse Charge Mechanism | [x] | LOW | [x] | `isReverseCharge` flag · GSTR-3B RCM split |
| 74 | Composite Scheme Support | [x] | LOW | [x] | Flat rates by type · "Bill of Supply" · No tax breakup |
| 75 | Additional Cess (tobacco, coal, aerated drinks) | [x] | LOW | [x] | cessRate/cessAmount on line items · % or fixed/unit |
| 76 | HSN Auto-fill (set once per product, auto-carry) | [x] | LOW | [x] | 12K pre-seeded HsnCode · `/api/hsn/search` |
| 77 | TDS/TCS Support (tax deducted/collected at source) | [x] | MEDIUM | [x] | tds/tcs Rate+Amount on Document · FE: TdsTcsReportPage |
| 78 | GSTIN Verification per Party | [x] | LOW | [x] | `/api/gstin/verify` |
| 79 | Credit Notes / Debit Notes | [x] | MEDIUM | [x] | CN/DN types · Stock effects · Outstanding effects · Bi-directional linking |
| 80 | Multi-currency Support | [x] | MEDIUM | [x] | ExchangeRate model · 11 currencies · Rate*10000 precision · FE: CurrencySettingsPage |
| 81 | Recurring Invoices | [x] | MEDIUM | [x] | RecurringInvoice model · 4 frequencies · Template cloning · Scheduler · FE: RecurringListPage |
| 82 | GST Returns Page (GSTR-1/3B/9 viewer + export) | [x] | MEDIUM | [x] | FE: GstReturnsPage with tab pills + month selector |

### Phase 2 Acceptance Criteria
- [ ] GST invoice generated with correct tax breakup (CGST+SGST or IGST based on place of supply)
- [ ] GSTR-1 JSON exported and verified against government portal
- [ ] E-invoice IRN generated via NIC API sandbox
- [ ] E-way bill auto-generated for qualifying transactions
- [ ] TDS/TCS correctly deducted and reported
- [ ] CA/accountant validates reports match manual calculations
- [ ] Recurring invoices auto-generate on schedule

---

## PHASE 3 — Accounting & Finance (Weeks 19-24) ✅ DONE
**Goal:** Replace accountant's manual ledger
**Status:** Done (2026-03-17)
**Features:** 22 (21 shipped, 1 deferred)

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 83 | Double-Entry Accounting Ledger (every txn = debit + credit) | [x] | HIGH | [x] | 15 system accounts, seed, CRUD |
| 84 | Profit & Loss Statement | [x] | MEDIUM | [x] | Revenue, COGS, expenses, net P/L |
| 85 | Balance Sheet | [x] | MEDIUM | [x] | Assets = Liabilities + Equity |
| 86 | Cash Flow Report | [x] | MEDIUM | [x] | Operating, investing, financing |
| 87 | Accounting Day Book (with journal entries, not simple list) | [x] | MEDIUM | [x] | All POSTED entries for a date |
| 88 | Journal Entries (manual adjustments, contra entries) | [x] | MEDIUM | [x] | DRAFT → POST → VOID lifecycle |
| 89 | Bank Reconciliation (match bank statement with entries) | [ ] | HIGH | [ ] | Deferred to Phase 4 — needs import UI |
| 90 | Receipt Vouchers (formal cash/bank receipt documents) | [x] | LOW | [x] | Via journal entry type RECEIPT |
| 91 | Payment Vouchers (formal cash/bank payment documents) | [x] | LOW | [x] | Via journal entry type PAYMENT |
| 92 | Cheque Management / Register (issued, received, clearance dates) | [x] | MEDIUM | [x] | PENDING/CLEARED/BOUNCED/CANCELLED |
| 93 | Multiple Bank Accounts (add accounts, track balances) | [x] | MEDIUM | [x] | CURRENT/SAVINGS/OD/CC |
| 94 | Cash-in-Hand Tracking (explicit cash account) | [x] | LOW | [x] | System "Cash" ledger account |
| 95 | Cash Book / Bank Book (separate transaction logs) | [x] | LOW | [x] | Via ledger report per account |
| 96 | Expense Tracking (categories, recurring, receipt attachments) | [x] | MEDIUM | [x] | 10 default categories, CRUD |
| 97 | Other Income Sources (interest, rent, miscellaneous) | [x] | LOW | [x] | Category-based, summary |
| 98 | Loan Accounts (EMI tracking, interest calc, loan statements) | [x] | MEDIUM | [x] | LOAN_GIVEN/TAKEN, transactions |
| 99 | Financial Year Closure (carry forward balances, pending txn handling) | [x] | MEDIUM | [x] | Zero income/expense → Retained Earnings |
| 100 | Tally Export (compatible data format) | [x] | MEDIUM | [x] | TallyPrime XML with ledgers + vouchers |
| 101 | Aging Reports (receivables/payables by 30/60/90/120 days) | [x] | MEDIUM | [x] | 4 buckets + totals |
| 102 | Profitability Reports (bill-wise, party-wise, product-wise margins) | [x] | LOW | [x] | 3 groupBy modes |
| 103 | Discount Reports (aggregated discount analysis) | [x] | LOW | [x] | Per-invoice discount + totals |
| 104 | COGS / Purchase Price Tracking (cost of goods sold per product) | [x] | MEDIUM | [x] | Via P&L costOfGoods section |

### Phase 3 Acceptance Criteria
- [x] Double-entry ledger produces correct trial balance
- [ ] P&L and Balance Sheet verified by CA
- [ ] Bank reconciliation matches real bank statement (deferred)
- [x] Aging reports show correct outstanding buckets
- [x] Tally export produces valid XML
- [x] Financial year closure carries forward correct balances

---

## PHASE 4 — Advanced Inventory & POS (Weeks 25-30)
**Goal:** Warehouse-grade inventory + retail POS
**Status:** Done (16/16)
**Features:** 16

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 105 | Barcode Generation (create barcodes for products) | [x] | LOW | [x] | BarcodeField + BarcodeDisplay (SVG + PNG canvas), all formats supported |
| 106 | Barcode Scanning (camera-based quick entry) | [x] | LOW | [x] | barcode-and-label epic · @capacitor-mlkit native + @zxing/browser web fallback · POS + invoice line picker |
| 107 | Batch Tracking (batch-wise stock with MFD/expiry) | [x] | MEDIUM | [x] | BAT-01..07 · FEFO claim · batch picker · per-batch value |
| 108 | Serial Number Tracking (individual item identification) | [x] | MEDIUM | [x] | `serial-numbers.ts` route + feature folder |
| 109 | Multi-Godown (warehouse mgmt, inter-godown transfer, stock per location) | [x] | HIGH | [x] | `godowns.ts` route + feature folder |
| 110 | Stock Adjustment (damage, theft, audit correction with reason) | [x] | LOW | [x] | `/stock/adjust` + immutable StockMovement + reason codes |
| 111 | Label Printing (barcode + price labels, thermal printer) | [x] | LOW | [x] | barcode-and-label epic · LabelPrintDialog · THERMAL_40x30 / A4_3x8 / A5_2x5 · React-PDF + window.print |
| 112 | Bulk Import/Export (items, parties, invoices, opening balances from Excel) | [x] | MEDIUM | [x] | bulk-import (parties via CSV+contact picker) + data-import (products w/ barcode mapping) |
| 113 | Expiry Alerts (auto-alert X days before, hide expired from POS) | [x] | LOW | [x] | BAT-04 expiry cron + batch alerts |
| 114 | Reorder Points (auto-suggest purchase orders at low stock) | [x] | MEDIUM | [x] | Reorder alerts + Product.reorderQty + partial index |
| 115 | Item Conversion (raw material to finished goods, BOM) | [x] | MEDIUM | [x] | bom-manufacturing epic · 4 new tables · atomic ProductionRun w/ FOR UPDATE · WAC propagation · cancel reverses stock |
| 116 | Item Images (in catalog, invoice, inventory) | [x] | LOW | [x] | catalog-enrichment epic · ImageUploader (camera + gallery + resize) · catalog thumb + invoice line thumb (settings opt-in) |
| 117 | Minimum Order Quantity (MOQ per item) | [x] | LOW | [x] | catalog-enrichment epic · Product.moq field · enforceMoq setting (block vs warn) · validation across SALE/SO/POS |
| 118 | POS Billing Mode (fast retail: barcode scan, cash drawer, receipt print) | [x] | HIGH | [x] | pos-checkout epic — sales, void/restore, receipts (58/80/A5), history |
| 119 | Data Verification / Mismatch Detection (auto-detect stock & ledger discrepancies) | [x] | MEDIUM | [x] | stock-verification finalize · atomic batch adjustments · hard-gate test |
| 120 | Party Ledger (dedicated ledger view per party — distinct from statement) | [x] | LOW | [x] | catalog-enrichment epic · /api/parties/:id/ledger · DR/CR/Running Balance · PartyLedgerTab + React-PDF export |

---

## PHASE 5 — Sales & Marketing (Weeks 31-36)
**Goal:** Help businesses grow, not just manage
**Status:** 14/14 COMPLETE (Epic A Marketing FE + Epic B Sales Workflow + Epic C Customer-Facing + Epic D CRM/Loyalty/Commission all shipped)
**Features:** 14

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 121 | Online Store / Digital Catalog (shareable product catalog with ordering) | [x] | HIGH | [x] | Epic C PR4 — Shipped 2026-05-15 (`d47b84a` BE + `ea1b9ae` FE) — public `/p/store/:slug`, StorefrontSettingsPage, slug-rules, reserved-slugs guard |
| 122 | Sales Pipeline (Quotation > Sale Order > Delivery > Invoice, partial fulfillment) | [x] | MEDIUM | [x] | Epic B PR1 — Shipped 2026-05-15 (`6193d28`) — lineage svc + sales hub + 3 list/detail/create flows |
| 123 | WhatsApp Marketing (bulk promo messages to customers) | [x] | MEDIUM | [x] | Epic A — BE (`3ea2cdc`..`5c2e3ca`) + FE slices 1-3 (`9b1f096`/`016a1c8`/`9d281de`) — templates, campaigns wizard, recipient table, status badges, +221 EN/HI keys. Activation needs `MARKETING_ENABLED=true` + `AISENSY_API_KEY` + `AISENSY_WEBHOOK_SECRET` |
| 124 | SMS Marketing (campaigns, templates) | [x] | LOW | [x] | Epic A — same commits as #123. MSG91 provider wired. Activation needs `MSG91_WEBHOOK_TOKEN` |
| 125 | Loyalty / Rewards Program (points per purchase) | [x] | MEDIUM | [x] | Epic D — Shipped 2026-05-17 (`1bb2fcc` BE + `d8eb926` FE). Program CRUD, FIFO accrual ledger, advisory-locked redemption, POS step 10.5/10.6 in $tx, void/restore symmetry, 04:15 IST expiry cron |
| 126 | Service Reminders (recurring service notifications) | [x] | LOW | [x] | Epic A slice 3 (`9d281de`) — reminder rules + 30-min cron + PII purge + opt-out chip on party rows. Activation needs Aisensy/MSG91 creds |
| 127 | CRM Basics (customer notes, follow-up dates, tags, last contact) | [x] | MEDIUM | [x] | Epic D — Shipped 2026-05-17 (`ea27525`). Party tags + filter, follow-ups (withinDays cap 1..365), lastContactedAt service, PartyCrmTab + TagFilterBar |
| 128 | Staff Performance & Commission (sales per staff, commission calc, attendance %) | [x] | MEDIUM | [x] | Epic D — Shipped 2026-05-17 (`340d5bc` BE + `4f93808` FE). Rule CRUD (PRODUCT > CATEGORY > ALL), ruleSnapshot deep-clone, void/restore symmetry, factory ledger auth, leaderboard, rate-cap UX (warn 50%/block 100%), staff widget |
| 129 | UPI Payment Collection (QR on invoice, payment link) | [x] | LOW | [x] | Epic C PR2 — Shipped 2026-05-15 (`a148ba3`) — UPI QR on invoice detail (`upi://pay?...`), VPA validation, adapted from DudhHisaab |
| 130 | Web Invoice Links (shareable URL — customer views in browser) | [x] | LOW | [x] | Epic C PR3 — Shipped 2026-05-15 (`77c645a` BE + `9dbbf54` FE) — HMAC-signed `/p/inv/:token`, share drawer, ShareLink model, expiry + revocation |
| 131 | Invite Parties (self-service registration link for customers) | [x] | LOW | [x] | Epic C PR5 — Shipped 2026-05-15 (`15fb596` BE + `ea37c19` FE) — `/p/invite/:token`, OTP gate, one-shot signup binding to businessId, party-invite service |
| 132 | Multiple Price Lists (named lists: MRP, wholesale, dealer, export) | [x] | MEDIUM | [x] | Epic B — Shipped 2026-05-15 (`3626a0c`) — per-invoice override on top of party-wise pricing, cross-tenant guard |
| 133 | Free Item Quantity (buy X get Y free — tracked on invoice) | [x] | LOW | [x] | Epic B — Shipped 2026-05-15 (`3626a0c`) — BOGO custom-role permission (`invoicing.bogo`) wired, audit log, FE toggle |
| 134 | Invoice Custom Fields (user-defined additional fields on invoices) | [x] | LOW | [x] | Epic B — Shipped 2026-05-15 (`3626a0c`) — react-pdf section, showOnInvoice + documentTypes filters |

---

## PHASE 6 — Staff & HR + Multi-Firm + Audit + PIN (Weeks 37-42)
**Goal:** Manage staff from same app + tenant elevation + audit-trail depth + PIN gate
**Status:** 6/6 COMPLETE (merge `caa390d`, 2026-05-26)
**Features:** 6

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 135 | Staff Attendance (check-in/out, daily grid, range list) | [x] | MEDIUM | [x] | PR5 (`0e2b78a` BE + `2f78154` FE) — employee×day matrix, batch + range endpoints, businessId-scoped |
| 136 | Payroll (salary calc, wizard, reversal) | [x] | HIGH | [x] | PR6 (`1b27829` BE + `a83b4d9` FE) — Employee + PayrollRun + STAFF Party pairing + reversal flow |
| 137 | Salary Slips (PDF viewer, reverse action) | [x] | LOW | [x] | PR6 — Payslip viewer + PDF + reverse |
| 138 | Multi-firm Management (suspend/reactivate, tenancy elevation) | [x] | HIGH | [x] | PR0 tenancy audit (`26c4665`, 0 cross-tenant leaks / 1,033 sites), PR1A schema `d036036`, PR1B middleware `ce805d6`, PR2 elevation (`c718490` BE + `8f0a06e` FE: TenantChip + SuspendBanner + ReactivationModal + requireActiveBusiness) |
| 139 | Advanced Audit Trail (search, filter, diff, redaction, CSV) | [x] | MEDIUM | [x] | PR4 (`c0f54a2` BE + `78e1a5e` FE) — websearch_to_tsquery, redaction, buffered CSV; PR7 (`025d037`) backfilled 13 mutations + flipped `enforce-audit-coverage.mjs` to `--block` |
| 140 | Transaction PIN (PinCredential, `requireRecentPin` middleware) | [x] | LOW | [x] | PR3 (`5f802b9` BE + `3fc3802` FE) — PIN port from DH, `/api/auth/pin/*` routes, PinGateProvider + PinPad sheet + 403 interceptor |

**Rollout:** flag-gated (`FEATURE_STAFF_HR` + cohort_pct, `FEATURE_TRANSACTION_PIN` default-on for all users). 5-stage cohort ramp documented in `docs/ROLLOUT_PHASE6.md`. Verifier (`docs/VERIFIER_REPORT_PHASE6.md`): 7 mechanical proofs exit 0 (FE/BE tsc clean, enforce.js, enforce-offline, audit-coverage --block, regression greps). Security Pass-2 PASS (`docs/SECURITY_AUDIT_PHASE6_PASS2.md`, kill-switch wired). 6.1 hardening: dropped unused `PinPhoneLockout` table + removed dead `PIN_GATE_DOMAIN_PREFIX_MISMATCH` code path.

---

## PHASE 7 — AI & Differentiators (Weeks 43+)
**Goal:** Features nobody else has
**Status:** Not Started
**Features:** 10

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 141 | AI Auto-Categorization (scan receipt → auto-fill expense) | [x] | HIGH | [x] | expenses-upgrade PR5 — Anthropic haiku OCR · 5MB cap · graceful unavailable |
| 142 | Voice-Based Entry ("Add 500 sale to Rahul") | [ ] | HIGH | [ ] | Speech-to-intent |
| 143 | WhatsApp Bot Billing (message → invoice) | [ ] | HIGH | [ ] | WhatsApp Business API |
| 144 | Smart GST Filing Assistant (flag errors before filing) | [ ] | MEDIUM | [ ] | Rules engine |
| 145 | Industry Vertical Modes (13 verticals: retail/wholesale/manufacturing/services/restaurant/pharmacy/bakery/salon/clinic/tailor/freelancer/general/other) | [x] | HIGH | [x] | Config-driven via verticals.config.ts — nav filtering + terminology + defaults seeder + Jobs flow (services/freelancer/salon/clinic) + Custom Orders flow (bakery/tailor) all SHIPPED |
| 146 | Predictive Analytics (sales forecast, cash flow prediction) | [ ] | HIGH | [ ] | ML models |
| 147 | Auto-Reconciliation (match payments with invoices using AI) | [ ] | MEDIUM | [ ] | Fuzzy matching |
| 148 | Smart Inventory (predict reorder, seasonal demand) | [ ] | HIGH | [ ] | Historical analysis |
| 149 | Data Import from Competitors (Vyapar/MyBillBook/Tally) | [ ] | HIGH | [ ] | Reverse-engineer formats |
| 150 | Real-time Multi-User Collaboration (live sync, presence indicators) | [ ] | HIGH | [ ] | WebSocket + CRDT |

---

## SUMMARY

| Phase | Features | Weeks | Status |
|-------|----------|-------|--------|
| Phase 1 — MVP | 70 (10 reused + 60 new) | 1-12 | **60 Done, 10 Needs Credentials** (subscription #2 code now ported, still cred-blocked) |
| Phase 2 — GST & Compliance | 20 | 13-18 | **20/20 Done** |
| Phase 3 — Accounting & Finance | 22 | 19-24 | **21/22 Done** (Bank Reconciliation #89 deferred) |
| Phase 4 — Advanced Inventory & POS | 16 | 25-30 | **16/16 Done** |
| Phase 5 — Sales & Marketing | 14 | 31-36 | **14/14 COMPLETE** — Epic A Marketing FE ✅ · Epic B Sales Workflow ✅ · Epic C Customer-Facing ✅ · Epic D CRM/Loyalty/Commission ✅ (merge `63ccef4`) |
| Phase 6 — Staff & HR + Multi-Firm + Audit + PIN | 6 | 37-42 | **6/6 COMPLETE** — #135 Attendance ✅ · #136 Payroll ✅ · #137 Salary Slips ✅ · #138 Multi-firm ✅ · #139 Audit Trail ✅ · #140 Transaction PIN ✅ (merge `caa390d`, verifier + Pass-2 PASS) |
| Phase 7 — AI & Differentiators | 10 | 43+ | **2/10** (#141 receipt OCR + #145 Vertical Modes shipped) |
| **TOTAL** | **150** | **43+ weeks** | **139/150 shipped** |

### Remaining work, ranked

**Build (code work, no creds needed):**
1. Phase 7 — #142 Voice, #143 WA bot, #144 Smart GST, #146 Predictive, #147 Auto-recon, #148 Smart inv, #149 Competitor imports, #150 Multi-user (8 features). Highest leverage: #143 → #149 → #146; highest risk: #150 (needs CRDT vs LWW architecture spike).
2. Phase 3 deferred — #89 Bank Reconciliation (fits with #147)
3. Per-vertical depth — V1 (services hourly billing) through V7 (prescription), see `BACKLOG.md` §9. V4 (staff assignment + commission split) now naturally extends Phase 6 #128 commission ledger.

**Activate (code shipped, env vars needed on Render):**
- #2 Subscription: `ENTITLEMENT_JWT_PRIVATE_KEY`, `ENTITLEMENT_JWT_PUBLIC_KEY`, `RAZORPAY_WEBHOOK_SECRET`
- Phase 5 Epic A launch: `MARKETING_ENABLED=true`, `AISENSY_API_KEY`, `AISENSY_WEBHOOK_SECRET`, `MSG91_WEBHOOK_TOKEN`
- #4 Notifications + #30 Auto-share + #32 Email PDF + #42 Reminders + #47 Low-stock: FCM / Aisensy / Resend / MSG91 keys (same set)
- #59 Biometric: Capacitor plugin install

**Ship (built ≠ deployed):**
- `hisaabpro` is 38 commits ahead of `master`. Production deploy at `89610b0`. Merge to ship the responsive sweep + Epic A + B + C + D + subscription port + **Phase 6 Staff & HR + Multi-firm + Audit + PIN** to prod. Phase 6 ramps per `docs/ROLLOUT_PHASE6.md` (5-stage cohort gate) — flags default off (`FEATURE_STAFF_HR=false`, cohort_pct=0); PIN cohort is 100% by default (PR3 enrolled all users).

---

## VERTICAL-SPECIFIC FEATURES (audit 2026-05-09)

### Shipped today
| Vertical group | Feature | Status |
|---|---|---|
| Services / Freelancer / Salon / Clinic | Jobs flow (QUOTED→SCHEDULED→IN_PROGRESS→COMPLETED→INVOICED) + 4 pages + dashboard widget + convert-to-invoice | ✅ Shipped |
| Bakery / Tailor | Custom Orders flow (RECEIVED→IN_PRODUCTION→READY→DELIVERED→INVOICED) + 4 pages + delivery date/slot + custom fields + Today/Tomorrow widgets | ✅ Shipped |
| Pharmacy | Batch + expiry tracking ON by default, FEFO claim, daily expiry cron | ✅ Shipped |
| Restaurant | Nav-hide serial/verify, terminology="Bill", POS access | ✅ Shipped |
| Manufacturing | Stock + batch + serial defaults ON, BOM CRUD, ProductionRun with WAC propagation | ✅ Shipped |
| Wholesale | Batch tracking default ON | ✅ Shipped |
| Retail | All standard nav, stock default ON | ✅ Shipped |

### Gaps by vertical (next-epic candidates)
| Gap | Affects | Severity |
|---|---|---|
| **Time tracking on Jobs** (hoursEstimated, hoursActual, ratePerHour) | Services / Freelancer / Salon / Clinic | HIGH — plumber/freelancer cannot bill hourly today |
| **Appointment calendar + slot picker** | Salon / Clinic | HIGH — no scheduling, no availability view |
| **Staff assignment on Jobs/Orders** + commission split | Services / Bakery / Tailor / Manufacturing | MEDIUM — multi-staff job cannot split commission |
| **Recipe / Menu cost dashboard** (BOM works, no per-recipe UI) | Restaurant / Bakery | MEDIUM — cost-per-dish needs derived view |
| **Customer delivery reminders** (SMS/WA) | Bakery / Tailor | MEDIUM — marketing infra exists, vertical wiring missing |
| **Table management + KOT** | Restaurant | LOW (out of MSME billing scope; deferred) |
| **Prescription field** | Pharmacy / Clinic | LOW — can use generic custom fields today |

---

## METRICS & MILESTONES

| Milestone | Target Week | Criteria |
|-----------|-------------|----------|
| Core extracted from DudhHisaab | 2 | @hisaab/core working independently |
| MVP feature-complete | 10 | All 62 features passing /verify |
| Beta launch (5-10 businesses) | 11 | Zero data loss for 1 week |
| MVP ship | 12 | All beta feedback addressed |
| GST-compliant | 18 | CA-validated reports |
| 100 paying users | 24 | Product-market fit signal |
| Full accounting suite | 30 | P&L, Balance Sheet CA-verified |
| 1000 users | 36 | Growth marketing begins |
| AI features live | 48 | Voice + receipt scan working |

---

## REVIEW INTELLIGENCE SUMMARY

### Top 5 User Pain Points to Exploit
1. **Data loss** → auto-backup, offline-first, zero data loss guarantee
2. **Terrible support (3-4 month resolution)** → WhatsApp support, fix in days
3. **Broken inventory (stock at 0, bills still generate)** → atomic stock validation
4. **Rigid roles (can't customize permissions)** → granular role builder
5. **Doesn't work offline** → full offline-first architecture

### Top 5 Features Users Love (must match)
1. Simple interface for beginners
2. WhatsApp invoice sharing (one tap)
3. Payment reminders (automated)
4. Multi-device access
5. Reports (daily/monthly overview)

### Critical Migration Feature
- **Opening balances** — without this, zero users migrate from Vyapar/MyBillBook/manual books

---

## UPDATE LOG

| Date | Phase | Change | By |
|------|-------|--------|-----|
| 2026-03-14 | All | Initial roadmap: 86 features | Sawan + Claude |
| 2026-03-14 | All | Self-audit: found 63 gaps, 16 underspec, 5 redundancies. Expanded to 150 features | Claude |
| 2026-03-15 | 1 | Built all Phase 1 backend (120+ endpoints, 47 Prisma models) + frontend (33 routes, 221 files) | Claude |
| 2026-03-16 | 1 | Security hardening: CSRF, account lockout, Redis rate limiter, httpOnly cookies, CAPTCHA, replay protection, security headers. Dark mode, i18n, invoice image export. 58/70 done | Claude |
| 2026-03-17 | 2 | Phase 2 GST complete: 20 features built (Batch A-E). Tax engine, GSTR-1/3B/9, e-invoice, e-way bill, TDS/TCS, CN/DN, composition scheme, reverse charge, cess, HSN, multi-currency, recurring invoices, GSTR-1 reconciliation. All endpoints curl-tested (200/401/400). Frontend pages for all features. | Claude |
| 2026-05-08 | 3 | Phase 3 financial year closure + cash-register upgrade (calculator, history, audit, idempotency). | Claude |
| 2026-05-08 | 4 | Phase 4 jumped from 0 → 10/16. Shipped: BAT-01..07 (batches/FEFO/expiry), serial numbers, multi-godown, stock adjustment, expiry cron, reorder alerts, stock-verification finalize, POS checkout (sales/void/restore/receipts/history). Pending: barcode gen+scan, label printing, BOM, MOQ, item-image UI, party-ledger view. | Claude |
| 2026-05-08 | 7 | Phase 7 1/10 — expense receipt OCR via Anthropic haiku shipped (`e11caf9`). | Claude |
| 2026-05-08 | All | Roadmap freshness pass — synced statuses against actual `routes/`, `features/`, and migration log. Total ~112/150 shipped. | Claude |
| 2026-05-08 (PM) | 4 | Phase 4 finished. Three epics shipped autonomously: catalog-enrichment (#117 MOQ + #116 item images + #120 party ledger), barcode-and-label (#106 native scan + #111 label print/PDF/bulk), bom-manufacturing (#115 BOM + atomic production runs + WAC propagation + cancel/reverse). Phase 4 = 16/16. Total 118/150 shipped. | Claude |
| 2026-05-15 | 5 | **Phase 5 jumped from 0 → 11/14.** Epic A Marketing FE (slices 1-3, +221 EN/HI keys, commits `9b1f096`/`016a1c8`/`9d281de`). Epic B Sales Workflow shipped (#122/#132/#133/#134, commits `6193d28`+`3626a0c`). Epic C Customer-Facing shipped (#121 storefront + #129 UPI QR + #130 share links + #131 invite, commits `d78f7c9`..`237b551`). Plus subscription port (commit `3530e79`) — DH gating model with 7-state machine, UPI Autopay, RS256 offline JWT, PRO_MAX tier. Plus responsive sweep Waves 0-7 (`7c12683`..`5b8d3fe`). Plus backend audit pass — 1 P1 + 2 P2 + 2 P3 cleared, idempotency middleware on 17 POST routes. Total 130/150 shipped. | Claude |
| 2026-05-17 | All | Deep audit + doc refresh. Found ROADMAP claimed 119/150 vs actual 130/150 — Phase 5 Epic A/B/C rows updated, totals reconciled, remaining-work breakdown added. BACKLOG section 3 (Epic C) updated from "next" to "shipped." | Claude |
| 2026-05-26 | 6 | **Phase 6 COMPLETE (6/6).** All six tenant-shaped features merged to `hisaabpro` via `caa390d` after 12 commits + 2 hardening commits. PR0 tenancy audit (0 cross-tenant leaks / 1,033 sites, `26c4665`). PR1A/B schema + middleware (9 tables, 28 cols, `requireActiveBusiness`). PR2 #138 Multi-firm suspend/reactivate (TenantChip + SuspendBanner + ReactivationModal). PR3 #140 Transaction PIN (PinCredential + `/auth/pin/*` + PinGateProvider + PinPad + 403 interceptor). PR4 #139 Audit Trail (websearch_to_tsquery + redaction + buffered CSV + diff drawers). PR5 #135 Attendance (employee×day matrix + batch + range). PR6 #136 Payroll + #137 Salary slips (Employee + PayrollRun + Payslip + reversal). PR7 audit-backfill 13 mutations + enforcer `--block`. PR8 rollout flags + runbook + ramp playbook. Pass-2 fix wired `requireFeature('STAFF_HR')` kill-switch into 3 aggregator routers. 6.1 hardening dropped unused `PinPhoneLockout` + dead `PIN_GATE_DOMAIN_PREFIX_MISMATCH` code. Verifier: 7 mechanical proofs exit 0. Security Pass-2 PASS. Total **139/150 shipped**. | Claude |
| 2026-05-17 | 5 | **Phase 5 COMPLETE (14/14).** Epic D shipped on isolated worktree → merged `63ccef4`. PR1 `b61e1a1` schema + migration + types + translations. PR2 `ea27525` CRM #127 (tags + follow-ups + lastContactedAt). PR3 `1bb2fcc` Loyalty #125 BE (FIFO accrual ledger, advisory-locked redeem, POS step 10.5/10.6 in $tx, 04:15 IST expiry cron, void/restore symmetry). PR4 `d8eb926` Loyalty #125 FE. PR5 `340d5bc` Commission #128 BE (ruleSnapshot deep-clone × 2 sites, PRODUCT > CATEGORY > ALL specificity, factory ledger auth, STAFF_NOT_FOUND cross-tenant guard, rate cap at 10000 bps). PR6 `4f93808` Commission #128 FE (rules CRUD + ledger + leaderboard + staff widget, S2 warn/block UX). Architecture-audit Pass 5 PASS · Security Pass-2 PASS (0 MUST, 1 SHOULD deferred = cron multi-pod systemic) · QA Gate GREEN (49/49 criteria, 10/10 cross-cutting, 3/3 mechanical). Total 133/150 shipped. | Claude |
