# Multi-Business Backlog | PRD #9 (Features #96-#102)

> Status: **In Progress** — Backend partially done, frontend not started
> Last updated: 2026-03-19
> Reference code: `recovered-from-dudhhisaab/` (DudhHisaab implementation to adapt)

---

## Batch A — Backend

| # | Task | Status | Files | Notes |
|---|------|--------|-------|-------|
| 1 | Prisma migration: `User.lastActiveBusinessId` | DONE | `server/prisma/schema.prisma`, migration | Committed `28b0d8f` |
| 2 | `businessId` in JWT + `req.user` | DONE | `server/src/lib/jwt.ts`, `server/src/middleware/auth.ts`, `server/src/services/auth.service.ts` | `resolveUserBusinessId()` added |
| 3 | Replace `resolveBusinessId()` in 31 route files → `req.user!.businessId` | TODO | 31 files in `server/src/routes/` | Mechanical find-replace. Verify: `grep -rn "resolveBusinessId" server/src/routes/` → 0 |
| 4 | Permission middleware | DONE | `server/src/middleware/permission.ts` | `requirePermission()` + `requireOwner()` |
| 5 | `POST /api/auth/switch-business` endpoint | TODO | `server/src/routes/auth.ts`, `server/src/services/auth.service.ts` | Invalidate old refresh token, update `lastActiveBusinessId`, rotate cookies, audit log |
| 6 | `POST /api/businesses/join` endpoint | TODO | `server/src/routes/settings.ts`, `server/src/services/settings.service.ts` | Validate code + phone match, create BusinessUser, mark invite ACCEPTED |
| 7 | Remove single-business guard + `MAX_BUSINESSES=10` | TODO | `server/src/services/business.service.ts` | Lines 29-36 currently block 2nd business |
| 8 | Clone business settings on create | TODO | `server/src/services/business.service.ts` | Copy: DocumentSettings, CustomFields, TermsTemplates, DocNumberSeries, ExchangeRates |
| 9 | 7 role templates (replace current 4) | TODO | `server/src/services/settings.service.ts` | Partner, Manager, Salesman, Cashier, Stock Manager, Delivery Boy, Accountant. Accountant doesn't count toward staff limit |
| 10 | Apply `requirePermission()` to mutation routes | TODO | Key route files: `documents.ts`, `payments.ts`, `party.ts`, `products.ts`, `settings.ts` | View routes need `module.view` minimum |
| 11 | Route ownership validation | TODO | `server/src/lib/business.ts` | `validateBusinessAccess()` exists — wire into routes that take `:businessId` param |
| 12 | Invite management: cancel + resend | TODO | `server/src/routes/settings.ts`, `server/src/services/settings.service.ts` | `DELETE .../invite/:id` + `POST .../invite/:id/resend` (new code, reset 48h). Max 20 pending per biz |
| 13 | Staff suspension/removal → blacklist token | TODO | `server/src/services/settings.service.ts` | Import `blacklistUser` from token-blacklist. Call on suspend + remove. Delete refresh tokens for that business |

---

## Batch B — Frontend

| # | Task | Status | Files | Notes |
|---|------|--------|-------|-------|
| 14 | AuthContext: `businesses[]`, `switchBusiness()`, `clearBusinessScopedData()` | TODO | `src/context/AuthContext.tsx` | Auto-load `lastActiveBusinessId` on login. Remove `FALLBACK_BUSINESS_ID` if exists. Ref: `recovered-from-dudhhisaab/frontend/src/context/AuthContext.tsx.modified` |
| 15 | Per-business IndexedDB namespace (`hisaab_db_{businessId}`) | TODO | `src/lib/offline.ts` or equivalent | Proxy-based DB factory. Ref: `recovered-from-dudhhisaab/frontend/src/services/db/` |
| 16 | BusinessAvatar component (header) | TODO | `src/components/layout/Header.tsx`, new `src/features/business/BusinessAvatar.tsx` | 36px circle, swipe-to-switch (40px threshold), tap → bottom sheet. Ref: `recovered-from-dudhhisaab/frontend/src/features/business/BusinessAvatar.tsx` |
| 17 | JoinBusiness page + deep link | TODO | New `src/features/settings/JoinBusinessForm.tsx` or `src/features/business/JoinBusiness.tsx` | `/join?code=XXXXXX` pre-fills code. 6-char input (OTP-style). Ref: `recovered-from-dudhhisaab/frontend/src/pages/JoinBusiness/` |
| 18 | StaffPermissionsPage + PermissionGrid | TODO | New `src/features/settings/StaffPermissionsPage.tsx` + `PermissionGrid.tsx` | Toggle: "By Role" / "By Person". Grid: Read/Edit/Create/Delete per module |
| 19 | Clone settings UI on "Add Business" | TODO | Business creation form | Toggle: "Clone settings from [Business]?" + source picker. Only shows for 2nd+ business |
| 20 | Update `routes.config.ts` | TODO | `src/config/routes.config.ts` | Add: `JOIN_BUSINESS`, `STAFF_PERMISSIONS`, `BUSINESS_LIST` |
| 21 | Wire routes in `App.tsx` | TODO | `src/App.tsx` | Lazy imports + `<Route>` for business pages |

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

- **Done:** 4/21 build steps (steps 1, 2, 4 + `validateBusinessAccess`)
- **TODO:** 17/21 build steps + 4 testing tasks
- **Estimated next session:** Finish Batch A backend (steps 3, 5-13), then Batch B frontend (steps 14-21)
- **Start with:** Step 3 (replace resolveBusinessId — mechanical, unblocks everything) → Step 7 (remove guard) → Step 5 (switch endpoint)
