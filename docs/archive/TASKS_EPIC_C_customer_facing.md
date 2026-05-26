# TASKS — Epic C: Customer-Facing Features (Phase 5)

**Status:** SEEDED (ready for agent intake)  
**Plan source:** `.claude/design-plan-active.md` (2026-05-14T14:14:00Z)  
**Architecture:** `docs/ARCHITECTURE_EPIC_C_customer_facing.md` (security revisions incorporated)

---

## Overview

Five PRs in sequence: PR1 (shared infra, not mergeable until green) → PR2-PR5 (all wait on PR1). Each PR has a Backend phase (schema → migration → service → routes → tests) and Frontend phase (routes → pages → tests), separated by **Proof Gates** (curl test, screenshot test, tsc clean). QA validates against SCOPE acceptance criteria. If proof missing → BLOCKED_NO_PROOF. If pre-req missing → BLOCKED_PREREQ.

**Gate ordering:**
1. Backend implementation + proof (curl 200/401/400/410/429, tsc clean, migrations succeed)
2. **Verifier:** curl test results + migration output
3. Frontend implementation + proof (4-state screenshots, 320px, console clean)
4. **Verifier:** screenshot evidence + console clean report
5. QA: validate feature acceptance criteria (read SCOPE + proof evidence)
6. If fail → Redo Agent fixes violations → re-run both Verifier gates → QA re-validates

---

## PR1 — Shared Infrastructure (BLOCKER for PR2-5)

**Shipping:** `SharedLink` model + opaque-token issuer/resolver + public route `/p/*` + rate limiter + `PublicLayout` + UPI deep-link util

**Dependency:** None. PR1 blocks PR2-5.

### Backend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Schema & Migration** | | | |
| Add `SharedLink` model to `server/prisma/schema.prisma` with `tokenHash @unique` (no plaintext `token` column), `resource` enum (INVOICE\|STORE\|INVITE), `resourceId`, `expiresAt`, `revokedAt`, `claimedAt`, `accessCount`, `lastAccessedAt`, `createdBy`. Add reverse `sharedLinks` relation on `Business`. | `npx prisma migrate dev --name epic_c_shared_links` succeeds; `SELECT tokenHash FROM "SharedLink"` works; `SELECT token FROM "SharedLink"` fails | `prisma migrate dev` output | [ ] |
| **Service Layer** | | | |
| Implement `server/src/services/shared-link.service.ts`: `issueShareLink(args)` returns `{ link: SharedLink; token: string }`. Token is 32-byte opaque random (`crypto.randomBytes(32).toString('base64url')`), hash stored, plaintext returned once. `revokeShareLink(id, reason?)` updates `revokedAt`. See ARCHITECTURE §6.2. | 1. Issue token, hash to DB, verify hash ≠ plaintext. 2. Verify token expires correctly (now + args.expiresIn). 3. Revoke sets `revokedAt` atomically. | unit test pass + coverage report | [ ] |
| Implement `server/src/services/public-resolver.service.ts`: `resolvePublicToken(req, expectedResource)` as the single entry point for all `/api/p/*`. Validates: (1) token hash exists (2) resource type matches (3) not revoked (4) not expired (5) not already claimed (INVITE only) (6) rate-limit check (7) audit log bump. Returns `{ link, resource }` or throws `PublicLinkError(code, status)`. See ARCHITECTURE §6.3. | 1. Valid token passes. 2. Missing token → 404 INVALID_TOKEN. 3. Wrong resource type → 404 INVALID_TOKEN (not enumeration oracle). 4. Revoked → 410 LINK_REVOKED. 5. Expired → 410 LINK_EXPIRED. 6. Already claimed (INVITE) → 410 LINK_CONSUMED. 7. Rate limit exceeded → 429 RATE_LIMITED. | curl test results | [ ] |
| Implement `server/src/services/public-sanitize.service.ts`: `sanitizeInvoiceForPublic(doc, business, party)` and `sanitizeStorefrontForPublic(business, products)`. Use explicit `Pick<>` types with hand-written object construction (no Prisma spread). Never expose party phone, email, address, GSTIN, PAN, bank, notes, userId, internal IDs, timestamps, cost/margin fields. See ARCHITECTURE §8. | Explicit allowlist DTO with every non-allowlisted field returning `undefined` when fuzzy-tested. | unit test + fuzz-every-field test pass | [ ] |
| **Middleware & Routing** | | | |
| Implement `server/src/middleware/public/rate-limit.ts`: Wraps the existing `RateLimitStore` (MemoryStore for MVP). Buckets: `pub:health:<ip>` 120/min, `pub:invoice:<ip>` 60/min, `pub:store:<ip>` 60/min, `pub:invite:<ip>` 30/min, `pub:claim:<ip>` 10/min. All 60s window. Returns 429 JSON with `{ success: false, error: { code: 'RATE_LIMITED' } }`. | 1. First 60 requests on `/api/p/invoice/*` from same IP → success. 2. 61st → 429 RATE_LIMITED. 3. Buckets are separate (hitting invite limit does not affect invoice limit). | curl loop + rate-limit bypass attempt | [ ] |
| Mount `server/src/routes/public.routes.ts` at `/api/p` BEFORE global auth/CSRF stack in `app.ts`. Stack order: `helmet → cors → compression → public-router (json + rate-limit + resolvePublicToken gate) → express.json → cookieParser → apiRateLimiter → csrfProtection`. | `GET /api/p/health` returns 200 with no cookies expected. No auth middleware on public routes. Public route cannot access `req.user` context (guard in handler). | curl to `/p/health` + headers inspect | [ ] |
| Implement `server/src/routes/public/invoice.routes.ts` (placeholder for PR3). One handler: `GET /api/p/invoice/:token`. Calls `resolvePublicToken(req, 'INVOICE')` first. | Placeholder compiles, tsc clean. PR3 fills in the payload. | tsc check | [ ] |
| Implement `server/src/routes/public/store.routes.ts` (placeholder for PR4). Handlers: `GET /api/p/store/:slug` and `GET /api/p/store/:slug/products`. Calls `resolvePublicToken` (store routes use slug, not token; see PR4 for full design). | Placeholder compiles, tsc clean. | tsc check | [ ] |
| Implement `server/src/routes/public/invite.routes.ts` (placeholder for PR5). Handlers: `GET /api/p/invite/:token`, `POST /api/p/invite/:token/claim`. Calls `resolvePublicToken`. | Placeholder compiles, tsc clean. | tsc check | [ ] |
| **Tests** | | | |
| Unit: `server/src/__tests__/shared-link.test.ts` — issue, revoke, hash-check, expiry-check, wrong-resource check. | All tests pass. Fuzz edge cases: token length boundaries, unicode payloads, expiry boundary (now + 1ms), token reuse after revoke. | test runner output | [ ] |
| Unit: `server/src/__tests__/public-resolver.test.ts` — valid token path, hash-not-found, wrong-resource, revoked, expired, already-claimed, rate-limit. | All tests pass. No race conditions on concurrent resolves (each is a read so safe). Mocked rate-limit returns expected 429. | test runner output | [ ] |
| Unit: `server/src/__tests__/public-rate-limit.test.ts` — per-bucket increments, 60s window, spillover to 429. | All tests pass. Redis-ready (mock store swap). | test runner output | [ ] |
| Unit: `server/src/__tests__/public-sanitize.test.ts` — fuzz every Prisma field against the DTO allowlist. For each non-allowlisted field, assert it does not appear in the output. For each allowlisted field, assert it is present and value is correct. | All tests pass, 100% Prisma field coverage (invoke coverage report). | test runner + coverage report | [ ] |

