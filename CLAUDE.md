# HisaabPro — Project Rules

> Indian billing/business management app. Mobile-first, offline-first, premium UI.
> Competing with Vyapar (15M+ downloads) and MyBillBook (9.7M+ downloads).

## Project Overview

- **What:** Billing, inventory, payments, reports for Indian MSMEs
- **Name:** HisaabPro (domain: hisaabpro.in) — see `docs/APP_CONFIG.md`
- **Architecture:** Modular monolith — 2 repos: `@hisaab/core` (shared from DudhHisaab) + `hisaab-app` (new business modules)
- **Status:** Planning phase — PRDs approved, design system done, build next

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 |
| Mobile | Capacitor 8 (PWA + native iOS/Android) |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Offline | IndexedDB (Dexie) + Service Worker |
| Payments | Razorpay |
| Notifications | FCM + Aisensy (WhatsApp) + Resend (email) |
| Auth | JWT + OTP + 2FA + WebAuthn |
| PDF | React-PDF (client-side) |
| Deploy | Vercel (frontend) + Render (backend) |

## Design System — UI Direction

### Philosophy
- **Inspiration:** MyBillBook (feature depth) — but beat them on design quality
- **Aesthetic:** Premium, elegant, modern — think Cred/Jupiter/Fi level polish for business users
- **NOT:** Dark glassmorphism, Vyapar's dated 2015 UI, generic Bootstrap templates
- **Goal:** "This looks expensive — and it's free?"

### Visual Language
- **Light theme primary**, dark theme secondary (both must be premium)
- **Color:** Professional blue/teal primary (trust), warm accent for CTAs
- **Typography:** Clean sans-serif (Inter or equivalent), large readable text (16px min body)
- **Spacing:** Generous white space — breathable, not cramped
- **Shadows:** Soft, subtle elevation — no harsh drop shadows
- **Radius:** Rounded but not bubbly (8-12px for cards, 6-8px for inputs)
- **Animations:** Subtle micro-interactions on key actions (invoice created, payment recorded) — CSS only, NO framer-motion
- **Data density:** Cards on mobile, tables on desktop — never cramped

### Mobile Constraints
- **Primary:** 375px (iPhone SE / average Android)
- **Minimum:** 320px (cheap phones)
- **Must work on:** Rs 8,000-15,000 Android phones with 2G/3G
- **Touch targets:** 44x44px minimum
- **Sunlight readability:** High contrast, no low-contrast grays
- **Performance:** First paint < 2s, invoice creation < 10s

### Indian-Specific
- **Number formatting:** Rs 1,00,000 (Indian system, not 100,000)
- **Languages:** English + Hindi (i18n from day 1)
- **UPI/WhatsApp:** First-class citizens, not afterthoughts
- **Thermal printing:** 58mm/80mm receipt support

## Project Structure

