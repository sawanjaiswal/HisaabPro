---
status: approved
feature: gst-phase-2
created: 2026-05-03T18:16:35Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/lib/env.ts
  - server/src/config/secrets.nic.ts
  - server/src/services/einvoice/einvoice.service.ts
  - server/src/services/ewaybill/ewaybill.service.ts
agents_invoked:
  - scope-writer (output: docs/SCOPE_gst_phase_2.md)
  - architect (output: docs/ARCHITECTURE_gst_phase_2.md)
  - security (output: docs/SECURITY_AUDIT_gst_phase_2.md)
acceptance:
  backend:
    - "curl unauth POST /api/einvoice/generate -> 401 UNAUTHORIZED (no body leak)"
    - "curl tenant-A user issuing IRN cancel for tenant-B invoice -> 404 (not 403, no existence oracle)"
    - "curl tenant-A GET /api/gst/returns/GSTR1/2026-04?businessId=tenantB -> 403 BUSINESS_SCOPE_VIOLATION"
    - "curl POST /api/gst/backfill/execute replayed with same Idempotency-Key -> second call returns cached result, no double AuditLog row"
    - "curl POST /api/einvoice/generate replayed with same Idempotency-Key within 24h -> 200 returning prior IRN, no second NIC call"
    - "curl POST /api/einvoice/generate * 1001 within 24h for same business -> 429 EINVOICE_QUOTA_EXCEEDED on req 1001 (soft warn at 950)"
    - "curl POST /api/einvoice/generate at 11 req/s for one business -> 429 RATE_LIMITED (express-rate-limit)"
    - "curl PATCH /api/gst/settings { gstin: '<script>' } -> 400 GSTIN_FORMAT_INVALID, no echo of payload in response"
    - "curl POST /api/gst/returns/GSTR1/2026-04/export forcing different businessId in body vs cookie -> 403"
    - "NIC password never appears in any /api/health/* response, error.stack, or AuditLog.changes"
    - "AuditLog.changes for GST_SETTINGS_UPDATE shows masked GSTIN suffix only (XX...XXXXX1Z5), full GSTIN never stored in AuditLog"
    - "tsc clean; no `process.env.NIC_*` references outside server/src/config/secrets.nic.ts"
    - "grep -r 'NIC_IRP_PASSWORD\\|NIC_EWB_PASSWORD' server/ excluding env.ts/secrets.nic.ts -> 0 hits"
    - "grep -rn 'console\\.\\(log\\|error\\)' server/src/services/einvoice server/src/services/ewaybill -> 0 hits (Winston only)"
    - "Helmet.js mounted; CORS origin allowlist confirmed not '*' for /api/einvoice/* and /api/ewaybill/*"
    - "Server-side check: NIC IRP request rejects if envelope.SellerDtls.Gstin !== business.gstin (anti cross-tenant IRN issuance)"
  frontend:
    - "screenshots: NIC sandbox 401/down -> generic 'NIC service unavailable' toast (no raw NIC error body, no stack)"
    - "screenshots: NIC validation 422 -> field-level toast surfaces NIC error code, NOT NIC raw HTML"
    - "no NIC token, NIC username, or NIC password ever present in window.* / localStorage / sessionStorage / IndexedDB on any GST screen"
    - "GSTIN displayed in templates passes through encodeForHtml (XSS test: GSTIN '<img src=x onerror=alert(1)>' rendered as text, alert never fires)"
    - "Offline -> /api/einvoice/generate, /api/ewaybill/generate, GSTR export all show 'Connect to internet' toast (verified via OFFLINE_REQUIRED throw)"
    - "GST settings page: gstin input has maxlength=15, server-side regex re-validates"
---

# Security Audit — GST Phase 2 (v7)

**Verdict:** APPROVED with 5 merge-blockers (must be resolved in implementation PRs 8 and 9 before merge to `master`). Architecture is sound; the blockers are concrete code-level requirements that the architecture document already gestures at but does not nail down.