### Backend Proof Gate

**Status:** ⛔ **BLOCKED_NO_PROOF** until evidence rows below are filled.

| Check | Command / Test | Expected output | Evidence |
|-------|---|---|------|
| TypeScript clean | `cd server && tsc --noEmit` | No errors, 0 warnings | [ ] |
| Migration succeeds | `cd server && npx prisma migrate dev --name epic_c_shared_links && npx prisma db push` | Migration applied, schema in sync | [ ] |
| Rate limit bucket 1 | `for i in {1..60}; do curl -s http://localhost:3000/api/p/health; done` | 60× 200 OK | [ ] |
| Rate limit bucket 2 (overflow) | `curl http://localhost:3000/api/p/health` (61st request) | 429 with `{ code: 'RATE_LIMITED' }` | [ ] |
| Token hash at rest | `sqlite3 (or psql) SELECT COUNT(*) FROM "SharedLink" WHERE token IS NOT NULL` | 0 (no plaintext tokens stored) | [ ] |
| Token hash verification | Issue token via `issueShareLink()`, hash it, query DB with hash, verify match | Successful lookup, token ≠ hash | [ ] |
| Test suite pass (all) | `cd server && npm run test -- --testPathPattern='public\|shared' --coverage` | All tests pass, coverage ≥ 80% | [ ] |

**Verifier:** Run all checks above, capture output, confirm each row filled before Frontend gate opens.

---

### Frontend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Routes & Layout** | | | |
| Implement `src/features/public/PublicShell.tsx`: Header with business logo + name, no BottomNav, no auth context. CSS-isolated. Renders children. | Public pages do not render BottomNav or login button. Header has business branding. | screenshot | [ ] |
| Implement `src/features/public/hooks/usePublicLang.ts`: Read `?lang=` query param, fallback to `localStorage('public-lang')`, default 'en'. | Param read, stored, persisted. Switching lang and reloading preserves choice. | manual test in browser devtools | [ ] |
| Implement `src/features/public/public.css`: Bundle-isolated styles (no BottomNav height variables, no global nav styling). | Public pages use only public.css, no BottomNav spacing. | screenshot | [ ] |
| Update `src/AppRoot.tsx`: Inspect `window.location.pathname`, if starts with `/p/` render `<PublicShell>` else render `<AppShell>`. Both use same Vite entry. | Navigation between `/p/invoice/:token` and `/app/dashboard` switches layouts correctly. No hydration mismatch. | screenshot + browser console | [ ] |
| **API Client** | | | |
| No changes needed to `src/lib/api.ts` (public endpoints use unauthenticated `fetch` or `api()` with no cookie). Confirm offline queue does not interfere on public pages. | Public pages do not attempt to sync offline mutations. No errors in console. | console clean | [ ] |

### Frontend Proof Gate

**Status:** ⛔ **BLOCKED_NO_PROOF** until screenshot evidence below is filled.

| Check | Screenshot / Test | Expected | Evidence |
|-------|---|---|------|
| Load state | Visit `http://localhost:5173/p/` (placeholder page showing "Public") | Page loads, no nav, no errors | [ ] |
| Layout switch | Navigate from public route to app route | Layout switches, no flicker, no console errors | [ ] |
| Language toggle | Set `?lang=hi` on a public page, reload | Param persists in localStorage | [ ] |
| TypeScript clean | `cd client && tsc --noEmit` | No errors | [ ] |
| Console clean | Open DevTools on public pages | No `error`, `warn` (except expected third-party) | [ ] |

**Verifier:** Capture screenshots, run tsc, confirm console clean before PR1 gates to QA.

---

### QA Validation (PR1)

| Acceptance criterion (from SCOPE §7) | Proof evidence location | Status |
|---|---|---|
| `GET /p/health` → 200 with no auth cookie | Proof Gate curl output | [ ] |
| 61st request/min from same IP to `/p/*` → 429 `RATE_LIMITED` | Proof Gate rate-limit test | [ ] |
| `verify(sign(p, 60))` passes, expired token throws | Unit test `shared-link.test.ts` | [ ] |
| `tsc --noEmit` clean | Proof Gate tsc output | [ ] |
| Mobile 375px: public shell no horizontal overflow | Frontend screenshot at 375px | [ ] |

**Gate:** If all rows checked ✓, move to PR2. If any ⛔, invoke Redo Agent.

---

## PR2 — UPI QR on Invoice (#129)

**Shipping:** UPI deep-link builder + QR component + UPI payment settings  
**Dependency:** PR1 ✓ green  
**Impact:** No DB schema. Backward-compatible UI add.

### Backend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Service** | | | |
| Implement `server/src/services/upi-link.service.ts`: `buildUpiLink({ payeeVpa, payeeName, amountRupees?, transactionNote?, transactionRef? })` → `upi://pay?pa=...&pn=...&am=...`. VPA regex validation `/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/`. Amount: decimal string with 2 decimals (paise → rupees). See ARCHITECTURE §9. | 1. Valid VPA + amount → correct URI. 2. Invalid VPA → ValidationError. 3. Amount ≤ 100000. 4. Special chars in payeeName → URL-encoded. | unit test + curl to endpoint | [ ] |
| **Tests** | | | |
| Unit: `server/src/__tests__/upi-link.test.ts` — valid builds, VPA validation, amount boundaries, special-char encoding, max-length checks. | All tests pass. No hardcoded app names. | test runner output | [ ] |

### Backend Proof Gate

| Check | Command | Expected | Evidence |
|---|---|---|------|
| tsc clean | `cd server && tsc --noEmit` | No errors | [ ] |
| UPI link builder | Test `buildUpiLink({ payeeVpa: 'user@okhdfcbank', payeeName: 'Raju Shop', amountRupees: 1250 })` | `upi://pay?pa=user@okhdfcbank&pn=Raju+Shop&am=1250.00&cu=INR` | [ ] |
| Fuzz VPA regex | Test with invalid VPAs (`admin@`, `@okhdfc`, `user-name@ok-bank`) | All rejected with ValidationError | [ ] |
| Test suite | `cd server && npm run test -- upi-link.test` | All pass | [ ] |

---

