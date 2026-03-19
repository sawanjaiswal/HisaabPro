# SECURITY AUDIT — HisaabPro Backend
**Scope:** `server/src/` — all routes, services, middleware, schemas, lib, config
**Date:** 2026-03-20
**Verdict:** REJECTED — 3 BLOCKERs, 7 CRITICALs, 5 HIGH, 4 MEDIUM

---

## Summary

The overall architecture is well-designed: JWT with audience separation, httpOnly cookies,
CSRF double-submit, parameterised SQL, Zod on all bodies, structured logging, token blacklist,
account lockout, and `isSuspended` propagation. No hardcoded production secrets. npm audit
reports zero known CVEs.

Three issues require immediate remediation before the app can ship.

---

## BLOCKER (Ship-stopper)

### B1 — Dev login endpoint accessible in production
**File:** `server/src/services/auth.service.ts:154-220` / `server/src/routes/auth.ts:62-94`
**OWASP:** A07 — Identification and Authentication Failures

`POST /api/auth/dev-login` with hardcoded credentials `admin/admin123` and `demo/demo123`
is a live route with **zero NODE_ENV guard**. The function `devLogin()` checks credentials
from the in-code `DEV_CREDENTIALS` map but never checks `process.env.NODE_ENV`. The route
is CSRF-exempt (listed in `CSRF_EXEMPT_AUTH_PATHS`). A GET on the health check endpoint
reveals the server is running; any attacker can then POST to `/api/auth/dev-login` with the
hardcoded credentials and obtain a valid JWT.

```ts
// auth.service.ts:19-22 — visible to anyone who reads the source or decompiles the build
const DEV_CREDENTIALS: Record<string, { password: string; phone: string; name: string }> = {
  admin: { password: 'admin123', phone: '9999999999', name: 'Dev Admin' },
  demo:  { password: 'demo123',  phone: '9888888888', name: 'Demo User' },
}
```

**Fix — two required steps:**
1. Add a production guard at the top of `devLogin()`:
   ```ts
   if (process.env.NODE_ENV === 'production') {
     throw new Error('Dev login is not available in production')
   }
   ```
2. Add the same guard in the route handler before calling `devLogin`. Or remove the entire
   route + service function in the production build using tree-shaking / compile-time flag.

---

### B2 — OTP stored in plaintext in database
**File:** `server/prisma/schema.prisma:192` (`OtpCode.code String`) / `server/src/services/auth.service.ts:247`
**OWASP:** A02 — Cryptographic Failures

The raw 6-digit OTP is written to the `OtpCode` table as plaintext. A database breach,
SQL injection on a different table, or a Prisma log leakage exposes every pending OTP.
An attacker with read access to the DB can log in as any user who has a pending OTP.

The fix is to store a bcrypt hash of the OTP (same pattern as `pinHash`). Because OTPs are
short-lived (5 min) and the search must be by phone+verified rather than by value, the
comparison must happen in application code rather than a DB query.

**Fix:**
```ts
// sendOtp — hash before storing
const otp = generateOTP()
const otpHash = await hashPassword(otp) // bcrypt, same as PIN
await prisma.otpCode.create({ data: { phone, code: otpHash, expiresAt: ... } })

// verifyOtp — compare against hash, not equality
if (!await verifyPassword(otp, otpRecord.code)) { ... }
```

---

### B3 — Admin refresh token not blacklisted on use (token replay enabled)
**File:** `server/src/routes/admin/admin-auth.ts:46-54` / `server/src/services/admin/admin-auth.service.ts:124-149`
**OWASP:** A07 — Identification and Authentication Failures

The regular user `POST /api/auth/refresh` (line 191-192 of `auth.ts`) blacklists the old
refresh token immediately after rotation. The admin `POST /api/admin/auth/refresh` does
**neither** blacklist the old token nor check if it is already blacklisted. A stolen admin
refresh token can be replayed indefinitely until its 7-day expiry.

Similarly, `POST /api/admin/auth/logout` (lines 60-66 of `admin-auth.ts`) calls
`auditAdminAction` and returns 200 but never blacklists the access or refresh token.