Scope reviewed: `docs/SCOPE_gst_phase_2.md` (1,171 lines) + `docs/ARCHITECTURE_gst_phase_2.md` (764 lines) + `server/prisma/schema.prisma` (existing models EInvoice, EWayBill, GstReturn, AuditLog, Business). No code yet exists for the e-invoice / e-way-bill / GSTR services — this audit pre-empts the build.

---

## 1. OWASP Top 10 — scoped to v7 GST surface

### A01 — Broken Access Control

**Threat surface:** every new endpoint touches `Document` / `Business` / `EInvoice` / `EWayBill` / `GstReturn`. A bug that omits `where: { businessId: req.user.businessId }` is a cross-tenant data leak that, for IRN cancel, also burns the victim's NIC quota and invalidates a real legal invoice.

**Required controls:**
- All new routes mount under the existing protected router (cookie session + CSRF + business-scope middleware).
- Service layer MUST take `businessId` as the **first** non-optional argument and apply it as a `where` filter on every Prisma read AND write. No "load by id then check ownership" pattern — that races and loses on findUnique.
- For 404 vs 403 on cross-tenant access: return **404** (not 403). 403 leaks existence (timing + semantic oracle) and tells an attacker their target IRN is valid. Match existing v6 behavior in `documents.service.ts`.
- IRN cancel specifically: server re-loads `EInvoice` by `(id, businessId)` BEFORE constructing the NIC cancel envelope. The `Irn` value used in the NIC body must come from the DB row, never from request body, even if the client sends it.

**Spot-check of 4 endpoints (per task):**

| Endpoint | businessId source | Risk | Required gate |
|---|---|---|---|
| `POST /api/einvoice/generate` | `req.user.businessId` | Could mint IRN against wrong GSTIN if envelope built from request | server re-derives `business.gstin` from session, refuses if `business.gstin !== envelope.SellerDtls.Gstin` |
| `POST /api/gst/returns/GSTR1/:period/export` | `req.user.businessId` | Could export another tenant's invoices if `period` filter is the only scope | Prisma query `findMany({ where: { businessId, issueDate: { gte, lt } } })` — businessId first arg, period second |
| `POST /api/gst/backfill/preview` | `req.user.businessId` | Preview could leak counts of foreign tenant rows | All count queries scoped by businessId; no `req.body.businessId` accepted |
| `PATCH /api/gst/settings` | `req.user.businessId` | Could flip another tenant's `gstEnabled` | Body MUST NOT contain `businessId`/`id`; if present, 400 `BUSINESS_SCOPE_VIOLATION` (don't silently ignore) |

### A02 — Cryptographic Failures

- NIC AuthToken (encrypted with NIC RSA public key) and Sek (AES-256 session key) are sensitive; cache only in-memory + Redis, never in Postgres.
- NIC IRP/EWB credentials live exclusively in env vars, read **only** through `server/src/config/secrets.nic.ts`. Never inlined elsewhere. Never written to `.env.example` with real values; commit a redacted placeholder only.
- `EInvoice.signedInvoice` and `signedQrCode` carry NIC-issued JWS-signed payloads. Store as opaque text. Do **not** parse, log, or echo back beyond the QR PNG render. The QR is the only piece sent to clients; the full SignedInvoice JWS is server-side audit only.
- Existing infra: passwords already bcrypt'd; JWT in HttpOnly cookie. No change. No new password hashing in v7.

### A03 — Injection

