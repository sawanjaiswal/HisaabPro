# SCOPE — Phase 7 #149 · Slice 7.1A — Parties Import

> Tally XML + Vyapar CSV + Busy Excel + Generic CSV (with field mapping).
> Parties entity only. Products/Invoices/Payments deferred to 7.1B-D.
> Behind `FEATURE_DATA_IMPORT` env flag, cohort=0 in MVP.

---

## Revision history

**2026-05-18 v2** — addressed 9 MUST_SHIP gaps from
`docs/SCOPE_AUDIT_PHASE7_IMPORT_7_1A_PARTIES.md`:
(1) replaced all `tenantId` / `req.user.tenantId` with `businessId` /
`req.activeBusiness.id` and corrected user identity to `req.user.userId`
(SSOT: `server/src/middleware/require-active-business.ts`); (2) added
server-issued `commitToken` + `SELECT FOR UPDATE` on ImportJob + row-level
`status='STAGED' AND createdPartyId IS NULL` guard + integration with
existing `idempotencyCheck` middleware so commit is idempotent under
retry; (3) lowered synchronous-parse cap to 2,000 rows; >2k returns 202
with `PARSING` status and FE polls `GET /api/imports/:id` every 2s;
added `PARSING` status + orphan cleanup; (4) added explicit audit-row
spec for 7 state changes (uploaded, parsed, row_dropped, dedup_resolved,
committed, cancelled, expired) to satisfy `enforce-audit-coverage.mjs
--block`; (5) added byte-level XXE pre-scan
(`/<!DOCTYPE|<!ENTITY/i` over first 64KB) + 10s parser timeout via
`Promise.race`; (6) added `yauzl` zip-bomb pre-scan on .xlsx
(uncompressedSize ≤100MB AND ratio ≤100); (7) added OWASP CSV-injection
prefix-quoting for `= + - @ \t \r` in downloadable error CSV; (8) cut
`ImportJobRow.raw`/`.normalized` retention to 24h post-commit (audit
shell kept 90d) with DPDP rationale; (9) beefed up failure scenarios
4 (concurrent uploads → 1 active job per business, 2nd → 409) and 5
(DPDP erasure cascade runbook). SHOULD_SHIP items addressed inline:
`excludeFromOfflineQueue: true` on imports, re-upload warning shows
counts only, all metrics use `business_id`, cleanup cron emits
`import_cleanup.no_rows_processed` metric on silent no-op, lockout
cooldown scoped to `(businessId, userId)`.

---

## Summary

Migrate a business's parties (customers + suppliers) from their previous
billing software into HisaabPro in one self-serve flow. Upload → parse →
preview → resolve dedups → commit, with per-row staging so a partial bad
import never half-corrupts the parties list.

## Goals

- [MUST_SHIP] Support 4 source formats: Tally XML, Vyapar CSV, Busy Excel, Generic CSV
- [MUST_SHIP] Staged-row preview before commit; user drops/edits bad rows
- [MUST_SHIP] Phone-based + GSTIN-based exact-dedup; flag near-dupes for review
- [MUST_SHIP] Chunked commit (500 rows/tx) so a 2k-row file never holds a 30s lock
- [MUST_SHIP] `ImportJob`/`ImportJobRow` rollback model — abandoned jobs auto-purge
- [MUST_SHIP] Feature flag `FEATURE_DATA_IMPORT` (BE + FE), cohort=0 default
- [MUST_SHIP] Audit coverage for every state change (7 actions; see Security)
- [MUST_SHIP] Idempotent commit via server-issued `commitToken` + row-level guard
- [MUST_SHIP] Business-scoped tenancy: every query filters by `req.activeBusiness.id`
- [MUST_SHIP] XXE + zip-bomb + CSV-injection defences (see Security)
- [MUST_SHIP] Raw-PII retention ≤24h post-commit (DPDP minimisation)
- [MUST_SHIP] Reserved test fixture files (one per format) usable in CI without burning anything
- [SHOULD_SHIP] Generic CSV column-mapping wizard with auto-detect heuristic + manual override
- [SHOULD_SHIP] Opening balance → paise normalization with Dr/Cr sign handling
- [SHOULD_SHIP] Download a per-row error CSV the user can fix offline + re-upload (CSV-injection-safe)
- [NICE_TO_HAVE] Persist last-used Generic-CSV column mapping per business for re-imports
- [FUTURE_EPIC] Resumable / chunked uploads for >10k rows (7.1E)
- [FUTURE_EPIC] Background-worker offload of parse+commit for >2k rows (7.1E)
- [FUTURE_EPIC] Products/Invoices/Payments slices (7.1B/C/D)

## Personas + One-line Goal

| Persona | Volume | Goal |
|---------|--------|------|
| **Raju** (micro retailer, 50-200 parties) | Vyapar CSV, ~120 rows | Migrate from Vyapar in <10 min without losing supplier opening balances |
| **Priya** (wholesaler, 500-2k parties) | Busy Excel or Tally XML, up to 2k rows | Preview + drop obviously-bad rows (test data, "Cash" placeholders) before commit |
| **Amit** (distributor, 5k-10k parties) | Tally XML or Generic CSV, 2k-10k rows | Async polled import with confidence — needs the dedup report + ability to filter+bulk-delete by `importJobId` if it goes wrong |

## User Flow

### Happy path

1. User on Settings → Data Import (UI hidden unless `FEATURE_DATA_IMPORT=true` for active business)
2. Click "Import Parties" → format picker (Tally XML / Vyapar CSV / Busy Excel / Generic CSV)
3. Drag-drop or pick file (≤10 MB, ≤10k rows enforced client + server)
4. **For Generic CSV only**: mapping wizard — auto-detect Name/Phone/GSTIN/OpeningBalance columns, user confirms or remaps
5. Server creates `ImportJob` (status `UPLOADED`), runs XXE/zip-bomb pre-scan, then:
   - **≤2,000 estimated rows**: parses synchronously → returns 200 with `status='PREVIEWED'` + counts + `commitToken`
   - **>2,000 estimated rows**: returns 202 with `status='PARSING'` + `jobId`; FE polls `GET /api/imports/:id` every 2s until `status='PREVIEWED'`; parse runs in same Node process via `setImmediate` after release of HTTP request
6. Preview screen: counts (`STAGED`, `ERROR`, `WARNING`, `DUPLICATE_EXACT`, `DUPLICATE_NEAR`) + first 50 rows of each bucket, paginated
7. User can: drop individual rows (writes `import_job.row_dropped` audit per drop), accept-near-dupes individually (writes `import_job.dedup_resolved`), or "drop all errors"
8. User clicks "Commit Import" → confirm dialog → POST commit with `commitToken` + `Idempotency-Key`
9. Server applies in chunks of 500 rows/tx with row-level guard `WHERE status='STAGED' AND createdPartyId IS NULL`
10. Summary screen: imported count, skipped count, link to Parties list filtered by `importJobId`
11. `import_job.committed` audit row written (with capped party-id list); per-party `parties.imported` audit rows written; raw PII purged after 24h via cron

### Error / cancel paths