### Frontend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Components** | | | |
| Implement `src/features/invoices/components/upi-pay-card.tsx`: `<UpiPayCard vpa={string} name={string} amount={number in paise} invoiceNo={string} />`. Renders QR code (lazy-loaded `qrcode.react`) + text "Tap to pay Rs X via UPI". Fallback if VPA missing: "Add UPI ID in Settings". Fallback if amount = 0: "Invoice fully paid" badge. | 1. QR visible when VPA present and amount > 0. 2. Text renders with correct amount (paise→rupees). 3. "Add UPI ID" link goes to settings. 4. "Fully paid" badge when amount=0. | screenshot 4 states (no UPI, UPI present, amount 0, loading) | [ ] |
| Implement `src/lib/upi.ts`: Client-side mirror of `buildUpiLink()`. Kept in sync with server version via comment. Used by QR card for the deep-link. Returns null if VPA invalid. | Same behavior as server; client-side validation gates the render. | unit test | [ ] |
| Implement `src/features/invoices/hooks/useUpiPayLink.ts`: Custom hook to build and memoize the UPI link. | Hook returns `{ upiLink, isValid }`. Memoized on VPA, amount change. | unit test | [ ] |
| **Settings** | | | |
| Implement `src/features/settings/components/upi-id-input.tsx`: Input for business UPI ID, wired to `BusinessSettings.upiId` (server-side, see PR3 scope). Optional, validated against VPA regex. | Input accepts valid VPA format, rejects invalid. Saves to settings. | screenshot of settings page with UPI input | [ ] |
| **Invoice Detail Page** | | | |
| Add `<UpiPayCard />` to invoice detail page layout, placed below invoice summary, above line items. Wire `vpa={business.settings?.upiId}`, `amount={invoice.amountDue}`, `invoiceNo={invoice.documentNumber}`. | Component renders in correct position. QR visible on invoice with UPI configured. | screenshot of invoice detail (3 states: no UPI, UPI present, fully paid) | [ ] |
| **PDF** | | | |
| Confirm React-PDF template does NOT include UPI QR. Screenshot PDF output and verify no QR present. | PDF invoice has no QR code, no UPI branding. | screenshot of generated PDF | [ ] |
| **Tests** | | | |
| Unit: `src/features/invoices/components/upi-pay-card.test.tsx` — 3 state tree tests (no VPA, VPA present, amount 0), QR render, text content, settings link. | All tests pass. | test runner output | [ ] |

### Frontend Proof Gate

| Check | Screenshot / Test | Expected | Evidence |
|---|---|---|------|
| Loading state | Mock invoice loading | Skeleton or placeholder, no errors | [ ] |
| No UPI state | Invoice detail, no UPI configured | "Add UPI ID" link visible, no QR | [ ] |
| UPI present state | Invoice detail, UPI configured, amount > 0 | QR visible, text "Tap to pay Rs X via UPI", tap opens `upi://` | [ ] |
| Amount 0 state | Invoice detail, amount = 0 | "Invoice fully paid" badge, no QR | [ ] |
| Mobile 320px | All 3 states on 320px viewport | No horizontal overflow, text readable, QR scales | [ ] |
| PDF check | Generate PDF of invoice with UPI configured | PDF has NO QR code, no UPI text | [ ] |
| Lang=hi | Public invoice page with `?lang=hi` | Hindi labels render | [ ] |
| tsc clean | `cd client && tsc --noEmit` | No errors | [ ] |
| Console clean | Open DevTools | No `error` logs | [ ] |

**Verifier:** Capture 4 screenshots (no UPI, UPI present, amount 0, PDF proof), 320px test, lang toggle test, tsc + console clean.

---

### QA Validation (PR2)

| Acceptance criterion (from SCOPE §7) | Proof evidence | Status |
|---|---|---|
| UPI QR absent from React-PDF output (screenshot: PDF has no QR) | Frontend Proof Gate PDF screenshot | [ ] |
| UPI deep-link on invoice detail page opens UPI app when tapped (manual test on Android) | Manual device test screenshot or record | [ ] |
| tsc clean after PR2 | Proof Gate tsc output | [ ] |
| Mobile 375px / 320px no overflow | Frontend Proof Gate screenshots | [ ] |

---

## PR3 — Web Invoice Share Links (#130)

**Shipping:** `SharedLink` for INVOICE resource + signed URL generation + public invoice page + share drawer with expiry picker + revocation UX  
**Dependency:** PR1 ✓ green, PR2 ✓ merged (UPI card component available)  
**Security gate before merge:** Security audit residual checks (see ARCHITECTURE §16) must be re-verified.

### Backend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Routes** | | | |
| Implement `server/src/routes/documents/share-links.routes.ts` (authenticated, mounted under `/api/documents`): `GET /api/documents/:docId/share-links` lists active+revoked links (no `shareUrl` field), `POST /api/documents/:docId/share-links` issues new link with `{ expiresIn: number (seconds) }` and returns link + `shareUrl` in response, `PATCH /api/shared-links/:id` revokes (tenant-scoped). All routes enforce `businessId === req.businessId` + tenant-scoped service calls. | 1. Issue link: response includes `shareUrl`. 2. Get list: no `shareUrl`. 3. Revoke: `revokedAt` set. 4. Cross-tenant access → 403. | curl test results | [ ] |
| Fill in `server/src/routes/public/invoice.routes.ts`: `GET /api/p/invoice/:token` calls `resolvePublicToken(req, 'INVOICE')`, loads invoice + business + party, sanitizes with `sanitizeInvoiceForPublic()`, returns `{ success: true, data: {...} }`. Error codes: 401 INVALID_TOKEN, 410 LINK_EXPIRED, 410 LINK_REVOKED, 404 (if link.resourceId not found — should be rare). See ARCHITECTURE §6.3 for handler pattern. | 1. Valid token + active link → 200 + sanitized payload. 2. Expired → 410. 3. Revoked → 410. 4. Bad sig → 401. 5. Payload includes only allowlisted fields (see sanitize test). | curl test + payload inspection | [ ] |
| **Service** | | | |
| Extend `server/src/services/shared-link.service.ts` (already from PR1) with issue-specific overload for INVOICE: `issueInvoiceShareLink(invoiceId, businessId, createdBy, expiresIn?)` — validates invoice belongs to business, issues SharedLink. | Successful issue returns token + link metadata. Invalid invoiceId → service error. | unit test | [ ] |
| Confirm `server/src/services/public-sanitize.service.ts` is already implemented from PR1 with `sanitizeInvoiceForPublic()` DTO. | Reuse from PR1, no new implementation. | (already gated in PR1) | [ ] |
| **Tests** | | | |
| Unit: `server/src/__tests__/public-resolver.test.ts` already covers token checks; extend with invoice-specific path test. | Token path, revoke path, expire path all return correct status codes. | test runner output | [ ] |
| Unit: `server/src/__tests__/public-sanitize.invoice.test.ts` — fuzz every field of a fully-hydrated `DocumentWithLineItems` + `Business` + `Party`. Assert non-allowlisted fields return undefined. | All tests pass, fuzz coverage 100% (grep count of Prisma fields vs assertion count). | test runner + coverage report | [ ] |

