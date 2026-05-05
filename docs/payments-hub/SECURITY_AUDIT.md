---
status: approved
feature: payments-collections-hub
created: 2026-05-05T23:38:00Z
auditor: security agent
verdict: APPROVED with 8 merge-blockers (MB-1..MB-8)
predecessors:
  - docs/payments-hub/PRD.md (1,324 lines)
  - docs/payments-hub/ARCHITECTURE.md (1,218 lines)
reference_bar: docs/SECURITY_AUDIT_gst_phase_2.md (342 lines)
acceptance:
  backend:
    - "curl unauth GET /api/collections/aging/summary -> 401 UNAUTHORIZED (no body leak)"
    - "curl tenant-A GET /api/collections/payment-links/<tenantB-link-id> -> 404 (NOT 403, no existence oracle)"
    - "curl tenant-A POST /api/collections/ptp { partyId: <tenantB-party-id> } -> 404 PARTY_NOT_FOUND"
    - "curl POST /api/collections/payment-links { invoiceId, amountPaise: 99999999 } where invoice.outstanding=10000 -> 400 AMOUNT_EXCEEDS_OUTSTANDING; server re-reads outstanding, never trusts client paise"
    - "curl POST /api/collections/payment-links * 11 in 60s -> 429 RATE_LIMITED on req 11 (10 req/min user)"
    - "curl POST /api/collections/reminders/bulk { partyIds: [51 ids] } -> 400 BATCH_LIMIT_EXCEEDED"
    - "curl POST /api/collections/reminders/bulk * 6 in 60s -> 429 (5/min/user)"
    - "Razorpay webhook with bad X-Razorpay-Signature -> 400, no DB writes, audit row recorded"
    - "Razorpay webhook replayed (same eventId) -> 200, second call no-op, no second Payment row"
    - "Razorpay webhook for tenant-A linkId routed to tenant-B businessId in body -> handler trusts DB row's businessId, NOT body; payment landed on correct tenant"
    - "PATCH /api/collections/ptp/:id where status=BROKEN -> 409 PTP_NOT_EDITABLE (immutability)"
    - "DELETE /api/collections/ptp/:id where status=BROKEN -> 409 PTP_NOT_DELETABLE (audit immutability)"
    - "AuditLog row exists for every PaymentLink create/cancel, every PTP create/cancel/transition, every reminder dispatch"
    - "AuditLog.changes for PAYMENT_LINK_CREATED contains shortUrl + amount but masks recipientPhone to suffix-4"
    - "ReminderLog.recipientPhone never appears in stdout / Winston JSON logs in plaintext (only +91XXXXX1234 form)"
    - "wa.me URL building uses encodeURIComponent on partyName; XSS test name '<img src=x onerror=alert(1)>' renders as encoded text in WhatsApp"
    - "Statement DTO endpoint /api/collections/statements/:partyId for tenant-B partyId -> 404 (not 403)"
    - "Statement S3 pre-signed URL TTL <= 7 days; URL revocable via DELETE /storage/statements/:id"
    - "Cron ptp-evaluator runs as system user (no req.user); every PTP transition write includes systemActorId='cron:ptp-evaluator' in AuditLog"
    - "tsc clean; grep -rn 'console\\.\\(log\\|error\\)' server/src/services/collections -> 0 hits (Winston only)"
    - "Helmet.js mounted; CORS allowlist (not '*') confirmed for /api/collections/*"
  frontend:
    - "screenshots: 320px loading/error/empty/success for Aging, Bulk Reminder, Payment Link, PTP, Statement"
    - "no payment link shortUrl, no recipient phone, no statement pre-signed URL written to localStorage on any Collections screen"
    - "Bulk reminder preview drawer shows fully-rendered message + recipient phone BEFORE dispatch loop starts (anti-mismap)"
    - "Offline -> POST /api/collections/payment-links shows 'Connect to internet' toast (hard-fail per architecture §13); does NOT silently queue"
    - "Statement PDF preview: party GSTIN + party phone rendered through encodeForHtml; XSS name vector renders as text"
    - "Razorpay shortUrl never logged to console; service-worker request log redacts shortUrl"
---

# Security Audit — Payments & Collections Hub (v1)

**Verdict:** APPROVED with 8 merge-blockers (MB-1..MB-8). All blockers are
concrete code-level requirements that the architecture document already
gestures at but does not nail down. None require redesign — they are
implementation gates the build PRs MUST satisfy.

Scope reviewed: `docs/payments-hub/PRD.md` (1,324 lines) +
`docs/payments-hub/ARCHITECTURE.md` (1,218 lines, sections 1–20). Three new
models (`PromiseToPay`, `PaymentLink`, `ReminderLog`) + one forward-compat
shell (`CollectionCadence`) + ~22 endpoints + 2 cron jobs + 1 permission
module + new Razorpay webhook event family (`payment_link.*`). No code
exists yet — this audit pre-empts the build, mirroring the GST Phase 2
precedent (`docs/SECURITY_AUDIT_gst_phase_2.md`).

---

## 1. Executive Summary

The Payments Hub introduces three classes of risk new to HisaabPro:

1. **Money-moving webhooks** — `payment_link.paid` causes a `Payment` row
   to be inserted, `Document.balanceDue` to drop, and a customer's PTP
   to flip to KEPT. A spoofed or replayed webhook = forged collection.
2. **PII broadcast at scale** — bulk reminders (50/call) build per-party
   message bodies containing recipient name, balance, due dates, and a
   payment link. One template-token mismap or one cross-tenant party ID
   = a leak amplified across an entire batch.
3. **Long-lived shareable URLs** — Razorpay shortUrls (pay handle) and
   pre-signed S3 statement URLs are bearer secrets that travel by WhatsApp.
   Forwarded, screenshotted, indexed by Google — they leak.

The architecture handles these correctly at the **design** level; the
8 merge-blockers below are the code-level gates that turn that design
into ship-grade implementation. The new `collections` permission module
(5 actions) is well-scoped — Cashier (`salesman`) cannot create payment
links, matching least-privilege. The `ReminderLog` append-only design
is correct.

OWASP Top 10 mapping (full per-surface in §3): A01 (cross-tenant on
PaymentLink + Statement), A03 (template-token + wa.me URL injection), A04
(insecure design — webhook tenant-trust, statement URL TTL), A07
(rate-limit gaps on bulk reminder), A08 (webhook replay), A09 (PII in
ReminderLog logs).

---

## 2. Threat Model

### 2.1 Assets

