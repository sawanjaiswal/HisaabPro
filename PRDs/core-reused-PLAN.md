# Mission Plan: Core & Reused Modules | Status: Awaiting Approval

> **PRD #:** 1
> **Date:** 2026-03-14
> **Owner:** Sawan Jaiswal
> **Scope:** 10 features reused/adapted from DudhHisaab
> **Estimated Build Time:** 10-14 days
> **Architecture:** Modular monolith — 2 repos (`@hisaab/core` shared package + `hisaab-app` new app)
> **Depends On:** Nothing (this is the foundation layer)
> **Blocks:** Every other PRD

---

## 1. What

This module extracts, adapts, and ships the 10 core infrastructure features from DudhHisaab into `@hisaab/core` — a shared package that HisaabApp (and any future Hisaab product) consumes. It covers auth, payments, referrals, notifications, backup, offline sync, admin panel, theming, i18n, and onboarding. These are production-tested systems with 1+ year of real-user data; the work is adaptation (multi-tenant, generic business types, new subscription tiers) not invention.

---

## 2. Features Detail

### Feature 1: Auth (OTP Login, JWT, Refresh Tokens, 2FA, WebAuthn)

**Reuse:** 95% from DudhHisaab
**What it does:** Phone-based OTP signup/login. JWT access tokens (15 min) + refresh tokens (30 days). Optional 2FA via TOTP authenticator app. WebAuthn for biometric/passkey login on supported devices. Session management (max 5 concurrent devices). Force logout on password change.

**What's reused as-is:**
- OTP generation, delivery (WhatsApp via Aisensy, SMS fallback), verification
- JWT signing/verification, refresh token rotation
- 2FA TOTP setup, verification, recovery codes
- WebAuthn registration/authentication
- Rate limiting (5 OTP attempts per phone per hour, 3 login attempts per minute)

**What's adapted:**
- User model gains `businessType` field (was hardcoded to "dairy")
- Remove DudhHisaab-specific onboarding fields from auth response
- Add `appId` to JWT payload — distinguishes HisaabApp vs DudhHisaab tokens
- Password is now OPTIONAL at signup (OTP-only login supported, password set later in settings)

**What's new:**
- Nothing — auth is feature-complete from DudhHisaab

---

### Feature 2: Subscription & Billing (Razorpay, Tiers, Add-ons)

**Reuse:** 85% from DudhHisaab
**What it does:** Three subscription tiers gated by features. Razorpay integration for monthly/yearly billing. Add-on purchases. Grace period on expiry. Proration on upgrades.

**Tier matrix:**

| Gate | Free | Pro (Rs 299/mo, Rs 2,499/yr) | Business (Rs 599/mo, Rs 4,999/yr) |
|------|------|------|----------|
| Users | 1 | 3 | Unlimited |
| Invoices/month | 50 | Unlimited | Unlimited |
| GST invoicing | No | Yes | Yes |
| Custom roles | No | Yes | Yes |
| Reports | Basic (dashboard, day book) | All | All |
| Multi-godown | No | No | Yes |
| POS mode | No | No | Yes |
| Tally export | No | No | Yes |
| E-invoicing | No | No | Yes |
| Priority support | No | Yes | Yes |
| WhatsApp support | No | Yes (8h response) | Yes (2h response) |
| Backup frequency | Manual only | Hourly auto | 15-min auto |
| Custom invoice templates | 2 | 10 | Unlimited |
| Add-ons | No | Yes | Included |

**Add-ons (Pro tier only):**
- Extra user seat: Rs 99/mo per user
- Multi-godown: Rs 149/mo
- E-invoicing: Rs 99/mo

**What's reused as-is:**
- Razorpay subscription creation, webhook handling, payment verification
- Grace period logic (7 days after expiry, read-only mode, then data frozen)
- Proration calculation on mid-cycle upgrade
- Receipt generation, email delivery

**What's adapted:**
- Tier names changed (DudhHisaab had Free/Premium/Enterprise)
- Feature gates table completely rewritten for HisaabApp feature set
- Pricing changed (DudhHisaab was Rs 199/Rs 499)
- Add-on system expanded (DudhHisaab had only extra users)
- Invoice limit counter (new — DudhHisaab had no invoice cap on free tier)

**What's new:**
- Add-on purchase flow for Pro tier
- Invoice quota tracking + enforcement (soft limit at 45/50, hard block at 50)
- Yearly plan discount badge in UI ("Save 30%")

---

### Feature 3: Referral & Earn (Codes, Wallet, UPI Withdrawal, Fraud Detection)

**Reuse:** 85% from DudhHisaab
**What it does:** Every user gets a unique referral code. Referrer earns Rs 50 when referred user creates their first invoice. Earnings go to in-app wallet. Withdraw to UPI (min Rs 100). Fraud detection blocks self-referrals, device fingerprint abuse, and suspicious patterns.

**Referral reward structure:**

| Event | Referrer Gets | Referred Gets |
|-------|--------------|---------------|
| Referred user signs up | Nothing (signup alone is not rewarded) | Nothing |
| Referred user creates first invoice | Rs 50 | Rs 25 credit toward Pro |
| Referred user subscribes to Pro/Business | Rs 100 bonus | 10% off first payment |
| Referrer hits 10 successful referrals | Rs 200 bonus | — |

**What's reused as-is:**
- Referral code generation (8-char alphanumeric, collision-checked)
- Wallet balance tracking, transaction history
- UPI withdrawal via Razorpay Payouts (min Rs 100, max Rs 5,000/day)
- Fraud detection: same device fingerprint, same IP cluster, inactive referred accounts

**What's adapted:**
- Reward amounts changed (DudhHisaab was Rs 30/Rs 15)
- Trigger changed from "first milk entry" to "first invoice"
- Added tiered bonus at 10 referrals
- Added discount-on-subscription reward for referred user

**What's new:**
- Referral leaderboard (top 10 referrers this month — gamification)
- Shareable referral card (image with code + QR, share via WhatsApp)

---

### Feature 4: Notifications (Push, Email, WhatsApp, SMS, Quiet Hours)

**Reuse:** 85% from DudhHisaab
**What it does:** Multi-channel notification system. FCM for push notifications. Resend for transactional email. Aisensy for WhatsApp Business API messages. SMS via provider TBD. User-configurable quiet hours. Per-channel opt-out. Notification center in-app.

**Notification types:**

| Type | Channels | Trigger |
|------|----------|---------|
| OTP | WhatsApp > SMS | Signup/login |
| Payment reminder | WhatsApp > Push | Scheduled or manual |
| Invoice shared | WhatsApp / Email | User action |
| Backup failed | Push | System event |
| Subscription expiring | Push + Email + WhatsApp | 7 days, 3 days, 1 day before |
| Low stock alert | Push | Stock falls below minimum |
| Staff invite | WhatsApp > SMS | Owner adds staff |
| Referral reward | Push + In-app | Referred user qualifies |
| Sync conflict | Push + In-app | Conflict detected |
| New login detected | Push + Email | Login from new device |

**What's reused as-is:**
- FCM token management, push delivery, retry logic
- Resend email templating (MJML templates), delivery, bounce handling
- Aisensy WhatsApp template message sending, status tracking
- Quiet hours enforcement (default 10 PM - 7 AM IST, user-configurable)
- Notification center UI (bell icon, badge count, mark read/unread)
- Channel preference storage per user

**What's adapted:**
- Notification types expanded (DudhHisaab had 6, HisaabApp has 10+)
- Template messages rewritten for generic business context (not dairy-specific)
- WhatsApp templates need re-approval from Aisensy for new business use case

**What's new:**
- Low stock alert notification
- Sync conflict notification
- Bulk payment reminder (send to multiple parties at once)

---

### Feature 5: Backup (Local Device + Google Drive + Email Export, Encryption, Scheduled, Restore)

**Reuse:** 90% from DudhHisaab
**What it does:** Three backup destinations: local device storage, Google Drive, email (as encrypted attachment). AES-256 encryption with user-set password. Scheduled auto-backup (frequency by tier). Manual backup anytime. Restore from any backup. Backup includes all data: invoices, parties, products, payments, settings.

**Backup matrix by tier:**

| Aspect | Free | Pro | Business |
|--------|------|-----|----------|
| Local backup | Manual only | Hourly auto | 15-min auto |
| Google Drive | Manual only | Hourly auto | 15-min auto |
| Email export | 1/day limit | Unlimited | Unlimited |
| Backup size limit | 50 MB | 500 MB | 2 GB |
| Retention (Drive) | Last 5 | Last 30 | Last 90 |
| Encryption | Optional | Optional | Mandatory |

**Backup data format:**
```
hisaab-backup-{businessId}-{timestamp}.hbk
├── metadata.json     (version, businessId, timestamp, checksum)
├── data.json.enc     (AES-256 encrypted JSON of all tables)
└── images/           (logo, signatures — base64 in data if small, files if large)
```

**What's reused as-is:**
- Google Drive OAuth flow (Capacitor Google Sign-In plugin)
- Drive file upload/download/list via Google Drive API v3
- AES-256 encryption/decryption (Web Crypto API)
- Local file system backup via Capacitor Filesystem plugin
- Restore flow: select file > decrypt > validate checksum > confirm overwrite > restore
- Backup progress UI (percentage bar, cancel option)

**What's adapted:**
- Data schema changed (DudhHisaab exported milk entries, rates; HisaabApp exports invoices, products, etc.)
- Email backup uses Resend (DudhHisaab used Nodemailer)
- Backup frequency tiers changed
- File extension changed from `.dhb` to `.hbk`

