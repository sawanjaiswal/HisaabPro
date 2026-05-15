# Post-Feature Audit Sweep — 2026-05-15

Read-only OWASP-style sweep of HIGH-risk surfaces on branch `hisaabpro`
(master at 89610b0). All file paths absolute-from-repo-root.

## Summary

| Surface | P0 | P1 | P2 | P3 | Status |
|---------|----|----|----|----|--------|
| Auth & JWT (middleware/auth, jwt, refresh) | 0 | 1 | 1 | 1 | REVIEW |
| Admin perimeter (admin-auth, admin routes) | 0 | 0 | 2 | 1 | REVIEW |
| Subscription / Razorpay routes & webhook | 0 | 1 | 1 | 0 | REVIEW |
| Document (Epic B — lineage, custom-fields, price override) | 0 | 0 | 0 | 1 | SHIP |
| Marketing services + webhooks (aisensy / msg91) | 0 | 0 | 0 | 1 | SHIP |
| Payments + Collections (payment-link, PTP, aging) | 0 | 0 | 0 | 0 | SHIP |
| E-invoice / E-waybill / GST returns | 0 | 0 | 1 | 0 | SHIP |
| Public surface (`/api/p/*` invoice, store, invite) | 0 | 0 | 1 | 1 | SHIP |
| Business / impersonation / switch-business | 0 | 0 | 0 | 1 | SHIP |
| Schemas (Zod project-wide) | 0 | 1 | 0 | 0 | REVIEW |
| Logging / PII | 0 | 0 | 1 | 0 | REVIEW |
| **TOTAL** | **0** | **3** | **7** | **6** | **REVIEW** |

P0 = 0 → not BLOCKED. P1 = 3 → REVIEW (within "1-3 = REVIEW" band).

## Remediation Status — 2026-05-15

**Fixed in this sweep:**
- P1.1 Refresh CSRF → Origin allowlist guard at handler (`server/src/routes/auth/refresh.ts`).
- P1.2 Razorpay webhook fail-closed when secret missing → 503 (`server/src/routes/razorpay.ts`).
- P1.3 Zod `.strict()` mass-assignment defense → 24 schema files (~140 calls).
- P2.4 PII phone in logs → mask to last-4 (`notification.service.ts`, `register.ts`).
- P2.6 Admin role-mismatch → 401 ACCOUNT_REVERIFY_REQUIRED (`admin-auth.ts`).
- P2.7 Razorpay webhook IP rate limiter — 600/min/IP.
- P2.8 Business ID URL/JWT mismatch → 403 guard on settings routes (`lib/assert-business-match.ts`).
- P3.11 bcrypt rounds 10 → 12 on invite claim (OWASP 2026).
- P3.12 Defense-in-depth `findFirstOrThrow({ businessId })` on document re-fetch.
- P3.13 Explicit `businessId` scope on marketing party fanout.
- P3.15 Blacklist old refresh token on business switch.

**Deferred (rationale in `.claude/design-plan-active.md`):**
- P2.5 admin IP whitelist · P2.9 public invite Origin allowlist · P2.10 e-invoice Redis token cache · P3.14 audit-abort policy · P3.16 CORP header on storefront.

---

## Findings

### [P1] Auth — `/api/auth/refresh` exempt from CSRF + cookie SameSite=none in prod (`server/src/middleware/csrf.ts:31`, `server/src/services/auth/tokens.ts:27`)
**Risk:** Refresh endpoint is in `CSRF_EXEMPT_AUTH_PATHS`. In production, refresh cookie is set `sameSite: 'none'` (required for cross-site app subdomain). Combined with CSRF exemption, a malicious origin can trigger token rotation on a logged-in user (CSRF replay). Impact is limited (attacker doesn't see tokens, just rotates them — can cause forced logout if old token blacklisted before new one returns to legit client; also rotates new refresh into victim's cookie).
**Repro:** `<img src=x onerror="fetch('https://api.hisaabpro.in/api/auth/refresh',{method:'POST',credentials:'include'})">` from any origin in browser with valid session.
**Fix:** Require CSRF on `/api/auth/refresh` OR require Origin header match (the `CSRF_EXEMPT_AUTH_PATHS` set should be unauthenticated endpoints only — refresh IS implicitly authenticated via cookie).