**Security gate before merge:** See ARCHITECTURE §16, residual checks 1–5:
- [ ] Token entropy proof in code review (`crypto.randomBytes(32)`)
- [ ] `trust proxy: 1` confirmed in `app.ts`
- [ ] XSS escape audit on `partyName`, `businessName` rendering (no `dangerouslySetInnerHTML`)
- [ ] Confirm `/api/p/*` mounted before `csrfProtection`, no cookies written on public routes except session (after claim)

### Backend Proof Gate

| Check | Command / Test | Expected | Evidence |
|---|---|---|------|
| tsc clean | `tsc --noEmit` | No errors | [ ] |
| Issue link | `POST /api/documents/:id/share-links { expiresIn: 604800 }` (7d in seconds) | 200, response includes `shareUrl` + `expiresAt` | [ ] |
| Get links (auth) | `GET /api/documents/:id/share-links` with session | 200, list includes issued link, no `shareUrl` field | [ ] |
| Public invoice (valid) | `GET /api/p/invoice/:token` | 200, payload includes sanitized fields | [ ] |
| Public invoice (expired) | Same token after expiry time | 410 LINK_EXPIRED | [ ] |
| Public invoice (revoked) | Revoke link, then request | 410 LINK_REVOKED | [ ] |
| Public invoice (bad sig) | Tampered token | 401 INVALID_TOKEN | [ ] |
| Sanitize test | Run `npm run test -- public-sanitize.invoice` | All pass, 100% field coverage | [ ] |
| Rate limit on public invoice | 61 requests in 60s to `/api/p/invoice/*` from same IP | 61st → 429 | [ ] |
| Security checks | Code review for points 1–5 above | All confirmed | [ ] |

---

### Frontend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Share Drawer** | | | |
| Implement `src/features/invoices/components/share-drawer-expiry.tsx`: Radio group "Link expires in" with options 7d / 30d (default) / 90d / Never. Clicking option updates state. | State updates correctly, preselects 30d. | screenshot | [ ] |
| Implement `src/features/invoices/components/share-links-list.tsx`: Table of existing links (createdAt, expiresAt, status, accessCount, revoke button). Revoke shows inline confirm. | Links listed, old links show status (expired/revoked/active), revoke button works. | screenshot | [ ] |
| Implement `src/features/invoices/components/share-link-issued-toast.tsx`: One-time toast after link issue, displays full `shareUrl`. Toast dismissable, URL stays visible until dismiss. | Toast shows `shareUrl`, can copy, dismisses, URL gone after dismiss. | screenshot | [ ] |
| Update share drawer: integrate expiry picker + issue button + link list + issued toast. Flow: pick expiry → click "Copy link" → toast shows URL → close toast → URL is gone, re-issue to get new URL. | Drawer UX flows end-to-end. Copy button works (Clipboard API). Share on WhatsApp button constructs correct WA message with URL. | screenshot | [ ] |
| **Public Invoice Page** | | | |
| Implement `src/features/public/invoice/PublicInvoicePage.tsx`: Calls `usePublicInvoice(token)` hook, loads invoice data, renders `<PublicShell>` + invoice summary + line items + `<UpiPayCard />` (PR2 component). Language toggle via `usePublicLang()`. | Page loads, renders invoice data, UPI card visible, language toggle works. | screenshot 4 states (loading, error, empty, success) | [ ] |
| Implement `src/features/public/invoice/PublicInvoicePage.states.tsx`: 4 UI states — loading (skeleton), error (Sentry-friendly), empty (no line items), success (full invoice). | Each state renders correctly, no console errors. | 4 screenshots | [ ] |
| Implement `src/features/public/invoice/hooks/usePublicInvoice.ts`: Hook that calls `/api/p/invoice/:token`, handles loading/error, memoizes on token. Graceful 401/410/404 handling. | Hook fetches, caches, refetch on token change. Error states handled. No unhandled promise rejections. | console clean + unit test | [ ] |
| **Service** | | | |
| Implement `src/features/invoices/services/share-links-crud.service.ts` (authenticated): wraps `/api/documents/:id/share-links` endpoints. `createShareLink(docId, expiresIn)`, `listShareLinks(docId)`, `revokeShareLink(linkId)`, `copyLink(url)` (Clipboard API). | All calls go through `api()` helper with `entityType: 'document'`, `entityLabel: documentNumber`. Offline queue shows "Syncing share link for INV-001". | unit test + manual offline test | [ ] |
| **Tests** | | | |
| Unit: `src/features/public/invoice/hooks/usePublicInvoice.test.ts` — mock fetch, test loading/error/success states, token change triggers refetch. | All tests pass. | test runner output | [ ] |
| Unit: `src/features/invoices/services/share-links-crud.test.ts` — mock api calls, test CRUD flow. | All tests pass. | test runner output | [ ] |

### Frontend Proof Gate

| Check | Screenshot / Test | Expected | Evidence |
|---|---|---|------|
| Loading state | Visit `/p/invoice/:token` while loading | Skeleton invoice, no data | [ ] |
| Error state | Visit `/p/invoice/invalid-token` | Error message, no crash, console clean | [ ] |
| Empty state | Valid token, invoice with no line items | Invoice renders, line-items section shows "no items" or hidden | [ ] |
| Success state | Valid token, full invoice | Invoice summary, line items, UPI card, all data visible | [ ] |
| Share drawer (expiry) | Open share drawer, select 7d then 30d | Selected option updates, form state correct | [ ] |
| Share drawer (issue) | Click "Copy link" | Toast appears with full URL, URL copied to clipboard | [ ] |
| Share drawer (revoke) | Click revoke button | Confirm dialog, revoke confirms, toast shows revoked status | [ ] |
| Public page lang toggle | Add `?lang=hi` to public URL | Hindi labels appear (party name, amount labels) | [ ] |
| Mobile 320px | Public invoice page at 320px | No horizontal overflow, text readable, QR scales | [ ] |
| tsc clean | `tsc --noEmit` | No errors | [ ] |
| Console clean | DevTools | No errors, no unhandled promises | [ ] |

**Verifier:** Capture 4-state screenshots (loading, error, empty, success), drawer screenshots (expiry, issue, revoke), lang=hi test, 320px test, tsc + console.

---

### QA Validation (PR3)

| Acceptance criterion (from SCOPE §7) | Proof evidence | Status |
|---|---|---|
| Share drawer gains expiry picker (7d / 30d / 90d / Never) | Frontend Proof Gate drawer screenshot | [ ] |
| "Copy link" + "Share on WhatsApp" buttons work | Proof Gate share drawer test | [ ] |
| Existing links listed with revoke button | Proof Gate drawer screenshot | [ ] |
| `GET /api/p/invoice/:token` returns 200 active, 410 expired/revoked, 401 bad sig | Proof Gate curl results | [ ] |
| No PII leak: public invoice payload omits party phone, email, address | Proof Gate + ARCHITECTURE §8 allowlist review | [ ] |
| `?lang=hi` on invoice public page renders Hindi labels | Proof Gate lang toggle screenshot | [ ] |
| tsc clean after PR3 | Proof Gate tsc output | [ ] |
| Mobile 320px no overflow | Frontend Proof Gate screenshot | [ ] |

---

## PR4 — Online Storefront (#121)

