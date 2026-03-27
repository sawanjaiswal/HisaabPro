# Ideas Backlog: HisaabPro

Last updated: 2026-03-27

> Feature ideas and enhancements not yet in active development. Items graduate to FEATURE_MAP.md when prioritized for a phase.

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