**Fix:**
```ts
// admin-auth.ts — /refresh
const decoded = jwt.verify(refreshToken, JWT_SECRET, { algorithms: ['HS256'], audience: 'admin' })
if (isBlacklisted(refreshToken)) {
  throw unauthorizedError('Token has been revoked')
}
const tokens = await refreshAdminToken(refreshToken)
const ttl = decoded.exp ? decoded.exp * 1000 - Date.now() : 7 * 24 * 60 * 60 * 1000
blacklistToken(refreshToken, ttl)
sendSuccess(res, tokens)

// admin-auth.ts — /logout
const token = req.headers.authorization?.slice(7)
if (token) { blacklistToken(token, 15 * 60 * 1000) }
// also blacklist refresh from body if provided
```

---

## CRITICAL

### C1 — captchaGuard is fail-open on network error
**File:** `server/src/middleware/captcha.ts:119-124`
**OWASP:** A07 — Identification and Authentication Failures

When the Cloudflare Turnstile verification request throws a network exception, the middleware
calls `next()` (fail-open) rather than blocking the request. An attacker on the same
datacenter who can interfere with outbound traffic to `challenges.cloudflare.com` can bypass
CAPTCHA entirely after 3 failed attempts.

```ts
// captcha.ts:119-124
} catch (err) {
  logger.error('captcha.verify_error', { ip, err })
  // On network error, fail open — don't block legitimate users
  next()  // ← CRITICAL: fail-open
  return
}
```

**Fix:** Fail closed. Respond 503 with a `Retry-After` header so legitimate clients retry.

---

### C2 — Admin login has no CAPTCHA protection
**File:** `server/src/routes/admin/admin-auth.ts:31-39`
**OWASP:** A07 — Identification and Authentication Failures

`POST /api/admin/auth/login` has `authRateLimiter` (5 req/min per IP) and progressive delay
from `adminLogin()`, but no CAPTCHA after repeated failures. The regular user login gains
CAPTCHA after 3 failures via `captchaGuard`. The admin panel — a far higher-value target —
has no equivalent. An attacker can rotate IPs and brute-force admin passwords within the
lockout window.

**Fix:** Apply `captchaGuard` to admin login and call `recordFailedAttempt` on failure.

---

### C3 — `isSuspended` not checked in auth middleware (DB-level bypass)
**File:** `server/src/middleware/auth.ts:46-55`
**OWASP:** A01 — Broken Access Control

The auth middleware checks `isUserBlacklisted(payload.userId)` (in-memory set) but never
queries the DB for `isSuspended`. The in-memory blacklist is populated by
`blacklistUser(userId)` in `admin-users.service.ts:197`, which is called on suspend. This
is correct at runtime, but the blacklist is lost on server restart. After a restart, a
suspended user with a live JWT will pass auth — `isSuspended` is only in the DB, not
re-loaded on startup. The suspended user will have full access until their token expires
(up to 15 min) or until the admin re-triggers suspension. In a multi-instance deployment
this window is unlimited (each instance has its own in-memory blacklist).

**Fix — two required steps:**
1. On server startup, load suspended user IDs from DB into the in-memory blacklist.
2. In the auth middleware, check `isSuspended` from DB on a short cache (e.g. 60s TTL per
   userId) for suspended accounts, rather than relying solely on the in-memory set.

---

### C4 — Public referral validate endpoint leaks phone numbers
**File:** `server/src/routes/referral.ts:43-63` / `server/src/services/referral.service.ts:104-111`
**OWASP:** A01 — Broken Access Control / A02 — Sensitive Data Exposure

`GET /api/referral/validate?code=RAJU9K3M` is a **public unauthenticated endpoint** covered
only by the global 100 req/min IP rate limiter. The `resolveCode()` service returns
`user: { id, name, phone }` and the route exposes `referrerName` to the caller.

The `phone` field is fetched in the include but not returned in the response (only `name`).
However, `resolveCode` returns the full object including `phone` to any caller. A bug in the
route handler or a future refactor could inadvertently expose it. More critically, the
endpoint enables username enumeration of referral codes, which can be brute-forced (short
alphanumeric codes). The global 100 req/min limiter is too permissive.