```
HisaabPro/
├── CLAUDE.md
├── docs/                          ← Planning docs
│   ├── PRODUCT_BRIEF.md
│   ├── USER_JOURNEYS.md
│   ├── ROADMAP.md
│   ├── FEATURE_MAP.md
│   ├── APP_CONFIG.md
│   └── DESIGN_SYSTEM.md
├── PRDs/                          ← 8 grouped PRDs for Phase 1 MVP
├── src/
│   ├── main.tsx                   ← Entry, StrictMode, router
│   ├── App.tsx                    ← Routes, ErrorBoundary, Suspense
│   ├── config/                    ← App-wide constants (SSOT)
│   │   ├── app.config.ts          ← APP_NAME, API_URL, VERSION
│   │   └── routes.config.ts       ← Route paths as constants
│   ├── lib/                       ← Shared pure utilities
│   │   ├── api.ts                 ← Fetch wrapper (abort, retry, timeout)
│   │   ├── format.ts              ← formatCurrency, formatDate, formatPhone
│   │   ├── validation.ts          ← Shared Zod schemas
│   │   └── offline.ts             ← Dexie DB, sync queue
│   ├── hooks/                     ← Shared hooks (used by 2+ features)
│   │   ├── useApi.ts              ← Fetch + loading/error/data + abort
│   │   ├── useDebounce.ts
│   │   ├── useInterval.ts         ← Auto-cleanup setInterval
│   │   ├── useMediaQuery.ts
│   │   ├── useToast.ts
│   │   └── useAuth.ts
│   ├── components/                ← SHARED UI (used by 2+ features)
│   │   ├── ui/                    ← Design system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── BottomSheet.tsx
│   │   ├── layout/                ← Page structure
│   │   │   ├── AppShell.tsx
│   │   │   ├── BottomNav.tsx
│   │   │   ├── Header.tsx
│   │   │   └── PageContainer.tsx
│   │   └── feedback/              ← 4 UI state components
│   │       ├── Spinner.tsx
│   │       ├── Skeleton.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ErrorState.tsx
│   │       └── ErrorBoundary.tsx
│   ├── features/                  ← Feature modules (6-layer split each)
│   │   └── <feature>/
│   │       ├── feature.types.ts
│   │       ├── feature.constants.ts
│   │       ├── feature.utils.ts
│   │       ├── useFeature.ts
│   │       ├── FeaturePage.tsx
│   │       ├── FeaturePage.css
│   │       └── components/        ← Feature-private sub-components
│   └── styles/
│       ├── globals.css            ← CSS variables from design system
│       └── animations.css         ← Keyframes (CSS only)
└── server/
    ├── src/
    │   ├── index.ts               ← Express entry
    │   ├── middleware/             ← auth, asyncHandler, validate
    │   ├── lib/                   ← prisma client, response helper
    │   └── routes/                ← Feature route files
    └── prisma/
        └── schema.prisma
```

## Code Architecture Rules (NON-NEGOTIABLE)

### Shared vs Private
- `components/ui/` `hooks/` `lib/` = **shared** — used by 2+ features
- `features/X/components/` = **private** — only used inside that feature
- Component used by 1 feature → stays in `features/X/components/`
- Component used by 2+ features → **promote** to `components/ui/`

### File Size Limits
- Page: max 80 lines · Hook: max 60 lines · Utils: max 50 lines
- Sub-component: max 50 lines · Any file > 100 lines = split it

### Data Flow (DOWN only, never sideways)
```
config → lib → hooks → features → components
```
- `lib/` never imports from `hooks/` or `features/`
- `hooks/` never imports from `features/`
- `features/X/` never imports from `features/Y/` (shared code goes to `lib/` or `hooks/`)

### Utils = Pure Functions Only
- No React imports · No hooks · No state · No fetch
- Same input = same output, every time
- All calculations, formatting, validation go here

## DudhHisaab Reuse Rule (NON-NEGOTIABLE)

**Before building ANY feature, check DudhHisaab first.** Path: `/Users/sawanjaiswal/DudhHisaab`

### Reuse Checklist
1. **Search DudhHisaab** for the equivalent feature before writing new code
2. **Read the existing file entirely** — understand patterns, edge cases already handled
3. **Adapt, don't reinvent** — strip DudhHisaab-specific fields, keep battle-tested logic
4. **Keep the same structure** when logic is identical — easier to maintain both projects

### DudhHisaab Code Map (key reusable files)

| Area | DudhHisaab Path | Reuse % |
|------|----------------|---------|
| OTP service | `src/services/auth/otp.service.ts` | 95% |
| Auth service | `src/services/auth/auth.service.ts` | 80% |
| Token blacklist | `src/services/tokenBlacklist.ts` | 100% |
| Auth middleware | `src/middleware/auth.middleware.ts` | 95% |
| Rate limiting | `src/middleware/rate-limit.middleware.ts` | 100% |
| Password utils | `src/utils/password.ts` | 100% |
| Auth schemas (Zod) | `src/schemas/auth.schemas.ts` | 95% |
| WebAuthn service | `src/services/auth/webauthn.service.ts` | 100% |
| Login history | `src/services/auth/login-history.service.ts` | 100% |
| Frontend auth API | `frontend/src/services/api/auth.ts` | 95% |
| API client (axios) | `frontend/src/services/api/client.ts` | 90% |
| Auth context | `frontend/src/context/AuthContext.tsx` | 85% |
| Login page | `frontend/src/pages/Login.tsx` | 70% |
| OTP page | `frontend/src/pages/VerifyOTP.tsx` | 90% |
| Storage utils | `frontend/src/utils/storage.ts` | 85% |
| Biometric hook | `frontend/src/hooks/useBiometricLogin.ts` | 100% |
| WebAuthn utils | `frontend/src/utils/webauthn.ts` | 100% |