**Shipping:** Storefront settings (Business fields + StorefrontProduct join table) + slug validation (reserved list, ASCII regex) + public store page + WhatsApp deep-link CTA  
**Dependency:** PR1 ✓ green  
**Schema:** Add columns to `Business`, create `StorefrontProduct` table  
**Security gate before merge:** Slug validation rules (ARCHITECTURE §H) must be verified; reserved-list fuzz test.

### Backend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Schema & Migration** | | | |
| Add to `Business` model: `storefrontSlug String? @unique`, `storefrontIsPublic Boolean @default(false)`, `storefrontTagline String?`, `storefrontTheme String @default("LIGHT")`, `storefrontWhatsapp String?`. Create `StorefrontProduct` join table with `businessId`, `productId`, `priceVisible Boolean`, `sortOrder Int`, unique on (businessId, productId). See ARCHITECTURE §2. | `npx prisma migrate dev --name epic_c_storefront_fields` succeeds. Schema includes new columns and join table. | migration output | [ ] |
| **Service Layer** | | | |
| Implement `server/src/lib/reserved-slugs.ts`: Const array `RESERVED_SLUGS` with 30+ reserved words (admin, api, p, public, www, app, login, signup, billing, settings, help, support, about, contact, terms, privacy, root, system, staff, owner, store, stores, invite, invites, invoice, invoices, me, health, status, static, assets). Export `isReservedSlug(slug: string)` that compares lowercased input. | Array exported, function works on mixed-case input. | unit test (try `isReservedSlug('ADMIN')` → true, `isReservedSlug('myshop')` → false) | [ ] |
| Implement `server/src/services/storefront-slug.service.ts`: `validateSlug(input)` — (1) lowercase, (2) regex test `/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/` (3–32 chars, no leading/trailing hyphen, ASCII only), (3) reserved-list check. Returns `{ valid: boolean, error?: string }`. Used by Zod validator. | Validate `myshop` → valid. `MYSHOP` (uppercase) → lowercase + valid. `admin` → reserved. `my-shop-` (trailing hyphen) → invalid. `админ` (unicode) → invalid. | unit test + fuzz test | [ ] |
| Implement `server/src/routes/storefront/storefront.validators.ts` (Zod): `storefrontSlugSchema` with `.transform(s => s.toLowerCase())`, `.refine(s => SLUG_RE.test(s), { message: 'INVALID_SLUG' })`, `.refine(s => !isReservedSlug(s), { message: 'RESERVED_SLUG' })`. | Schema validates per rules, rejects reserved, rejects non-ASCII. | unit test | [ ] |
| Implement `server/src/services/storefront.service.ts` (authenticated): `updateStorefrontSettings(businessId, { slug, tagline, theme, whatsapp, isPublic })` validates slug uniqueness (must be unique across all businesses; DB unique constraint + try-catch for 409), updates Business + manages StorefrontProduct rows based on `products` input (visibility + sort order). `getStorefrontBySlug(slug)` loads Business + StorefrontProducts for public read. | Settings update succeeds with valid slug. Duplicate slug → 409 SLUG_TAKEN. Reserved slug → 400 RESERVED_SLUG. Invalid slug → 400 INVALID_SLUG. | unit test + curl test | [ ] |
| Implement `server/src/routes/public/store.routes.ts` (public): `GET /api/p/store/:slug` calls `getStorefrontBySlug(slug)`, sanitizes with `sanitizeStorefrontForPublic()`, returns `{ success: true, data: {...} }`. Error: 404 if store disabled or slug not found. | Valid slug → 200 + payload. Invalid slug → 404. Disabled store → 404. | curl test | [ ] |
| Implement `server/src/routes/storefront/storefront.routes.ts` (authenticated): CRUD endpoints for settings (`GET /api/businesses/me/storefront`, `PATCH /api/businesses/me/storefront`). `PATCH` accepts `{ slug, tagline, theme, whatsapp, isPublic, products }`. | GET returns current settings. PATCH updates and returns new settings. | curl test | [ ] |
| **Tests** | | | |
| Unit: `server/src/__tests__/storefront-slug.test.ts` — validate rules, reserved list, case insensitivity, boundary cases. | All tests pass. Fuzz unicode, mixed case, leading/trailing hyphen, double hyphen. | test runner output | [ ] |
| Unit: `server/src/__tests__/public-sanitize.storefront.test.ts` — fuzz every field of `Business` + `StorefrontProduct[]`. Assert non-allowlisted fields (email, GSTIN, bankDetails, productCostPrice, etc.) return undefined. | All tests pass, 100% field coverage. | test runner + coverage | [ ] |
| Integration: Create business → enable storefront → add products → GET /api/p/store/:slug → verify response shape and visibility. | Flow succeeds, response includes only public fields. | curl test sequence | [ ] |

**Security gate before merge:** Slug validation rules verified:
- [ ] Reserved-slug const matches ARCHITECTURE §H list
- [ ] Slug regex is ASCII-only `/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/`
- [ ] Stored lowercase (validator lowercases before write)
- [ ] Unique constraint prevents collision
- [ ] Reserved-list fuzz test passes (try all reserved words + mixed case)

### Backend Proof Gate

| Check | Command / Test | Expected | Evidence |
|---|---|---|------|
| tsc clean | `tsc --noEmit` | No errors | [ ] |
| Migration succeeds | `npx prisma migrate dev --name epic_c_storefront_fields` | Migration applied, schema in sync | [ ] |
| Slug validation | Test `validateSlug('mystore')` → valid, `validateSlug('admin')` → reserved, `validateSlug('my-store')` → valid, `validateSlug('MY-STORE')` → lowercase + valid, `validateSlug('мой-магазин')` → invalid (unicode) | All pass as expected | [ ] |
| Create storefront | `PATCH /api/businesses/me/storefront { slug: 'myshop', tagline: '...' }` | 200, slug stored lowercase | [ ] |
| Duplicate slug | Two businesses try `slug: 'myshop'` | First succeeds, second → 409 SLUG_TAKEN | [ ] |
| Reserved slug | `PATCH` with `slug: 'admin'` | 400 RESERVED_SLUG | [ ] |
| Invalid slug | `PATCH` with `slug: 'my-'` (trailing hyphen) | 400 INVALID_SLUG | [ ] |
| Public store GET (valid) | `GET /api/p/store/myshop` (store enabled, products added) | 200, response includes business name, tagline, products (price visible/hidden per setting) | [ ] |
| Public store GET (disabled) | `GET /api/p/store/myshop` (isPublic=false) | 404 | [ ] |
| Public store GET (invalid slug) | `GET /api/p/store/nonexistent` | 404 | [ ] |
| Sanitize test | `npm run test -- public-sanitize.storefront` | All pass, 100% field coverage | [ ] |

---

