---
audit_of: ARCHITECTURE_PHASE6_STAFF_HR.md
audit_of_version: v2.2
scope_ref: SCOPE_PHASE6_STAFF_HR.md
architecture_audit_ref: ARCHITECTURE_AUDIT_PHASE6_STAFF_HR.md
auditor: security agent
audited_at: 2026-05-17T23:43:00+05:30
verdict: PASS_WITH_GAPS
must_fix: 4
should_fix: 11
acceptable_as_designed: 9
---

# Security Audit — Phase 6 Staff & HR

**Date:** 2026-05-17  ·  **Auditor:** security agent  ·  **Architecture version:** v2.2

## Verdict

**PASS_WITH_GAPS** — architect did real, adversarial security work (cookie design,
HMAC verification matrix, DH PIN verbatim port, single rejection path, 22-service
audit SSOT, defense-in-depth helpers). However four gaps will land code-fail or
silent-fail in production and must close before build:

1. `Payment.reversesPaymentId` column referenced by §8.3 reversal code and §17.2
   acceptance gates does NOT exist in the schema and is not in the §2.2 new-columns
   table — reversal cannot compile.
2. `req.user.id` used in 3 places (§3.6 middleware code, §5.3 cookie verifier
   payload check, §5.3 invalidation matrix). HP's actual shape is
   `req.user.userId` (server/src/middleware/auth.ts:75). Silent UNAUTHORIZED on
   every cookie verify and every suspended-firm check — exactly the regression
   `auth_req_user_shape.md` exists to prevent.
3. Audit-log search uses `to_tsquery` (§7.5 line 756) which parses arbitrary FTS
   syntax — a user query of `'foo & bar | !baz'` errors or, worse, is exploitable
   against pg internals. Must be `plainto_tsquery` or `websearch_to_tsquery`.
4. Cookie tamper signal is observed (M2 in arch metrics) but the `pin_grace_cookie`
   does not include the `pinHash` fingerprint, so a stolen valid cookie continues
   to verify after the user changes their PIN. Invalidation matrix relies on the
   `clearCookie` happening on the change-PIN path only — a stale cookie on a
   different device keeps working until natural expiry.

The remaining 11 SHOULD_FIX items improve depth-of-defense (Turnstile gate, lockout
event audit-trail, rate-limit on PIN reset request, AppError details PII scrub,
phone normalization SSOT, etc.). The 9 ACCEPTABLE items are correctly designed.

## Counts

- MUST_FIX: **4**
- SHOULD_FIX: **11**
- ACCEPTABLE_AS_DESIGNED: **9**

---

## OWASP Top 10 findings

### A01 — Broken Access Control

**A01.1 [MUST_FIX] `req.user.id` is the wrong property name everywhere it appears.**
- Evidence: arch v2.2 line 538 `userId: req.user.id` inside `requireActiveBusiness`;
  line 627 `uid !== req.user.id` inside `verifyPinGraceCookie`; line 646
  invalidation matrix `req.user.id === affected user`. Real shape:
  `server/src/middleware/auth.ts:75` writes
  `req.user = { userId: payload.userId, phone, businessId }`. There is NO `id` field.
  `req.user.id` evaluates to `undefined` at runtime.
- Failure mode: every PIN-gated request fails the `uid !== req.user.id` check
  (`undefined !== <userId>` is always true) → 403 PIN_REQUIRED loop. Every
  call to `requireActiveBusiness` does a `findFirst({ where: { userId: undefined, ... }})`
  which Prisma silently treats as "no filter on userId" — returning the FIRST
  matching `BusinessUser` row in the DB. That is a CROSS-TENANT IDOR: any
  authenticated user can be treated as a member of any business that happens to
  have a matching `businessId`.
- DudhHisaab memory: `~/.claude/projects/-Users-sawanjaiswal-DudhHisaab/memory/auth_req_user_shape.md`
  exists precisely to prevent this regression. The lesson was paid for.
- Recommendation: global find-replace `req.user.id` → `req.user.userId` in the
  arch document (3 sites), update the `verifyPinGraceCookie` helper signature
  example, and add an explicit acceptance gate "no production code references
  `req.user.id`" enforced at PR1 by a grep check in `scripts/enforce.js`.

**A01.2 [SHOULD_FIX] `requireActiveBusiness` middleware queries `BusinessUser` on
EVERY gated request — correct freshness, but with no cache the membership lookup
becomes a per-request DB read. Worse, the architecture's example code does NOT
use Prisma's `userId_businessId` compound unique key — it uses `findFirst` over
two indexed columns, costing a full BusinessUser scan on busy tenants.**
- Evidence: arch line 537-540 uses `findFirst({ where: { userId, businessId }})`.
  The schema (server/prisma/schema.prisma:297) has `@@unique([userId, businessId])`
  so the correct call is
  `findUnique({ where: { userId_businessId: { userId, businessId }}})`.
- Recommendation: switch to `findUnique` on the compound key. S9 (caching deferred)
  remains accepted — the 1 unique-index read per request is fine even at 10k qps.

