# HisaabPro — Master Feature & Page Map (SSOT)

Last updated: 2026-04-03 | Features: 135 | Pages: 95 | Stubs: 15

> Single source of truth. Every feature has a unique ID. Every page is mapped to its feature. No duplicates.

---

## Phase 1A: Core & Reused

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F001 | Auth (OTP, JWT, refresh, 2FA, WebAuthn) | `/login` | Real | Done | P0 |
| F002 | Subscription & Billing (Razorpay) | — (backend only) | — | Needs Credentials | P0 |
| F003 | Referral & Earn (codes, wallet, UPI) | — (backend only) | — | Done | P1 |
| F004 | Notifications (push, email, WhatsApp, SMS) | — (backend only) | — | Needs Credentials | P0 |
| F005 | Backup (local + Google Drive + email) | — (in Settings) | — | Done | P0 |
| F006 | Offline-first PWA (IndexedDB, sync, SW) | — (global) | — | Done | P0 |
| F007 | Admin Panel Framework | `/admin/coupons`, `/admin/coupons/:id` | Real, Real | Done | P1 |
| F008 | Dark Mode / Theming | — (in Settings toggle) | — | Done | P1 |
| F009 | Multi-language (EN/HI) | — (in Settings toggle) | — | Done | P0 |
| F010 | Onboarding Flow (business setup wizard) | `/onboarding`, `/business/create` | Real, Real | Done | P0 |

## Phase 1B: Party Management

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F011 | Party CRUD (customers + suppliers, groups) | `/parties`, `/parties/:id`, `/parties/new`, `/parties/:id/edit` | Real, Real, Real, Real | Done | P0 |
| F012 | Party Balances & Statements | `/reports/party-statement/:partyId` | Real | Done | P0 |
| F013 | Multiple Addresses per Party | — (in Party detail) | — | Done | P0 |
| F014 | Party Credit Limits | — (in Party model) | — | Done | P1 |
| F015 | Party Custom Fields | — (backend only) | — | Done | P2 |
| F016 | Party-wise Pricing | — (in Party detail) | — | Done | P1 |
| F017 | Opening Balances (migration) | — (backend only) | — | Done | P0 |

## Phase 1C: Invoicing & Documents

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F018 | Sale Invoice (non-GST, line items, discounts) | `/invoices`, `/invoices/:id`, `/invoices/new`, `/invoices/:id/edit` | Real, Real, Real, Real | Done | P0 |
| F019 | Purchase Invoice | — (shares invoice pages, type toggle) | — | Done | P0 |
| F020 | Estimates / Quotations | — (shares invoice pages, type toggle) | — | Done | P1 |
| F021 | Proforma Invoices | — (shares invoice pages, type toggle) | — | Done | P1 |
| F022 | Purchase Orders | — (shares invoice pages, type toggle) | — | Done | P1 |
| F023 | Sale Orders | — (shares invoice pages, type toggle) | — | Done | P1 |
| F024 | Delivery Challans | — (shares invoice pages, type toggle) | — | Done | P1 |
| F025 | Invoice Numbering (auto-increment, prefix) | — (backend + settings) | — | Done | P0 |
| F026 | Additional Charges (shipping, freight) | — (in invoice form) | — | Done | P0 |
| F027 | Due Dates (payment terms: 15/30/60 days) | — (in DocumentSettings) | — | Done | P0 |
| F028 | Terms & Conditions on Invoice | — (backend CRUD) | — | Done | P1 |
| F029 | Digital Signature Block | — (in settings) | — | Done | P2 |
| F030 | Auto Invoice Sharing (WhatsApp/email) | — (backend only) | — | Needs Credentials | P0 |
| F031 | Invoice Image Export (JPG/PNG) | — (in InvoiceDetailPage) | — | Done | P1 |
| F032 | Share via Email with PDF | — (backend only) | — | Needs Credentials | P1 |
| F033 | Invoice Recycle Bin | — (in invoices list) | — | Done | P1 |
| F034 | Show Profit During Sale | — (in DocumentSettings) | — | Done | P1 |

## Phase 1D: Invoice Templates & Printing

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F035 | Invoice Templates (30 across 7 categories) | `/settings/templates`, `/settings/templates/:id` | Real, Real | Done | P0 |
| F036 | Template Customization (fonts, colors, columns) | — (in TemplateEditorPage) | — | Done | P1 |
| F037 | Print Settings (page size, margins) | — (in TemplateEditorPage) | — | Done | P1 |
| F038 | Round-off Settings | — (in DocumentSettings) | — | Done | P0 |
| F039 | Decimal Precision Settings | — (in InventorySetting) | — | Done | P1 |