| Where | Behavior |
|-------|----------|
| Upload >10MB or >10k rows | 413 `{ code: 'FILE_TOO_LARGE', message: 'File exceeds 10 MB or 10,000 rows. Split it and try again.' }` |
| Pre-scan rejects DOCTYPE/ENTITY | 400 `{ code: 'UNSAFE_XML', message: "We can't process this XML file." }` |
| Pre-scan rejects zip bomb | 400 `{ code: 'UNSAFE_ARCHIVE', message: "We can't process this file." }` |
| Parse timeout (>10s) | Job status `FAILED` with `PARSE_TIMEOUT` |
| Parse failure (malformed XML, unreadable Excel) | Job status `FAILED`; preview screen shows "Couldn't read this file. Check the format guide and try again." with link to format docs |
| User abandons after preview | Job auto-purged after 7 days unconfirmed |
| User clicks "Cancel Import" on preview | `DELETE /api/imports/:id` → soft cancel, writes `import_job.cancelled` audit, ImportJobRow purged async within 1 hour |
| Commit fails mid-way (chunk N of M failed) | Chunks 1..N-1 stay committed; job marked `PARTIALLY_COMMITTED`; UI shows "Imported A of B. Re-run with the remaining C rows?" + downloadable CSV (formula-injection-safe) of remaining rows |
| Network drops during commit | Client polls `GET /api/imports/:id` on reconnect; status reflects real BE state; re-clicking Commit with the same `commitToken` returns existing job (no re-apply) |
| Re-upload same file | Hash check on (businessId, sha256(file)) → second upload prompt "You imported this file 3 days ago. Continue anyway?" — shows row-counts only, not party names/phones |
| Concurrent upload while another job is active for same business | 409 `{ code: 'ACTIVE_JOB_EXISTS', activeJobId: '...' }` |

## Failure Mode Walkthrough

1. **Provider/dependency outage** — N/A no external provider. Postgres outage → upload returns 503; in-flight jobs resume on reconnect (idempotent via `commitToken`).
2. **Abuse spike** — adversarial business uploads 100 files × 10k rows in 1 min. Mitigation: per-business rate limit `5 uploads / hour, 20 / day` on `POST /api/imports` (token bucket in `request_rate_limit` table, reused from auth). Caps `ImportJob` count to 1 active job per business (status IN `UPLOADED`/`PARSING`/`PREVIEWED`/`COMMITTING`) — 2nd upload returns 409.
3. **Database bloat** — `ImportJobRow` reaches 100M rows. Mitigation: cleanup cron `scripts/cleanup-expired-import-jobs.cron.ts` runs hourly:
   - 24h post-commit → NULL out `raw` + `normalized` JSON (DPDP minimisation; keep row shell for audit linkage)
   - 7d STAGED / PREVIEWED → hard-delete `ImportJob` + cascade `ImportJobRow`
   - 5min PARSING (orphaned) → mark `FAILED` with code `PARSE_TIMEOUT`
   - 90d post-terminal → hard-delete row shell (audit row remains)
   - If 0 rows processed but `count(expired) > 0` → emit `import_cleanup.no_rows_processed` metric + Sentry P3 (silent-no-op detection)
   Indexes used: `ImportJob(status, updatedAt)`, `ImportJob(expiresAt)`, `ImportJob(committedAt)`, `ImportJobRow(jobId)`.
4. **Client-version lag** — old app (pre-7.1.0) sends old payload shape. Mitigation: route middleware asserts `clientVersion >= "7.1.0"`, rejects with `UPGRADE_REQUIRED` 426. Concurrent-upload-from-same-business case: row-level lock on ImportJob via `SELECT FOR UPDATE`, 1 active job per business limit (status IN `UPLOADED`/`PARSING`/`PREVIEWED`/`COMMITTING`), 2nd upload returns 409 with active-job-id so the user can resume or cancel.
5. **Regulatory change / DPDP erasure** — when a user requests DPDP erasure under §13 of DPDP Act, the cascade is:
   1. Find all `Party` rows for the data principal → delete (existing user-erasure service)
   2. Find all `ImportJobRow` rows where `createdPartyId IN (deleted-parties)` → NULL `raw` + `normalized` JSON; keep row shell with `sourceIndex` for audit linkage
   3. Find all `ImportJob` rows where `userId = principal.userId` (uploader-side) → NULL `fileName`; keep summary counts
   4. Audit row `data_principal.erased` written referencing `importJobId` list
   Reference existing erasure entry point at `server/src/services/user-erasure.service.ts` — IF absent, this slice MUST add an `eraseImportData(userId)` function the user-erasure service calls. Mandatory follow-up if not yet wired.
6. **Cost runaway** — no external provider cost; failure mode is DB CPU during commit. Mitigation: chunked commits (500/tx) cap any single lock to <2s on Render Starter. Concurrent commits per business capped at 1 (advisory lock on `(businessId, 'import-commit')`). Cost ceiling: 1 active job × 10k rows = ~50 MB peak per business, alert at business-row-table-size >500 MB.
7. **Insider abuse** — engineer with DB access mass-imports adversarial parties. Mitigation: every committed Party carries `importedBy=userId` + `importJobId`. Audit row `parties.imported` is immutable. Schema review (architect+security) catches if this field is omitted. Combined with the 7-action audit coverage (Gap 4 fix), every state transition is forensically traceable.

## Resolved Decisions

| # | Decision | Why | Industry exemplar |
|---|----------|-----|-------------------|
| 1 | 4 formats in MVP, not 1 then add | Each format is ~150-200L parser, isolated, low risk per file | Zoho Books bulk import supports 5 formats day-1 |
| 2 | **Synchronous parse ≤2,000 rows; async-polled for 2k-10k** | Measured budget: parse ≤5s, dedup ≤5s, response ≤5s, 15s slack on Render's 30s cap. 10k synchronous is not industry practice. | Stripe Bulk Action caps synchronous at 2k rows; Square uses signed-PUT + async worker beyond that |
| 3 | Staged-row model (not direct apply) | User MUST see what changed before commit; rollback after the fact is a nightmare | Stripe Bulk Action shows preview before apply |
| 4 | Chunk 500/tx during commit | Empirical sweet spot from DH bulk-payment-import; bigger holds locks too long | DH bulk-payment-import (internal) |
| 5 | Auto-purge abandoned jobs at 7 days | Most users commit same day or abandon; 7d covers "did it Friday, came back Monday" | Stripe staging table TTL: 7d |
| 6 | 30d retention for committed job header; **24h for raw row PII** | DPDP minimisation — raw row JSON is a parallel PII store | Zoho purges raw staging in 24h |
| 7 | Per-business feature flag, cohort=0 | Pilot with 3-5 design-partner businesses; flip per-business via admin tool | Stripe feature-flag pattern |
| 8 | GSTIN invalid = WARNING not ERROR | India MSMEs without GST registration are common; don't block them | — |
| 9 | Phone invalid = ERROR | Phone is de-facto party identity in HP; no phone = no WhatsApp / UPI | — |
| 10 | Audit row per committed party AND per state change | Per-party traceability is DPDP unit; per-job is too coarse | Stripe writes audit per action |
| 11 | Hash-dedupe re-uploads at warn level, counts-only display | Soft signal; don't leak which admin uploaded what to other admins in same business | — |
| 12 | Levenshtein threshold = 2 within same phone-suffix | Empirically catches "Raju Traders" vs "Raju Trader" but not unrelated names | — |
| 13 | Server-issued `commitToken` returned at preview, required at commit, single-use | Idempotency guarantee under retry | Square's bulk-import `commit_token` pattern |
| 14 | All API mutations use `api({ excludeFromOfflineQueue: true })` | Multipart streams aren't reconstructible from IDB; queueing 10MB uploads is a footgun | — |