| Asset | Sensitivity | Storage | Why it matters |
|---|---|---|---|
| Razorpay webhook secret | **CRITICAL** | env (`RAZORPAY_WEBHOOK_SECRET`) | Anyone with this can mint fake payments |
| Razorpay key_id / key_secret | **CRITICAL** | env | Outbound payment-link create + cancel |
| `PaymentLink.razorpayLinkId` + `shortUrl` | HIGH | DB + WhatsApp message | Bearer URL — anyone with it can pay (low harm) but also anyone with it sees the merchant + amount (recon) |
| Statement pre-signed S3 URL | HIGH | client-side + WhatsApp message | Discloses full party transaction history for 7 days |
| Party phone number | HIGH (PII / DPDP) | `Party.phone` | Required for wa.me but PII; must be masked in logs + UI lists |
| Party GSTIN | MEDIUM | `Party.gstin` | DPDP-protected commercial identifier |
| `ReminderLog.renderedMessage` | MEDIUM | DB only | Contains phone + balance + link; never log to stdout |
| `PromiseToPay.notes` (≤500 chars) | MEDIUM | DB | User-supplied free text — may contain PII or commercial-confidential |
| Payment amount / outstanding | MEDIUM | `Document.outstandingAmount` | Tenant-private financial data |
| AuditLog rows | HIGH (immutable) | DB | Forensic source of truth — must be append-only |

### 2.2 Attackers