## Phase 1E: Payment Tracking

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F040 | Payment In/Out (cash, UPI, bank, cheque) | `/payments`, `/payments/:id`, `/payments/new`, `/payments/:id/edit` | Real, Real, Real, Real | Done | P0 |
| F041 | Outstanding Tracking (aging buckets) | `/outstanding` | Real | Done | P0 |
| F042 | Payment Reminders (WhatsApp/SMS/push) | — (backend only) | — | Needs Credentials | P1 |
| F043 | Discount During Payment | — (in payment form) | — | Done | P2 |

## Phase 1F: Basic Inventory

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F044 | Products CRUD (name, price, unit, category) | `/products`, `/products/:id`, `/products/new`, `/products/:id/edit` | Real, Real, **Stub**, Real | Done | P0 |
| F045 | Stock In/Out (auto on invoice, manual adjust) | — (backend only) | — | Done | P0 |
| F046 | Stock Validation (block if stock < qty) | — (backend only) | — | Done | P0 |
| F047 | Low-Stock Alerts | — (dashboard + backend) | — | Done | P1 |
| F048 | Item Categories & Units (unit conversion) | `/settings/units` | Real | Done | P0 |
| F049 | Item Custom Fields | — (backend only) | — | Done | P2 |

## Phase 1G: Dashboard & Reports

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F050 | Dashboard (sales, outstanding, quick actions) | `/dashboard` | Real | Done | P0 |
| F051 | Sale/Purchase Reports (filterable, exportable) | `/reports/sales`, `/reports/purchases` | Real, Real | Done | P1 |
| F052 | Party Statements (per-party history) | `/reports/party-statement/:partyId` | Real | Done | P1 |
| F053 | Stock Summary Report | `/reports/stock-summary` | Real | Done | P1 |
| F054 | Day Book (all transactions for a day) | `/reports/day-book` | Real | Done | P1 |
| F055 | Payment History Report | `/reports/payment-history` | Real | Done | P1 |

## Phase 1H: Settings & Security

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F056 | Custom User Roles/Permissions | `/settings/roles`, `/settings/roles/:id`, `/settings/roles/new`, `/settings/staff`, `/settings/permissions` | Real, Real, Real, Real, Real | Done | P0 |
| F057 | Transaction Edit/Delete Controls | `/settings/transaction-controls` | **Stub** | Done | P1 |
| F058 | Passcode / PIN Protection | `/settings/pin-setup` | Real | Done | P1 |
| F059 | Biometric Auth | — (backend + hook) | — | Done | P1 |
| F060 | Date Format Customization | — (in UserAppSettings) | — | Done | P2 |
| F061 | Keyboard Shortcuts for Billing | `/settings/shortcuts` | **Stub** | Done | P2 |
| F062 | Built-in Calculator | — (global FAB overlay) | — | Done | P2 |

## Phase 1I: Security Hardening

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F063 | CSRF Middleware + Cookie Parser | — (middleware) | — | Done | P0 |
| F064 | Account Lockout (5 failed, 15min lock) | — (backend) | — | Done | P0 |
| F065 | Redis-backed Rate Limiter | — (middleware) | — | Done | P0 |
| F066 | httpOnly Cookie Tokens | — (backend) | — | Done | P0 |
| F067 | CAPTCHA on Login (after 3 failures) | — (in LoginPage) | — | Done | P1 |
| F068 | Suspicious Pattern Logging | — (backend) | — | Done | P1 |
| F069 | Request Signing / Replay Protection | — (middleware) | — | Done | P2 |
| F070 | Security Headers Hardening | — (middleware) | — | Done | P1 |

