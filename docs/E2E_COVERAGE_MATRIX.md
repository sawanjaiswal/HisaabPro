# E2E Coverage Matrix — GENERATED, do not hand-edit

> Regenerate: `node scripts/e2e-coverage.mjs --matrix`
> Gate: `node scripts/e2e-coverage.mjs` (exit 1 if any module is unmapped)
>
> Every FE route and every API endpoint in the codebase appears below,
> mapped to the suite in `docs/E2E_TEST_PLAN.md` that tests it.

| | Count |
|---|---|
| FE routes | 202 |
| API endpoints | 589 |
| Modules | 402 |

---

## Frontend routes

| Module | Suite | Route | Key |
|---|---|---|---|
| accounting/chart-of-accounts | TC-ACC | `/accounting/chart-of-accounts` | CHART_OF_ACCOUNTS |
| accounting/fy-closure | TC-ACC | `/accounting/fy-closure` | FY_CLOSURE |
| accounting/journal-entries | TC-ACC | `/accounting/journal-entries` | JOURNAL_ENTRIES |
| accounting/tally-export | TC-ACC | `/accounting/tally-export` | TALLY_EXPORT |
| admin/coupons | TC-BIL | `/admin/coupons` | ADMIN_COUPONS |
| admin/coupons | TC-BIL | `/admin/coupons/:id` | ADMIN_COUPON_DETAIL |
| appointments | TC-APT | `/appointments` | APPOINTMENTS |
| appointments | TC-APT | `/appointments/:id` | APPOINTMENT_DETAIL |
| bank-accounts | TC-BNK | `/bank-accounts` | BANK_ACCOUNTS |
| bank-reconciliation | TC-BNK | `/bank-reconciliation` | BANK_RECONCILIATION |
| batches | TC-BAT | `/batches/:id` | BATCH_DETAIL |
| bill-scan | TC-SCN | `/bill-scan` | BILL_SCAN |
| bom | TC-BOM | `/bom` | BOM |
| bom | TC-BOM | `/bom/:id` | BOM_DETAIL |
| bom | TC-BOM | `/bom/:id/edit` | BOM_EDIT |
| bom | TC-BOM | `/bom/new` | BOM_NEW |
| business | TC-BIZ | `/business/create` | CREATE_BUSINESS |
| business | TC-BIZ | `/business/type` | BUSINESS_TYPE |
| cash-register | TC-CASH | `/cash-register` | CASH_REGISTER |
| cheques | TC-PAY | `/cheques` | CHEQUES |
| collections | TC-COLL | `/collections` | COLLECTIONS |
| collections | TC-COLL | `/collections/bucket/:bucket` | COLLECTIONS_BUCKET |
| commission/leaderboard | TC-COM | `/commission/leaderboard` | COMMISSION_LEADERBOARD |
| commission/ledger | TC-COM | `/commission/ledger` | COMMISSION_LEDGER |
| crm/follow-ups | TC-CRM | `/crm/follow-ups` | CRM_FOLLOWUPS |
| dashboard | TC-DASH | `/dashboard` | DASHBOARD |
| expenses | TC-EXP | `/expenses` | EXPENSES |
| expenses | TC-EXP | `/expenses/:id` | EXPENSE_DETAIL |
| expenses | TC-EXP | `/expenses/categories` | EXPENSE_CATEGORIES |
| forgot-password | TC-AUTH | `/forgot-password` | FORGOT_PASSWORD |
| godowns | TC-GDN | `/godowns` | GODOWNS |
| godowns | TC-GDN | `/godowns/:id` | GODOWN_DETAIL |
| godowns | TC-GDN | `/godowns/:id/edit` | GODOWN_EDIT |
| godowns | TC-GDN | `/godowns/new` | GODOWN_NEW |
| godowns | TC-GDN | `/godowns/transfer` | GODOWN_TRANSFER |
| greetings | TC-MKT | `/greetings` | SMART_GREETINGS |
| gst/backfill | TC-GST | `/gst/backfill` | GST_BACKFILL |
| gst/filing-readiness | TC-GST | `/gst/filing-readiness` | GST_FILING_READINESS |
| gst/reconciliation | TC-GST | `/gst/reconciliation` | GST_RECONCILIATION |
| gst/reconciliation | TC-GST | `/gst/reconciliation/:id` | GST_RECONCILIATION_DETAIL |
| gst/returns | TC-GST | `/gst/returns/gstr1` | GST_GSTR1 |
| gst/returns | TC-GST | `/gst/returns/gstr3b` | GST_GSTR3B |
| hr/attendance | TC-HR | `/hr/attendance` | HR_ATTENDANCE |
| hr/employees | TC-HR | `/hr/employees` | HR_EMPLOYEES |
| hr/employees | TC-HR | `/hr/employees/:id` | HR_EMPLOYEE_DETAIL |
| hr/payroll | TC-HR | `/hr/payroll` | HR_PAYROLL |
| hr/payroll | TC-HR | `/hr/payroll/:id` | HR_PAYROLL_DETAIL |
| hr/payroll | TC-HR | `/hr/payroll/:runId/payslip/:payrollId` | PAYSLIP |
| hr/payroll | TC-HR | `/hr/payroll/new` | HR_PAYROLL_NEW |
| imports | TC-IMP | `/imports` | IMPORTS |
| imports | TC-IMP | `/imports/:jobId` | IMPORT_JOB_DETAIL |
| insights | TC-INS | `/insights` | INSIGHTS |
| inventory/alerts | TC-ROR | `/inventory/alerts` | INVENTORY_ALERTS |
| inventory/reorder-suggestions | TC-ROR | `/inventory/reorder-suggestions` | REORDER_SUGGESTIONS |
| inventory/verify | TC-SV | `/inventory/verify` | INVENTORY_VERIFY |
| inventory/verify | TC-SV | `/inventory/verify/:id` | INVENTORY_VERIFY_RUN |
| invoices | TC-INV | `/invoices` | INVOICES |
| invoices | TC-INV | `/invoices/:id` | INVOICE_DETAIL |
| invoices | TC-INV | `/invoices/:id/edit` | INVOICE_EDIT |
| invoices | TC-INV | `/invoices/drafts` | INVOICE_DRAFTS |
| invoices | TC-INV | `/invoices/new` | INVOICE_CREATE |
| jobs | TC-JOB | `/jobs` | JOBS |
| jobs | TC-JOB | `/jobs/:id` | JOB_DETAIL |
| jobs | TC-JOB | `/jobs/:id/edit` | JOB_EDIT |
| jobs | TC-JOB | `/jobs/new` | JOB_NEW |
| join | TC-BIZ | `/join` | JOIN_BUSINESS |
| landing | TC-PUB | `/` | HOME |
| loans | TC-LON | `/loans` | LOANS |
| loans | TC-LON | `/loans/:id` | LOAN_DETAIL |
| login | TC-AUTH | `/login` | LOGIN |
| marketing | TC-MKT | `/marketing` | MARKETING_HUB |
| marketing/campaigns | TC-MKT | `/marketing/campaigns` | MARKETING_CAMPAIGNS |
| marketing/campaigns | TC-MKT | `/marketing/campaigns/:id` | MARKETING_CAMPAIGN_DETAIL |
| marketing/campaigns | TC-MKT | `/marketing/campaigns/new` | MARKETING_CAMPAIGN_NEW |
| marketing/opt-outs | TC-MKT | `/marketing/opt-outs` | MARKETING_OPT_OUTS |
| marketing/reminders | TC-MKT | `/marketing/reminders` | MARKETING_REMINDERS |
| marketing/reminders | TC-MKT | `/marketing/reminders/:id` | MARKETING_REMINDER_EDIT |
| marketing/reminders | TC-MKT | `/marketing/reminders/new` | MARKETING_REMINDER_NEW |
| marketing/templates | TC-MKT | `/marketing/templates` | MARKETING_TEMPLATES |
| marketing/templates | TC-MKT | `/marketing/templates/:id` | MARKETING_TEMPLATE_EDIT |
| marketing/templates | TC-MKT | `/marketing/templates/new` | MARKETING_TEMPLATE_NEW |
| more | TC-NAV | `/more` | MORE |
| notifications | TC-NOT | `/notifications` | NOTIFICATIONS |
| notifications/preferences | TC-NOT | `/notifications/preferences` | NOTIFICATION_PREFERENCES |
| onboarding | TC-ONB | `/onboarding` | ONBOARDING |
| orders | TC-ORD | `/orders` | ORDERS |
| orders | TC-ORD | `/orders/:id` | ORDER_DETAIL |
| orders | TC-ORD | `/orders/:id/edit` | ORDER_EDIT |
| orders | TC-ORD | `/orders/new` | ORDER_NEW |
| other-income | TC-INC | `/other-income` | OTHER_INCOME |
| outstanding | TC-PAY | `/outstanding` | OUTSTANDING |
| parties | TC-PTY | `/parties` | PARTIES |
| parties | TC-PTY | `/parties/:id` | PARTY_DETAIL |
| parties | TC-PTY | `/parties/:id/edit` | PARTY_EDIT |
| parties | TC-PTY | `/parties/import` | BULK_IMPORT_PARTIES |
| parties | TC-PTY | `/parties/new` | PARTY_NEW |
| payments | TC-PAY | `/payments` | PAYMENTS |
| payments | TC-PAY | `/payments/:id` | PAYMENT_DETAIL |
| payments | TC-PAY | `/payments/:id/edit` | PAYMENT_EDIT |
| payments | TC-PAY | `/payments/new` | PAYMENT_NEW |
| pos | TC-POS | `/pos` | POS |
| pos | TC-POS | `/pos/history` | POS_HISTORY |
| pos | TC-POS | `/pos/sales/:id` | POS_SALE_DETAIL |
| pricing | TC-PUB | `/pricing` | PRICING |
| production-runs | TC-BOM | `/production-runs` | PRODUCTION_RUNS |
| production-runs | TC-BOM | `/production-runs/:id` | PRODUCTION_RUN_DETAIL |
| production-runs | TC-BOM | `/production-runs/new` | PRODUCTION_RUN_NEW |
| products | TC-PRD | `/products` | PRODUCTS |
| products | TC-PRD | `/products/:id` | PRODUCT_DETAIL |
| products | TC-PRD | `/products/:id/edit` | PRODUCT_EDIT |
| products | TC-PRD | `/products/:productId/batches` | BATCHES |
| products | TC-PRD | `/products/:productId/batches/new` | BATCH_NEW |
| products | TC-PRD | `/products/:productId/serials` | SERIAL_NUMBERS |
| products | TC-PRD | `/products/:productId/serials/bulk` | SERIAL_BULK |
| products | TC-PRD | `/products/:productId/serials/new` | SERIAL_NEW |
| products | TC-PRD | `/products/adjustments` | STOCK_ADJUSTMENTS |
| products | TC-PRD | `/products/categories` | PRODUCT_CATEGORIES |
| products | TC-PRD | `/products/library` | ITEMS_LIBRARY |
| products | TC-PRD | `/products/new` | PRODUCT_NEW |
| public/ledger | TC-PUB | `/public/ledger/:token` | PUBLIC_LEDGER |
| purchases | TC-PUR | `/purchases` | PURCHASES |
| purchases | TC-PUR | `/purchases/:id` | PURCHASE_DETAIL |
| purchases | TC-PUR | `/purchases/:id/edit` | PURCHASE_EDIT |
| purchases | TC-PUR | `/purchases/new` | PURCHASE_NEW |
| purchases | TC-PUR | `/purchases/returns` | PURCHASE_RETURNS |
| recipe-cost | TC-BOM | `/recipe-cost` | RECIPE_COST |
| recurring | TC-REC | `/recurring` | RECURRING |
| recurring | TC-REC | `/recurring/:id` | RECURRING_DETAIL |
| recurring | TC-REC | `/recurring/:id/edit` | RECURRING_EDIT |
| recurring | TC-REC | `/recurring/new` | RECURRING_NEW |
| register | TC-REG | `/register` | REGISTER |
| reports | TC-RPT | `/reports` | REPORTS |
| reports/aging | TC-PAY | `/reports/aging` | REPORT_AGING |
| reports/balance-sheet | TC-RPT | `/reports/balance-sheet` | REPORT_BALANCE_SHEET |
| reports/cash-flow | TC-RPT | `/reports/cash-flow` | REPORT_CASH_FLOW |
| reports/day-book | TC-RPT | `/reports/day-book` | REPORT_DAY_BOOK |
| reports/discounts | TC-RPT | `/reports/discounts` | REPORT_DISCOUNTS |
| reports/gst-returns | TC-GST | `/reports/gst-returns` | REPORT_GST_RETURNS |
| reports/party-statement | TC-RPT | `/reports/party-statement/:partyId` | REPORT_PARTY_STATEMENT |
| reports/payment-history | TC-PAY | `/reports/payment-history` | REPORT_PAYMENT_HISTORY |
| reports/profit-loss | TC-RPT | `/reports/profit-loss` | REPORT_PROFIT_LOSS |
| reports/profitability | TC-RPT | `/reports/profitability` | REPORT_PROFITABILITY |
| reports/purchases | TC-RPT | `/reports/purchases` | REPORT_PURCHASES |
| reports/sales | TC-RPT | `/reports/sales` | REPORT_SALES |
| reports/stock-summary | TC-RPT | `/reports/stock-summary` | REPORT_STOCK_SUMMARY |
| reports/stock-value | TC-RPT | `/reports/stock-value` | STOCK_VALUE_REPORT |
| reports/tax-summary | TC-GST | `/reports/tax-summary` | REPORT_TAX_SUMMARY |
| reports/tds-tcs | TC-GST | `/reports/tds-tcs` | REPORT_TDS_TCS |
| reports/trial-balance | TC-ACC | `/reports/trial-balance` | TRIAL_BALANCE |
| sales | TC-EST | `/sales` | SALES |
| sales/challans | TC-DC | `/sales/challans` | DELIVERY_CHALLANS |
| sales/challans | TC-DC | `/sales/challans/:id` | DELIVERY_CHALLAN_DETAIL |
| sales/challans | TC-DC | `/sales/challans/:id/edit` | DELIVERY_CHALLAN_EDIT |
| sales/challans | TC-DC | `/sales/challans/new` | DELIVERY_CHALLAN_NEW |
| sales/estimates | TC-EST | `/sales/estimates` | ESTIMATES |
| sales/estimates | TC-EST | `/sales/estimates/:id` | ESTIMATE_DETAIL |
| sales/estimates | TC-EST | `/sales/estimates/:id/edit` | ESTIMATE_EDIT |
| sales/estimates | TC-EST | `/sales/estimates/new` | ESTIMATE_NEW |
| sales/orders | TC-SO | `/sales/orders` | SALE_ORDERS |
| sales/orders | TC-SO | `/sales/orders/:id` | SALE_ORDER_DETAIL |
| sales/orders | TC-SO | `/sales/orders/:id/edit` | SALE_ORDER_EDIT |
| sales/orders | TC-SO | `/sales/orders/new` | SALE_ORDER_NEW |
| sales/returns | TC-RET | `/sales/returns` | SALES_RETURNS |
| serial-lookup | TC-NAV | `/serial-lookup` | SERIAL_LOOKUP |
| settings | TC-STG | `/settings` | SETTINGS |
| settings/audit-log | TC-DATA | `/settings/audit-log` | SETTINGS_AUDIT_LOG |
| settings/backup | TC-DATA | `/settings/backup` | SETTINGS_BACKUP |
| settings/commission | TC-COM | `/settings/commission` | SETTINGS_COMMISSION |
| settings/currency | TC-MSTR | `/settings/currency` | SETTINGS_CURRENCY |
| settings/document-custom-fields | TC-DOC | `/settings/document-custom-fields` | SETTINGS_DOC_CUSTOM_FIELDS |
| settings/documents | TC-DOC | `/settings/documents` | SETTINGS_DOCUMENTS |
| settings/gst | TC-GST | `/settings/gst` | SETTINGS_GST |
| settings/import | TC-IMP | `/settings/import` | DATA_IMPORT |
| settings/inventory | TC-MSTR | `/settings/inventory` | SETTINGS_INVENTORY |
| settings/loyalty | TC-LOY | `/settings/loyalty` | SETTINGS_LOYALTY |
| settings/permissions | TC-STG | `/settings/permissions` | SETTINGS_PERMISSIONS |
| settings/pin-setup | TC-AUTH | `/settings/pin-setup` | SETTINGS_PIN_SETUP |
| settings/price-lists | TC-PRL | `/settings/price-lists` | PRICE_LISTS |
| settings/price-lists | TC-PRL | `/settings/price-lists/:id` | PRICE_LIST_DETAIL |
| settings/roles | TC-STG | `/settings/roles` | SETTINGS_ROLES |
| settings/roles | TC-STG | `/settings/roles/:id` | SETTINGS_ROLE_EDIT |
| settings/roles | TC-STG | `/settings/roles/new` | SETTINGS_ROLE_NEW |
| settings/security | TC-AUTH | `/settings/security` | SETTINGS_SECURITY |
| settings/sessions | TC-AUTH | `/settings/sessions` | SETTINGS_SESSIONS |
| settings/shortcuts | TC-STG | `/settings/shortcuts` | SETTINGS_SHORTCUTS |
| settings/staff | TC-STG | `/settings/staff` | SETTINGS_STAFF |
| settings/staff | TC-STG | `/settings/staff/invite` | SETTINGS_STAFF_INVITE |
| settings/storefront | TC-PUB | `/settings/storefront` | STOREFRONT_SETTINGS |
| settings/subscription | TC-BIL | `/settings/subscription` | SETTINGS_SUBSCRIPTION |
| settings/subscription | TC-BIL | `/settings/subscription/checkout` | SETTINGS_SUBSCRIPTION_CHECKOUT |
| settings/tax-rates | TC-GST | `/settings/tax-rates` | SETTINGS_TAX_RATES |
| settings/tax-rates | TC-GST | `/settings/tax-rates/:id` | SETTINGS_TAX_RATE_EDIT |
| settings/tax-rates | TC-GST | `/settings/tax-rates/new` | SETTINGS_TAX_RATE_NEW |
| settings/templates | TC-DOC | `/settings/templates` | TEMPLATES |
| settings/templates | TC-DOC | `/settings/templates/:id` | TEMPLATE_EDIT |
| settings/theme | TC-STG | `/settings/theme` | SETTINGS_THEME |
| settings/transaction-controls | TC-STG | `/settings/transaction-controls` | SETTINGS_TRANSACTION_CONTROLS |
| settings/units | TC-MSTR | `/settings/units` | SETTINGS_UNITS |
| stock-verification | TC-SV | `/stock-verification` | STOCK_VERIFICATION |
| stock-verification | TC-SV | `/stock-verification/:id` | STOCK_VERIFICATION_DETAIL |
| verify-otp | TC-REG | `/verify-otp` | VERIFY_OTP |
| voice-entry | TC-VCE | `/voice-entry` | VOICE_ENTRY |

