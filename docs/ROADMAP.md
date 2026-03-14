# HisaabApp — Master Feature Roadmap

> **Last Updated:** 2026-03-14
> **Status:** Planning
> **Owner:** Sawan Jaiswal
> **Architecture:** Modular Monolith (2 repos: @hisaab/core + hisaab-app)
> **Total Features:** 132 across 7 phases
> **Audit Status:** Self-audited 2026-03-14 (63 gaps found and filled)

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
**Status:** Not Started
**Features:** 40 (10 reused + 30 new)

### 1A. Reused from DudhHisaab (~10-14 days)

| # | Feature | Status | Source | Notes |
|---|---------|--------|--------|-------|
| 1 | Auth (OTP, login, JWT, refresh, 2FA, WebAuthn) | [ ] | DudhHisaab | 95% reusable |
| 2 | Subscription & Billing (Razorpay, tiers, add-ons) | [ ] | DudhHisaab | 85% reusable |
| 3 | Referral & Earn (codes, wallet, UPI withdrawal, fraud detection) | [ ] | DudhHisaab | 85% reusable |
| 4 | Notifications (push, email, WhatsApp, SMS, quiet hours) | [ ] | DudhHisaab | 85% reusable |
| 5 | Backup (local device + Google Drive + email export, encryption, restore) | [ ] | DudhHisaab | 90% reusable. Add local + email backup options |
| 6 | Offline-first PWA (IndexedDB, sync queue, service worker) | [ ] | DudhHisaab | 90% reusable |
| 7 | Admin Panel Framework (users, analytics, monitoring, audit) | [ ] | DudhHisaab | 80% reusable |
| 8 | Dark Mode / Theming (CSS vars, theme selection: classic/modern/minimal) | [ ] | DudhHisaab | 95% reusable. Add theme picker |
| 9 | Multi-language (EN/HI) | [ ] | DudhHisaab | 90% reusable |
| 10 | Onboarding Flow (business setup wizard + opening balances entry) | [ ] | DudhHisaab | Adapt. MUST include opening balances for migration |

### 1B. Party Management

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 11 | Party CRUD (Customer + Supplier, groups, tags, contact import) | [ ] | LOW | [ ] | Adapt DudhHisaab |
| 12 | Party Balances & Statements (outstanding, transaction history) | [ ] | LOW | [ ] | |
| 13 | Multiple Addresses per Party (billing + shipping addresses) | [ ] | LOW | [ ] | Required for invoicing |
| 14 | Party Credit Limits (block invoicing beyond limit, configurable) | [ ] | LOW | [ ] | Standard feature |
| 15 | Party Custom Fields (user-defined additional fields) | [ ] | LOW | [ ] | Vyapar has this |
| 16 | Party-wise Pricing (retailer/wholesale/regular rates per product) | [ ] | MEDIUM | [ ] | #1 MyBillBook gap |
| 17 | Opening Balances (party balances, stock, bank — for migration) | [ ] | MEDIUM | [ ] | CRITICAL — without this, no one migrates |

