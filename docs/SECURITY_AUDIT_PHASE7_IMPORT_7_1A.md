# Security Audit — Phase 7 #149 Slice 7.1A (Parties Import)

**Auditor:** security agent · **Date:** 2026-05-18 · **Verdict:** `SHIP_WITH_CONDITIONS`

**Inputs reviewed:**
- SCOPE v2: `docs/SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md`
- ARCH v1 (post audit-nit-fixes): `docs/ARCHITECTURE_PHASE7_IMPORT_7_1A.md`
- ARCH AUDIT: `docs/ARCHITECTURE_AUDIT_PHASE7_IMPORT_7_1A.md`

**Surface:** 4 import formats (Tally XML, Vyapar CSV, Busy XLSX, Generic CSV) × Parties only.

---

## Verdict — SHIP_WITH_CONDITIONS

4 MUST_FIX (small/contained), 9 SHOULD_FIX, 5 FUTURE_EPIC.

Core controls (XXE / zip-bomb / CSV-injection / idempotency / tenancy / audit
coverage) are well-specified. Remaining holes are hardening gaps where docs
are silent or under-specified — not architectural breaks. M1-M4 must land
before merge; S1-S13 belong in the build phase; F1-F5 deferred past 7.1A.

---

## MUST_FIX (block merge to `hisaabpro`)

### M1 — `req.user.userId` shape never asserted by middleware

ARCH §3 says identity is `req.user.userId`, NEVER `req.user.id`. But there
is no runtime assertion that throws if `req.user.userId` is undefined. With
5 routes × 47 BE files each consuming `req.user.userId` independently, one
typo silently triggers cross-tenant IDOR via Prisma's drop-undefined.

**Fix:** in `requireActiveBusiness` (already SSOT for businessId), assert
`typeof req.user.userId === 'string' && req.user.userId.length > 0` and
500 if not. Add typed helper `getAuth(req): { userId: string; businessId: string }`
consumed by every route. Cite SCOPE L243-244, ARCH §3 L192.

### M2 — `fileName` from multer flows into Prisma + audit + error-CSV with no sanitisation

Multer's `originalname` is client-supplied. Adversarial content: `../../../etc/passwd`,
`\x00.xlsx` null-byte trunc, control chars that corrupt winston JSON, very
long names (>1KB), RTL override `‮`. SCOPE L508 audit row writes
`fileName` verbatim.

**Fix:** in `create.route.ts`, normalise before persist + audit:

```ts
fileName
  .replace(/[\x00-\x1F\x7F‪-‮⁦-⁩]/g, '')
  .slice(0, 255)
  .replace(/^\.+/, '')
```

Cite SCOPE L508, ARCH §2.1.

### M3 — `commitToken` not bound to `Idempotency-Key` or `(businessId, userId)` at issuance

Two layers (idempotencyCheck cache + single-use commitToken) intersect with
unspecified semantics. Attack: steal commitToken from XHR logs / Sentry
breadcrumb / browser devtools → submit commit with **new** Idempotency-Key
→ idempotencyCheck has no cached response → falls through → commitToken
still valid in DB → commit succeeds. Then victim retries with their original
Idempotency-Key → cache hit returns "success" but DB is in attacker's state.

**Fix:** at preview-token issuance, persist `commitToken` together with
`(idempotencyKey, businessId, userId)`. ARCH §6.1 step 3 ASSERT must include
`AND idempotencyKey = :provided AND userId = :reqUser AND businessId = :reqBiz`.
Cite ARCH §6.1 L307.

### M4 — `errorCsvUrl` "signed URL, 1h TTL" — signing/storage backend undefined

SCOPE L221 says "signed URL, 1h TTL, CSV-injection-safe". HP stack has no
S3 / object store — only Render Postgres. Signed query-param URLs leak via
Referer headers + analytics. If served from a feature route, that route
must use the existing auth + active-business chain, not a query-param token.

**Fix:** specify `GET /api/imports/:id/error-csv` reuses
`auth → requireActiveBusiness → requireRole('admin')` + queries CSV on the
fly from `ImportJobRow.errors`. Response headers:

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="errors-<jobId>.csv"
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

Add as File Plan row in `routes/imports/error-csv.route.ts` (~70L). Drop
the `errorCsvUrl` field from API response; FE constructs path from `:id`.
Cite SCOPE L221.