- All Prisma queries use parameterized `where`. No `$queryRaw` proposed in architecture; if any builder adds one, it MUST use `Prisma.sql` template tag.
- **GSTR-1 JSON injection:** the export path concatenates 8 builder outputs into one JSON envelope. Builders MUST emit JS objects, then a single `JSON.stringify` at the end. No string concatenation of "{...}" segments. Numeric fields are guarded by Zod `z.number().int().nonnegative()` before `paiseToRupeesForNic`.
- **GSTIN XSS in template render:** all 30 print templates render `business.gstin`, `party.gstin`, `placeOfSupply` text. React-PDF and the in-app print path both auto-escape — but verify the new `<TaxSummaryBlock>` and `<GstDeclarationBlock>` do NOT use `dangerouslySetInnerHTML`. If a future template needs HTML, route through DOMPurify with an allowlist. Encoded test vector: GSTIN `27<img src=x onerror=alert(1)>BBBBB1Z5` must render as text, never execute.
- **HSN typeahead injection:** server-side HSN search MUST use `contains` with `mode: 'insensitive'` on the `code` and `description` columns — not raw SQL `ILIKE` concatenation.
- **NIC envelope field injection:** customer-supplied free-text fields (party name, address, declaration text) are length-capped per NIC schema (DocNo ≤ 16, LglNm ≤ 100, Addr1 ≤ 100, etc.) before envelope build. Reject at 400 with `EINVOICE_FIELD_LENGTH` rather than letting NIC reject — gives the user a clear toast and avoids burning quota on a guaranteed-fail call.

### A04 — Insecure Design

- E-invoice and EWB calls are **not queueable offline** (per architecture §8.1). This is correct: forging an IRN client-side is impossible (NIC is the issuer), and queueing creates a window where users believe they're compliant but the IRN never minted. Server-side `OFFLINE_REQUIRED` check is mandatory.
- Cancel UX: 24h cancel window enforced server-side using `EInvoice.ackDate`, NOT client clock. Architecture is silent on what happens if NIC's clock and ours drift — recommend a 5-minute safety margin (block cancel at >23h55m our time) so we never hit NIC's own 24h reject and confuse the user.
- IRN cancel reason (`CnlRsn 1-4`) and remarks (`CnlRem`, ≤100 chars) come from a constrained UI dropdown — free-text remarks are passed through but length-capped server-side.

### A05 — Security Misconfiguration

- Helmet.js confirmed mounted on the existing express app — verify `/api/einvoice/*` and `/api/ewaybill/*` routes mount under it (default if added to the same `app.use('/api', ...)`).
- CORS origin: existing config uses an allowlist (`hisaabpro.in`, `app.hisaabpro.in`, `localhost`). Verify `*` is NOT introduced when adding the new routes. Document on the PR.
- `NIC_ENV` env var: `'sandbox' | 'prod'`. Default to `'sandbox'`. Refuse to start (boot-fail in `env.ts`) if `NIC_ENV === 'prod'` and `NODE_ENV !== 'production'` — prevents staging accidentally calling NIC prod.
- Stack traces: the existing error middleware strips stack in production. Verify the new `einvoice.errors.ts` mapper does not bypass it. NIC error bodies MUST be passed through `sanitizeNicError()` that strips Server, X-Powered-By, debug fields before user echo.

### A06 — Vulnerable Components

- No new top-level dependencies proposed in architecture beyond what already exists (axios/got, redis client, opossum for circuit breaker — all already present per existing services). If a PR adds an XML or signing library for NIC, run `supply-chain-risk-auditor` before merge.

### A07 — Identification & Authentication

- All new routes are session-gated by existing middleware. No new auth flow.
- NIC IRP login is **server-to-NIC**, not user-to-NIC. The end user never sees the NIC token. The token lives in `einvoice.token-store.ts` keyed by businessId.
- On NIC 401, the server re-authenticates **once**, retries the original call, and on second 401 emits `EINVOICE_NIC_AUTH_FAILED` and rotates the token cache entry. No infinite retry loop.

### A08 — Software & Data Integrity

