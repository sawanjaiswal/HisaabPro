# Multi-Business Backlog | PRD #9 (Features #96-#102)

> Status: **COMPLETE** — All 21 build steps done. Testing tasks remaining.
> Last updated: 2026-03-27
> Reference code: `recovered-from-dudhhisaab/` (DudhHisaab implementation to adapt)

---

## Batch A — Backend

| # | Task | Status | Files | Notes |
|---|------|--------|-------|-------|
| 1 | Prisma migration: `User.lastActiveBusinessId` | DONE | `server/prisma/schema.prisma`, migration | Committed `28b0d8f` |
| 2 | `businessId` in JWT + `req.user` | DONE | `server/src/lib/jwt.ts`, `server/src/middleware/auth.ts`, `server/src/services/auth.service.ts` | `resolveUserBusinessId()` added |
| 3 | Replace `resolveBusinessId()` in 31 route files → `req.user!.businessId` | DONE | 31 files in `server/src/routes/` | Verified: `grep resolveBusinessId server/src/routes/` → 0 |
| 4 | Permission middleware | DONE | `server/src/middleware/permission.ts` | `requirePermission()` + `requireOwner()` |
| 5 | `POST /api/auth/switch-business` endpoint | DONE | `server/src/routes/auth.ts:262`, `server/src/services/auth.service.ts:487` | Token blacklist + cookie rotate + audit log |
| 6 | `POST /api/businesses/join` endpoint | DONE | `server/src/routes/settings.ts:59`, `server/src/services/settings.service.ts` | Validate code + phone, create BusinessUser, mark ACCEPTED |
| 7 | Remove single-business guard + `MAX_BUSINESSES=10` | DONE | `server/src/services/business.service.ts:14` | `MAX_BUSINESSES = 10`, count-based guard |
| 8 | Clone business settings on create | DONE | `server/src/services/business.service.ts:92-189` | 5 entities: DocSettings, CustomFields, Terms, NumberSeries, ExchangeRates |
| 9 | 7 role templates (replace current 4) | DONE | `server/src/services/settings.service.ts` | 7 system roles + accounting module added (2026-03-27) |
| 10 | Apply `requirePermission()` to mutation routes | DONE | 22 route files, 122 guard insertions | All POST/PUT/PATCH/DELETE guarded (2026-03-27) |
| 11 | Route ownership validation | DONE | `server/src/lib/business.ts` | `validateBusinessAccess()` + routes use `req.user!.businessId` from JWT |
| 12 | Invite management: cancel + resend | DONE | `settings.ts:148` resend, `settings.ts:154` cancel | requireOwner + rate limited |
| 13 | Staff suspension/removal → blacklist token | DONE | `settings.service.ts:539,557` | `blacklistUser()` called on suspend + remove |

---

## Batch B — Frontend

| # | Task | Status | Files | Notes |
|---|------|--------|-------|-------|
| 14 | AuthContext: `businesses[]`, `switchBusiness()`, `clearBusinessScopedData()` | DONE | `src/context/AuthContext.tsx` | businesses[], switchBusiness(), cached user/businesses, isSwitching state |
| 15 | Per-business IndexedDB namespace (`hisaab_db_{businessId}`) | DEFERRED | `src/lib/offline.ts` | Sync queue is API-scoped (JWT carries businessId). Full per-business DB factory deferred to Phase 2 |
| 16 | BusinessAvatar component (header) | DONE | `src/features/business/BusinessAvatar.tsx`, `src/components/layout/Header.tsx` | Avatar in header, shows on root pages |
| 17 | JoinBusiness page + deep link | DONE | `src/features/business/JoinBusinessPage.tsx` | 6-char code input, success/error states, translations |
| 18 | StaffPermissionsPage + PermissionGrid | DONE | `src/features/settings/StaffPermissionsPage.tsx` + `staff-permissions.css` | By Role / By Person toggle, read-only PermissionMatrix (2026-03-27) |
| 19 | Clone settings UI on "Add Business" | DONE | `src/features/business/CreateBusinessPage.tsx` + `useCreateBusiness.ts` + `create-business.css` | Clone toggle visible for 2+ businesses (2026-03-27) |
| 20 | Update `routes.config.ts` | DONE | `src/config/routes.config.ts` | Added `CREATE_BUSINESS`, `SETTINGS_PERMISSIONS`, `JOIN_BUSINESS` (2026-03-27) |
| 21 | Wire routes in `App.tsx` | DONE | `src/App.tsx`, `src/app.routes.ts` | Lazy imports + routes for StaffPermissions, CreateBusiness (2026-03-27) |

---

## Testing & Proof

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22 | curl proof: create business, switch, join, permission 403 | TODO | Success + 401 + 403 |
| 23 | Playwright: BusinessAvatar, JoinBusiness, PermissionGrid | TODO | 4 UI states each + 320px + 375px |
| 24 | Unit tests: business.utils, join-business.utils | TODO | Ref: `recovered-from-dudhhisaab/frontend/src/features/business/__tests__/` |
| 25 | Verify: `grep -rn "resolveBusinessId\|FALLBACK_BUSINESS_ID" server/src/ src/` → 0 results | TODO | Final sweep |

---

## Summary

- **Done:** 21/21 build steps (Step 15 deferred to Phase 2 — not blocking)
- **TODO:** 4 testing tasks (22-25)
- **Next:** curl proof + Playwright screenshots + unit tests