## API Contract

```ts
// POST /api/imports — upload + parse + stage
// multipart/form-data
// Headers: Idempotency-Key (required), X-Active-Business-Id (asserted by middleware)
interface CreateImportReq {
  entity: 'parties'                              // future: 'products' | 'invoices' | 'payments'
  format: 'tally_xml' | 'vyapar_csv' | 'busy_xls' | 'generic_csv'
  file: File                                     // <=10MB, <=10k rows
  columnMapping?: Record<string, string>         // generic_csv only
  clientVersion: string                          // semver, must be >=7.1.0
}
interface CreateImportRes {
  jobId: string
  status: 'PARSING' | 'PREVIEWED' | 'FAILED'     // PARSING only when row-estimate > 2000
  commitToken: string | null                     // null while PARSING, populated on PREVIEWED
  counts: {
    total: number
    staged: number
    errors: number
    warnings: number
    duplicatesExact: number
    duplicatesNear: number
  } | null                                       // null while PARSING
  fileSha256: string
  previouslyUploadedAt: string | null            // ISO; non-null if hash matched a prior job in this business
  previousJobRowCount: number | null             // counts-only, no PII
}
// HTTP 200 when synchronous (<=2k rows) and status='PREVIEWED'
// HTTP 202 when async (>2k rows) and status='PARSING' — FE polls GET /api/imports/:id every 2s

// GET /api/imports/:id — fetch job + paginated rows
interface GetImportRes {
  job: {
    id: string
    entity: 'parties'
    format: string
    status: 'UPLOADED' | 'PARSING' | 'PREVIEWED' | 'COMMITTING' | 'COMMITTED' | 'PARTIALLY_COMMITTED' | 'FAILED' | 'CANCELLED'
    commitToken: string | null                   // populated when status='PREVIEWED'
    counts: { /* same shape */ committed: number }
    fileName: string
    createdAt: string
    committedAt: string | null
    expiresAt: string
  }
  rows: Array<{
    id: string
    sourceIndex: number
    status: 'STAGED' | 'ERROR' | 'WARNING' | 'DUPLICATE_EXACT' | 'DUPLICATE_NEAR' | 'COMMITTED' | 'SKIPPED'
    normalized: NormalizedParty | null           // null after 24h post-commit (PII purge)
    raw: Record<string, string> | null           // null after 24h post-commit
    issues: Array<{ field: string; code: string; severity: 'error' | 'warning'; message: string }>
    matchedPartyId: string | null
  }>
  pagination: { cursor: string | null; hasMore: boolean }
}

// POST /api/imports/:id/commit — apply staged rows (idempotent)
// Headers: Idempotency-Key (required), goes through idempotencyCheck middleware
interface CommitImportReq {
  commitToken: string                            // from preview response, single-use
  acceptNearDuplicates: string[]                 // rowIds
  skipRowIds: string[]                           // explicit drops
}
interface CommitImportRes {
  jobId: string
  status: 'COMMITTED' | 'PARTIALLY_COMMITTED'
  committedCount: number
  skippedCount: number
  errorCsvUrl: string | null                     // signed URL, 1h TTL, CSV-injection-safe
}

// DELETE /api/imports/:id — cancel/abandon
interface CancelImportRes { jobId: string; status: 'CANCELLED' }

// GET /api/imports?cursor=&limit=20 — list jobs (scoped to active business)
interface ListImportsRes {
  jobs: Array<{ id; entity; format; status; counts; createdAt; fileName }>
  pagination: { cursor: string | null; hasMore: boolean }
}

interface ErrEnvelope { success: false; error: { code: string; message: string; field?: string } }
```

Error codes: `FILE_TOO_LARGE` · `UNSUPPORTED_FORMAT` · `UNSAFE_XML` · `UNSAFE_ARCHIVE` · `PARSE_FAILED` · `PARSE_TIMEOUT` · `MAPPING_REQUIRED` · `MAPPING_INVALID` · `JOB_NOT_FOUND` · `JOB_NOT_PREVIEWED` · `JOB_EXPIRED` · `RATE_LIMITED` · `ACTIVE_JOB_EXISTS` · `CONCURRENT_COMMIT` · `BAD_COMMIT_TOKEN` · `FEATURE_DISABLED` · `NO_ACTIVE_BUSINESS` · `UPGRADE_REQUIRED` · `IDOR` (cross-business access).

## Data Model

> **Tenancy SSOT**: every model is scoped by `businessId`, set from
> `req.activeBusiness.id` (middleware `server/src/middleware/require-active-business.ts`).
> User identity is `req.user.userId`, NEVER `req.user.id` — see memory note
> `feedback_auth_req_user_shape.md` (A01.1 IDOR ruling).

**`ImportJob`**
- `id` String @id @default(cuid())
- `businessId` String — FK Business; index
- `userId` String — uploader; FK User (from `req.user.userId`)
- `entity` String — `'parties'`
- `format` String — `tally_xml`/`vyapar_csv`/`busy_xls`/`generic_csv`
- `status` String — `UPLOADED`/`PARSING`/`PREVIEWED`/`COMMITTING`/`COMMITTED`/`PARTIALLY_COMMITTED`/`FAILED`/`CANCELLED`
- `commitToken` String? — server-issued (cuid), single-use, populated when status flips to `PREVIEWED`; cleared when status flips to `COMMITTING`
- `fileName` String — nulled on DPDP erasure
- `fileSha256` String — index `(businessId, fileSha256)`
- `fileSize` Int
- `rowCount` Int
- `columnMapping` Json? — generic CSV only
- `counts` Json
- `createdPartyIds` Json? — array, populated on commit, capped at 100 in audit row; full list here
- `clientVersion` String
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt — index `(businessId, status, updatedAt)` for cleanup + active-job check
- `committedAt` DateTime? — index for 24h PII-purge cron
- `expiresAt` DateTime — 7d for STAGED, 90d for terminal states

**`ImportJobRow`**
- `id` String @id @default(cuid())
- `jobId` String — FK ImportJob; index
- `sourceIndex` Int
- `status` String — `STAGED`/`ERROR`/`WARNING`/`DUPLICATE_EXACT`/`DUPLICATE_NEAR`/`COMMITTED`/`SKIPPED`
- `raw` Json? — nulled 24h post-commit (DPDP minimisation)
- `normalized` Json? — nulled 24h post-commit
- `issues` Json
- `matchedPartyId` String? — FK Party
- `createdPartyId` String? — FK Party (set after commit; row-level guard `WHERE status='STAGED' AND createdPartyId IS NULL`)
- Index `(jobId, status)`

**Party model addendum** (additive, nullable):
- `importJobId` String? — FK ImportJob
- `importedBy` String? — FK User
- Index `(businessId, importJobId)`