## API endpoints

| Module | Suite | Method | Path | File |
|---|---|---|---|---|
| api:accounting | TC-ACC | POST | `/accounts` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | GET | `/accounts` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | POST | `/accounts/seed` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | GET | `/accounts/:id` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | PUT | `/accounts/:id` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | POST | `/entries` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | GET | `/entries` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | GET | `/entries/:id` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | POST | `/entries/:id/post` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | POST | `/entries/:id/void` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | GET | `/reports/trial-balance` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | GET | `/reports/ledger/:accountId` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | GET | `/reports/day-book` | `server/src/routes/accounting.ts` |
| api:accounting | TC-ACC | POST | `/reconcile-balances` | `server/src/routes/accounting.ts` |
| api:admin | TC-ADM | POST | `/login` | `server/src/routes/admin/admin-auth.ts` |
| api:admin | TC-ADM | POST | `/refresh` | `server/src/routes/admin/admin-auth.ts` |
| api:admin | TC-ADM | POST | `/logout` | `server/src/routes/admin/admin-auth.ts` |
| api:admin | TC-ADM | GET | `/me` | `server/src/routes/admin/admin-auth.ts` |
| api:admin | TC-ADM | GET | `/` | `server/src/routes/admin/admin-businesses.ts` |
| api:admin | TC-ADM | GET | `/:id` | `server/src/routes/admin/admin-businesses.ts` |
| api:admin | TC-ADM | POST | `/` | `server/src/routes/admin/admin-coupons.ts` |
| api:admin | TC-ADM | POST | `/bulk` | `server/src/routes/admin/admin-coupons.ts` |
| api:admin | TC-ADM | GET | `/` | `server/src/routes/admin/admin-coupons.ts` |
| api:admin | TC-ADM | GET | `/:id` | `server/src/routes/admin/admin-coupons.ts` |
| api:admin | TC-ADM | PATCH | `/:id` | `server/src/routes/admin/admin-coupons.ts` |
| api:admin | TC-ADM | DELETE | `/:id` | `server/src/routes/admin/admin-coupons.ts` |
| api:admin | TC-ADM | GET | `/overview` | `server/src/routes/admin/admin-dashboard.ts` |
| api:admin | TC-ADM | GET | `/growth` | `server/src/routes/admin/admin-dashboard.ts` |
| api:admin | TC-ADM | GET | `/` | `server/src/routes/admin/admin-settings.ts` |
| api:admin | TC-ADM | PUT | `/:key` | `server/src/routes/admin/admin-settings.ts` |
| api:admin | TC-ADM | GET | `/` | `server/src/routes/admin/admin-users.ts` |
| api:admin | TC-ADM | GET | `/:id` | `server/src/routes/admin/admin-users.ts` |
| api:admin | TC-ADM | POST | `/:id/suspend` | `server/src/routes/admin/admin-users.ts` |
| api:admin | TC-ADM | POST | `/:id/unsuspend` | `server/src/routes/admin/admin-users.ts` |
| api:admin | TC-ADM | POST | `/:id/unlock` | `server/src/routes/admin/admin-users.ts` |
| api:admin | TC-ADM | POST | `/broadcast` | `server/src/routes/admin/notifications-broadcast.ts` |
| api:admin | TC-ADM | GET | `/status` | `server/src/routes/admin/scoped-shadow.admin.ts` |
| api:admin | TC-ADM | POST | `/:businessId/grant` | `server/src/routes/admin/subscriptions.admin.ts` |
| api:admin | TC-ADM | POST | `/:businessId/revoke` | `server/src/routes/admin/subscriptions.admin.ts` |
| api:analytics | TC-RPT | GET | `/revenue-forecast` | `server/src/routes/analytics.ts` |
| api:analytics | TC-RPT | GET | `/stock-forecast` | `server/src/routes/analytics.ts` |
| api:appointment-convert | TC-APT | POST | `/:id/convert` | `server/src/routes/appointment-convert.ts` |
| api:appointment-public | TC-APT | POST | `/availability` | `server/src/routes/appointment-public.ts` |
| api:appointment-public | TC-APT | POST | `/` | `server/src/routes/appointment-public.ts` |
| api:appointment-waitlist | TC-APT | POST | `/waitlist` | `server/src/routes/appointment-waitlist.ts` |
| api:appointment-waitlist | TC-APT | GET | `/waitlist` | `server/src/routes/appointment-waitlist.ts` |
| api:appointment-waitlist | TC-APT | DELETE | `/waitlist/:id` | `server/src/routes/appointment-waitlist.ts` |
| api:appointments | TC-APT | GET | `/` | `server/src/routes/appointments.ts` |
| api:appointments | TC-APT | POST | `/` | `server/src/routes/appointments.ts` |
| api:appointments | TC-APT | GET | `/availability` | `server/src/routes/appointments.ts` |
| api:appointments | TC-APT | GET | `/:id` | `server/src/routes/appointments.ts` |
| api:appointments | TC-APT | PATCH | `/:id/status` | `server/src/routes/appointments.ts` |
| api:audit | TC-DATA | GET | `/` | `server/src/routes/audit.routes.ts` |
| api:audit | TC-DATA | GET | `/redactions` | `server/src/routes/audit.routes.ts` |
| api:audit | TC-DATA | POST | `/redactions` | `server/src/routes/audit.routes.ts` |
| api:audit | TC-DATA | DELETE | `/redactions/:id` | `server/src/routes/audit.routes.ts` |
| api:audit | TC-DATA | POST | `/export` | `server/src/routes/audit.routes.ts` |
| api:auth | TC-AUTH | GET | `/csrf-token` | `server/src/routes/auth/csrf.ts` |
| api:auth | TC-AUTH | POST | `/dev-login` | `server/src/routes/auth/dev-login.ts` |
| api:auth | TC-AUTH | GET | `/` | `server/src/routes/auth/entitlement-pubkey.route.ts` |
| api:auth | TC-AUTH | POST | `/login` | `server/src/routes/auth/login.ts` |
| api:auth | TC-AUTH | POST | `/logout` | `server/src/routes/auth/logout.ts` |
| api:auth | TC-AUTH | GET | `/me` | `server/src/routes/auth/me.ts` |
| api:auth | TC-AUTH | POST | `/forgot-password` | `server/src/routes/auth/password-reset.ts` |
| api:auth | TC-AUTH | POST | `/reset-password` | `server/src/routes/auth/password-reset.ts` |
| api:auth | TC-AUTH | POST | `/refresh` | `server/src/routes/auth/refresh.ts` |
| api:auth | TC-AUTH | POST | `/register` | `server/src/routes/auth/register.ts` |
| api:auth | TC-AUTH | POST | `/verify-registration` | `server/src/routes/auth/register.ts` |
| api:auth | TC-AUTH | POST | `/resend-otp` | `server/src/routes/auth/register.ts` |
| api:auth | TC-AUTH | POST | `/switch-business` | `server/src/routes/auth/switch-business.ts` |
| api:auth-pin | TC-AUTH | POST | `/verify` | `server/src/routes/auth-pin.routes.ts` |
| api:auth-pin | TC-AUTH | POST | `/reset/request` | `server/src/routes/auth-pin.routes.ts` |
| api:auth-pin | TC-AUTH | POST | `/reset/confirm` | `server/src/routes/auth-pin.routes.ts` |
| api:backup | TC-DATA | GET | `/drive/connect` | `server/src/routes/backup.ts` |
| api:backup | TC-DATA | GET | `/drive/callback` | `server/src/routes/backup.ts` |
| api:backup | TC-DATA | GET | `/drive/status` | `server/src/routes/backup.ts` |
| api:backup | TC-DATA | POST | `/drive/backup-now` | `server/src/routes/backup.ts` |
| api:backup | TC-DATA | POST | `/drive/disconnect` | `server/src/routes/backup.ts` |
| api:backup | TC-DATA | POST | `/manual` | `server/src/routes/backup.ts` |
| api:backup | TC-DATA | GET | `/list` | `server/src/routes/backup.ts` |
| api:backup | TC-DATA | GET | `/download/:backupId` | `server/src/routes/backup.ts` |
| api:backup | TC-DATA | GET | `/cooldown-status` | `server/src/routes/backup.ts` |
| api:bank | TC-BNK | POST | `/` | `server/src/routes/bank.ts` |
| api:bank | TC-BNK | GET | `/` | `server/src/routes/bank.ts` |
| api:bank | TC-BNK | GET | `/:id` | `server/src/routes/bank.ts` |
| api:bank | TC-BNK | PUT | `/:id` | `server/src/routes/bank.ts` |
| api:bank | TC-BNK | DELETE | `/:id` | `server/src/routes/bank.ts` |
| api:bank-reconciliation | TC-BNK | POST | `/imports` | `server/src/routes/bank-reconciliation.routes.ts` |
| api:bank-reconciliation | TC-BNK | GET | `/lines` | `server/src/routes/bank-reconciliation.routes.ts` |
| api:bank-reconciliation | TC-BNK | POST | `/lines/:lineId/match` | `server/src/routes/bank-reconciliation.routes.ts` |
| api:bank-reconciliation | TC-BNK | POST | `/lines/:lineId/confirm` | `server/src/routes/bank-reconciliation.routes.ts` |
| api:bank-reconciliation | TC-BNK | POST | `/lines/:lineId/ignore` | `server/src/routes/bank-reconciliation.routes.ts` |
| api:bank-reconciliation | TC-BNK | DELETE | `/matches/:lineId` | `server/src/routes/bank-reconciliation.routes.ts` |
| api:batches | TC-BAT | GET | `/products/:productId/batches` | `server/src/routes/batches.ts` |
| api:batches | TC-BAT | GET | `/products/:productId/batches/picker` | `server/src/routes/batches.ts` |
| api:batches | TC-BAT | POST | `/products/:productId/batches` | `server/src/routes/batches.ts` |
| api:batches | TC-BAT | GET | `/batches/expiring` | `server/src/routes/batches.ts` |
| api:batches | TC-BAT | GET | `/batches/:id` | `server/src/routes/batches.ts` |
| api:batches | TC-BAT | PATCH | `/batches/:id` | `server/src/routes/batches.ts` |
| api:batches | TC-BAT | DELETE | `/batches/:id` | `server/src/routes/batches.ts` |
| api:biometric | TC-AUTH | POST | `/register/options` | `server/src/routes/biometric.ts` |
| api:biometric | TC-AUTH | POST | `/register/verify` | `server/src/routes/biometric.ts` |
| api:biometric | TC-AUTH | POST | `/authenticate/options` | `server/src/routes/biometric.ts` |
| api:biometric | TC-AUTH | POST | `/authenticate/verify` | `server/src/routes/biometric.ts` |
| api:biometric | TC-AUTH | GET | `/credentials` | `server/src/routes/biometric.ts` |
| api:biometric | TC-AUTH | DELETE | `/credentials/:id` | `server/src/routes/biometric.ts` |
| api:bom | TC-BOM | GET | `/` | `server/src/routes/bom.ts` |
| api:bom | TC-BOM | GET | `/:id` | `server/src/routes/bom.ts` |
| api:bom | TC-BOM | POST | `/` | `server/src/routes/bom.ts` |
| api:bom | TC-BOM | PUT | `/:id` | `server/src/routes/bom.ts` |
| api:bom | TC-BOM | DELETE | `/:id` | `server/src/routes/bom.ts` |
| api:businesses | TC-BIZ | POST | `/:id/suspend` | `server/src/routes/businesses.routes.ts` |
| api:businesses | TC-BIZ | POST | `/:id/reactivate` | `server/src/routes/businesses.routes.ts` |
| api:businesses | TC-BIZ | POST | `/:id/rotate-booking-secret` | `server/src/routes/businesses.routes.ts` |
| api:cash-entries | TC-CASH | POST | `/` | `server/src/routes/cash-entries.route.ts` |
| api:cash-entries | TC-CASH | GET | `/summary` | `server/src/routes/cash-entries.route.ts` |
| api:cash-entries | TC-CASH | GET | `/` | `server/src/routes/cash-entries.route.ts` |
| api:cash-entries | TC-CASH | GET | `/:id` | `server/src/routes/cash-entries.route.ts` |
| api:cash-entries | TC-CASH | PATCH | `/:id` | `server/src/routes/cash-entries.route.ts` |
| api:cash-entries | TC-CASH | POST | `/:id/void` | `server/src/routes/cash-entries.route.ts` |
| api:cash-entries | TC-CASH | POST | `/:id/restore` | `server/src/routes/cash-entries.route.ts` |
| api:cash-entries | TC-CASH | DELETE | `/:id` | `server/src/routes/cash-entries.route.ts` |
| api:categories | TC-PRD | GET | `/` | `server/src/routes/categories.ts` |
| api:categories | TC-PRD | POST | `/` | `server/src/routes/categories.ts` |
| api:categories | TC-PRD | PUT | `/:id` | `server/src/routes/categories.ts` |
| api:categories | TC-PRD | DELETE | `/:id` | `server/src/routes/categories.ts` |
| api:cheques | TC-PAY | POST | `/` | `server/src/routes/cheques.ts` |
| api:cheques | TC-PAY | GET | `/` | `server/src/routes/cheques.ts` |
| api:cheques | TC-PAY | GET | `/summary` | `server/src/routes/cheques.ts` |
| api:cheques | TC-PAY | GET | `/:id` | `server/src/routes/cheques.ts` |
| api:cheques | TC-PAY | PUT | `/:id/status` | `server/src/routes/cheques.ts` |
| api:cheques | TC-PAY | DELETE | `/:id` | `server/src/routes/cheques.ts` |
| api:collections | TC-COLL | GET | `/` | `server/src/routes/collections/aging.route.ts` |
| api:collections | TC-COLL | GET | `/parties` | `server/src/routes/collections/aging.route.ts` |
| api:collections | TC-COLL | POST | `/` | `server/src/routes/collections/ptp.route.ts` |
| api:collections | TC-COLL | GET | `/` | `server/src/routes/collections/ptp.route.ts` |
| api:collections | TC-COLL | PATCH | `/:id` | `server/src/routes/collections/ptp.route.ts` |
| api:collections | TC-COLL | DELETE | `/:id` | `server/src/routes/collections/ptp.route.ts` |
| api:collections | TC-COLL | POST | `/:id/mark-kept` | `server/src/routes/collections/ptp.route.ts` |
| api:collections | TC-COLL | GET | `/:partyId` | `server/src/routes/collections/statement.route.ts` |
| api:commission | TC-COM | POST | `/rules` | `server/src/routes/commission.routes.ts` |
| api:commission | TC-COM | PUT | `/rules/:id` | `server/src/routes/commission.routes.ts` |
| api:commission | TC-COM | DELETE | `/rules/:id` | `server/src/routes/commission.routes.ts` |
| api:commission | TC-COM | GET | `/rules` | `server/src/routes/commission.routes.ts` |
| api:commission | TC-COM | GET | `/rules/:id` | `server/src/routes/commission.routes.ts` |
| api:commission | TC-COM | GET | `/ledger` | `server/src/routes/commission.routes.ts` |
| api:commission | TC-COM | GET | `/leaderboard` | `server/src/routes/commission.routes.ts` |
| api:coupons | TC-BIL | POST | `/validate` | `server/src/routes/coupons.ts` |
| api:coupons | TC-BIL | POST | `/apply` | `server/src/routes/coupons.ts` |
| api:coupons | TC-BIL | DELETE | `/remove` | `server/src/routes/coupons.ts` |
| api:currency | TC-MSTR | POST | `/exchange-rates` | `server/src/routes/currency.ts` |
| api:currency | TC-MSTR | GET | `/exchange-rates` | `server/src/routes/currency.ts` |
| api:currency | TC-MSTR | GET | `/exchange-rates/:code` | `server/src/routes/currency.ts` |
| api:currency | TC-MSTR | GET | `/supported` | `server/src/routes/currency.ts` |
| api:currency | TC-MSTR | POST | `/convert` | `server/src/routes/currency.ts` |
| api:custom-fields | TC-DOC | POST | `/` | `server/src/routes/custom-fields.ts` |
| api:custom-fields | TC-DOC | GET | `/` | `server/src/routes/custom-fields.ts` |
| api:custom-fields | TC-DOC | PUT | `/:id` | `server/src/routes/custom-fields.ts` |
| api:custom-fields | TC-DOC | DELETE | `/:id` | `server/src/routes/custom-fields.ts` |
| api:custom-orders | TC-ORD | GET | `/recycle` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | GET | `/` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | GET | `/:id` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | POST | `/` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | PATCH | `/:id` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | POST | `/:id/transition` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | POST | `/:id/advances` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | DELETE | `/:id/advances/:advanceId` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | POST | `/:id/convert-to-invoice` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | DELETE | `/:id` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | POST | `/:id/restore` | `server/src/routes/custom-orders.ts` |
| api:custom-orders | TC-ORD | DELETE | `/:id/permanent` | `server/src/routes/custom-orders.ts` |
| api:dashboard | TC-DASH | GET | `/home` | `server/src/routes/dashboard.ts` |
| api:dashboard | TC-DASH | GET | `/stats` | `server/src/routes/dashboard.ts` |
| api:document-settings | TC-DOC | GET | `/` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | PUT | `/` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | GET | `/signature` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | POST | `/signature` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | DELETE | `/signature` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | GET | `/terms-templates` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | POST | `/terms-templates` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | PUT | `/terms-templates/:id` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | DELETE | `/terms-templates/:id` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | GET | `/number-series/:type/next` | `server/src/routes/document-settings.ts` |
| api:document-settings | TC-DOC | PUT | `/number-series/:type` | `server/src/routes/document-settings.ts` |
| api:document-share-links | TC-PUB | POST | `/:documentId/share-links` | `server/src/routes/document-share-links.routes.ts` |
| api:document-share-links | TC-PUB | GET | `/:documentId/share-links` | `server/src/routes/document-share-links.routes.ts` |
| api:document-share-links | TC-PUB | PATCH | `/:documentId/share-links/:linkId` | `server/src/routes/document-share-links.routes.ts` |
| api:documents | TC-INV | POST | `/:id/convert` | `server/src/routes/documents/convert-restore.ts` |
| api:documents | TC-INV | POST | `/:id/restore` | `server/src/routes/documents/convert-restore.ts` |
| api:documents | TC-INV | DELETE | `/:id/permanent` | `server/src/routes/documents/convert-restore.ts` |
| api:documents | TC-INV | GET | `/` | `server/src/routes/documents/crud.ts` |
| api:documents | TC-INV | GET | `/recycle-bin` | `server/src/routes/documents/crud.ts` |
| api:documents | TC-INV | GET | `/:id` | `server/src/routes/documents/crud.ts` |
| api:documents | TC-INV | POST | `/` | `server/src/routes/documents/crud.ts` |
| api:documents | TC-INV | PUT | `/:id` | `server/src/routes/documents/crud.ts` |
| api:documents | TC-INV | DELETE | `/recycle-bin` | `server/src/routes/documents/crud.ts` |
| api:documents | TC-INV | DELETE | `/:id` | `server/src/routes/documents/crud.ts` |
| api:documents | TC-INV | GET | `/:id/custom-fields` | `server/src/routes/documents/custom-fields.ts` |
| api:documents | TC-INV | PUT | `/:id/custom-fields` | `server/src/routes/documents/custom-fields.ts` |
| api:documents | TC-INV | GET | `/:id/lineage` | `server/src/routes/documents/lineage.ts` |
| api:documents | TC-INV | POST | `/validate-stock` | `server/src/routes/documents/quick-sale.ts` |
| api:documents | TC-INV | POST | `/quick-sale` | `server/src/routes/documents/quick-sale.ts` |
| api:documents | TC-INV | POST | `/:id/share/whatsapp` | `server/src/routes/documents/share.ts` |
| api:documents | TC-INV | POST | `/:id/share/email` | `server/src/routes/documents/share.ts` |
| api:einvoice | TC-EIN | POST | `/generate` | `server/src/routes/einvoice.ts` |
| api:einvoice | TC-EIN | POST | `/cancel` | `server/src/routes/einvoice.ts` |
| api:einvoice | TC-EIN | GET | `/:documentId` | `server/src/routes/einvoice.ts` |
| api:events | TC-COLLAB | GET | `/stream` | `server/src/routes/events.ts` |
| api:events | TC-COLLAB | GET | `/stats` | `server/src/routes/events.ts` |
| api:ewaybill | TC-EWB | POST | `/generate` | `server/src/routes/ewaybill.ts` |
| api:ewaybill | TC-EWB | PUT | `/update-partb` | `server/src/routes/ewaybill.ts` |
| api:ewaybill | TC-EWB | POST | `/cancel` | `server/src/routes/ewaybill.ts` |
| api:ewaybill | TC-EWB | GET | `/:documentId` | `server/src/routes/ewaybill.ts` |
| api:expense-budgets | TC-EXP | POST | `/` | `server/src/routes/expense-budgets.route.ts` |
| api:expense-budgets | TC-EXP | GET | `/` | `server/src/routes/expense-budgets.route.ts` |
| api:expense-budgets | TC-EXP | DELETE | `/:id` | `server/src/routes/expense-budgets.route.ts` |
| api:expense-confirm | TC-EXP | POST | `/:id/confirm` | `server/src/routes/expense-confirm.route.ts` |
| api:expense-confirm | TC-EXP | POST | `/:id/skip` | `server/src/routes/expense-confirm.route.ts` |
| api:expense-ocr | TC-EXP | POST | `/` | `server/src/routes/expense-ocr.route.ts` |
| api:expense-templates | TC-EXP | POST | `/` | `server/src/routes/expense-templates.route.ts` |
| api:expense-templates | TC-EXP | GET | `/` | `server/src/routes/expense-templates.route.ts` |
| api:expense-templates | TC-EXP | GET | `/:id` | `server/src/routes/expense-templates.route.ts` |
| api:expense-templates | TC-EXP | PATCH | `/:id` | `server/src/routes/expense-templates.route.ts` |
| api:expense-templates | TC-EXP | DELETE | `/:id` | `server/src/routes/expense-templates.route.ts` |
| api:expense-trend | TC-EXP | GET | `/` | `server/src/routes/expense-trend.route.ts` |
| api:expenses | TC-EXP | POST | `/categories` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | GET | `/categories` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | POST | `/categories/seed` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | POST | `/:id/confirm` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | POST | `/:id/skip` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | POST | `/` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | GET | `/` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | GET | `/summary` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | GET | `/pending` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | GET | `/:id` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | PUT | `/:id` | `server/src/routes/expenses.ts` |
| api:expenses | TC-EXP | DELETE | `/:id` | `server/src/routes/expenses.ts` |
| api:export | TC-DATA | GET | `/full` | `server/src/routes/export.ts` |
| api:export | TC-DATA | GET | `/csv/:entity` | `server/src/routes/export.ts` |
| api:feedback | TC-COLLAB | POST | `/` | `server/src/routes/feedback.ts` |
| api:feedback | TC-COLLAB | GET | `/my` | `server/src/routes/feedback.ts` |
| api:financial-reports | TC-ACC | GET | `/profit-loss` | `server/src/routes/financial-reports.ts` |
| api:financial-reports | TC-ACC | GET | `/balance-sheet` | `server/src/routes/financial-reports.ts` |
| api:financial-reports | TC-ACC | GET | `/cash-flow` | `server/src/routes/financial-reports.ts` |
| api:financial-reports | TC-ACC | GET | `/aging` | `server/src/routes/financial-reports.ts` |
| api:financial-reports | TC-ACC | GET | `/profitability` | `server/src/routes/financial-reports.ts` |
| api:financial-reports | TC-ACC | GET | `/discounts` | `server/src/routes/financial-reports.ts` |
| api:financial-reports | TC-ACC | GET | `/tally-export` | `server/src/routes/financial-reports.ts` |
| api:fy-closure | TC-ACC | POST | `/` | `server/src/routes/fy-closure.ts` |
| api:fy-closure | TC-ACC | GET | `/` | `server/src/routes/fy-closure.ts` |
| api:fy-closure | TC-ACC | POST | `/:financialYear/reopen` | `server/src/routes/fy-closure.ts` |
| api:godowns | TC-GDN | GET | `/` | `server/src/routes/godowns.ts` |
| api:godowns | TC-GDN | POST | `/` | `server/src/routes/godowns.ts` |
| api:godowns | TC-GDN | POST | `/transfer` | `server/src/routes/godowns.ts` |
| api:godowns | TC-GDN | GET | `/transfers` | `server/src/routes/godowns.ts` |
| api:godowns | TC-GDN | PATCH | `/:id` | `server/src/routes/godowns.ts` |
| api:godowns | TC-GDN | DELETE | `/:id` | `server/src/routes/godowns.ts` |
| api:godowns | TC-GDN | GET | `/:id/stock` | `server/src/routes/godowns.ts` |
| api:gst-backfill | TC-GST | POST | `/preview` | `server/src/routes/gst-backfill.route.ts` |
| api:gst-backfill | TC-GST | POST | `/execute` | `server/src/routes/gst-backfill.route.ts` |
| api:gst-backfill | TC-GST | GET | `/status/:jobId` | `server/src/routes/gst-backfill.route.ts` |
| api:gst-returns | TC-GST | GET | `/GSTR1/:period` | `server/src/routes/gst-returns.ts` |
| api:gst-returns | TC-GST | POST | `/GSTR1/:period/export` | `server/src/routes/gst-returns.ts` |
| api:gst-returns | TC-GST | GET | `/GSTR3B/:period` | `server/src/routes/gst-returns.ts` |
| api:gst-returns | TC-GST | POST | `/GSTR3B/:period/export` | `server/src/routes/gst-returns.ts` |
| api:gst-returns | TC-GST | GET | `/:returnType/:period` | `server/src/routes/gst-returns.ts` |
| api:gst-returns | TC-GST | POST | `/:returnType/:period/export` | `server/src/routes/gst-returns.ts` |
| api:gst-settings | TC-GST | GET | `/` | `server/src/routes/gst-settings.route.ts` |
| api:gst-settings | TC-GST | PATCH | `/` | `server/src/routes/gst-settings.route.ts` |
| api:gst-validation | TC-GST | GET | `/` | `server/src/routes/gst-validation.routes.ts` |
| api:gstin | TC-GST | POST | `/validate` | `server/src/routes/gstin.ts` |
| api:gstin | TC-GST | POST | `/verify` | `server/src/routes/gstin.ts` |
| api:hr-attendance | TC-HR | POST | `/batch` | `server/src/routes/hr-attendance.routes.ts` |
| api:hr-attendance | TC-HR | GET | `/` | `server/src/routes/hr-attendance.routes.ts` |
| api:hr-employees | TC-HR | POST | `/` | `server/src/routes/hr-employees.routes.ts` |
| api:hr-employees | TC-HR | GET | `/` | `server/src/routes/hr-employees.routes.ts` |
| api:hr-employees | TC-HR | GET | `/:id` | `server/src/routes/hr-employees.routes.ts` |
| api:hr-employees | TC-HR | PATCH | `/:id` | `server/src/routes/hr-employees.routes.ts` |
| api:hr-employees | TC-HR | DELETE | `/:id` | `server/src/routes/hr-employees.routes.ts` |
| api:hsn | TC-GST | GET | `/search` | `server/src/routes/hsn.ts` |
| api:hsn | TC-GST | GET | `/:code` | `server/src/routes/hsn.ts` |
| api:imports | TC-IMP | DELETE | `/:id` | `server/src/routes/imports/cancel.route.ts` |
| api:imports | TC-IMP | POST | `/:id/commit` | `server/src/routes/imports/commit.route.ts` |
| api:imports | TC-IMP | POST | `/` | `server/src/routes/imports/create.route.ts` |
| api:imports | TC-IMP | GET | `/:id/error-csv` | `server/src/routes/imports/error-csv.route.ts` |
| api:imports | TC-IMP | GET | `/:id` | `server/src/routes/imports/get.route.ts` |
| api:imports | TC-IMP | GET | `/` | `server/src/routes/imports/list.route.ts` |
| api:inventory-settings | TC-MSTR | GET | `/` | `server/src/routes/inventory-settings.ts` |
| api:inventory-settings | TC-MSTR | PUT | `/` | `server/src/routes/inventory-settings.ts` |
| api:invoice-settings | TC-DOC | GET | `/` | `server/src/routes/invoice-settings.routes.ts` |
| api:invoice-settings | TC-DOC | PUT | `/` | `server/src/routes/invoice-settings.routes.ts` |
| api:invoice-templates | TC-DOC | GET | `/` | `server/src/routes/invoice-templates.routes.ts` |
| api:invoice-templates | TC-DOC | GET | `/:id` | `server/src/routes/invoice-templates.routes.ts` |
| api:invoice-templates | TC-DOC | POST | `/` | `server/src/routes/invoice-templates.routes.ts` |
| api:invoice-templates | TC-DOC | PUT | `/:id` | `server/src/routes/invoice-templates.routes.ts` |
| api:invoice-templates | TC-DOC | DELETE | `/:id` | `server/src/routes/invoice-templates.routes.ts` |
| api:invoice-templates | TC-DOC | POST | `/:id/duplicate` | `server/src/routes/invoice-templates.routes.ts` |
| api:invoice-templates | TC-DOC | POST | `/:id/set-default` | `server/src/routes/invoice-templates.routes.ts` |
| api:jobs | TC-JOB | GET | `/recycle` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | GET | `/` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | GET | `/:id` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | POST | `/` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | PATCH | `/:id` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | POST | `/:id/transition` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | POST | `/:id/convert-to-invoice` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | DELETE | `/:id` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | POST | `/:id/restore` | `server/src/routes/jobs.ts` |
| api:jobs | TC-JOB | DELETE | `/:id/permanent` | `server/src/routes/jobs.ts` |
| api:loans | TC-LON | POST | `/` | `server/src/routes/loans.ts` |
| api:loans | TC-LON | GET | `/` | `server/src/routes/loans.ts` |
| api:loans | TC-LON | GET | `/:id` | `server/src/routes/loans.ts` |
| api:loans | TC-LON | GET | `/:id/statement` | `server/src/routes/loans.ts` |
| api:loans | TC-LON | POST | `/:id/transactions` | `server/src/routes/loans.ts` |
| api:loans | TC-LON | POST | `/:id/close` | `server/src/routes/loans.ts` |
| api:loyalty | TC-LOY | GET | `/program` | `server/src/routes/loyalty.routes.ts` |
| api:loyalty | TC-LOY | PUT | `/program` | `server/src/routes/loyalty.routes.ts` |
| api:loyalty | TC-LOY | GET | `/balance/:partyId` | `server/src/routes/loyalty.routes.ts` |
| api:loyalty | TC-LOY | GET | `/ledger/:partyId` | `server/src/routes/loyalty.routes.ts` |
| api:marketing | TC-MKT | GET | `/` | `server/src/routes/marketing/campaigns.ts` |
| api:marketing | TC-MKT | GET | `/:id` | `server/src/routes/marketing/campaigns.ts` |
| api:marketing | TC-MKT | GET | `/:id/recipients` | `server/src/routes/marketing/campaigns.ts` |
| api:marketing | TC-MKT | POST | `/` | `server/src/routes/marketing/campaigns.ts` |
| api:marketing | TC-MKT | PUT | `/:id` | `server/src/routes/marketing/campaigns.ts` |
| api:marketing | TC-MKT | POST | `/:id/launch` | `server/src/routes/marketing/campaigns.ts` |
| api:marketing | TC-MKT | POST | `/:id/cancel` | `server/src/routes/marketing/campaigns.ts` |
| api:marketing | TC-MKT | GET | `/` | `server/src/routes/marketing/reminder-rules.ts` |
| api:marketing | TC-MKT | GET | `/:id` | `server/src/routes/marketing/reminder-rules.ts` |
| api:marketing | TC-MKT | POST | `/` | `server/src/routes/marketing/reminder-rules.ts` |
| api:marketing | TC-MKT | PUT | `/:id` | `server/src/routes/marketing/reminder-rules.ts` |
| api:marketing | TC-MKT | DELETE | `/:id` | `server/src/routes/marketing/reminder-rules.ts` |
| api:marketing | TC-MKT | POST | `/:id/toggle` | `server/src/routes/marketing/reminder-rules.ts` |
| api:marketing | TC-MKT | POST | `/segments/preview` | `server/src/routes/marketing/segments.ts` |
| api:marketing | TC-MKT | POST | `/opt-out/:partyId` | `server/src/routes/marketing/segments.ts` |
| api:marketing | TC-MKT | DELETE | `/opt-out/:partyId` | `server/src/routes/marketing/segments.ts` |
| api:marketing | TC-MKT | GET | `/` | `server/src/routes/marketing/templates.ts` |
| api:marketing | TC-MKT | GET | `/:id` | `server/src/routes/marketing/templates.ts` |
| api:marketing | TC-MKT | POST | `/` | `server/src/routes/marketing/templates.ts` |
| api:marketing | TC-MKT | PUT | `/:id` | `server/src/routes/marketing/templates.ts` |
| api:marketing | TC-MKT | DELETE | `/:id` | `server/src/routes/marketing/templates.ts` |
| api:notifications | TC-NOT | GET | `/` | `server/src/routes/notifications.ts` |
| api:notifications | TC-NOT | GET | `/unread-count` | `server/src/routes/notifications.ts` |
| api:notifications | TC-NOT | GET | `/preferences` | `server/src/routes/notifications.ts` |
| api:notifications | TC-NOT | PUT | `/preferences` | `server/src/routes/notifications.ts` |
| api:notifications | TC-NOT | GET | `/settings` | `server/src/routes/notifications.ts` |
| api:notifications | TC-NOT | PUT | `/settings` | `server/src/routes/notifications.ts` |
| api:notifications | TC-NOT | POST | `/read-all` | `server/src/routes/notifications.ts` |
| api:notifications | TC-NOT | GET | `/stream` | `server/src/routes/notifications.ts` |
| api:notifications | TC-NOT | POST | `/:id/read` | `server/src/routes/notifications.ts` |
| api:other-income | TC-INC | POST | `/` | `server/src/routes/other-income.ts` |
| api:other-income | TC-INC | GET | `/` | `server/src/routes/other-income.ts` |
| api:other-income | TC-INC | GET | `/summary` | `server/src/routes/other-income.ts` |
| api:other-income | TC-INC | GET | `/:id` | `server/src/routes/other-income.ts` |
| api:other-income | TC-INC | PUT | `/:id` | `server/src/routes/other-income.ts` |
| api:other-income | TC-INC | DELETE | `/:id` | `server/src/routes/other-income.ts` |
| api:parties | TC-PTY | GET | `/tags` | `server/src/routes/parties/crm.routes.ts` |
| api:parties | TC-PTY | GET | `/follow-ups` | `server/src/routes/parties/crm.routes.ts` |
| api:parties | TC-PTY | PATCH | `/:id` | `server/src/routes/parties/crm.routes.ts` |
| api:parties | TC-PTY | POST | `/` | `server/src/routes/parties/invite.routes.ts` |
| api:party | TC-PTY | POST | `/` | `server/src/routes/party.ts` |
| api:party | TC-PTY | GET | `/` | `server/src/routes/party.ts` |
| api:party | TC-PTY | GET | `/:id` | `server/src/routes/party.ts` |
| api:party | TC-PTY | PUT | `/:id` | `server/src/routes/party.ts` |
| api:party | TC-PTY | DELETE | `/:id` | `server/src/routes/party.ts` |
| api:party | TC-PTY | POST | `/:partyId/addresses` | `server/src/routes/party.ts` |
| api:party | TC-PTY | PUT | `/:partyId/addresses/:addressId` | `server/src/routes/party.ts` |
| api:party | TC-PTY | DELETE | `/:partyId/addresses/:addressId` | `server/src/routes/party.ts` |
| api:party | TC-PTY | GET | `/:partyId/ledger` | `server/src/routes/party.ts` |
| api:party | TC-PTY | GET | `/:partyId/frequent-products` | `server/src/routes/party.ts` |
| api:party | TC-PTY | GET | `/:partyId/ledger/shares` | `server/src/routes/party.ts` |
| api:party | TC-PTY | PUT | `/:partyId/pricing` | `server/src/routes/party.ts` |
| api:party | TC-PTY | GET | `/:partyId/pricing` | `server/src/routes/party.ts` |
| api:party-groups | TC-PTY | POST | `/` | `server/src/routes/party-groups.ts` |
| api:party-groups | TC-PTY | GET | `/` | `server/src/routes/party-groups.ts` |
| api:party-groups | TC-PTY | PUT | `/:id` | `server/src/routes/party-groups.ts` |
| api:party-groups | TC-PTY | DELETE | `/:id` | `server/src/routes/party-groups.ts` |
| api:payments | TC-PAY | GET | `/` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | GET | `/:id` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | POST | `/` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | PUT | `/:id` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | DELETE | `/:id` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | POST | `/:id/restore` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | PUT | `/:id/allocations` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | GET | `/outstanding/list` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | GET | `/outstanding/:partyId` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | POST | `/reminders/send` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | POST | `/reminders/send-bulk` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | GET | `/reminders/list` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | GET | `/reminders/config` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | PUT | `/reminders/config` | `server/src/routes/payments.ts` |
| api:payments | TC-PAY | POST | `/` | `server/src/routes/payments/payment-links.route.ts` |
| api:payments | TC-PAY | GET | `/` | `server/src/routes/payments/payment-links.route.ts` |
| api:payments | TC-PAY | DELETE | `/:id` | `server/src/routes/payments/payment-links.route.ts` |
| api:payments | TC-PAY | POST | `/bulk` | `server/src/routes/payments/reminders.route.ts` |
| api:payroll | TC-HR | POST | `/run/preview` | `server/src/routes/payroll.routes.ts` |
| api:payroll | TC-HR | POST | `/run/finalize` | `server/src/routes/payroll.routes.ts` |
| api:payroll | TC-HR | POST | `/run/:id/reverse` | `server/src/routes/payroll.routes.ts` |
| api:payroll | TC-HR | GET | `/:id/snapshot` | `server/src/routes/payroll.routes.ts` |
| api:pos-products-receipt | TC-POS | GET | `/products` | `server/src/routes/pos-products-receipt.ts` |
| api:pos-products-receipt | TC-POS | POST | `/receipt/:id/share` | `server/src/routes/pos-products-receipt.ts` |
| api:pos-sales | TC-POS | POST | `/` | `server/src/routes/pos-sales.ts` |
| api:pos-sales | TC-POS | GET | `/` | `server/src/routes/pos-sales.ts` |
| api:pos-sales | TC-POS | GET | `/:id` | `server/src/routes/pos-sales.ts` |
| api:pos-sales | TC-POS | POST | `/:id/void` | `server/src/routes/pos-sales.ts` |
| api:pos-sales | TC-POS | POST | `/:id/restore` | `server/src/routes/pos-sales.ts` |
| api:presence | TC-COLLAB | POST | `/heartbeat` | `server/src/routes/presence.routes.ts` |
| api:presence | TC-COLLAB | DELETE | `/` | `server/src/routes/presence.routes.ts` |
| api:presence | TC-COLLAB | GET | `/:entityType/:entityId` | `server/src/routes/presence.routes.ts` |
| api:price-list-assign | TC-PRL | POST | `/` | `server/src/routes/price-list-assign.routes.ts` |
| api:price-list-assign | TC-PRL | GET | `/` | `server/src/routes/price-list-assign.routes.ts` |
| api:price-list-entries | TC-PRL | POST | `/` | `server/src/routes/price-list-entries.routes.ts` |
| api:price-list-entries | TC-PRL | PATCH | `/:entryId` | `server/src/routes/price-list-entries.routes.ts` |
| api:price-list-entries | TC-PRL | DELETE | `/:entryId` | `server/src/routes/price-list-entries.routes.ts` |
| api:price-lists | TC-PRL | GET | `/` | `server/src/routes/price-lists.routes.ts` |
| api:price-lists | TC-PRL | POST | `/` | `server/src/routes/price-lists.routes.ts` |
| api:price-lists | TC-PRL | GET | `/:id` | `server/src/routes/price-lists.routes.ts` |
| api:price-lists | TC-PRL | PATCH | `/:id` | `server/src/routes/price-lists.routes.ts` |
| api:price-lists | TC-PRL | DELETE | `/:id` | `server/src/routes/price-lists.routes.ts` |
| api:production-runs | TC-BOM | GET | `/` | `server/src/routes/production-runs.ts` |
| api:production-runs | TC-BOM | GET | `/:id` | `server/src/routes/production-runs.ts` |
| api:production-runs | TC-BOM | POST | `/` | `server/src/routes/production-runs.ts` |
| api:production-runs | TC-BOM | POST | `/:id/cancel` | `server/src/routes/production-runs.ts` |
| api:products | TC-PRD | POST | `/stock/bulk-adjust` | `server/src/routes/products/bulk.ts` |
| api:products | TC-PRD | POST | `/bulk-import` | `server/src/routes/products/bulk.ts` |
| api:products | TC-PRD | POST | `/label-data` | `server/src/routes/products/bulk.ts` |
| api:products | TC-PRD | GET | `/export` | `server/src/routes/products/bulk.ts` |
| api:products | TC-PRD | GET | `/reorder-list` | `server/src/routes/products/bulk.ts` |
| api:products | TC-PRD | GET | `/by-barcode/:code` | `server/src/routes/products/bulk.ts` |
| api:products | TC-PRD | POST | `/` | `server/src/routes/products/crud.ts` |
| api:products | TC-PRD | GET | `/` | `server/src/routes/products/crud.ts` |
| api:products | TC-PRD | GET | `/:id` | `server/src/routes/products/crud.ts` |
| api:products | TC-PRD | PUT | `/:id` | `server/src/routes/products/crud.ts` |
| api:products | TC-PRD | DELETE | `/:id` | `server/src/routes/products/crud.ts` |
| api:products | TC-PRD | POST | `/:id/images` | `server/src/routes/products/images.ts` |
| api:products | TC-PRD | DELETE | `/:id/images/:index` | `server/src/routes/products/images.ts` |
| api:products | TC-PRD | POST | `/stock/validate` | `server/src/routes/products/stock.ts` |
| api:products | TC-PRD | GET | `/stock/adjustments` | `server/src/routes/products/stock.ts` |
| api:products | TC-PRD | POST | `/:id/stock/adjust` | `server/src/routes/products/stock.ts` |
| api:products | TC-PRD | GET | `/:id/stock/movements` | `server/src/routes/products/stock.ts` |
| api:products | TC-PRD | GET | `/:id/analytics` | `server/src/routes/products/stock.ts` |
| api:products | TC-PRD | GET | `/:id/stock/history` | `server/src/routes/products/stock.ts` |
| api:public | TC-PUB | GET | `/health` | `server/src/routes/public.routes.ts` |
| api:public | TC-PUB | GET | `/__resolver-test/:token` | `server/src/routes/public.routes.ts` |
| api:public | TC-PUB | GET | `/:token` | `server/src/routes/public/invite.routes.ts` |
| api:public | TC-PUB | POST | `/:token/otp/send` | `server/src/routes/public/invite.routes.ts` |
| api:public | TC-PUB | POST | `/:token/otp/verify` | `server/src/routes/public/invite.routes.ts` |
| api:public | TC-PUB | POST | `/:token/claim` | `server/src/routes/public/invite.routes.ts` |
| api:public | TC-PUB | GET | `/:token` | `server/src/routes/public/invoice.routes.ts` |
| api:public | TC-PUB | GET | `/:slug` | `server/src/routes/public/store.routes.ts` |
| api:razorpay | TC-BIL | POST | `/webhook` | `server/src/routes/razorpay.ts` |
| api:razorpay | TC-BIL | POST | `/subscribe` | `server/src/routes/razorpay.ts` |
| api:razorpay | TC-BIL | POST | `/cancel` | `server/src/routes/razorpay.ts` |
| api:razorpay | TC-BIL | GET | `/status` | `server/src/routes/razorpay.ts` |
| api:recipe-cost | TC-BOM | GET | `/` | `server/src/routes/recipe-cost.ts` |
| api:reconciliation | TC-PUR | POST | `/` | `server/src/routes/reconciliation.ts` |
| api:reconciliation | TC-PUR | GET | `/` | `server/src/routes/reconciliation.ts` |
| api:reconciliation | TC-PUR | GET | `/:id` | `server/src/routes/reconciliation.ts` |
| api:reconciliation | TC-PUR | GET | `/:id/entries` | `server/src/routes/reconciliation.ts` |
| api:reconciliation | TC-PUR | DELETE | `/:id` | `server/src/routes/reconciliation.ts` |
| api:recurring | TC-REC | POST | `/` | `server/src/routes/recurring.ts` |
| api:recurring | TC-REC | GET | `/` | `server/src/routes/recurring.ts` |
| api:recurring | TC-REC | POST | `/generate` | `server/src/routes/recurring.ts` |
| api:recurring | TC-REC | GET | `/:id` | `server/src/routes/recurring.ts` |
| api:recurring | TC-REC | PUT | `/:id` | `server/src/routes/recurring.ts` |
| api:recurring | TC-REC | DELETE | `/:id` | `server/src/routes/recurring.ts` |
| api:recurring | TC-REC | POST | `/pause` | `server/src/routes/recurring/recurring-actions.route.ts` |
| api:recurring | TC-REC | POST | `/resume` | `server/src/routes/recurring/recurring-actions.route.ts` |
| api:recurring | TC-REC | POST | `/generate-now` | `server/src/routes/recurring/recurring-actions.route.ts` |
| api:recurring | TC-REC | GET | `/` | `server/src/routes/recurring/recurring-runs.route.ts` |
| api:recurring | TC-REC | POST | `/` | `server/src/routes/recurring/recurring.route.ts` |
| api:recurring | TC-REC | GET | `/` | `server/src/routes/recurring/recurring.route.ts` |
| api:recurring | TC-REC | POST | `/generate` | `server/src/routes/recurring/recurring.route.ts` |
| api:recurring | TC-REC | GET | `/:id` | `server/src/routes/recurring/recurring.route.ts` |
| api:recurring | TC-REC | PATCH | `/:id` | `server/src/routes/recurring/recurring.route.ts` |
| api:recurring | TC-REC | DELETE | `/:id` | `server/src/routes/recurring/recurring.route.ts` |
| api:recycle-bin | TC-DATA | GET | `/` | `server/src/routes/recycle-bin.ts` |
| api:recycle-bin | TC-DATA | POST | `/:entityType/:id/restore` | `server/src/routes/recycle-bin.ts` |
| api:recycle-bin | TC-DATA | DELETE | `/:entityType/:id/permanent` | `server/src/routes/recycle-bin.ts` |
| api:referral | TC-BIL | GET | `/validate` | `server/src/routes/referral.ts` |
| api:referral | TC-BIL | POST | `/generate` | `server/src/routes/referral.ts` |
| api:referral | TC-BIL | GET | `/my-code` | `server/src/routes/referral.ts` |
| api:referral | TC-BIL | GET | `/rewards` | `server/src/routes/referral.ts` |
| api:referral | TC-BIL | GET | `/stats` | `server/src/routes/referral.ts` |
| api:referral | TC-BIL | POST | `/apply` | `server/src/routes/referral.ts` |
| api:referral | TC-BIL | POST | `/withdraw` | `server/src/routes/referral.ts` |
| api:referral | TC-BIL | GET | `/withdrawals` | `server/src/routes/referral.ts` |
| api:reorder | TC-ROR | GET | `/` | `server/src/routes/reorder.routes.ts` |
| api:reports | TC-RPT | GET | `/invoices` | `server/src/routes/reports.ts` |
| api:reports | TC-RPT | GET | `/party-statement/:partyId` | `server/src/routes/reports.ts` |
| api:reports | TC-RPT | GET | `/stock-summary` | `server/src/routes/reports.ts` |
| api:reports | TC-RPT | GET | `/day-book` | `server/src/routes/reports.ts` |
| api:reports | TC-RPT | GET | `/payments` | `server/src/routes/reports.ts` |
| api:reports | TC-RPT | GET | `/stock-value` | `server/src/routes/reports.ts` |
| api:reports | TC-RPT | POST | `/export` | `server/src/routes/reports.ts` |
| api:serial-numbers | TC-SER | GET | `/lookup` | `server/src/routes/serial-numbers.ts` |
| api:serial-numbers | TC-SER | GET | `/product/:productId` | `server/src/routes/serial-numbers.ts` |
| api:serial-numbers | TC-SER | POST | `/product/:productId` | `server/src/routes/serial-numbers.ts` |
| api:serial-numbers | TC-SER | POST | `/product/:productId/bulk` | `server/src/routes/serial-numbers.ts` |
| api:serial-numbers | TC-SER | GET | `/:id` | `server/src/routes/serial-numbers.ts` |
| api:serial-numbers | TC-SER | PATCH | `/:id` | `server/src/routes/serial-numbers.ts` |
| api:sessions | TC-AUTH | GET | `/` | `server/src/routes/sessions.ts` |
| api:sessions | TC-AUTH | DELETE | `/all` | `server/src/routes/sessions.ts` |
| api:sessions | TC-AUTH | DELETE | `/:sessionId` | `server/src/routes/sessions.ts` |
| api:settings | TC-STG | POST | `/` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/join` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | PUT | `/:businessId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId/vertical-defaults` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:businessId/apply-vertical-defaults` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId/roles` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId/roles/:roleId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:businessId/roles` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | PUT | `/:businessId/roles/:roleId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | DELETE | `/:businessId/roles/:roleId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId/staff` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:businessId/staff/invite` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | PUT | `/:businessId/staff/:staffId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:businessId/staff/:staffId/suspend` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | DELETE | `/:businessId/staff/:staffId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:businessId/staff/invite/:inviteId/resend` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | DELETE | `/:businessId/staff/invite/:inviteId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId/settings/transaction-lock` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | PUT | `/:businessId/settings/transaction-lock` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId/approvals` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | PUT | `/:businessId/approvals/:approvalId` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId/audit-log` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:businessId/gst-settings` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | PUT | `/:businessId/gst-settings` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:businessId/operation-pin` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/:userId/settings` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | PUT | `/:userId/settings` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:userId/pin` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:userId/pin/verify` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | POST | `/:userId/pin/reset` | `server/src/routes/settings.ts` |
| api:settings | TC-STG | GET | `/matrix` | `server/src/routes/settings.ts` |
| api:stock-alerts | TC-PRD | GET | `/` | `server/src/routes/stock-alerts.ts` |
| api:stock-alerts | TC-PRD | GET | `/count` | `server/src/routes/stock-alerts.ts` |
| api:stock-alerts | TC-PRD | POST | `/:id/acknowledge` | `server/src/routes/stock-alerts.ts` |
| api:stock-alerts | TC-PRD | POST | `/:id/dismiss` | `server/src/routes/stock-alerts.ts` |
| api:stock-verification | TC-SV | POST | `/` | `server/src/routes/stock-verification.ts` |
| api:stock-verification | TC-SV | GET | `/` | `server/src/routes/stock-verification.ts` |
| api:stock-verification | TC-SV | GET | `/:id` | `server/src/routes/stock-verification.ts` |
| api:stock-verification | TC-SV | PATCH | `/:id/items/:itemId` | `server/src/routes/stock-verification.ts` |
| api:stock-verification | TC-SV | POST | `/:id/complete` | `server/src/routes/stock-verification.ts` |
| api:stock-verification | TC-SV | POST | `/:id/adjust` | `server/src/routes/stock-verification.ts` |
| api:stock-verification | TC-SV | POST | `/:id/finalize` | `server/src/routes/stock-verification.ts` |
| api:storefront | TC-PUB | GET | `/` | `server/src/routes/storefront.routes.ts` |
| api:storefront | TC-PUB | PATCH | `/` | `server/src/routes/storefront.routes.ts` |
| api:storefront | TC-PUB | GET | `/products` | `server/src/routes/storefront.routes.ts` |
| api:storefront | TC-PUB | POST | `/products` | `server/src/routes/storefront.routes.ts` |
| api:storefront | TC-PUB | DELETE | `/products/:productId` | `server/src/routes/storefront.routes.ts` |
| api:storefront | TC-PUB | PATCH | `/products/:productId` | `server/src/routes/storefront.routes.ts` |
| api:subscription | TC-BIL | GET | `/:businessId/subscription` | `server/src/routes/subscription.ts` |
| api:subscription | TC-BIL | POST | `/subscription/checkout` | `server/src/routes/subscription.ts` |
| api:subscription | TC-BIL | GET | `/subscription/checkout/status` | `server/src/routes/subscription.ts` |
| api:subscription | TC-BIL | PATCH | `/subscription/plan` | `server/src/routes/subscription.ts` |
| api:subscription | TC-BIL | DELETE | `/subscription` | `server/src/routes/subscription.ts` |
| api:subscription | TC-BIL | POST | `/subscription/reactivate` | `server/src/routes/subscription.ts` |
| api:subscription | TC-BIL | POST | `/create` | `server/src/routes/subscription/mandate.routes.ts` |
| api:subscription | TC-BIL | DELETE | `/` | `server/src/routes/subscription/mandate.routes.ts` |
| api:subscription | TC-BIL | GET | `/status` | `server/src/routes/subscription/mandate.routes.ts` |
| api:tax-categories | TC-GST | GET | `/` | `server/src/routes/tax-categories.ts` |
| api:tax-categories | TC-GST | GET | `/:id` | `server/src/routes/tax-categories.ts` |
| api:tax-categories | TC-GST | POST | `/seed-defaults` | `server/src/routes/tax-categories.ts` |
| api:tax-categories | TC-GST | POST | `/` | `server/src/routes/tax-categories.ts` |
| api:tax-categories | TC-GST | PUT | `/:id` | `server/src/routes/tax-categories.ts` |
| api:tax-categories | TC-GST | DELETE | `/:id` | `server/src/routes/tax-categories.ts` |
| api:tax-reports | TC-GST | GET | `/tax-summary` | `server/src/routes/tax-reports.ts` |
| api:tax-reports | TC-GST | GET | `/hsn-summary` | `server/src/routes/tax-reports.ts` |
| api:tax-reports | TC-GST | GET | `/tax-ledger` | `server/src/routes/tax-reports.ts` |
| api:tds-tcs | TC-GST | GET | `/tds-tcs-summary` | `server/src/routes/tds-tcs.ts` |
| api:test-hooks | TC-SEC | GET | `/health` | `server/src/routes/test-hooks.route.ts` |
| api:test-hooks | TC-SEC | GET | `/last-otp` | `server/src/routes/test-hooks.route.ts` |
| api:test-hooks | TC-SEC | POST | `/reset-otps` | `server/src/routes/test-hooks.route.ts` |
| api:units | TC-MSTR | GET | `/` | `server/src/routes/units.ts` |
| api:units | TC-MSTR | POST | `/` | `server/src/routes/units.ts` |
| api:units | TC-MSTR | GET | `/convert` | `server/src/routes/units.ts` |
| api:units | TC-MSTR | PUT | `/:id` | `server/src/routes/units.ts` |
| api:units | TC-MSTR | DELETE | `/:id` | `server/src/routes/units.ts` |
| api:units | TC-MSTR | GET | `/conversions` | `server/src/routes/units.ts` |
| api:units | TC-MSTR | POST | `/conversions` | `server/src/routes/units.ts` |
| api:units | TC-MSTR | PUT | `/conversions/:id` | `server/src/routes/units.ts` |
| api:units | TC-MSTR | DELETE | `/conversions/:id` | `server/src/routes/units.ts` |
| api:webhooks | TC-BIL | POST | `/` | `server/src/routes/webhooks/marketing-aisensy.routes.ts` |
| api:webhooks | TC-BIL | POST | `/` | `server/src/routes/webhooks/marketing-msg91.routes.ts` |
| api:webhooks | TC-BIL | POST | `/` | `server/src/routes/webhooks/notifications-aisensy.routes.ts` |
| api:webhooks | TC-BIL | POST | `/` | `server/src/routes/webhooks/notifications-fcm.routes.ts` |
| api:webhooks | TC-BIL | POST | `/` | `server/src/routes/webhooks/notifications-msg91.routes.ts` |
| api:webhooks | TC-BIL | POST | `/` | `server/src/routes/webhooks/notifications-resend.routes.ts` |
