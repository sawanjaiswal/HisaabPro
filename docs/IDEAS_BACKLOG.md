# Ideas Backlog: HisaabPro

Last updated: 2026-04-11

> Feature ideas and enhancements not yet in active development. Items graduate to FEATURE_MAP.md when prioritized for a phase.

---

## DudhHisaab Imports (Post-Launch Hardening)

> Features identified during a full DudhHisaab scan (2026-04-11) that would harden HisaabPro for production. DudhHisaab is 2.5x larger (369 endpoints vs HP's ~130) and mature on infrastructure; HP can reuse non-dairy logic wholesale.

### #1 — Notification System (SMS/WhatsApp/Push/Email/In-app)
- **Priority:** P1
- **Status:** BACKLOG (HP has backend stubs marked "needs credentials"; DH has 17-file production system)
- **Effort:** M (3-4 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/server/src/services/notifications/`, `/server/src/routes/admin/notification*.routes.ts`
- **What it gives:**
  - Strategy pattern (`notification-strategy.ts`) supporting multiple channels
  - WhatsApp Business API provider (`whatsapp.providers.ts`)
  - Scheduled sending + queue infrastructure
  - User preferences UI (opt-in/opt-out per channel)
  - Cost estimator (per-channel pricing)
  - Admin controls (send broadcasts, view delivery status)
- **Unblocks:** Payment reminders (currently 50% built, blocked on this)
- **Dependencies:** Bull/Redis queues (see cross-cutting #1)
- **Migration:** Adapt DH's provider integrations to HP's env vars. Core notification engine ports as-is.

### #2 — Fraud Detection + Audit Logger
- **Priority:** P1
- **Status:** BACKLOG (HP has only `coupon-fraud.ts` stub)
- **Effort:** M (1-2 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/server/src/services/fraud/` (`anomaly-detection.service.ts`, `audit-logger.service.ts`)
- **What it gives:**
  - Risk scoring on invoice edits, payment reversals, excessive activity
  - Structured audit logs (actor, action, timestamp, IP, payload diff)
  - Edit-pattern flagging (e.g., same invoice edited 5x in 1 hour → flag)
  - Suspicious transaction alerts
- **Why critical:** GST compliance audit trails, dispute resolution, insider threat detection
- **Wire into:** invoice/payment mutation routes, admin actions, user settings changes

### #3 — Smart Recommendation Engine
- **Priority:** P2
- **Status:** BACKLOG
- **Effort:** M (2 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/server/src/services/recommendation.service.ts`
- **What it gives:**
  - When user approaches plan limit, compare: extend with pack vs upgrade plan vs pay usage
  - Surface cheapest option on dashboard as a subtle CTA
  - Direct ARPU lever (nudges upgrades before churn)
- **Adapt:** Rewire for HP's Razorpay subscription model + coupon system

### #4 — Analytics & Insights Dashboard
- **Priority:** P2
- **Status:** BACKLOG
- **Effort:** L (5-7 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/server/src/services/analytics/` (11 files)
- **What it gives:**
  - Daily/monthly/today aggregation jobs
  - Feature usage tracking (which invoice templates, which reports, etc.)
  - Session stats, power-user identification
  - Admin growth dashboard data source
- **New tables needed:** `analytics_daily_aggregate`, `feature_usage_event`
- **New cron jobs:** nightly aggregation
- **Dependencies:** Bull/Redis queues

### #5 — Advanced Rate Limiting + Auth Security Stack
- **Priority:** P1
- **Status:** BACKLOG (HP has basic rate limit; DH has granular)
- **Effort:** M (1 day)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/server/src/middleware/` (31 files vs HP's 17)
- **What it gives:**
  - Per-endpoint rate limits (`rate-limit-phone-otp.ts`, `rate-limit-auth-tracker.ts`)
  - Admin session timeout with forced re-auth
  - IP whitelist support
  - CAPTCHA triggered after N failures
  - Idempotency middleware (replay protection)
- **Why:** Pure security hardening, zero product risk, improves Play Store quality rating

### #6 — Payment Reminders Frontend UI
- **Priority:** P2
- **Status:** BACKLOG (HP has backend only)
- **Effort:** M (2 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/src/features/payment-reminders/`
- **What it gives:**
  - `usePaymentReminders` hook
  - Reminder preferences page
  - Schedule editor (per customer, recurring cadence)
  - Delivery status tracker
- **Dependencies:** #1 Notification System

### #7 — Team Escalations & Approvals
- **Priority:** P3
- **Status:** BACKLOG
- **Effort:** M (2-3 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/src/features/team/`
- **What it gives:**
  - Owner-only escalation chains (staff action → owner approves)
  - Team dashboard for approvers
  - Role handoff workflows
- **Target user:** Priya (growing wholesaler) and Amit (distributor) personas with multi-staff teams

### #8 — Global Search Service
- **Priority:** P3
- **Status:** BACKLOG
- **Effort:** M (2 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/server/src/services/search/search.service.ts`
- **What it gives:**
  - Full-text search across parties, invoices, products, payments
  - ⌘K command palette pattern
- **Why:** UX quality for users with 1000+ parties, 5000+ invoices
- **DB changes:** Add `pg_trgm` GIN indexes on searchable columns

### #9 — Recurring Invoices Scheduler
- **Priority:** P2
- **Status:** BACKLOG (HP has `recurring.service.ts` backend but no scheduler wiring — invoices never fire)
- **Effort:** L (3 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/server/src/queues/`, `/server/src/schedulers/`
- **What it gives:**
  - Cron-based recurring job infrastructure
  - Invoice generation on schedule
  - Payment due-date notifications
  - Statement generation
- **Dependencies:** Bull/Redis queues + #1 Notification system

### #10 — Email Template Engine
- **Priority:** P2
- **Status:** BACKLOG
- **Effort:** M (2 days)
- **Source:** `/Users/sawanjaiswal/DudhHisaab/server/src/services/email/`, `/services/notifications/templates.ts`
- **What it gives:**
  - Reusable email templates with variable substitution
  - Bulk sending via queue
  - Delivery tracking
  - Used by invoices, statements, reminders, welcome emails

---

### Cross-cutting Patterns (infrastructure, not features)

**X1 — Bull/Redis Queue Infrastructure** (Priority: P1, Effort: S, 1 day)
- Source: `/Users/sawanjaiswal/DudhHisaab/server/src/queues/`
- Decouples heavy work from request handlers
- Prerequisite for #1 Notifications, #4 Analytics, #9 Recurring invoices
- Setup: Redis URL in env, Bull worker process, shared job types

**X2 — Middleware Hardening** (Priority: P2, Effort: S, 0.5 day)
- Source: `/Users/sawanjaiswal/DudhHisaab/server/src/middleware/`
- Port: `edit-window.middleware.ts` (block edits after N hours — compliance), `admin-session-timeout.ts`, `scrub-response.ts` (redact sensitive fields from responses)

**X3 — Domain-Specific Error Classes** (Priority: P3, Effort: S, 0.5 day)
- Source: `/Users/sawanjaiswal/DudhHisaab/server/src/utils/errors.ts`
- Standardized error hierarchy with status codes; makes error handling predictable across routes

**X4 — Scheduler Architecture** (Priority: P1, Effort: S, 0.5 day)
- Source: `/Users/sawanjaiswal/DudhHisaab/server/src/schedulers/`
- Cron job registry pattern
- Prerequisite for #4 Analytics aggregation, #9 Recurring invoices

---

### Skip (DH-specific, not for HP)

- Delivery tracking / route optimization (requires GPS, not relevant for B2B billing)
- Quality metrics (fat %, milk grading, supplier rate sheets)
- Customer portal (dairy-specific, not applicable)
- Coins/loyalty wallet (DH reward structure doesn't fit HP)
- Supplier centers / pack management / rate changelogs

### Already in HP (verify don't build)

- ✅ Referral system (`server/src/services/referral.service.ts` + frontend `/referrals`)
- ✅ Backup / restore / Google Drive export
- ✅ Offline-first PWA (IndexedDB, service worker, sync queue)
- ✅ 2FA / WebAuthn (imported from DH, verify wired in login)
- ✅ Push notifications backend (UI preferences missing — low-hanging fruit)
- ✅ Coupon system with fraud detection
- ✅ Razorpay subscriptions

---

---

### Second-Pass Scan (2026-04-11) — Utilities, i18n, Exports, UX Polish

> First pass missed frontend utilities. These are smaller imports but together transform HP's UX polish to match DH's maturity.

#### i18n / Multi-Language (P1 — before international rollout)
- **i18n-1 LanguageContext + setNumberScript** (S, 1 day) — `/DudhHisaab/frontend/src/context/LanguageContext.tsx` + `/utils/format.ts`. Tri-language (en/hi/hinglish), localStorage sync, `<html lang>` a11y, module-level digit script setter.
- **i18n-2 Devanagari digit rendering** (S, 0.5 day) — `localizeDigits()` in `/utils/format.ts`. Converts 1,50,000 → १,५०,०००. Essential for Hindi number display.
- **i18n-3 Translations file with Hinglish** (M, 2 days) — `/DudhHisaab/frontend/src/translations.ts` (620KB). All UI strings in en/hi/hinglish. HP copies structure, strips milk-specific terms.
- **i18n-4 Amount-in-words** (S, 0.5 day) — Indian format: "1,50,000" → "one lakh fifty thousand" / "एक लाख पचास हज़ार" / "ek lakh pachas hazaar". Required for invoice PDFs (legal requirement for Indian invoices).

#### Exports: PDF / CSV / XLSX (P1 — GST filing, reporting, sharing)
- **exp-1 CSV export framework** (S, 0.5 day) — `/DudhHisaab/frontend/src/utils/csvExport.ts`. Formula-injection guards (prefix dangerous cells with `'`), generic for any entity. Reuse for parties, invoices, items, payments.
- **exp-2 XLSX exporter (SheetJS)** (S, 1 day) — `/DudhHisaab/frontend/src/utils/xlsxExporter.ts`. Multi-sheet workbooks, auto-fit columns. Required for GST filing + bank reconciliation workflows.
- **exp-3 PDF report builder modules** (M, 3 days) — `/DudhHisaab/frontend/src/utils/pdf/` directory. Reusable sections: header, line-item table, summary card, payment grid, QR block. Shared jsPDF config. HP uses react-pdf today — evaluate if DH's jsPDF approach is worth migrating OR adopt section pattern in react-pdf.
- **exp-4 Native file share** (M, 1 day) — `/DudhHisaab/frontend/src/utils/nativeFileShare.ts`. SSOT for all downloads/shares. Platform-aware: Capacitor Filesystem + Share plugins (native) → anchor/Web Share API (browser). Fixes Android 15+ FileProvider bugs.
- **exp-5 PDF share via WhatsApp** (M, 1 day) — `/DudhHisaab/frontend/src/utils/pdfShare.ts`. Two-stage: upload 24h temp URL → open `wa.me` with pre-filled message. Supports REFERRAL_CTA injection for viral growth.
- **exp-6 Customer statement PDF** (M, 2 days) — line-item history + payment records + balance summary + aging. Critical for B2B collections.
- **exp-7 Reconciliation PDF** (M, 2 days) — matched/unmatched flags, for bank/party reconciliation audits.

#### Number / Currency / Date (P1 — foundational, blocks other work)
- **fmt-1 Indian currency formatter** (S, 0.5 day) — `formatCurrency()` with ₹1,50,000 grouping + thin space (U+2009). HP's current format.ts is minimal.
- **fmt-2 Compact currency** (S, 0.5 day) — `formatCurrencyCompact()` → ₹12.3L, ₹1.5Cr, ₹5k. For dashboard KPIs, analytics cards.
- **fmt-3 Timezone-safe dates** (S, 0.5 day) — `/DudhHisaab/frontend/src/utils/date.ts`. **CRITICAL BUG FIX:** `new Date().toISOString().split('T')[0]` returns wrong date in IST after midnight. DH's `getTodayLocal()`, `getLocalDateNDaysAgo()`, `getFirstDayOfCurrentMonth()` are battle-tested. **Audit HP for this bug in `src/lib/date.ts`.**
- **fmt-4 Display date formatter** (S, 0.5 day) — "3 Jan 2025" en-IN locale without needing date-fns.
- **fmt-5 Filename sanitization** (S, 0.5 day) — safe filenames for downloads, prevents XSS.

#### Input Validation (P2)
- **val-1 Phone normalize + validate** (S, 0.5 day) — handles +91/0091/091/0 prefixes, live-typing friendly.
- **val-2 Unicode name validation** (S, 0.5 day) — supports "Dr. Rajesh Kumar-Singh" + "राज कुमार". HP likely strips non-ASCII.
- **val-3 Contact sanitizer** (S, 0.5 day) — strips phone-book junk (digits, brackets, underscores) before validation. Critical for imported contacts.
- **val-4 Address sanitizer** (S, 0.5 day) — strips HTML tags + max length enforcement.
- **val-5 Phone input formatter** (S, 0.5 day) — real-time controlled input, auto-limit to 10 digits.

#### UI Components / Feedback / Polish (P2)
- **ui-1 Sound effects via Web Audio** (S, 0.5 day) — `/DudhHisaab/frontend/src/utils/sounds.ts`. Success chime + descending skip tone. No audio files, offline-safe. Adds delight.
- **ui-2 Feedback widget + offline queue** (M, 2 days) — `/DudhHisaab/frontend/src/components/ui/FeedbackWidget.tsx` + `services/feedbackQueue.ts`. Screenshot + note input + IndexedDB queue + auto-sync on reconnect. Critical for getting real user feedback post-launch.
- **ui-3 Bottom drawer / Mobile drawer** (M, 1 day) — `/DudhHisaab/frontend/src/components/ui/BottomDrawer.tsx`. Mobile-first filter/action pattern. Better than desktop modals on mobile.
- **ui-4 Numpad dialog** (M, 1 day) — `/DudhHisaab/frontend/src/components/ui/NumpadDialog.tsx`. Custom number input — faster than Android soft keyboard for payment/quantity entry.
- **ui-5 OTP input group + timer** (S, 0.5 day) — masked digit-by-digit input with countdown. Better UX than single 6-char input.
- **ui-6 Filter pills + presets** (S, 1 day) — horizontal scrollable chips + canned combinations (This Month, Outstanding, etc.).
- **ui-7 Help tooltip** (S, 0.5 day) — contextual help icons with hover popover.
- **ui-8 Bulk action bar** (M, 1 day) — sticky footer for multi-select actions.
- **ui-9 Action menu** (S, 0.5 day) — compact dropdown for row actions (view/edit/delete/share/export).
- **ui-10 Date range picker calendar** (M, 2 days) — inline calendar for report filters.
- **ui-11 Page state wrapper** (M, 1 day) — consistent loading/error/empty states.
- **ui-12 QR code generator** (S, 0.5 day) — uses `qrcode.react`. For business invite QR, party onboarding QR.
- **ui-13 WhatsApp contact component** (S, 0.5 day) — phone number → tappable wa.me link.
- **ui-14 Push notification prompt** (S, 0.5 day) — explainer UI before requesting permission. Improves opt-in rate.
- **ui-15 Illustrations set** (M, 2 days) — branded SVG empty states, errors, onboarding. HP needs its own (no cow/buffalo).

#### Growth / Engagement / Onboarding (P2)
- **gro-1 Feature flags system** (S, 1 day) — `/DudhHisaab/frontend/src/config/features.ts`. 20+ flags, phase metadata, `useFeatureGate()` hook. Gradual rollout without redeploy. Essential for safe prod experiments.
- **gro-2 A/B testing framework** (M, 2 days) — `/DudhHisaab/frontend/src/utils/ab-testing.ts`. Deterministic variant assignment (consistent hashing), traffic %, `useABTest()` hook, conversion tracking. DH tests CTAs, button text, entry placement.
- **gro-3 Onboarding wizard** (L, 5 days) — `/DudhHisaab/frontend/src/components/onboarding/`. Multi-step: type → import contacts → configure → review. Production-hardened, handles duplicates.
- **gro-4 Contact importer + dedup** (M, 2 days) — bulk import from device contacts with duplicate detection UI and merge options. Saves hours for users with 50+ parties.

#### Developer Tools / Infrastructure (P3)
- **dev-1 LocalStorage SSOT** (S, 0.5 day) — `/DudhHisaab/frontend/src/utils/storage.ts`. Typed keys, biometric device binding, IndexedDB clear on logout, SW cache clearing.
- **dev-2 Image compression** (M, 1 day) — `/DudhHisaab/frontend/src/utils/image-compression.ts`. Canvas-based, iterative quality reduction, presets (mobile/web/thumbnail). Prevents 5MB+ files from crashing mobile browsers.
- **dev-3 Metadata collector** (S, 0.5 day) — viewport, UA, route for analytics/feedback context.
- **dev-4 Safe string utilities** (S, 0.5 day) — XSS prevention wrapper.
- **dev-5 Google Drive backup/restore** (M, 2 days) — encrypted backup, restore on new device. GDPR data portability. (HP may already have — verify.)

#### Custom Hooks (missing in HP)
- **hk-1 useMediaQuery** (S) — responsive breakpoint detection
- **hk-2 useSwipeBack** (S) — Android back gesture
- **hk-3 useSwipe + useSwipeCard** (S) — swipe-to-delete, swipe-to-mark-paid
- **hk-4 useLongPress** (S) — context menu trigger
- **hk-5 useFocusTrap** (S) — a11y modal focus confinement
- **hk-6 useMobileKeyboard** (S) — detect soft keyboard, adjust layout
- **hk-7 useUnsavedChanges** (S) — warn before leaving form
- **hk-8 useFontSize** (S) — respect user's accessibility size preference
- **hk-9 useGeolocation** (M) — for route tracking, delivery features
- **hk-10 useFeatureGate** (S) — conditional feature rendering (prereq for gro-1)

#### Cross-cutting / Backend
- **X5 — Statement generation service** (M, 3 days) — `/server/src/services/statement/`. Generic builder for line items + summary + balance. Reusable for customer, supplier, GL statements.
- **X6 — Rate propagation service** (M, 2 days) — `/server/src/services/rate-propagation.service.ts`. Cascades rate changes across related records (e.g., party rate change → affects draft invoices).
- **X7 — Reconciliation service** (L, 4 days) — `/server/src/services/reports/reconciliation.service.ts`. Matches transactions between two books. GL reconciliation foundation.

---

### Recommended Ship Order (post-launch hardening)

**Week 1 — Security + Infra foundation (4 days)**
1. X1 Bull/Redis queues (1 day) — prereq for everything else
2. #5 Rate limiting stack (1 day) — pure hardening
3. #2 Fraud detection + audit logger (1-2 days) — compliance

**Week 2 — Payment reminders (5 days)**
4. #1 Notification system (3-4 days)
5. #6 Payment reminders UI (1-2 days)

**Week 3 — Revenue + Automation (4-5 days)**
6. X4 Scheduler architecture (0.5 day)
7. #9 Recurring invoices scheduler (3 days)
8. #10 Email template engine (1-2 days)

**Week 4 — Growth + Polish (5 days)**
9. #4 Analytics dashboard (4-5 days)
10. #3 Smart recommendations (2 days)

**Total: ~4 weeks of focused work for all P1-P2 imports.**

---

## Admin Panel (Gold Standard)

### Full Admin Frontend — Dashboard, Users, Businesses, Coupons, Settings
- **Priority:** P1 (post-launch, within 1 month of Play Store production release)
- **Status:** BLUEPRINTED (architecture complete, implementation pending)
- **Owner:** TBD
- **Estimate:** 2-3 days full-time
- **Prereqs:** Play Store closed testing → production rollout complete
- **Deployed at:** `admin.hisaabpro.in` (host routing already in `App.tsx` HomeGate; currently stubbed to show `CouponsPage` only)

#### Backend status
All 6 admin routes already exist and are tested:
- `server/src/routes/admin/admin-auth.ts` — login/refresh/logout/me (JWT Bearer, separate from user cookies, SUPER_ADMIN and ADMIN roles)
- `server/src/routes/admin/admin-users.ts` — list/detail/suspend/unsuspend/unlock
- `server/src/routes/admin/admin-businesses.ts` — list/detail (read-only)
- `server/src/routes/admin/admin-dashboard.ts` — overview metrics + growth timeseries
- `server/src/routes/admin/admin-coupons.ts` — full CRUD (already wired to existing frontend)
- `server/src/routes/admin/admin-settings.ts` — in-memory settings (⚠️ resets on server restart — add DB persistence in v2)

#### Frontend status
- `src/features/admin/coupons/` — complete, needs migration into new shell layout
- Everything else missing

#### Architecture decisions (from blueprint — 2026-04-11)
1. **Single bundle, route group** — reuse existing lazy-loaded route split. Do NOT create separate Vite entry.
2. **Single source of truth for types** — `src/types/admin.types.ts` mirrors Zod schema types from `server/src/schemas/admin.schemas.ts`. Two-file edit on each schema change (acceptable trade for monorepo complexity).
3. **Separate admin auth** — `localStorage` Bearer tokens (`admin_access_token` + `admin_refresh_token`), new `AdminAuthContext` + `AdminAuthGate` (do NOT reuse user `AuthContext`). Refresh token rotation handled by backend.
4. **Dark professional shell** — distinct from customer cream app. Sidebar `--color-primary-700` (#042329), topbar white, content cream. Linear/Stripe dashboard vibe.
5. **Charts** — Recharts (~30kb per type, lazy-loaded on dashboard only)
6. **No captcha on admin login v1** — add later once `VITE_TURNSTILE_SITE_KEY` configured
7. **Businesses detail read-only** — no suspend action until backend POST endpoint added
8. **Settings warning banner** — "Settings reset on server restart, DB persistence coming in v2"

#### 9 Build phases
1. **Foundation** — `admin.types.ts`, `adminApi()` in `lib/api.ts`, `admin.*` query keys, route constants, `AdminAuthContext`, login page, `AdminAuthGate`
2. **Shell + routing** — `AdminSidebar`, `AdminTopbar`, `AdminShell`, `AdminRoot`, update `HomeGate` in `App.tsx`, lazy imports in `app.routes.ts`
3. **Shared components** — `AdminStatCard`, `AdminBadge`, `AdminPageHeader`, `AdminFilterBar`, `AdminDataTable`, `AdminChartWrapper`, `ConfirmActionModal`
4. **Dashboard** — 4 stat tiles, line chart, period selector, clickable cards
5. **Users** — list with filters/pagination, detail with stats + suspend/unsuspend/unlock actions
6. **Businesses** — mirror of Users phase, read-only
7. **Coupons migration** — remove `Header`/`PageContainer`, use `AdminPageHeader`, switch service to `adminApi()`
8. **Settings** — toggle + number inline edit with optimistic updates
9. **Polish** — entrance animations, mobile drawer, `aria-*` audit, role gating, empty states

#### File tree summary
~60 new files across `src/features/admin/{auth,layout,components,dashboard,users,businesses,settings}/` plus `src/context/AdminAuthContext.tsx`, `src/types/admin.types.ts`, mods to `App.tsx`, `app.routes.ts`, `routes.config.ts`, `query-keys.ts`, `lib/api.ts`.

#### Reused existing components
`ErrorState`, `EmptyState`, `Skeleton`, `Spinner`, `Modal`, `ConfirmDialog`, `Drawer`, `ErrorBoundary`, `Turnstile`, `ToastContainer` — all from `src/components/`.

#### Open items / future
- DB persistence for settings (currently in-memory)
- Businesses POST endpoints (suspend/deactivate)
- CSV export on data tables
- Audit log viewer (backend logs mutations already, frontend missing)
- Razorpay offer API sync for coupons

---

## Payments & Subscriptions

### Coupon / Discount Code System
- **Priority:** P2 (post-MVP)
- **Status:** DONE (shipped 2026-03-27)
- **Feature Map:** #96 (Phase 7)
- **Description:** Admin creates discount coupons (e.g., "LAUNCH20" = 20% off). Users apply at checkout. Discount applies for first billing cycle only — full price on renewal. Uses Razorpay Subscriptions coupon API.
- **What was built:**
  - Backend: full CRUD + validate/apply/remove + Zod schemas + fraud detection (lockout, velocity, cycling) + rate limiting
  - Admin UI: CouponsPage, CouponDetailPage, CouponForm, CouponCard + bulk generate
  - Checkout: CouponInput component + validate/apply/remove service
  - Razorpay: couponCode passed in subscribe flow, razorpayOfferId linked
  - Prisma: Coupon + CouponRedemption models with indexes
  - Routes wired in App.tsx + routes.config.ts
- **Remaining (nice-to-have):**
  - CSV export of coupon usage stats
  - Razorpay offer API sync (currently stores razorpayOfferId but doesn't auto-create offers)

---

## How to Use This File

1. **Add ideas** under the appropriate module heading (create new headings as needed)
2. **Graduate to FEATURE_MAP.md** when the idea is prioritized and assigned a phase
3. **Include:** priority estimate, scope, dependencies, technical notes
4. **Keep it lean** — enough detail to evaluate, not a full PRD