- Migration is additive (per architecture §1.2). Verified: 6 ALTER ADD COLUMN with defaults, single backfill UPDATE, idempotent UQC seed (UPSERT). Re-running the seed twice does not double-write.
- Backfill execute writes AuditLog rows; idempotency middleware ensures replayed Idempotency-Key returns cached result without rerunning the recompute.
- NIC SignedInvoice carries NIC's JWS — verify signature using NIC's published public key (sandbox cert pinned, prod cert pinned separately). Implementation in `einvoice.nic-client.ts` — verify-then-store. Reject with `EINVOICE_NIC_SIGNATURE_INVALID` if verification fails. **Architecture is silent on this — see merge-blocker MB-2.**

### A09 — Security Logging & Monitoring Failures

- All NIC interactions write `AuditLog` rows (architecture §8.4). Confirmed coverage table is complete.
- Winston logger, no `console.log` (enforced by enforce.js).
- `AuditLog.changes` MUST mask GSTINs and PANs to suffix-4 (e.g. `XXXXXXXXXXX1Z5`). Full GSTIN is in the `Business`/`Party` row already — duplicating it into AuditLog enlarges the leak surface for nothing.
- Auth failures on NIC routes (401, CSRF reject) logged with businessId, route, IP — never with body.
- AuditLog is append-only at the schema level (no `updatedAt`, no UPDATE in code). Index `(businessId, createdAt DESC)` — verify exists or add in this migration.

### A10 — SSRF

- All NIC calls go through `einvoice.nic-client.ts` and `ewaybill.nic-client.ts` with **hardcoded base URLs** keyed by `NIC_ENV`:
  - sandbox IRP: `https://einv-apisandbox.nic.in`
  - prod IRP: `https://einvoice1.gst.gov.in`
  - sandbox EWB: `https://ewbapisandbox.nic.in`
  - prod EWB: `https://ewaybillapi.nic.in`
- Base URLs MUST come from a const, NOT env var, NOT user input. The `NIC_ENV` switch only chooses between two compiled-in pinned URLs.
- No user-controllable URL ever passed to the HTTP client. No `redirect: 'follow'` on these calls (set `maxRedirects: 0` on axios).
- DNS pinning is overkill given NIC's CDN — but TLS cert pinning to NIC's well-known root CA chain (DigiCert) is recommended for prod (advisory, not blocker).

---

## 2. NIC IRP & E-Way Bill API Security Checklist