**What's new:**
- Email export option (send encrypted backup to user's email)
- Backup size limit enforcement per tier
- Backup retention policy (auto-delete old backups on Drive beyond limit)

---

### Feature 6: Offline-first PWA (IndexedDB via Dexie, Sync Queue, Service Worker, Conflict Resolution)

**Reuse:** 90% from DudhHisaab
**What it does:** All CRUD operations work offline by writing to IndexedDB (via Dexie.js). A sync queue tracks pending changes. When online, queue is flushed to server in order. Service worker caches app shell + static assets. Conflict resolution handles multi-device edits.

**Offline capabilities:**

| Action | Offline? | Notes |
|--------|----------|-------|
| Create/edit/delete invoices | Yes | Queued for sync |
| Record payments | Yes | Queued for sync |
| Add/edit parties | Yes | Queued for sync |
| Add/edit products | Yes | Queued for sync |
| View dashboard | Yes | From local data |
| View reports | Yes | From local data |
| Search | Yes | Local IndexedDB queries |
| Print invoice | Yes | PDF generated locally |
| Share via WhatsApp | No | Requires network |
| Signup/login (first time) | No | Requires server verification |
| Subscription purchase | No | Requires Razorpay |
| Google Drive backup | No | Requires network |
| Staff invite | No | Requires SMS/WhatsApp |

**Sync queue design:**

```typescript
interface SyncQueueItem {
  id: string;                    // UUID
  table: string;                 // "invoices" | "parties" | "products" | "payments" | ...
  operation: "CREATE" | "UPDATE" | "DELETE";
  recordId: string;              // ID of the affected record
  payload: Record<string, any>;  // Full record for CREATE, changed fields for UPDATE
  timestamp: number;             // Unix ms when operation occurred
  retryCount: number;            // 0-5, exponential backoff
  status: "PENDING" | "SYNCING" | "FAILED" | "SYNCED";
  deviceId: string;              // Identifies the originating device
}
```

**Conflict resolution strategy:**
1. **Last-write-wins (default):** If same record edited on 2 devices, most recent timestamp wins. Loser's version stored in `_conflicts` table.
2. **User-prompted (optional):** Show both versions, let user pick or merge. Notification sent when conflict detected.
3. **Field-level merge (for invoices):** If Device A changed `notes` and Device B changed `amount`, merge both changes.
4. **Delete wins:** If one device deletes a record and another edits it, delete wins (with undo option).

**What's reused as-is:**
- Dexie.js database setup, table definitions, migrations
- Sync queue implementation (enqueue, dequeue, retry with exponential backoff)
- Service worker (Workbox-based: precache app shell, runtime cache API responses)
- Online/offline detection (navigator.onLine + fetch heartbeat every 30s)
- Sync status UI (banner: "Offline — data saved locally" / "Syncing X changes..." / "All synced")

**What's adapted:**
- IndexedDB table schemas changed for HisaabApp data models
- Conflict resolution gains field-level merge for invoices (DudhHisaab was last-write-wins only)
- Service worker cache list updated for new routes

**What's new:**
- Field-level merge for complex records (invoices with line items)
- Conflict notification in notification center

---

### Feature 7: Admin Panel Framework (User Management, Analytics, Monitoring, Audit)

**Reuse:** 80% from DudhHisaab
**What it does:** Separate web app at `admin.hisaabapp.com`. Internal tool for Sawan/team to manage users, view analytics, monitor system health, review audit logs, manage subscriptions, handle support.

**Admin panel sections:**

| Section | What It Shows |
|---------|---------------|
| Dashboard | Active users (DAU/WAU/MAU), revenue (MRR/ARR), signups today, churn rate |
| Users | User list with search/filter, user detail (business info, subscription, activity), impersonate, ban/suspend |
| Subscriptions | Active subscriptions, revenue by tier, failed payments, upcoming renewals, manual override |
| Referrals | Referral stats, fraud flags, pending withdrawals, approve/reject |
| Notifications | Send broadcast push/email/WhatsApp, template management, delivery stats |
| System | Server health (CPU/RAM/disk), API response times, error rates, background job status |
| Audit Log | All admin actions logged: who, what, when, before/after values |
| Support | View user's data (read-only), trigger backup, reset password, extend trial |

**What's reused as-is:**
- Admin auth (separate admin JWT, role-based: super-admin, support, viewer)
- User management CRUD, search, filter, pagination
- Analytics dashboard (Chart.js based, date range picker)
- Audit log infrastructure (every admin action logged)
- System monitoring (health check endpoint, uptime tracking)

**What's adapted:**
- Dashboard metrics changed (DudhHisaab tracked dairy-specific KPIs)
- User detail page shows HisaabApp-specific data (invoices, products, not milk entries)
- Subscription management updated for new tiers and add-ons
- Remove DudhHisaab-specific sections (milk rates management, collection centers)

**What's new:**
- Add-on management in subscription section
- Invoice quota tracking per user
- Support section for read-only user data access

---

### Feature 8: Dark Mode / Theming (CSS Variables, Theme Selection)

**Reuse:** 95% from DudhHisaab
**What it does:** System-wide theming via CSS custom properties. Three themes: Classic (blue/white, professional), Modern (gradient accents, rounded), Minimal (monochrome, flat). Dark mode for each theme. Respects OS preference by default, user can override.

**Theme tokens (CSS custom properties):**

```css
:root {
  /* Colors */
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-secondary: #64748B;
  --color-success: #16A34A;
  --color-warning: #F59E0B;
  --color-error: #DC2626;
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F8FAFC;
  --color-bg-tertiary: #F1F5F9;
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #94A3B8;
  --color-border: #E2E8F0;

  /* Spacing */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Typography */
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}

/* Dark mode overrides */
[data-theme="dark"] {
  --color-bg-primary: #0F172A;
  --color-bg-secondary: #1E293B;
  --color-bg-tertiary: #334155;
  --color-text-primary: #F8FAFC;
  --color-text-secondary: #CBD5E1;
  --color-text-muted: #64748B;
  --color-border: #334155;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.4);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.5);
}
```

**What's reused as-is:**
- CSS variable system, theme switching logic
- `useTheme()` hook (read/set theme, persist to localStorage + server)
- Dark mode auto-detection via `prefers-color-scheme` media query
- Theme picker UI component

**What's adapted:**
- Color palette updated (DudhHisaab was green-primary for dairy, HisaabApp is blue-primary for business)
- Add "Minimal" theme (DudhHisaab had Classic + Modern only)
- Tailwind CSS 4 migration (DudhHisaab was Tailwind 3)

**What's new:**
- Minimal theme design tokens
- Tailwind CSS 4 `@theme` configuration mapping to CSS variables

---

### Feature 9: Multi-language (English / Hindi with i18n Framework)

**Reuse:** 90% from DudhHisaab
**What it does:** Full UI available in English and Hindi. i18n framework supports adding more languages later. Language selection in settings + onboarding. All static text externalized to JSON translation files. Numbers, dates, and currency formatted per locale.

**Translation file structure:**

```
src/i18n/
├── en/
│   ├── common.json        # Shared: buttons, labels, errors
│   ├── auth.json           # Login, signup, OTP
│   ├── onboarding.json     # Setup wizard
│   ├── dashboard.json      # Dashboard labels
│   ├── invoicing.json      # Invoice-related (Phase 1B PRD)
│   ├── parties.json        # Party management (Phase 1B PRD)
│   ├── inventory.json      # Products/stock (Phase 1B PRD)
│   ├── reports.json        # Report labels (Phase 1B PRD)
│   ├── settings.json       # Settings page
│   └── notifications.json  # Notification messages
├── hi/
│   └── (same structure as en/)
└── index.ts               # Language loader, fallback logic
```

**Translation example (auth.json):**

```json
{
  "login": {
    "title": "Login to HisaabApp",
    "title_hi": "HisaabApp mein login karein",
    "phone_label": "Phone Number",
    "phone_placeholder": "Enter 10-digit number",
    "otp_sent": "OTP sent to {{phone}}",
    "otp_label": "Enter OTP",
    "otp_resend": "Resend OTP",
    "otp_resend_timer": "Resend in {{seconds}}s",
    "otp_expired": "OTP expired. Tap to resend.",
    "password_label": "Password",
    "password_placeholder": "Min 8 characters",
    "login_button": "Login",
    "signup_link": "Don't have an account? Sign Up",
    "error_invalid_phone": "Enter a valid 10-digit phone number",
    "error_invalid_otp": "Invalid OTP. {{attempts}} attempts remaining.",
    "error_too_many_attempts": "Too many attempts. Try again in {{minutes}} minutes.",
    "error_account_not_found": "No account found. Sign up instead?",
    "error_account_suspended": "Account suspended. Contact support."
  }
}
```

**What's reused as-is:**
- i18n framework (react-i18next)
- Language detection (browser locale > stored preference > default EN)
- `useTranslation()` hook usage across all components
- Date formatting (date-fns with locale), number formatting (Intl.NumberFormat)
- Currency formatting: `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`

**What's adapted:**
- All translation strings rewritten (dairy-specific -> generic business)
- Hindi translations reviewed for business terminology accuracy
- Add invoice/billing/inventory translation namespaces

**What's new:**
- Nothing structurally — just new translation content

---

### Feature 10: Onboarding Flow (Business Setup Wizard + Opening Balances)

**Reuse:** 70% from DudhHisaab (most adapted feature)
**What it does:** 4-step wizard after signup. Collects business profile, preferences, opening balances (for migration from other apps/paper), and optional quick-start actions. Must be completeable in under 3 minutes. Every step skippable except business name.

**Wizard steps:**

**Step 1: Business Profile (required: name only)**
- Business name (required) — text input, max 100 chars
- Business type — dropdown: Retail / Wholesale / Service / Manufacturing / Distribution / Other
- Business category — conditional dropdown based on type (e.g., Retail -> Kirana, Electronics, Hardware, Clothing, Pharmacy, Other)
- Address — optional, text area
- GSTIN — optional, validated (15-char format: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`)
- Logo — optional, camera/gallery, max 2 MB, auto-cropped to square
- Phone — pre-filled from signup, editable
- Email — optional
- Referral code — "Have a referral code?" expandable section

**Step 2: Preferences (all optional, sensible defaults)**
- Financial year start: April (default) / January / Custom
- Currency: INR (default, locked for now)
- Date format: DD/MM/YYYY (default) / MM/DD/YYYY / YYYY-MM-DD
- Decimal places: 2 (default) / 3
- Round-off: Nearest Rs 1 (default) / Rs 0.50 / Rs 0.10 / No rounding
- Invoice prefix: Auto (INV-) or custom
- Stock tracking: On (default) / Off
- Language: English (default) / Hindi

**Step 3: Opening Balances (critical for migration)**
- Header: "Migrating from paper books or another app? Enter your current balances."
- Sub-sections:
  - **Party Balances:** Table with columns: Name | Phone | Type (Customer/Supplier) | They Owe Us (Rs) | We Owe Them (Rs)
    - "Add row" button, bulk paste from Excel supported
    - "Import from Excel" option (upload .xlsx/.csv with column mapping)
    - "Import from contacts" (phone contacts -> party names, balance entered manually)
  - **Cash in Hand:** Single input: "Current cash balance: Rs ___"
  - **Bank Balance:** Bank name + Account number + Current balance (add multiple)
  - **Stock Opening:** "Skip — I'll add products with stock later" (default) / "Enter now" -> Product name | Qty | Purchase price per unit
- "Skip this step — I'll add later" prominently shown (no guilt)
- As-of date picker: "Balances as of: [today's date]" (default today, editable for mid-month migration)

**Step 4: Quick Start (optional, interactive)**
- "Add your first customer" -> inline quick-add (name + phone)
- "Add your first product" -> inline quick-add (name + price + unit)
- "Create your first invoice" -> direct link to invoice creation
- "Skip — Go to Dashboard"

**What's reused as-is:**
- Wizard UI component (step indicator, back/next/skip, progress bar)
- Business profile form with GSTIN validation
- Logo upload with crop (Capacitor Camera plugin)

**What's adapted:**
- DudhHisaab had: Business name, Dairy type, Milk collection shift times, Rate chart upload
- HisaabApp replaces with: Business type/category, preferences, opening balances
- Step count changes from 3 to 4

**What's new:**
- Opening balances step (entire step is new)
- Preferences step (DudhHisaab had fewer config options)
- Quick start step (DudhHisaab jumped straight to dashboard)
- Excel import for opening balances
- Contact import for party creation

---

## 3. User Flows

### Flow 1: Signup (Happy Path)

```
User opens app
  -> Onboarding carousel (3 slides, swipeable, "Skip" on each)
  -> Tap "Get Started"
  -> Enter phone: 10-digit Indian number
  -> Tap "Send OTP"
  -> [Backend: generate 6-digit OTP, send via Aisensy WhatsApp. If fails, retry via SMS]
  -> User enters 6-digit OTP (auto-read if SMS on Android via Capacitor SMS plugin)
  -> [Backend: verify OTP, create User record, generate JWT + refresh token]
  -> Optional: Set password (min 8 chars, 1 uppercase, 1 number)
     OR "Skip — I'll use OTP login" (password set later in settings)
  -> Onboarding wizard begins (Step 1-4 as above)
  -> Dashboard (empty state with CTAs)
```

**Time target:** Under 2 minutes from open to dashboard.

### Flow 1: Signup (Error Paths)

| Error | Trigger | UI Response | Recovery |
|-------|---------|-------------|----------|
| Invalid phone | Non-10-digit or non-Indian format | Inline red text: "Enter a valid 10-digit phone number" | User corrects input |
| OTP not received (30s) | WhatsApp delivery failure | "Didn't receive OTP? Resend" button + "Try SMS instead" link | Resend via alternate channel |
| OTP expired | > 5 minutes since sent | "OTP expired. Tap to resend." | Resend button enabled |
| Wrong OTP | Mismatch | "Invalid OTP. 4 attempts remaining." (decrements) | User retries. After 5 fails: "Too many attempts. Try again in 15 minutes." |
| Phone already registered | Existing account | "This number already has an account. Login instead?" with Login button | Redirect to login |
| Rate limited | > 5 OTP requests/hour | "Too many OTP requests. Try again in 60 minutes." | Wait or contact support |
| Network error | No internet | "You're offline. Internet is required to sign up." | Retry button when online |
| Server error | 500 from backend | "Something went wrong. Please try again." + retry button. Auto-report to Sentry. | Retry. If persistent, show "Contact support" |

### Flow 2: Login (Happy Path)

```
User opens app (already has account)
  -> Login screen (phone pre-filled if previously logged in)
  -> Enter phone + tap "Send OTP"
     OR Enter phone + password + tap "Login"
  -> [If OTP]: Enter OTP -> verified -> JWT issued -> Dashboard
  -> [If password]: Verified -> JWT issued -> Dashboard
  -> [If 2FA enabled]: After primary auth -> "Enter 6-digit code from authenticator app" -> verified -> Dashboard
  -> [If WebAuthn registered]: "Use biometric login" option -> fingerprint/face -> verified -> Dashboard
```

### Flow 2: Login (Error Paths)

| Error | UI Response |
|-------|-------------|
| Wrong password | "Incorrect password. {{attempts}} attempts remaining." After 5: locked 15 min. |
| Account suspended | "Your account has been suspended. Contact support at support@hisaabapp.com" |
| Wrong 2FA code | "Invalid code. {{attempts}} attempts remaining." After 5: locked 15 min, email sent. |
| New device detected | Push notification to existing devices: "New login from [Device] at [Time]. Not you? Tap to secure account." |

### Flow 3: Subscription Purchase

```
User on Free tier -> taps "Upgrade" (settings or paywall prompt)
  -> Plan selection screen:
     Pro (Rs 299/mo | Rs 2,499/yr [Save 30%])
     Business (Rs 599/mo | Rs 4,999/yr [Save 30%])
  -> Toggle: Monthly / Yearly
  -> [If Pro] Optional add-ons checkboxes:
     [ ] Extra user seat (Rs 99/mo)
     [ ] Multi-godown (Rs 149/mo)
     [ ] E-invoicing (Rs 99/mo)
  -> Total shown: "Rs XXX/month" or "Rs XXX/year"
  -> Tap "Subscribe"
  -> Razorpay checkout opens (UPI / Card / Netbanking / Wallet)
  -> Payment success -> Razorpay webhook fires -> backend updates subscription
  -> User sees: "Welcome to Pro! Here's what's new:" + feature list
  -> Dashboard
```

**Error paths:**

| Error | UI Response |
|-------|-------------|
| Payment failed | "Payment failed. Try again or use a different method." |
| Payment pending (UPI timeout) | "Payment is being processed. We'll notify you once confirmed." Check status every 30s for 10 min. |
| Razorpay webhook delay | Optimistic unlock for 5 min. If webhook doesn't arrive, revert and show "Payment verification pending." |
| Duplicate subscription | Block: "You already have an active subscription." |
| Downgrade attempt | "Downgrade takes effect at end of current billing cycle." Confirm dialog. |

### Flow 4: Backup & Restore

**Backup (manual):**
```
Settings -> Backup & Restore -> "Backup Now"
  -> Choose destination: [x] Local Device [ ] Google Drive [ ] Email
  -> [If Google Drive selected and not connected]: Google Sign-In flow -> authorize Drive access
  -> [If Email selected]: Confirm email address
  -> [If encryption enabled]: Enter/confirm backup password
  -> Progress: "Backing up... 45%" (cancelable)
  -> Complete: "Backup saved successfully. Size: 12.3 MB"
     Local: saved to /HisaabApp/Backups/ on device
     Drive: saved to HisaabApp Backups folder
     Email: sent as attachment to user's email
```

**Restore:**
```
Settings -> Backup & Restore -> "Restore"
  -> Choose source: Local Device / Google Drive / Upload File
  -> [If Drive]: List of backups (date, size) -> select one
  -> [If Local]: File picker -> select .hbk file
  -> [If encrypted]: Enter backup password
  -> Preview: "This backup contains: 145 invoices, 67 customers, 89 products. Created on 14 Mar 2026."
  -> Warning: "This will REPLACE all current data. This cannot be undone."
  -> Confirm: "Restore" button (red, requires long-press or double-tap)
  -> Progress: "Restoring... 60%"
  -> Complete: "Data restored successfully. App will restart."
  -> App restarts with restored data
```

**Error paths:**

| Error | UI Response |
|-------|-------------|
| Google Drive not authorized | "Connect Google Drive to backup." -> OAuth flow |
| Drive storage full | "Google Drive is full. Free up space or backup locally." |
| Wrong backup password | "Incorrect password. This backup cannot be decrypted without the correct password." |
| Corrupt backup file | "This backup file is damaged and cannot be restored." |
| Backup too large for tier | "Backup size (120 MB) exceeds your plan limit (50 MB). Upgrade to Pro for 500 MB." |
| Restore checksum mismatch | "Backup integrity check failed. File may be corrupted." |

### Flow 5: Offline Sync

```
User is online, working normally
  -> Network drops (detected via navigator.onLine + failed heartbeat)
  -> Yellow banner slides down: "You're offline — changes saved locally"
  -> User continues working (all CRUD operations write to IndexedDB + enqueue to sync queue)
  -> Sync queue badge: "3 pending" (updates in real-time)
  -> Network returns (detected via navigator.onLine + successful heartbeat)
  -> Banner changes: "Syncing 3 changes..."
  -> Sync queue processes items in order (FIFO):
     For each item:
       POST/PUT/DELETE to server
       On success: mark SYNCED, remove from queue
       On 409 (conflict): flag for resolution
       On 4xx (validation error): mark FAILED, notify user
       On 5xx (server error): retry with exponential backoff (1s, 2s, 4s, 8s, 16s, max 5 retries)
  -> All synced: green banner "All changes synced" (auto-dismiss after 3s)
  -> [If conflicts]: notification "1 conflict needs your attention" -> conflict resolution screen
```

---

## 4. API Contract

**Base URL:** `https://api.hisaabapp.com/v1`
**Auth Header:** `Authorization: Bearer <jwt_token>` (except public endpoints)
**Content-Type:** `application/json`
**Response format (all endpoints):**

```json
{
  "success": true,
  "data": { ... },
  "message": "Human-readable message",
  "meta": { "page": 1, "limit": 20, "total": 150 }
}
```

**Error format:**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_OTP",
    "message": "The OTP you entered is invalid.",
    "details": { "attemptsRemaining": 3 }
  }
}
```

### Auth Endpoints

#### POST /auth/otp/send
Send OTP to phone number.

**Auth:** None
**Rate limit:** 5 requests/phone/hour

```json
// Request
{
  "phone": "9111111111",
  "channel": "whatsapp"       // "whatsapp" | "sms"
}

