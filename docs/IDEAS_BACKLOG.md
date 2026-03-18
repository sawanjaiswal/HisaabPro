# Ideas Backlog: HisaabPro

Last updated: 2026-03-19

> Feature ideas and enhancements not yet in active development. Items graduate to FEATURE_MAP.md when prioritized for a phase.

---

## Payments & Subscriptions

### Coupon / Discount Code System
- **Priority:** P2 (post-MVP)
- **Status:** Not Started
- **Feature Map:** #96 (Phase 7)
- **Description:** Admin creates discount coupons (e.g., "LAUNCH20" = 20% off). Users apply at checkout. Discount applies for first billing cycle only — full price on renewal. Uses Razorpay Subscriptions coupon API.
- **Scope:**
  - Backend coupon CRUD API (create, list, update, deactivate, delete)
  - Admin UI to create/manage coupons (code, discount %, max uses, expiry date)
  - Checkout coupon input field with real-time validation
  - Razorpay coupon integration (apply coupon to subscription)
- **Dependencies:**
  - Razorpay Subscriptions setup (Feature Map #2)
  - Pricing/Checkout flow
- **Technical Notes:**
  - Coupon model: code (unique), discountPercent, maxUses, usedCount, expiresAt, isActive
  - Validate: not expired, not maxed out, not already used by this user
  - Razorpay: use their coupon/offer API for subscription discounts
  - First-cycle-only: set coupon duration to 1 billing cycle in Razorpay
  - Admin: list with usage stats, bulk create, CSV export

---

## How to Use This File

1. **Add ideas** under the appropriate module heading (create new headings as needed)
2. **Graduate to FEATURE_MAP.md** when the idea is prioritized and assigned a phase
3. **Include:** priority estimate, scope, dependencies, technical notes
4. **Keep it lean** — enough detail to evaluate, not a full PRD
