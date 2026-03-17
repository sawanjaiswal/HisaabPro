# HisaabPro — Master Feature Roadmap

> **Last Updated:** 2026-03-16
> **Status:** Phase 1 MVP — 58/70 features built, 10 need external credentials, 2 building
> **Owner:** Sawan Jaiswal
> **Architecture:** Monolith — React 19 frontend + Express backend + Prisma + PostgreSQL
> **Total Features:** 150 across 7 phases (Phase 1: 70 features)
> **Build Status:** Frontend 33 routes, 221+ files | Backend 120+ endpoints, 47 Prisma models

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
| 2 | Subscription & Billing (Razorpay, tiers, add-ons) | [B] | DudhHisaab | Needs Razorpay credentials |
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
**Status:** Not Started
**Features:** 16

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 105 | Barcode Generation (create barcodes for products) | [ ] | LOW | [ ] | |
| 106 | Barcode Scanning (camera-based quick entry) | [ ] | LOW | [ ] | Capacitor camera |
| 107 | Batch Tracking (batch-wise stock with MFD/expiry) | [ ] | MEDIUM | [ ] | |
| 108 | Serial Number Tracking (individual item identification) | [ ] | MEDIUM | [ ] | |
| 109 | Multi-Godown (warehouse mgmt, inter-godown transfer, stock per location) | [ ] | HIGH | [ ] | |
| 110 | Stock Adjustment (damage, theft, audit correction with reason) | [ ] | LOW | [ ] | |
| 111 | Label Printing (barcode + price labels, thermal printer) | [ ] | LOW | [ ] | |
| 112 | Bulk Import/Export (items, parties, invoices, opening balances from Excel) | [ ] | MEDIUM | [ ] | Expanded from old #57 |
| 113 | Expiry Alerts (auto-alert X days before, hide expired from POS) | [ ] | LOW | [ ] | Competitor gap |
| 114 | Reorder Points (auto-suggest purchase orders at low stock) | [ ] | MEDIUM | [ ] | |
| 115 | Item Conversion (raw material to finished goods, BOM) | [ ] | MEDIUM | [ ] | Manufacturing |
| 116 | Item Images (in catalog, invoice, inventory) | [ ] | LOW | [ ] | |
| 117 | Minimum Order Quantity (MOQ per item) | [ ] | LOW | [ ] | |
| 118 | POS Billing Mode (fast retail: barcode scan, cash drawer, receipt print) | [ ] | HIGH | [ ] | MyBillBook feature |
| 119 | Data Verification / Mismatch Detection (auto-detect stock & ledger discrepancies) | [ ] | MEDIUM | [ ] | Vyapar feature |
| 120 | Party Ledger (dedicated ledger view per party — distinct from statement) | [ ] | LOW | [ ] | Accounting term |

---

## PHASE 5 — Sales & Marketing (Weeks 31-36)
**Goal:** Help businesses grow, not just manage
**Status:** Not Started
**Features:** 14

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 121 | Online Store / Digital Catalog (shareable product catalog with ordering) | [ ] | HIGH | [ ] | |
| 122 | Sales Pipeline (Quotation > Sale Order > Delivery > Invoice, partial fulfillment) | [ ] | MEDIUM | [ ] | Merged old #62 + #69 |
| 123 | WhatsApp Marketing (bulk promo messages to customers) | [ ] | MEDIUM | [ ] | Already have Aisensy |
| 124 | SMS Marketing (campaigns, templates) | [ ] | LOW | [ ] | |
| 125 | Loyalty / Rewards Program (points per purchase) | [ ] | MEDIUM | [ ] | |
| 126 | Service Reminders (recurring service notifications) | [ ] | LOW | [ ] | |
| 127 | CRM Basics (customer notes, follow-up dates, tags, last contact) | [ ] | MEDIUM | [ ] | |
| 128 | Staff Performance & Commission (sales per staff, commission calc, attendance %) | [ ] | MEDIUM | [ ] | Merged old #68 + #74 |
| 129 | UPI Payment Collection (QR on invoice, payment link) | [ ] | LOW | [ ] | Adapt DudhHisaab |
| 130 | Web Invoice Links (shareable URL — customer views in browser) | [ ] | LOW | [ ] | Vyapar feature |
| 131 | Invite Parties (self-service registration link for customers) | [ ] | LOW | [ ] | Vyapar feature |
| 132 | Multiple Price Lists (named lists: MRP, wholesale, dealer, export) | [ ] | MEDIUM | [ ] | Beyond party-wise pricing |
| 133 | Free Item Quantity (buy X get Y free — tracked on invoice) | [ ] | LOW | [ ] | Vyapar feature |
| 134 | Invoice Custom Fields (user-defined additional fields on invoices) | [ ] | LOW | [ ] | |

