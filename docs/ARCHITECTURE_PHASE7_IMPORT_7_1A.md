---
architecture_of: SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md (v2)
scope_audit_ref: SCOPE_AUDIT_PHASE7_IMPORT_7_1A_PARTIES.md (PASS, 0 gaps)
architect: architect
created: 2026-05-18T15:45:00+05:30
high_risk_paths_touched:
  - prisma/schema.prisma
  - prisma/migrations/**
  - src/middleware/auth* (composition only — no edit)
  - src/routes/imports/**
feature_flag: FEATURE_DATA_IMPORT
flag_cohort_default: 0
status: draft (pending architecture-auditor)
---

# ARCHITECTURE — Phase 7 #149 · Slice 7.1A — Parties Import

> 4 source formats (Tally XML, Vyapar CSV, Busy Excel, Generic CSV) → staged
> preview → idempotent commit with row-level guard → per-business audit
> trail. Behind `FEATURE_DATA_IMPORT`, cohort=0 until 7.1D ships.

This document is the **technical contract** for the SCOPE. It is read top-to-bottom
by `architecture-auditor` and then by the build agents. Every concrete SCOPE
decision is pinned to an architecture artifact in `## SCOPE Conformance Map`.
No file in `## File Plan` exceeds 250 estimated lines.

---

## 1. System overview

```
┌────────────── Mobile / Web (React 19 + TS) ─────────────┐
│  ImportLanding → Upload → (Mapping) → Preview →         │
│  DedupReview → Summary    ← TanStack polling (2s)       │
│  api() w/ excludeFromOfflineQueue:true, entityType:'import'│
└──────────┬──────────────────────────────────────────────┘
           │  HTTPS, cookie auth, CSRF, Idempotency-Key
           ▼
┌──────────────── Express (Render Starter, 512MB) ────────┐
│ Middleware chain:                                       │
│   auth → requireActiveBusiness → requireFeature         │
│   → requireMinClientVersion → importRateLimit           │
│   → idempotencyCheck → multer.memoryStorage(10MB)       │
│   → handler                                             │
│                                                          │
│ Services:                                                │
│   import-job.service  • commit.service                   │
│   parsers/{tally,vyapar,busy,generic}                    │
│   security/{xxe,zip-bomb,csv-injection}                  │
│   dedup/{exact,near}                                     │
│   normalizers/party                                      │
│   audit • erasure                                        │
│                                                          │
│ Cron (Render scheduled, hourly):                         │
│   cleanup-expired-import-jobs.cron.ts                    │
└──────────┬──────────────────────────────────────────────┘
           │ Prisma (max 25 conn) — chunked tx 500 rows
           ▼
┌──────────── PostgreSQL (Render Starter) ────────────────┐
│  ImportJob • ImportJobRow • Party (importJobId,         │
│  importedBy) • OpeningBalance • AuditLog • Business     │
└─────────────────────────────────────────────────────────┘
```

Memory shape: parse runs in-memory, single in-flight job per business
(rate-limit + 1-active-job rule caps peak at one 10MB upload + ~50MB
parsed buffer = ~70MB worst-case per business per Node process). With
the active-job cap enforced before allocation, three concurrent
businesses uploading worst-case files stay within the 512MB ceiling.

---

## 2. Data model (Prisma additions)

> **Migration order (greenfield tables, no backfill):**
> 1. `prisma migrate dev --name import_jobs` adds `ImportJob` + `ImportJobRow` + indexes.
> 2. Same migration adds `Party.importJobId`, `Party.importedBy`, `(businessId, importJobId)` index — **both nullable** (no NOT NULL needed since legacy parties have no source job).
> No backfill, no make-NOT-NULL step. PRISMA_MIGRATION_RULES.md compliant.

### 2.1 `ImportJob`

```prisma
model ImportJob {
  id              String   @id @default(cuid())
  businessId      String
  business        Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  entity          String   // 'parties' (future: 'products' | 'invoices' | 'payments')
  format          String   // 'tally_xml' | 'vyapar_csv' | 'busy_xls' | 'generic_csv'
  status          String   // UPLOADED|PARSING|PREVIEWED|COMMITTING|COMMITTED|PARTIALLY_COMMITTED|FAILED|CANCELLED

  commitToken     String?  // server-issued cuid; single-use; populated on PREVIEWED, nulled on COMMITTING
  fileName        String?  // nullable so DPDP erasure can NULL it
  fileSha256      String
  fileSize        Int
  rowCount        Int
  columnMapping   Json?    // generic_csv only
  counts          Json     // { total, staged, errors, warnings, duplicatesExact, duplicatesNear, committed }
  createdPartyIds Json?    // full array of created Party ids (audit row caps at 100)
  clientVersion   String

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  committedAt     DateTime?
  expiresAt       DateTime // 7d STAGED, 90d terminal

  rows            ImportJobRow[]

  @@index([businessId, fileSha256])               // re-upload detect
  @@index([businessId, status, updatedAt])        // active-job check + cleanup
  @@index([committedAt])                          // 24h raw-PII purge cron
  @@index([expiresAt])                            // hard-delete cron
  @@index([userId])                               // uploader-scoped list (FE)
}
```

### 2.2 `ImportJobRow`

```prisma
model ImportJobRow {
  id              String   @id @default(cuid())
  jobId           String
  job             ImportJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  sourceIndex     Int
  status          String   // STAGED|ERROR|WARNING|DUPLICATE_EXACT|DUPLICATE_NEAR|COMMITTED|SKIPPED
  raw             Json?    // NULLED 24h post-commit
  normalized      Json?    // NULLED 24h post-commit
  issues          Json     // [{ field, code, severity, message }]

  matchedPartyId  String?
  matchedParty    Party?   @relation("MatchedPartyImports", fields: [matchedPartyId], references: [id])
  createdPartyId  String?  @unique
  createdParty    Party?   @relation("CreatedPartyImport",  fields: [createdPartyId], references: [id])

  @@index([jobId, status])
  @@index([jobId, sourceIndex])
}
```

`createdPartyId` is `@unique`: enforces "1 row → ≤1 party" at the DB level
and makes the row-level commit guard cheap.

### 2.3 `Party` additions (additive only)

```prisma
model Party {
  // ... existing fields
  importJobId     String?
  importedBy      String?
  importJob       ImportJob? @relation(fields: [importJobId], references: [id])
  importedByUser  User?      @relation("ImportedParties", fields: [importedBy], references: [id])

  matchedRows     ImportJobRow[] @relation("MatchedPartyImports")
  sourceRow       ImportJobRow?  @relation("CreatedPartyImport")

  @@index([businessId, importJobId])
}
```

### 2.4 Invariants

- Every `ImportJob` and `ImportJobRow` row carries `businessId` reachable in ≤1 hop. Every service-layer query filters `businessId = req.activeBusiness.id`. Cross-business read returns **404** (not 403) — never leak existence.
- `ImportJobRow.createdPartyId` is `@unique` so a commit retry physically cannot bind two parties to one row.
- `Party.importJobId` is nullable (legacy parties have none); `(businessId, importJobId)` index supports the parties-list filter `?importJobId=`.
- Audit rows are immutable: only `INSERT` permission for the app role on `AuditLog`. (Schema-level grant; out-of-scope to enforce here but called out for DBA.)

---

## 3. Middleware composition (SSOT)

The commit route is the highest-risk path. Composition order:

```
POST /api/imports/:id/commit
  └─► requireAuth                         (cookie + CSRF)
  └─► requireActiveBusiness               (SSOT: server/src/middleware/require-active-business.ts)
                                          // sets req.activeBusiness.id; 400 NO_ACTIVE_BUSINESS otherwise
  └─► requireRole('admin')                (existing; staff/cashier → 403)
  └─► requireFeature('DATA_IMPORT')       (404 if business.featureFlags.DATA_IMPORT !== true — don't leak)
  └─► requireMinClientVersion(IMPORT_MIN_CLIENT_VERSION)   // SSOT: import.constants.ts → '7.1.0' → 426 UPGRADE_REQUIRED
  └─► importRateLimit('commit')           (1 concurrent commit per business; advisory pg lock)
  └─► idempotencyCheck                    (SSOT: server/src/middleware/idempotency.ts)
                                          // replays cached response on duplicate Idempotency-Key
  └─► commitHandler                       (BEGIN TX → SELECT FOR UPDATE → ...)
```

Identical chain (minus commit-specific rate limiter) applies to `POST /api/imports`, `DELETE /api/imports/:id`, `GET /api/imports`, `GET /api/imports/:id`. The feature flag is checked on **all** import routes including upload — disabled businesses get 404 on every endpoint and the FE nav row is hidden. (See §8.)

User identity is always `req.user.userId`. NEVER `req.user.id`. Memory note `feedback_auth_req_user_shape.md` (A01.1 IDOR ruling) applies.

### 3.1 Security-audit amendments (M1-M4)

**M1 — Runtime userId assertion.** `requireActiveBusiness` MUST also assert
`typeof req.user.userId === 'string' && req.user.userId.length > 0` and
500 if not. A typed helper `getAuth(req): { userId, businessId }` is the
ONLY way route handlers read these — direct `req.user.userId` reads are
forbidden by ESLint rule (added to `enforce.js`).

**M2 — Filename sanitisation.** `create.route.ts` normalises
`req.file.originalname` before persist + audit emit:

```ts
const fileName = req.file.originalname
  .replace(/[\x00-\x1F\x7F‪-‮⁦-⁩]/g, '')
  .slice(0, 255)
  .replace(/^\.+/, '')
```

This eliminates null-byte truncation, control-char log corruption,
RTL-override display flip, and `../` path-traversal attempts in the audit
payload.

**M3 — `commitToken` binding.** At preview-token issuance (preview
service), persist `commitToken` together with the issuing
`(idempotencyKey, businessId, userId)`. ARCH §6.1 step 3 ASSERT must be:

```sql
WHERE id = :jobId
  AND status = 'PREVIEWED'
  AND commitToken = :tokenFromClient
  AND idempotencyKey = :reqIdempotencyKey
  AND businessId = :reqBiz
  AND userId = :reqUser
```

Theft of the token alone — without the matching Idempotency-Key — fails
the ASSERT and returns 409 `BAD_COMMIT_TOKEN`.

**M4 — Error-CSV download via auth route, not signed URL.** New file plan
row: `routes/imports/error-csv.route.ts` (~70L, layer: route). Mounted at
`GET /api/imports/:id/error-csv` behind the same auth +
`requireActiveBusiness` + `requireRole('admin')` chain. Response headers:

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="errors-<jobId>.csv"
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

API responses drop the `errorCsvUrl` field entirely; FE constructs the
path from `:id`. Cite SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md §M4.

---

## 4. Parser architecture

### 4.1 Shared parser interface

```ts
// services/import/parsers/parser.types.ts
export interface RawPartyRow {
  sourceIndex: number;
  raw: Record<string, string>;
}

export interface ParserInput {
  buffer: Buffer;
  fileName: string;
  columnMapping?: Record<string, string>; // generic_csv only
}

export interface ParserResult {
  rows: RawPartyRow[];
  warnings: Array<{ code: string; message: string }>;
}

export type Parser = (input: ParserInput) => Promise<ParserResult>;
```

Each format parser is one module implementing `Parser`. The orchestrator
(`import-job.service.ts`) selects the parser by `format`, runs the security
pre-scans first, then wraps `parser(...)` in a 10s timeout via
`Promise.race([parser(input), rejectAfter(10_000)])`.

### 4.2 Format-by-format

| Format | Parser file | Lib | Pre-scan | Notes |
|--------|-------------|-----|----------|-------|
| `tally_xml` | `parsers/tally-xml.parser.ts` | `fast-xml-parser` | `xxe-prescan.ts` (64KB regex), parser opts `processEntities: false` | streaming `<LEDGER>` extraction |
| `vyapar_csv` | `parsers/vyapar-csv.parser.ts` | `papaparse` (stream mode) | none beyond size | header-name detection; missing "Party Name" → `PARSE_FAILED REQUIRED_COLUMN_MISSING` |
| `busy_xls` | `parsers/busy-excel.parser.ts` | `xlsx` (sheetjs) | `zip-bomb-prescan.ts` (`yauzl`) | first sheet only; `cellNF` preserved for OB |
| `generic_csv` | `parsers/generic-csv.parser.ts` | `papaparse` | `MAPPING_REQUIRED` if `columnMapping` missing | column-map driven |

### 4.3 Security pre-scan modules (separate files)

```
services/import/security/
  xxe-prescan.ts          (regex scan first XXE_SCAN_BYTES = 65536; reject /<!DOCTYPE|<!ENTITY/i)
  zip-bomb-prescan.ts     (yauzl enumerate; reject if sum(uncompressed) > XLSX_MAX_UNCOMPRESSED 100MB
                           OR ratio > XLSX_MAX_RATIO 100)
  csv-injection.ts        (prefix '=+-@\t\r' cells with single quote when serialising error CSV)
```

These are stand-alone so they're unit-testable in isolation with the
adversarial fixtures (`malicious-billion-laughs.xml`, `malicious-zip-bomb.xlsx`,
`csv-injection-sample.csv`).

### 4.4 Normalizer

`services/import/normalizers/party-normalizer.ts` transforms `RawPartyRow → NormalizedPartyRow`:

- Phone: strip non-digit; accept `91XXXXXXXXXX` / `XXXXXXXXXX` → emit `+91XXXXXXXXXX`; else `ERROR INVALID_INDIAN`.
- Name: trim; `Cash`/`Walk-in Customer` → `STAGED + WARNING PLACEHOLDER_NAME`.
- GSTIN: 15-char checksum validation; invalid → `WARNING GSTIN_INVALID`.
- Opening balance: parse `1,00,000.50` and `(500.00)` → paise int with sign; non-numeric → `WARNING 0`.

One file, ≤180 lines, no I/O — pure function exposed to parser tests.

---

## 5. Job lifecycle state machine

```
                    upload (≤2k rows, sync path)
       ┌────────────────────────────────────┐
       │                                    ▼
   [UPLOADED] ──pre-scan ok──► (parser inline) ──► [PREVIEWED] ──user-commit──► [COMMITTING] ──tx ok──► [COMMITTED]
       │                                    │                                                          │
       │ pre-scan fail (>2k rows, async path)│                                            tx partial──► [PARTIALLY_COMMITTED]
       │                                    ▼
       ▼                              [PARSING] ──setImmediate parse done──► [PREVIEWED]
   [FAILED]                                │
   (UNSAFE_XML,                            │ orphan >5 min (no progress)
    UNSAFE_ARCHIVE,                        ▼
    PARSE_TIMEOUT,                     [FAILED]   (cleanup cron, code=PARSE_TIMEOUT)
    PARSE_FAILED)

   [UPLOADED|PARSING|PREVIEWED] ──DELETE /:id──► [CANCELLED]
   [PREVIEWED] ──>7d unconfirmed──► (hard-deleted by cron)
   [COMMITTED] ──>90d──► (hard-deleted; audit retained)
```

**Terminal states:** `COMMITTED`, `PARTIALLY_COMMITTED`, `FAILED`, `CANCELLED`. Only `COMMITTED`/`PARTIALLY_COMMITTED` keep `createdPartyIds`. `commitToken` exists only in `PREVIEWED`; nulled at `COMMITTING` transition.

**Active-job invariant:** at most one job per business in `{UPLOADED, PARSING, PREVIEWED, COMMITTING}`. Enforced by:
```sql
SELECT id FROM "ImportJob"
WHERE "businessId" = $1
  AND status IN ('UPLOADED','PARSING','PREVIEWED','COMMITTING')
LIMIT 1 FOR UPDATE;
```
inside the upload tx; if row exists → 409 `ACTIVE_JOB_EXISTS`.

**Orphan-PARSING cleanup:** cron step 4 — `UPDATE ImportJob SET status='FAILED', updatedAt=now()` where `status='PARSING' AND updatedAt < now() - interval '5 min'`. Runs hourly; max staleness 1h. Acceptable per SCOPE Risk #4.

---

## 6. Concurrency & commit transaction model

### 6.1 Commit tx (commit.service.ts)

```text
BEGIN
  pg_advisory_xact_lock(hashtext('import-commit')::int4, hashtext(:businessId)::int4)   -- 1 concurrent commit per business; hashtext (not hash) is the real PG fn
  SELECT * FROM "ImportJob" WHERE id = :id AND "businessId" = :biz FOR UPDATE
  ASSERT status = 'PREVIEWED' AND commitToken = :provided ELSE ROLLBACK → 409 BAD_COMMIT_TOKEN
  UPDATE "ImportJob" SET status='COMMITTING', commitToken=NULL, updatedAt=now()
  -- chunked processing
  FOR chunk_offset IN 0, 500, 1000, ...:
    SELECT id, normalized, matchedPartyId FROM "ImportJobRow"
      WHERE jobId=:id
        AND status IN ('STAGED')                       -- preview-time terminal-include
        AND id NOT IN (:skipRowIds)
        AND createdPartyId IS NULL                     -- row-level guard
      ORDER BY sourceIndex
      LIMIT 500
      FOR UPDATE;                                      -- row-lock the chunk
    For each locked row:
      INSERT INTO "Party" (... importJobId, importedBy) VALUES (...) RETURNING id;
      IF normalized.openingBalance != 0:
        partyOpeningBalance.service.create(...) -- INSIDE this tx
      UPDATE "ImportJobRow" SET status='COMMITTED', createdPartyId=:partyId
        WHERE id=:rowId AND status='STAGED' AND createdPartyId IS NULL;
      -- the WHERE clause + @unique constraint = belt-and-suspenders idempotency
    audit.emit('parties.imported', ...)
  END FOR
  UPDATE "ImportJob" SET status='COMMITTED' (or 'PARTIALLY_COMMITTED'), committedAt=now(),
    expiresAt=now()+90d, createdPartyIds=:idsArray, counts=:countsJson
  audit.emit('import_job.committed', { jobId, committedCount, partyIds: ids.slice(0,100) })
COMMIT
```

Why this is safe under retry:
1. `pg_advisory_xact_lock` serialises two commits for the same business — second waits, then sees `status='COMMITTING'` and bails with 409.
2. `idempotencyCheck` middleware catches the more common "client retries with same Idempotency-Key" → returns cached response, never re-enters the handler.
3. `commitToken` single-use catches the "client retries without Idempotency-Key but with same token" → 409 `BAD_COMMIT_TOKEN`.
4. Row-level `WHERE status='STAGED' AND createdPartyId IS NULL` + `@unique createdPartyId` catches the "tx half-committed and replayed" pathology — already-bound rows are filtered out, can't double-bind.

OpeningBalance ledger insertion is in the same tx + same guard → no double ledger entries on retry.

### 6.2 Chunk size rationale

500 rows/tx empirically caps lock duration <2s on Render Starter (sourced from DH bulk-payment-import). Larger chunks risk lock contention with concurrent reads on `Party`; smaller chunks waste round-trip cost. 10k rows ÷ 500 = 20 chunks → ~40s total commit time, well inside FE timeout (the FE polls during `COMMITTING`).

---

## 7. Sync vs async parse — measured budget

Render Starter HTTP timeout: 30s.

### 7.1 Sync path (≤2,000 estimated rows)

| Phase | Budget | Notes |
|-------|--------|-------|
| Upload (multipart, 10MB worst) | 5s | network |
| Pre-scan (XXE / zip-bomb) | <200ms | byte-level regex / `yauzl` enumerate |
| Parse | ≤5s | wrapped in 10s `Promise.race` — exceeds → `PARSE_TIMEOUT` |
| Normalize + dedup | ≤5s | dedup is per-business `Party` table scan filtered by phone-suffix bucket |
| Response serialise | ≤5s | bounded by `counts` + first 50 row preview |
| **Total** | **≤20s** | **15s slack vs Render 30s cap** |

Returns HTTP **200** with `status='PREVIEWED'`, `commitToken`, `counts`.

### 7.2 Async-poll path (>2,000 to 10,000 rows)

1. Handler returns HTTP **202** with `{ jobId, status:'PARSING', commitToken: null }` immediately after pre-scans pass.
2. Same Node process queues parse via `setImmediate(() => runParse(jobId))` — no worker, no external queue.
3. `runParse` invokes parser + normalize + dedup, then `UPDATE ImportJob SET status='PREVIEWED', commitToken=cuid(), counts=...`.
4. FE polls `GET /api/imports/:id` every 2s (POLL_INTERVAL_MS=2000); when `status='PREVIEWED'`, navigate to preview.
5. If the dyno cycles mid-parse, the job stays in `PARSING`. The cron's step-4 (5-min orphan reaper) flips it to `FAILED PARSE_TIMEOUT` within ≤1h. FE polling will surface `FAILED` and prompt re-upload.

**Trade-off acknowledged in SCOPE Accepted Trade-offs:** Real background worker is 7.1E. >10k rows is rejected at the rowCount check before parse (413 `FILE_TOO_LARGE`).

---

## 8. Feature flag

### 8.1 Wiring

- **Backend:** `FEATURE_DATA_IMPORT` env-var read in `src/lib/env.ts`; per-business override via `business.featureFlags.DATA_IMPORT` JSONB column (existing pattern). `requireFeature('DATA_IMPORT')` middleware returns **404** (not 403) on disabled — don't leak the flag's existence.
- **Frontend:** `VITE_FEATURE_DATA_IMPORT` env-var + per-business flag from `/me` response. Hides Settings → Data Import row and lazy-loads the feature bundle only when the flag is true (saves ~80KB gzipped from initial bundle).

### 8.2 Gate every route, including `/upload`

The SCOPE language (L81) says *"UI hidden unless `FEATURE_DATA_IMPORT=true`"*
and the acceptance criterion (L634) says *"`FEATURE_DATA_IMPORT=false` business → `GET /api/imports` returns 404; UI nav row hidden"*. The architect's choice: **all** `/api/import/*` routes (including `POST /api/imports`, the "upload" route) are behind `requireFeature('DATA_IMPORT')`.

Rationale: when cohort=0 in 7.1A through 7.1C ship, the feature is gated end-to-end. Leaving upload reachable would let a determined client probe + create `ImportJob` rows in flag-disabled businesses, generating audit noise and consuming the active-job slot. The 404 envelope keeps probes uninformative. The build-agent prompt floated "actually leave upload reachable so user can verify gate" — that's a test-environment concern, not a production one; QA tests with `FEATURE_DATA_IMPORT=true` for the test business (SCOPE Test Infrastructure §, L568).

### 8.3 Cohort rollout

| Stage | Audience | Flag | Verify before next |
|-------|----------|------|--------------------|
| Internal | Sawan's business only | `business.featureFlags.DATA_IMPORT=true` for one business | golden 4-fixture import, screenshots |
| Pilot | 3-5 design-partner businesses | per-business flag flip via admin tool | 1 week, error rate < 0.5%, cleanup cron green |
| Cohort 10% | hash(businessId)%10===0 | server-side cohort gate | 48h dashboards, no DPDP escalation |
| 100% | all | env `FEATURE_DATA_IMPORT=true` | watch errors 7d |

Until 7.1D (Payments) ships, default cohort = **0**. Internal + pilot only.

---

## 9. DPDP retention & erasure

### 9.1 24h raw-PII purge (cron step 1)

```ts
// scripts/cleanup-expired-import-jobs.cron.ts (excerpt of contract — no code)
// Step 1: NULL raw + normalized 24h post-commit
//   UPDATE "ImportJobRow"
//   SET raw = NULL, normalized = NULL
//   WHERE jobId IN (
//     SELECT id FROM "ImportJob"
//     WHERE committedAt IS NOT NULL
//       AND committedAt < now() - interval '24 hours'
//       AND EXISTS (SELECT 1 FROM "ImportJobRow" r WHERE r.jobId = "ImportJob".id AND (r.raw IS NOT NULL OR r.normalized IS NOT NULL))
//   );
```

The audit-row shell (`ImportJobRow` with `sourceIndex`, `status`, `createdPartyId`) is preserved for forensic linkage; only the PII-bearing JSON columns are NULLed. Audit log keeps a 90d window separately.

Cron schedule: Render scheduled job, hourly (`0 * * * *`). 4 steps in order (per SCOPE Data Model L286-291):

1. NULL raw/normalized 24h post-commit
2. Hard-delete `ImportJob` (cascades rows) for `status='COMMITTED' AND expiresAt < now()` (90d)
3. Hard-delete `ImportJob` for `status IN ('PREVIEWED','UPLOADED') AND expiresAt < now()` (7d)
4. `UPDATE status='FAILED'` for orphan `PARSING` >5min
5. Silent-no-op detect: if `rowsNulled + jobsDeleted == 0` but `count(eligible) > 0` → emit `import_cleanup.no_rows_processed` metric + Sentry P3

### 9.2 Erasure cascade

`services/import/erasure.ts` exports `eraseImportData(userId)`:

```text
Called by: services/user-erasure.service.ts (existing) on DPDP §13 request.
If user-erasure.service.ts doesn't exist yet, this slice MUST add it (SCOPE Cross-feature Impact L607).

Steps (in tx):
  1. find Party.ids where importedBy = :userId OR (parties already erased for principal — caller has the list)
  2. UPDATE ImportJobRow SET raw=NULL, normalized=NULL WHERE createdPartyId IN (:partyIds)
  3. UPDATE ImportJob SET fileName=NULL WHERE userId = :userId
  4. audit.emit('data_principal.erased', { userId, affectedJobIds: [...], affectedRowCount })
```

The `ImportJobRow` shell row stays, since `sourceIndex` + `createdPartyId` are operational metadata, not PII.

---

## 10. Audit coverage

Seven action keys + per-party row, per SCOPE Security L505-515. All emitted from `services/import/audit.ts`:

| Action | Triggered by | Payload |
|--------|-------------|---------|
| `import_job.uploaded` | upload route after pre-scans | `{ jobId, fileSha256, fileSize, format, fileName }` |
| `import_job.parsed` | parse complete (sync + async) | `{ jobId, parsedRowCount, errorRowCount, warningRowCount, durationMs }` |
| `import_job.row_dropped` | per-row drop in preview | `{ jobId, rowId, sourceIndex }` |
| `import_job.dedup_resolved` | per near-dup decision | `{ jobId, rowId, choice, matchedPartyId }` |
| `import_job.committed` | commit tx success | `{ jobId, committedCount, partyIds: ids.slice(0,100) }` |
| `import_job.cancelled` | DELETE route | `{ jobId, stageAtCancel }` |
| `import_job.expired` | cleanup cron hard-delete | `{ jobId, ageDays }` |
| `parties.imported` | inside commit tx, per row | `{ partyId, jobId, sourceIndex }` |

The `enforce-audit-coverage.mjs --block` gate scans `services/import/**` for unconditional calls to `audit.emit('<action_key>', ...)` at each lifecycle transition. Failure to emit any of the seven = build fails.

---

## 11. State machine summary (FE-facing)

| State | Visible UI | Transitions |
|-------|------------|-------------|
| `UPLOADED` | brief; user sees skeleton | → PARSING (async) / PREVIEWED (sync) / FAILED |
| `PARSING` | "Parsing in background…" with poll spinner | → PREVIEWED / FAILED (orphan timeout) |
| `PREVIEWED` | preview tabs + bucket cards | → COMMITTING (user commits) / CANCELLED |
| `COMMITTING` | "Importing… N of M" progress | → COMMITTED / PARTIALLY_COMMITTED |
| `COMMITTED` | summary green check | terminal |
| `PARTIALLY_COMMITTED` | summary with download-remaining CSV | terminal |
| `FAILED` | error state, format-guide link | terminal |
| `CANCELLED` | landing page list shows "Cancelled" badge | terminal |

---

## 12. Performance budget

| Metric | Target | Hard fail |
|--------|--------|-----------|
| LCP (ImportLandingPage) | < 2.5s on 4G | > 4s |
| INP (preview tab switch) | < 200ms | > 500ms |
| CLS | < 0.1 | > 0.25 |
| Initial JS bundle (gzipped) | ≤ 200KB | > 300KB |
| **Per-route chunk for `/import/*`** (gzipped, lazy-loaded) | **≤ 100KB** | > 150KB |
| Server TTFB upload→200 (sync path, 500 rows) | < 8s p95 | > 20s |
| Server TTFB upload→202 (async path) | < 1s p95 | > 3s |
| DB query p95 (`SELECT FOR UPDATE` ImportJob) | < 100ms | > 500ms |
| Commit chunk tx (500 rows) | < 2s p95 | > 5s |

**Bundle plan:** entire `src/features/import/**` is React.lazy() loaded behind the Settings → Data Import nav row. No bundle cost for users without the flag.

---

## 13. File Plan — HARD GATE

> Every row ≤ 250 lines estimated. If a responsibility threatened >250L, it's split into its own row.

### Backend (`server/src/`)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|------|--------|------------|-------|-------------|
| 1 | `prisma/schema.prisma` (additions: ImportJob, ImportJobRow, Party.importJobId, Party.importedBy + indexes) | edit | ~70 | schema | API.0 |
| 2 | `prisma/migrations/<ts>_import_jobs/migration.sql` | create | ~90 | migration | API.0 |
| 3 | `src/types/import.types.ts` | create | ~100 | types | API.1 |
| 4 | `src/constants/import.constants.ts` (SYNC_PARSE_CAP=2000, XXE_SCAN_BYTES=65536, XLSX_MAX_UNCOMPRESSED=100MB, XLSX_MAX_RATIO=100, CHUNK_SIZE=500, RAW_RETENTION_HOURS=24, IMPORT_RATE_UPLOAD_PER_HOUR=5, IMPORT_RATE_UPLOAD_PER_DAY=20, IMPORT_LOCKOUT_FAILED_THRESHOLD=3, IMPORT_LOCKOUT_WINDOW_MIN=10, IMPORT_LOCKOUT_COOLDOWN_MIN=60, IMPORT_MIN_CLIENT_VERSION='7.1.0', ORPHAN_PARSING_REAP_MIN=5) | create | ~85 | constants | API.1 |
| 5 | `src/schemas/import.schemas.ts` (Zod `.strict()`) | create | ~120 | schema | API.1 |
| 6 | `src/services/import/security/xxe-prescan.ts` | create | ~80 | security | API.2 |
| 7 | `src/services/import/security/zip-bomb-prescan.ts` (yauzl enumerate) | create | ~100 | security | API.2 |
| 8 | `src/services/import/security/csv-injection.ts` (OWASP prefix-quote util) | create | ~50 | utils | API.2 |
| 9 | `src/services/import/normalizers/party-normalizer.ts` (phone E.164, GSTIN, OB paise+sign) | create | ~180 | service | API.2 |
| 10 | `src/services/import/parsers/parser.types.ts` (shared `Parser` interface) | create | ~50 | types | API.2 |
| 11 | `src/services/import/parsers/tally-xml.parser.ts` (fast-xml-parser, `processEntities:false`, 10s race) | create | ~220 | transport | API.3 |
| 12 | `src/services/import/parsers/vyapar-csv.parser.ts` | create | ~150 | transport | API.3 |
| 13 | `src/services/import/parsers/busy-excel.parser.ts` (xlsx first-sheet, after zip-bomb prescan) | create | ~180 | transport | API.3 |
| 14 | `src/services/import/parsers/generic-csv.parser.ts` (mapping-driven) | create | ~160 | transport | API.3 |
| 15 | `src/services/import/dedup/exact-dedup.ts` (phone+name OR GSTIN, businessId-scoped) | create | ~120 | service | API.3 |
| 16 | `src/services/import/dedup/near-dedup.ts` (Levenshtein ≤2 within phone-suffix bucket) | create | ~140 | service | API.3 |
| 17 | `src/services/import/audit.ts` (7 action emitters + per-party) | create | ~120 | service | API.3 |
| 18 | `src/services/import/erasure.ts` (DPDP cascade hook) | create | ~80 | service | API.3 |
| 19 | `src/services/import/import-job.service.ts` (job CRUD, active-job check, commitToken issuance, parse orchestration + setImmediate) | create | ~230 | service | API.4 |
| 20 | `src/services/import/commit.service.ts` (FOR UPDATE, advisory lock, chunked tx, row-level guard, ledger inside tx) | create | ~240 | service | API.4 |
| 21 | `src/middleware/import-rate-limit.ts` (token bucket per (businessId,userId) for uploads; per businessId for commits) | create | ~90 | middleware | API.5 |
| 22 | `src/middleware/require-min-client-version.ts` | create | ~40 | middleware | API.5 |
| 23 | `src/middleware/require-feature.ts` (or `feature-flag.ts` edit if exists — reuses existing pattern) | edit | ~40 | middleware | API.5 |
| 24 | `src/routes/imports/create.route.ts` (POST multipart, sync OR 202) | create | ~150 | route | API.6 |
| 25 | `src/routes/imports/get.route.ts` (GET, paginated rows) | create | ~90 | route | API.6 |
| 26 | `src/routes/imports/commit.route.ts` (POST commit, idempotency, commitToken) | create | ~120 | route | API.6 |
| 27 | `src/routes/imports/cancel.route.ts` (DELETE) | create | ~60 | route | API.6 |
| 28 | `src/routes/imports/list.route.ts` (GET paginated, uploader-scoped on FE) | create | ~80 | route | API.6 |
| 29 | `src/routes/imports/index.ts` (wiring) | create | ~30 | route | API.6 |
| 30 | `src/scripts/cleanup-expired-import-jobs.cron.ts` (5-step cron, --dry-run, silent-no-op metric) | create | ~150 | script | API.7 |
| 31 | `src/lib/env.ts` (add `FEATURE_DATA_IMPORT`) | edit | ~10 | env | API.1 |
| 32 | `tests/fixtures/import/tally-sample.xml` | create | n/a | fixture | API.7 |
| 33 | `tests/fixtures/import/vyapar-sample.csv` | create | n/a | fixture | API.7 |
| 34 | `tests/fixtures/import/busy-sample.xlsx` | create | n/a | fixture | API.7 |
| 35 | `tests/fixtures/import/generic-sample.csv` | create | n/a | fixture | API.7 |
| 36 | `tests/fixtures/import/malicious-billion-laughs.xml` | create | n/a | fixture | API.7 |
| 37 | `tests/fixtures/import/malicious-zip-bomb.xlsx` | create | n/a | fixture | API.7 |
| 38 | `tests/fixtures/import/csv-injection-sample.csv` | create | n/a | fixture | API.7 |
| 39 | `tests/unit/import/xxe-prescan.test.ts` (pre-scan unit; happy + billion-laughs) | create | ~120 | test | API.7 |
| 40 | `tests/unit/import/zip-bomb-prescan.test.ts` | create | ~120 | test | API.7 |
| 41 | `tests/unit/import/csv-injection.test.ts` | create | ~60 | test | API.7 |
| 42 | `tests/unit/import/party-normalizer.test.ts` | create | ~180 | test | API.7 |
| 43 | `tests/unit/import/parsers-tally.test.ts` (happy + malicious) | create | ~140 | test | API.7 |
| 44 | `tests/unit/import/parsers-vyapar.test.ts` | create | ~120 | test | API.7 |
| 45 | `tests/unit/import/parsers-busy.test.ts` (happy + zip-bomb) | create | ~140 | test | API.7 |
| 46 | `tests/unit/import/parsers-generic.test.ts` | create | ~120 | test | API.7 |
| 47 | `tests/integration/import-parties.test.ts` (round-trip 100-row CSV → preview → commit → 100 parties; + 4 error + dedup + idempotent-commit + CSV-injection + DPDP cascade) | create | ~250 | test | API.7 |

### Frontend (`src/`)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|------|--------|------------|-------|-------------|
| 48 | `src/features/import/import.types.ts` (mirror BE) | create | ~90 | types | FE.1 |
| 49 | `src/features/import/import.constants.ts` (format labels, copy keys, POLL_INTERVAL_MS=2000) | create | ~50 | constants | FE.1 |
| 50 | `src/features/import/import.utils.ts` (formatting, bucket-tab logic) | create | ~120 | utils | FE.2 |
| 51 | `src/features/import/import.service.ts` (`api()` w/ `excludeFromOfflineQueue:true`, `entityType:'import'`, `entityLabel:fileName`) | create | ~190 | service | FE.2 |
| 52 | `src/features/import/useImportJob.ts` (TanStack query + 2s polling on PARSING/COMMITTING) | create | ~160 | hook | FE.3 |
| 53 | `src/features/import/useColumnAutodetect.ts` (header heuristic, generic CSV) | create | ~120 | hook | FE.3 |
| 54 | `src/features/import/components/RowBucketCard.tsx` | create | ~110 | component | FE.4 |
| 55 | `src/features/import/components/RowIssueChip.tsx` | create | ~80 | component | FE.4 |
| 56 | `src/features/import/components/ColumnMapper.tsx` | create | ~180 | component | FE.4 |
| 57 | `src/features/import/components/DedupSideBySide.tsx` | create | ~160 | component | FE.4 |
| 58 | `src/features/import/components/CommitProgressBar.tsx` | create | ~90 | component | FE.4 |
| 59 | `src/features/import/components/FormatGuideDrawer.tsx` | create | ~140 | component | FE.4 |
| 60 | `src/features/import/components/ReUploadWarning.tsx` (counts-only, no PII) | create | ~70 | component | FE.4 |
| 61 | `src/features/import/pages/ImportLandingPage.tsx` (uploader-scoped jobs list) | create | ~140 | page | FE.5 |
| 62 | `src/features/import/pages/ImportUploadPage.tsx` (drag-drop, offline banner blocks) | create | ~150 | page | FE.5 |
| 63 | `src/features/import/pages/ImportMappingPage.tsx` (generic CSV) | create | ~150 | page | FE.5 |
| 64 | `src/features/import/pages/ImportPreviewPage.tsx` (bucket tabs) | create | ~150 | page | FE.5 |
| 65 | `src/features/import/pages/ImportDedupReviewPage.tsx` | create | ~150 | page | FE.5 |
| 66 | `src/features/import/pages/ImportSummaryPage.tsx` (post-commit, partial-CSV download) | create | ~120 | page | FE.5 |
| 67 | `src/features/import/import.css` (tokens-only) | create | ~180 | css | FE.5 |
| 68 | `src/lib/translations.en.ts` (`import.*` keys) | edit | ~80 | translation | FE.1 |
| 69 | `src/lib/translations.hi.ts` (hi-IN) | edit | ~80 | translation | FE.1 |
| 70 | `src/config/feature-flags.ts` (export `DATA_IMPORT`) | edit | ~10 | config | FE.1 |
| 71 | `src/lib/api.ts` (add `excludeFromOfflineQueue?: boolean` option; one-line route to skip queue) | edit | ~10 | infra | FE.1 |
| 72 | `src/routes/index.tsx` (React.lazy mount `/settings/data-import/*` behind flag) | edit | ~20 | router | FE.5 |
| 73 | `src/features/settings/SettingsNav.tsx` (add Data Import row, gated by flag) | edit | ~15 | nav | FE.5 |

**Total: 73 files (47 BE + 26 FE).** Max estimated row: 250 lines (integration test). All other rows ≤ 240L.

**Build-phase ordering:**
- **API.0** schema/migration — clears the high-risk-path gate first.
- **API.1** types, constants, schemas, env — no logic.
- **API.2** security pre-scan + normalizer (pure functions, fully unit-tested before integration).
- **API.3** parsers + dedup + audit + erasure.
- **API.4** orchestration services (import-job + commit).
- **API.5** middleware.
- **API.6** routes (composition only).
- **API.7** cron + fixtures + tests.
- **FE.1** types/constants/translations/flag/api.ts.
- **FE.2** utils + service.
- **FE.3** hooks.
- **FE.4** components.
- **FE.5** pages + css + router + nav.

Build agent's first action: `git status` on the 73 paths (all should not exist except edits 1, 31, 68-73), then `Write` empty stubs (imports + exports) for every create-row in phase order.

---

## 14. SCOPE Conformance Map — HARD GATE

| SCOPE decision | Architecture artifact | Status |
|----------------|----------------------|--------|
| MUST_SHIP: 4 source formats | File Plan #11-14 (one parser file per format) | OK |
| MUST_SHIP: staged-row preview | `ImportJobRow` model §2.2 + commit row-level guard §6.1 | OK |
| MUST_SHIP: phone + GSTIN exact dedup; near-dupes flagged | File Plan #15-16, dedup/exact-dedup.ts + near-dedup.ts | OK |
| MUST_SHIP: chunked commit 500 rows/tx | §6.1 + `CHUNK_SIZE=500` constant (File Plan #4) | OK |
| MUST_SHIP: ImportJob/ImportJobRow rollback model + auto-purge | §2 model + §9.1 cleanup cron (File Plan #30) | OK |
| MUST_SHIP: feature flag, cohort=0 | §8 + File Plan #23, #31, #70 | OK |
| MUST_SHIP: 7-action audit coverage | §10 + File Plan #17 audit.ts | OK |
| MUST_SHIP: idempotent commit via commitToken | §6.1 + `commitToken` column §2.1 + idempotencyCheck middleware §3 | OK |
| MUST_SHIP: business-scoped tenancy (`req.activeBusiness.id`) | §3 middleware composition + §2.4 invariants | OK |
| MUST_SHIP: XXE defence | File Plan #6 xxe-prescan.ts + parser `processEntities:false` (§4.2) + 10s timeout (§4.1) | OK |
| MUST_SHIP: zip-bomb defence | File Plan #7 zip-bomb-prescan.ts (yauzl) | OK |
| MUST_SHIP: CSV-injection defence | File Plan #8 csv-injection.ts (OWASP prefix-quote) | OK |
| MUST_SHIP: 24h raw-PII retention | §9.1 cron step 1 + File Plan #30 | OK |
| MUST_SHIP: reserved test fixtures (4 golden + 3 malicious) | File Plan #32-38 | OK |
| SHOULD_SHIP: generic CSV column-mapping wizard | File Plan #56 ColumnMapper.tsx + #53 useColumnAutodetect | OK |
| SHOULD_SHIP: opening balance paise normalization | File Plan #9 party-normalizer.ts | OK |
| SHOULD_SHIP: per-row error CSV (injection-safe) | File Plan #8 csv-injection.ts applied in commit.service partial-error path | OK |
| SHOULD_SHIP: `excludeFromOfflineQueue:true` | File Plan #51 import.service + #71 api.ts | OK |
| SHOULD_SHIP: re-upload counts-only warning | File Plan #60 ReUploadWarning.tsx | OK |
| SHOULD_SHIP: business_id metrics labels | §10 + observability emitters in audit.ts | OK |
| SHOULD_SHIP: cleanup-cron silent-no-op metric | §9.1 step 5 + File Plan #30 | OK |
| SHOULD_SHIP: lockout cooldown (businessId,userId) | File Plan #21 import-rate-limit.ts | OK |
| API contract: POST /api/imports sync OR 202 | §7.1 + 7.2 + File Plan #24 create.route.ts | OK |
| API contract: GET /api/imports/:id paginated rows | File Plan #25 get.route.ts | OK |
| API contract: POST /api/imports/:id/commit | File Plan #26 commit.route.ts + §6.1 | OK |
| API contract: DELETE /api/imports/:id | File Plan #27 cancel.route.ts | OK |
| API contract: GET /api/imports list (uploader-scoped) | File Plan #28 list.route.ts + #61 ImportLandingPage | OK |
| Error code: FEATURE_DISABLED → 404 | §8.2 (404 not 403; don't leak flag) | OK |
| Error code: UPGRADE_REQUIRED 426 | File Plan #22 require-min-client-version.ts | OK |
| Error code: ACTIVE_JOB_EXISTS 409 | §5 active-job invariant + File Plan #19 import-job.service.ts | OK |
| Error code: BAD_COMMIT_TOKEN 409 | §6.1 commit tx step 3 | OK |
| Error code: CONCURRENT_COMMIT 409 | §6.1 advisory lock | OK |
| Error code: UNSAFE_XML / UNSAFE_ARCHIVE | File Plan #6, #7 | OK |
| Error code: PARSE_TIMEOUT | §4.1 10s race wrapper | OK |
| 7-day STAGED + 90d terminal retention | §2.1 `expiresAt` + §9.1 cron step 2-3 | OK |
| Orphan-PARSING 5min cleanup | §5 + §9.1 cron step 4 | OK |
| 4 UI states (loading/error/empty/success) | §15 (4-state matrix per FE page) | OK |
| Mobile-first 320/375 | §15 + File Plan #67 import.css tokens-only | OK |
| All 4 FE mutations via `api()` | File Plan #51 import.service.ts (audit pattern in OFFLINE_RULES) | OK |
| `entityType:'import'` + `entityLabel:fileName` | File Plan #51 + #71 api.ts | OK |
| Translations EN + HI | File Plan #68, #69 | OK |
| `enforce-audit-coverage.mjs --block` passes | §10 + acceptance gate in §17 | OK |
| Capacitor file picker fallback | File Plan #62 ImportUploadPage.tsx (uses native `<input type=file>` w/ accept MIME) | OK |
| DPDP erasure cascade `eraseImportData(userId)` | §9.2 + File Plan #18 erasure.ts | OK |
| Analytics events × 7 | §10 audit + observability emitters | OK |

**No `MISSING` rows. No `DEVIATED` rows.** All SCOPE MUST_SHIP and SHOULD_SHIP decisions have a concrete architecture artifact.

---

## 15. UI states per FE page (4-state matrix)

| Page | Loading | Empty | Error | Success |
|------|---------|-------|-------|---------|
| `ImportLandingPage` | `<ListSkeleton rows={3}/>` | `<EmptyState title="No imports yet" action="Start import"/>` | `<ErrorState onRetry/>` | jobs list + sticky Start-import CTA |
| `ImportUploadPage` | `<CommitProgressBar/>` "Reading your file…" → switches to "Parsing in background — this may take a minute" w/ spinner for >2k | drop zone w/ "Drag your file here, or tap to choose" | format-specific copy per SCOPE UX table (UNSAFE_XML, FILE_TOO_LARGE, etc.) | navigates to mapping or preview |
| `ImportMappingPage` | brief — instantaneous | n/a | `MAPPING_INVALID` toast | column mapper + Confirm |
| `ImportPreviewPage` | TanStack pending | "Nothing to import" if all rows ERROR | FAILED → format-guide link | bucket tabs + paginated row list |
| `ImportDedupReviewPage` | pending | "No near-duplicates" | inherits PreviewPage error | accept/reject pairs |
| `ImportSummaryPage` | `COMMITTING` → progress bar | n/a | `PARTIALLY_COMMITTED` → download error CSV (CSV-injection-safe) | green check + View imported parties |

Every page tested at 320px (no horizontal overflow) and 375px (hp-design audit). Dark mode parity automatic via `tokens-dark.css`.

---

## 16. Failure-Mode Implementation

Maps SCOPE's 7-scenario Failure Mode Walkthrough to architecture sites.

| Failure mode | SCOPE mitigation | Architecture site |
|--------------|------------------|-------------------|
| 1. Provider/dependency outage (Postgres) | upload returns 503; in-flight resume idempotent via commitToken | §6.1 commit tx + idempotencyCheck middleware (§3); upload route's `requireActiveBusiness` returns 503 if DB unreachable |
| 2. Abuse spike (100 × 10k uploads) | per-business 5/h, 20/d; 1 active job; 409 on 2nd upload | File Plan #21 import-rate-limit.ts + §5 active-job SELECT FOR UPDATE in import-job.service.ts |
| 3. DB bloat (100M ImportJobRow) | hourly cleanup cron + silent-no-op metric | File Plan #30 cleanup-expired-import-jobs.cron.ts + §9.1 |
| 4. Client-version lag | clientVersion ≥ 7.1.0; 426 UPGRADE_REQUIRED | File Plan #22 require-min-client-version.ts |
| 5. Regulatory / DPDP §13 erasure | full cascade runbook + eraseImportData(userId) hook | File Plan #18 erasure.ts + §9.2 |
| 6. Cost runaway (DB CPU during commit) | 500/tx chunks; advisory lock 1 commit/business | §6.1 + `CHUNK_SIZE` constant File Plan #4 |
| 7. Insider abuse | importedBy + importJobId on every Party; immutable audit | §2.3 Party additions + §10 audit (7 actions + per-party `parties.imported`) |

---

## 17. Acceptance gates (architecture-level)

Build agents must clear these before declaring a phase done:

| Gate | Tool | Phase |
|------|------|-------|
| `npx tsc -b --noEmit` (BE) clean | tsc | end of API.6 |
| `npx tsc --noEmit` (FE) clean | tsc | end of FE.5 |
| `node scripts/enforce.js` clean | enforce.js | every commit |
| `node scripts/enforce-offline.mjs` exit 0 | enforce-offline | end of FE.2 |
| `node scripts/enforce-audit-coverage.mjs --block` exit 0 | audit coverage | end of API.4 |
| Parser unit tests (4 formats × happy/malicious) | jest | end of API.3 |
| Pre-scan unit tests (xxe, zip-bomb, csv-injection) | jest | end of API.2 |
| Normalizer unit tests | jest | end of API.2 |
| Integration test (100-row CSV → preview → commit → 100 parties + idempotent-commit + CSV-injection + DPDP cascade) | jest | end of API.7 |
| curl matrix (SCOPE QA Checklist, lines 667-683) | bash | end of API.6 |
| Screenshots × 6 FE pages × 4 states = 24 frames @ 375px | playwright | end of FE.5 |
| 320px overflow test passes | playwright | end of FE.5 |
| Lighthouse on `ImportLandingPage` ≥ 90 perf | lighthouse | end of FE.5 |
| Per-route chunk `/import/*` ≤ 100KB gzipped | perf-budget.js | end of FE.5 |

If any gate fails, build agent halts and returns evidence to /mission orchestrator. No "fix forward" past a red gate.

---

## 18. Open questions for architecture-auditor

None expected. The architecture is a faithful elaboration of the v2 SCOPE (which scope-auditor PASSed with 0 gaps). The two judgement calls made by the architect:

1. **Feature flag covers `/upload` too** (§8.2). Rationale: cohort=0 in 7.1A-C means no production user has access; QA uses `FEATURE_DATA_IMPORT=true` for the test business. Reverse decision = trivial 1-line middleware swap if auditor or product objects.
2. **No explicit `commitToken` TTL column** — TTL is implicit (cleared on COMMITTING, otherwise bounded by 7d STAGED expiresAt). scope-auditor v2 noted this is fine; architect concurs.

---

## 19. Deviations from SCOPE

None. Every SCOPE decision is implemented as written. If the auditor flags a deviation, it's a bug in this document.

---

## 20. Revision Log

**2026-05-18 v1** (initial draft) — written against SCOPE v2 (scope-auditor PASS, 0 gaps). 73-file plan, all rows ≤ 250L estimated. Next agent: architecture-auditor.
