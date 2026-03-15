# Feature Map: HisaabPro

Last updated: 2026-03-15 | Total: 62 | Done: 0 | In Progress: 62 | Not Started: 0

> **Phase 1 MVP**: All 62 features have frontend pages built (33 routes, 221 source files). Backend API pending.

---

## 1A. Core & Reused (from DudhHisaab)

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 1 | Auth (OTP, JWT, refresh, 2FA, WebAuthn) | In Progress | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | Frontend: LoginPage done. Backend: pending |
| 2 | Subscription & Billing (Razorpay, tiers) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 85% reuse, no page yet |
| 3 | Referral & Earn (codes, wallet, UPI) | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 85% reuse, no page yet |
| 4 | Notifications (push, email, WhatsApp, SMS) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 85% reuse |
| 5 | Backup (local + Google Drive + email) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 90% reuse |
| 6 | Offline-first PWA (IndexedDB, sync, SW) | In Progress | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | SW registered, IndexedDB pending |
| 7 | Admin Panel Framework | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 80% reuse |
| 8 | Dark Mode / Theming | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | CSS vars ready, toggle pending |
| 9 | Multi-language (EN/HI) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 90% reuse |
| 10 | Onboarding Flow (business setup wizard) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | Must include opening balances |

## 1B. Party Management

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 11 | Party CRUD (customers + suppliers, groups, contact import) | In Progress | P0 | [party-management](../PRDs/party-management-PLAN.md) | Frontend: PartiesPage, CreatePartyPage, PartyDetailPage |
| 12 | Party Balances & Statements | In Progress | P0 | [party-management](../PRDs/party-management-PLAN.md) | Frontend: PartyStatementPage |
| 13 | Multiple Addresses per Party | In Progress | P0 | [party-management](../PRDs/party-management-PLAN.md) | In CreatePartyPage form |
| 14 | Party Credit Limits | In Progress | P1 | [party-management](../PRDs/party-management-PLAN.md) | In CreatePartyPage form |
| 15 | Party Custom Fields | Not Started | P2 | [party-management](../PRDs/party-management-PLAN.md) | |
| 16 | Party-wise Pricing | Not Started | P1 | [party-management](../PRDs/party-management-PLAN.md) | #1 MyBillBook gap |
| 17 | Opening Balances (migration) | In Progress | P0 | [party-management](../PRDs/party-management-PLAN.md) | In CreatePartyPage form |

## 1C. Invoicing & Documents

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 18 | Sale Invoice (non-GST, line items, discounts) | In Progress | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Frontend: CreateInvoicePage, InvoiceDetailPage |
| 19 | Purchase Invoice | In Progress | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Shares pages with sale invoice (type toggle) |
| 20 | Estimates / Quotations | In Progress | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Shares invoice components |
| 21 | Proforma Invoices | In Progress | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Shares invoice components |
| 22 | Purchase Orders | In Progress | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Shares invoice components |
| 23 | Sale Orders | In Progress | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Shares invoice components |
| 24 | Delivery Challans | In Progress | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Shares invoice components |
| 25 | Invoice Numbering (auto-increment, prefix) | In Progress | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | In CreateInvoicePage |
| 26 | Additional Charges (shipping, freight) | In Progress | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | In CreateInvoicePage |
| 27 | Due Dates (payment terms: 15/30/60 days) | In Progress | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | In CreateInvoicePage |
| 28 | Terms & Conditions on Invoice | In Progress | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | In CreateInvoicePage |
| 29 | Digital Signature Block | Not Started | P2 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 30 | Auto Invoice Sharing (WhatsApp/email) | Not Started | P0 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Needs backend |
| 31 | Invoice Image Export (JPG/PNG) | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 32 | Share via Email with PDF | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 33 | Invoice Recycle Bin | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 34 | Show Profit During Sale | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | Vyapar power feature |