### Frontend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Settings Page** | | | |
| Implement `src/features/settings/storefront/StorefrontSettingsPage.tsx`: Tab in settings for "Online Store". Shows enable toggle, slug picker, tagline input (max 80 chars), theme selector (LIGHT/DARK radio), WhatsApp fallback toggle, product visibility multi-select. | Page loads, all inputs respond, updates persist. | screenshot of settings | [ ] |
| Implement `src/features/settings/storefront/components/slug-picker.tsx`: Input for slug, real-time validation feedback. Shows error if reserved, invalid, or taken. Live preview of public URL `hisaabpro.in/p/store/:slug`. | Input validates, shows errors inline, preview updates, copy-to-clipboard button works. | screenshot | [ ] |
| Implement `src/features/settings/storefront/components/product-visibility-picker.tsx`: Multi-select of products. Toggle per product: "Show price" checkbox (default true). Drag-to-reorder sort. | Product list loads, visibility toggles, sort works, changes persist. | screenshot | [ ] |
| Implement `src/features/settings/storefront/hooks/useStorefrontSettings.ts`: Hook to fetch + mutate storefront settings. Calls `api()` with `entityType: 'storefront'`, `entityLabel: slug`. | Hook handles loading/error, offline queue shows "Syncing storefront settings". | unit test | [ ] |
| Implement `src/features/settings/storefront/services/storefront-crud.service.ts` (authenticated): CRUD wrappers around `/api/businesses/me/storefront`. | All mutations go through `api()` helper with proper offline metadata. | unit test | [ ] |
| **Public Storefront Page** | | | |
| Implement `src/features/public/store/PublicStorePage.tsx`: Calls `usePublicStore(slug)` hook, renders business name, tagline, theme, product grid. Per-product: name, unit, price (if visible), WhatsApp CTA button. | Page loads, products render, prices hidden if applicable, WhatsApp link works. | screenshot 4 states (loading, error, empty, success) | [ ] |
| Implement `src/features/public/store/components/whatsapp-cta.tsx`: Button "Order on WhatsApp". Deep-link: `https://wa.me/<number>?text=Hi%2C+I+want+to+order+<product_name>`. | Button tap opens WhatsApp with pre-filled message. | manual test on phone / emulator | [ ] |
| Implement `src/features/public/store/hooks/usePublicStore.ts`: Hook to fetch `/api/p/store/:slug`, handle errors (404, etc.). | Hook fetches, caches, handles slug change. | unit test | [ ] |
| **Tests** | | | |
| Unit: `src/features/settings/storefront/slug-picker.test.tsx` — input validation feedback, error message display, live preview. | All tests pass. | test runner output | [ ] |
| Unit: `src/features/public/store/whatsapp-cta.test.tsx` — deep-link construction with special chars in product name, phone number validation. | All tests pass. | test runner output | [ ] |

### Frontend Proof Gate

| Check | Screenshot / Test | Expected | Evidence |
|---|---|---|------|
| Settings page load | Open storefront settings tab | Page loads, enable toggle visible, slug input visible | [ ] |
| Slug validation feedback (valid) | Type `myshop` | Green checkmark, preview shows URL | [ ] |
| Slug validation feedback (reserved) | Type `admin` | Red error "Slug is reserved" | [ ] |
| Slug validation feedback (invalid) | Type `my-` | Red error "Invalid format" | [ ] |
| Product visibility picker | Open product multi-select | Products list, visibility toggle per product, reorder works | [ ] |
| Public store (loading) | Visit `/p/store/:slug` while loading | Skeleton grid, no data | [ ] |
| Public store (error) | Visit `/p/store/nonexistent` | Error message, console clean | [ ] |
| Public store (empty) | Visit `/p/store/:slug` (store enabled, no products) | Empty state or "No products" | [ ] |
| Public store (success) | Visit `/p/store/:slug` (products added, some hidden) | Products render, hidden prices show `—`, visible prices show amount, WhatsApp button per product | [ ] |
| WhatsApp CTA | Click "Order on WhatsApp" button | Opens WhatsApp deep-link with `?text=Hi%2C+I+want+to+order+<product>` | [ ] |
| Mobile 320px | Public store page at 320px | Product grid responsive, no horizontal overflow, buttons clickable | [ ] |
| Theme toggle (DARK) | Change theme to DARK in settings | Public page renders dark mode (if implemented) | [ ] |
| tsc clean | `tsc --noEmit` | No errors | [ ] |
| Console clean | DevTools on public store | No errors | [ ] |

**Verifier:** Capture settings page screenshot, slug-picker feedback screenshots (valid, reserved, invalid), product-picker screenshot, 4-state public store screenshots (loading, error, empty, success), WhatsApp CTA test, 320px test, tsc + console.

---

### QA Validation (PR4)

| Acceptance criterion (from SCOPE §7) | Proof evidence | Status |
|---|---|---|
| Storefront settings enable/disable, slug, tagline, product visibility | Frontend Proof Gate settings screenshots | [ ] |
| `GET /api/p/store/:slug` returns products with `price: null` when hidden | Proof Gate public store success screenshot (verify hidden price) | [ ] |
| `GET /api/p/store/nonexistent` → 404 | Proof Gate curl test | [ ] |
| Reserved-slug validation (admin, api, p, store, etc.) | Proof Gate slug-picker error screenshot + curl test | [ ] |
| Slug lowercased + unique (race test: two businesses same slug) | Unit test `storefront-slug.test.ts` + curl 409 test | [ ] |
| WhatsApp CTA opens deep-link with product name | Proof Gate manual WhatsApp test | [ ] |
| tsc clean after PR4 | Proof Gate tsc output | [ ] |
| Mobile 320px no overflow | Proof Gate screenshot | [ ] |

---

## PR5 — Party Invite Portal (#131)

**Shipping:** `Party.userId` field (nullable, unique) + invite issuance + OTP-guarded claim flow + public invite preview page  
**Dependency:** PR1 ✓ green (resolvePublicToken, rate limit, shared infra)  
**Schema:** Add column to `Party`, add migration  
**Security gates before merge:**
- [ ] OTP verification mandatory for existing-user branch (ARCHITECTURE §11)
- [ ] Atomic claim transaction with `updateMany` race guard (ARCHITECTURE §6.4)
- [ ] No service-layer read-then-write gap
- [ ] `Party.userId @unique` enforced in schema
- [ ] All three residual checks from ARCHITECTURE §16 (post-impl code review)