| # | Attacker | Capability | Motivation |
|---|---|---|---|
| A1 | **Cross-tenant attacker** — legitimate HP user, tenant-A | Authenticated; can call any `/api/collections/*` endpoint with crafted `partyId`/`invoiceId`/`linkId`/`ptpId` from tenant-B | Snoop competitor receivables, steal customer phone list, cancel rival's PaymentLink to break their collections |
| A2 | **External webhook spoofer** | Knows our webhook URL (it's static, in DNS); does NOT have webhook secret | Mint fake `Payment` rows to mark invoices paid without actual money movement |
| A3 | **Replay attacker** | Captured a real Razorpay webhook payload (e.g., from logs leak) | Replay to double-credit a payment; create duplicate `Payment` rows; corrupt ledger |
| A4 | **Compromised cashier** — staff with `salesman` role | Authenticated; lacks `collections.collect` | Tries to create payment links anyway; tries to mark broken PTP as KEPT |
| A5 | **WhatsApp message recipient** — actual customer or a forwardee | Receives `shortUrl` or `statementUrl` | Forwards URL; URL ends up on a public WhatsApp group / Pastebin |
| A6 | **Bulk-send abuser** — legitimate user behaving badly | Can hit `/reminders/bulk` repeatedly | Spam outbound messages; trigger WhatsApp anti-abuse on their own number; weaponise HP to harass customers |
| A7 | **Cron context confusion** — internal bug | `ptp-evaluator` cron runs without `req.user`; what `businessId` scope? | If the cron iterates all businesses with one shared connection and a service forgets the loop variable, a tenant-B PTP could flip via tenant-A's iteration |

### 2.3 Trust boundaries

```
[browser] -- TLS --> [api] -- TLS --> [Razorpay]
                      |
                      +--> [Postgres]
                      +--> [Redis]
                      +--> [S3] -- pre-signed URL --> [browser/WhatsApp]
                      <-- TLS, X-Razorpay-Signature -- [Razorpay webhook]
```

**The most-trusted inbound edge is the Razorpay webhook.** It is the
single channel that turns external state (a customer's UPI tap) into
internal financial records. MB-1 + MB-2 are about hardening that edge.

---

## 3. OWASP Top 10 — Per Surface

### A01 — Broken Access Control

**Surfaces at risk:** all 22 endpoints; the cron jobs (no `req.user`).

**Required controls:**

- Every Express handler reads `businessId` from `req.user` (JWT). NEVER
  from request body, query, or URL.
- Every Prisma query in the `services/collections/**` tree includes
  `businessId` in its `where` clause as the **first** filter. Service
  functions take `businessId` as the first non-optional argument by
  convention (matches `services/document/get.ts`).
- Cross-tenant lookup (e.g., `GET /payment-links/:id` where `id` belongs
  to tenant B) returns **404 not 403**. 403 leaks existence; 404 does
  not. Match the GST audit decision and existing `documents.service.ts`
  behaviour.
- For `POST /collections/ptp` with `{ partyId, invoiceId }`: server
  validates `(partyId.businessId === req.user.businessId)` AND
  `(invoiceId.businessId === req.user.businessId)` AND `(invoiceId.partyId === partyId)`.
  Any mismatch → 404 PARTY_NOT_FOUND or 404 INVOICE_NOT_FOUND. Do not
  compose 403 here either.
- For `POST /reminders/bulk`: per-row tenant check on every `partyId`
  in the array. A 51-element array with one cross-tenant ID must NOT
  partial-succeed — return 400 BATCH_VALIDATION_FAILED with the bad
  index. Pre-flight all IDs in one `findMany({ where: { id: { in: ids }, businessId } })`
  and assert the count matches before any dispatch.
- For cron jobs: see MB-7 (cron must explicitly scope per business and
  carry a synthetic `actor: 'cron:<job-name>'` in AuditLog writes).

**Spot-check of 4 endpoints:**

| Endpoint | businessId source | Risk | Required gate |
|---|---|---|---|
| `POST /api/collections/payment-links` | `req.user.businessId` | Could mint Razorpay link against wrong invoice | service validates `invoice.businessId === req.user.businessId` BEFORE Razorpay call; `reference_id` sent to Razorpay is local PaymentLink.id, never client-supplied |
| `GET /api/collections/aging/buckets/:bucket/parties` | `req.user.businessId` | Path param `:bucket` could be used to enumerate other tenants' parties via offset | bucket is enum (CURRENT/0_30/...), not a tenant id; party list query has `WHERE businessId = $1` from JWT; cursor is `(partyId, sortKey)` not raw offset |
| `POST /api/webhooks/razorpay` (extended) | from event `notes.businessId` | If handler trusts notes.businessId, attacker spoofs cross-tenant write | handler MUST resolve `businessId` from the local PaymentLink row keyed by `razorpayLinkId`, NOT from `notes.businessId` (see MB-2) |
| `GET /api/collections/statements/:partyId` | `req.user.businessId` | Could leak another tenant's transaction history | Prisma `findFirst({ where: { id: partyId, businessId } })` then DTO build; no access otherwise |

### A02 — Cryptographic Failures

- Razorpay credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`) live exclusively in env vars. Read once at
  boot via `lib/env.ts` Zod schema; missing var = boot fail.
- Webhook signature verification is HMAC-SHA256(rawBody, webhookSecret),
  compared with `crypto.timingSafeEqual`. **MUST** use raw body bytes, not
  the JSON-parsed object — a JSON re-stringify changes whitespace and
  invalidates the signature. Existing `verifyWebhookSignature` already
  does this for subscription webhooks per architecture §6d — confirm in
  PR diff that the new event family routes through the same verify call
  BEFORE any handler logic runs.
- Statement pre-signed S3 URLs use AWS SigV4 with `x-amz-expires` ≤ 604800s
  (7 days). The TTL is a **maximum**, not a default — see MB-6 for the
  shorter default we want.
- Razorpay `shortUrl` itself is not a credential we control — it is a
  bearer URL Razorpay issues. Treat as PII when rendering in UI lists
  (mask middle 8 chars in the LinksPage table; full URL only on detail
  drawer + copy button).
- No new password hashing. JWT in HttpOnly cookie unchanged.

### A03 — Injection

- All Prisma queries parameterised. No `$queryRaw` proposed in
  architecture. If a builder later adds one (e.g., for the partial-index
  EXPLAIN-tuned aging query), it MUST use `Prisma.sql` template tag.
- **Template token injection (MB-3):** the architecture says "user
  custom message is escaped + appended after template rendering, never
  inside it." Code-level requirement: `templates.ts:render(template, ctx)`
  receives the static template string (from a `const REMINDER_TEMPLATES`
  registry — never user-typed) and a typed context object. `customMessage`
  from the request is concatenated AFTER `render()` returns, with a
  newline separator, and the concatenation site MUST NOT itself perform
  token substitution. Test vector: customMessage `'\n{{paymentLinkUrl}}'`
  must render as the literal characters, not as a substitution. Failure
  mode without this: a malicious user puts `{{paymentLinkUrl}}` in their
  custom message; the server's first render pass leaves `{{...}}` intact;
  a second render — if anyone ever adds one — substitutes the wrong
  invoice's URL into the wrong party's message.
- **wa.me URL injection (MB-4):** `wa.me` URLs are built as
  `https://wa.me/<phone>?text=<encoded>`. The `<phone>` must be E.164
  digits-only (no `+`, no spaces) AND validated against `/^\d{10,15}$/`
  before string concatenation. The `<encoded>` MUST be `encodeURIComponent`d.
  Failure mode without this: a party with `phone = '999\n\nGET /admin?x=1'`
  produces a wa.me URL that, when the front-end's `window.open()` is
  called on a misconfigured Capacitor browser, could navigate the OS to
  an attacker URL. Low real-world risk, but the encode is one line and
  belongs in code.
- **Statement PDF XSS:** React-PDF auto-escapes Text nodes. Confirm
  `StatementPDF.tsx` uses `<Text>` for every party / invoice / amount
  field and never `dangerouslySetInnerHTML` (React-PDF doesn't support it
  but a future migration to a different renderer could regress). Test
  vector: party name `'<img src=x onerror=alert(1)>'` renders as the
  literal string in the PDF. Match the GST audit's GSTIN test vector
  precedent.
- **PTP notes injection:** stored as VarChar(500). When rendered in the
  UI, must pass through React's default escaping (i.e., never
  `dangerouslySetInnerHTML`). The Statement PDF includes PTP rows in
  P2 — same rule.

### A04 — Insecure Design

- **Payment link amount tampering (MB-5):** PRD §10 says "Server re-reads
  `Document.balanceDue` at payment-link creation time; does not trust
  client-provided amount." Architecture §5c allows `amountPaise?` in the
  create body. Required design clarification: server accepts client
  `amountPaise` ONLY if it is `> 0` AND `<= invoice.outstandingAmount`
  (re-read inside the same transaction). If absent, default to full
  outstanding. If present and exceeds outstanding → 400
  AMOUNT_EXCEEDS_OUTSTANDING. Without this, a buggy or malicious client
  could create a Rs 99,99,999 link for a Rs 10,000 invoice; the customer
  pays it; webhook fires; we record an over-payment. Razorpay won't
  intervene — they trust our `amountPaise`.
- **Idempotency on bulk reminder bypass (MB-6):** architecture §5b says
  bulk reminder server pre-records each `ReminderLog` as QUEUED so
  retries are safe. Required: the `Idempotency-Key` on
  `POST /reminders/bulk` MUST cause the SECOND call with the same key to
  return the first call's response WITHOUT creating duplicate
  ReminderLog rows. Without idempotency, a flaky 3G connection that
  retries an HTTP 200 = customer gets two WhatsApp pop-ups.
- **PaymentLink for a fully-paid invoice:** create endpoint must 409 if
  `invoice.outstandingAmount === 0` (already in §5c spec). Defensive
  check at link-create time; defensive check again in webhook handler
  (skip if invoice already paid AND link is the duplicate route).
- **Soft-deleted invoice with active PaymentLink:** architecture §17 risk
  6 — `services/document/delete.ts` hook cancels active links + Razorpay
  revoke (best-effort). Confirm hook runs INSIDE the soft-delete tx. If
  Razorpay revoke fails, link still flips to CANCELLED locally; the
  webhook quarantine path catches any inbound payment.
- **PTP immutability:** architecture §12a says `KEPT/BROKEN/CANCELLED`
  are terminal. Code: `update.service.ts` MUST 409 on any state-change
  attempt that violates the state machine. Audit trail: PTP row updates
  trigger `AuditLog` writes for every state transition with `before`/`after`.
- **Bulk reminder party-recipient mismap:** see MB-3.
- **WhatsApp recipient phone validation:** server MUST validate every
  `Party.phone` is E.164 normalised before generating wa.me. Reject (per
  party in the bulk batch result) with `PHONE_INVALID` if not. Architecture
  §13 says this is a server concern but doesn't pin the regex.

### A05 — Security Misconfiguration

- Helmet.js confirmed mounted on existing express app — verify
  `/api/collections/*` mounts under it (default if added to the same
  `app.use('/api', ...)`).
- CORS origin: existing allowlist (`hisaabpro.in`, `app.hisaabpro.in`,
  `localhost`). Verify `*` is NOT introduced when adding new routes.
  Document on the PR.
- Webhook route `/api/webhooks/razorpay` MUST NOT be CORS-enabled — it
  is server-to-server. Confirm existing config excludes it.
- Stack traces: existing error middleware strips stack in production.
  Verify `collections.errors.ts` mapper does not bypass it. Razorpay
  error bodies MUST be passed through a `sanitizeRazorpayError()` helper
  that strips `Server`, `X-Powered-By`, internal request IDs before user
  echo.
- Razorpay key_secret MUST NOT be `.env.example`d with a real value —
  commit a redacted placeholder only.
- Cron jobs run with the same Node process as the API; they have
  database creds with the same read/write scope. Document in the cron
  README that they are NOT user-facing endpoints and have NO CSRF
  exemption needed (they don't accept HTTP).

### A06 — Vulnerable Components

- No new top-level dependencies proposed in the architecture (Razorpay
  SDK already present; React-PDF already present; BullMQ already
  present). If a PR adds a new package — e.g., a wa.me URL builder lib
  or a phone-number normaliser — run `supply-chain-risk-auditor` skill
  before merge.

### A07 — Identification & Authentication

- All new routes session-gated by existing middleware. No new auth flow.
- The new `collections` permission module is the right place to enforce
  least-privilege. Defaults per architecture §10 are correct: `salesman`
  has `view + remind + ptp`, NOT `collect` (cannot create payment
  links). `viewer` has only `view`. Confirm in PR diff that
  `requirePermission('collections.collect')` is mounted on
  `POST /payment-links`, `POST /payment-links/:id/cancel`, `POST /payment-links/:id/resend`.
- No public unauthenticated routes are introduced — Razorpay shortUrl
  IS public but it's hosted on Razorpay, not us.

### A08 — Software & Data Integrity

- **Webhook replay (MB-1):** dedupe on `WebhookEvent(eventId, razorpayLinkId)`.
  Existing `WebhookEvent` audit table is reused (architecture §6e). Code:
  handler MUST `INSERT INTO WebhookEvent (eventId, ...) ON CONFLICT DO
  NOTHING RETURNING id`; if the insert returned 0 rows, exit 200 without
  doing any further work. This must happen BEFORE the Payment row insert,
  not after. Without this ordering, a transient DB error between the
  Payment insert and the WebhookEvent insert allows duplicate Payment
  rows on the next replay.
- **Webhook tenant trust (MB-2):** the webhook payload includes
  `notes.businessId` (we set it at link-create per §6b). The handler
  MUST NOT use `notes.businessId` for any DB write. It MUST resolve
  `businessId` by looking up the local PaymentLink row by
  `razorpayLinkId`. The `notes` field is signed by the webhook payload
  HMAC, but Razorpay also lets the merchant re-set notes via API — so
  treat it as untrusted in the handler. Use the local PaymentLink row
  as the ONLY source of truth for `businessId`, `invoiceId`, `partyId`.
- **PaymentLink amount snapshot:** `PaymentLink.amountPaise` is captured
  at create time. The webhook reports the actual paid paise; if it
  differs from captured (partial pay, re-issued link), record the
  webhook's value as the `Payment.amount`, not the PaymentLink's
  captured amount.
- **Migration is additive:** 4 new tables + 4 enums + 1 partial index.
  Per architecture §2, single transactional migration. No backfill. Per
  PR description, prod uses `CREATE INDEX CONCURRENTLY` for the partial
  index — DBA gate.
- **PTP `keptAt` / `brokenAt` immutability (MB-8):** once `status` is
  KEPT or BROKEN, the corresponding `*At` field MUST NOT be UPDATEable.
  Enforced by service-layer state machine + a Postgres CHECK constraint
  is overkill (state machine in `update.service.ts` is sufficient given
  AuditLog covers forensic needs). AuditLog rows for transitions are
  append-only (no `updatedAt` on AuditLog).

### A09 — Security Logging & Monitoring Failures

- All collection mutating actions write `AuditLog` rows. Coverage
  required (cross-checked vs §16b):
  - PaymentLink: CREATE, CANCEL, EXPIRE (cron), PAID (webhook),
    PARTIALLY_PAID (webhook).
  - PromiseToPay: CREATE, UPDATE, CANCEL, EVALUATOR_FLIP_KEPT,
    EVALUATOR_FLIP_BROKEN.
  - Reminder: DISPATCH (single + bulk batch — one row per
    ReminderLog created).
  - Statement: SHARED.
- Winston logger only — `console.log` blocked by `enforce.js` ratchet.
- **PII masking in logs (mandatory):** `ReminderLog.recipientPhone`,
  `Party.phone`, `Party.gstin`, `Razorpay shortUrl`, `Statement
  pre-signed URL` — all masked in stdout / Winston JSON. Mask:
  - phone: `+91XXXXX1234` (suffix-4)
  - GSTIN: `XX...XXXXX1Z5` (suffix-4)
  - shortUrl: `rzp.io/i/XXX...XXX` (last 3 chars only)
  - statement URL: `s3://.../XXX...pdf` (bucket + extension only)
- **AuditLog content:** PaymentLink create row has `{ amountPaise,
  shortUrl: 'rzp.io/i/XXX...XXX', expireBy }` — full shortUrl is in the
  PaymentLink row already; duplicating it into AuditLog enlarges leak
  surface for nothing. Same logic as the GST audit's GSTIN-masking
  precedent (MB-4 there).
- **Webhook failures:** failed signature → 400 + `AuditLog` row with
  `action: 'WEBHOOK_REJECTED'`, `entityType: 'webhook'`, `changes: { reason: 'BAD_SIGNATURE', sourceIp }`.
  Sustained rejection spike (e.g., > 10/min) triggers a Sentry alert.
- **AuditLog append-only:** no `updatedAt` column, no UPDATE/DELETE
  paths in code. Confirm in current `schema.prisma`. Index
  `(businessId, createdAt DESC)` — confirm exists for the
  `/settings/activity` page; the new collections volume makes this
  index meaningful.
- **PTP notes:** logged to AuditLog `changes.before/after` — these
  contain user-typed text. Strip control characters; cap to first 200
  chars in the audit log copy (full text remains on the PTP row).

### A10 — SSRF

- Razorpay outbound calls go through `services/razorpay/` with hardcoded
  base URL `https://api.razorpay.com/v1/payment_links`. URL MUST come
  from a const, not env, not user input.
- `axios` / `got` config: `maxRedirects: 0` on Razorpay HTTP client.
- Statement URL upload: client uploads PDF blob to `POST /storage/statements`,
  which is a HisaabPro endpoint that puts to S3. Server-side: never accept
  a URL from the client to "fetch and store" — only accept multipart/form-data
  bytes. The pre-signed URL returned to the client points only to our
  bucket; cross-bucket redirect impossible since we set the URL.
- The `notify.email` field on Razorpay create — we hard-code `false`
  per architecture §6b — confirm in code that we never pass user-supplied
  email here; if we ever do, validate it's the party's stored email and
  not a free-text input.

---

## 4. Per-Surface Threats T1..T12

| # | Threat | Severity | Surface | Scenario | Mitigation | Test |
|---|---|---|---|---|---|---|
| T1 | Razorpay webhook spoof — attacker mints fake payment | **CRITICAL** | `POST /api/webhooks/razorpay` | Attacker POSTs a forged `payment_link.paid` payload to our webhook URL; if signature check is missing or weak, we insert a `Payment` row, drop `Document.balanceDue`, and close out the invoice without real money | HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET) verified BEFORE any handler logic; `timingSafeEqual` for compare; failed sig → 400 + AuditLog | curl POST with bad `X-Razorpay-Signature` → 400; curl POST with stripped header → 400; no Payment row created |
| T2 | Webhook replay — duplicate Payment rows | **CRITICAL** | webhook | Replay a captured-from-logs valid webhook payload; without dedupe, we credit twice | `WebhookEvent.eventId` unique constraint; INSERT ON CONFLICT DO NOTHING BEFORE Payment insert | replay same payload twice → 200 both times, exactly one Payment row exists |
| T3 | Cross-tenant webhook trust | **CRITICAL** | webhook | Attacker (or future bug) crafts `notes.businessId = <other>` on a real link; handler trusts notes; payment lands on wrong tenant | Resolve `businessId` from local PaymentLink row by `razorpayLinkId`; NEVER read `notes.businessId` for writes | unit test: webhook with `notes.businessId = 'ATTACKER'` for a tenant-A link → Payment created on tenant-A only |
| T4 | PaymentLink amount tampering | **HIGH** | `POST /payment-links` | Client sends `amountPaise: 99999999` for an invoice with `outstanding=10000`; link created at inflated amount; customer overpays | Server re-reads `Document.outstandingAmount` in same tx; reject if `amountPaise > outstanding` | curl with inflated amount → 400 AMOUNT_EXCEEDS_OUTSTANDING |
| T5 | Cross-tenant PaymentLink read | **HIGH** | `GET /payment-links/:id` | Tenant-A user requests tenant-B's link id (cuid is hard but enumerable in logs) | `findFirst({ where: { id, businessId } })`; 404 not 403 | curl tenant-A token requesting tenant-B link → 404 |
| T6 | Cross-tenant PTP create | **HIGH** | `POST /collections/ptp` | Body `{ partyId: <tenantB> }` from tenant-A token; PTP row created against wrong party | Validate party.businessId === req.user.businessId; 404 PARTY_NOT_FOUND | curl with cross-tenant partyId → 404 |
| T7 | Bulk reminder PII mismap | **HIGH** | `POST /reminders/bulk` | Server resolves `{{paymentLinkUrl}}` for invoice X but renders into party Y's message; party Y receives party X's payment link | Server resolves tokens per-row from validated `(partyId, invoiceId)` pair; per-row preview drawer in client; snapshot tests on `templates.render()` | unit test: bulk batch with 3 mismatched (partyId, invoiceId) → 400 BATCH_VALIDATION_FAILED before any dispatch |
| T8 | Bulk-send abuse — weaponise HP for spam | **HIGH** | `POST /reminders/bulk` | User runs bulk reminder 100 times in 5 minutes targeting same parties; HP becomes a spam vector; user's own WhatsApp number gets banned | Rate limit 5/min/user; batch cap 50/call; per-business per-day cap of 500 dispatched ReminderLog rows; "WhatsApp may rate-limit you" warning at bulk size > 20 | curl 6 bulk calls in 60s → 6th returns 429; create 501 reminders in a day → 501st returns 429 DAILY_LIMIT |
| T9 | Statement URL leak via WhatsApp forward | **MEDIUM** | `POST /statements/:partyId/share` | Customer forwards statement WhatsApp message to a public group; URL is bearer; anyone with URL sees full transaction history for 7 days | Default TTL 24h (not 7d); MB-6 lowers default; UI warns "this link is shareable for 24h"; per-statement revoke endpoint; future: tokenized URL with one-time-use option | curl GET pre-signed URL after 24h → 403; revoke endpoint flips `expiresAt` to now |
| T10 | Cron evaluator scoping bug | **HIGH** | `ptp-evaluator` cron | Cron iterates businesses; due to closure bug or shared transaction, a tenant-B PTP flips inside tenant-A's iteration; AuditLog records wrong actor | Cron executes one transaction per business; explicit `businessId` argument to every service call; `actorId: 'cron:ptp-evaluator'` in AuditLog (NOT a real user); per-business try/catch | unit test: cron run with 2 businesses each having 1 PTP → 2 AuditLog rows, each with correct businessId |
| T11 | PTP mark-as-KEPT abuse via permission gap | **MEDIUM** | `POST /payments` (existing) → hook to `markPtpKept` | Cashier with `payments.write` but without `collections.ptp` records a Rs 1 payment to mark a Rs 1L PTP as KEPT | The hook in `payment/create.ts` calls `markPtpKept` on behalf of the system, not the user — so the permission check should be on the surface (whether user can record that payment), not on the PTP transition. Audit row records `triggerSource: 'payment.create:<paymentId>'` so abuse is forensically visible. NOTE: payment recorded must be ≥ PTP amount for auto-flip — partial payments stay OPEN per PRD §9 row "Broken PTP when partial payment was made" | unit: record payment of Rs 999 against Rs 1000 PTP → PTP stays OPEN; record Rs 1000 → PTP flips KEPT |
| T12 | Cancelled payment link still receives webhook payment | **MEDIUM** | webhook for CANCELLED link | User cancels link locally; Razorpay revoke fails silently; customer pays before Razorpay processes the cancel; webhook arrives for a CANCELLED local row | Architecture §17 risk 6 mitigation: webhook handler routes payment-on-cancelled-link to a quarantine handler that creates `Payment` with `notes: 'Pre-cancelled link payment — review'` and emits a Sentry alert. Money is recorded (we have it), but flagged for ops review | unit: webhook for link in CANCELLED state → Payment created with quarantine flag, AuditLog row with `severity: 'WARN'` |

---

## 5. Idempotency & Replay

| Route | Idempotency required | Underlying DB unique |
|---|---|---|
| `POST /payment-links` | yes (header + `(invoiceId, ACTIVE)` constraint) | `PaymentLink.createIdempotencyKey @unique` + `(invoiceId, status=ACTIVE)` returns existing |
| `POST /payment-links/:id/cancel` | yes | status guard (CANCELLED → 409) |
| `POST /payment-links/:id/resend` | yes (header) | no DB write — read-only |
| `POST /reminders` | yes (header) | one ReminderLog row per (idempotencyKey) |
| `POST /reminders/bulk` | yes (header) | one batch per (idempotencyKey); replays return cached batch result |
| `POST /reminders/:id/dispatched` | natural — status transition QUEUED → DISPATCHED is one-way |
| `POST /ptp` | yes (header) + `(partyId, promiseDate, amountPaise) clientId @unique` | offline queue uses `clientId` |
| `PATCH /ptp/:id` | natural — state machine 409 on illegal transitions |
| `POST /ptp/:id/cancel` | natural — status guard |
| `POST /statements/:partyId/share` | yes (header) — repeat share returns same wa.me URL |
| **Webhook** | dedupe on `WebhookEvent(eventId)` — see MB-1 |

`Idempotency-Key` header missing on a mutating POST → 400
`IDEMPOTENCY_KEY_REQUIRED` (consistent with HP-wide `requireIdempotency`
middleware). Replay within cache TTL (24h) returns cached response
without re-invoking the handler.

---

## 6. Rate Limiting

Per architecture §16c plus additions:

| Endpoint | Limit | Scope | Notes |
|---|---|---|---|
| GET reads (collections.*) | 60 req/min | per user | existing read tier |
| POST `/reminders` (single) | 30 req/min | per user | |
| POST `/reminders/bulk` | 5 req/min, 50 items/call | per user | also: per-business per-day 500 dispatched ReminderLog rows (NEW — see T8 / MB-not-blocker but recommended) |
| POST `/payment-links` | 10 req/min | per user | Razorpay merchant quota is 5000/day — enforce 200/day per business (NEW — recommended) |
| POST `/payment-links/:id/cancel` | 10 req/min | per user | |
| POST `/ptp` | 30 req/min | per user | |
| POST `/statements/*/share` | 10 req/min | per user | |
| POST `/api/webhooks/razorpay` | 100 req/min | per source IP (Razorpay's IPs) | spike detector triggers Sentry |

Rate limit by `userId` for user actions, by `businessId` for daily-cap
enforcement. Webhook is by source IP. Architecture mandates this; verify
in PR that `rate-limit.middleware.ts` keys are correct.

---

## 7. Audit Log Requirements

Required actions (additive to existing AuditLog model):

| `action` | `entityType` | `changes` (masked fields noted) |
|---|---|---|
| `PAYMENT_LINK_CREATED` | `paymentLink` | `{ invoiceId, amountPaise, expireBy, shortUrl: 'rzp.io/i/XXX...XXX' }` |
| `PAYMENT_LINK_CANCELLED` | `paymentLink` | `{ id, reason }` |
| `PAYMENT_LINK_PAID` | `paymentLink` | `{ id, paidAmountPaise, razorpayPaymentId }` (system actor) |
| `PAYMENT_LINK_EXPIRED` | `paymentLink` | `{ id }` (cron actor) |
| `PTP_CREATED` | `promiseToPay` | `{ partyId, amountPaise, promiseDate, notes: <first 200 chars> }` |
| `PTP_UPDATED` | `promiseToPay` | `{ before, after }` for changed fields |
| `PTP_CANCELLED` | `promiseToPay` | `{ id, reason }` |
| `PTP_FLIPPED_KEPT` | `promiseToPay` | `{ id, satisfyingPaymentIds }` (system or cron actor) |
| `PTP_FLIPPED_BROKEN` | `promiseToPay` | `{ id }` (cron actor) |
| `REMINDER_DISPATCHED` | `reminderLog` | `{ partyId, channel, templateKey, recipientPhone: '+91XXXXX1234' }` |
| `STATEMENT_SHARED` | `statement` | `{ partyId, channel, fromDate, toDate, statementUrl: 's3://.../XXX...pdf' }` |
| `WEBHOOK_REJECTED` | `webhook` | `{ reason, sourceIp, payloadHash }` (no businessId — pre-auth) |
| `WEBHOOK_QUARANTINE` | `paymentLink` | `{ id, reason: 'PRE_CANCELLED_LINK_PAID', razorpayPaymentId }` |

**Append-only** (matches GST audit MB-4): no `updatedAt`, no UPDATE in
code paths. Index `(businessId, createdAt DESC)` confirmed needed.

**Actor field:** AuditLog already has `userId` (existing). For cron writes,
populate `userId = NULL` AND a new `systemActor` text column (`'cron:ptp-evaluator'`,
`'cron:expire-payment-links'`, `'webhook:razorpay'`). If `systemActor`
column doesn't exist on the existing AuditLog model, this is an additive
migration in the same payments-hub migration.

**Retention:** indefinite (matches GST 6-year legal requirement). No
purge job in MVP.

---

## 8. PII Handling per Indian DPDP Act

The DPDP Act (Digital Personal Data Protection Act, 2023) places HP in
the role of **Data Fiduciary** for the businesses' customer lists. The
businesses are themselves Data Fiduciaries for their customers; HP is a
**Data Processor** acting on the business's instruction. Concrete
implications for the Payments Hub:

| DPDP requirement | Implementation |
|---|---|
| Purpose limitation: PII used only for the agreed purpose | Party phone + name used only for: invoicing (existing), reminders (this epic), statement share (this epic). Never re-shared, never sold. |
| Data minimisation in logs | All Winston log lines for collections code redact phone, GSTIN, shortUrl, statement URL per §3 A09 |
| Storage limitation | `ReminderLog.recipientPhone` stored — required for "what was sent to whom" forensics. Retained per business retention policy (matches AuditLog). |
| Erasure on request | When a party is hard-deleted (currently soft-delete only), reminder + PTP + payment-link rows have `partyId` set to NULL via `onDelete: SetNull` — but architecture uses `Restrict` here. **Recommendation:** Phase 2 builds a "Forget Party" admin path that anonymises `Party.name → 'DELETED'`, `Party.phone → NULL` while keeping the statistical rows for the business's own books. |
| Breach notification | Existing security incident runbook covers this; no Payments-Hub-specific change. |
| Cross-border transfer | Razorpay is India-based; AWS S3 region is ap-south-1 (Mumbai); WhatsApp is the user's own app — HP doesn't ship messages to Meta directly. No cross-border transfer of party PII. |

**No new PII categories** are introduced beyond what HP already stores
(name, phone, GSTIN, transaction history). The Payments Hub increases
the **frequency of access** and the **outbound surface** (WhatsApp
messages, statement URLs) — which is exactly why the masking +
short-TTL + revoke gates above are mandatory.

---

## 9. Razorpay PCI Scope

**Confirmed: HP NEVER touches card data.**

- We use Razorpay **Standard Payment Links** — Razorpay hosts the
  payment page. Cards / UPI / netbanking entered on Razorpay's domain.
- We never see card numbers, CVVs, or UPI PINs. We see only:
  - the `shortUrl` (Razorpay-issued bearer URL)
  - the webhook event with `razorpay_payment_id` (a tokenized handle)
  - `payment.method` (e.g., `'upi'`, `'card'`) — a category, not card data
- **Our PCI scope: SAQ A** (merchant outsources cardholder data
  environment to a PCI-compliant service provider, Razorpay).
- We MUST NOT add a flow that posts card data through our servers (e.g.,
  a custom checkout overlay). This is non-negotiable. If a future PR
  proposes Razorpay Checkout overlay JS — that's still SAQ A so long as
  the iframe is hosted by Razorpay; verify before approving.
- The `payment.method = 'upi'` payload may include `vpa` (UPI ID) —
  that IS PII (the customer's UPI handle). Do NOT log it; do NOT show it
  in cross-business contexts. Store on `Payment.referenceNumber` only,
  and surface only on the invoice's payment detail.

---

## 10. Background Jobs — Authorization

Per architecture §8, two new cron jobs:

### `ptp-evaluator` (daily, 01:00 IST)

- **No HTTP layer**, no `req.user`. Runs as the Node process.
- **Per-business iteration:** outer loop `for (const businessId of allBusinesses)`. Each iteration calls `evaluateOpenPtps(businessId, asOf)` in its own try/catch + transaction.
- **AuditLog actor:** `userId = NULL`, `systemActor = 'cron:ptp-evaluator'`.
- **Authorization check:** none — the cron is trusted code. Defence is
  that the function takes `businessId` as the first arg and every Prisma
  call is scoped to it. A bug that omits the scope is a tenant-leak
  bug, not an auth bug.
- **Idempotency:** flipping OPEN → KEPT or OPEN → BROKEN is a no-op if
  re-run (the state machine 409s on already-terminal states). Cron can
  safely re-run on the same day.

### `payment-link-expiry-sweeper` (every 15 min)

- Same context. Iterates by `(expireBy, status=ACTIVE)` index — no
  per-business loop needed (the index is global), but each row's
  `businessId` is read from the row, not from any external source.
- Best-effort Razorpay revoke: on 4xx from Razorpay, log + AuditLog,
  continue.
- AuditLog actor: `'cron:expire-payment-links'`.

### `markPtpKept` hook (in `payment/create.ts`)

- Runs in the user's request context (not cron) but on behalf of the
  system, not the user. Per T11, the hook does NOT require
  `collections.ptp` permission — it's a side-effect of recording a
  payment, which already requires `payments.write`.
- AuditLog row records `systemActor = 'hook:payment.create'` AND
  `userId = req.user.id` (so we know which user triggered the chain).

---

## 11. Open Questions for Security Owner

| # | Question | Default | Owner |
|---|---|---|---|
| OQ-S1 | Should we expose a "Revoke Statement URL" admin action so users can kill a leaked link before TTL? | **Yes** — add a button on the per-party reminder history row | Sawan |
| OQ-S2 | Statement pre-signed URL TTL — 7 days (current architecture) vs 24 hours (this audit's recommendation, MB-6) | **24 hours** default; user-overrideable up to 7 days | Sawan |
| OQ-S3 | Per-business per-day cap on bulk reminders to prevent HP from being weaponised for spam — proposed 500 dispatched ReminderLog rows / day / business | **500/day**, configurable per plan tier in P2 | Sawan |
| OQ-S4 | Per-business per-day cap on payment-link create — proposed 200/day | **200/day**, raises to plan limits | Sawan |
| OQ-S5 | Should the WhatsApp message body include the Razorpay shortUrl, or should we use our own URL shortener that supports per-message tracking? | MVP: ship Razorpay shortUrl; P2 evaluate own shortener for analytics + revocation | Sawan |
| OQ-S6 | Webhook source-IP allowlist — Razorpay publishes its outbound IP ranges. Should the route reject non-Razorpay IPs? | **Yes** — defence in depth alongside HMAC; reject non-allowlisted IPs at the route level (pre-handler) | Ops |
| OQ-S7 | DPDP "Forget Party" implementation — when a party is deleted, what happens to their ReminderLog / PTP / PaymentLink history? | MVP: soft-delete only; P2: anonymise on hard-delete (replace name → 'DELETED', phone → NULL, retain rows for HP business books) | Sawan + legal |
| OQ-S8 | Should `notes` on PTP support markdown/links? Current spec is plain text 500 chars | **Plain text only**; XSS-safe; no link parsing | Sawan |

---

## 12. Code-Level Merge Checklist (per PR)

Each of the ~6–8 implementation PRs must show in PR description:

- [ ] Idempotency-Key middleware mounted on every new POST mutating route
- [ ] Per-user rate limit configured for every new mutating route
- [ ] No Razorpay creds in code — `grep -rn 'rzp_\\|RAZORPAY_' server/src --include='*.ts' | grep -v env.ts | grep -v razorpay/client.ts` returns 0 hits
- [ ] Every Prisma call passes `businessId` in `where` (or wraps a businessId-scoped service helper)
- [ ] AuditLog write present in every mutating handler — match list in §7
- [ ] Cross-tenant access tests in `__tests__/access.test.ts` for at least: payment-link GET, ptp GET, statement GET, bulk-reminder POST
- [ ] Webhook signature verification test passes; webhook-replay test passes
- [ ] No `console.log` (Winston only) — verified by enforce.js
- [ ] No `dangerouslySetInnerHTML` introduced in template / PDF files
- [ ] `OFFLINE_REQUIRED` precheck on `POST /payment-links` (client side)
- [ ] All `api()` mutations pass `entityType` and `entityLabel` per HP offline rule
- [ ] Recipient phone, shortUrl, statement URL masked in Winston log lines (regex test in `__tests__/log-redact.test.ts`)
- [ ] Razorpay HTTP client config has `maxRedirects: 0`
- [ ] `notify.email` and `notify.sms` to Razorpay hard-coded `false` at create call site (we own the channel)

---

## TOP 8 MERGE-BLOCKERS — must resolve before merge to `master`

**MB-1 (CRITICAL — A08 / A04) — Webhook replay protection.**
Architecture §6e mentions dedupe on `WebhookEvent(eventId)` but does NOT
specify the ordering. **Required:** in
`payment-links/webhook.handler.ts`, the FIRST DB operation MUST be
`prisma.webhookEvent.create({ data: { eventId, ... } })` wrapped to
`P2002 → return 200 (no-op)`. Only AFTER that succeeds may the handler
read the PaymentLink and write the Payment row. The whole sequence
runs in ONE transaction so a crash between the WebhookEvent insert and
the Payment insert rolls both back, leaving the webhook re-deliverable.
Without this ordering, a transient DB error allows the same webhook to
double-credit on the next Razorpay redelivery (Razorpay retries up to
24h on non-2xx).

**MB-2 (CRITICAL — A01 / A08) — Webhook tenant trust.** Architecture
§6c says "Idempotent on `(razorpayLinkId, eventId)`" but does NOT
state where `businessId` comes from. **Required:** the webhook handler
MUST resolve `businessId`, `invoiceId`, `partyId` from the local
`PaymentLink` row keyed by `razorpayLinkId`. It MUST NOT read any
`notes.businessId` or `notes.invoiceId` from the Razorpay payload for
DB writes. The `notes` object is set by us at create time, but
Razorpay's API allows the merchant (us, in the future, or a
compromised process) to PATCH notes — so it is untrusted at handler
time. Without this, a future bug or compromise that manipulates `notes`
silently writes Payments to the wrong tenant. Add a unit test:
`webhook with notes.businessId = 'OTHER' for a tenant-A link → Payment
created on tenant-A only`.

**MB-3 (HIGH — A03) — Template token injection in custom messages.**
Architecture §16a says "user custom message is escaped + appended after
template rendering, never inside it." **Required:** code-level: the
`templates.ts:render()` function takes ONLY the static template string
from `REMINDER_TEMPLATES` registry. The user-supplied
`customMessage` field (per-call optional) is concatenated AFTER
`render()` returns and is NEVER passed back into a render pass. Add a
test: `customMessage = '\n{{paymentLinkUrl}}'` → output contains the
literal `{{paymentLinkUrl}}` characters. Without this, a malicious user
embeds another invoice's token in their message; the next render pass
(if anyone ever adds caching/rerender for the bulk path) substitutes
the wrong URL into the wrong party's message.

**MB-4 (HIGH — A03 / A04) — wa.me URL building safety.** Architecture
§7 specifies `wa.me/<phone>?text=<urlencoded>` but doesn't pin
phone-validation. **Required:** `waOpen.ts` MUST build the URL via:
1. Normalise `phone` to E.164 digits-only with regex `/^\d{10,15}$/`
   — reject otherwise with `PHONE_INVALID`. 2. `encodeURIComponent`
the message body. 3. Construct URL by template-literal with the two
validated parts. NEVER concatenate an unvalidated phone string into the
URL. Add tests for: phone with newline, phone with `?` injection,
message with already-encoded sequences (must double-encode), recipient
name `<img src=x onerror=alert(1)>` round-trips as encoded text.

**MB-5 (HIGH — A04) — PaymentLink amount tampering.** Architecture §5c
allows `amountPaise?` in the create body. PRD §10 says "Server re-reads
balanceDue at creation time." **Required:** server MUST re-read
`Document.outstandingAmount` inside the same transaction as the Razorpay
create call. If client sent `amountPaise > outstanding` → 400
AMOUNT_EXCEEDS_OUTSTANDING. If `amountPaise <= 0` → 400
AMOUNT_INVALID. If `amountPaise` is omitted → default to full
outstanding. Add curl proof: invoice with outstanding=10000, POST with
`amountPaise=99999999` → 400. Without this gate, a bug or malicious
user creates an inflated link and the customer overpays.

**MB-6 (HIGH — A04 / DPDP) — Statement pre-signed URL TTL + revocability.**
Architecture §16a says TTL 7 days. **Required:** default TTL is 24 hours
(not 7 days). User may override up to 7 days at share time. The share
drawer's UI MUST surface "This link is shareable for X hours — anyone
with the link can see this statement." Additionally, a `DELETE
/api/storage/statements/:id` endpoint MUST exist that revokes the URL
immediately (move object to a deny-listed prefix or rotate object key).
Without this, a customer who forwards the message to a public WhatsApp
group leaks the statement for a full week with no recourse.

**MB-7 (HIGH — A09 / A01) — Cron AuditLog actor + per-business
iteration.** Architecture §8 says cron jobs run as system. **Required:**
1. AuditLog model gains a `systemActor String?` column in the same
   payments-hub migration (additive, nullable, default NULL). 2. Every
write from a cron MUST set `userId = NULL` AND `systemActor = 'cron:<job>'`.
3. The `ptp-evaluator` outer loop is `for (const businessId of allActiveBusinesses)`
with each iteration in its own try/catch + transaction, passing
`businessId` as the first argument to every service call. Without
explicit per-business iteration, a bug in shared state (e.g., a cached
prisma connection bound to wrong tenant context) becomes a tenant-leak
audit row that's hard to reverse-engineer.

**MB-8 (MEDIUM — A08) — PTP terminal-state immutability.** Architecture
§12a marks KEPT/BROKEN/CANCELLED as terminal. **Required:** code-level:
`promise-to-pay/update.service.ts` MUST 409 on ANY field change to a
PTP whose `status !== 'OPEN'`. This includes `notes` edits and
`promiseDate` edits — once a PTP is BROKEN it is forensic evidence and
is locked. AuditLog rows for PTPs are append-only. The UI helps by
greying-out the edit affordance, but the server is the source of
truth. Add curl proofs: PATCH on KEPT PTP → 409 PTP_NOT_EDITABLE;
DELETE on BROKEN PTP → 409 PTP_NOT_DELETABLE.

---

**Verdict: APPROVED** subject to MB-1 through MB-8 being implemented in
the build PRs with the curl proofs attached to each PR description.

— security agent, 2026-05-05