## Phase 2: GST & Compliance

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F071 | GST Invoice Engine (CGST/SGST/IGST auto-calc) | — (in invoice form) | — | Done | P0 |
| F072 | Tax Categories / Tax Groups | `/settings/tax-rates`, `/settings/tax-rates/:id`, `/settings/tax-rates/new` | Real, Real, **Stub** | Done | P0 |
| F073 | Place of Supply | — (in invoice form) | — | Done | P0 |
| F074 | GSTR-1 Export (JSON for filing) | `/reports/gst-returns` | Real | Done | P1 |
| F075 | GSTR-1 Auto-Reconciliation | `/gst/reconciliation`, `/gst/reconciliation/:id` | Real, Real | Done | P1 |
| F076 | GSTR-3B Report | — (in GstReturnsPage) | — | Done | P1 |
| F077 | GSTR-9 Annual Return | — (in GstReturnsPage) | — | Done | P1 |
| F078 | Tax Summary + HSN Summary + Tax Ledger | `/reports/tax-summary` | Real | Done | P1 |
| F079 | E-Invoicing (IRN generation, QR code) | — (in InvoiceDetailPage) | — | Done | P0 |
| F080 | E-Way Bill (auto-generate, transport) | — (in InvoiceDetailPage) | — | Done | P0 |
| F081 | Reverse Charge Mechanism | — (in invoice form) | — | Done | P1 |
| F082 | Composite Scheme Support | — (backend service) | — | Done | P1 |
| F083 | Additional Cess | — (in line items) | — | Done | P1 |
| F084 | HSN Auto-fill | — (in product/invoice form) | — | Done | P2 |
| F085 | TDS/TCS Support | `/reports/tds-tcs` | Real | Done | P1 |
| F086 | GSTIN Verification | — (backend API) | — | Done | P1 |
| F087 | Tax Reports | `/reports/tax-summary`, `/reports/gst-returns` | Real, Real | Done | P1 |
| F088 | Credit Notes / Debit Notes | — (in document service) | — | Done | P0 |
| F089 | Multi-currency Support | `/settings/currency` | Real | Done | P2 |
| F090 | Recurring Invoices | `/recurring` | Real | Done | P2 |

## Phase 3: Accounting & Finance

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F091 | Chart of Accounts | `/accounting/chart-of-accounts` | Real | Done | P1 |
| F092 | Journal Entries | `/accounting/journal-entries` | Real | Done | P1 |
| F093 | Trial Balance | `/reports/trial-balance` | Real | Done | P1 |
| F094 | Profit & Loss | `/reports/profit-loss` | Real | Done | P1 |
| F095 | Balance Sheet | `/reports/balance-sheet` | Real | Done | P1 |
| F096 | Cash Flow Statement | `/reports/cash-flow` | Real | Done | P1 |
| F097 | Bank Accounts | `/bank-accounts` | Real | Done | P1 |
| F098 | Expenses | `/expenses` | Real | Done | P1 |
| F099 | Other Income | `/other-income` | Real | Done | P1 |
| F100 | Cheque Management | `/cheques` | Real | Done | P1 |
| F101 | Loans | `/loans`, `/loans/:id` | Real, Real | Done | P1 |
| F102 | Aging Report | `/reports/aging` | Real | Done | P1 |
| F103 | Profitability Report | `/reports/profitability` | Real | Done | P1 |
| F104 | Discount Report | `/reports/discounts` | Real | Done | P1 |
| F105 | Tally Export | `/accounting/tally-export` | Real | Done | P1 |
| F106 | FY Closure | `/accounting/fy-closure` | Real | Done | P1 |

## Phase 4: Advanced Inventory & POS

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F107 | Barcode Generation | — (in ProductDetail) | — | Done | P1 |
| F108 | Barcode Scanning | — (BarcodeScanner component) | — | Done | P1 |
| F109 | Batch Tracking | `/products/:id/batches`, `/products/:id/batches/new`, `/batches/:id` | Real, **Stub**, Real | Done | P1 |
| F110 | Serial Number Tracking | `/products/:id/serials`, `/products/:id/serials/new`, `/products/:id/serials/bulk`, `/serial-lookup` | Real, **Stub**, **Stub**, Real | Done | P2 |
| F111 | Multi-Godown (Warehouse) | `/godowns`, `/godowns/:id`, `/godowns/:id/edit`, `/godowns/new`, `/godowns/transfer` | Real, Real, Real, **Stub**, **Stub** | Done | P1 |
| F112 | Stock Adjustment (Advanced) | — (StockAdjustModal) | — | Done | P1 |
| F113 | Label Printing | — (backend + FE component) | — | Done | P2 |
| F114 | Bulk Import/Export (Products) | — (backend endpoints) | — | Done | P1 |
| F115 | Expiry Alerts | — (backend endpoint) | — | Done | P1 |
| F116 | Reorder Points | — (backend endpoint) | — | Done | P1 |
| F117 | Item Conversion (BOM) | — (backend endpoint) | — | Done | P2 |
| F118 | Item Images | — (in ProductDetail) | — | Done | P2 |
| F119 | MOQ (Min Order Qty) | — (backend validation) | — | Done | P3 |
| F120 | POS Billing Mode | `/pos` | **Stub** | Done | P1 |
| F121 | Stock Verification | `/stock-verification`, `/stock-verification/:id` | Real, Real | Done | P2 |
| F122 | Party Ledger (shared) | `/public/ledger/:token` | **Stub** | Done | P1 |