### [P1] Subscription — Razorpay webhook fails OPEN when `RAZORPAY_WEBHOOK_SECRET` missing (`server/src/routes/razorpay.ts:67-72`)
**Risk:** When `getWebhookSecret()` returns falsy, the handler logs a warning and processes the unsigned payload as legitimate. A production deploy with a misconfigured env would accept any forged webhook (status changes, subscription cancellations, payment_link.paid fake-paid flows). Marketing webhooks (aisensy / msg91) correctly fail closed with 503 — Razorpay diverges.
**Repro:** Unset `RAZORPAY_WEBHOOK_SECRET`, `curl -X POST /api/razorpay/webhook -d '{"event":"payment_link.paid",...}'` — accepted, marks PaymentLink PAID.
**Fix:** Mirror aisensy pattern (`server/src/routes/webhooks/marketing-aisensy.routes.ts:55-58`):
```ts
if (!secret) { sendError(res, 'Webhook not configured', 'SERVICE_UNAVAILABLE', 503); return }
```
Drop the "dev/stub mode" branch — dev should set `RAZORPAY_WEBHOOK_SECRET=stub-secret-not-real`.

### [P1] Schemas — 24 schema files have ZERO `.strict()` calls (project-wide)
**Risk:** Zod default policy is "strip unknown" — extra fields silently dropped, never rejected. The DudhHisaab security_defaults.md rule mandates `.strict()` on every schema (caught by `no-zod-passthrough` ESLint rule on that project but **not enforced on HisaabPro**). Combined with NO `data: req.body` instances (good!) this is currently a defense-in-depth gap rather than active vuln, but the moment any service starts spreading inputs (`data: { ...input }`) it becomes mass-assignment.
**Files (count without `.strict()`):** `server/src/schemas/{accounting,admin,auth,bank,cheque,currency,custom-order,expense,financial-reports,godown,gst-backfill,job,loan,other-income,party,payment,product,reconciliation,recycle-bin,report,serial-number,settings,stock-verification,tax}.schemas.ts` — 24 files. Also `server/src/schemas/gst-backfill.schemas.ts:10` uses `.passthrough()` explicitly.
**Fix:** Add `.strict()` to top-level `z.object({...})` in all 24 files. Add `no-zod-passthrough` + `require-zod-strict` ESLint rules (port from DudhHisaab). Replace `gst-backfill.schemas.ts:10`'s `.passthrough()` with `.strict()`.

### [P2] Auth — full phone numbers in Winston logs (`server/src/services/notification.service.ts:151,156,160`, `server/src/routes/auth/register.ts:49`)
**Risk:** Phone numbers are PII under DPDP Act (India). They appear in 4+ Winston log statements unmasked. invite-otp.service.ts:129 already uses `phone.slice(-4)` — correct pattern.
**Fix:** Replace each `phone: opts.phone` with `phone: opts.phone.slice(-4)` (last-4-only logging convention).

### [P2] Admin — no IP whitelist on `/api/admin/*` perimeter
**Risk:** DudhHisaab security_defaults specifies `ipWhitelist` middleware at all `/api/admin/*` mounts with production fail-closed when `ADMIN_IP_WHITELIST` env unset. HisaabPro relies only on JWT (`requireAdmin`). If admin JWT secret leaks OR an admin's session is stolen, attacker can reach admin endpoints from anywhere.
**Files:** `server/src/routes/admin/index.ts:45-53`, `server/src/middleware/` (no `ipWhitelist` middleware exists).
**Fix:** Port `ipWhitelist` middleware from DudhHisaab, mount at `app.routes.ts` line 129 (`['/api/admin', adminRoutes]` → wrap with `[ipWhitelist, ...adminRoutes]`). Fail-closed in production if env unset.

