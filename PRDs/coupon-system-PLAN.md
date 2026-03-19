# PRD: Coupon / Discount Code System

**Feature #96** | Priority: P2 | Module: Payments & Subscriptions
**Status:** Approved | **Last updated:** 2026-03-19

---

## 1. What

A full-featured coupon/discount code engine for HisaabPro subscriptions. Admins create and manage discount codes (e.g., "LAUNCH20" = 20% off). Users enter codes at checkout. Discounts apply via Razorpay Subscription Offers API. Internal tracking for usage, analytics, and fraud prevention.

## 2. Domain Model

### Coupon
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| code | String | UNIQUE, uppercase, 4-20 chars, alphanumeric + hyphens |
| description | String | Internal admin note |
| discountType | Enum | PERCENTAGE, FIXED |
| discountValue | Int | Basis points for % (2000 = 20%), paise for fixed |
| maxUses | Int? | null = unlimited |
| usageCount | Int | Default 0, atomic increment |
| maxUsesPerUser | Int | Default 1 |
| minPurchaseAmount | Int? | Paise, nullable |
| validFrom | DateTime | When coupon becomes active |
| validUntil | DateTime? | null = no expiry |
| isActive | Boolean | Admin toggle |
| appliesTo | Enum | FIRST_CYCLE, ALL_CYCLES, ONE_TIME |
| planFilter | String[] | Plan IDs it applies to, empty = all plans |
| razorpayOfferId | String? | Linked Razorpay offer, null until synced |
| metadata | Json | Flexible: campaign, source, notes |
| createdBy | String | Admin user ID |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### CouponRedemption
| Field | Type | Notes |
|-------|------|-------|
| id | cuid | PK |
| couponId | FK → Coupon | |
| userId | FK → User | |
| discountApplied | Int | Paise — actual discount amount |
| planId | String? | Which plan was purchased |
| razorpaySubscriptionId | String? | Razorpay sub ID |
| redeemedAt | DateTime | |
| metadata | Json | Checkout context |

### Indexes
- `Coupon`: unique on `code`, index on `isActive + validFrom + validUntil`
- `CouponRedemption`: unique on `couponId + userId` (when maxUsesPerUser=1), index on `userId`, index on `couponId`

## 3. State Machine

```
Coupon lifecycle:
  DRAFT (isActive=false, validFrom in future)
    → ACTIVE (isActive=true, now >= validFrom, usageCount < maxUses)
    → EXPIRED (now > validUntil)
    → EXHAUSTED (usageCount >= maxUses)
    → DEACTIVATED (admin sets isActive=false)

Computed status (not stored — derived at query time):
  if !isActive → DEACTIVATED
  if validUntil && now > validUntil → EXPIRED
  if maxUses && usageCount >= maxUses → EXHAUSTED
  if now < validFrom → SCHEDULED
  else → ACTIVE
```

## 4. API Contract

### Admin Endpoints (require SUPER_ADMIN)

#### POST /api/admin/coupons
Create a coupon.
```json
{
  "code": "LAUNCH20",
  "description": "Launch promo — 20% off first month",
  "discountType": "PERCENTAGE",
  "discountValue": 2000,
  "maxUses": 100,
  "maxUsesPerUser": 1,
  "validFrom": "2026-03-20T00:00:00Z",
  "validUntil": "2026-06-30T23:59:59Z",
  "appliesTo": "FIRST_CYCLE",
  "planFilter": []
}
```
Response: `{ success: true, data: Coupon }`

#### POST /api/admin/coupons/bulk
Generate N coupons with same config but unique codes.
```json
{
  "prefix": "FRIEND",
  "count": 100,
  "discountType": "PERCENTAGE",
  "discountValue": 2000,
  "maxUses": 1,
  "maxUsesPerUser": 1,
  "validFrom": "2026-03-20T00:00:00Z",
  "validUntil": "2026-06-30T23:59:59Z",
  "appliesTo": "FIRST_CYCLE"
}
```
Generates: FRIEND-A7K2, FRIEND-B9M1, ... (prefix + 4-char random suffix)
Response: `{ success: true, data: { created: 100, codes: [...] } }`

#### GET /api/admin/coupons
List all coupons with filters.
Query: `?status=ACTIVE&search=LAUNCH&page=1&limit=20`
Response: `{ success: true, data: { items: Coupon[], total, page, limit } }`

#### GET /api/admin/coupons/:id
Single coupon with redemption stats.
Response: `{ success: true, data: { coupon: Coupon, redemptions: CouponRedemption[], stats: { totalRedeemed, totalDiscountGiven } } }`

#### PATCH /api/admin/coupons/:id
Update coupon (cannot change code after creation).
Response: `{ success: true, data: Coupon }`

#### DELETE /api/admin/coupons/:id
Soft-deactivate (set isActive=false). Never hard delete — redemption history must persist.
Response: `{ success: true, data: { deactivated: true } }`

### User Endpoints (require auth)