### Backend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Schema & Migration** | | | |
| Add to `Party` model: `userId String? @unique`, `user User? @relation(fields: [userId], references: [id], onDelete: SetNull)`. Reverse on `User`: `linkedParties Party[]`. | `npx prisma migrate dev --name epic_c_party_user_link` succeeds. Schema includes new FK + unique constraint. | migration output | [ ] |
| **Service Layer — Invite Issuance** | | | |
| Implement `server/src/services/party-invite.service.ts`: `issueInvite(partyId, businessId, createdBy)` issues a SharedLink with `resource: 'INVITE'`, `resourceId: partyId`, `expiresAt: now + 7d` (fixed, no picker). Returns `{ link, token }`. Load Party by `(id, businessId)` — tenant-scoped. | Successful issue returns token + link. Invalid partyId → service error. | unit test | [ ] |
| **Service Layer — OTP for Claim** | | | |
| Implement `server/src/services/party-invite.otp.service.ts`: Wraps `/api/auth/otp/*` endpoints scoped to `purpose: 'invite-claim'`. `sendOtp(phone, linkTokenHash)` sends SMS to phone, `verifyOtp(phone, code, linkTokenHash)` verifies and returns `otpSessionId`. The session is tied to both the phone AND the link token hash so a replay of one token cannot re-use an OTP session from a different token. | OTP sent + verified, session tied to phone + token hash. | unit test | [ ] |
| **Service Layer — Atomic Claim** | | | |
| Implement `server/src/services/party-invite.claim.service.ts`: `claimInvite(token, newUserId)` runs a single `$transaction`:  (1) Atomic `updateMany` on SharedLink: `WHERE { tokenHash, resource: 'INVITE', revokedAt: null, claimedAt: null, expiresAt check }` → `DATA { claimedAt: now, revokedAt: now }`. If `count === 0` → throw 409 LINK_CONSUMED. (2) Atomic `updateMany` on Party: `WHERE { id: link.resourceId, businessId: link.businessId, userId: null }` → `DATA { userId: newUserId }`. If `count === 0` → throw 409 ALREADY_CLAIMED (party already linked to another user). Returns `{ partyId }`. See ARCHITECTURE §6.4. | Both updates run atomically. Concurrent claims race: first wins (count=1), others see count=0 and throw 409. Idempotent on retry (re-run sees count=0 again). | unit test + concurrency test (50 parallel claims, 1 success + 49× 409) | [ ] |
| **Routes** | | | |
| Implement `server/src/routes/parties/invite.routes.ts` (authenticated): `POST /api/parties/:id/invite` issues invite for a single party. Tenant-scoped: `Party.businessId === req.businessId`. Calls `issueInvite()`. Response includes `shareUrl`. | Invite issued successfully. Cross-tenant access → 403. Invalid partyId → 404. | curl test | [ ] |
| Implement `server/src/routes/public/invite.routes.ts` (public):  (1) `GET /api/p/invite/:token` — calls `resolvePublicToken(req, 'INVITE')`, loads Party + Business, returns masked data (business name, party name, masked phone `+91****1234`). (2) `POST /api/p/invite/:token/claim` — calls `resolvePublicToken(req, 'INVITE')`, accepts `{ otpSessionId }` (from `/api/auth/otp/verify`), checks OTP session is valid for this phone + token, resolves target User (branch: existing or create new), calls `claimInvite(token, userId)`, on success issues session cookies + returns user data, on race (409) returns 409 without mutating. See ARCHITECTURE §11. | GET returns preview (no PII). POST on existing-user branch requires OTP. On success, user logged in. On race, 409. | curl test sequence | [ ] |
| **Tests** | | | |
| Unit: `server/src/__tests__/party-invite.claim.test.ts` — happy path, race conditions (concurrent claims), already-claimed (party bound to different user), expired token, revoked token, OTP missing for existing-user branch. | All tests pass. 50 concurrent claims: 1 success, 49× 409. | test runner output | [ ] |
| Unit: `server/src/__tests__/party-invite.otp.test.ts` — OTP send/verify, session tied to phone + token hash, replay attack fails (same token with different OTP session). | All tests pass. | test runner output | [ ] |

**Security gate before merge:**
- [ ] Atomic claim: `updateMany` used, not read-then-write
- [ ] `Party.userId @unique` enforced in schema + test verifies 2nd bind fails
- [ ] OTP verification mandatory in code review (`claimInvite` requires `otpSessionId` for existing-user branch)
- [ ] Rate limit on `/api/p/invite/:token/claim`: 10/min per IP (from ARCHITECTURE §5)
- [ ] Residual checks from ARCHITECTURE §16 post-impl review

### Backend Proof Gate

| Check | Command / Test | Expected | Evidence |
|---|---|---|------|
| tsc clean | `tsc --noEmit` | No errors | [ ] |
| Migration succeeds | `npx prisma migrate dev --name epic_c_party_user_link` | Migration applied, schema in sync, `Party.userId @unique` constraint exists | [ ] |
| Issue invite | `POST /api/parties/:id/invite { partyId }` (auth) | 200, response includes `shareUrl` + `expiresAt: now + 7d` | [ ] |
| Invite GET (valid) | `GET /api/p/invite/:token` (public) | 200, response includes masked business name + masked party phone | [ ] |
| Invite GET (expired) | Same token after 7d | 410 LINK_EXPIRED | [ ] |
| Invite GET (bad sig) | Tampered token | 401 INVALID_TOKEN | [ ] |
| Invite claim (new user) | Full signup flow via invite: GET → OTP send → OTP verify → claim | 200, new User created, Party.userId set, session issued | [ ] |
| Invite claim (existing user, OTP verified) | GET → OTP send (to party phone) → OTP verify (session) → claim with otpSessionId | 200, Party.userId set, session issued | [ ] |
| Invite claim (existing user, NO OTP) | GET → claim without otpSessionId | 401 OTP_REQUIRED (no Party mutation) | [ ] |
| Invite claim (race: 50 concurrent) | 50 parallel claim requests on same token | 1× count=1 (success, 200), 49× count=0 (409 LINK_CONSUMED) | [ ] |
| Invite claim (already bound) | First claim succeeds (Party.userId set), second claim on same token | First: 200, second: 409 ALREADY_CLAIMED (Party.userId @unique prevented re-bind) | [ ] |
| Rate limit on claim | 11 requests in 60s to `/api/p/invite/:token/claim` from same IP | 11th → 429 RATE_LIMITED | [ ] |
| Test suite | `npm run test -- party-invite` | All tests pass, concurrency test included | [ ] |

---

### Frontend Tasks

| Task | Acceptance | Evidence Type | Status |
|------|-----------|---|--------|
| **Public Invite Page** | | | |
| Implement `src/features/public/invite/PublicInvitePage.tsx`: Calls `usePublicInvite(token)` hook, renders `<PublicShell>` + business name + "Create your account" CTA. Branches based on phone match: (a) new signup, (b) existing user → OTP step. | Page loads, shows business name, CTA button visible. | screenshot 4 states (loading, error, preview, claimed) | [ ] |
| Implement `src/features/public/invite/PublicInviteOtpStep.tsx`: On phone match to existing user, shows OTP form: "We've sent an OTP to your registered phone", input for 6-digit code, "Resend" button (rate-limited), "Continue" button. After verify, proceeds to claim. | OTP step visible for existing users, input accepts code, verify calls API, on success navigates to success state. | screenshot | [ ] |
| Implement `src/features/public/invite/hooks/usePublicInvite.ts`: Hook to fetch `/api/p/invite/:token`, handle loading/error/preview states, branch logic (new vs existing user). Integrates with signup/login flows. | Hook fetches preview, detects phone branch, guides through flow. | unit test | [ ] |
| **Integration with Auth** | | | |
| Update signup flow: When invite token present (`?invite=:token` query param), pre-populate party phone + create User with Party linkage. Final step calls `/api/p/invite/:token/claim` (handled by backend). | Signup via invite sets `Party.userId` automatically. | integration test | [ ] |
| Update login flow: When invite token present + existing user, login can flow into OTP-for-claim step (or OTP happens during invite claim, TBD with auth agent). | Flow supports OTP for invite claim on existing-user branch. | integration test | [ ] |
| **Tests** | | | |
| Unit: `src/features/public/invite/PublicInvitePage.test.tsx` — preview state, branch detection (new vs existing), error state. | All tests pass. | test runner output | [ ] |
| Unit: `src/features/public/invite/PublicInviteOtpStep.test.tsx` — OTP input, verify call, error handling. | All tests pass. | test runner output | [ ] |
| Integration: Full invite flow (issue → preview → OTP → claim → success). | Flow completes end-to-end, User created + Party linked, session issued. | integration test | [ ] |