---

## SHOULD_FIX (fix during build, do not ship-block)

| ID | Finding | Fix site |
|---|---|---|
| S1 | `XXE_SCAN_BYTES=65536` too narrow — attacker pads with 100KB whitespace before `<!DOCTYPE` | `services/import/security/xxe-prescan.ts` — scan full 10MB buffer (still O(n), ~10ms) |
| S2 | `fast-xml-parser` version pin missing; CVE-2024-41818 in <4.4.0 | `package.json` pin ≥ 4.4.0; `import.constants.ts` documents minimum |
| S3 | Multer 10MB × concurrent uploads — active-job check fires AFTER multer.parse, so 100MB allocated before lock | Move `requireNoActiveJob` middleware BEFORE multer in §3 chain |
| S4 | DB-backed `request_rate_limit` table is itself a DoS amplifier under burst | In-process LRU cache fronting the DB write, async flush |
| S5 | `previousJobRowCount` leak across uploaders within same business | Scope re-upload check to `(businessId, userId, fileSha256)`; cross-uploader → FUTURE_EPIC |
| S6 | `parties.imported` audit emitted per-row inside tx → 10k inserts inside tx | Batch audit per chunk (single multi-row INSERT for 500) |
| S7 | `pg_advisory_xact_lock(int4, int4)` — birthday collisions at ~77k businesses | Use `pg_advisory_xact_lock(bigint)` with `hashtextextended` (PG≥11) |
| S8 | `createdPartyIds` JSONB unbounded — document 10k row cap as upper bound | `import.constants.ts` add `MAX_CREATED_PARTY_IDS=10000`; commit.service rejects if exceeded |
| S9 | Winston PII redaction not specified — error logs may contain raw row content | Parser + normalizer logger calls: `{ jobId, rowIndex, code }` ONLY, never raw row |
| S10 | yauzl trusts attacker-controlled `uncompressedSize` from central directory | Streaming decompression cap (counted-bytes wrapper aborts at 100MB) |
| S11 | `cuid` v1 predictable; commitToken secrecy matters | Use `cuid2` or `crypto.randomUUID()` for `commitToken` |
| S12 | CSV-injection prefix-quote applied only to error-CSV; preview-JSON copy-paste into Excel re-introduces formula | Apply prefix-quote at preview response serialiser for `raw` + `normalized` |
| S13 | Error-CSV download missing security response headers | Covered in M4 fix |

---

## FUTURE_EPIC (defer past 7.1A)

- **F1** — Magic-byte polyglot detection (XLSX-disguised-as-JAR). Defer to 7.1E.
- **F2** — JWT-style signed `commitToken` (stateless verification + theft detection).
- **F3** — UTF-7 / BOM-encoding adversarial CSV rejection. Defer to 7.1B with explicit `encoding=utf-8` assertion.
- **F4** — Dedup query-time leak via Levenshtein scan size. Theoretical, not in HP threat model.
- **F5** — Sentry `beforeSend` strip of `commitToken` / `Idempotency-Key` / file content.

---

## What the docs got RIGHT (no findings)

- Tenancy: every model + query scoped by `businessId = req.activeBusiness.id`; 404 not 403 on cross-business
- XXE: pre-scan + `processEntities:false` + 10s race timeout — three layers
- Zip-bomb: yauzl pre-scan with both absolute (100MB) + ratio (100×) caps
- CSV-injection: OWASP-compliant prefix-quote for `=+-@\t\r`
- Commit idempotency: `commitToken` + `Idempotency-Key` + `SELECT FOR UPDATE` + row-level `WHERE status='STAGED' AND createdPartyId IS NULL` + `@unique createdPartyId` — 4 belt-and-suspenders layers
- DPDP: 24h raw-PII purge + cascade erasure hook
- Feature-flag gate returns 404, doesn't leak flag state
- Audit coverage: 7 actions, `enforce-audit-coverage.mjs --block` gated
- Multer `memoryStorage` only — no disk write
- Middleware order `auth → activeBusiness → requireRole → requireFeature` correct: 401/400/403 fire before flag-leak gate

---

## Sign-off

**Cleared to enter build phase** with M1-M4 folded into ARCH as
pre-build amendments. S1-S13 must land before merge to `hisaabpro`. The
build agent is required to verify all M1-M4 fixes via the verifier
agent before invoking qa.
