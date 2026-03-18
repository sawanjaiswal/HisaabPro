# Mission Plan: Multi-Business & User Management | Status: Approved

> **PRD #9** | **Phase:** 5 (User Management) | **Features:** #96-#101
> **Date:** 2026-03-19
> **Owner:** Sawan Jaiswal
> **Depends on:** Auth (#1), Settings & Security (#56-#62)
> **Competitor gap:** Zoho limits 5 orgs + no custom roles on free, QuickBooks charges per-company, MyBillBook preset-only roles (no customization), Vyapar data loss + sync glitches, Khatabook limited invoicing, Wave 15 max + no team on free

---

## 1. What

Six features that turn HisaabApp from single-business into a multi-business, multi-user platform:

| # | Feature | Complexity | Why It Matters |
|---|---------|-----------|----------------|
| 96 | Multi-Business Support | MEDIUM | Owner runs 3 shops from one login — Vyapar/MyBillBook both do this |
| 97 | Business Switching (Gmail-style swipe) | LOW | Swipe on business avatar cycles businesses — zero taps, faster than dropdown |
| 98 | Permission Enforcement Middleware | MEDIUM | Roles exist but no middleware enforces them — security hole |
| 99 | Staff Invite Acceptance Flow | MEDIUM | Invite created but no way for staff to actually join |
| 100 | 7 Preset Role Templates | LOW | One-tap role setup: Partner, Manager, Salesman, Cashier, Stock Manager, Delivery Boy, Accountant |
| 101 | Route Ownership Validation | LOW | Prevent user accessing another user's business via URL manipulation |
| 102 | Staff Permission Screen | LOW | Visual matrix: what each staff member can read/edit/create/delete per module |

**Core principle:** `businessId` is the tenant boundary. Every query, every route, every response is scoped to one business. User identity (auth) is separate from business identity (tenancy).

---

## 2. Domain Model

```
┌──────────────────────────────────────────────────────┐
│                      User                             │
│  (auth identity — phone, password, PIN)               │
│  One user can be in MANY businesses                   │
│  lastActiveBusinessId → default on login              │
└──────┬───────────────────────────────────────────────┘
       │ 1:N
       ▼
┌──────────────────────────────────────────────────────┐
│                  BusinessUser                         │
│  (junction — scopes user to one business)             │
│                                                       │
│  userId ──► User                                      │
│  businessId ──► Business                              │
│  roleId ──► Role (permissions for THIS business)      │
│  role: "owner" | "staff"                              │
│  status: ACTIVE | SUSPENDED | PENDING                 │
│  lastActiveAt                                         │
│                                                       │
│  @@unique([userId, businessId])                       │
└──────┬───────────────────────────────────────────────┘
       │ N:1
       ▼
┌──────────────────────────────────────────────────────┐
│                    Business                           │
│  (company — all data scoped here)                     │
│  51 models reference businessId                       │
└──────┬───────────────────────────────────────────────┘
       │ 1:N
       ▼
┌──────────────────────────────────────────────────────┐
│                      Role                             │
│  permissions: String[] (e.g. "invoicing.create")      │
│  isSystem: true for preset templates                  │
│  7 presets + unlimited custom                         │
└──────────────────────────────────────────────────────┘
```

### State Machine: BusinessUser.status

```
                invite sent
    ┌─────────── PENDING ◄────────────────┐
    │               │                      │
    │    accept      │                     │ re-invite
    │    invite      │                     │
    │               ▼                      │
    │           ACTIVE ───────────────────►│
    │            │  ▲                       │
    │   suspend  │  │ reactivate           │
    │            ▼  │                      │
    │         SUSPENDED                    │
    │               │                      │
    │      remove   │                      │
    │               ▼                      │
    └──────── (isActive=false) ────────────┘
```

---

## 3. User Flows

### Flow 1: Create Additional Business

```
Settings → "Add Business" → Business name + type + address
    → If user has existing businesses: "Clone settings from [Business]?" toggle
        (copies: invoice templates, payment terms, tax config, custom fields — NOT data)
    → POST /api/businesses { ...fields, cloneFromBusinessId? }
    → BusinessUser created (role=owner, status=ACTIVE)
    → Auto-switch to new business
    → Dashboard loads (empty state)
```

### Flow 2: Switch Business (Gmail-style swipe)

```
Primary: Swipe down on business avatar (top-left header)
    → Cycles to next business in list (1→2→3→1→...)
    → Brief avatar flip animation (like Gmail account switch)
    → POST /api/auth/switch-business { businessId }
    → New JWT issued (same userId, different businessId)
    → Cookies rotated
    → Old refresh token invalidated in DB
    → clearBusinessScopedData(oldBusinessId):
        - Abort all in-flight requests (AbortController)
        - Clear all feature-level React state (reset hooks)
        - Clear IndexedDB tables scoped to old business
        - Clear cached form drafts
    → All data reloads for new business
    → Toast: "Switched to [Business Name]"

Secondary: Tap business avatar → Bottom sheet with all businesses
    → Tap to select → Same switch flow
    → Shows: avatar + name + role badge for each business
    → "Add Business" button at bottom
```

**Unsaved data guard:** If user has unsaved form data (dirty form state), show confirmation before switching: "You have unsaved changes. Switch anyway?" with Save Draft / Discard / Cancel. Draft saved to IndexedDB keyed by `businessId + formType`.

**Why swipe?** Gmail pattern — users with 2-3 accounts switch constantly. Swipe = 0 taps (vs tap dropdown → tap business = 2 taps + seconds). For Indian shopkeepers with 2-3 businesses, this saves hundreds of taps/day.

### Flow 3: Invite Staff Member

```
Settings → Staff → "Invite Staff" → Enter name + phone + role
    → POST /api/businesses/:businessId/staff/invite
    → 6-char code generated (crypto, 48h expiry)
    → Owner shares code via WhatsApp (deep link)
    → Toast: "Invite sent to [Name]"
```

### Flow 4: Accept Staff Invite (new or existing user)

```
Path A — Deep link (preferred):
Staff receives WhatsApp → taps link: hisaabpro.in/join?code=XXXXXX
    → If logged in: auto-navigates to join page with code pre-filled → tap "Join"
    → If not logged in: redirect to login with returnUrl=/join?code=XXXXXX
    → After login: auto-navigates to join page with code pre-filled

Path B — Manual:
Staff opens app → Settings → "Join Business" → Enter 6-char code manually

Both paths:
    → POST /api/businesses/join { code }
    → Validates: code exists, not expired, phone matches
    → Creates BusinessUser (roleId from invite, status=ACTIVE)
    → Marks StaffInvite as ACCEPTED
    → Auto-switch to new business
    → Toast: "You joined [Business Name] as [Role]"
```

### Flow 5: Permission Check (every request)

```
Staff makes request → auth middleware extracts JWT
    → JWT contains: { userId, businessId, phone }
    → requirePermission('invoicing.create') middleware
    → Looks up BusinessUser (userId + businessId)
    → Gets Role → checks permissions[]
    → ALLOW or 403 FORBIDDEN
```

---

## 4. API Contract

### 4A. Auth Changes

```
POST /api/auth/switch-business
  Body: { businessId: string }
  Auth: Required
  Validation: User must be active member of target business
  Response: { success, data: { tokens: { accessToken, refreshToken }, business: { id, name } } }
  Sets: New httpOnly cookies with businessId in JWT
  Side effects:
    - Invalidates old refresh token in DB
    - Updates BusinessUser.lastActiveAt for new business
    - Updates User.lastActiveBusinessId to new businessId
    - Logs in AuditLog (action: BUSINESS_SWITCH, fromBusinessId, toBusinessId)

GET /api/auth/me (ENHANCED)
  Response: {
    success, data: {
      user: { id, phone, name, email },
      businesses: [{ id, name, role, roleId, roleName, status }],
      activeBusiness: { id, name, businessType }
    }
  }
```

### 4B. Business Changes

```
POST /api/businesses (ENHANCED — remove single-business guard, add max check)
  Body: { name, businessType, phone?, email?, address?, city?, state?, pincode?, cloneFromBusinessId? }
  Auth: Required
  Validation:
    - User has < MAX_BUSINESSES (10) active businesses
    - If cloneFromBusinessId: user must be owner of source business
  Response: { success, data: { business, businessUser } }
  Error: 429 if max reached: "You've reached the maximum of 10 businesses"
  Side effect: Creates BusinessUser (role=owner) + seeds 7 system roles
  Clone side effect: If cloneFromBusinessId provided, copies invoice templates, payment terms, tax config, custom fields from source business (NOT data — no parties, invoices, payments)

GET /api/businesses
  Auth: Required
  Response: { success, data: { businesses: [{ id, name, businessType, role, status }] } }
```

### 4C. Staff Invite Acceptance

```
POST /api/businesses/join
  Body: { code: string }  // 6-char invite code
  Auth: Required (user must be logged in)
  Validation:
    - Code exists and not expired
    - Phone matches invite phone
    - Not already a member
  Response: { success, data: { businessUser, business: { id, name } } }
  Side effects:
    - Creates BusinessUser (roleId from invite, status=ACTIVE)
    - Updates StaffInvite (status=ACCEPTED)
    - Logs in AuditLog
```

### 4D. Invite Management

```
DELETE /api/businesses/:businessId/staff/invite/:inviteId
  Auth: Required (owner only)
  Response: { success, data: { message: 'Invite cancelled' } }
  Side effect: Marks StaffInvite as CANCELLED, code no longer valid

POST /api/businesses/:businessId/staff/invite/:inviteId/resend
  Auth: Required (owner only)
  Response: { success, data: { invite: { id, code, expiresAt } } }
  Side effect: Generates new 6-char code, resets 48h expiry, old code invalidated
```

### 4E. Permission Middleware

```
// Applied per-route, not a standalone endpoint
requirePermission('invoicing.create')
requirePermission('payments.record')
requireOwner()  // Only business owner (role === 'owner')

// Response on failure:
403 { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create invoices' } }
```

---

## 5. Data Model Changes

### 5A. JWT Payload (CHANGED)

```typescript
// Before
{ userId: string, phone: string }

// After
{ userId: string, phone: string, businessId: string }
```

### 5B. req.user (CHANGED)

```typescript
// Before
interface Request { user?: { userId: string; phone: string } }

// After
interface Request { user?: { userId: string; phone: string; businessId: string } }
```

### 5C. Prisma Schema Changes

Minor additions (no new models):
- `User`: add `lastActiveBusinessId String?` (FK to Business) — auto-load on login
- Remove business creation guard in `business.service.ts`
- StaffInvite already has all needed fields

### 5D. 7 System Role Templates

```typescript
const SYSTEM_ROLES = [
  {
    name: 'Owner',
    priority: 100,
    permissions: ALL_PERMISSIONS, // Every permission
  },
  {
    name: 'Partner',
    priority: 90,
    permissions: ALL_PERMISSIONS.filter(p =>
      !['settings.manageStaff'].includes(p)
    ),
    // Everything except staff management — co-owner sees all data but cannot hire/fire
  },
  {
    name: 'Manager',
    priority: 70,
    permissions: ALL_PERMISSIONS.filter(p =>
      !['settings.manageStaff', 'settings.modify'].includes(p)
    ),
    // Everything except staff management and business settings
  },
  {
    name: 'Salesman',
    priority: 50,
    permissions: [
      'invoicing.view', 'invoicing.create', 'invoicing.edit', 'invoicing.share',
      'parties.view',
      'payments.view', 'payments.record',
      'reports.view',
      'fields.viewPartyPhone',
    ],
    // NO: delete, purchase price, profit margin, inventory edit, settings
  },
  {
    name: 'Cashier',
    priority: 40,
    permissions: [
      'payments.view', 'payments.record',
      'parties.view',
      'invoicing.view',
      'fields.viewPartyPhone', 'fields.viewPartyOutstanding',
    ],
    // Payments only — no invoice creation, no products, no prices
  },
  {
    name: 'Stock Manager',
    priority: 50,
    permissions: [
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjustStock',
      'invoicing.view', // View purchase orders
      'parties.view',   // View suppliers
      'reports.view',
      'fields.viewPurchasePrice',
    ],
    // Inventory-focused — no sale invoices, no payments, no delete
  },
  {
    name: 'Delivery Boy',
    priority: 30,
    permissions: [
      'invoicing.view', 'invoicing.share',
      'parties.view',
      'payments.view', 'payments.record',
      'fields.viewPartyPhone',
    ],
    // View invoices, share (for delivery proof), record cash collection
  },
  {
    name: 'Accountant',
    priority: 60,
    permissions: [
      'invoicing.view',
      'inventory.view',
      'payments.view',
      'parties.view',
      'reports.view', 'reports.download', 'reports.share',
      'fields.viewPurchasePrice', 'fields.viewProfitMargin',
      'fields.viewPartyOutstanding',
    ],
    // Read-only everything + reports download — for external CAs
  },
]
```

---

## 6. UI States (per screen)

### Business Avatar (Header Top-Left)

**Always visible.** Shows business logo (if uploaded) or initials in a 36px circle.

| State | Display |
|-------|---------|
| Loading | Skeleton circle (36px) |
| 1 business | Avatar + business name. No swipe affordance. Tap → business profile. |
| 2+ businesses | Avatar + business name + subtle multi-dot indicator (● ○ ○). Swipe down = cycle. Tap = bottom sheet. |
| Switch in progress | Avatar does a flip animation (300ms). Brief loading spinner overlay. |
| Switch complete | New avatar snaps in. Toast: "Switched to [Name]". Data reloads. |

**Avatar design:**
- 36px circle, top-left of header (replaces back button on root pages)
- Business logo if uploaded → `object-fit: cover`, rounded
- No logo → 2-letter initials on brand color background (e.g., "SK" for Sawan Kirana)
- Multi-business indicator: 2-3 tiny dots below avatar showing position in cycle
- Swipe gesture: vertical swipe (>40px threshold) on avatar area triggers switch

### Staff Permission Screen

Owner views what each staff member can do across all modules.

| State | Display |
|-------|---------|
| Loading | Skeleton grid |
| Error | ErrorState + retry |
| No staff | EmptyState: "Invite staff to manage permissions" |
| Success | Grid: rows = permission modules, columns = access levels (Read / Edit / Create / Delete). Checkmarks show what the role allows. Grouped by staff member or by role. |

**Permission levels displayed:**
| Icon | Level | Meaning |
|------|-------|---------|
| Eye | Read | Can view data |
| Pencil | Edit | Can modify existing data |
| Plus | Create | Can create new records |
| Trash | Delete | Can remove records |
| Share | Share | Can share externally (WhatsApp/email/print) |

**Two views (toggle):**
1. **By Role** — Select role from tabs → see permission matrix for that role
2. **By Person** — Select staff member → see their effective permissions (from their role)

### Join Business Page

| State | Display |
|-------|---------|
| Empty | 6-digit code input + "Join" button |
| Invalid code | Inline error: "Invalid or expired invite code" |
| Already member | Inline error: "You are already a member of this business" |
| Success | "You joined [Business Name] as [Role]" + "Go to Dashboard" button |

### Staff Page (EXISTING — enhanced)

| State | Display |
|-------|---------|
| Loading | Skeleton cards |
| Error | ErrorState + retry |
| Empty | EmptyState: "No staff members — Invite your first team member" |
| Success | Staff cards (active section) + Pending invites section |

---

## 7. Mobile Considerations

- **Business avatar swipe:** Vertical swipe gesture confined to the 36px avatar element ONLY (not full header — avoids conflict with pull-to-refresh). Uses `touch-action: none` on avatar container. Threshold: 40px vertical movement. Debounced: 500ms cooldown between switches (prevent accidental rapid switching). Haptic feedback on switch (Capacitor Haptics API).
- **Business bottom sheet (tap fallback):** Shows all businesses with avatar + name + role badge. "Add Business" at bottom. Drag-to-dismiss.
- **Invite code input:** Large numeric keypad, auto-focus, 6 separate boxes (like OTP). Each box 48x56px.
- **Permission screen:** Horizontal scroll for columns on 320px. Sticky first column (module name). Row tap expands detail.
- **Staff cards:** Swipe actions (suspend, remove) on mobile.
- **Touch targets:** 44x44px minimum on all interactive elements.
- **320px:** Business name truncated to 12 chars with ellipsis. Avatar stays 36px. Permission grid scrolls horizontally.

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| User has 0 businesses | Redirect to "Join or Create Business" page (not onboarding — they're already registered) |
| User's only business gets deleted | Same → "Join or Create Business" page |
| Staff removed from active business | Token blacklisted → next API call 401 → if other businesses exist, auto-switch to first remaining + toast "You were removed from [Business]". If none remain, redirect to "Join or Create Business" |
| Invite code expired | Clear error: "This invite has expired. Ask the business owner to send a new one." |
| Staff accepts invite but already a member | 409: "You are already a member of this business" |
| Owner tries to leave own business | Block: "Transfer ownership before leaving" |
| Two users accept same invite code | First succeeds, second gets 409 (code already ACCEPTED) |
| Business owner suspends themselves | Block: "Cannot suspend yourself" |
| JWT businessId doesn't match route businessId | 403: Middleware rejects |
| User deleted, still has valid JWT | `isUserBlacklisted()` already handles this |
| Unsaved form data during switch | Confirmation dialog: "You have unsaved changes. Save Draft / Discard / Cancel" |
| Swipe gesture conflicts with pull-to-refresh | Swipe gesture ONLY fires on the 36px avatar element (not header or page). Uses `touch-action: none` on avatar. Pull-to-refresh unaffected on page body |
| Owner cancels pending invite | `DELETE /api/businesses/:id/staff/invite/:inviteId` → code invalidated |
| Invite expired, owner wants to resend | "Resend" button generates new code for same phone + role. Old code marked EXPIRED |
| Deep link invite from WhatsApp | URL: `hisaabpro.in/join?code=XXXXXX` → if logged in, auto-navigates to join page with code pre-filled. If not logged in, redirect to login with `returnUrl=/join?code=XXXXXX` |
| Max businesses reached (10) | Block: "You've reached the maximum of 10 businesses" on "Add Business" |
| Business switch during active API request | AbortController cancels all in-flight requests before switch. No stale responses pollute new business context |

---

## 9. Constraints

- Max businesses per user: **10** (prevent abuse, configurable in config)
- Max staff per business: **Subscription-gated** (Free: 1, Basic: 5, Pro: 20, Enterprise: unlimited)
- **Accountant exception:** Accountant role does NOT count toward staff limit (like QuickBooks). External CAs get free read-only access
- Max pending invites per business: **20** (prevent invite spam)
- Invite code: 6 chars, alphanumeric uppercase, 48h expiry
- Invite code reuse: Cannot be reused after acceptance
- Role assignment: Staff can only have 1 role per business
- Owner role: Cannot be assigned via invite — only via business creation
- Partner role: Can be assigned via invite — sees all data like owner but cannot manage staff (hire/fire/suspend). Can modify business settings
- **Default business on login:** Auto-load `lastActiveBusinessId` from User record. If null or business no longer accessible, load first active business
- **Offline data isolation:** Each business gets its own IndexedDB namespace (`hisaab_db_{businessId}`). Switching business loads from the target namespace. Sync priority: active > recently used > dormant. Cap offline data per business to last 90 days
- **Rate limiting per-business:** In addition to per-user limits, each business has its own rate bucket (500 req/min). Prevents one busy business from starving another
- **Trial abuse prevention:** Free trial is per-business with owner phone/email dedup — creating new businesses doesn't reset trial

---

## 10. Security

- **Tenant isolation (2 layers):** (1) Application-level: every Prisma query MUST include `businessId` in WHERE clause. (2) Database-level: PostgreSQL Row-Level Security policies as safety net — if app code has a bug, RLS blocks cross-tenant data leaks.
- **JWT businessId:** Prevents cross-business requests without backend lookup.
- **Permission middleware:** Applied to every mutation route. View routes require at minimum `module.view`.
- **Owner guard:** `requireOwner()` for: delete business, manage staff, manage roles, modify settings.
- **Invite phone validation:** Invite can only be accepted by the phone number it was sent to.
- **Rate limiting:** Business creation: 3/hour. Invite acceptance: 5/min. Switch business: 10/min.
- **Audit logging:** Every staff action logged with userId + businessId + action + timestamp.
- **Token rotation:** Switch business invalidates old refresh token in DB + issues fresh JWT pair. Old access token expires naturally (15min max).
- **Suspension/removal token invalidation:** When staff is suspended or removed, blacklist their current access token via `isUserBlacklisted()` and delete their refresh tokens for that business. Immediate effect, no 15min window.

---

## 11. Out of Scope

- Consolidated cross-business reports (Phase 2)
- Business ownership transfer
- Business deletion (soft-delete only, admin-only)
- Business merging
- Cross-business data sharing (parties, products)
- Subscription per-business vs per-user decision (separate PRD)
- Staff payroll / attendance
- Offline invite acceptance (requires server validation)
- Business logo upload (MVP uses 2-letter initials only — logo upload in Phase 2)
- Permissions for future modules (expenses, banking, loans, cheques) — added when those features ship. Role templates versioned: v1 = MVP modules only
- Staff notifications on suspension/removal (push notification — Phase 2, in-app toast on next login for MVP)
- Customer-scoped staff roles (salesman sees only their assigned parties — Phase 2, requires party-staff assignment model)
- Guest/contractor role with auto-expiry (e.g., CA access expires after tax season — Phase 2)
- Data export/portability when staff leaves a business (Phase 2)
- Staff payroll integration (Khatabook has Pagarkhata — Phase 2)
- Simultaneous multi-device real-time sync (MyBillBook differentiator — Phase 2, requires WebSocket per-tenant)

---

## 12. Build Plan

### 6-Layer Split per Feature

```
src/features/settings/    (EXISTING — enhance)
  staff.types.ts           ← Add JoinBusinessData, BusinessSwitchData
  staff.constants.ts       ← Add ROLE_TEMPLATES, MAX_BUSINESSES
  staff.service.ts         ← Add joinBusiness(), switchBusiness()
  useStaff.ts              ← Already exists
  StaffPage.tsx            ← Already exists
  components/
    StaffCard.tsx           ← Already exists
    InviteCard.tsx          ← Already exists
    JoinBusinessForm.tsx    ← NEW (6-digit code input)

src/lib/
  business-scope.ts          ← NEW: clearBusinessScopedData(), abortAllRequests()

src/components/layout/
  BusinessAvatar.tsx         ← NEW (swipe-to-switch avatar + bottom sheet)

src/features/settings/
  StaffPermissionsPage.tsx   ← NEW (permission matrix view per role/person)
  components/
    PermissionGrid.tsx       ← NEW (read/edit/create/delete grid)

server/src/
  middleware/
    auth.ts                 ← MODIFY: add businessId to req.user
    permission.ts           ← NEW: requirePermission(), requireOwner()
  lib/
    business.ts             ← MODIFY: validate explicit businessId
  routes/
    auth.ts                 ← MODIFY: add switch-business endpoint
    settings.ts             ← MODIFY: add join endpoint
  services/
    auth.service.ts         ← MODIFY: include businessId in JWT
    business.service.ts     ← MODIFY: remove single-business guard
    settings.service.ts     ← MODIFY: add 7 role templates, joinBusiness()
  config/
    security.ts             ← Add MAX_BUSINESSES, INVITE_CODE_LENGTH, MAX_PENDING_INVITES

prisma/
  migrations/              ← Add lastActiveBusinessId to User, RLS policies
```

### Build Order

```
Batch A — Backend (do first)
  1. Prisma migration: add User.lastActiveBusinessId + RLS policies on tenant-scoped tables
  2. Add businessId to JWT + req.user (auth.ts, jwt.ts, auth.service.ts)
  3. Grep + replace ALL resolveBusinessId() calls → req.user.businessId
     Verify: `grep -rn "resolveBusinessId" server/src/` → 0 results
  4. Permission middleware (NEW: permission.ts) + per-business rate limiting
  5. Switch business endpoint (auth.ts) — old refresh token invalidation + lastActiveBusinessId update
  6. Join business endpoint (settings.ts + settings.service.ts)
  7. Remove single-business guard + add MAX_BUSINESSES validation (business.service.ts)
  8. Clone business settings support in POST /api/businesses
  9. 7 role templates + Accountant exception (doesn't count toward staff limit)
  10. Apply requirePermission() to mutation routes
  11. Route ownership validation (business.ts)
  12. Invite management: cancel (DELETE) + resend (POST) + MAX_PENDING_INVITES
  13. Staff suspension/removal: blacklist token immediately

Batch B — Frontend (after backend)
  14. Update AuthContext + remove FALLBACK_BUSINESS_ID (atomic — same task)
      - businesses[] + activeBusinessId + switchBusiness() + clearBusinessScopedData()
      - Auto-load lastActiveBusinessId on login (not index 0)
      - Grep + replace ALL FALLBACK_BUSINESS_ID usages
      - Verify: `grep -rn "FALLBACK_BUSINESS_ID\|business_1" src/` → 0 results
  15. Per-business IndexedDB namespace (hisaab_db_{businessId})
  16. BusinessAvatar component (header top-left: swipe + tap + bottom sheet)
  17. JoinBusinessForm component + page (deep link: /join?code=XXXXXX)
  18. StaffPermissionsPage + PermissionGrid components
  19. Clone settings UI on "Add Business" flow (toggle + source business picker)
  20. Update routes.config.ts (add JOIN_BUSINESS, STAFF_PERMISSIONS routes)
  21. Wire routes in App.tsx
```

---

## 13. Acceptance Criteria

- [ ] User can create multiple businesses (up to 10)
- [ ] Business avatar (36px, top-left header) shows logo or initials
- [ ] Swipe down on avatar cycles to next business (Gmail-style)
- [ ] Tap avatar opens bottom sheet with all businesses + "Add Business"
- [ ] Switch business rotates JWT, reloads all data, flip animation
- [ ] Owner can invite staff with phone + role
- [ ] Staff can accept invite with 6-char code
- [ ] Staff appears in staff list after acceptance
- [ ] Permission middleware blocks unauthorized actions (403)
- [ ] Owner-only routes reject staff (manage staff, delete business, modify settings)
- [ ] Same staff member can work across 2+ businesses with different roles
- [ ] 7 preset role templates auto-seeded on business creation
- [ ] Custom role builder still works (create/edit/delete custom roles)
- [ ] JWT contains businessId — no extra DB query per request
- [ ] FALLBACK_BUSINESS_ID removed from all files
- [ ] Route ownership validated — can't access other user's business via URL
- [ ] Audit log records: business switch, invite accepted, role changed, staff suspended
- [ ] Mobile: business selector uses bottom sheet, touch targets 44px+
- [ ] 320px: no horizontal scroll, business name truncated
- [ ] Staff Permission Screen shows read/edit/create/delete grid per role
- [ ] Permission Screen toggles between "By Role" and "By Person" view
- [ ] All 4 UI states for every new screen (loading, error, empty, success)
- [ ] Haptic feedback on business switch (mobile)
- [ ] Business switch clears all cached data from previous business (no data leak)
- [ ] Unsaved form data: confirmation dialog before switch (Save Draft / Discard / Cancel)
- [ ] Staff suspension immediately blacklists their token (no 15min window)
- [ ] resolveBusinessId() removed — all routes use req.user.businessId
- [ ] `grep -rn "FALLBACK_BUSINESS_ID\|business_1\|resolveBusinessId" src/ server/src/` → 0 results
- [ ] Owner can cancel pending invites
- [ ] Owner can resend expired invites (new code, same phone+role)
- [ ] Deep link invite: /join?code=XXXXXX pre-fills code on join page
- [ ] Max 10 businesses enforced — blocked with clear error at limit
- [ ] Swipe gesture confined to avatar element only — no pull-to-refresh conflict
- [ ] Partner role cannot manage staff (hire/fire/suspend)
- [ ] Login auto-loads lastActiveBusinessId (not index 0)
- [ ] "Clone settings" option when creating 2nd+ business
- [ ] Accountant role does NOT count toward staff limit
- [ ] Max 20 pending invites per business enforced
- [ ] Each business uses separate IndexedDB namespace (`hisaab_db_{businessId}`)
- [ ] PostgreSQL RLS policies active on all tenant-scoped tables as safety net
- [ ] Per-business rate limiting (500 req/min) in addition to per-user limits