// Response 200
{
  "success": true,
  "data": {
    "otpId": "otp_abc123",
    "channel": "whatsapp",     // channel actually used
    "expiresAt": "2026-03-14T10:05:00Z",
    "maskedPhone": "91****1111"
  }
}

// Error 429
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many OTP requests. Try again in 42 minutes.",
    "details": { "retryAfterSeconds": 2520 }
  }
}
```

#### POST /auth/otp/verify
Verify OTP and login/register.

**Auth:** None
**Rate limit:** 5 attempts/otpId

```json
// Request
{
  "phone": "9111111111",
  "otpId": "otp_abc123",
  "otp": "123456",
  "referralCode": "ABCD1234"   // optional, only on signup
}

// Response 200 (existing user)
{
  "success": true,
  "data": {
    "isNewUser": false,
    "accessToken": "eyJ...",
    "refreshToken": "rt_xyz...",
    "expiresIn": 900,
    "user": {
      "id": "usr_abc123",
      "phone": "9111111111",
      "name": "Sawan Jaiswal",
      "businessName": "Jaiswal Traders",
      "businessType": "wholesale",
      "onboardingComplete": true,
      "subscription": {
        "tier": "pro",
        "expiresAt": "2026-04-14T00:00:00Z"
      },
      "twoFactorEnabled": false
    }
  }
}

// Response 200 (new user — signup)
{
  "success": true,
  "data": {
    "isNewUser": true,
    "accessToken": "eyJ...",
    "refreshToken": "rt_xyz...",
    "expiresIn": 900,
    "user": {
      "id": "usr_def456",
      "phone": "9111111111",
      "name": null,
      "businessName": null,
      "businessType": null,
      "onboardingComplete": false,
      "subscription": {
        "tier": "free",
        "expiresAt": null
      },
      "twoFactorEnabled": false
    },
    "referralApplied": true   // if referralCode was valid
  }
}

// Error 401
{
  "success": false,
  "error": {
    "code": "INVALID_OTP",
    "message": "Invalid OTP. 3 attempts remaining.",
    "details": { "attemptsRemaining": 3 }
  }
}
```

#### POST /auth/login
Password-based login.

**Auth:** None
**Rate limit:** 3 attempts/minute

```json
// Request
{
  "phone": "9111111111",
  "password": "MyP@ssw0rd"
}

// Response 200
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "rt_xyz...",
    "expiresIn": 900,
    "requiresTwoFactor": false,
    "user": { ... }            // same shape as otp/verify
  }
}

// Response 200 (2FA required)
{
  "success": true,
  "data": {
    "requiresTwoFactor": true,
    "twoFactorToken": "2fa_temp_token...",
    "methods": ["totp", "webauthn"]
  }
}
```

#### POST /auth/2fa/verify
Verify 2FA TOTP code.

**Auth:** 2FA temp token (from /auth/login)

```json
// Request
{
  "twoFactorToken": "2fa_temp_token...",
  "code": "123456"
}

// Response 200
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "rt_xyz...",
    "expiresIn": 900,
    "user": { ... }
  }
}
```

#### POST /auth/token/refresh
Refresh access token.

**Auth:** None (refresh token in body)

```json
// Request
{
  "refreshToken": "rt_xyz..."
}

// Response 200
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "rt_new...",    // rotated
    "expiresIn": 900
  }
}
```

#### POST /auth/password/set
Set or change password.

**Auth:** Required

```json
// Request
{
  "currentPassword": "OldP@ss1",    // null if setting for first time
  "newPassword": "NewP@ss2"
}

// Response 200
{
  "success": true,
  "data": {
    "message": "Password updated. All other sessions will be logged out."
  }
}
```

#### POST /auth/2fa/setup
Enable 2FA — returns TOTP secret.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUri": "otpauth://totp/HisaabApp:9111111111?secret=JBSWY3DPEHPK3PXP&issuer=HisaabApp",
    "recoveryCodes": ["abc12345", "def67890", "ghi11111", "jkl22222", "mno33333"]
  }
}
```

#### POST /auth/2fa/confirm
Confirm 2FA setup with initial code.

**Auth:** Required

```json
// Request
{
  "code": "123456"
}

// Response 200
{
  "success": true,
  "data": {
    "twoFactorEnabled": true
  }
}
```

#### DELETE /auth/sessions/:deviceId
Logout a specific device.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "message": "Session terminated."
  }
}
```

#### GET /auth/sessions
List active sessions.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "sessions": [
      {
        "deviceId": "dev_abc",
        "deviceName": "Samsung Galaxy M31",
        "platform": "android",
        "lastActive": "2026-03-14T09:30:00Z",
        "isCurrent": true,
        "ip": "103.xx.xx.xx",
        "location": "Indore, MP"
      }
    ]
  }
}
```

### Subscription Endpoints

#### GET /subscriptions/plans
Get available plans and pricing.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "plan_free",
        "name": "Free",
        "monthlyPrice": 0,
        "yearlyPrice": 0,
        "features": {
          "maxUsers": 1,
          "maxInvoicesPerMonth": 50,
          "gstEnabled": false,
          "customRoles": false,
          "multiGodown": false,
          "posMode": false,
          "tallyExport": false,
          "eInvoicing": false,
          "backupFrequency": "manual",
          "maxBackupSizeMb": 50,
          "maxTemplates": 2,
          "prioritySupport": false
        }
      },
      {
        "id": "plan_pro",
        "name": "Pro",
        "monthlyPrice": 29900,
        "yearlyPrice": 249900,
        "features": { ... }
      },
      {
        "id": "plan_business",
        "name": "Business",
        "monthlyPrice": 59900,
        "yearlyPrice": 499900,
        "features": { ... }
      }
    ],
    "addOns": [
      {
        "id": "addon_extra_user",
        "name": "Extra User Seat",
        "monthlyPrice": 9900,
        "applicablePlans": ["plan_pro"]
      },
      {
        "id": "addon_multi_godown",
        "name": "Multi-Godown",
        "monthlyPrice": 14900,
        "applicablePlans": ["plan_pro"]
      },
      {
        "id": "addon_einvoicing",
        "name": "E-Invoicing",
        "monthlyPrice": 9900,
        "applicablePlans": ["plan_pro"]
      }
    ]
  }
}
```

Note: Prices in paise (INR smallest unit). Rs 299 = 29900 paise.

#### POST /subscriptions/create
Create a Razorpay subscription.

**Auth:** Required

```json
// Request
{
  "planId": "plan_pro",
  "billingCycle": "yearly",
  "addOnIds": ["addon_extra_user"]
}