**Fix:**
1. Add a stricter rate limiter (e.g. 30 req/min per IP) on this endpoint.
2. Change `resolveCode` to **not** select `phone` — return only `id` and `name`.
3. The route should not receive the phone field at all.

---

### C5 — `$queryRawUnsafe` with dynamic ORDER BY and WHERE (SQL injection surface)
**File:** `server/src/services/product.service.ts:305-319`, `server/src/services/product.service.ts:267-268`
**OWASP:** A03 — Injection

`listLowStockProducts()` builds a raw SQL query with dynamic ORDER BY and WHERE clauses
using template string interpolation. ORDER BY is protected by an allowlist
(`allowedSortColumns`), and WHERE uses parameterised `$N` placeholders — this is correctly
done. However, the use of `$queryRawUnsafe` means the string is passed directly to Postgres.
The current code is safe, but `$queryRawUnsafe` is extremely footgun-prone. One future
developer adding a new filter without following the parameter pattern will introduce SQL
injection.

The same pattern appears in `stock.service.ts:39`, `document-number.service.ts:49`, and
multiple places in `product.service.ts`.

**Fix:** Replace `$queryRawUnsafe` with Prisma's tagged-template `$queryRaw` wherever
possible. For the dynamic ORDER BY / WHERE case, continue using the allowlist, but add a
code comment block with an explicit warning about injection risk and a required code-review
rule.

---

### C6 — `10mb` JSON body limit allows amplified DB writes
**File:** `server/src/index.ts:102`
**OWASP:** A05 — Security Misconfiguration

```ts
app.use(express.json({ limit: '10mb' }))
```

A 10MB JSON body on a document create endpoint could contain thousands of line items in a
single request, causing a single API call to trigger hundreds of DB writes and stock
adjustments inside a transaction. There is no per-field or per-array length limit at the
Zod schema level for document line items.

**Fix:**
1. Reduce global JSON limit to `1mb`.
2. Add `.max(200)` on line item arrays in `createDocumentSchema`.

---

### C7 — UPI IDs stored plaintext (PII at rest)
**File:** `server/src/services/referral.service.ts:463` / `server/prisma/schema.prisma` (`ReferralWithdrawal.upiId`)
**OWASP:** A02 — Cryptographic Failures

UPI IDs are financial identifiers linked to real bank accounts. They are stored as plaintext
in `ReferralWithdrawal.upiId` and returned plaintext in `listWithdrawals` responses (line
524 of `referral.service.ts`). The encryption library (`server/src/lib/encryption.ts`) is
implemented and available but **never imported anywhere**.

**Fix:**
```ts
// store:
data: { ..., upiId: encrypt(upiId), ... }

// retrieve:
upiId: decrypt(w.upiId),
```

---

## HIGH

### H1 — console.log/console.error in `lib/otp.ts` (not Winston)
**File:** `server/src/lib/otp.ts:32,35,56`
**OWASP:** A09 — Security Logging and Monitoring Failures

Three `console.log` / `console.error` calls bypass the structured Winston logger. The DEV
log prints the raw OTP: `[DEV] OTP for ${phone}: ${otp}`. If a logging aggregator is
configured to capture stdout (common in containerised deployments), this can expose plaintext
OTPs in production logs if `NODE_ENV` is not correctly set (which is a deployment risk).
Also, MSG91 errors go to console rather than the audit trail.

**Fix:** Replace all three with `logger.info` / `logger.error`. Guard the OTP log with
`if (process.env.NODE_ENV !== 'production')`.

---

### H2 — `DATABASE_URL` fallback is an empty string (silent startup failure)
**File:** `server/src/lib/prisma.ts:12`
**OWASP:** A05 — Security Misconfiguration

```ts
const baseUrl = process.env.DATABASE_URL || ''
```

If `DATABASE_URL` is missing, `getUrl()` returns an empty string with connection params
appended. Prisma will throw at connection time with a confusing error rather than a clear
startup failure. The production env-var check in `index.ts:57` only validates `DATABASE_URL`
when `NODE_ENV === 'production'`, so a misconfigured staging deployment will silently
connect to nothing.