**A01.3 [SHOULD_FIX] STAFF Party leaks via the search query parameter.**
- Evidence: `server/src/services/party/list-get.ts:52-60` ORs on
  `name/phone/email/companyName/gstin` for `?search=` queries BEFORE the planned
  PR1 `where.type = { not: 'STAFF' }` default filter is applied. A caller hitting
  `GET /api/parties?search=<staff name>` would still match the STAFF party row
  because the `OR` clause is appended to the `where` object — the default filter
  is added BEFORE the search and Prisma ANDs them, so this is OK. However, the
  v2.2 §8.5 filter policy table says "FE party-list fetch never sends
  `includeStaff`" — but the FE could be made to via a tampered request. A user
  who hits `GET /api/parties?includeStaff=true&search=Anil` learns the names AND
  phones of every staff member of the firm. That is a *deliberate* HR-permission
  feature, but the architecture does NOT gate `?includeStaff=true` on
  `hr.read` permission — any user with `parties.read` can enumerate staff.
- Recommendation: in `server/src/schemas/party.schemas.ts`'s
  `partyListQuerySchema`, when `includeStaff=true` is requested the route must
  additionally `requirePermission('hr.read')` OR the service layer must check
  `req.user` has `hr.read` and 403 if not. Add to §6.1 routes summary
  + §17.2 acceptance gate.

**A01.4 [SHOULD_FIX] Suspended-firm sessions keep their warm PIN grace cookie.**
- Evidence: §5.3 invalidation matrix lists `POST /api/businesses/:id/suspend`
  (own) clears the cookie. But when an admin suspends ANOTHER user's membership
  (`POST /api/businesses/:id/members/:userId/suspend`), that user's `pin_gate_grace`
  cookie keeps verifying until natural expiry (12h). They still get
  `requireActiveBusiness` to 403 with `MEMBER_SUSPENDED` so DB access is denied,
  but the cookie remains semantically valid — meaning if the admin later
  reactivates the user, they regain PIN grace WITHOUT re-PIN. Not a leak; a UX
  oddity that could be confused as a vulnerability.
- Recommendation: §5.3 invalidation matrix should explicitly say "third-party
  suspension does NOT clear the suspended user's cookie; reactivation requires
  re-PIN as a side-effect of the natural expiry". Document, don't fix.

**A01.5 [SHOULD_FIX] Audit log export route (`POST /api/audit/export`) ships
behind `requireRecentPin('mutating')` + `audit.export` permission. CSV streams
can be very large — confirm the FE streams via fetch (not stored in localStorage
for download) and confirm the server bounds the row count to e.g. 100k per
export to prevent a single export DoS-ing the response stream.**
- Evidence: arch §6.1 lists the route but no max-rows / streaming guidance.
- Recommendation: add `MAX_EXPORT_ROWS=100_000` constant and document streaming
  with `res.write()` in §6.1.

---

### A02 — Cryptographic Failures

**A02.1 [SHOULD_FIX] HMAC secret choice — JWT_SECRET reuse is OK BUT must be
documented as a known-risk acceptable trade-off, not the silent default it
currently is.**
- Evidence: arch §5.3 chose option (a) — reuse `JWT_SECRET`. The boot-time
  check `JWT_SECRET.length < 32` is present in `server/src/lib/jwt.ts:7`.
- Analysis: option (a) reduces ops surface (one secret to rotate, JWT rotation
  natively invalidates cookies — good fail-mode per the invalidation matrix).
  Option (b) — sibling `PIN_GRACE_COOKIE_SECRET` — narrows blast radius if a
  log file inadvertently captures the cookie HMAC, but adds rotation burden.
  Both options are defensible. The DEFAULT (a) is acceptable PROVIDED there is
  domain separation in the HMAC input.