### 1C. Invoicing & Documents

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 18 | Sale Invoice (non-GST, with line items, discounts, additional charges) | [ ] | MEDIUM | [ ] | Core billing |
| 19 | Purchase Invoice (record purchases from suppliers) | [ ] | MEDIUM | [ ] | |
| 20 | Estimates / Quotations (pre-sale proposals) | [ ] | LOW | [ ] | |
| 21 | Proforma Invoices (formal quote before final invoice) | [ ] | LOW | [ ] | |
| 22 | Purchase Orders (order before receiving goods) | [ ] | LOW | [ ] | |
| 23 | Sale Orders (confirmed order before invoicing) | [ ] | LOW | [ ] | |
| 24 | Delivery Challans (goods movement without invoice) | [ ] | LOW | [ ] | |
| 25 | Invoice Numbering (auto-increment, custom prefix/suffix, per FY series) | [ ] | LOW | [ ] | |
| 26 | Additional Charges on Invoice (shipping, packaging, freight, loading) | [ ] | LOW | [ ] | |
| 27 | Due Dates on Invoices (payment terms: 15/30/60 days) | [ ] | LOW | [ ] | |
| 28 | Terms & Conditions on Invoice (customizable per template) | [ ] | LOW | [ ] | |
| 29 | Digital Signature Block (image/drawn signature on invoice) | [ ] | LOW | [ ] | |
| 30 | Auto Invoice Sharing (auto-send via WhatsApp/email on save) | [ ] | LOW | [ ] | |
| 31 | Invoice Image Export (JPG/PNG for WhatsApp — not just PDF) | [ ] | LOW | [ ] | |
| 32 | Share via Email with PDF Attachment | [ ] | LOW | [ ] | |
| 33 | Invoice Recovery / Recycle Bin (recover deleted invoices) | [ ] | LOW | [ ] | MyBillBook has this |
| 34 | Show Profit During Sale (real-time margin display while billing) | [ ] | LOW | [ ] | Vyapar power feature |

### 1D. Invoice Templates & Printing

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 35 | Invoice Templates (thermal, A4, A5, modern — 5+ base templates) | [ ] | MEDIUM | [ ] | |
| 36 | Template Customization (fonts, colors, column toggles, field visibility) | [ ] | MEDIUM | [ ] | MyBillBook has 50+ options |
| 37 | Print Settings (page size, margins, font size, header/footer) | [ ] | LOW | [ ] | |
| 38 | Round-off Settings (nearest 1, 0.50, 0.10 — configurable) | [ ] | LOW | [ ] | |
| 39 | Decimal Precision Settings (2 vs 3 decimal places for qty/rate/amount) | [ ] | LOW | [ ] | |

### 1E. Payment Tracking

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 40 | Payment In/Out (cash, UPI, bank transfer, cheque — link to invoices) | [ ] | LOW | [ ] | Adapt DudhHisaab |
| 41 | Outstanding Tracking (who owes how much, aging preview) | [ ] | LOW | [ ] | |
| 42 | Payment Reminders (automated via WhatsApp/SMS/push) | [ ] | LOW | [ ] | Notification system ready |
| 43 | Discount During Payment (apply discount at payment time) | [ ] | LOW | [ ] | Vyapar feature |

### 1F. Basic Inventory

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 44 | Products CRUD (name, price, unit, category, opening stock) | [ ] | MEDIUM | [ ] | |
| 45 | Stock In/Out (auto-update on invoice, manual adjustment) | [ ] | MEDIUM | [ ] | |
| 46 | Stock Validation (block invoice if stock < qty, configurable) | [ ] | LOW | [ ] | Competitor gap |
| 47 | Low-Stock Alerts (configurable minimum qty, push notification) | [ ] | LOW | [ ] | |
| 48 | Item Categories & Units (with unit conversion: 1 box = 12 pcs) | [ ] | MEDIUM | [ ] | Vyapar feature |
| 49 | Item Custom Fields (user-defined fields per product) | [ ] | LOW | [ ] | |