**Fix:**
```ts
const baseUrl = process.env.DATABASE_URL
if (!baseUrl) throw new Error('FATAL: DATABASE_URL is required')
```

---

### H3 — `MemoryStore` rate limiter bypassed in multi-instance deployments
**File:** `server/src/middleware/rate-limit.ts:43-73`
**OWASP:** A05 — Security Misconfiguration

The in-memory rate limiter (used when `REDIS_URL` is not set) is per-process. In a
multi-instance deployment on Render (as documented in `CLAUDE.md`), each instance has its
own counter — an attacker gets 5×N requests per window (where N = instance count) before
hitting the auth rate limit. Same issue affects the token blacklist, CAPTCHA fail-store,
idempotency log, and backup store.

This is acceptable in development but must be resolved before production horizontal scaling.

**Fix:** Require `REDIS_URL` in production (`required` array in `index.ts:57`) OR document
the single-instance constraint explicitly in deployment docs.

---

### H4 — Referral withdrawal race condition (double-spend)
**File:** `server/src/services/referral.service.ts:421-471`
**OWASP:** A04 — Insecure Design

`requestWithdrawal()` checks for a pending withdrawal and then creates one in two separate
queries (lines 442-462). There is a TOCTOU window between the `findFirst` check and the
`create`. Two concurrent requests from the same user can both pass the check and both create
withdrawal records, doubling the withdrawal amount.

**Fix:** Use a DB-level unique constraint on `(userId, status='pending')` or wrap the check
and create in a `prisma.$transaction` with `isolationLevel: Serializable`.

---

### H5 — CSRF cookie uses `httpOnly: true` (CSRF token must be readable by JS)
**File:** `server/src/middleware/csrf.ts:52-58`
**OWASP:** A01 — Broken Access Control

The CSRF cookie is set with `httpOnly: true`. This means JavaScript **cannot read it**,
which breaks the double-submit cookie pattern. The frontend is expected to read the cookie
value and send it as the `X-CSRF-Token` header, but `httpOnly` prevents `document.cookie`
from accessing it. The `GET /api/auth/csrf-token` endpoint is a workaround (it returns the
token in the response body), but any component that does not call that endpoint first will
fail CSRF checks on mutations.

```ts
// csrf.ts:52-57 — httpOnly prevents JS from reading the cookie
res.cookie(CSRF_COOKIE_NAME, token, {
  httpOnly: true,   // ← This breaks the double-submit pattern
  ...
})
```

**Fix:** Remove `httpOnly: true` from the CSRF cookie. CSRF tokens are **not** secret —
they need to be readable by the same-origin JavaScript. The value is worthless to a CSRF
attacker who cannot read same-origin cookies.

---

## MEDIUM

### M1 — Admin token not checked against blacklist on every request
**File:** `server/src/middleware/admin-auth.ts:103-158`
**OWASP:** A07 — Identification and Authentication Failures

The `requireAdmin` middleware verifies the JWT signature and checks DB role/active status,
but never calls `isBlacklisted(token)`. When an admin logs out, the token is not blacklisted
(B3 above). Even after B3 is fixed, the blacklist check must be added to `requireAdmin` for
defence in depth.

**Fix:** Add `if (isBlacklisted(token)) { sendError(res, 'Token revoked', ...) }` after JWT
verification in `requireAdmin`.

---

### M2 — Encryption module is implemented but never used
**File:** `server/src/lib/encryption.ts` — zero imports
**OWASP:** A02 — Cryptographic Failures

`lib/encryption.ts` provides AES-256-GCM encryption and is never imported. This creates a
false sense of security (the module exists but is not applied). Sensitive fields — OTP codes
(B2), UPI IDs (C7), phone numbers in `OtpCode`, GSTIN numbers — are all stored plaintext.

---

### M3 — `validate-stock` endpoint has no input validation schema
**File:** `server/src/routes/documents.ts:66-74`
**OWASP:** A03 — Injection / A04 — Insecure Design

`POST /api/documents/validate-stock` reads `req.body.items` without a Zod schema:
```ts
const items = (req.body.items ?? []) as Array<{ productId: string; quantity: number; unitId: string }>
```
A caller can submit non-string `productId` values, negative `quantity` without limit, or
arrays of arbitrary length, triggering unvalidated DB queries in `validateStockForInvoice`.