### [P2] Admin — role mismatch between JWT and DB only logs, doesn't block (`server/src/middleware/admin-auth.ts:150-156`)
**Risk:** If an admin's role is downgraded (SUPER_ADMIN → ADMIN) while their JWT is still valid, `requireAdmin` proceeds using the DB role. Reasonable behaviour but mismatch should be an audit-worthy event AND should arguably 401 (forcing re-login) to prevent confused-deputy attacks where JWT claims SUPER_ADMIN but `req.admin.role` = ADMIN.
**Fix:** On mismatch, log AND respond `401 ACCOUNT_REVERIFY_REQUIRED`. Forces token rotation.

### [P2] Razorpay — no rate limiter on `/api/razorpay/webhook` (`server/src/routes/razorpay.ts:37`)
**Risk:** Marketing webhooks have 600/min/IP rate limit (good); Razorpay webhook has none. Public unsigned-reject path becomes a CPU-amplification surface (HMAC verification + DB raw insert per request) if attacker floods.
**Fix:** Add `createRateLimiter({ windowMs: 60_000, max: 600, keyFn: req => `rl:rzp:wh:${req.ip}` })` before the handler.

### [P2] Subscription routes — `GET /:businessId` ignores URL param, uses JWT businessId (`server/src/routes/settings.ts:53-63`)
**Risk:** No cross-tenant leak (uses JWT businessId, which IS safe), but a user with access to business A who hits `GET /api/businesses/<businessB-id>` gets business A's data with 200 status — silent path-mismatch. Confusing for audit logs and downstream consumers.
**Fix:** Either (a) ignore URL param officially: rename to `GET /current`, OR (b) assert `req.params.businessId === req.user.businessId` and 403 otherwise.