// Response 200
{
  "success": true,
  "data": {
    "subscriptionId": "sub_abc123",
    "razorpaySubscriptionId": "sub_rp_xyz",
    "shortUrl": "https://rzp.io/i/abc",    // Razorpay checkout URL
    "amount": 249900,
    "currency": "INR"
  }
}
```

#### POST /subscriptions/webhook
Razorpay webhook handler.

**Auth:** Razorpay webhook signature verification

```json
// Razorpay sends various events:
// subscription.activated, subscription.charged, subscription.cancelled,
// subscription.halted, payment.failed
// Backend handles each and updates subscription status accordingly.
```

#### GET /subscriptions/current
Get current subscription details.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_abc123",
      "planId": "plan_pro",
      "planName": "Pro",
      "billingCycle": "yearly",
      "status": "active",           // "active" | "past_due" | "cancelled" | "expired" | "trialing"
      "currentPeriodStart": "2026-03-14T00:00:00Z",
      "currentPeriodEnd": "2027-03-14T00:00:00Z",
      "cancelAtPeriodEnd": false,
      "addOns": [
        { "id": "addon_extra_user", "name": "Extra User Seat", "quantity": 1 }
      ],
      "usage": {
        "invoicesThisMonth": 23,
        "invoiceLimit": null,        // null = unlimited
        "usersCount": 2,
        "usersLimit": 4,             // 3 base + 1 add-on
        "backupSizeMb": 45.2,
        "backupLimitMb": 500
      }
    }
  }
}
```

#### POST /subscriptions/cancel
Cancel subscription (takes effect at period end).

**Auth:** Required

```json
// Request
{
  "reason": "too_expensive",         // "too_expensive" | "missing_features" | "switching_app" | "other"
  "feedback": "Would use if cheaper"  // optional free text
}

// Response 200
{
  "success": true,
  "data": {
    "cancelAtPeriodEnd": true,
    "accessUntil": "2027-03-14T00:00:00Z",
    "message": "Your Pro plan will remain active until 14 Mar 2027."
  }
}
```

### Referral Endpoints

#### GET /referrals/code
Get user's referral code and stats.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "code": "ABCD1234",
    "shareUrl": "https://hisaabapp.com/r/ABCD1234",
    "shareMessage": "I use HisaabApp for billing. Sign up with my code ABCD1234 and get Rs 25 credit! Download: https://hisaabapp.com/r/ABCD1234",
    "stats": {
      "totalReferred": 12,
      "successfulReferrals": 8,      // created first invoice
      "subscribedReferrals": 3,      // upgraded to paid
      "totalEarnings": 1050,          // in Rs
      "pendingEarnings": 150,         // awaiting qualification
      "withdrawnAmount": 800
    },
    "leaderboard": {
      "rank": 42,
      "topReferrers": [
        { "name": "R***l", "referrals": 45 },
        { "name": "S***a", "referrals": 38 }
      ]
    }
  }
}
```

#### GET /referrals/history
Get referral history.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "referrals": [
      {
        "id": "ref_abc",
        "referredPhone": "98****5678",
        "status": "qualified",       // "pending" | "qualified" | "subscribed" | "expired"
        "reward": 5000,               // paise
        "qualifiedAt": "2026-03-10T14:30:00Z"
      }
    ]
  }
}
```

#### GET /referrals/wallet
Get wallet balance and transaction history.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "balance": 25000,                 // paise (Rs 250)
    "transactions": [
      {
        "id": "wtx_abc",
        "type": "credit",             // "credit" | "debit"
        "amount": 5000,
        "description": "Referral reward — 98****5678 created first invoice",
        "createdAt": "2026-03-10T14:30:00Z"
      },
      {
        "id": "wtx_def",
        "type": "debit",
        "amount": 10000,
        "description": "UPI withdrawal to 9111111111@upi",
        "createdAt": "2026-03-08T10:00:00Z",
        "status": "completed"         // "pending" | "completed" | "failed"
      }
    ]
  }
}
```

#### POST /referrals/withdraw
Withdraw wallet balance to UPI.

**Auth:** Required

```json
// Request
{
  "amount": 10000,                    // paise, min 10000 (Rs 100), max 500000 (Rs 5,000)
  "upiId": "9111111111@upi"
}

// Response 200
{
  "success": true,
  "data": {
    "withdrawalId": "wd_abc",
    "amount": 10000,
    "upiId": "9111111111@upi",
    "status": "processing",           // funds sent within 24h
    "estimatedArrival": "2026-03-15T00:00:00Z"
  }
}

// Error 400
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Wallet balance (Rs 50) is less than withdrawal amount (Rs 100)."
  }
}
```

### Notification Endpoints

#### GET /notifications
Get notification list (paginated).

**Auth:** Required

```json
// Query: ?page=1&limit=20&unreadOnly=false

// Response 200
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "ntf_abc",
        "type": "payment_reminder",
        "title": "Payment Reminder Sent",
        "body": "Reminder sent to Rahul Sharma for Rs 5,000",
        "read": false,
        "actionUrl": "/parties/pty_abc/statement",
        "createdAt": "2026-03-14T09:00:00Z"
      }
    ],
    "unreadCount": 5
  },
  "meta": { "page": 1, "limit": 20, "total": 45 }
}
```

#### PATCH /notifications/:id/read
Mark notification as read.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": { "read": true }
}
```

#### POST /notifications/mark-all-read
Mark all notifications as read.

**Auth:** Required

#### PUT /notifications/preferences
Update notification preferences.

**Auth:** Required

```json
// Request
{
  "channels": {
    "push": true,
    "email": true,
    "whatsapp": true,
    "sms": false
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",               // 24h format, IST
    "end": "07:00"
  },
  "types": {
    "payment_reminder": { "push": true, "whatsapp": true, "email": false },
    "low_stock": { "push": true, "whatsapp": false, "email": false },
    "backup_failed": { "push": true, "whatsapp": false, "email": true },
    "subscription_expiring": { "push": true, "whatsapp": true, "email": true },
    "new_login": { "push": true, "whatsapp": false, "email": true }
  }
}
```

#### POST /notifications/fcm-token
Register FCM token for push notifications.

**Auth:** Required

```json
// Request
{
  "token": "fcm_token_string...",
  "deviceId": "dev_abc",
  "platform": "android"             // "android" | "ios" | "web"
}
```

### Backup Endpoints

#### POST /backups/create
Trigger a backup.

**Auth:** Required

```json
// Request
{
  "destination": "google_drive",     // "local" | "google_drive" | "email"
  "encrypt": true,
  "password": "MyBackupP@ss"        // required if encrypt=true
}

// Response 200
{
  "success": true,
  "data": {
    "backupId": "bkp_abc",
    "status": "in_progress",
    "estimatedSizeMb": 12.3
  }
}
```

#### GET /backups
List backups.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "backups": [
      {
        "id": "bkp_abc",
        "destination": "google_drive",
        "status": "completed",        // "in_progress" | "completed" | "failed"
        "sizeMb": 12.3,
        "encrypted": true,
        "recordCounts": {
          "invoices": 145,
          "parties": 67,
          "products": 89,
          "payments": 234
        },
        "createdAt": "2026-03-14T08:00:00Z"
      }
    ]
  }
}
```

#### POST /backups/:id/restore
Initiate restore from a backup.

**Auth:** Required

```json
// Request
{
  "password": "MyBackupP@ss"        // required if backup was encrypted
}

// Response 200
{
  "success": true,
  "data": {
    "restoreId": "rst_abc",
    "status": "in_progress",
    "preview": {
      "invoices": 145,
      "parties": 67,
      "products": 89,
      "payments": 234,
      "createdAt": "2026-03-14T08:00:00Z"
    }
  }
}
```

#### GET /backups/schedule
Get auto-backup schedule.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "enabled": true,
    "frequency": "hourly",           // depends on tier
    "destinations": ["google_drive", "local"],
    "lastBackup": "2026-03-14T08:00:00Z",
    "nextBackup": "2026-03-14T09:00:00Z"
  }
}
```

### Sync Endpoints

#### POST /sync/push
Push pending changes from device to server.

**Auth:** Required

```json
// Request
{
  "deviceId": "dev_abc",
  "changes": [
    {
      "id": "sq_001",
      "table": "invoices",
      "operation": "CREATE",
      "recordId": "inv_local_abc",
      "payload": { ... },            // full record
      "timestamp": 1710408000000
    },
    {
      "id": "sq_002",
      "table": "parties",
      "operation": "UPDATE",
      "recordId": "pty_abc",
      "payload": { "name": "New Name" },
      "timestamp": 1710408060000
    }
  ]
}

// Response 200
{
  "success": true,
  "data": {
    "results": [
      { "id": "sq_001", "status": "synced", "serverId": "inv_srv_xyz" },
      { "id": "sq_002", "status": "conflict", "serverVersion": { ... }, "clientVersion": { ... } }
    ]
  }
}
```

#### POST /sync/pull
Pull changes from server since last sync.

**Auth:** Required

```json
// Request
{
  "deviceId": "dev_abc",
  "lastSyncTimestamp": 1710400000000,
  "tables": ["invoices", "parties", "products", "payments"]
}

// Response 200
{
  "success": true,
  "data": {
    "changes": [
      {
        "table": "invoices",
        "operation": "CREATE",
        "recordId": "inv_srv_xyz",
        "payload": { ... },
        "timestamp": 1710405000000,
        "deviceId": "dev_other"       // which device made this change
      }
    ],
    "serverTimestamp": 1710408120000   // use as lastSyncTimestamp next time
  }
}
```

#### POST /sync/resolve-conflict
Resolve a sync conflict.

**Auth:** Required

```json
// Request
{
  "conflictId": "cnf_abc",
  "resolution": "keep_client",       // "keep_client" | "keep_server" | "merge"
  "mergedPayload": { ... }           // only if resolution="merge"
}
```

### Onboarding Endpoints

#### PUT /onboarding/business-profile
Save business profile (Step 1).

**Auth:** Required

```json
// Request
{
  "businessName": "Jaiswal Traders",
  "businessType": "wholesale",
  "businessCategory": "general",
  "address": "123 MG Road, Indore, MP 452001",
  "gstin": "23AABCJ1234A1Z5",
  "email": "sawan@example.com",
  "logoBase64": "data:image/png;base64,iVBOR...",
  "referralCode": "ABCD1234"
}

// Response 200
{
  "success": true,
  "data": {
    "user": { ... },                  // updated user object
    "referralApplied": true
  }
}
```

#### PUT /onboarding/preferences
Save preferences (Step 2).

**Auth:** Required

```json
// Request
{
  "financialYearStart": "april",     // "april" | "january" | "custom"
  "customFyStartMonth": null,         // 1-12 if "custom"
  "dateFormat": "DD/MM/YYYY",
  "decimalPlaces": 2,
  "roundOff": "nearest_1",           // "nearest_1" | "nearest_0.5" | "nearest_0.1" | "none"
  "invoicePrefix": "INV-",
  "stockTrackingEnabled": true,
  "language": "en"
}
```

#### POST /onboarding/opening-balances
Save opening balances (Step 3).

**Auth:** Required