### 1G. Dashboard & Reports

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 50 | Dashboard (today's sales, outstanding, top customers, quick actions) | [ ] | LOW | [ ] | Adapt DudhHisaab |
| 51 | Sale/Purchase Reports (by date range, party, product) | [ ] | MEDIUM | [ ] | |
| 52 | Party Statements (transaction history per customer/supplier) | [ ] | LOW | [ ] | |
| 53 | Stock Summary Report (current stock, value, movement) | [ ] | MEDIUM | [ ] | |
| 54 | Day Book (all transactions for a day — simple list, not accounting) | [ ] | LOW | [ ] | |
| 55 | Payment History Report | [ ] | LOW | [ ] | |

### 1H. Settings & Security

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 56 | Custom User Roles/Permissions (granular role builder, field-level access) | [ ] | MEDIUM | [ ] | #1 Vyapar complaint |
| 57 | Transaction Edit/Delete Controls (lock old transactions, require approval) | [ ] | LOW | [ ] | Vyapar feature |
| 58 | Passcode / PIN Protection (app-level lock) | [ ] | LOW | [ ] | |
| 59 | Biometric Auth (fingerprint/face for app access) | [ ] | LOW | [ ] | Capacitor biometric plugin |
| 60 | Date Format Customization (DD/MM/YYYY, MM/DD/YYYY) | [ ] | LOW | [ ] | |
| 61 | Keyboard Shortcuts for billing (Tab, Enter, hotkeys) | [ ] | LOW | [ ] | Power user demand |
| 62 | Built-in Calculator (utility accessible from any screen) | [ ] | LOW | [ ] | Vyapar has this |

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
**Status:** Not Started
**Features:** 20

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 63 | GST Invoice Engine (CGST/SGST/IGST auto-calc, HSN/SAC codes) | [ ] | HIGH | [ ] | Core tax engine |
| 64 | Tax Categories / Tax Groups (5% GST, 12% GST, exempt — assign to items) | [ ] | MEDIUM | [ ] | Foundation for tax calc |
| 65 | Place of Supply (determines IGST vs CGST+SGST — legally required) | [ ] | MEDIUM | [ ] | GST law requirement |
| 66 | GSTR-1 Export (JSON for filing) | [ ] | MEDIUM | [ ] | Monthly sales return |
| 67 | GSTR-1 Auto-Reconciliation (match filed vs books) | [ ] | MEDIUM | [ ] | MyBillBook feature |
| 68 | GSTR-2 Report | [ ] | MEDIUM | [ ] | Monthly purchases |
| 69 | GSTR-3B Report | [ ] | MEDIUM | [ ] | Combined filing |
| 70 | GSTR-9 Annual Return | [ ] | MEDIUM | [ ] | Annual summary |
| 71 | E-Invoicing (IRN generation, QR code on invoice) | [ ] | HIGH | [ ] | NIC portal integration |
| 72 | E-Way Bill (auto-generate, transport/vehicle details) | [ ] | HIGH | [ ] | NIC e-way bill API |
| 73 | Reverse Charge Mechanism | [ ] | LOW | [ ] | Specific transaction types |
| 74 | Composite Scheme Support | [ ] | LOW | [ ] | Alternative tax regime |
| 75 | Additional Cess (tobacco, coal, aerated drinks) | [ ] | LOW | [ ] | Vyapar feature |
| 76 | HSN Auto-fill (set once per product, auto-carry) | [ ] | LOW | [ ] | Competitor gap |
| 77 | TDS/TCS Support (tax deducted/collected at source) | [ ] | MEDIUM | [ ] | Required for B2B |
| 78 | GSTIN Verification per Party (validate GSTIN against govt database) | [ ] | LOW | [ ] | Trust feature |
| 79 | Tax Reports (collected, paid, HSN-wise summary) | [ ] | MEDIUM | [ ] | |
| 80 | Credit Notes / Debit Notes (sale/purchase returns) | [ ] | MEDIUM | [ ] | |
| 81 | Multi-currency Support (foreign transactions, exchange rates) | [ ] | MEDIUM | [ ] | |
| 82 | Recurring Invoices (auto-generate on schedule — rent, subscriptions) | [ ] | MEDIUM | [ ] | |

### Phase 2 Acceptance Criteria
- [ ] GST invoice generated with correct tax breakup (CGST+SGST or IGST based on place of supply)
- [ ] GSTR-1 JSON exported and verified against government portal
- [ ] E-invoice IRN generated via NIC API sandbox
- [ ] E-way bill auto-generated for qualifying transactions
- [ ] TDS/TCS correctly deducted and reported
- [ ] CA/accountant validates reports match manual calculations
- [ ] Recurring invoices auto-generate on schedule

---

## PHASE 3 — Accounting & Finance (Weeks 19-24)
**Goal:** Replace accountant's manual ledger
**Status:** Not Started
**Features:** 22

| # | Feature | Status | Complexity | PRD | Notes |
|---|---------|--------|-----------|-----|-------|
| 83 | Double-Entry Accounting Ledger (every txn = debit + credit) | [ ] | HIGH | [ ] | Foundation — CA must validate |
| 84 | Profit & Loss Statement | [ ] | MEDIUM | [ ] | Depends on ledger |
| 85 | Balance Sheet | [ ] | MEDIUM | [ ] | Depends on ledger |
| 86 | Cash Flow Report | [ ] | MEDIUM | [ ] | |
| 87 | Accounting Day Book (with journal entries, not simple list) | [ ] | MEDIUM | [ ] | Upgrade from Phase 1 simple day book |
| 88 | Journal Entries (manual adjustments, contra entries) | [ ] | MEDIUM | [ ] | |
| 89 | Bank Reconciliation (match bank statement with entries) | [ ] | HIGH | [ ] | |
| 90 | Receipt Vouchers (formal cash/bank receipt documents) | [ ] | LOW | [ ] | |
| 91 | Payment Vouchers (formal cash/bank payment documents) | [ ] | LOW | [ ] | |
| 92 | Cheque Management / Register (issued, received, clearance dates) | [ ] | MEDIUM | [ ] | Vyapar feature |
| 93 | Multiple Bank Accounts (add accounts, track balances) | [ ] | MEDIUM | [ ] | |
| 94 | Cash-in-Hand Tracking (explicit cash account) | [ ] | LOW | [ ] | |
| 95 | Cash Book / Bank Book (separate transaction logs) | [ ] | LOW | [ ] | |
| 96 | Expense Tracking (categories, recurring, receipt attachments) | [ ] | MEDIUM | [ ] | |
| 97 | Other Income Sources (interest, rent, miscellaneous) | [ ] | LOW | [ ] | Vyapar feature |
| 98 | Loan Accounts (EMI tracking, interest calc, loan statements) | [ ] | MEDIUM | [ ] | |
| 99 | Financial Year Closure (carry forward balances, pending txn handling) | [ ] | MEDIUM | [ ] | |
| 100 | Tally Export (compatible data format) | [ ] | MEDIUM | [ ] | Critical for CA adoption |
| 101 | Aging Reports (receivables/payables by 30/60/90/120 days) | [ ] | MEDIUM | [ ] | Standard accounting |
| 102 | Profitability Reports (bill-wise, party-wise, product-wise margins) | [ ] | LOW | [ ] | Merged from old #46, #47 |
| 103 | Discount Reports (aggregated discount analysis) | [ ] | LOW | [ ] | |
| 104 | COGS / Purchase Price Tracking (cost of goods sold per product) | [ ] | MEDIUM | [ ] | |

### Phase 3 Acceptance Criteria
- [ ] Double-entry ledger produces correct trial balance
- [ ] P&L and Balance Sheet verified by CA
- [ ] Bank reconciliation matches real bank statement
- [ ] Aging reports show correct outstanding buckets
- [ ] Tally export imports cleanly into TallyPrime
- [ ] Financial year closure carries forward correct balances

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
| Phase 1 — MVP | 62 (10 reused + 52 new) | 1-12 | Not Started |
| Phase 2 — GST & Compliance | 20 | 13-18 | Not Started |
| Phase 3 — Accounting & Finance | 22 | 19-24 | Not Started |
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
| 2026-03-14 | All | Self-audit: found 63 gaps, 16 underspec, 5 redundancies. Expanded to 150 features. Added: opening balances, PO/SO, proforma, multiple addresses, credit limits, custom fields, tax groups, place of supply, TDS/TCS, cheque management, aging reports, POS mode, party ledger, receipt/payment vouchers, round-off/decimal settings, passcode/biometric, invoice recovery, profit during sale, and 40+ more | Claude |