### What to Strip When Adapting
- DudhHisaab-specific fields: `defaultCowRate`, `defaultBuffaloRate`, `upiBusinessName`, milk-related anything
- Branding: `DudhHisaab` strings, `MadeInIndiaFooter`, DH-specific assets
- Google Drive OAuth (DH-specific backup flow)
- Referral auto-generation on register (different referral system in HisaabPro)
- Sentry imports (add back later if needed)

### What to Keep As-Is
- Crypto-secure OTP generation (`crypto.randomInt`)
- Constant-time OTP comparison (`crypto.timingSafeEqual`)
- Token blacklist with auto-cleanup
- Rate limit values and middleware
- WebAuthn CBOR/COSE implementation (no external library)
- Offline-first auth pattern (cached user + background verify)
- 401 interceptor with silent refresh + request queue

## Build Order (Phase 1 MVP — 62 features)

1. **Core** (auth, offline, backup) → foundation
2. **Party Management** (customers, suppliers) → need parties before invoices
3. **Basic Inventory** (products, stock) → need products before invoices
4. **Invoicing & Documents** (7 doc types) → core feature, depends on 2 + 3
5. **Invoice Templates** (PDF, thermal) → depends on 4
6. **Payment Tracking** (payments, outstanding) → depends on 2 + 4
7. **Dashboard & Reports** (aggregation) → depends on everything
8. **Settings & Security** (roles, permissions) → can parallel with 4-7

## Workflow

- **Any feature → `/f <feature>`** — Nick Fury orchestrates the build
- Every feature follows 6-layer split: types → constants → utils → hook → components → page
- Every screen has 4 UI states: Loading, Error, Empty, Success
- Every list endpoint is paginated (cursor-based)
- Every form works offline (queue + sync)
- Every amount stored in paise (integer), displayed in rupees

## Key Decisions

- **No GST in MVP** — Phase 2. MVP is non-GST billing first.
- **No microservices** — Modular monolith. Split later if needed.
- **Offline-first** — IndexedDB is primary, server is sync target. App works without internet.
- **React-PDF** for invoices (client-side, works offline). NOT Puppeteer.
- **Cursor pagination** everywhere (not offset).
- **Amounts in paise** (integer math, no floating point).

## Personas

- **Raju** — Micro retailer, 0-1 staff, low tech, Rs 1-5L/month. Needs simple billing + "who owes me"
- **Priya** — Growing wholesaler, 2-5 staff, medium tech, Rs 5-25L/month. Needs multi-user + inventory
- **Amit** — Multi-location distributor, 5-20 staff, high tech, Rs 25L-2Cr/month. Needs GST + Tally export

## Competitive Edge

| Us | Vyapar | MyBillBook |
|----|--------|-----------|
| Zero data loss (offline-first) | Data loss complaints | Data loss complaints |
| Full offline | Weak offline | Weak offline |
| Premium modern UI | Dated 2015 UI | Clean but beatable |
| Custom role builder | Rigid preset roles | Basic roles |
| WhatsApp support (days) | Terrible (months) | Terrible (months) |
| Atomic stock validation | Broken inventory | Broken inventory |

## Don'ts

- Don't hardcode the app name — use config constant
- Don't skip offline support for any feature
- Don't use floating point for money — paise (integer) only
- Don't build desktop-first — mobile 375px first, always
- Don't use framer-motion — CSS animations only
- Don't return unbounded lists — paginate everything
- Don't skip any of the 4 UI states on any screen