```json
// Request
{
  "asOfDate": "2026-03-14",
  "partyBalances": [
    {
      "name": "Rahul Sharma",
      "phone": "9876543210",
      "type": "customer",
      "receivable": 500000,           // paise — they owe us Rs 5,000
      "payable": 0
    },
    {
      "name": "ABC Distributors",
      "phone": "9123456789",
      "type": "supplier",
      "receivable": 0,
      "payable": 1200000              // we owe them Rs 12,000
    }
  ],
  "cashInHand": 2500000,              // Rs 25,000 in paise
  "bankAccounts": [
    {
      "bankName": "SBI",
      "accountNumber": "1234567890",
      "balance": 15000000              // Rs 1,50,000 in paise
    }
  ],
  "stockOpening": []                   // empty = skip, or array of { name, qty, purchasePrice }
}

// Response 200
{
  "success": true,
  "data": {
    "partiesCreated": 2,
    "bankAccountsCreated": 1,
    "openingBalanceTotal": {
      "receivables": 500000,
      "payables": 1200000,
      "cashInHand": 2500000,
      "bankBalance": 15000000
    }
  }
}
```

#### POST /onboarding/complete
Mark onboarding as complete.

**Auth:** Required

```json
// Response 200
{
  "success": true,
  "data": {
    "onboardingComplete": true,
    "user": { ... }
  }
}
```

### Admin Endpoints (admin.hisaabapp.com)

#### GET /admin/dashboard
Admin dashboard stats.

**Auth:** Admin JWT required

```json
// Response 200
{
  "success": true,
  "data": {
    "users": {
      "total": 1234,
      "activeToday": 456,
      "activeThisWeek": 789,
      "activeThisMonth": 1100,
      "newToday": 12,
      "newThisWeek": 67,
      "churnRate": 3.2
    },
    "revenue": {
      "mrr": 8750000,                 // paise
      "arr": 105000000,
      "revenueToday": 125000,
      "subscriptionsByTier": {
        "free": 890,
        "pro": 234,
        "business": 110
      }
    },
    "system": {
      "apiLatencyP50Ms": 45,
      "apiLatencyP99Ms": 230,
      "errorRate": 0.02,
      "backgroundJobsPending": 5,
      "syncQueueDepth": 12
    }
  }
}
```

#### GET /admin/users
List users with search/filter.

**Auth:** Admin JWT

```json
// Query: ?search=sawan&tier=pro&status=active&page=1&limit=20

// Response 200
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "usr_abc",
        "phone": "9111111111",
        "name": "Sawan Jaiswal",
        "businessName": "Jaiswal Traders",
        "businessType": "wholesale",
        "tier": "pro",
        "status": "active",
        "invoiceCount": 234,
        "lastActive": "2026-03-14T09:30:00Z",
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ]
  },
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

#### GET /admin/users/:id
Get user detail (for support).

**Auth:** Admin JWT

#### POST /admin/users/:id/suspend
Suspend a user.

**Auth:** Super-admin JWT

#### POST /admin/users/:id/override-subscription
Manual subscription override (for support).

**Auth:** Super-admin JWT

#### GET /admin/audit-log
Get admin audit log.

**Auth:** Admin JWT

```json
// Query: ?adminId=adm_abc&action=suspend_user&page=1&limit=50