**Fix:** Add a Zod schema for this endpoint identical to the items array in
`createDocumentSchema`.

---

### M4 — `resolveCode` in referral service exposes phone in return type
**File:** `server/src/services/referral.service.ts:104-111`
**OWASP:** A01 — Broken Access Control

Documented under C4. Tracked separately as a data-minimisation finding. The TypeScript
return type of `resolveCode` includes `phone: string`. Any future caller that passes the
full return value to a response will leak phone numbers. Remove `phone` from the `select`.

---

## Trail of Bits Scan Results

### insecure-defaults scan
- **FINDING 1 (BLOCKER):** `DEV_CREDENTIALS` with `admin123` / `demo123` — no production guard
  in `devLogin()`. App can be accessed with hardcoded creds in production.
- **FINDING 2 (SAFE):** `JWT_SECRET` — throws `FATAL` if missing. Fail-secure.
- **FINDING 3 (SAFE):** `ENCRYPTION_KEY` — throws if missing or wrong length. Fail-secure.
- **FINDING 4 (MEDIUM):** `DATABASE_URL || ''` — fail-open in non-production environments.
- **FINDING 5 (LOW):** `REFERRAL_REWARD_AMOUNT ?? '100'` — acceptable business config default,
  not a security primitive.

### $queryRawUnsafe audit
- `stock.service.ts:39` — parameterised, SAFE
- `document-number.service.ts:49` — parameterised, SAFE
- `product.service.ts:38` — parameterised, SAFE
- `product.service.ts:179,187,267,271,278` — parameterised, SAFE
- `product.service.ts:305-319` — allowlisted ORDER BY + parameterised WHERE, SAFE but HIGH-RISK pattern

### npm audit
- 0 known CVEs in any dependency.

---

## OWASP Top 10 Checklist

| # | Category | Status | Notes |
|---|----------|--------|-------|
| A01 | Broken Access Control | FAIL | C3 (isSuspended bypass), C4 (phone leak), H5 (CSRF cookie) |
| A02 | Cryptographic Failures | FAIL | B2 (OTP plaintext), C7 (UPI plaintext), M2 (encryption unused) |
| A03 | Injection | PASS | Prisma parameterised; $queryRawUnsafe allowlisted; M3 noted |
| A04 | Insecure Design | WARN | H4 (withdrawal race), C6 (10mb body) |
| A05 | Security Misconfiguration | FAIL | C6 (10mb body), H2 (DATABASE_URL), H3 (memory rate limiter) |
| A06 | Vulnerable Components | PASS | 0 CVEs in npm audit |
| A07 | Auth Failures | FAIL | B1 (dev login), B3 (admin token replay), C1 (captcha fail-open), C2 (admin no captcha) |
| A08 | Software/Data Integrity | PASS | Replay protection + idempotency keys on mutations |
| A09 | Logging Failures | WARN | H1 (console.log with OTP in dev, bypasses Winston) |
| A10 | SSRF | PASS | No external URL construction from user input |

---

## Fix Priority Order

1. **B1** — Block dev login in production. 30-minute fix. Ship-critical.
2. **B3** — Blacklist admin tokens on logout and refresh rotation.
3. **H5** — Remove `httpOnly` from CSRF cookie (it breaks the double-submit pattern).
4. **C3** — Reload suspended users from DB on startup + periodic recheck.
5. **C1** — Captcha fail-closed.
6. **C2** — Add captcha to admin login.
7. **B2** — Hash OTPs before storage.
8. **C7** — Encrypt UPI IDs using existing `lib/encryption.ts`.
9. **C4** — Rate-limit and remove phone from `resolveCode`.
10. **M3** — Add Zod schema to `/validate-stock`.
11. **C6** — Reduce body limit; add array max on line items.
12. **H4** — Serializable transaction on withdrawal.
13. **M1** — Blacklist check in `requireAdmin`.
14. **H2** — Throw on missing `DATABASE_URL`.
15. **H1** — Replace `console.log` with logger in `otp.ts`.
16. **H3** — Require Redis URL in production or document single-instance constraint.