- BLOCKER absent of domain separation: HMAC-SHA256 over `JSON.stringify(payload)`
  with the same key as JWT-HS256 signing means an attacker who can convince the
  server to MINT a JWT with attacker-chosen content could also produce a valid
  PIN grace cookie. JWT signing uses jsonwebtoken which prepends a header — they
  don't collide today — but future code that calls `crypto.createHmac('sha256',
  JWT_SECRET).update(<arbitrary user-influenced bytes>)` (e.g. webhook signing,
  download-token signing) WILL collide.
- Recommendation: prepend a fixed domain tag inside the HMAC input — e.g.
  `crypto.createHmac('sha256', JWT_SECRET).update('pin-grace-cookie-v1:' + payloadJson)`.
  This is the standard pattern (RFC 6979 §3.2). Document in §5.3 signing step.

**A02.2 [MUST_FIX] PIN grace cookie does not bind to `pinHash` — stolen cookie
survives a PIN change/reset on a different device.**
- Evidence: §5.3 payload is `{uid, bid, rc, iat, exp}`. The invalidation matrix
  says "PIN reset finalize" clears cookie BUT only on the device that performed
  the reset (only that response carries `clearCookie`). Other devices keep
  their cookies and continue to authorize PIN-gated operations until the 12h
  natural expiry — even though the underlying PIN they were issued against is
  no longer valid.
- Failure mode: laptop has warm PIN grace, phone is stolen, thief calls
  `pin/reset/finalize` to rotate the PIN. The laptop's cookie continues to
  authorize payroll FINALIZE for up to 12h. Reset-after-theft does not protect
  pre-theft warm sessions.
- Recommendation: add `pf` (pinHash fingerprint, first 12 hex of
  `crypto.createHash('sha256').update(pinHash).digest('hex')`) to the cookie
  payload. On verify, look up the user's current `pinHash`, compute the
  fingerprint, compare. Pin change/reset invalidates all warm cookies
  automatically via fingerprint mismatch. No new secret needed, no new table.
  Adds ~16B to cookie payload (well within the 4KB budget).

**A02.3 [SHOULD_FIX] bcrypt cost factor not documented.**
- Evidence: §5.2 says PIN port is verbatim from DH but does not state the bcrypt
  rounds value. DH's `pin-hash.util.ts` uses BCRYPT_ROUNDS=12 — current OWASP
  recommendation is 12+ for short-secret PIN-grade input. The architect should
  pin this constant in §5.2.
- Recommendation: §5.2 add: "BCRYPT_ROUNDS = 12, ported verbatim from DH
  `pin-auth.constants.ts`. Raise to 13 once Render Starter CPU budget allows
  (~150ms/verify @ 13 vs ~80ms @ 12)."

**A02.4 [SHOULD_FIX] Geofence GPS data — architect inherits SCOPE's correct
decision to store ONLY a `geofenceFlag` boolean (no raw lat/lng per clock-in).
But the Employee `geofenceLat`/`geofenceLng` columns (existing schema lines
399-402, `Decimal(10,6)`) are the firm-configured geofence center — those ARE
PII (workplace location). At rest, Postgres on Neon is encrypted, but the
schema does not document this storage choice as deliberately raw vs encrypted.**
- Recommendation: §2.2 (or new §2.5) — explicit note: "Employee.geofenceLat /
  Lng stored unencrypted in DB; relies on Neon at-rest encryption + DB
  credential rotation. Acceptable for non-extreme threat models; would re-evaluate
  if HP added a B2G or enterprise SKU."

**A02.5 [ACCEPTABLE] PayslipSnapshot is server-side (PR6, §4.2) — payslip PDF
is rendered client-side from a server-frozen `payload` JSON. A malicious client
cannot fabricate a different payslip because the snapshot is the source of
truth and `GET /api/payroll/:id/snapshot` returns it ungatewayed. Hash of the
snapshot payload SHOULD be persisted (§A08.1 below — append-only enforcement)
so a later regenerate produces a verifiable identical PDF — but that is a
SHOULD, not a MUST.**

---

### A03 — Injection

**A03.1 [MUST_FIX] `to_tsquery` for user-controlled `?q=` (§7.5 line 756) is
the wrong tsquery function.**
- Evidence: §7.5: "GET /api/audit?q=... uses `to_tsquery` cursor pagination."
- Failure mode: `to_tsquery` parses Postgres FTS syntax — `&`, `|`, `!`,
  `<->`, prefix `:*`, quoted phrases. A user query `'invoice & !x | y:*<->z'`
  errors with `syntax error in tsquery`. A malicious user queries
  `'foo & bar; DROP TABLE...'` — Postgres rejects it as bad tsquery syntax
  (not SQL injection), but they can still cause errors visible to the user
  and possibly leak structural info. Worst case (lesser-known FTS feature):
  weight selectors and FTS-dictionary calls.
- Recommendation: use `plainto_tsquery('english', $1)` (treats input as a
  phrase) OR `websearch_to_tsquery('english', $1)` (treats input as Google-style
  with `OR`, `-`, quotes). `websearch_to_tsquery` matches user expectations
  better for an audit search. Either choice is parameterized — neither leaks
  structural Postgres syntax. Update §7.5 + §17.3 acceptance gate.

**A03.2 [SHOULD_FIX] Phone normalization for `PinPhoneLockout` lookup.**
- Evidence: schema field is `phoneE164 String @unique`. The DH port at
  `DudhHisaab/src/services/auth-pin/pin-verify.service.ts:60` does
  `prisma.user.findFirst({ where: { phone }})` with raw `phone` and passes the
  raw `phone` to `getPhoneLockState(phone)`. If two clients send `+91 98...`
  vs `9198...` they hit different lockout buckets — defeats the brute-force
  protection.
- Recommendation: §5.2 add: "All phone lookups for PinPhoneLockout go through
  `normalizeToE164(rawInput)` (existing helper or new). The unique index column
  is `phoneE164`. The DH port helper `pin-lockout.service.ts` must be edited
  during port to use the normalized phone, NOT verbatim raw." Add acceptance
  gate: "two formats of the same phone produce ONE PinPhoneLockout row".

**A03.3 [ACCEPTABLE] No raw SQL elsewhere — Prisma parameterizes the rest.
Audit search GIN-index uses raw SQL in migration only (per
PRISMA_MIGRATION_RULES.md — correct).**

---

### A04 — Insecure Design

**A04.1 [MUST_FIX] `Payment.reversesPaymentId` column does not exist and is not
in the §2.2 new-columns table.**
- Evidence: arch §8.3 line 813 `reversesPaymentId: payroll.payment.id,    // FK
  back to original`. §17.2 line 1128 acceptance gate
  `Reversal writes inverse Payment row (..., reversesPaymentId set)`. The
  actual `Payment` model at `server/prisma/schema.prisma:1203-1235` does not
  have this column. The §2.2 column-changes table (arch line 308-315) lists 5
  new columns and `Payment.reversesPaymentId` is NOT one of them.
- Failure mode: PR1 migration ships without this column. PR6 (Employee +
  Payroll) writes `tx.payment.create({ data: { ..., reversesPaymentId: ... }})`.
  Prisma throws "Unknown argument `reversesPaymentId`" at compile time. The
  audit's M2 fix (inverse-direction-same-amount + FK link) is the design but
  the schema does not match.
- Recommendation:
  (a) Add to §2.2 column-changes table: `Payment | reversesPaymentId | NEW
      String? @unique (FK to Payment.id)` — `@unique` enforces "one reversal
      per original" (prevents reversal-of-reversal flip-flop per A04.2).
  (b) Add the migration step to §2.4 PR1: `ADD COLUMN "reversesPaymentId" TEXT
      NULL`, `ADD CONSTRAINT "Payment_reversesPaymentId_fkey" FOREIGN KEY ...
      REFERENCES "Payment"(id) ON DELETE RESTRICT`, `CREATE UNIQUE INDEX ...`.
  (c) Add to §17.2 acceptance: "FK constraint REJECTS a second reversal of an
      already-reversed Payment".
  (d) Add to §10 state machines: Payment row gains a new terminal sub-state
      "REVERSED" (derived: `reversesPaymentId IS NOT NULL` OR
      `EXISTS rev WHERE rev.reversesPaymentId = self.id`).

**A04.2 [SHOULD_FIX] Reversal-of-reversal prevention requires schema-level
constraint, not just code-level guard.**
- Evidence: §8.3 code does not check whether the Payment being "reversed" is
  itself a reversal. The flip-flop scenario: PAYROLL_OUT P1 → reverse into
  PAYROLL_IN P2 → reverse P2 into PAYROLL_OUT P3 (which now duplicates the
  original disbursement, silently re-paying the employee). Net balance is
  +P1 net (since P3 reverses P2 reverses P1).
- Recommendation: combine with A04.1 — make `Payment.reversesPaymentId` not
  just a nullable FK but a `@unique` nullable FK, AND add a service-layer
  check at the start of `reverse` to throw if `payment.reversesPaymentId IS
  NOT NULL` (i.e. the Payment we're being asked to reverse is itself a
  reversal). Acceptance gate: "calling /reverse on an already-reversal
  returns 422 PAYROLL_NOT_FINALIZED" (or a new code `PAYROLL_NOT_REVERSIBLE`).

**A04.3 [ACCEPTABLE] PIN-required 403 vs 401 — `requireRecentPin` issues
**403** correctly, sidestepping the `src/lib/api.ts` 401-refresh interceptor.
The "server is authoritative, modal is just UX" model is correctly designed
(SCOPE §7 Risk A07 mitigation). A malicious FE cannot bypass — every gated
route checks the cookie server-side.**

**A04.4 [ACCEPTABLE] Multi-firm switch mid-request race — the per-request
cookie value is snapshotted at the auth-middleware boundary (cookie-parser
runs once per request, sets `req.cookies`). The cookie value cannot evolve
mid-handler. The arch's `bid !== req.user.businessId` rejection in §5.3 is
the right defense for cross-tenant cookie replay AFTER a switch.**

**A04.5 [SHOULD_FIX] sameSite=strict deferred constraint (architect Q#3) is
correctly noted as a deferred constraint because HP has no OAuth today. ADD
to the deferred-constraints list in arch §17.5 or a new §22 so when HP later
adds Razorpay subscription OAuth redirects the constraint is remembered.**

---

### A05 — Security Misconfiguration

**A05.1 [SHOULD_FIX] PIN grace cookie attributes lack a fail-closed default for
dev mode.**
- Evidence: §5.3 lists `secure: true (in prod)`. In dev, `secure: false` is
  set. The default for `secure` is `false` and most dev test fixtures don't
  hit `NODE_ENV='production'`. A misconfigured staging environment that
  forgets to set `NODE_ENV='production'` ships cookies without `secure`.
- Recommendation: §5.3 + the `pin-grace-cookie.ts` helper — `secure: process.env.NODE_ENV !== 'development'`
  (fail-CLOSED in staging + prod, only dev gets the relaxation). Document.

**A05.2 [SHOULD_FIX] New environment variables not enumerated.**
- Evidence: arch v2.2 introduces no new env vars (JWT_SECRET reuse, no
  Turnstile, no S3, no new secrets). But the architecture also doesn't
  explicitly state "no new env vars" — a builder might silently add one and
  the `server/src/lib/env.ts` Zod schema would need a row.
- Recommendation: arch add §0.3 (or §17.7) explicit "Phase 6 introduces ZERO
  new env vars. If a builder thinks they need one, escalate to architect."

**A05.3 [ACCEPTABLE] CORS — Phase 6 ships no cross-origin endpoint
(everything is `/api/*` consumed by same-origin SPA). CSRF middleware
(`server/src/middleware/csrf.ts`) already gates state-changes with the
double-submit pattern.**

---

### A06 — Vulnerable & Outdated Components

**A06.1 [ACCEPTABLE] No new npm dependencies beyond what already ships.
React-PDF for payslip is already installed (used by Invoice PDF). bcrypt is
already present. cookieParser is already mounted (§5.3 line 624).
`@capacitor/share` is already installed (per dudhhisaab pattern). No DH-port
dep additions in the file plan — verified PR3 file list.**

**A06.2 [SHOULD_FIX] DH PIN port copies 13 of 15 files VERBATIM. The "verbatim"
guarantee is only as good as DH's last security audit on those files. Add an
explicit acceptance gate: "PR3 verifies each ported file has no known-stale
dep versions vs HP's lockfile (e.g. bcrypt version pinned must match)."**

---

### A07 — Identification & Authentication Failures

**A07.1 [SHOULD_FIX] PIN reset request endpoint lacks Turnstile / captcha gate.**
- Evidence: arch §6.1 `POST /api/auth/pin/reset/request` middleware chain is
  `(none — pre-PIN) · rate-limit per-phone`. DH port file `turnstile-gate.service.ts`
  IS listed in `auth-pin/` source files (per the DH grep earlier) but the §5.1
  port table excludes 2 files (described as "dairy-specific"). The audit
  brief specifically mentions Turnstile — confirm whether `turnstile-gate.service.ts`
  is one of the 2 excluded files. If excluded, the PIN-reset OTP send becomes
  an unbounded SMS-bombing surface (rate-limit per-phone helps but a botnet
  rotating phone numbers can still burn SMS credit).
- Recommendation: §5.2 explicitly state whether turnstile is in scope. If not,
  add §17.3 acceptance gate: "PIN reset request rate-limit caps SMS credit
  burn at <Rs N/hr per phone-prefix" and budget alert.

**A07.2 [SHOULD_FIX] Failed PIN attempts must write AuditLog with ALL of:
ip, ua-hash, phone-fingerprint, userId, deviceId, reason — but the §17.6 acceptance
only says "PIN verify writes AuditLog (success + failure + lockout)" without
specifying the redaction-safe field set.**
- Evidence: §17.6 line 1167.
- Recommendation: specify the AuditLog `diff` shape for PIN events:
  `{ event: 'pin_verify_failure', reason: 'wrong_pin'|'phone_locked'|'device_locked',
     ipHash: sha256(ip+JWT_SECRET).slice(0,16), uaHash: sha256(ua).slice(0,16),
     phoneHash: sha256(phone+JWT_SECRET).slice(0,16), deviceId, userId }`. Note:
  phone-hash uses JWT_SECRET as pepper to make rainbow tables unusable (Indian
  E.164 space is only ~1e10 — trivially rainbow-able without a pepper).

**A07.3 [SHOULD_FIX] Logout-all does not clear PIN grace cookies on remote
devices.**
- Evidence: §5.3 invalidation matrix says "Other sessions natural-expire via
  `uid` mismatch on next request after pinHash rotation invalidates them". But
  logout-all does NOT rotate `pinHash`. So the only thing that invalidates a
  remote device's PIN grace cookie after logout-all is the JWT blacklist for
  the access token — and that ONLY 401s the request. The `pin_grace_cookie`
  itself is still valid by HMAC, and the moment that user re-authenticates
  (e.g. fingerprint biometric, fresh OTP), their warm cookie is *back* on
  every device that still has it.
- Recommendation: combine with A02.2 — bind the cookie to `pinHash` fingerprint,
  AND have logout-all rotate `pinHash` via re-hash of the same PIN (changes
  the bcrypt salt → changes the fingerprint → invalidates ALL grace cookies).
  Alternative: write a `pinSessionVersion` int to UserAppSettings, include
  `psv` in cookie payload, and bump on logout-all.

**A07.4 [SHOULD_FIX] PIN grace cookie cookie is `path: '/api'`. Acceptable.
But the new `POST /api/auth/pin/verify` endpoint is also under `/api`, which
means the cookie is sent on every API request — even unauthenticated ones
where it's meaningless. Cosmetic, but emits cookie noise into logs.**
- Recommendation: narrow to `path: '/api'` per current design — already
  correct. (Resolved on re-read; no change.)

**A07.5 [SHOULD_FIX] DH PIN verify's `getDeviceLockState` is checked AFTER
bcrypt completes on the SUCCESS branch. Comment in DH source line 91 says
"Check device lockout first (even on correct PIN, if locked before bcrypt
ran)". Good defense. But: on the SUCCESS branch with a stale lockout (e.g.
admin manually cleared `lockedUntil`), the comparison succeeds, then the
lockout is checked, then `resetDeviceLockout` is called. If TWO concurrent
verify requests for the same userId+deviceId race past the lockout-check, both
return success and both call `resetDeviceLockout`. Not a security hole, but
the lockout-check + reset are not transactional.**
- Recommendation: not a fix — DH lived with this for months. Document as
  ACCEPTABLE in §5.2.

**A07.6 [ACCEPTABLE] Multi-device PIN grace per-device cookie (laptop must
re-PIN when phone unlocked) is correct UX per arch §5.3. Logout invalidation
matrix is correct (with A07.3 closure).**

---

### A08 — Software & Data Integrity

**A08.1 [SHOULD_FIX] PayslipSnapshot lacks a content-hash for tamper detection.**
- Evidence: §2.1.e — `payload Json`. No `payloadHash String` column. If a
  malicious admin (or accidental migration) mutates a finalized snapshot, no
  later regeneration can detect the divergence.
- Recommendation: add `payloadHash String @db.VarChar(64)` to `PayslipSnapshot`
  computed `sha256(JSON.stringify(payload))` at write-time. Acceptance gate:
  read endpoint recomputes hash, returns 500 PAYSLIP_INTEGRITY_FAILED if
  mismatched. Compliance benefit: legal-record-immutability claim becomes
  enforceable.

**A08.2 [SHOULD_FIX] AuditLog tamper resistance — append-only at the application
layer only. A malicious admin with DB access can `UPDATE` rows. SCOPE accepts
this (defense-in-depth via the audit-trail itself + RBAC + DB credential
rotation), but the architecture should document this acceptance explicitly.**
- Recommendation: §7.1 add: "AuditLog rows are append-only at the application
  layer; database-level row-locks (`REVOKE UPDATE, DELETE ON AuditLog FROM
  <app_user>`) are recommended but out of scope for Phase 6 (requires Render
  DB role split). Documented risk: malicious DB credential leak permits audit
  tampering — mitigated by credential rotation runbook."

**A08.3 [ACCEPTABLE] Payroll snapshot immutability — Payroll/PayrollRun rows
become payment-of-record. Reversal creates NEW rows (per M2 closure). The
application layer never `UPDATE`s a finalized Payroll's monetary fields
(status changes from FINALIZED → REVERSED are deliberate state transitions).
Acceptable as designed.**

---

### A09 — Security Logging & Monitoring

**A09.1 [SHOULD_FIX] AppError `details` may leak PII into the response body.**
- Evidence: arch line 401 — `assertCustomerPaymentType` throws
  `AppError(ErrorCode.INVALID_PAYMENT_TYPE, 400, ..., { type })`. The `details`
  field is preserved by `errorHandler` and returned to the client. Today
  `{ type }` is harmless. But the pattern is now established for future code
  to throw `AppError(..., 400, msg, { type, partyId, phone, lat, lng })` —
  leaking PII into 400 responses that get logged on Render, captured by Sentry,
  emitted to user devices, etc.
- Recommendation: arch add §0.5 (or §17.8) — "AppError `details` field is a
  whitelist: ALLOWED keys are `{type, field, max, min, expected, actual}`.
  PII keys (`phone, partyId, userId, email, gstin, lat, lng`) are FORBIDDEN
  in `details`. Enforced via grep in `scripts/enforce.js` against the AppError
  constructor sites."

**A09.2 [SHOULD_FIX] AuditLog `diff` field has no redaction allowlist.**
- Evidence: §7.6 says `AuditLogRedaction` per-business defines field paths to
  mask at READ time. But there is no allowlist for what is SAFE to write to
  `diff` in the first place. A buggy service that puts full request body into
  `diff` (e.g. `diff: req.body`) writes the user's plaintext PIN, the new
  bcrypt'd pinHash, OTP codes, etc.
- Recommendation: every AUDIT_COVERAGE entry should also declare the
  diff-fields-allowlist for that operation. The pre-commit enforcer
  (`scripts/enforce-audit-coverage.mjs`) walks the `auditLog.create` call's
  `data.diff` literal and rejects unrecognised keys. Acceptance gate: "PIN
  verify audit row contains hashed phone, NEVER plaintext PIN".

**A09.3 [SHOULD_FIX] No alerting threshold for `pin_grace_cookie_tamper_total`.**
- Evidence: §14 declares the Prometheus metric. §17.5 has the integration
  test for tamper detection. But there is no alerting rule.
- Recommendation: §14 add: "Alert at rate > 5/min sustained for 5min. Above
  baseline noise suggests targeted attack."

**A09.4 [ACCEPTABLE] Cross-business pattern detection (a single user running
600 previews in 60min across multiple firms) is correctly flagged as out of
scope.**

---

### A10 — Server-Side Request Forgery

**A10.1 [ACCEPTABLE] No user-controlled URL fetching in Phase 6.**
- Evidence: no webhook endpoint added (the audit-trail SSE / WhatsApp share
  goes OUT, never IN as URL). No image upload in Employee model. PayslipPDF
  rendering uses `<Text>` only (per the FE pattern in
  `src/features/invoices/pdf/InvoicePdfDocument.tsx`) — no user-URL fetching.
- S3 cold storage — confirmed OUT OF SCOPE for Phase 6 (SCOPE line 1070,
  arch line 1054 deferred to Phase 7).

**A10.2 [ACCEPTABLE] Geofence consent flow has no external HTTP — coordinates
are accepted via Capacitor Geolocation plugin client-side; server only writes
a boolean flag (per SCOPE line 998). No SSRF vector.**

---

## Architect-raised open questions — security verdict

1. **JWT_SECRET reuse vs sibling secret (A02.1)** — VERDICT: option (a)
   ACCEPTABLE provided domain separation tag is added to the HMAC input
   (`'pin-grace-cookie-v1:' + payloadJson`). Mark SHOULD_FIX in §5.3. Reuse
   is the right ops choice; the tag is the right crypto-hygiene choice.

2. **Cookie tamper telemetry (A09.3)** — VERDICT: emit, but with an alerting
   rule. Add to §14: "Alert at rate > 5/min sustained for 5min." Promoted to
   SHOULD_FIX.

3. **sameSite=strict and OAuth callbacks (A04.5)** — VERDICT: ACCEPTABLE as a
   documented deferred constraint. Add to a "deferred constraints"
   section so the limitation is remembered when HP later adds OAuth
   (Google login, Razorpay subscription portal). No fix now.

---

## Live-Incident Regression Checks (from DH security_defaults.md)

| Pattern | Phase 6 status |
|---|---|
| Webhooks: `express.raw()` + HMAC + event_id + 5min skew + fail-closed | Phase 6 ships NO new webhooks. PASS. |
| Auth tokens in `httpOnly` cookies; admin = sessionStorage; NEVER localStorage | PASS. PIN grace cookie is httpOnly. No new localStorage writes. |
| Zod `.strict()`; NEVER `.passthrough()` | Phase 6 schemas (party.schemas, payment.schemas, pin.schemas, etc.) MUST land `.strict()` — verify in PR1+PR3. Add to acceptance gate. |
| Every route registers `requireAuth`/`requireAdmin` before `router.<verb>()` | PASS by design — §6.1 middleware chain. |
| IDOR / tenant scoping: every query scoped by `businessId`; never `data: req.body` | PR0 TENANCY_AUDIT.md is the dedicated deliverable for this. BLOCKER: `req.user.id` regression (A01.1) is exactly the IDOR bug class. |
| CSRF: Origin/Referer check on cookie-auth state-changes | PASS — HP already has `csrfProtection` middleware. New PIN routes inherit. |
| Frontend env: only `VITE_*` and `NODE_ENV` | Phase 6 FE introduces no new env vars. PASS. |
| Admin perimeter: `ipWhitelist` at `/api/admin/*` mounts | N/A — Phase 6 routes are user-facing under `/api/hr/*`, `/api/payroll/*`, `/api/audit`. |
| Refresh-family theft must NOT escalate to `blacklistUser()` | PASS — Phase 6 does not touch refresh-token theft flow. |
| Banned: `mongoSanitize`, `eval`, raw `innerHTML =`, `dangerouslySetInnerHTML` w/o DOMPurify, source maps in prod, hardcoded secrets | PASS — verified via grep. |

---

## Decision

**BLOCK → request architect v2.3** addressing the 4 MUST_FIX items:

1. A01.1 — `req.user.id` → `req.user.userId` everywhere (3 sites + helper signature)
2. A02.2 — Bind PIN grace cookie to `pinHash` fingerprint (`pf` field, ~16B)
3. A03.1 — `to_tsquery` → `websearch_to_tsquery` for `/api/audit?q=`
4. A04.1 — Add `Payment.reversesPaymentId` to §2.2 column table + PR1
   migration + `@unique` constraint (closes A04.2 reversal-of-reversal too)

The 11 SHOULD_FIX items can land in v2.3 OR in their respective build PRs
with explicit traceability — architect's choice. The 4 MUST_FIX items are
schema/code-fail or silent-IDOR/silent-bypass — they cannot ship.

Once v2.3 lands with the 4 MUST_FIX closures, security re-audit is a
~30 min spot-check (verify the 3 grep sites, the cookie payload field, the
tsquery function name, the schema migration row). After that, ADVANCE to
task-manager (build can start with PR0).


---

## v2.3 re-audit (2026-05-18)

**Overall**: PASS
**Counts**: 0_MUST_FIX, 11_SHOULD_FIX (unchanged; none re-elevated)

### MUST_FIX closure verification

- **A01.1**: CLOSED — §3.6 line 561 reads `userId: req.user.userId, businessId: req.user.businessId` (verified); §5.3 verify step 4 line 659 reads `uid !== req.user.userId`; §5.3 invalidation matrix line 680 reads `req.user.userId === affected user`. The 7 remaining `req.user.id` occurrences in the doc are all didactic (changelog, §1 glossary "never use this", §17.1 counter-example test, §20 postmortem trigger, §18.2 row 23 test description) — protective documentation, not code. §20 adds enforce.js pattern `/req\.user\.id\b/` to catch regressions at pre-commit.
- **A02.2**: CLOSED — §5.3 payload includes `"pf": "<first 12 hex of sha256(currentPinHash)>"`; mint (line 669) writes `pf=sha256(pinHash).slice(0,12)`; verify step 9 (line 664) reads `pf !== sha256(currentPinHash).slice(0,12)` — re-reads `pinHash` from DB on EVERY verify (line 690 confirms `requireRecentPin` fetches `UserAppSettings` before calling `verifyPinGraceCookie`), so the fix does not degenerate. Invalidation matrix row 4 (`pin/change`) + row 5 (`pin/reset/finalize`) + new bold row both route through "Automatic via `pf` mismatch". State machine §10.3 line 1021 confirms cross-device silent invalidation. 48 bits of binding is adequate against forgery at audit-log volumes; pf reveals no pin material (sha256 truncation, one-way).
- **A03.1**: CLOSED — §5.1 line 609, §7.5 line 793, §6.1 routes line 713, §15 latency line 1151 all use `websearch_to_tsquery`. §7.5 line 795 narrates the rationale + Postgres 11+/Neon 15+ compatibility. §17.3 line 1221 fuzz battery includes `R&D`, `(test)`, `it's`, `a|b`, `--`, `&|!()` — must return 200, never 500. §20 line 1427 adds postmortem trigger banning bare `to_tsquery(` in `server/src/services/audit/**`. The 2 remaining occurrences of the bare token are narration ("to_tsquery-crashing inputs" + "should NOT appear in any query file").
- **A04.1**: CLOSED — §2.2 line 326 adds `Payment | reversesPaymentId | NEW Int? @unique with FK self-ref`. §2.2 lines 329-333 spell out the relation pair, `Int?` matches Payment.id (autoincrement Int per `server/prisma/schema.prisma:1205`), nullable with no backfill. §8.3 lines 860-867 wrap reversal in try/catch translating Prisma P2002 on `reversesPaymentId` target to `AppError(VALIDATION_ERROR, 409, 'PAYMENT_ALREADY_REVERSED')`. §6.2 line 733 lists the error code. PR1 file plan row 2 (+5L schema), row 3 (+15L migration SQL with `ADD COLUMN`/`CREATE UNIQUE INDEX`/`ADD CONSTRAINT FK`), row 21 (+20L migration test). §17.2 line 1202 asserts schema-diff + second-insert P2002. §17.2 line 1204 asserts reversal-of-reversal returns 409 not 500.

### Q verdict codification verification

- **Q1 domain-sep**: PRESENT — §5.3 line 641 signs `'pin-grace-cookie-v1:' + JSON.stringify(payload)`; verify line 658 recomputes against the same prefix. Rationale at line 644 cites OWASP Cryptographic Storage cheat sheet + `v1` rotation tag. §17.3 line 1238 acceptance gate: payload signed WITHOUT prefix returns 403 + emits `pin_gate.domain_prefix_mismatch`.
- **Q2 telemetry**: PRESENT — §10.5 (NEW mini-section) introduces `server/src/lib/security-events.ts` SSOT with 6 typed event names; `emitSecurityEvent()` helper signature shown. PR1 file plan row 24c covers the file (new). §14 line 1135-1136 documents counter + alert rule (`>5/min sustained for 5min on same IP` → page on-call). `pf_stale` excluded from alert rollup (correct — legitimate PIN rotation is benign).
- **Q3 OAuth**: PRESENT — §5.3 line 653 documents that `sameSite=strict` will NOT be sent on cross-site OAuth callback; the correct post-OAuth flow is fresh `requireRecentPin` re-verify on next gated route. Explicit "do not weaken to lax" guardrail for future engineer included. Matches Stripe/GitHub/Google grace-cookie behavior under strict.

### New gaps

None. v2.3 patch is a surgical, non-design rewrite. Spot-skim of A02/A03/A05/A07 found nothing the patch inadvertently weakened:
- `pf` is server-only (never sent to client; cookie carries only the 12-hex digest, which is one-way over `pinHash` which is itself bcrypt — no pin material leaks).
- Domain-separation prefix is a server-side constant; the cookie payload itself doesn't expose the prefix value.
- Fuzz battery uses `websearch_to_tsquery` which sandboxes user input — no new SQL surface.
- The new `Payment.reversesPaymentId @unique` + FK self-ref is the correct DB-level integrity guard (no application-logic bug can produce flip-flop reversals).
- Security-event taxonomy (§10.5) adds typing — strengthens, not weakens.

The 11 prior SHOULD_FIX items (S1-S11) remain SHOULD; none silently re-elevated to MUST by v2.3 changes.

### Decision

**ADVANCE to task-manager.** Architecture v2.3 is build-ready. PR0 (cross-tenant leak audit per §3.2) can start immediately; PR1 (schema + migration + middleware + security-events.ts SSOT) gates everything downstream. The 11 SHOULD_FIX items land in their respective PRs with explicit traceability per architect's choice.