**Cleanup spec (MUST_SHIP):**
- Script: `server/src/scripts/cleanup-expired-import-jobs.cron.ts`
- Frequency: every 60 min
- Logic (in order):
  1. `ImportJobRow.raw = null, .normalized = null` where `ImportJob.committedAt < now() - interval '24h'`
  2. `DELETE ImportJob` (cascade rows) where `status='COMMITTED' AND expiresAt < now()`
  3. `DELETE ImportJob` (cascade rows) where `status IN ('PREVIEWED','UPLOADED') AND expiresAt < now()`
  4. `UPDATE ImportJob SET status='FAILED'` where `status='PARSING' AND updatedAt < now() - interval '5 min'`
  5. If summary `{ rowsNulled + jobsDeleted } == 0` but `count(eligible) > 0` → emit metric `import_cleanup.no_rows_processed` + Sentry P3
- Indexes used: `ImportJob(status, updatedAt)`, `ImportJob(committedAt)`, `ImportJob(expiresAt)`
- Logs: structured `{ rowsNulled, jobsDeleted, parsingOrphaned, durationMs }` to stdout

## File Plan

Hard rule: every row ≤ 250 lines.

### Backend (`server/`)

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|------------|-------|-------|
| 1 | `prisma/schema.prisma` (additions) | edit | ~70 | schema | ImportJob + ImportJobRow + Party additions; businessId scoping |
| 2 | `prisma/migrations/<ts>_import_jobs/migration.sql` | create | ~90 | migration | architect emits |
| 3 | `src/types/import.types.ts` | create | ~100 | types | shared shapes incl. JobStatus, IssueCode, CommitTokenShape |
| 4 | `src/constants/import.constants.ts` | create | ~70 | constants | max sizes, chunk size, retention windows, rate limits, error codes, SYNC_PARSE_CAP=2000, XXE_SCAN_BYTES=65536, XLSX_MAX_UNCOMPRESSED=100MB, XLSX_MAX_RATIO=100 |
| 5 | `src/schemas/import.schemas.ts` | create | ~120 | schema | Zod `.strict()` |
| 6 | `src/services/import/security/xxe-prescan.ts` | create | ~80 | service | regex scan first 64KB; reject DOCTYPE/ENTITY |
| 7 | `src/services/import/security/zip-bomb-prescan.ts` | create | ~100 | service | yauzl enumerate, sum uncompressedSize, ratio check |
| 8 | `src/services/import/security/csv-injection.ts` | create | ~50 | utils | prefix `=+-@\t\r` cells with `'` |
| 9 | `src/services/import/normalizers/party-normalizer.ts` | create | ~180 | service | phone E.164, GSTIN checksum, opening-balance paise+sign |
| 10 | `src/services/import/parsers/tally-xml.parser.ts` | create | ~220 | service | streaming parse with 10s timeout via Promise.race |
| 11 | `src/services/import/parsers/vyapar-csv.parser.ts` | create | ~150 | service | header-name detection |
| 12 | `src/services/import/parsers/busy-excel.parser.ts` | create | ~180 | service | sheetjs first sheet only, after zip-bomb pre-scan |
| 13 | `src/services/import/parsers/generic-csv.parser.ts` | create | ~160 | service | mapping driven |
| 14 | `src/services/import/parsers/parser.types.ts` | create | ~50 | types | shared parser interface |
| 15 | `src/services/import/dedup/exact-dedup.ts` | create | ~120 | service | phone+name OR GSTIN match, scoped `businessId` |
| 16 | `src/services/import/dedup/near-dedup.ts` | create | ~140 | service | Levenshtein ≤2 |
| 17 | `src/services/import/import-job.service.ts` | create | ~230 | service | CRUD; active-job check (1 per business); commitToken issuance |
| 18 | `src/services/import/commit.service.ts` | create | ~240 | service | SELECT FOR UPDATE; row-level guard; advisory lock; per-row audit |
| 19 | `src/services/import/audit.ts` | create | ~120 | service | emits 7 action keys (uploaded/parsed/row_dropped/dedup_resolved/committed/cancelled/expired) + `parties.imported` per party |
| 20 | `src/services/import/erasure.ts` | create | ~80 | service | DPDP cascade hook called by user-erasure service |
| 21 | `src/routes/imports/create.route.ts` | create | ~150 | route | POST multipart; sync OR 202; rate-limit + idempotency middleware |
| 22 | `src/routes/imports/get.route.ts` | create | ~90 | route | GET with row pagination |
| 23 | `src/routes/imports/commit.route.ts` | create | ~120 | route | POST commit; commitToken + idempotency |
| 24 | `src/routes/imports/cancel.route.ts` | create | ~60 | route | DELETE |
| 25 | `src/routes/imports/list.route.ts` | create | ~80 | route | GET paginated |
| 26 | `src/routes/imports/index.ts` | create | ~30 | route | wiring |
| 27 | `src/middleware/import-rate-limit.ts` | create | ~90 | transport | token bucket per (businessId, userId) for uploads; per businessId for commits |
| 28 | `src/middleware/require-min-client-version.ts` | create | ~40 | transport | reject clientVersion < 7.1.0 with UPGRADE_REQUIRED |
| 29 | `src/middleware/feature-flag.ts` | edit | ~40 | transport | reuse pattern; assert `FEATURE_DATA_IMPORT` per business |
| 30 | `src/scripts/cleanup-expired-import-jobs.cron.ts` | create | ~150 | script | 4-step cleanup + silent-no-op metric |
| 31 | `src/lib/env.ts` | edit | ~10 | env | add `FEATURE_DATA_IMPORT` |
| 32 | `tests/fixtures/import/tally-sample.xml` | create | n/a | fixture | golden 5-row |
| 33 | `tests/fixtures/import/vyapar-sample.csv` | create | n/a | fixture | golden 5-row |
| 34 | `tests/fixtures/import/busy-sample.xlsx` | create | n/a | fixture | golden 5-row |
| 35 | `tests/fixtures/import/generic-sample.csv` | create | n/a | fixture | golden 5-row |
| 36 | `tests/fixtures/import/malicious-billion-laughs.xml` | create | n/a | fixture | XXE bomb — asserts UNSAFE_XML |
| 37 | `tests/fixtures/import/malicious-zip-bomb.xlsx` | create | n/a | fixture | nested zip — asserts UNSAFE_ARCHIVE |
| 38 | `tests/fixtures/import/csv-injection-sample.csv` | create | n/a | fixture | `=HYPERLINK(...)` in name field |
| 39 | `tests/integration/import-parties.test.ts` | create | ~250 | test | happy + 4 error + dedup + idempotent-commit + CSV-injection + DPDP cascade |

