# HisaabApp — Project Rules

> Indian billing/business management app. Mobile-first, offline-first, premium UI.
> Competing with Vyapar (15M+ downloads) and MyBillBook (9.7M+ downloads).

## Project Overview

- **What:** Billing, inventory, payments, reports for Indian MSMEs
- **Working Name:** HisaabApp (final brand TBD — see `docs/APP_CONFIG.md`)
- **Architecture:** Modular monolith — 2 repos: `@hisaab/core` (shared from DudhHisaab) + `hisaab-app` (new business modules)
- **Status:** Planning phase — PRDs written, design system next, then build

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
HisaabApp/
├── CLAUDE.md              ← You are here
├── docs/
│   ├── PRODUCT_BRIEF.md   ← What, who, why (approved)
│   ├── USER_JOURNEYS.md   ← 8 user journeys (approved)
│   ├── ROADMAP.md         ← 150 features, 7 phases (master tracking)
│   ├── APP_CONFIG.md      ← Dynamic app name config
│   └── DESIGN_SYSTEM.md   ← Colors, typography, spacing, components (713 lines)
├── PRDs/                  ← 8 grouped PRDs for Phase 1 MVP
│   ├── core-reused-PLAN.md        ← Auth, subs, offline, backup (10 features)
│   ├── party-management-PLAN.md   ← Customers/suppliers (7 features)
│   ├── invoicing-documents-PLAN.md ← 7 doc types (17 features)
│   ├── invoice-templates-PLAN.md  ← Templates, printing (5 features)
│   ├── payment-tracking-PLAN.md   ← Payments, outstanding (4 features)
│   ├── basic-inventory-PLAN.md    ← Products, stock (6 features)
│   ├── dashboard-reports-PLAN.md  ← Dashboard, reports (6 features)
│   └── settings-security-PLAN.md  ← Roles, permissions (7 features)
└── src/                   ← Code (not started yet)
```

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