// Response 200
{
  "success": true,
  "data": {
    "entries": [
      {
        "id": "aud_abc",
        "adminId": "adm_abc",
        "adminName": "Sawan",
        "action": "suspend_user",
        "targetId": "usr_xyz",
        "details": { "reason": "Fraudulent referrals" },
        "before": { "status": "active" },
        "after": { "status": "suspended" },
        "ip": "103.xx.xx.xx",
        "createdAt": "2026-03-14T10:00:00Z"
      }
    ]
  }
}
```

---

## 5. Data Model

### User

```prisma
model User {
  id                  String    @id @default(cuid())
  phone               String    @unique
  passwordHash        String?                          // null if OTP-only login
  name                String?
  email               String?
  avatarUrl           String?

  // Business info
  businessName        String?
  businessType        String?                          // "retail" | "wholesale" | "service" | "manufacturing" | "distribution" | "other"
  businessCategory    String?                          // sub-type within businessType
  address             String?
  gstin               String?                          // validated 15-char
  pan                 String?
  logoUrl             String?

  // Preferences
  financialYearStart  String    @default("april")      // "april" | "january" | "custom"
  customFyStartMonth  Int?                              // 1-12
  dateFormat          String    @default("DD/MM/YYYY")
  decimalPlaces       Int       @default(2)
  roundOff            String    @default("nearest_1")  // "nearest_1" | "nearest_0.5" | "nearest_0.1" | "none"
  invoicePrefix       String    @default("INV-")
  invoiceNextNumber   Int       @default(1)
  stockTrackingEnabled Boolean  @default(true)
  language            String    @default("en")         // "en" | "hi"
  theme               String    @default("classic")    // "classic" | "modern" | "minimal"
  darkMode            String    @default("system")     // "light" | "dark" | "system"

  // Auth state
  twoFactorEnabled    Boolean   @default(false)
  twoFactorSecret     String?                          // encrypted TOTP secret
  recoveryCodes       String[]                         // hashed recovery codes
  onboardingComplete  Boolean   @default(false)
  status              String    @default("active")     // "active" | "suspended" | "deleted"
  appId               String    @default("hisaabapp")  // "hisaabapp" | "dudhhisaab"

  // Relations
  subscription        Subscription?
  sessions            Session[]
  referralCode        ReferralCode?
  referredBy          ReferralCode?  @relation("ReferredUsers")
  referredByCodeId    String?
  wallet              Wallet?
  notifications       Notification[]
  backups             Backup[]
  notificationPrefs   NotificationPreference?

  // Timestamps
  lastActiveAt        DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@index([phone])
  @@index([status])
  @@index([appId])
}
```

### Session

```prisma
model Session {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  refreshToken  String    @unique                     // hashed
  deviceId      String
  deviceName    String?
  platform      String                                // "android" | "ios" | "web"
  ip            String?
  userAgent     String?
  fcmToken      String?                               // push notification token
  lastActiveAt  DateTime  @default(now())
  expiresAt     DateTime                              // refresh token expiry (30 days)
  createdAt     DateTime  @default(now())

  @@index([userId])
  @@index([refreshToken])
  @@index([deviceId])
}
```

### WebAuthnCredential

```prisma
model WebAuthnCredential {
  id              String    @id @default(cuid())
  userId          String
  credentialId    String    @unique                    // base64url
  publicKey       Bytes                                // COSE key
  counter         BigInt
  deviceType      String                               // "singleDevice" | "multiDevice"
  transports      String[]                             // "usb" | "ble" | "nfc" | "internal"
  friendlyName    String?                              // "iPhone Face ID", "Pixel Fingerprint"
  createdAt       DateTime  @default(now())

  @@index([userId])
}
```

### Subscription

```prisma
model Subscription {
  id                      String    @id @default(cuid())
  userId                  String    @unique
  user                    User      @relation(fields: [userId], references: [id])

  planId                  String                       // "plan_free" | "plan_pro" | "plan_business"
  billingCycle            String?                      // "monthly" | "yearly" | null (free)
  status                  String    @default("active") // "active" | "past_due" | "cancelled" | "expired" | "trialing"

  // Razorpay
  razorpaySubscriptionId  String?   @unique
  razorpayCustomerId      String?

  // Billing dates
  currentPeriodStart      DateTime?
  currentPeriodEnd        DateTime?
  cancelAtPeriodEnd       Boolean   @default(false)
  cancelledAt             DateTime?
  cancelReason            String?
  cancelFeedback          String?

  // Grace period
  graceEndsAt             DateTime?                    // 7 days after expiry

  // Usage tracking
  invoicesThisMonth       Int       @default(0)
  invoiceQuotaResetAt     DateTime?                    // 1st of each month

  // Add-ons
  addOns                  SubscriptionAddOn[]

  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  @@index([status])
  @@index([razorpaySubscriptionId])
}
```

### SubscriptionAddOn

```prisma
model SubscriptionAddOn {
  id              String        @id @default(cuid())
  subscriptionId  String
  subscription    Subscription  @relation(fields: [subscriptionId], references: [id])
  addOnId         String                               // "addon_extra_user" | "addon_multi_godown" | "addon_einvoicing"
  quantity        Int           @default(1)
  monthlyPrice    Int                                   // paise
  activatedAt     DateTime      @default(now())
  cancelledAt     DateTime?

  @@index([subscriptionId])
}
```

### ReferralCode

```prisma
model ReferralCode {
  id              String      @id @default(cuid())
  userId          String      @unique
  user            User        @relation(fields: [userId], references: [id])
  code            String      @unique                  // 8-char alphanumeric
  referrals       Referral[]
  createdAt       DateTime    @default(now())

  // Inverse relation for referred users
  referredUsers   User[]      @relation("ReferredUsers")

  @@index([code])
}
```

### Referral

```prisma
model Referral {
  id                String        @id @default(cuid())
  referralCodeId    String
  referralCode      ReferralCode  @relation(fields: [referralCodeId], references: [id])
  referredUserId    String        @unique               // the user who was referred
  status            String        @default("pending")   // "pending" | "qualified" | "subscribed" | "expired"
  referrerReward    Int           @default(0)            // paise earned by referrer
  referredReward    Int           @default(0)            // paise credited to referred user
  qualifiedAt       DateTime?                            // when referred user created first invoice
  subscribedAt      DateTime?                            // when referred user first subscribed
  createdAt         DateTime      @default(now())

  @@index([referralCodeId])
  @@index([status])
}
```

### Wallet

```prisma
model Wallet {
  id            String              @id @default(cuid())
  userId        String              @unique
  user          User                @relation(fields: [userId], references: [id])
  balance       Int                 @default(0)          // paise
  transactions  WalletTransaction[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}
```

### WalletTransaction

```prisma
model WalletTransaction {
  id            String    @id @default(cuid())
  walletId      String
  wallet        Wallet    @relation(fields: [walletId], references: [id])
  type          String                                   // "credit" | "debit"
  amount        Int                                      // paise (always positive)
  description   String
  referenceType String?                                  // "referral" | "withdrawal" | "bonus" | "subscription_discount"
  referenceId   String?                                  // ID of related referral/withdrawal
  status        String    @default("completed")          // "pending" | "completed" | "failed"
  createdAt     DateTime  @default(now())

  @@index([walletId])
  @@index([status])
}
```

### Withdrawal

```prisma
model Withdrawal {
  id            String    @id @default(cuid())
  walletId      String
  upiId         String
  amount        Int                                      // paise
  status        String    @default("processing")         // "processing" | "completed" | "failed"
  razorpayPayoutId String?
  failureReason String?
  processedAt   DateTime?
  createdAt     DateTime  @default(now())

  @@index([walletId])
  @@index([status])
}
```

### Notification

```prisma
model Notification {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  type        String                                     // "otp" | "payment_reminder" | "invoice_shared" | "backup_failed" | "subscription_expiring" | "low_stock" | "staff_invite" | "referral_reward" | "sync_conflict" | "new_login"
  title       String
  body        String
  read        Boolean   @default(false)
  actionUrl   String?                                    // deep link within app
  channels    String[]                                   // ["push", "email", "whatsapp"] — which channels were used
  metadata    Json?                                      // extra data for rendering
  createdAt   DateTime  @default(now())

  @@index([userId, read])
  @@index([userId, createdAt])
}
```

### NotificationPreference

```prisma
model NotificationPreference {
  id              String    @id @default(cuid())
  userId          String    @unique
  user            User      @relation(fields: [userId], references: [id])
  pushEnabled     Boolean   @default(true)
  emailEnabled    Boolean   @default(true)
  whatsappEnabled Boolean   @default(true)
  smsEnabled      Boolean   @default(false)
  quietHoursEnabled Boolean @default(true)
  quietHoursStart String    @default("22:00")            // IST, 24h
  quietHoursEnd   String    @default("07:00")
  typePreferences Json      @default("{}")               // per-type channel overrides
  updatedAt       DateTime  @updatedAt
}
```

### Backup

```prisma
model Backup {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id])
  destination   String                                   // "local" | "google_drive" | "email"
  status        String    @default("in_progress")        // "in_progress" | "completed" | "failed"
  sizeMb        Float?
  encrypted     Boolean   @default(false)
  passwordHint  String?                                  // NOT the password, just a hint
  recordCounts  Json?                                    // { invoices: 145, parties: 67, ... }
  driveFileId   String?                                  // Google Drive file ID
  errorMessage  String?                                  // if failed
  createdAt     DateTime  @default(now())

  @@index([userId, createdAt])
  @@index([destination])
}
```

### BackupSchedule

```prisma
model BackupSchedule {
  id            String    @id @default(cuid())
  userId        String    @unique
  enabled       Boolean   @default(false)
  frequency     String    @default("manual")             // "manual" | "hourly" | "15min"
  destinations  String[]                                 // ["google_drive", "local"]
  lastBackupAt  DateTime?
  nextBackupAt  DateTime?
  updatedAt     DateTime  @updatedAt
}
```

### SyncState

```prisma
model SyncState {
  id                  String    @id @default(cuid())
  userId              String
  deviceId            String
  lastSyncTimestamp   BigInt                              // Unix ms
  pendingConflicts    Int       @default(0)
  updatedAt           DateTime  @updatedAt

  @@unique([userId, deviceId])
  @@index([userId])
}
```

### SyncConflict

```prisma
model SyncConflict {
  id              String    @id @default(cuid())
  userId          String
  tableName       String
  recordId        String
  clientVersion   Json
  serverVersion   Json
  clientDeviceId  String
  serverDeviceId  String
  resolution      String?                                // "keep_client" | "keep_server" | "merge" | null (unresolved)
  resolvedPayload Json?
  resolvedAt      DateTime?
  createdAt       DateTime  @default(now())

  @@index([userId, resolution])
}
```

### OpeningBalance

```prisma
model OpeningBalance {
  id            String    @id @default(cuid())
  userId        String
  entityType    String                                   // "party" | "cash" | "bank" | "stock"
  entityId      String?                                  // party ID, bank account ID, product ID
  receivable    Int       @default(0)                    // paise
  payable       Int       @default(0)                    // paise
  balance       Int       @default(0)                    // paise (for cash/bank)
  quantity      Float?                                   // for stock
  purchasePrice Int?                                     // paise, for stock
  asOfDate      DateTime
  createdAt     DateTime  @default(now())

  @@index([userId, entityType])
}
```

### AdminUser

```prisma
model AdminUser {
  id            String    @id @default(cuid())
  phone         String    @unique
  passwordHash  String
  name          String
  role          String    @default("viewer")             // "super_admin" | "support" | "viewer"
  status        String    @default("active")
  lastLoginAt   DateTime?
  createdAt     DateTime  @default(now())
  auditLogs     AdminAuditLog[]
}
```

### AdminAuditLog

```prisma
model AdminAuditLog {
  id          String    @id @default(cuid())
  adminId     String
  admin       AdminUser @relation(fields: [adminId], references: [id])
  action      String                                     // "view_user" | "suspend_user" | "override_subscription" | "approve_withdrawal" | etc.
  targetType  String?                                    // "user" | "subscription" | "withdrawal"
  targetId    String?
  details     Json?
  before      Json?                                      // state before change
  after       Json?                                      // state after change
  ip          String?
  createdAt   DateTime  @default(now())

  @@index([adminId])
  @@index([action])
  @@index([createdAt])
}
```

---

## 6. UI States

### Login / Signup Screen

| State | UI |
|-------|-----|
| **Default** | Phone input field, "Send OTP" button (blue, full-width), "Login with password" text link below, HisaabApp logo at top |
| **Loading (OTP sending)** | Button shows spinner + "Sending OTP...", input disabled |
| **OTP Sent** | Phone field collapses, 6-digit OTP input appears with auto-focus, countdown timer "Resend in 29s", channel badge "Sent via WhatsApp" |
| **OTP Verifying** | OTP input disabled, spinner on submit button |
| **Error: Invalid phone** | Red border on input, red text below: "Enter a valid 10-digit phone number" |
| **Error: Invalid OTP** | Red shake animation on OTP input, red text: "Invalid OTP. 3 attempts remaining." |
| **Error: Rate limited** | Full-width yellow banner: "Too many attempts. Try again in 15 minutes." All inputs disabled. |
| **Error: Network** | Gray overlay with cloud-offline icon: "You're offline. Internet is required to sign up." Retry button. |
| **Success** | Green check animation, "Welcome!" text, auto-redirect to onboarding in 1s |

### Onboarding Wizard

| State | UI |
|-------|-----|
| **Step indicator** | 4 dots at top, active dot filled blue, completed dots have checkmarks |
| **Step 1 (Business Profile)** | Form fields with floating labels. Business name has red asterisk. GSTIN has format hint. Logo shows camera icon placeholder. "Next" button at bottom, "Skip" text link. |
| **Step 2 (Preferences)** | Dropdown/toggle for each preference with sensible default pre-selected. "Next" at bottom. |
| **Step 3 (Opening Balances)** | Tab bar: Party Balances | Cash & Bank | Stock. Table with "Add Row" button. Import buttons at top. "Skip this step" prominently shown. |
| **Step 3 Loading (Import)** | Sheet slides up with file picker. After selection: "Importing 45 records..." progress bar. |
| **Step 3 Error (Import)** | "3 rows have errors. Fix or skip them?" Table highlights error rows in red. |
| **Step 4 (Quick Start)** | Three cards with icons: "Add Customer", "Add Product", "Create Invoice". Each expands inline with quick-add form. "Go to Dashboard" button at bottom. |
| **Complete** | Confetti animation (subtle, 2s). Redirect to dashboard. |

### Subscription / Paywall Screen

| State | UI |
|-------|-----|
| **Default** | Three plan cards side by side (scrollable on mobile). Pro has "Popular" badge. Monthly/Yearly toggle. Current plan has "Current Plan" badge. |
| **Plan selected** | Selected card has blue border + checkmark. Add-on checkboxes appear below (Pro only). Total price shown at bottom. |
| **Processing** | Razorpay checkout overlay opens. Parent screen shows "Completing payment..." |
| **Success** | Green check, "Welcome to Pro!" header, feature list with checkmarks, "Got it" button |
| **Failed** | Red X icon, "Payment failed. Try again or use a different method." Two buttons: "Try Again" / "Choose Different Method" |
| **Pending** | Yellow clock icon, "Payment is being verified. We'll notify you when confirmed." Auto-check every 30s. |
| **Grace period** | Yellow banner on all screens: "Your Pro plan expired. Renew within 5 days to keep your data accessible." "Renew Now" button. |
| **Expired** | Red banner: "Your subscription has expired. Data is read-only. Renew to continue." All create/edit buttons disabled. |
| **Free tier limit** | Modal: "You've used 45 of 50 free invoices this month. Upgrade to Pro for unlimited invoices." Progress bar at 90%. |

### Backup & Restore Screen

| State | UI |
|-------|-----|
| **Default** | Three sections: "Backup Now" button, "Auto Backup" toggle + schedule, "Recent Backups" list. Google Drive connection status shown. |
| **Drive not connected** | "Connect Google Drive" card with Google icon + "Connect" button |
| **Backup in progress** | Progress bar: "Backing up to Google Drive... 67%" Cancel button. |
| **Backup complete** | Green toast: "Backup saved successfully. 12.3 MB" |
| **Backup failed** | Red toast: "Backup failed: Google Drive storage full." "Try Local Backup" button. |
| **Restore preview** | Card showing: date, size, record counts. Warning text in red: "This will REPLACE all current data." Two buttons: "Cancel" (gray) / "Restore" (red, requires long-press). |
| **Restore in progress** | Full-screen overlay: "Restoring data... 45% — Do not close the app." |
| **Restore complete** | "Data restored successfully. App will restart in 3s." Auto-restart. |
| **Empty (no backups)** | Illustration + "No backups yet. Create your first backup to protect your data." Button: "Backup Now" |

### Notification Center

| State | UI |
|-------|-----|
| **Default** | List of notifications, unread have blue dot, grouped by today/this week/older. Bell icon in header with badge count. |
| **Empty** | Illustration + "No notifications yet. You'll see payment reminders, backup alerts, and more here." |
| **Loading** | Skeleton loaders (3 rows) |
| **Error** | "Couldn't load notifications. Pull to refresh." |

### Offline Banner

| State | UI |
|-------|-----|
| **Offline** | Yellow banner at top (below status bar): cloud-off icon + "You're offline — changes saved locally" — persistent, not dismissible |
| **Syncing** | Blue banner: sync icon (spinning) + "Syncing 5 changes..." |
| **Synced** | Green banner: check icon + "All changes synced" — auto-dismiss after 3s |
| **Sync error** | Red banner: warning icon + "3 changes failed to sync. Tap to retry." |
| **Conflict** | Orange banner: merge icon + "1 conflict needs your attention. Tap to resolve." |

### Theme Picker (Settings)

| State | UI |
|-------|-----|
| **Default** | Three theme preview cards (Classic/Modern/Minimal) showing mini dashboard mockup in each style. Active theme has blue border. Below: Dark mode toggle (Light/Dark/System). |
| **Switching** | Instant — CSS variables swap, no loading state needed. |

---

## 7. Mobile Considerations

### Screen Sizes
- **Primary design:** 375px width (iPhone SE / mid-range Android)
- **Minimum supported:** 320px width (old small phones)
- **Tablet:** 768px+ width — use 2-column layout where beneficial
- **Desktop (PWA):** 1024px+ — full dashboard layout, sidebar nav

### Touch Targets
- All tappable elements: minimum 44x44px (Apple HIG)
- Buttons: minimum height 48px, full-width on mobile
- List items: minimum height 56px with adequate padding
- FAB (floating action button): 56x56px, bottom-right, 16px from edges

### Gestures
- Swipe left on notification: dismiss/mark read
- Swipe down on any list: pull-to-refresh
- Long-press on invoice row: context menu (edit/delete/share/duplicate)
- Pinch-to-zoom on reports/charts: disabled (causes scroll issues)

### Native Features via Capacitor 8

| Feature | Plugin | Usage |
|---------|--------|-------|
| Camera | @capacitor/camera | Logo upload, signature capture |
| Filesystem | @capacitor/filesystem | Local backup save/restore |
| Share | @capacitor/share | Share invoices via system share sheet |
| Push Notifications | @capacitor/push-notifications | FCM token registration, display |
| Biometric Auth | capacitor-native-biometric | Fingerprint/Face unlock |
| Keyboard | @capacitor/keyboard | Auto-scroll on keyboard show, accessory bar |
| Status Bar | @capacitor/status-bar | Theme-aware status bar color |
| Splash Screen | @capacitor/splash-screen | Branded loading screen |
| App | @capacitor/app | Deep linking, back button handling |
| Network | @capacitor/network | Offline detection |
| Preferences | @capacitor/preferences | Light key-value storage (theme, language) |
| Google Auth | @codetrix-studio/capacitor-google-auth | Google Drive OAuth |
| SMS Retriever | capacitor-sms-retriever | Auto-read OTP on Android |

### Performance Targets
- First Contentful Paint (FCP): < 1.5s on 3G
- Time to Interactive (TTI): < 3s on 3G
- Bundle size (initial): < 200 KB gzipped
- IndexedDB query: < 50ms for any single table query
- Sync push/pull: < 5s for 100 items
- Invoice PDF generation: < 2s

### Offline Storage Limits
- IndexedDB: ~50 MB default (browser-dependent, up to 500 MB with persistent storage permission)
- Request persistent storage on first launch via `navigator.storage.persist()`
- Monitor storage usage: warn at 80% capacity

### Keyboard Handling
- Numeric keyboard for phone, OTP, amount inputs (`inputMode="numeric"`)
- Email keyboard for email inputs (`inputMode="email"`)
- Auto-capitalize first letter for name fields
- "Done" button on iOS numeric keyboard (via Capacitor Keyboard plugin)
- Auto-scroll input into view when keyboard opens

---

## 8. Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| 1 | User signs up, closes app before completing onboarding | On next open, resume onboarding from last completed step. `onboardingComplete=false` flag. |
| 2 | Same phone number used on DudhHisaab and HisaabApp | Separate accounts — `appId` field distinguishes them. Same OTP system, different JWT tokens. |
| 3 | User enters GSTIN during onboarding but it's invalid format | Inline validation: red border + "Enter a valid 15-character GSTIN (e.g., 23AABCJ1234A1Z5)". Allow "Skip" to add later. |
| 4 | Free tier user hits 50 invoice limit mid-day | Soft warning at 45: "5 invoices remaining this month." At 50: modal with upgrade CTA. Existing invoices editable, no new creates. Counter resets 1st of month. |
| 5 | User's subscription payment fails (card expired) | Status moves to `past_due`. Yellow banner: "Payment failed — update payment method to keep Pro features." 3 retry attempts by Razorpay over 7 days. After 7 days: downgrade to free. |
| 6 | User cancels subscription mid-cycle | Access continues until `currentPeriodEnd`. Banner: "Pro access until [date]. Renew anytime to continue." After expiry: 7-day grace period (read-only), then feature lock. |
| 7 | Two devices edit same invoice offline | Sync conflict created. If different fields changed: auto-merge. If same field: flag for user resolution. Notification sent. Default: last-write-wins after 24h. |
| 8 | User restores backup from 3 months ago | Warning: "This backup is from 14 Dec 2025. All data after this date will be lost." Require typed confirmation: "RESTORE" in input. Auto-backup current data before restore. |
| 9 | Google Drive OAuth token expires during auto-backup | Silent refresh attempt. If fails: push notification "Backup failed — reconnect Google Drive." Badge on settings icon. |
| 10 | User's device storage is full | Graceful error: "Device storage is full. Free up space to continue." Disable local backup. App continues to work (writes to IndexedDB, which is separate). |
| 11 | Multiple OTP requests (impatient user) | First OTP invalidated when second is sent. Only latest OTP valid. Rate limit: 5/hour per phone. |
| 12 | Self-referral attempt (same device/IP) | Fraud detection: compare device fingerprint + IP cluster. If match: referral marked "fraudulent", no reward. User not notified (silent block). |
| 13 | Referral code entered after signup (forgot during onboarding) | Settings > "Enter Referral Code" option. Valid for 7 days after signup only. After 7 days: "Referral code can only be applied within 7 days of signup." |
| 14 | User changes phone number | Settings > "Change Phone Number" > verify old phone OTP > enter new phone > verify new phone OTP. All sessions invalidated. Referral code unchanged. |
| 15 | WhatsApp notification delivery fails | Fallback chain: WhatsApp > SMS > Push > Email. Logged in notification delivery status. Admin can see failure rates. |
| 16 | Backup password forgotten | Cannot recover — AES-256 is one-way. "Password is required to decrypt. If forgotten, you'll need to create a new backup." Suggest backup without encryption for personal devices. |
| 17 | User has 5 devices and tries to add 6th | "You can be logged in on up to 5 devices. Log out of another device to continue." Show active sessions with "Log Out" button per device. |
| 18 | Onboarding opening balance import has duplicate phone numbers | "Phone 98765xxxxx appears twice. Keep first entry / Keep second / Keep both as separate parties?" |
| 19 | Service worker update available while user is mid-invoice | Do NOT auto-reload. Show subtle banner: "Update available. Tap to refresh." Only auto-apply on next cold start. |
| 20 | User switches language mid-session | Instant — all UI text changes. No reload needed (react-i18next handles reactively). Numbers and dates reformat to locale. |
| 21 | Razorpay webhook arrives before client callback | Idempotent processing — if subscription already activated by webhook, client callback is a no-op. |
| 22 | User on very old Android (< Android 8) | Capacitor 8 requires Android 6+. For Android 6-7: PWA fallback (no native features). Below Android 6: "Please update your device to use HisaabApp." |
| 23 | Opening balance entry with negative amounts | Block: "Amount must be positive. Use 'They Owe Us' for receivables and 'We Owe Them' for payables." |
| 24 | Sync queue grows very large (1000+ items from extended offline) | Process in batches of 50. Show progress: "Syncing... 150/1,234 changes." Prioritize recent changes. Background sync with low priority. |

---

## 9. Constraints

### Rate Limits

| Endpoint | Limit | Window | On Exceed |
|----------|-------|--------|-----------|
| POST /auth/otp/send | 5 per phone | 1 hour | 429 with retry-after |
| POST /auth/otp/verify | 5 per otpId | Per OTP | 429 + OTP invalidated |
| POST /auth/login | 3 per phone | 1 minute | 429 + 15-min lockout after 5 |
| POST /sync/push | 10 per device | 1 minute | 429 |
| POST /sync/pull | 20 per device | 1 minute | 429 |
| POST /backups/create | 5 per user | 1 hour | 429 |
| POST /referrals/withdraw | 3 per user | 1 day | 429 |
| All other authenticated | 100 per user | 1 minute | 429 |

### File Size Limits

| Item | Limit |
|------|-------|
| Logo upload | 2 MB |
| Signature image | 1 MB |
| Backup file (Free) | 50 MB |
| Backup file (Pro) | 500 MB |
| Backup file (Business) | 2 GB |
| Email attachment (backup) | 25 MB (email provider limit) |
| Opening balance Excel import | 5 MB / 10,000 rows |

### Concurrent Users

| Tier | Max Devices per Account | Max Staff Users |
|------|------------------------|----------------|
| Free | 2 | 1 (owner only) |
| Pro | 5 | 3 (+ add-on seats) |
| Business | 10 | Unlimited |

### Offline Limits

| Constraint | Value |
|-----------|-------|
| Max offline duration (supported) | 30 days |
| Max sync queue items | 10,000 |
| Max IndexedDB storage target | 100 MB |
| Sync batch size | 50 items per request |

### Security Constraints

| Rule | Detail |
|------|--------|
| JWT access token expiry | 15 minutes |
| Refresh token expiry | 30 days |
| Refresh token rotation | Every use — old token invalidated |
| Password requirements | Min 8 chars, 1 uppercase, 1 number |
| OTP expiry | 5 minutes |
| OTP length | 6 digits |
| 2FA recovery codes | 5 codes, single-use, hashed storage |
| Backup encryption | AES-256-GCM |
| GSTIN validation | Regex + format check (not government API validation in MVP) |
| Admin session | 8-hour expiry, no refresh token |

---

## 10. Out of Scope

| Item | Why | When |
|------|-----|------|
| GST invoicing and compliance | Separate PRD — Phase 2 | PRD #3 |
| Party management (CRUD, groups, custom fields) | Separate PRD — Phase 1B | PRD #2 |
| Invoice creation and management | Separate PRD — Phase 1C | PRD #2 |
| Product/inventory management | Separate PRD — Phase 1F | PRD #2 |
| Payment tracking | Separate PRD — Phase 1E | PRD #2 |
| Reports and dashboard | Separate PRD — Phase 1G | PRD #2 |
| Custom roles and permissions | Separate PRD — Phase 1H | PRD #2 |
| Double-entry accounting | Phase 3 | PRD #4 |
| POS mode | Phase 4 | PRD #5 |
| Data import from Vyapar/MyBillBook/Tally | Phase 7 | PRD #9 |
| AI features (voice entry, receipt scan) | Phase 7 | PRD #10 |
| Desktop-specific UI optimizations | Post-MVP | TBD |
| iOS-specific App Store review compliance | Pre-launch | TBD |
| Email/password signup (non-phone) | Not planned | Never (phone is identity in India) |
| Social login (Google/Facebook) | Low priority | Maybe Phase 5 |
| Multi-currency | Phase 2 | PRD #3 |
| WhatsApp Business API for marketing | Phase 5 | PRD #7 |
| Real-time collaboration (WebSocket) | Phase 7 | PRD #10 |

---

## 11. Build Plan

### Repo Structure

```
@hisaab/core (shared package — npm workspace)
├── src/
│   ├── auth/
│   │   ├── auth.controller.ts          # Express routes
│   │   ├── auth.service.ts             # Business logic
│   │   ├── auth.middleware.ts          # JWT verification, rate limiting
│   │   ├── otp.service.ts             # OTP generation, delivery
│   │   ├── token.service.ts           # JWT sign/verify, refresh rotation
│   │   ├── webauthn.service.ts        # WebAuthn registration/auth
│   │   └── auth.types.ts             # Shared TypeScript interfaces
│   ├── subscription/
│   │   ├── subscription.controller.ts
│   │   ├── subscription.service.ts
│   │   ├── razorpay.service.ts        # Razorpay API wrapper
│   │   ├── webhook.handler.ts         # Razorpay webhook processing
│   │   ├── feature-gate.middleware.ts # Check tier access per route
│   │   └── subscription.types.ts
│   ├── referral/
│   │   ├── referral.controller.ts
│   │   ├── referral.service.ts
│   │   ├── wallet.service.ts
│   │   ├── fraud.service.ts           # Fraud detection rules
│   │   └── referral.types.ts
│   ├── notification/
│   │   ├── notification.controller.ts
│   │   ├── notification.service.ts
│   │   ├── channels/
│   │   │   ├── fcm.channel.ts         # Firebase Cloud Messaging
│   │   │   ├── whatsapp.channel.ts    # Aisensy API
│   │   │   ├── email.channel.ts       # Resend API
│   │   │   └── sms.channel.ts         # SMS provider
│   │   ├── quiet-hours.service.ts
│   │   └── notification.types.ts
│   ├── backup/
│   │   ├── backup.controller.ts
│   │   ├── backup.service.ts
│   │   ├── encryption.service.ts      # AES-256 encrypt/decrypt
│   │   ├── google-drive.service.ts    # Drive API v3 wrapper
│   │   ├── scheduler.service.ts       # Auto-backup scheduler
│   │   └── backup.types.ts
│   ├── sync/
│   │   ├── sync.controller.ts
│   │   ├── sync.service.ts
│   │   ├── conflict.service.ts        # Conflict detection and resolution
│   │   └── sync.types.ts
│   ├── admin/
│   │   ├── admin.controller.ts
│   │   ├── admin.service.ts
│   │   ├── admin-auth.middleware.ts   # Separate admin JWT
│   │   ├── audit.service.ts          # Audit log
│   │   └── admin.types.ts
│   ├── i18n/
│   │   ├── en/                        # English translation JSONs
│   │   ├── hi/                        # Hindi translation JSONs
│   │   └── index.ts                   # i18n config + loader
│   ├── theme/
│   │   ├── tokens.css                 # CSS custom properties
│   │   ├── classic.css
│   │   ├── modern.css
│   │   ├── minimal.css
│   │   └── useTheme.ts               # React hook
│   ├── onboarding/
│   │   ├── onboarding.controller.ts
│   │   ├── onboarding.service.ts
│   │   └── onboarding.types.ts
│   └── prisma/
│       ├── schema.prisma              # All models from Section 5
│       └── migrations/
├── package.json
└── tsconfig.json

