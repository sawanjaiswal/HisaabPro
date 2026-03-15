# Feature Map: HisaabPro

Last updated: 2026-03-15 | Total: 62 | Done: 0 | In Progress: 0 | Not Started: 62

---

## 1A. Core & Reused (from DudhHisaab)

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 1 | Auth (OTP, JWT, refresh, 2FA, WebAuthn) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 95% reuse |
| 2 | Subscription & Billing (Razorpay, tiers) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 85% reuse |
| 3 | Referral & Earn (codes, wallet, UPI) | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 85% reuse |
| 4 | Notifications (push, email, WhatsApp, SMS) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 85% reuse |
| 5 | Backup (local + Google Drive + email) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 90% reuse |
| 6 | Offline-first PWA (IndexedDB, sync, SW) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 90% reuse |
| 7 | Admin Panel Framework | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 80% reuse |
| 8 | Dark Mode / Theming | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 95% reuse |
| 9 | Multi-language (EN/HI) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 90% reuse |
| 10 | Onboarding Flow (business setup wizard) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | Must include opening balances |

## 1B. Party Management

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 11 | Party CRUD (customers + suppliers, groups, contact import) | Not Started | P0 | [party-management](../PRDs/party-management-PLAN.md) | |
| 12 | Party Balances & Statements | Not Started | P0 | [party-management](../PRDs/party-management-PLAN.md) | |
| 13 | Multiple Addresses per Party | Not Started | P0 | [party-management](../PRDs/party-management-PLAN.md) | Required for invoicing |
| 14 | Party Credit Limits | Not Started | P1 | [party-management](../PRDs/party-management-PLAN.md) | |
| 15 | Party Custom Fields | Not Started | P2 | [party-management](../PRDs/party-management-PLAN.md) | |
| 16 | Party-wise Pricing | Not Started | P1 | [party-management](../PRDs/party-management-PLAN.md) | #1 MyBillBook gap |
| 17 | Opening Balances (migration) | Not Started | P0 | [party-management](../PRDs/party-management-PLAN.md) | CRITICAL for adoption |

## 1C. Invoicing & Documents

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 18 | Sale Invoice (non-GST, line items, discounts) | Not Started | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Core billing |
| 19 | Purchase Invoice | Not Started | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 20 | Estimates / Quotations | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 21 | Proforma Invoices | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 22 | Purchase Orders | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 23 | Sale Orders | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 24 | Delivery Challans | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 25 | Invoice Numbering (auto-increment, prefix) | Not Started | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 26 | Additional Charges (shipping, freight) | Not Started | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 27 | Due Dates (payment terms: 15/30/60 days) | Not Started | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 28 | Terms & Conditions on Invoice | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 29 | Digital Signature Block | Not Started | P2 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 30 | Auto Invoice Sharing (WhatsApp/email) | Not Started | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 31 | Invoice Image Export (JPG/PNG) | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 32 | Share via Email with PDF | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 33 | Invoice Recycle Bin | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 34 | Show Profit During Sale | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Vyapar power feature |

## 1D. Invoice Templates & Printing

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 35 | Invoice Templates (thermal, A4, A5, modern) | Not Started | P0 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | |
| 36 | Template Customization (fonts, colors, columns) | Not Started | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | |
| 37 | Print Settings (page size, margins) | Not Started | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | |
| 38 | Round-off Settings | Not Started | P0 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | |
| 39 | Decimal Precision Settings | Not Started | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | |

## 1E. Payment Tracking

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 40 | Payment In/Out (cash, UPI, bank, cheque) | Not Started | P0 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | |
| 41 | Outstanding Tracking (aging buckets) | Not Started | P0 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | |
| 42 | Payment Reminders (WhatsApp/SMS/push) | Not Started | P1 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | |
| 43 | Discount During Payment | Not Started | P2 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | |

## 1F. Basic Inventory

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 44 | Products CRUD (name, price, unit, category) | Not Started | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | |
| 45 | Stock In/Out (auto on invoice, manual adjust) | Not Started | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | |
| 46 | Stock Validation (block if stock < qty) | Not Started | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | Competitor gap |
| 47 | Low-Stock Alerts | Not Started | P1 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | |
| 48 | Item Categories & Units (unit conversion) | Not Started | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | |
| 49 | Item Custom Fields | Not Started | P2 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | |

## 1G. Dashboard & Reports

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 50 | Dashboard (sales, outstanding, quick actions) | Not Started | P0 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | |
| 51 | Sale/Purchase Reports (filterable, exportable) | Not Started | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | |
| 52 | Party Statements (per-party history) | Not Started | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | |
| 53 | Stock Summary Report | Not Started | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | |
| 54 | Day Book (all transactions for a day) | Not Started | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | |
| 55 | Payment History Report | Not Started | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | |

## 1H. Settings & Security

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 56 | Custom User Roles/Permissions | Not Started | P0 | [settings-security](../PRDs/settings-security-PLAN.md) | #1 Vyapar complaint |
| 57 | Transaction Edit/Delete Controls | Not Started | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | |
| 58 | Passcode / PIN Protection | Not Started | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | |
| 59 | Biometric Auth | Not Started | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | |
| 60 | Date Format Customization | Not Started | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | |
| 61 | Keyboard Shortcuts for Billing | Not Started | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | |
| 62 | Built-in Calculator | Not Started | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | |

---

## Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0 | 28 | Must launch — app is broken without these |
| P1 | 24 | Should launch — competitive parity |
| P2 | 10 | Post-launch polish |

## Build Order

1. Core (1A) → 2. Party (1B) → 3. Inventory (1F) → 4. Invoicing (1C) → 5. Templates (1D) → 6. Payments (1E) → 7. Dashboard (1G) → 8. Settings (1H)