## Phase 5: Growth & Competitive Features

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F123 | GST Autofill (GSTIN → party details) | — (in party form) | — | Done | P1 |
| F124 | Bulk Add Parties from Contacts | `/parties/import` | Real | Done | P2 |
| F125 | Shared Ledgers | `/public/ledger/:token` | **Stub** | Done | P2 |
| F126 | Bill Scanning (OCR → Items) | `/bill-scan` | Real | Done | P1 |
| F127 | Items Library (100K+ database) | `/products/library` | Real | Done | P2 |
| F128 | Competitor Data Import | `/settings/import` | Real | Done | P3 |
| F129 | Smart Greetings (WhatsApp templates) | `/greetings` | Real | Done | P3 |
| F130 | Categorized Feature Discovery ("For You") | `/more` | **Stub** | Done | P3 |

## Phase 6: BillBook User Requests

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F131 | Custom Units (Bags, Cans, Hours) | `/settings/units` | Real | Done | P0 |
| F132 | Payment Status Stamps on Invoice PDF | — (in preview component) | — | Done | P1 |
| F133 | Vehicle Number & Udyam on Invoice | — (in invoice form) | — | Done | P1 |
| F134 | PDF Quality Enhancement | — (in print settings) | — | Done | P1 |
| F135 | Duplicate Bill Copy Labels | — (in preview component) | — | Done | P2 |

## Phase 7: Planned

| ID | Feature | Page(s) | Page Status | Feature Status | Priority |
|----|---------|---------|-------------|----------------|----------|
| F136 | Coupon / Discount Code System | `/admin/coupons`, `/admin/coupons/:id` | Real, Real | Done | P2 |

---

## Standalone Pages (no dedicated feature)

| Page | Route | Status | Belongs To |
|------|-------|--------|------------|
| Landing | `/` | Real | Marketing |
| Join Business | `/join` | Real | F010 Onboarding |
| Reports Hub | `/reports` | Real | F050-F055 Reports |
| Settings Hub | `/settings` | Real | F056-F062 Settings |
| Staff Invite | `/settings/staff/invite` | **Stub** | F056 Roles |
| GST Settings | `/settings/gst` | **Stub** | F071 GST Engine |
| Audit Log | `/settings/audit-log` | Real | F007 Admin |
| Not Found (404) | `*` | **Stub** | — |

---

## Summary

| Metric | Count |
|--------|-------|
| **Total features** | 136 (F001–F136) |
| **Features done** | 136 |
| **Needs credentials** | 5 (F002, F004, F030, F032, F042) |
| **Total pages/routes** | 95 unique |
| **Pages real** | 80 |
| **Pages stub** | 15 |

## 15 Stub Pages (need full UI)

| # | Route | Feature | Priority |
|---|-------|---------|----------|
| 1 | `/products/new` | F044 Products CRUD | **P0** |
| 2 | `/products/:id/batches/new` | F109 Batch Tracking | P1 |
| 3 | `/products/:id/serials/new` | F110 Serial Numbers | P2 |
| 4 | `/products/:id/serials/bulk` | F110 Serial Numbers | P2 |
| 5 | `/godowns/new` | F111 Multi-Godown | P1 |
| 6 | `/godowns/transfer` | F111 Multi-Godown | P1 |
| 7 | `/pos` | F120 POS Billing | **P1** |
| 8 | `/public/ledger/:token` | F122/F125 Shared Ledger | P2 |
| 9 | `/settings/tax-rates/new` | F072 Tax Categories | P0 |
| 10 | `/settings/staff/invite` | F056 Roles | P0 |
| 11 | `/settings/gst` | F071 GST Engine | P1 |
| 12 | `/settings/shortcuts` | F061 Keyboard Shortcuts | P2 |
| 13 | `/settings/transaction-controls` | F057 Txn Controls | P1 |
| 14 | `/more` | F130 Feature Discovery | P3 |
| 15 | `*` (404 page) | — | P2 |

## Needs Credentials (code wired, set API keys to activate)

| Feature | What's needed |
|---------|--------------|
| F001 OTP Auth | MSG91 key + `VITE_AUTH_MODE=otp` |
| F002 Subscription | Razorpay API key + webhook secret |
| F004 Notifications | FCM + Aisensy + Resend API keys |
| F030 Invoice Sharing | Aisensy + Resend |
| F032 Email with PDF | Resend API key |
| F042 Payment Reminders | Aisensy + FCM |
| F059 Biometric Auth | Capacitor Biometric plugin |