hisaab-app (frontend — consumes @hisaab/core)
├── src/
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── SignupPage.tsx
│   │   │   ├── OtpVerifyPage.tsx
│   │   │   └── TwoFactorPage.tsx
│   │   ├── onboarding/
│   │   │   ├── OnboardingWizard.tsx
│   │   │   ├── BusinessProfileStep.tsx
│   │   │   ├── PreferencesStep.tsx
│   │   │   ├── OpeningBalancesStep.tsx
│   │   │   └── QuickStartStep.tsx
│   │   ├── subscription/
│   │   │   ├── PlansPage.tsx
│   │   │   └── ManageSubscriptionPage.tsx
│   │   ├── referral/
│   │   │   ├── ReferralPage.tsx
│   │   │   └── WalletPage.tsx
│   │   ├── notifications/
│   │   │   ├── NotificationCenter.tsx
│   │   │   └── NotificationPreferencesPage.tsx
│   │   ├── backup/
│   │   │   └── BackupRestorePage.tsx
│   │   └── settings/
│   │       ├── ThemePickerPage.tsx
│   │       ├── LanguagePage.tsx
│   │       ├── SecurityPage.tsx       # Password, 2FA, WebAuthn, sessions
│   │       └── SettingsPage.tsx       # Main settings hub
│   ├── components/
│   │   ├── OfflineBanner.tsx
│   │   ├── SyncStatusIndicator.tsx
│   │   ├── PaywallModal.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── NotificationBadge.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSubscription.ts
│   │   ├── useOffline.ts
│   │   ├── useSyncQueue.ts
│   │   └── useNotifications.ts
│   ├── lib/
│   │   ├── dexie.ts                   # IndexedDB schema + Dexie instance
│   │   ├── syncQueue.ts              # Sync queue logic
│   │   ├── api.ts                    # Axios/fetch wrapper with auth headers
│   │   └── featureGate.ts            # Client-side feature gate checks
│   └── sw.ts                          # Service worker (Workbox)
└── admin/                              # Admin panel (separate build)
    ├── src/
    │   ├── pages/
    │   │   ├── DashboardPage.tsx
    │   │   ├── UsersPage.tsx
    │   │   ├── UserDetailPage.tsx
    │   │   ├── SubscriptionsPage.tsx
    │   │   ├── ReferralsPage.tsx
    │   │   ├── NotificationsPage.tsx
    │   │   ├── SystemPage.tsx
    │   │   └── AuditLogPage.tsx
    │   └── ...
    └── ...
