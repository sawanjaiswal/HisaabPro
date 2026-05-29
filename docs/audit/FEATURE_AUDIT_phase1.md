phase: 1A-1H (features 1-62)

# Feature Status Matrix — Adversarial Code Audit

Audited against `docs/HISAABPRO.md` lines 837–962. Each evidence path was
located (grep/glob), opened, and checked for real logic vs stub/TODO/missing.
"In-Progress (cred-blocked)" rows count as VERIFIED when code is complete up to
the credential boundary.

| # | feature | verdict | evidence checked | notes |
|---|---------|---------|------------------|-------|
| 1 | Auth — OTP login (MSG91) | VERIFIED | `routes/auth/login.ts`, `services/auth.service.ts`, OtpCode model, `LoginPage.tsx` | all present |
| 1 | Auth — JWT + refresh + httpOnly cookies | VERIFIED | `routes/auth/refresh.ts`, RefreshToken model, `lib/api.ts` 401 interceptor | present |
| 1 | Auth — Account lockout + CAPTCHA | VERIFIED | `services/auth.service.ts` lockout helpers | present |
| 1 | Auth — 2FA (TOTP + WebAuthn) | VERIFIED | `services/webauthn.service.ts`, `services/webauthn/*` (8 files), WebAuthnCredential model | full WebAuthn impl |
| 1 | Auth — Dev login | VERIFIED | `routes/auth/dev-login.ts` gated by `ALLOW_DEV_LOGIN` | gate confirmed line 25 |
| 2 | Subscription — state machine + writer SSOT | VERIFIED | `services/subscription/*` (state-machine, writer, types), Subscription/SubscriptionEvent models | complete; cred-blocked |
| 2 | Subscription — Razorpay webhook | VERIFIED (DRIFT) | `services/razorpay-webhook.service.ts` (205L) + WebhookEvent | sig verify lives in `lib/razorpay.ts` (HMAC+timingSafeEqual), not the named service — evidence path imprecise |
| 2 | Subscription — UPI Autopay mandate | VERIFIED | `routes/subscription/mandate.routes.ts`, UpiMandate model, `MandateSetupDrawer.tsx`, `upi-mandate.service.ts` | present |
| 2 | Subscription — Offline entitlement JWT (RS256) | VERIFIED | `entitlement-pubkey.route.ts`, `entitlement-verify.utils.ts`, `entitlement-idb.ts`, `entitlement-jwt.service.ts` | full RS256 chain |
| 2 | Subscription — PRO_MAX tier + add-ons | VERIFIED | FeatureAddon + BusinessAddon models, `AddonBadge.tsx`, `addon.service.ts` | present |
| 3 | Referral — code generation + crypto | VERIFIED | `services/referral/*` (code/fraud/rewards/withdrawal), ReferralCode/Event/Reward/Withdrawal models | present |
| 3 | Referral — wallet + UPI withdraw (stub) | VERIFIED | `routes/referral.ts` — 8 endpoints (count confirmed) | matches "8 endpoints" |
| 3 | Referral — fraud guards | VERIFIED | `services/coupon-fraud.ts` + `services/referral/fraud.ts` | both present |
| 4 | Notifications — engine (inbox + dispatch queue) | VERIFIED | `services/notification.service.ts` + `services/notifications/*` (dispatch/queue/manager), Notification/NotificationJob/PushToken models, `NotificationsPage.tsx` | page at `features/notifications/pages/` (minor path drift); complete |
| 4 | Notifications — Push (FCM) | VERIFIED | `routes/webhooks/notifications-fcm.routes.ts` | present; cred-blocked |
| 4 | Notifications — WhatsApp (Aisensy) | VERIFIED | `webhooks/notifications-aisensy.routes.ts` | present; cred-blocked |
| 4 | Notifications — Email (Resend) | VERIFIED | `webhooks/notifications-resend.routes.ts` | present; cred-blocked |
| 4 | Notifications — SMS (MSG91) | VERIFIED | `webhooks/notifications-msg91.routes.ts` | present; cred-blocked |
| 4 | Notifications — quiet hours + preferences | VERIFIED | NotificationPreference model + `notification-quiet-hours.service.ts` | present |
| 5 | Backup — local manual + list + download | VERIFIED | `routes/backup.ts`, `services/backup.service.ts` (create/list/get) | present |
| 5 | Backup — Google Drive backup | MISSING | `services/backup.service.ts` | NO Drive client / googleapis dep / oauth / upload anywhere in service. Only local backup exists |
| 5 | Backup — Email export | DRIFT | `export.ts`, `export.service.ts` | service generates a CSV-of-all-data download (`generateFullExport`); no email send. "Email export" is a data dump, not emailed |
| 5 | Backup — cooldown enforcement | VERIFIED | `backup.service.ts` `getCooldownStatus` | present |
| 6 | PWA — service worker + Workbox | VERIFIED | `serviceWorkerRegistration.ts`, `vite.config.ts` | present |
| 6 | PWA — Dexie mutation queue | VERIFIED | `lib/offline.ts`, `lib/api-cache.ts` | present |
| 6 | PWA — OfflineBanner + sync UI | VERIFIED | `components/feedback/OfflineBanner.tsx` | present |
| 6 | PWA — idempotency middleware | VERIFIED | `middleware/idempotency.ts`, IdempotencyLog model | present |
| 7 | Admin — framework (15 endpoints) | VERIFIED | `routes/admin/*` (dashboard/users/businesses/settings/coupons), AdminUser/AdminAction models | present |
| 7 | Admin — SUPER_ADMIN guard | VERIFIED | `lib/admin-auth.ts` (high-risk path) | present |
| 7 | Admin — coupons + broadcasts + impersonation | VERIFIED | `admin-coupons.ts`, `notifications-broadcast.ts` | present |
| 8 | Dark mode — CSS-var palette swap | VERIFIED | `styles/tokens-dark.css` + `context/ThemeContext.tsx` toggle | light/dark swap real |
| 8 | Theming — Classic/Modern/Minimal variants + ThemePicker | DRIFT | `context/ThemeContext.tsx`, `tokens.css` | Theme type is ONLY `'light'\|'dark'`. No classic/modern/minimal variants, no ThemePicker component found. Claim overstates a 2-mode toggle |
| 9 | Multi-language (EN/HI) | VERIFIED | `lib/translations.en.ts`, `translations.hi.ts`, `useLanguage()` | parity-enforced |
| 10 | Onboarding wizard | VERIFIED | `features/onboarding/` + verticals step | present |
| 11 | Party CRUD + soft-delete | VERIFIED | `services/party.service.ts`, Party model, `PartiesPage.tsx` | present |
| 12 | Party balances + statements | VERIFIED | `collections/statement.route.ts`, `PartyDetailPage.tsx` | present |
| 13 | Party multi-addresses | VERIFIED | PartyAddress model | present |
| 14 | Party credit limits | VERIFIED | `creditLimit` on Party | present |
| 15 | Party custom fields | VERIFIED | PartyCustomFieldValue + CustomFieldDefinition models | present |
| 16 | Party-wise pricing | VERIFIED | PartyPricing model + `services/pricing-resolver.ts` | present |
| 17 | Party opening balances | VERIFIED | OpeningBalance model | present |
| 18 | Sale invoice — create/edit/duplicate | VERIFIED | `services/document.service.ts`, Document(type=SALE) | present |
| 19 | Purchase invoice | VERIFIED | Document(type=PURCHASE) + purchases feature | present |
| 20 | Estimates CRUD + convert | VERIFIED | `routes/documents/convert-restore.ts`, `features/sales/EstimatesPage.tsx` | convertDocument in `services/document/convert.ts` |
| 21 | Proforma CRUD | VERIFIED | Document(type=PROFORMA) | present |
| 22 | Purchase Orders CRUD | VERIFIED | Document(type=PO) | present |
| 23 | Sale Orders CRUD + convert | VERIFIED | Document(type=SO), `SaleOrdersPage.tsx` | present |
| 24 | Delivery challan CRUD + convert | VERIFIED | Document(type=CHALLAN), `DeliveryChallansPage.tsx` | present |
| 25 | Document numbering | VERIFIED | DocumentNumberSeries model + `document-number.service.ts` | present |
| 26 | Additional charges | VERIFIED | DocumentAdditionalCharge model | present |
| 27 | Due dates | VERIFIED | Document.dueDate | present |
| 28 | Terms & Conditions templates | VERIFIED | TermsAndConditionsTemplate model | present |
| 29 | Digital signature | VERIFIED | DigitalSignature model | present |
| 30 | Auto WA/Email share | VERIFIED | DocumentShareLog model, `routes/documents/share.ts` (whatsapp+email) | present; cred-blocked |
| 31 | Image export JPG/PNG | VERIFIED | client-side canvas in template viewer | present |
| 32 | Email PDF | PARTIAL | `services/pdf.service.ts` + share route | **`pdf.service.ts` is a STUB — `generateInvoicePdf` logs and returns `null` (explicit TODO).** Server-side PDF not implemented; email-PDF cannot attach a real PDF |
| 33 | Recycle bin | VERIFIED | `routes/recycle-bin.ts`, `services/recycle-bin.service.ts` | present |
| 34 | Profit-during-sale margin chip | VERIFIED | `document-calc.ts` | present |
| 35 | Templates — 5+ base | VERIFIED | `features/templates/template-gallery*.configs.ts` | present |
| 36 | Templates — customization editor | VERIFIED | TemplateConfigPage + react-pdf | present |
| 37 | Print settings | VERIFIED | DocumentSettings model | present |
| 38 | Round-off toggle | VERIFIED | `document-calc.ts` `calculateRoundOff` (NONE/050/010) | present line 47 |
| 39 | Decimal precision | VERIFIED | DocumentSettings.decimalPlaces | present |
| 40 | Payment in/out — multi-invoice alloc | VERIFIED | `services/payment.service.ts`, Payment + PaymentAllocation | present |
| 40 | Payment — cash/UPI/bank/cheque | VERIFIED | Payment.mode enum + Cheque model | present |
| 41 | Outstanding + aging (4-bucket) | VERIFIED | `collections/aging.route.ts`, AgingReportPage | present |
| 42 | Payment reminders — auto WA/SMS | VERIFIED | PaymentReminder + ReminderInstance models | present; cred-blocked |
| 43 | Discount during payment | VERIFIED | PaymentDiscount model | present |
| 44 | Products CRUD — paise pricing | VERIFIED | `services/product.service.ts`, Product model | present |
| 45 | Stock in/out — immutable StockMovement | VERIFIED | StockMovement model + atomic write | present |
| 46 | Stock validation GLOBAL/WARN/HARD_BLOCK | VERIFIED | InventorySetting + `services/stock/*` (invoice-ops, batch-claim) | WARN_ONLY/HARD_BLOCK confirmed in code |
| 47 | Low-stock alerts | VERIFIED | StockAlert model + `stock-alert.service.ts` | present; cred-blocked |
| 48 | Categories + Units + conversions | VERIFIED | Category + Unit + UnitConversion models | present |
| 49 | Item custom fields | VERIFIED | ProductCustomFieldValue model | present |
| 50 | Dashboard — single endpoint | VERIFIED | `routes/dashboard.ts`, `DashboardPage.tsx` | present |
| 51 | Sale/Purchase reports + CSV | VERIFIED | `routes/reports.ts`, `report.service.ts` | present |
| 52 | Party statements PDF + CSV | VERIFIED | `collections/statement.route.ts` | present |
| 53 | Stock summary report | VERIFIED | `routes/reports.ts` | present |
| 54 | Day book | VERIFIED | `features/reports/DayBookPage.tsx` | present |
| 55 | Payment history per-party | VERIFIED | Payment list + PartyDetailPage tab | present |
| 56 | Custom roles — permission matrix | VERIFIED | Role model + JWT claims | present |
| 57 | Txn lock + approvals | VERIFIED | TransactionLockConfig + ApprovalRequest models | present |
| 58 | PIN/passcode app-level lock | VERIFIED (DRIFT) | `routes/auth-pin.routes.ts`, `PinPad.tsx`, PinResetToken model | **No `PinCredential` model — PIN stored as `pinHash` on the User model (schema line 19).** Feature works; evidence model name is wrong |
| 59 | Biometric — Capacitor plugin | VERIFIED | `routes/biometric.ts` (WebAuthn-based) + settings UI | present up to plugin-install boundary; cred-blocked |
| 60 | Date format per-business | VERIFIED | UserAppSettings.dateFormat | present |
| 61 | Keyboard shortcuts — global hotkeys | PARTIAL | `features/settings/ShortcutsPage.tsx`, `shortcut.constants.ts` | **Claimed `hooks/useKeyboardShortcuts.ts` does NOT exist. No global keydown/metaKey/ctrlKey listener wired anywhere.** ShortcutsPage is a display-only reference list ("desktop only" note); shortcuts are documented, not active |
| 62 | Calculator FAB | DRIFT | `features/settings/CalculatorOverlay.tsx` | **No `components/ui/CalculatorFab.tsx`.** Calculator exists as `CalculatorOverlay` (invoked from SideNav), not a floating action button at the claimed path |