### Frontend (`src/`)

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|------------|-------|-------|
| 40 | `src/features/import/import.types.ts` | create | ~90 | types | mirror BE |
| 41 | `src/features/import/import.constants.ts` | create | ~50 | constants | format labels, copy keys, POLL_INTERVAL_MS=2000 |
| 42 | `src/features/import/import.service.ts` | create | ~190 | service | `api()` with `excludeFromOfflineQueue: true`, `entityType: 'import'`, `entityLabel: fileName` |
| 43 | `src/features/import/useImportJob.ts` | create | ~160 | hook | TanStack + 2s polling on PARSING/COMMITTING |
| 44 | `src/features/import/useColumnAutodetect.ts` | create | ~120 | hook | header heuristic |
| 45 | `src/features/import/pages/ImportLandingPage.tsx` | create | ~140 | page | format picker + jobs list (uploader-scoped per Gap S3) |
| 46 | `src/features/import/pages/ImportUploadPage.tsx` | create | ~150 | page | drag-drop; offline banner blocks |
| 47 | `src/features/import/pages/ImportMappingPage.tsx` | create | ~150 | page | generic CSV |
| 48 | `src/features/import/pages/ImportPreviewPage.tsx` | create | ~150 | page | tabs |
| 49 | `src/features/import/pages/ImportDedupReviewPage.tsx` | create | ~150 | page | side-by-side |
| 50 | `src/features/import/pages/ImportSummaryPage.tsx` | create | ~120 | page | post-commit |
| 51 | `src/features/import/components/RowBucketCard.tsx` | create | ~110 | sub-component | |
| 52 | `src/features/import/components/RowIssueChip.tsx` | create | ~80 | sub-component | |
| 53 | `src/features/import/components/ColumnMapper.tsx` | create | ~180 | sub-component | |
| 54 | `src/features/import/components/DedupSideBySide.tsx` | create | ~160 | sub-component | |
| 55 | `src/features/import/components/CommitProgressBar.tsx` | create | ~90 | sub-component | |
| 56 | `src/features/import/components/FormatGuideDrawer.tsx` | create | ~140 | sub-component | |
| 57 | `src/features/import/components/ReUploadWarning.tsx` | create | ~70 | sub-component | counts-only, no party names |
| 58 | `src/features/import/import.css` | create | ~180 | css | tokens-only |
| 59 | `src/lib/translations.en.ts` | edit | ~80 | constants | `import.*` keys |
| 60 | `src/lib/translations.hi.ts` | edit | ~80 | constants | hi-IN |
| 61 | `src/config/feature-flags.ts` | edit | ~10 | config | export flag |
| 62 | `src/lib/api.ts` | edit | ~10 | infra | add `excludeFromOfflineQueue?: boolean` option |

Total: ~62 files, all ≤ 250 estimated lines.

## UI States

### `ImportLandingPage`
- **Loading**: `<ListSkeleton rows={3} />`
- **Empty**: `<EmptyState title="No imports yet" body="Bring your parties from Tally, Vyapar, or Busy in under 10 minutes." action="Start import" />`
- **Error**: `<ErrorState message="Couldn't load your imports. Check your connection." onRetry />`
- **Success**: jobs list (uploader-scoped) + sticky "Start import" button

### `ImportUploadPage`
- **Loading (uploading)**: `<CommitProgressBar />` with "Reading your file…"; if >2k rows, switches to "Parsing in background — this may take a minute" with poll spinner
- **Empty (initial)**: drop zone "Drag your file here, or tap to choose" — `accept=".xml,.csv,.xls,.xlsx"`
- **Error**: file too big → "Your file is over 10 MB. Split it into smaller files and try again." · unsafe XML/zip → "We couldn't safely process this file. Check the format guide." · unsupported → "We can't read this file yet. Pick Tally XML, Vyapar CSV, Busy Excel, or Generic CSV." · parse fail → "Couldn't read this file. Check the format guide and try again." · upgrade required → "Update HisaabPro to use Import."
- **Success**: navigates to mapping (generic) or preview

### `ImportMappingPage` (generic CSV only)
- Loading / Empty (never) / Error (informational) / Success — column mapper + confirm

### `ImportPreviewPage`
- Loading / Empty ("Nothing to import") / Error (FAILED) / Success — bucket cards + row list

### `ImportDedupReviewPage`
- Loading / Empty ("No near-duplicates") / Error / Success — accept/reject pairs

### `ImportSummaryPage`
- Loading (COMMITTING) / Empty (never) / Error (PARTIALLY_COMMITTED with Download error CSV) / Success (green check + view-imported)

### Autocomplete attributes
- Mapping inputs: `autocomplete="off"`
- File picker: `accept` MIME-restricted
- No phone/OTP inputs.

## Mobile

- 375px primary; 320px no overflow
- Drop zone collapses to "Choose file" button on <375px
- Bucket cards: 1-col <375, 2-col 375-768, 4-col ≥768
- `<ResponsiveTable>`: cards <md, table ≥md
- Dedup stacks vertically <768
- Commit progress sticky-bottom respects `--bottom-nav-height` — uses `<BottomActionBar>` primitive (no raw fixed-bottom)
- Capacitor file picker via `@capacitor/filesystem` + native `<input type="file">` fallback

## UX Copy

| Element | Copy |
|---------|------|
| Primary CTA (landing) | `Start import` |
| Format picker title | `Where are your parties today?` |
| Upload zone empty | `Drag your file here, or tap to choose` |
| Upload accept hint | `Tally XML, Vyapar CSV, Busy Excel, or Generic CSV. Up to 10 MB.` |
| Parsing-async banner | `Parsing in background — this may take a minute` |
| Mapping wizard title | `Match your columns` |
| Mapping auto-detect toast | `We matched 5 of 5 columns` |
| Preview tabs | `All` · `Errors` · `Warnings` · `Duplicates` |
| Commit primary CTA | `Import N parties` |
| Commit confirm title | `Import N parties?` |
| Commit confirm body | `This adds N new parties to your list. You can delete them individually later.` |
| Commit confirm action | `Yes, import` |
| Commit progress | `Importing… N of M` |
| Success toast | `Imported N parties` |
| Partial-success toast | `Imported A of B. Some rows need fixing.` |
| Error toast (parse) | `Couldn't read this file` |
| Error toast (unsafe) | `We couldn't safely process this file` |
| Error toast (network) | `Connection lost. Try again.` |
| Cancel dialog title | `Cancel this import?` |
| Cancel dialog body | `We'll discard the N rows you uploaded. Nothing has been added to your parties yet.` |
| Cancel dialog action | `Yes, cancel` |
| Re-upload warning | `Someone in this business imported a file like this 3 days ago (N rows). Import it again?` |
| Active-job-exists | `Another import is in progress for this business. Resume or cancel it first.` |
| Offline block | `Imports need a connection — try again when you're online` |
| Upgrade required | `Update HisaabPro to use Import` |

Confirm dialog: YES on commit. Undo: NO global undo — user filters Parties by `importJobId` and bulk-deletes.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Same phone, different name in source file (2+ rows) | First → STAGED; rest → DUPLICATE_EXACT (intra-file dedup) |
| Phone column empty | ERROR `{ field: 'phone', code: 'REQUIRED' }` |
| Phone "9876543210" | Normalize to `+919876543210` |
| Phone "+91 98765 43210" | Normalize to `+919876543210` |
| Phone "1234" | ERROR `INVALID_INDIAN` |
| Name = "Cash" / "Walk-in Customer" | STAGED + WARNING `PLACEHOLDER_NAME` |
| GSTIN invalid checksum | WARNING |
| Opening balance "1,00,000.50" | 10000050 paise |
| Opening balance "(500.00)" (Tally Cr) | -50000 paise |
| Opening balance non-numeric | WARNING; 0 |
| Tally XML with `<!DOCTYPE>` or `<!ENTITY>` | UNSAFE_XML, rejected pre-parse |
| Tally XML missing `<LEDGER>` | PARSE_FAILED `NO_PARTIES_FOUND` |
| Vyapar CSV missing "Party Name" | PARSE_FAILED `REQUIRED_COLUMN_MISSING` |
| Generic CSV no mapping | `MAPPING_REQUIRED` |
| .xlsx decompresses >100MB or ratio >100 | UNSAFE_ARCHIVE |
| .docx upload | UNSUPPORTED_FORMAT |
| Two devices commit same job concurrently | Advisory lock + `SELECT FOR UPDATE` + commitToken single-use → second returns 409 `CONCURRENT_COMMIT` |
| User retries commit after 504 | Same commitToken + Idempotency-Key → idempotent no-op, returns existing result |
| Job expires mid-preview (7d) | `JOB_EXPIRED` 410 |
| User in business A tries to read job from business B | 404 |
| File too big >10 MB | Client + server reject |
| Sample row contains `=HYPERLINK(...)` | Imported as plain text; error CSV writes back as `'=HYPERLINK(...)` |
| User uploads while another job is `PREVIEWED` for same business | 409 `ACTIVE_JOB_EXISTS` with `activeJobId` |
| Old client (<7.1.0) | 426 `UPGRADE_REQUIRED` |