```

### Build Order (10 Batches)

**Batch 1: Database + Prisma Setup (Day 1)**
- Create `@hisaab/core` npm workspace
- Write `schema.prisma` with all models from Section 5
- Run `prisma migrate dev` to create tables
- Seed admin user

**Batch 2: Auth Backend (Days 1-2)**
- `otp.service.ts` — Aisensy WhatsApp + SMS fallback
- `token.service.ts` — JWT sign/verify, refresh rotation
- `auth.service.ts` — signup, login, password set/change
- `auth.controller.ts` — all /auth/* endpoints
- `auth.middleware.ts` — JWT verification middleware
- Unit tests for OTP, token rotation, rate limiting

**Batch 3: Auth Frontend (Days 2-3)**
- `LoginPage.tsx`, `SignupPage.tsx`, `OtpVerifyPage.tsx`
- `useAuth.ts` hook (login, logout, token refresh, auto-redirect)
- `api.ts` (Axios instance with interceptor for token refresh)
- Token persistence (secure storage via Capacitor Preferences)

**Batch 4: 2FA + WebAuthn (Day 3)**
- `webauthn.service.ts` — registration + authentication
- `TwoFactorPage.tsx`
- `SecurityPage.tsx` (manage 2FA, WebAuthn, sessions, password)

**Batch 5: Subscription + Razorpay (Days 4-5)**
- `razorpay.service.ts` — subscription CRUD
- `subscription.service.ts` — tier management, feature gates
- `webhook.handler.ts` — payment success/failure handling
- `feature-gate.middleware.ts` — route-level tier checks
- `PlansPage.tsx`, `ManageSubscriptionPage.tsx`, `PaywallModal.tsx`
- `useSubscription.ts` hook + `featureGate.ts` client utility

**Batch 6: Referral + Wallet (Day 5-6)**
- `referral.service.ts`, `wallet.service.ts`, `fraud.service.ts`
- `referral.controller.ts` — all /referrals/* endpoints
- `ReferralPage.tsx`, `WalletPage.tsx`
- Fraud detection rules: device fingerprint, IP clustering

**Batch 7: Notifications (Day 6-7)**
- `fcm.channel.ts`, `whatsapp.channel.ts`, `email.channel.ts`, `sms.channel.ts`
- `notification.service.ts` — channel orchestration, fallback chain, quiet hours
- `notification.controller.ts`
- `NotificationCenter.tsx`, `NotificationPreferencesPage.tsx`, `NotificationBadge.tsx`
- FCM token registration via Capacitor

**Batch 8: Backup + Restore (Days 7-8)**
- `encryption.service.ts` — AES-256-GCM via Web Crypto API
- `google-drive.service.ts` — OAuth, upload, download, list
- `backup.service.ts`, `scheduler.service.ts`
- `backup.controller.ts`
- `BackupRestorePage.tsx`
- Google Sign-In via Capacitor plugin

**Batch 9: Offline Sync (Days 8-10)**
- `dexie.ts` — IndexedDB schema (all tables)
- `syncQueue.ts` — enqueue, dequeue, retry, batch processing
- `sync.service.ts`, `conflict.service.ts` (backend)
- `sync.controller.ts`
- `OfflineBanner.tsx`, `SyncStatusIndicator.tsx`
- `useOffline.ts`, `useSyncQueue.ts` hooks
- `sw.ts` — Workbox service worker config
- Conflict resolution UI

**Batch 10: Theme + i18n + Onboarding + Admin (Days 10-14)**
- `tokens.css`, `classic.css`, `modern.css`, `minimal.css`
- `useTheme.ts`, `ThemeProvider.tsx`, `ThemePickerPage.tsx`
- Translation JSON files (EN + HI) for all namespaces in this PRD
- `i18n/index.ts` — react-i18next setup
- `LanguagePage.tsx`
- `OnboardingWizard.tsx` + all 4 step components
- `onboarding.controller.ts`, `onboarding.service.ts`
- Admin panel: `DashboardPage.tsx`, `UsersPage.tsx`, `UserDetailPage.tsx`, `AuditLogPage.tsx`
- `admin.controller.ts`, `admin.service.ts`, `audit.service.ts`

---

## 12. Acceptance Criteria

### Auth
- [ ] User can sign up with phone + OTP in under 60 seconds
- [ ] OTP delivered via WhatsApp; falls back to SMS if WhatsApp fails
- [ ] OTP expires after 5 minutes; max 5 attempts per OTP
- [ ] Rate limit: 5 OTP sends per phone per hour enforced
- [ ] JWT access token expires in 15 minutes; refresh token in 30 days
- [ ] Refresh token rotates on every use; old token is invalidated
- [ ] Password login works (optional — OTP-only also valid)
- [ ] 2FA TOTP setup, verification, and recovery codes work
- [ ] WebAuthn registration and authentication work on supported devices
- [ ] Max 5 concurrent sessions enforced; user can view and kill sessions
- [ ] Force logout on all devices when password is changed
- [ ] New device login triggers push notification to existing devices
- [ ] All error messages match Section 3 error paths exactly

### Subscription & Billing
- [ ] Three tiers (Free/Pro/Business) displayed with correct pricing
- [ ] Monthly/yearly toggle with "Save 30%" badge on yearly
- [ ] Razorpay checkout opens and processes payment
- [ ] Webhook correctly activates/cancels subscription
- [ ] Free tier: 50 invoices/month enforced (soft warning at 45, hard block at 50)
- [ ] Feature gates work: GST, custom roles, multi-godown locked on Free
- [ ] Add-ons purchasable on Pro tier
- [ ] Grace period: 7 days after expiry, read-only, then feature lock
- [ ] Proration calculated correctly on mid-cycle upgrade
- [ ] Cancellation takes effect at period end, not immediately
- [ ] Downgrade cancellation reason captured

### Referral & Earn
- [ ] Every user gets a unique 8-char referral code
- [ ] Referrer earns Rs 50 when referred user creates first invoice
- [ ] Referred user gets Rs 25 credit toward Pro subscription
- [ ] Bonus Rs 100 when referred user subscribes to paid plan
- [ ] Wallet balance shows correctly; transaction history accurate
- [ ] UPI withdrawal works (min Rs 100, max Rs 5,000/day)
- [ ] Self-referral blocked via device fingerprint + IP detection
- [ ] Referral leaderboard shows top 10 by count this month
- [ ] Shareable referral card generates with code + QR

### Notifications
- [ ] Push notifications delivered via FCM on Android and iOS
- [ ] WhatsApp messages sent via Aisensy for approved templates
- [ ] Email sent via Resend for transactional messages
- [ ] Fallback chain works: WhatsApp > SMS > Push > Email
- [ ] Quiet hours (default 10 PM - 7 AM IST) suppress non-critical notifications
- [ ] User can toggle channels per notification type
- [ ] Notification center shows all notifications with unread badge
- [ ] Mark as read (single and bulk) works

### Backup & Restore
- [ ] Manual backup to local device storage works
- [ ] Manual backup to Google Drive works (OAuth + upload)
- [ ] Manual backup via email works (encrypted attachment)
- [ ] AES-256 encryption with user-set password works
- [ ] Restore from local file works
- [ ] Restore from Google Drive works
- [ ] Restore preview shows record counts and date
- [ ] Restore requires explicit confirmation (typed "RESTORE" or long-press)
- [ ] Auto-backup runs on schedule per tier (manual-only for Free)
- [ ] Backup size limit enforced per tier
- [ ] Retention policy: old backups on Drive auto-deleted beyond limit

### Offline Sync
- [ ] All CRUD operations work when offline (saved to IndexedDB)
- [ ] Yellow "offline" banner shown when network drops
- [ ] Sync queue processes when network returns (FIFO order)
- [ ] Sync progress shown: "Syncing X changes..."
- [ ] Conflicts detected when same record edited on 2 devices
- [ ] Last-write-wins default resolution works
- [ ] User-prompted conflict resolution works (keep mine/theirs/merge)
- [ ] Field-level merge works for invoices (different fields changed)
- [ ] Failed sync items retry with exponential backoff (max 5 retries)
- [ ] Service worker caches app shell for instant load
- [ ] App loads and is interactive within 3 seconds on 3G

### Admin Panel
- [ ] Admin can log in at admin.hisaabapp.com with separate credentials
- [ ] Dashboard shows DAU/WAU/MAU, MRR, signups, churn
- [ ] User list with search by name/phone/business, filter by tier/status
- [ ] User detail shows business info, subscription, activity summary
- [ ] Admin can suspend/unsuspend a user
- [ ] Admin can override subscription (extend, change tier)
- [ ] All admin actions logged in audit trail with before/after values
- [ ] Admin roles enforced: super_admin, support, viewer

### Dark Mode / Theming
- [ ] Three themes (Classic/Modern/Minimal) selectable in settings
- [ ] Dark mode toggle: Light/Dark/System
- [ ] Theme switch is instant (no page reload)
- [ ] All screens render correctly in all 6 combinations (3 themes x 2 modes)
- [ ] Status bar color adapts to theme on mobile

### Multi-language
- [ ] English is default language
- [ ] Hindi translation available for all UI text in this module
- [ ] Language switchable in settings (instant, no reload)
- [ ] Numbers formatted per locale (Indian comma system: 1,23,456)
- [ ] Dates formatted per user preference (DD/MM/YYYY default)
- [ ] Currency always INR with Rs symbol

### Onboarding
- [ ] 4-step wizard shown after signup
- [ ] Step 1 (Business Profile): business name required, all else optional
- [ ] GSTIN validated inline (15-char format regex)
- [ ] Logo upload works via camera/gallery (max 2 MB)
- [ ] Step 2 (Preferences): all defaults pre-selected, all fields optional
- [ ] Step 3 (Opening Balances): party entry works with add-row
- [ ] Step 3: Excel import works (.xlsx/.csv with column mapping)
- [ ] Step 3: Contact import works (device contacts)
- [ ] Step 3: Cash in hand + bank balance entry works
- [ ] Step 3: "Skip" prominently available
- [ ] Step 4 (Quick Start): inline add customer/product works
- [ ] Onboarding resumable (closing app mid-wizard resumes from last step)
- [ ] Entire wizard completeable in under 3 minutes
- [ ] Referral code applied during onboarding

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] API contract validated against DudhHisaab existing code
- [ ] Prisma schema validated (no conflicts with future PRDs)
- [ ] Pricing validated against market (Vyapar/MyBillBook)
- [ ] Hindi translations reviewed by native speaker
- [ ] Edge cases reviewed
- [ ] Build plan timeline validated (10-14 days realistic)