## 1D. Invoice Templates & Printing

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 35 | Invoice Templates (thermal, A4, A5, modern) | In Progress | P0 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | Frontend: TemplateGalleryPage, TemplateEditorPage |
| 36 | Template Customization (fonts, colors, columns) | In Progress | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | In TemplateEditorPage |
| 37 | Print Settings (page size, margins) | In Progress | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | In TemplateEditorPage |
| 38 | Round-off Settings | Not Started | P0 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | |
| 39 | Decimal Precision Settings | Not Started | P1 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | |

## 1E. Payment Tracking

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 40 | Payment In/Out (cash, UPI, bank, cheque) | In Progress | P0 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | Frontend: PaymentsPage, RecordPaymentPage, PaymentDetailPage |
| 41 | Outstanding Tracking (aging buckets) | In Progress | P0 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | Frontend: OutstandingPage |
| 42 | Payment Reminders (WhatsApp/SMS/push) | Not Started | P1 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | Needs backend |
| 43 | Discount During Payment | Not Started | P2 | [payment-tracking](../PRDs/payment-tracking-PLAN.md) | |

## 1F. Basic Inventory

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 44 | Products CRUD (name, price, unit, category) | In Progress | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | Frontend: ProductsPage, CreateProductPage, ProductDetailPage |
| 45 | Stock In/Out (auto on invoice, manual adjust) | In Progress | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | In ProductDetailPage |
| 46 | Stock Validation (block if stock < qty) | Not Started | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | Backend logic needed |
| 47 | Low-Stock Alerts | Not Started | P1 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | Backend + notifications |
| 48 | Item Categories & Units (unit conversion) | In Progress | P0 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | In CreateProductPage |
| 49 | Item Custom Fields | Not Started | P2 | [basic-inventory](../PRDs/basic-inventory-PLAN.md) | |

## 1G. Dashboard & Reports

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 50 | Dashboard (sales, outstanding, quick actions) | In Progress | P0 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | Frontend: DashboardPage |
| 51 | Sale/Purchase Reports (filterable, exportable) | In Progress | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | Frontend: InvoiceReportPage |
| 52 | Party Statements (per-party history) | In Progress | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | Frontend: PartyStatementPage |
| 53 | Stock Summary Report | In Progress | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | Frontend: StockSummaryPage |
| 54 | Day Book (all transactions for a day) | In Progress | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | Frontend: DayBookPage |
| 55 | Payment History Report | In Progress | P1 | [dashboard-reports](../PRDs/dashboard-reports-PLAN.md) | Frontend: PaymentHistoryPage |

## 1H. Settings & Security

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 56 | Custom User Roles/Permissions | In Progress | P0 | [settings-security](../PRDs/settings-security-PLAN.md) | Frontend: RolesPage, RoleBuilderPage |
| 57 | Transaction Edit/Delete Controls | In Progress | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | Frontend: TransactionControlsPage |
| 58 | Passcode / PIN Protection | In Progress | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | Frontend: PinSetupPage |
| 59 | Biometric Auth | Not Started | P1 | [settings-security](../PRDs/settings-security-PLAN.md) | Capacitor plugin needed |
| 60 | Date Format Customization | Not Started | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | |
| 61 | Keyboard Shortcuts for Billing | In Progress | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | Frontend: ShortcutsPage |
| 62 | Built-in Calculator | In Progress | P2 | [settings-security](../PRDs/settings-security-PLAN.md) | Frontend: CalculatorOverlay (global) |

---

## Priority Summary

| Priority | Count | In Progress | Not Started |
|----------|-------|-------------|-------------|
| P0 | 28 | 18 | 10 |
| P1 | 24 | 14 | 10 |
| P2 | 10 | 3 | 7 |

## Build Order

1. ~~Core (1A)~~ → partial (auth frontend done)
2. ~~Party (1B)~~ → frontend done
3. ~~Inventory (1F)~~ → frontend done
4. ~~Invoicing (1C)~~ → frontend done
5. ~~Templates (1D)~~ → frontend done
6. ~~Payments (1E)~~ → frontend done
7. ~~Dashboard (1G)~~ → frontend done
8. ~~Settings (1H)~~ → frontend done

**Next**: Backend API (Express + Prisma) → wire all frontend pages to real data