## Security

- **Auth required**: session cookie + CSRF on POST/DELETE
- **Active business required**: middleware `requireActiveBusiness` asserts `req.activeBusiness.id` is set; else 400 `NO_ACTIVE_BUSINESS`. **SSOT: `server/src/middleware/require-active-business.ts`**
- **User identity**: `req.user.userId` (NEVER `req.user.id` — A01.1 IDOR ruling)
- **Role**: business admin only. Existing `requireAdmin` middleware. Staff/cashier → 403.
- **Feature flag gate**: `FEATURE_DATA_IMPORT` checked BEFORE auth-success returns — disabled businesses get 404 (don't leak flag state)
- **Min client version**: `clientVersion >= "7.1.0"` else 426 `UPGRADE_REQUIRED`
- **Rate limit primitive**: token bucket in `request_rate_limit` table
- **Rate limit policy**: per-business 5 uploads/hour, 20/day; per-business 1 active job at a time (status IN `UPLOADED`/`PARSING`/`PREVIEWED`/`COMMITTING`); per-business 1 concurrent commit (advisory pg lock on `(businessId, 'import-commit')`)
- **Lockout policy**: 3 consecutive `FAILED` parses in 10 min on the same `(businessId, userId)` pair → 1h cooldown on uploads for that user (per-user, since uploads are user-driven; commit-concurrency stays per-business)
- **Idempotency**: `Idempotency-Key` header on `POST /api/imports` and `POST /api/imports/:id/commit`; enforced via existing `idempotencyCheck` middleware (`server/src/middleware/idempotency.ts`); commit additionally requires server-issued single-use `commitToken` from preview
- **Commit transaction model**: BEGIN TX → `SELECT FOR UPDATE` ImportJob → assert `status='PREVIEWED' AND commitToken=provided` else 409 → `UPDATE status='COMMITTING', commitToken=null` → process chunks with row guard `UPDATE ImportJobRow SET status='COMMITTED', createdPartyId=... WHERE jobId=? AND status='STAGED' AND createdPartyId IS NULL` → COMMIT
- **IDOR scope**: every query filters `businessId = req.activeBusiness.id`. Job IDs not enumerable (cuid). 404 on cross-business, never 403.
- **CSRF**: standard middleware on POST/DELETE
- **File handling**: parse in-memory only, never written to disk; `multer { storage: memoryStorage() }` with 10MB cap
- **XXE defence**:
  - **Pre-scan**: reject if `/<!DOCTYPE|<!ENTITY/i` matches first 64KB (constant `XXE_SCAN_BYTES`). Implemented in `xxe-prescan.ts`.
  - **Parser**: `fast-xml-parser` with `processEntities: false`
  - **Timeout**: parse wrapped in `Promise.race([parse, sleep(10000).then(reject)])` → `PARSE_TIMEOUT` if exceeded
  - **Fixture test**: `malicious-billion-laughs.xml` → asserts `UNSAFE_XML` returned within 100ms (pre-scan, before parser even starts)
- **Zip-bomb defence on .xlsx**:
  - Use `yauzl` (add to package.json if absent) to enumerate entries before `sheetjs.read()`
  - Reject if `sum(uncompressedSize) > 100MB` (`XLSX_MAX_UNCOMPRESSED`) OR `sum(uncompressedSize)/sum(compressedSize) > 100` (`XLSX_MAX_RATIO`)
  - sheetjs read wrapped in 10s timeout
  - **Fixture test**: `malicious-zip-bomb.xlsx` → asserts `UNSAFE_ARCHIVE` within 200ms
- **CSV-injection defence (OWASP CSV Injection Prevention Cheat Sheet)**:
  - Every cell written to the downloadable error CSV that **starts with** `=`, `+`, `-`, `@`, `\t`, or `\r` is prefixed with a single quote `'`
  - Example: input cell `=HYPERLINK("http://evil","Click")` → output cell `'=HYPERLINK("http://evil","Click")`
  - Implemented in `csv-injection.ts` utility, applied at error-CSV generation
- **Audit log writes — 7 action keys** (in addition to per-party `parties.imported`):
  | Action key | When | Payload |
  |------------|------|---------|
  | `import_job.uploaded` | After file received + pre-scans passed | `{ jobId, fileSha256, fileSize, format, fileName }` |
  | `import_job.parsed` | After parse completes (sync or async) | `{ jobId, parsedRowCount, errorRowCount, warningRowCount, durationMs }` |
  | `import_job.row_dropped` | Each user-drop in preview | `{ jobId, rowId, sourceIndex }` (one per drop) |
  | `import_job.dedup_resolved` | Each near-dup decision | `{ jobId, rowId, choice: 'merge'\|'skip', matchedPartyId }` |
  | `import_job.committed` | On commit success | `{ jobId, committedCount, partyIds: <=100 of createdPartyId; full list in ImportJob.createdPartyIds }` |
  | `import_job.cancelled` | On DELETE | `{ jobId, stageAtCancel }` |
  | `import_job.expired` | Cleanup cron hard-delete | `{ jobId, ageDays }` |
  Coverage validated by `enforce-audit-coverage.mjs --block` (must remain green).

## Observability

### Analytics events (cap 7)

| Event | Properties |
|-------|------------|
| `import.upload_started` | `format`, `fileSizeBytes` |
| `import.upload_parsed` | `format`, `rowCount`, `errors`, `warnings`, `duplicatesExact`, `duplicatesNear`, `parseMs`, `asyncPath` (bool) |
| `import.parse_failed` | `format`, `errorCode` |
| `import.commit_started` | `jobId`, `stagedCount`, `nearDupAccepted` |
| `import.commit_finished` | `jobId`, `committedCount`, `skippedCount`, `partialFlag`, `commitMs` |
| `import.cancelled` | `jobId`, `stageAtCancel` |
| `import.re_upload_detected` | `daysSincePrevious` |

### Sentry alerts
- `import.commit_started` → `import.commit_finished` gap >60s → P2
- `PARSE_FAILED` with code `INTERNAL` → P3
- `PARSE_TIMEOUT` rate >1% over 1h → P2
- `UNSAFE_XML` or `UNSAFE_ARCHIVE` count >5/h → P1 (active attack)
- Cleanup cron failure or `import_cleanup.no_rows_processed` fire → P2

### Metrics (all labels use `business_id`, NOT `tenant_id` — per HP convention)
- `import_jobs_active_total{business_id, status}` gauge
- `import_commit_duration_seconds{format}` histogram
- `import_row_count{format}` histogram
- `import_jobrow_table_bytes` gauge (alert >500MB)
- `import_cleanup.no_rows_processed` counter (silent-no-op detection)
- `import_async_path_total{format}` counter (track >2k uploads)

### Cost alerts
- `import_jobrow_rows_total` >50M cluster-wide → review retention
- No external provider spend

## Test Infrastructure

- Reserved fixtures at `tests/fixtures/import/`:
  - 4 golden 5-row samples (one per format) — covers valid + invalid-phone + invalid-GSTIN + negative-opening + placeholder-name
  - `malicious-billion-laughs.xml` — XXE/billion-laughs payload
  - `malicious-zip-bomb.xlsx` — nested zip / high decompression ratio
  - `csv-injection-sample.csv` — `=HYPERLINK(...)` in name field
- Integration test (`tests/integration/import-parties.test.ts`):
  - Uploads each fixture → asserts bucket counts
  - Commits → asserts Party rows created with `importJobId`+`importedBy` set; audit rows exist (all 7 actions + `parties.imported`)
  - Re-upload same hash → asserts `previouslyUploadedAt` non-null + counts-only response
  - Cross-business access → 404
  - Idempotent commit: double-POST same `commitToken` + `Idempotency-Key` → asserts no duplicate Party rows + same response
  - CSV-injection fixture → asserts error CSV cell is prefixed with `'`
  - Malicious XXE → asserts `UNSAFE_XML` + no OOM
  - Malicious zip bomb → asserts `UNSAFE_ARCHIVE`
  - DPDP erasure on a committed Party → asserts `ImportJobRow.raw` is NULL but shell row + audit remain
  - 24h post-commit raw-PII purge → simulated via cron `--at` flag
- CI sets `FEATURE_DATA_IMPORT=true` for test business only
- Cleanup cron has `--dry-run` flag tested

## Accepted Trade-offs

- **Synchronous parse only for ≤2,000 rows.** 2k-10k uses 202+poll (still in-process via setImmediate). Real worker = 7.1E.
- **No mid-commit pause/resume.** Re-upload remaining rows on failure.
- **No global undo.** Filter by `importJobId` + bulk-delete.
- **English-only internal error codes**; user-facing copy translated.
- **No partial-row edit in preview.** Drop + re-upload.
- **Levenshtein dedup is O(n) per phone-suffix bucket.** Acceptable to 10k.
- **No PDF/image OCR.** Different epic.
- **GSTIN validation is checksum-only**, not live GSTN. Live = FUTURE_EPIC.
- **Raw row JSON kept only 24h post-commit** — DPDP minimisation. Forensics for old jobs uses audit log + summary, not row payloads.
- **Re-upload warning shows row-count only, never party names/phones** — avoids cross-admin PII leak in shared-device case.
- **Import job list is uploader-scoped on FE** (Gap S3): user sees their own jobs; another admin's jobs aren't enumerated (still queryable via job-id if known + admin).

## Out of Scope

- [FUTURE_EPIC] Products import (7.1B)
- [FUTURE_EPIC] Invoices import (7.1C)
- [FUTURE_EPIC] Payments import (7.1D)
- [FUTURE_EPIC] Resumable / chunked uploads (>10k rows; 7.1E)
- [FUTURE_EPIC] Background-worker offload for parse + commit (7.1E)
- [FUTURE_EPIC] In-browser row editing during preview
- [FUTURE_EPIC] Live GSTN validation of GSTIN
- [FUTURE_EPIC] PDF / image / OCR-based ledger import
- [FUTURE_EPIC] Saved column-mapping templates shared across businesses
- [FUTURE_EPIC] Two-way sync with Tally / Vyapar / Busy
- [FUTURE_EPIC] Address parsing into state/pincode/city
- [FUTURE_EPIC] Import scheduling (cron-style recurring imports)

## Cross-feature Impact

- **Party CRUD**: accepts `importJobId` + `importedBy` (nullable). Single column addition.
- **Opening Balance**: each committed Party with non-zero opening creates an `OpeningBalance` ledger entry via `partyOpeningBalance.service.ts` (no duplicate ledger logic). Ledger insertion is **inside the same tx** as Party creation and gated by the same row-level `WHERE status='STAGED' AND createdPartyId IS NULL` guard — so commit-retry never doubles the ledger.
- **Audit log**: new action keys `import_job.{uploaded,parsed,row_dropped,dedup_resolved,committed,cancelled,expired}` + `parties.imported`. Audit reader UI auto-renders unknown keys with fallback copy.
- **Settings nav**: new "Data Import" row under Settings → Data, hidden by `FEATURE_DATA_IMPORT`.
- **Parties list filter**: `?importJobId=xxx` added to `GET /api/parties` (where-clause addition, scoped by `businessId`).
- **Offline queue**: imports explicitly excluded via `api({ excludeFromOfflineQueue: true })` — requires a one-line `api.ts` option addition.
- **DPDP erasure**: user-erasure service calls `eraseImportData(userId)` which (a) NULLs `ImportJobRow.raw` + `.normalized` where `createdPartyId` matched erased parties; (b) NULLs `ImportJob.fileName` where `userId` matched; (c) writes audit `data_principal.erased` referencing affected `importJobId` list. IF the erasure service doesn't yet exist, this slice adds it.
- **Feature-flag plumbing**: `FEATURE_DATA_IMPORT` follows existing per-business flag pattern (`business.featureFlags` JSONB).

## Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Tally XML schema drift | High | Pin parser to `<TALLYMESSAGE>`/`<LEDGER>`; 3 real-world fixtures from pilot |
| 2 | Vyapar changes CSV columns | Medium | Header-name detection; version pin |
| 3 | Busy Excel multi-sheet / merged cells | Medium | First sheet only; sheetjs `cellNF` |
| 4 | Parse exceeds 30s Render budget | Medium | 2k row sync cap; 2k-10k async path with polling |
| 5 | Dedup false positives | Medium | Levenshtein 2 + same phone-suffix; explicit accept |
| 6 | Dedup false negatives | Medium | (phone,name)+(GSTIN) exact catches ~95%; bulk-delete by importJobId as escape hatch |
| 7 | Insider abuse | Low | `importedBy` + immutable audit (7 actions) |
| 8 | Parser bug truncates field | Medium | Preview shows normalized output user-visibly |
| 9 | DB bloat from abandoned jobs | Medium | 1h cron + 7d STAGED retention + alert |
| 10 | Cleanup cron silent no-op | Medium | `import_cleanup.no_rows_processed` metric + P3 |
| 11 | XXE / billion-laughs OOM | High | Byte pre-scan + parser entity-disable + 10s timeout |
| 12 | Zip-bomb OOM on .xlsx | High | yauzl pre-scan: uncompressed ≤100MB AND ratio ≤100 |
| 13 | CSV-injection RCE on error-CSV download | High | OWASP prefix-quoting `=+-@\t\r` |
| 14 | DPDP erasure leaks raw PII | High | 24h post-commit raw purge + cascade hook into user-erasure |
| 15 | Commit retry doubles ledger entries | High | `commitToken` single-use + `SELECT FOR UPDATE` + row-level `createdPartyId IS NULL` guard |

## Acceptance Criteria

- [ ] `FEATURE_DATA_IMPORT=false` business → `GET /api/imports` returns 404; UI nav row hidden
- [ ] `FEATURE_DATA_IMPORT=true` + admin → upload Tally fixture → `POST /api/imports` 200 `{ success: true, jobId, status: 'PREVIEWED', commitToken, counts: { staged: ≥1 } }`
- [ ] Upload >10MB → 413 `FILE_TOO_LARGE`
- [ ] Upload .docx → 400 `UNSUPPORTED_FORMAT`
- [ ] Upload malicious-billion-laughs.xml → 400 `UNSAFE_XML` within 200ms; no OOM
- [ ] Upload malicious-zip-bomb.xlsx → 400 `UNSAFE_ARCHIVE` within 500ms; no OOM
- [ ] Upload 5k-row Tally → 202 with `status: 'PARSING'`; subsequent GET polls show `PREVIEWED` within ~10s
- [ ] Generic CSV without mapping → 400 `MAPPING_REQUIRED`
- [ ] Commit fixture → Party rows have `importJobId`+`importedBy`; audit log has all 7 `import_job.*` actions + per-party `parties.imported`
- [ ] Double-POST same commit (same `Idempotency-Key` + `commitToken`) → second returns identical response, no duplicate Parties, no duplicate OpeningBalance ledger entries
- [ ] Commit with stale `commitToken` (already-used) → 409 `BAD_COMMIT_TOKEN`
- [ ] Re-upload same file → response includes `previouslyUploadedAt`, `previousJobRowCount`; no party names/phones leaked
- [ ] Concurrent upload while existing active job → 409 `ACTIVE_JOB_EXISTS` with `activeJobId`
- [ ] Cross-business `GET /api/imports/:id` → 404
- [ ] Without auth → 401
- [ ] Without active business → 400 `NO_ACTIVE_BUSINESS`
- [ ] `clientVersion = "7.0.9"` → 426 `UPGRADE_REQUIRED`
- [ ] Cancel job → `import_job.cancelled` audit row written; rows deleted within 1h
- [ ] Cleanup cron run 25h post-commit → `ImportJobRow.raw` and `.normalized` are NULL; audit + summary remain
- [ ] DPDP erasure on a committed Party → `ImportJobRow.raw` NULLed; shell row + `sourceIndex` remain
- [ ] Error CSV download for row containing `=HYPERLINK(...)` → cell text is `'=HYPERLINK(...)` literally
- [ ] `enforce-audit-coverage.mjs --block` passes
- [ ] No raw `fetch()` in `src/features/import/**` (`enforce.js` passes)
- [ ] All FE mutations pass `entityType: 'import'`, `entityLabel`, and `excludeFromOfflineQueue: true`
- [ ] Toggle airplane-mode mid-upload → UI shows offline banner; request NOT queued in IDB
- [ ] All strings present in `translations.en.ts` + `translations.hi.ts`
- [ ] Screenshots: 4 states × 6 FE pages
- [ ] 320px no horizontal overflow
- [ ] 375px hp-design audit passes
- [ ] Phone normalization converges (10-digit, +91-prefixed, spaced) to E.164
- [ ] Tally Cr opening balance preserved as negative paise int

## QA Checklist

- [ ] curl POST /api/imports without auth → 401
- [ ] curl POST /api/imports with non-admin → 403
- [ ] curl POST /api/imports without `X-Active-Business-Id` → 400 `NO_ACTIVE_BUSINESS`
- [ ] curl POST /api/imports with flag-disabled business → 404
- [ ] curl POST /api/imports each of 4 formats → `staged ≥ 1`
- [ ] curl POST malicious XXE fixture → `UNSAFE_XML`
- [ ] curl POST malicious zip-bomb fixture → `UNSAFE_ARCHIVE`
- [ ] curl GET /api/imports/:id paginates rows (cursor works)
- [ ] curl POST /api/imports/:id/commit twice with same `Idempotency-Key` → identical response, no duplicate Party rows, no duplicate audit
- [ ] curl POST /api/imports/:id/commit with reused `commitToken` → 409 `BAD_COMMIT_TOKEN`
- [ ] curl DELETE /api/imports/:id → audit `import_job.cancelled` + rows deleted within 1h
- [ ] tsc clean
- [ ] `node scripts/enforce.js` clean
- [ ] `node scripts/enforce-offline.mjs` clean
- [ ] `node scripts/enforce-audit-coverage.mjs --block` clean
- [ ] Cleanup cron dry-run reports correct candidate counts
- [ ] Screenshots × 6 pages × 4 states = 24 frames at 375px
- [ ] 320px overflow test passes
- [ ] Lighthouse on `ImportLandingPage` ≥ 90 perf
- [ ] Dark mode parity

## Revision Log

**2026-05-18 v2** (revision after audit `SCOPE_AUDIT_PHASE7_IMPORT_7_1A_PARTIES.md`).

Gaps closed:
- **MUST_SHIP #1** (tenancy) — replaced all `tenantId` references with `businessId`/`req.activeBusiness.id`; user identity corrected to `req.user.userId`; cited `server/src/middleware/require-active-business.ts` as SSOT in Security + Data Model
- **MUST_SHIP #2** (idempotent commit) — added `commitToken` (server-issued, single-use) + `Idempotency-Key` header + `SELECT FOR UPDATE` + row-level `WHERE status='STAGED' AND createdPartyId IS NULL` guard; ledger entry creation moved inside same tx + same guard
- **MUST_SHIP #3** (30s budget) — sync cap lowered to 2,000 rows; >2k returns 202 with `PARSING` status + 2s FE polling; orphan-`PARSING` cleanup added (5min threshold)
- **MUST_SHIP #4** (audit coverage) — added 7-action audit table (`uploaded`/`parsed`/`row_dropped`/`dedup_resolved`/`committed`/`cancelled`/`expired`); acceptance criterion gates on `enforce-audit-coverage.mjs --block`
- **MUST_SHIP #5** (XXE) — added 64KB byte-level pre-scan for `<!DOCTYPE`/`<!ENTITY` + 10s parser timeout via `Promise.race`; `malicious-billion-laughs.xml` fixture
- **MUST_SHIP #6** (zip-bomb) — added `yauzl` pre-scan (uncompressed ≤100MB AND ratio ≤100); `malicious-zip-bomb.xlsx` fixture
- **MUST_SHIP #7** (CSV-injection) — added OWASP prefix-quote for `=+-@\t\r` in error CSV; worked example
- **MUST_SHIP #8** (PII retention) — raw + normalized purged 24h post-commit (was 30d); cleanup-cron step 1; acceptance criterion at 25h post-commit
- **MUST_SHIP #9** (failure modes) — scenario 4 expanded with row-lock + 1-active-job-per-business + 409; scenario 5 expanded with full DPDP erasure cascade runbook + `eraseImportData(userId)` hook

SHOULD_SHIP items addressed inline:
- S1 — `excludeFromOfflineQueue: true` added to `api()` + import service usage
- S2 — industry-exemplar column added to Resolved Decisions table
- S3 — re-upload warning + jobs list scoped to uploader; counts-only no PII
- S4 — all metrics use `business_id` label, never `tenant_id`
- S5 — cleanup cron emits `import_cleanup.no_rows_processed` metric on silent no-op
- S6 — lockout cooldown scoped to `(businessId, userId)` for uploads; concurrency stays per-business

Gaps declined: none.