#### POST /api/coupons/validate
Validate a coupon code without applying it. Used for preview.
```json
{ "code": "LAUNCH20", "planId": "plan_monthly" }
```
Response (success):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "LAUNCH20",
    "discountType": "PERCENTAGE",
    "discountValue": 2000,
    "discountPreview": 5980,
    "appliesTo": "FIRST_CYCLE",
    "message": "20% off your first month! You save ₹59.80"
  }
}
```
Response (invalid):
```json
{
  "success": false,
  "error": { "code": "COUPON_EXPIRED", "message": "This coupon has expired" }
}
```

Error codes: `COUPON_NOT_FOUND`, `COUPON_EXPIRED`, `COUPON_EXHAUSTED`, `COUPON_ALREADY_USED`, `COUPON_INACTIVE`, `COUPON_NOT_STARTED`, `COUPON_PLAN_MISMATCH`, `COUPON_MIN_AMOUNT`

#### POST /api/coupons/apply
Apply coupon during checkout. Creates CouponRedemption + links Razorpay offer.
```json
{ "code": "LAUNCH20", "planId": "plan_monthly", "razorpaySubscriptionId": "sub_xyz" }
```
Response: `{ success: true, data: { redemption: CouponRedemption, razorpayOfferLinked: true } }`

#### DELETE /api/coupons/remove
Remove applied coupon before payment completes.
```json
{ "redemptionId": "clx..." }
```

## 5. UI States

### Admin — Coupons List Page (`/admin/coupons`)
| State | Behavior |
|-------|----------|
| Loading | Skeleton table rows |
| Empty | "No coupons yet. Create your first discount code!" + CTA |
| Error | "Couldn't load coupons" + retry |
| Success | Table: Code, Discount, Usage (used/max), Status badge, Valid dates, Actions |

### Admin — Create/Edit Coupon Form
- Code input (auto-uppercase, validation: 4-20 chars, alphanumeric + hyphens)
- Discount type toggle (Percentage / Fixed)
- Discount value input (with % or ₹ prefix)
- Usage limits (max total, max per user)
- Date range picker (valid from/until)
- Applies to selector (First cycle / All cycles / One-time)
- Plan filter (multi-select, optional)
- Bulk generation toggle (prefix + count)

### Admin — Coupon Detail
- Stats: total redeemed, total discount given, conversion rate
- Redemption table: user, date, amount, plan

### User — Checkout Coupon Input
- Collapsed: "Have a coupon code?" link
- Expanded: Input + "Apply" button
- Validating: Input disabled, spinner on button
- Applied: Green banner "LAUNCH20 applied — 20% off (₹59.80 saved)" + Remove link
- Error: Red inline error below input

## 6. Mobile Considerations
- Coupon input is touch-friendly (44px height, large apply button)
- Applied coupon banner is compact (single line on mobile)
- Admin coupon list uses cards on mobile, table on desktop
- Bulk generate shows progress indicator

## 7. Edge Cases
- Same code entered twice → "Already applied" (not "Already used" — different message)
- Code with leading/trailing spaces → auto-trim
- Case insensitive → "launch20" = "LAUNCH20"
- Coupon expires between validate and apply → re-validate on apply
- Race condition on usage count → atomic `UPDATE WHERE usageCount < maxUses`
- User deletes account with active redemption → cascade, no effect on coupon count
- Coupon applied but payment fails → redemption stays, can retry (idempotent)
- Coupon applied but user abandons → cleanup after 24h (background job)

## 8. Constraints
- Code: 4-20 chars, uppercase alphanumeric + hyphens only
- Discount: max 100% for percentage, max plan price for fixed
- Bulk generation: max 500 codes per request
- Validation rate limit: 10 attempts per minute per user (brute-force prevention)
- One coupon per subscription (can't stack)

## 9. Security
- Admin-only CRUD (SUPER_ADMIN role check)
- Rate limit on validate endpoint (prevent code brute-forcing)
- No coupon details exposed in validate error responses (don't reveal valid codes)
- Atomic usage count increment (prevent overselling)
- Server-side validation only — never trust client discount calculations
- Audit log: admin actions on coupons logged

## 10. Out of Scope
- Referral-coupon auto-generation
- A/B testing different discounts
- Coupon sharing/social features
- Coupon stacking (multiple coupons per checkout)
- Product-level coupons (only subscription-level)
- Auto-generated coupon emails/notifications

## 11. Build Plan

### Batch A — Backend
1. Prisma schema: `Coupon` + `CouponRedemption` models
2. `coupon.schemas.ts` — Zod validation
3. `coupon.service.ts` — CRUD + validate + apply + bulk generate
4. `coupon.routes.ts` — Admin + user endpoints
5. Wire in `server/src/index.ts`
6. Razorpay offer sync stub (real integration when credentials available)

### Batch B — Frontend (Admin)
7. `src/features/admin/coupons/coupon.types.ts`
8. `src/features/admin/coupons/coupon.constants.ts`
9. `src/features/admin/coupons/coupon.utils.ts`
10. `src/features/admin/coupons/useCoupons.ts`
11. `src/features/admin/coupons/CouponsPage.tsx` + `coupon.css`
12. `src/features/admin/coupons/components/CouponForm.tsx`
13. `src/features/admin/coupons/components/CouponCard.tsx`
14. `src/features/admin/coupons/CouponDetailPage.tsx`

### Batch C — Frontend (User Checkout)
15. `src/features/checkout/components/CouponInput.tsx`
16. Wire into checkout/pricing flow

## 12. Acceptance Criteria
- [ ] Admin can create single coupon with all fields
- [ ] Admin can bulk-generate up to 500 codes
- [ ] Admin can list, filter, edit, deactivate coupons
- [ ] Admin can view coupon detail with redemption stats
- [ ] User can enter code at checkout and see discount preview
- [ ] User can apply code — discount reflects in price
- [ ] User can remove applied code before payment
- [ ] Expired/exhausted/inactive coupons rejected with clear message
- [ ] Usage count increments atomically (no race condition oversell)
- [ ] Validate endpoint rate-limited (10/min/user)
- [ ] Code validation is case-insensitive
- [ ] tsc clean, curl proof (success/401/400), 4 UI states