## SSOT violations

- `src/lib/format.ts` vs `src/features/import/utils/format-currency-bigint.ts` — two currency-formatting implementations (general number vs bigint-paise). Same Indian-format datum derived in two places; risk of divergence on grouping/symbol rules. Consolidate the bigint variant onto the canonical `format.ts`.
- `server/src/services/razorpay-webhook.service.ts` vs `server/src/lib/razorpay.ts` — webhook signature secret resolution (`getWebhookSecret`/`RAZORPAY_WEBHOOK_SECRET`) lives in `lib/razorpay.ts` while event processing lives in the service; not a true duplicate, but the matrix evidence attributes signature verification to the wrong file (doc/code drift, listed here for traceability).

(No duplicated tax-math found — `tax-calc.ts` and `document-calc.ts` have distinct responsibilities.)

## Non-standard code

- `src/features/settings/audit-log.service.ts:133` — raw `fetch()` instead of `api()` (binary export; bypasses offline queue/CSRF). Outside strict Phase 1 scope but flagged.
- `src/features/invoices/invoice-share.service.ts:104` — raw `fetch()` for binary blob export (related to #30/#31 share). Comment says api() can't return binary; still bypasses replay/refresh.
- `src/features/recurring/components/RecurringActionMenu.tsx:53` — `window.confirm(...)` instead of `<ConfirmDialog>` (PAGE_AUDIT_CHECKLIST C forbids window.confirm). Outside strict Phase 1 scope.
- `server/src/services/notifications/notification-templates.data.ts` — 511 lines (>250-line limit). Data file, but exceeds the file-length rule.
- `server/src/services/pdf.service.ts` — `TODO: Implement with server-side React-PDF renderer` and returns `null` (the #32 stub above).