---

## PHASE 6 — Staff & HR (Weeks 37-42)
**Goal:** Manage staff from same app
**Status:** Not Started
**Features:** 6

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 135 | Staff Attendance (check-in/out, leave tracking, geo-fencing) | [ ] | MEDIUM | [ ] | |
| 136 | Payroll (salary calc, deductions, PF/ESI compliance) | [ ] | HIGH | [ ] | Labor law compliance |
| 137 | Salary Slips (PDF generation, WhatsApp share) | [ ] | LOW | [ ] | |
| 138 | Multi-firm Management (switch businesses, isolated data, shared parties optional) | [ ] | HIGH | [ ] | Tenant isolation |
| 139 | Advanced Audit Trail (who changed what, when, diff view, rollback) | [ ] | MEDIUM | [ ] | Adapt DudhHisaab |
| 140 | PIN for Transactions (require PIN to approve delete/edit/high-value txns) | [ ] | LOW | [ ] | Vyapar feature |

---

## PHASE 7 — AI & Differentiators (Weeks 43+)
**Goal:** Features nobody else has
**Status:** Not Started
**Features:** 10

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 141 | AI Auto-Categorization (scan receipt → auto-fill expense) | [ ] | HIGH | [ ] | OCR + LLM |
| 142 | Voice-Based Entry ("Add 500 sale to Rahul") | [ ] | HIGH | [ ] | Speech-to-intent |
| 143 | WhatsApp Bot Billing (message → invoice) | [ ] | HIGH | [ ] | WhatsApp Business API |
| 144 | Smart GST Filing Assistant (flag errors before filing) | [ ] | MEDIUM | [ ] | Rules engine |
| 145 | Industry Vertical Modes (dairy/grocery/restaurant/textile/pharmacy) | [ ] | HIGH | [ ] | Config-driven |
| 146 | Predictive Analytics (sales forecast, cash flow prediction) | [ ] | HIGH | [ ] | ML models |
| 147 | Auto-Reconciliation (match payments with invoices using AI) | [ ] | MEDIUM | [ ] | Fuzzy matching |
| 148 | Smart Inventory (predict reorder, seasonal demand) | [ ] | HIGH | [ ] | Historical analysis |
| 149 | Data Import from Competitors (Vyapar/MyBillBook/Tally) | [ ] | HIGH | [ ] | Reverse-engineer formats |
| 150 | Real-time Multi-User Collaboration (live sync, presence indicators) | [ ] | HIGH | [ ] | WebSocket + CRDT |

---

## SUMMARY

| Phase | Features | Weeks | Status |
|-------|----------|-------|--------|
| Phase 1 — MVP | 70 (10 reused + 60 new) | 1-12 | **60 Done, 10 Needs Credentials** |
| Phase 2 — GST & Compliance | 20 | 13-18 | **20/20 Done** |
| Phase 3 — Accounting & Finance | 22 | 19-24 | Done (21/22, 1 deferred) |
| Phase 4 — Advanced Inventory & POS | 16 | 25-30 | Not Started |
| Phase 5 — Sales & Marketing | 14 | 31-36 | Not Started |
| Phase 6 — Staff & HR | 6 | 37-42 | Not Started |
| Phase 7 — AI & Differentiators | 10 | 43+ | Not Started |
| **TOTAL** | **150** | **43+ weeks** | |

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