### Frontend Proof Gate

| Check | Screenshot / Test | Expected | Evidence |
|---|---|---|------|
| Loading state | Visit `/p/invite/:token` while loading | Skeleton layout, no errors | [ ] |
| Error state | Visit `/p/invite/:bad-token` | Error message, console clean | [ ] |
| Preview state (new user) | Visit `/p/invite/:token` (phone not registered) | Business name, party name, "Create account" CTA visible | [ ] |
| Preview state (existing user) | Visit `/p/invite/:token` (phone already registered) | Business name, party name, CTA visible, clicking CTA → OTP step | [ ] |
| OTP step | After clicking CTA for existing user | "OTP sent to your phone", input field, "Resend" button, "Continue" button | [ ] |
| OTP verify | Enter valid 6-digit code | "Verifying..." → success state (navigate to user dashboard) | [ ] |
| OTP error | Enter invalid code | Error message, "Resend" option | [ ] |
| Claimed state (after success) | After successful claim | User logged in, redirected to app dashboard, no re-claim possible | [ ] |
| Mobile 320px | All states at 320px | No horizontal overflow, buttons clickable, OTP input sized correctly | [ ] |
| tsc clean | `tsc --noEmit` | No errors | [ ] |
| Console clean | DevTools on all invite pages | No errors, no unhandled promises | [ ] |

**Verifier:** Capture 4-state screenshots (loading, error, preview new-user, preview existing-user), OTP step screenshot, success screenshot, mobile 320px test, tsc + console.

---

### QA Validation (PR5)

| Acceptance criterion (from SCOPE §7) | Proof evidence | Status |
|---|---|---|
| Invite link issued with 7-day expiry (fixed, no picker) | Backend Proof Gate curl issue test | [ ] |
| Invite preview shows business name + masked party phone | Frontend Proof Gate preview screenshot | [ ] |
| Existing-user path requires OTP verification before claim | Backend + Frontend Proof Gate OTP step test | [ ] |
| New-user path requires standard signup OTP | Integration test signup-via-invite | [ ] |
| After successful claim, Party.userId set to new User id | Backend Proof Gate claimed state query | [ ] |
| Token reuse after claim → 410 LINK_CONSUMED | Backend Proof Gate second-claim curl test | [ ] |
| Concurrent claims: 50 parallel → 1 success + 49× 409 | Backend Proof Gate concurrency test output | [ ] |
| Party.userId @unique prevents hijack (2nd business's invite cannot re-bind same User) | Unit test `party-invite.claim.test.ts` + schema constraint | [ ] |
| tsc clean after PR5 | Proof Gate tsc output | [ ] |
| Mobile 320px all states | Frontend Proof Gate screenshots | [ ] |

---

## Summary: Gates & Evidence Tracking

| Gate | Triggered by | Proof required | Owner | Status |
|------|---|---|---|---|
| **Backend (each PR)** | Service + route code ready | tsc, migrations, curl 200/401/410/429, rate-limit, sanitization test, race test | Backend Engineer | [ ] |
| **Verifier (after Backend)** | Evidence rows filled | Curl output logged, migration output, test pass report | Verifier Agent | [ ] |
| **Frontend (each PR)** | Pages + components ready | 4-state screenshots, 320px, ?lang=hi, console clean | Frontend Engineer | [ ] |
| **Verifier (after Frontend)** | Evidence rows filled | Screenshots captured, tsc output, console report | Verifier Agent | [ ] |
| **QA (each PR)** | All Verifier gates passed | Proof evidence matches SCOPE acceptance criteria | QA Engineer | [ ] |
| **Redo (if QA fail)** | BLOCKERs found | Fix violations + re-run both Verifier gates | Redo Agent | [ ] |

**Red line:** No PR merges without all evidence. BLOCKED_NO_PROOF until proof gate filled. BLOCKED_PREREQ if earlier PR not green.

---

## Security Residual Checks (Post-Implementation, Before QA Sign-Off)

For each PR, before QA approves, the following must be verified by code review:

### PR3 Security Checks
1. Token entropy: `crypto.randomBytes(32)` confirmed in code, no `Math.random()`
2. `trust proxy: 1` set in Express `app.ts`, confirmed correct hop count
3. XSS escape: `partyName`, `businessName`, `lineItem.name` rendered without `dangerouslySetInnerHTML`, no string concat into `href`
4. OTP layer: confirm `/api/auth/otp/send` and `/api/auth/otp/verify` do not leak "phone already registered" vs "OTP failed" in responses
5. CSRF: `/api/p/*` mounted before `csrfProtection`, no cookies written on public routes except session

### PR4 Security Checks
1. Slug reserved list: fuzz all 30+ reserved words + mixed case, confirm all rejected with 400
2. Slug regex: unicode attempt (`админ`, `中国`) rejected, ASCII only accepted
3. Slug stored lowercase: verify `SELECT storefrontSlug FROM "Business"` returns all lowercase
4. No path traversal: slug value cannot escape path (regex enforces)

### PR5 Security Checks
1. Atomic claim: grep `claimInvite` implementation, confirm `updateMany` used, no read-then-write gap
2. `Party.userId @unique`: schema constraint exists, second bind attempt fails with DB error → 409
3. OTP mandatory: existing-user branch requires `otpSessionId` before claim runs, enforced in route handler
4. Rate limit on claim: 10/min per IP confirmed in middleware
5. Session issuance: after claim success, session cookies set and User logged in (verified in frontend test)

All 15 residual checks must pass before QA sign-off. If any fail, Redo Agent fixes + re-runs Verifier gates.

---

## Redo Protocol

If QA rejects a PR (finds BLOCKER):

1. **Redo Agent** reads the SCOPE acceptance criterion that failed + the proof evidence
2. Identifies root cause (e.g., "sanitizer includes Party.email" for PII leak)
3. Fixes code + re-runs both Verifier gates (Backend + Frontend)
4. Captures new evidence + updates task rows
5. **QA re-validates** with new evidence
6. If still failing → Postmortem Agent invoked (≥2 Redo runs or QA reject + Verifier fail >2× on same PR)

---

## File Status

`docs/TASKS_EPIC_C_customer_facing.md` seeded. Architecture + security + scope all approved. Ready for Backend intake.