### [P2] Public router — invite/claim has no CSRF (by design); rate-limited at 10/min/IP (`server/src/routes/public.routes.ts`, `server/src/middleware/public/rate-limit.ts:63`)
**Risk:** Public surface uses "token IS the credential" — acceptable. Claim is rate-limited 10/min/IP. However an attacker who has the token (e.g. leaked share-link logged by a chat platform / browser history of shared device) can claim with no Origin/Referer check. The atomic `updateMany` in `claimInvite` prevents double-claim — single-claim by attacker is the realistic risk.
**Mitigation:** Existing — token entropy + single-use + OTP-verified for existing users. Acceptable for invite UX. Document as accepted risk; consider adding Origin allowlist (hisaabpro.in + capacitor://localhost) on `/api/p/invite/*/claim`.

### [P2] E-invoice — NIC IRP token cache is in-memory only (`server/src/services/einvoice/einvoice.token-store.ts:18`)
**Risk:** `const store = new Map<string, TokenEntry>()` — not multi-instance safe. Two server processes will each maintain separate tokens; 401 invalidation on one doesn't propagate. NIC may rate-limit auth calls. Not a vuln per se but operational fragility.
**Fix:** Move to Redis-backed cache when REDIS_URL is present (lib has a RateLimitStore abstraction — same pattern).

### [P3] Auth — bcrypt rounds=10 on invite-claim signup (`server/src/routes/public/invite/claim.handler.ts:14`)
**Risk:** Current OWASP recommendation is rounds ≥ 12 for bcrypt (target ≥ 250ms per hash on commodity hardware in 2026). 10 is acceptable but trailing best-practice.
**Fix:** `const PASSWORD_BCRYPT_ROUNDS = 12`.

### [P3] Document — `findUniqueOrThrow({ where: { id } })` inside tx after pre-check (`server/src/services/document/update.ts:237`, `server/src/services/document/create.ts:230`)
**Risk:** Pre-check (line 25) is `findFirst({ where: { id, businessId } })` — correct. Re-fetch at line 237 uses bare `id`. Within same tx so no realistic IDOR window, but defense-in-depth pattern violation.
**Fix:** Change to `findFirstOrThrow({ where: { id, businessId }, ... })` for clarity.

### [P3] Marketing — `prisma.party.findMany({ where: { id: { in: partyIds } } })` lacks businessId filter (`server/src/services/marketing/campaign-dispatch.service.ts:78-81`)
**Risk:** `partyIds` come from upstream `resolvePartyIds(businessId, ...)` so already tenant-scoped. No realistic IDOR. Defense-in-depth would add `businessId` to the where clause.
**Fix:** `where: { id: { in: partyIds }, businessId }`.

### [P3] Admin — `auditAdminAction` is non-blocking; failures only logged (`server/src/middleware/admin-auth.ts:201-225`)
**Risk:** If DB write fails, the admin action still proceeds without an audit record. For impersonation / coupon mutation this is a forensic gap.
**Fix:** On audit-write failure for HIGH-sensitivity actions (impersonate, mass-broadcast, super-admin mutations), abort the request rather than proceed un-audited.

### [P3] Business switch — old refresh token not blacklisted (`server/src/routes/auth/switch-business.ts:34-41`)
**Risk:** Old access token is blacklisted; old refresh token from previous business is NOT. Holder of old refresh can still rotate back to the old business by calling `/api/auth/refresh` with the old refresh cookie. Mitigated by cookie rotation (line 45 overwrites both cookies), but if attacker captured the old refresh during the switch window, they retain access to the prior business.
**Fix:** Blacklist old refresh token alongside old access (mirror lines 36-41 for `REFRESH_TOKEN_COOKIE`).

### [P3] Public storefront / invoice — no Origin allowlist on public endpoints (`server/src/routes/public.routes.ts`)
**Risk:** Public router is intentionally permissive (no CORS / no CSRF — public consumption). Acceptable. Optional hardening: emit `Cross-Origin-Resource-Policy: cross-origin` only for storefront, not for invite-claim (which has authentication side-effects).

---

## Surfaces with NO findings (confirmed clean)

- **Document lineage service** (`server/src/services/document/lineage.service.ts`): textbook tenant-scoped walk with hop cap, visited-set cycle defense, no `include:true`, `select` allowlist. Reference quality.
- **Storefront sanitizer** (`server/src/services/sanitize-storefront-public.ts`): hand-written field-by-field DTO, no Prisma spread, has fuzz test. Reference quality.
- **Marketing aisensy webhook** (`server/src/routes/webhooks/marketing-aisensy.routes.ts`): rate-limited, fails closed on missing secret, HMAC on raw Buffer, 5-min replay window, dedupe by externalId, JSON.parse AFTER verification. Reference quality.
- **Payment-link webhook handler** (`server/src/services/collections/payment-link-webhook.ts`): MB-1 dedupe, MB-2 tenant-from-DB (never payload notes), MB-5 amount gate.
- **switchBusiness service** (`server/src/services/auth/me.ts:62`): validates BusinessUser membership before token mint.
- **Storefront public service** (`server/src/services/storefront.service.ts`): every query scoped by businessId, slug uniqueness check, public route returns identical 404 for "not found" vs "not public" (no oracle).
- **Recycle-bin permanent delete** (`server/src/services/recycle-bin.service.ts:115`): `$executeRawUnsafe` with table-name interpolation IS guarded by Zod enum allowlist sourced from `SOFT_DELETE_MODELS`.
- **Helmet config** (`server/src/app.ts:35-56`): CSP defaultSrc 'self', frameAncestors 'none', HSTS preload in prod, CORS explicit allowlist (not `*`).
- **Error handler** (`server/src/middleware/errorHandler.ts`): redacts token/password/secret/otp in logged details; never sends stack trace to client.
- **CSP**: no `unsafe-eval`; `unsafe-inline` only on `style-src` (acceptable for Tailwind).

---

## Acceptance against ship-gate rubric

- P0 count: **0**       → not blocked
- P1 count: **3**       → REVIEW band (1-3)
- P2 + P3 only: not applicable (P1 present)

**Verdict: REVIEW**

Recommended pre-ship: fix the 3 P1 items (refresh CSRF, razorpay fail-closed, schema `.strict()` rollout). P2/P3 items can ship to a follow-up hardening sprint.
