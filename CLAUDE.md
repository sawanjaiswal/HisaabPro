# HisaabPro — Project Rules

> Indian billing/business management app. Mobile-first, offline-first, premium UI.

## Overview
- **What:** Billing, inventory, payments, reports for Indian MSMEs
- **Name:** HisaabPro (hisaabpro.in) — see `docs/APP_CONFIG.md`
- **Stack:** React 19 + TS + Tailwind 4 | Capacitor 8 | Express + Prisma | PostgreSQL | Razorpay | React-PDF

## Design Direction
- Premium Cred/Jupiter polish — NOT Vyapar's dated UI
- Light primary, dark secondary · Blue/teal trust color · Inter font · 16px min body
- Generous whitespace · soft shadows · 8-12px card radius · subtle micro-interactions
- Mobile: 375px primary, 320px minimum · works on Rs 8K-15K Android phones with 2G/3G
- Indian: Rs 1,00,000 format · English + Hindi · UPI/WhatsApp first-class · 58mm/80mm thermal

## DudhHisaab Reuse (check BEFORE building any feature)
Path: `/Users/sawanjaiswal/DudhHisaab`
- Search DudhHisaab first → adapt, don't reinvent → strip milk/DH-specific fields
- Keep as-is: crypto OTP, timingSafeEqual, token blacklist, rate limits, WebAuthn, offline auth

## Key Decisions
- No GST in MVP (Phase 2) · No microservices · Offline-first (IndexedDB primary)
- React-PDF (client-side, not Puppeteer) · Cursor pagination · Amounts in paise (integer)
- `/f <feature>` to build · 6-layer split per feature · 4 UI states every screen

## Personas
- **Raju** — Micro retailer, 0-1 staff, Rs 1-5L/month
- **Priya** — Growing wholesaler, 2-5 staff, Rs 5-25L/month
- **Amit** — Multi-location distributor, 5-20 staff, Rs 25L-2Cr/month

## Don'ts
- No hardcoded app name · no floating point money · no desktop-first · no unbounded lists · no skipping 4 UI states · no skipping offline support