| # | Control | Required | Status |
|---|---|---|---|
| 1 | Credentials in env only — never in schema, never in `.env.example` real values, never in git history | yes | enforced by `secrets.nic.ts` SSOT |
| 2 | Credentials read once at boot via `env.ts` Zod schema; missing var = boot fail | yes | per architecture |
| 3 | Token cache in-memory + Redis, **never** in Postgres | yes | architecture §2.2 |
| 4 | Token TTL = 6h matching NIC; auto-rotate on 401; rotate-once-then-fail | yes | architecture §2.2 |
| 5 | Token cache key includes businessId — no token sharing across tenants | yes | per-business cache key |
| 6 | Request signing (AES-256 with Sek) implemented in `nic-client.ts`; Sek itself encrypted with NIC public key per session | yes | NIC contract |
| 7 | NIC response signature (JWS on SignedInvoice) verified against NIC public key — see MB-2 | **MISSING — merge-blocker MB-2** |
| 8 | Replay protection: every IRP request includes a fresh `reqId` (NIC requires UUID v4 per call); idempotency at app layer via `Idempotency-Key` middleware | yes | architecture §8.2 |
| 9 | Rate-limit back-off: opossum circuit breaker, 5 fails / 60s opens 30s | yes | architecture §2.2 |
| 10 | Per-business daily quota counter (Redis, INCR, TTL 26h) | yes | architecture §8.3 |
| 11 | Sandbox vs prod isolation: `NIC_ENV` switches both base URL and credentials; refuse `prod` outside `NODE_ENV=production` | yes | per §1 A05 above |
| 12 | NIC error bodies sanitized before user echo (`sanitizeNicError`) | **MISSING — merge-blocker MB-3** |
| 13 | NIC password never in logs (Winston scrubber) | yes | enforced by Winston format |
| 14 | NIC username also redacted in logs (it's an identifier but pairs with password in any leak; treat as PII) | recommended | add to Winston scrubber list |
| 15 | TLS 1.2+ only on outbound NIC calls; no SSLv3/TLS1.0 fallback | yes | Node default since 18 |
| 16 | `maxRedirects: 0` on NIC HTTP client (anti-SSRF) | required | add to client config |
| 17 | Outbound timeout 8s wall clock — matches user spinner cap | yes | architecture §2.2 |

---

## 3. Multi-Tenant Isolation — endpoint spot-check

Already covered in §1 A01 above. Re-stated as merge gate:

For every new route, the PR MUST show:
1. The Express handler reads `businessId` from `req.user`, NEVER from body/query.
2. Every Prisma call inside that handler/service has `businessId` in its `where`.
3. Cross-tenant test in `__tests__/<route>.access.test.ts` proves a tenant-A token cannot read/write tenant-B data — returns 404.

This is enforced by the existing `enforce.js` pattern check `no-businessless-prisma-call` if extended; otherwise enforced by review of the spot-check curl proofs in the acceptance frontmatter.

---

## 4. PII & Data Minimisation

PII inventory introduced by v7:

| Field | Sensitivity | Storage | Display | Audit log | Logs |
|---|---|---|---|---|---|
| Business GSTIN | medium (public-ish but tied to PAN) | `Business.gstin` (already exists) | full | masked suffix-4 | masked |
| Party GSTIN | medium | `Party.gstin` (already exists) | full to invoicing user | masked suffix-4 | masked |
| Business PAN | embedded in GSTIN chars 3-12 | not stored separately | not displayed | not stored | not logged |
| NIC IRP username | high (paired with password) | env only | never | never | redacted |
| NIC IRP password | high | env only | never | never | redacted |
| NIC AuthToken | high (6h bearer) | in-memory + Redis | never | never (token id only on rotate) | redacted |
| Sek session key | high | in-memory only (per request scope) | never | never | redacted |
| IRN | low (legal identifier, on the printed invoice) | `EInvoice.irn` | full | full (it's the audit handle) | full |
| ewbNumber | low | `EWayBill.ewbNumber` | full | full | full |
| Vehicle number | medium (driver privacy) | `EWayBill.partBUpdates` | full to operator | masked last-4 | masked |
| NIC raw error body | varies — may contain stack/internal IDs | not stored | sanitized error code only | NIC error code only | full body OK at debug level (server only) |

**Rule:** NIC raw error bodies are never echoed to user toasts. The user sees the mapped HpError code + a friendly message. This is merge-blocker MB-3.

---

## 5. Idempotency & Replay

Confirmed coverage list (matches architecture §8.2):

| Route | Idempotency middleware required | Underlying DB unique |
|---|---|---|
| `POST /api/invoices` | yes | `(businessId, documentNumber)` |
| `PUT /api/invoices/:id` | yes | row PK |
| `POST /api/einvoice/generate` | yes | `EInvoice.documentId @unique` |
| `POST /api/einvoice/cancel` | yes | `EInvoice.status` transition guard |
| `POST /api/ewaybill/generate` | yes | `EWayBill.documentId @unique` |
| `POST /api/ewaybill/partb` | yes | append to `partBUpdates` Json[] |
| `POST /api/ewaybill/cancel` | yes | status guard |
| `POST /api/gst/backfill/execute` | yes | AuditLog idempotency key column |
| `POST /api/gst/returns/GSTR1/:period/export` | yes | `GstReturn(businessId, period, returnType) @unique` |
| `POST /api/gst/returns/GSTR3B/:period/export` | yes | same |

`Idempotency-Key` header missing on a mutating POST → 400 `IDEMPOTENCY_KEY_REQUIRED`. Replay within the cache TTL (24h) returns the cached response **without** re-invoking the handler — this is what protects against accidental double-IRN-mint when a user double-taps the button on a flaky 3G connection.

---

## 6. Rate Limiting

| Route | Limit | Scope |
|---|---|---|
| `POST /api/einvoice/generate` | 10 req/s | per businessId |
| `POST /api/einvoice/generate` | 1000/day soft, hard at quota | per businessId (NIC GSTIN) |
| `POST /api/einvoice/cancel` | 10 req/s | per businessId |
| `POST /api/ewaybill/*` | 10 req/s | per businessId |
| `POST /api/gst/backfill/execute` | 1 / hour | per businessId (and per user — see below) |
| `POST /api/gst/backfill/preview` | 5 / minute | per businessId |
| `POST /api/gst/returns/GSTR1/:period/export` | 5 / minute | per businessId |
| `GET /api/gst/returns/*` | 60 / minute | per businessId |

**Backfill-specific:** also rate-limit per **userId** to 1/hour. A multi-user business with 5 admins should not be able to fire 5 concurrent backfills. The existing express-rate-limit infra supports composite keys.

Rate limit by businessId, not IP — multi-tenant attack from one IP would be wrongly throttled if keyed by IP. Architecture §8.3 already mandates this.

---

## 7. Audit Log Requirements

Per-event fields (additive to existing AuditLog model):

| `action` | `entityType` | `entityId` | `changes` (JSON) | masked |
|---|---|---|---|---|
| `GST_SETTINGS_UPDATE` | `business` | businessId | `{ before: {gstin: 'XXX...1Z5', taxPricingMode}, after: {...} }` | GSTIN suffix-4 |
| `EINVOICE_GENERATED` | `einvoice` | einvoiceId | `{ irn, ackNumber, ackDate, documentId }` | none (IRN is public) |
| `EINVOICE_CANCELLED` | `einvoice` | einvoiceId | `{ irn, reason: 1\|2\|3\|4, remarks }` | remarks length-capped |
| `EWAYBILL_GENERATED` | `ewaybill` | ewaybillId | `{ ewbNumber, distance, transportMode, vehicleNumber: 'XX...XX99' }` | vehicle suffix-4 |
| `EWAYBILL_PARTB_UPDATED` | `ewaybill` | ewaybillId | `{ before: {...}, after: {...} }` | vehicle suffix-4 |
| `EWAYBILL_CANCELLED` | `ewaybill` | ewaybillId | `{ reason }` | none |
| `GST_RETURN_EXPORTED` | `gstreturn` | gstreturnId | `{ period, returnType, fileName, rowCount }` | none |
| `GST_BACKFILL_RUN` | `business` | businessId | `{ summary: { productsTagged, invoicesUpdated, durationMs }, idempotencyKey }` | none |
| `GST_BACKFILL` | `document` | documentId | `{ before: {totals}, after: {totals} }` | none |

**Append-only:** AuditLog model has no `updatedAt`, no UPDATE/DELETE in code. Verified.

**Index:** `@@index([businessId, createdAt])` — verify present in current `schema.prisma`. If not, add in this migration (read by the existing `/settings/activity` page; the v7 increase in audit volume makes this index meaningful).

**Retention:** indefinite (legal requirement: GST records 6 years). No purge job in v7.

---

## 8. Migration Safety

Per architecture §1.1–1.5:

- 6 columns, all `ADD COLUMN ... NOT NULL DEFAULT <literal>` — metadata-only lock on Postgres 11+. Confirmed.
- Single backfill UPDATE on `Business.gstEnabled` — bounded by tenant count (small).
- UQC seed via separate `seed.gst.uqc.ts` is idempotent (UPSERT keyed by HSN code). Re-running on a partial state converges without duplication.
- Rollback: documented manual `DROP COLUMN` in `-- DOWN` block; v6 code does not read new columns so app-only rollback is also safe.
- **No `db push`** — pre-commit gate already blocks it.
- Migration history is immutable: once shipped, do not edit the migration SQL. New corrections go in new migrations.

**Safety verdict: PASS.**

---

## 9. Feature Flags

Two-layer flag:

1. **Global (env):** `FEATURE_GST_V7=1` — gates the entire route prefix `/api/einvoice`, `/api/ewaybill`, `/api/gst/returns`, `/api/gst/backfill` at the router-mount level. Default off in production until PR #12. When off, routes return 404 (not 403) — same convention as cross-tenant.
2. **Per-business (DB):** `Business.gstEnabled` — gates UI nav AND server-side handler entry for non-NIC GST routes. Settings PATCH that sets `gstEnabled = true` is itself the opt-in; no global flag controls it.
3. **NIC-specific (env):** `NIC_IRP_ENABLED=1` and `NIC_EWB_ENABLED=1` — separate kill switches in case NIC is down for an extended outage. Independent from `FEATURE_GST_V7` so we can ship invoicing/GSTR without depending on NIC uptime.

**Server-side enforcement:** every route checks the flag in middleware BEFORE businessId scope check, BEFORE handler runs. UI hiding is not security — it is UX. The server is the source of truth.

---

## 10. Threat Model — Top 5 Abuse Cases

| # | Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| T1 | Cross-tenant IRN cancel (attacker tenant-A cancels tenant-B's IRN, invalidates real legal invoice + burns victim's NIC quota) | medium (one missing where clause) | **CRITICAL** | businessId-first Prisma where on every cancel; cross-tenant test in CI; 404 not 403; IRN cancel envelope built from server-side EInvoice row, never request body |
| T2 | Compromised NIC creds → attacker mints fraudulent IRNs | low (creds in env, ops-only) | **CRITICAL** | rotation runbook documented; AuditLog reveals every IRN request → anomaly detection on rate spikes; per-business quota caps blast radius to one tenant's daily quota; NIC_IRP_ENABLED kill switch |
| T3 | Double backfill (user clicks "Run" twice; both jobs run; duplicate AuditLog rows; race-condition-corrupted totals) | high (user behavior) | medium | Idempotency-Key middleware on `/backfill/execute`; per-user 1/hr rate limit; backfill itself acquires a Postgres advisory lock keyed by businessId |
| T4 | GSTIN XSS in template render (party with `<script>` in name/GSTIN, rendered in print template, executes in user's browser when previewing) | low (React-PDF auto-escapes) | medium | confirm `<TaxSummaryBlock>` and `<GstDeclarationBlock>` use no `dangerouslySetInnerHTML`; XSS test vector in CI; declaration text passed through DOMPurify if HTML accepted |
| T5 | Parameter-tampered GSTR-1 export (client adjusts `businessId` in body or URL; server uses request value not session) | low (architecture says session-derived) | **CRITICAL** | businessId NEVER from body/query for GSTR routes; if request body contains a businessId field, 400 `BUSINESS_SCOPE_VIOLATION` rather than silent ignore — fail loudly so a misbuilt client surfaces in dev |

---

## 11. Code-Level Merge Checklist (per PR)

Each of PRs 7–11 must show in the PR description:

- [ ] Idempotency-Key middleware mounted on every new POST mutating route (list with line refs)
- [ ] Per-business rate limit configured for every NIC-fronting route (list with line refs)
- [ ] No NIC creds in code — `grep -rn 'NIC_' server/src --include='*.ts' | grep -v secrets.nic.ts | grep -v env.ts` returns 0 hits
- [ ] Every Prisma call passes `businessId` in `where` (or is wrapped in a businessId-scoped service helper)
- [ ] AuditLog write present in every mutating handler — match list in §7
- [ ] Cross-tenant access test in `__tests__/access.test.ts` passes
- [ ] No `console.log` (Winston only) — verified by enforce.js Check #ratchet
- [ ] No `dangerouslySetInnerHTML` introduced in template files
- [ ] No raw `fetch()` to NIC — only through `einvoice.nic-client.ts` / `ewaybill.nic-client.ts`
- [ ] NIC base URL is a compiled-in const, not env-derived (env only switches sandbox/prod)
- [ ] `maxRedirects: 0` on NIC HTTP client config
- [ ] `OFFLINE_REQUIRED` precheck on every NIC-touching service function (client side)
- [ ] No `entityType` on `api()` call for NIC mutations (prevents accidental queueing)

---

## 12. Acceptance — see frontmatter

Mirrored above. Each curl proof and screenshot must be attached to the corresponding PR (8 / 9 for NIC; 10 for GSTR-1; 7 for backfill).

---

## TOP 5 MERGE-BLOCKERS (must resolve before PR 8/9 merge)

**MB-1 (CRITICAL — A01) — Cross-tenant IRN cancel.** Architecture says "load by id" but does not nail the exact pattern. **Required:** every IRN/EWB cancel handler MUST do `prisma.eInvoice.findFirst({ where: { id, businessId: req.user.businessId } })` (or service equivalent), 404 on miss, and build the NIC envelope using the **DB row's** `irn`, never the request body's `irn`. Add a CI test `cross-tenant.irn-cancel.test.ts` proving tenant-A token cancelling tenant-B's IRN returns 404 with no NIC call made (mock NIC client, assert zero invocations).

**MB-2 (CRITICAL — A08) — NIC SignedInvoice JWS signature verification.** Architecture §2.2 lists the response fields `SignedInvoice`, `SignedQRCode` but does NOT specify that the JWS signature is verified against NIC's public key before the row is persisted. **Required:** `einvoice.nic-client.ts` MUST verify the JWS signature using the pinned NIC public key (sandbox cert + prod cert as separate compiled-in PEMs). On verification failure, do NOT persist the EInvoice row, raise `EINVOICE_NIC_SIGNATURE_INVALID`, log a security alert, and return 502. Without this, a man-in-the-middle who breaks NIC TLS (or a future NIC URL hijack) can inject fake IRNs into our DB.

**MB-3 (HIGH — A05/A09) — NIC raw error body sanitization.** Architecture §2.2 error table says "surface NIC error array verbatim" for `EINVOICE_NIC_VALIDATION`. **Required:** wrap NIC error bodies in a `sanitizeNicError(body)` helper that (a) strips `Server`, `X-Powered-By`, `Stack`, `Trace-Id`, undocumented fields, (b) caps total length to 1KB, (c) extracts only the documented `{ ErrorCode, ErrorMsg }` array. Echoing raw NIC HTML/JSON to a user toast can leak NIC internal infra details and is a stored-XSS sink if rendered without escaping.

**MB-4 (HIGH — A09) — AuditLog GSTIN masking.** Architecture §8.4 says "before/after of changed fields only" but does not specify masking. **Required:** the JSON written into `AuditLog.changes` for `GST_SETTINGS_UPDATE` MUST mask `gstin` to suffix-4 form (`'XXXXXXXXXXX1Z5'`). Same for any party GSTIN that ever appears in a backfill audit row. The full GSTIN is recoverable from the live `Business`/`Party` row; duplicating it into the immutable AuditLog enlarges a future leak's blast radius for no operational benefit.

**MB-5 (HIGH — A10) — NIC base URL hardening.** Architecture §2.2 implies env-driven URL switching but does not pin the URLs. **Required:** the four NIC base URLs are compiled-in `const` strings in `einvoice.nic-client.ts` / `ewaybill.nic-client.ts`. `NIC_ENV` env var only selects between the two sandbox/prod branches. There is NO env var that holds a NIC URL. Set `maxRedirects: 0` on the HTTP client. Without this, a misconfigured `.env` could redirect NIC traffic to an attacker-controlled host that proxies and steals NIC AuthTokens.

---

**Verdict: APPROVED** subject to MB-1 through MB-5 being implemented in PRs 8 and 9 with the curl proofs attached.

— security agent, 2026-05-03
