# Feature Map: HisaabPro

Last updated: 2026-03-16 | Total: 62 | Done: 45 | Needs Integration: 10 | Not Started: 7

> **Phase 1 MVP**: Frontend (33 routes, 221 files) + Backend (120+ endpoints, 47 Prisma models) fully built and wired. Remaining work: external integrations, deployment, and E2E testing.

---

## 1A. Core & Reused (from DudhHisaab)

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 1 | Auth (OTP, JWT, refresh, 2FA, WebAuthn) | Done | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | FE: LoginPage · BE: 5 routes (send-otp, verify-otp, refresh, logout, me) · Rate limited · Token blacklist |
| 2 | Subscription & Billing (Razorpay, tiers) | Needs Integration | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | Requires Razorpay API credentials |
| 3 | Referral & Earn (codes, wallet, UPI) | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 85% reuse from DudhHisaab |
| 4 | Notifications (push, email, WhatsApp, SMS) | Needs Integration | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | Stubs exist · Needs FCM, Aisensy, Resend credentials |
| 5 | Backup (local + Google Drive + email) | Done | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | BE: manual backup, list, download, cooldown · 90% reuse |
| 6 | Offline-first PWA (IndexedDB, sync, SW) | Done | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | SW registered · Dexie configured · Offline banner · Sync queue ready |
| 7 | Admin Panel Framework | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | 80% reuse from DudhHisaab |
| 8 | Dark Mode / Theming | Not Started | P1 | [core-reused](../PRDs/core-reused-PLAN.md) | CSS vars ready, toggle pending |
| 9 | Multi-language (EN/HI) | Not Started | P0 | [core-reused](../PRDs/core-reused-PLAN.md) | 90% reuse from DudhHisaab |
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
| 31 | Invoice Image Export (JPG/PNG) | Not Started | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | |
| 32 | Share via Email with PDF | Needs Integration | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE stub exists · Needs Resend credentials |
| 33 | Invoice Recycle Bin | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | BE: soft delete + /recycle-bin + restore + permanent delete + empty bin |
| 34 | Show Profit During Sale | Done | P1 | [invoicing-documents](../PRDs/invoicing-documents-PLAN.md) | DocumentSettings.showProfitDuringBilling · Profit in line items |

## 1D. Invoice Templates & Printing

| # | Feature | Status | Priority | PRD | Notes |
|---|---------|--------|----------|-----|-------|
| 35 | Invoice Templates (thermal, A4, A5, modern) | Done | P0 | [invoice-templates](../PRDs/invoice-templates-PLAN.md) | FE: TemplateGalleryPage, TemplateEditorPage · React-PDF client-side |
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

## Status Summary

| Status | Count | Details |
|--------|-------|---------|
| **Done** | 45 | FE + BE built and wired |
| **Needs Integration** | 10 | Code exists, needs external service credentials |
| **Not Started** | 7 | Referral, Admin Panel, Dark Mode, i18n, Invoice Image Export |

## Priority Summary

| Priority | Total | Done | Needs Integration | Not Started |
|----------|-------|------|-------------------|-------------|
| P0 | 28 | 22 | 5 | 1 |
| P1 | 24 | 17 | 4 | 3 |
| P2 | 10 | 6 | 1 | 3 |

## Needs Integration (external credentials required)

| # | Feature | What's needed |
|---|---------|--------------|
| 2 | Subscription & Billing | Razorpay API key + webhook secret |
| 4 | Notifications | FCM server key + Aisensy API key + Resend API key |
| 30 | Auto Invoice Sharing | Aisensy (WhatsApp) + Resend (email) |
| 32 | Share via Email with PDF | Resend API key |
| 42 | Payment Reminders | Aisensy + FCM credentials |
| 47 | Low-Stock Alerts | Notification integration (depends on #4) |
| 59 | Biometric Auth | Capacitor Biometric plugin |

## Not Started (code work required)

| # | Feature | Effort | Reuse |
|---|---------|--------|-------|
| 3 | Referral & Earn | Medium | 85% DudhHisaab |
| 7 | Admin Panel Framework | Medium | 80% DudhHisaab |
| 8 | Dark Mode / Theming | Small | CSS vars ready |
| 9 | Multi-language (EN/HI) | Medium | 90% DudhHisaab |
| 31 | Invoice Image Export | Small | Client-side canvas |

## Architecture

```
Frontend (React 19 + Vite)          Backend (Express + Prisma)
─────────────────────────           ──────────────────────────
33 routes · 221 source files        120+ endpoints · 16 route modules
Tailwind CSS 4                      47 Prisma models · PostgreSQL
React-PDF (client-side)             JWT auth · Rate limiting
Dexie (IndexedDB)                   Idempotency · Audit log
Service Worker                      Business isolation (multi-tenant)
```

## Next Steps

1. **Run E2E** — Start both servers, walk through every screen with real data
2. **External integrations** — Razorpay, Aisensy, FCM, Resend
3. **Remaining features** — Dark mode, i18n, referral, admin panel
4. **Deploy** — Vercel (FE) + Render (BE) + production PostgreSQL
5. **Testing** — Playwright E2E on all viewports
