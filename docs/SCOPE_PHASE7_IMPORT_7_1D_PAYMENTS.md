# SCOPE — Phase 7 #149 · Slice 7.1D — Payments Import (v2)

> Tally XML (`<VOUCHER VCHTYPE="Receipt">`) + Vyapar payments CSV + Busy
> payments XLSX + Generic CSV (with field mapping).
> **PAYMENT_IN entity** (`Payment.type='PAYMENT_IN'`, `Document` allocations
> via `PaymentAllocation` join). Reuses the 7.1A + 7.1B + 7.1C framework
> end-to-end (routes, schema tables, security envelope, audit pipeline,
> cleanup cron, FE wizard, commit dispatcher, fly-create-through-canonical-
> service pattern). Behind `FEATURE_DATA_IMPORT` env flag, cohort=0 in
> MVP — same flag as 7.1A/B/C.
>
> **LAST slice of epic #149.** After this, "Import customers + items +
> sales + receipts from Tally/Vyapar/Busy/CSV" is the shippable story.
>
> **v2 (2026-05-19):** revised post scope-auditor BLOCK — see §Revision Log v2.

This document is **diff-only**. Anything not redefined here is **unchanged
from 7.1A / 7.1B / 7.1C**. SSOTs:
- `SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md` — security envelope, idempotency,
  audit, cleanup, DPDP, rate limits, mobile, offline.
- `SCOPE_PHASE7_IMPORT_7_1B_PRODUCTS.md` — entity-aware FE wizard, commit
  dispatcher, BigInt-paise pipeline + Int-narrowing at boundary, expand→
  backfill→contract migration discipline.
- `SCOPE_PHASE7_IMPORT_7_1C_INVOICES.md` — multi-source parser shape, date
  parser (NFKC + ASCII-only + state machine), FK resolver pattern,
  fly-create-through-canonical-service guarantee, per-row tx, commit-blocked
  sentinel, `?importJobId=` list filter.

Pre-flight: read CLAUDE.md, OFFLINE_RULES, PRISMA_MIGRATION_RULES,
PLATFORM_SHELL, PAGE_AUDIT_CHECKLIST, prior 7.1A/B/C SCOPE + ARCH +
SECURITY. No matching `~/.claude/learnings/scope-writer-blindspots-*` files.

---

## §0 Summary

Migrate a business's historical **customer receipts** (PAYMENT_IN) from
their previous billing software into HisaabPro. Upload → parse → resolve
party FK (existing-or-fly-create) → resolve invoice FK (strict when
source supplies `invoiceNumber`) → preview with allocation chip → resolve
dedups → commit. Per-row tx so a bad row never half-creates a payment
(payment without its allocation, or an allocation that over-fills an
invoice). Wraps up the multi-source import epic — parties + products +
invoices + receipts is the complete migration story for an Indian MSME
leaving Tally/Vyapar/Busy.

## §1 What's NEW vs 7.1C

| # | New surface | Why |
|---|-------------|-----|
| 1 | `entity='payments'` on `ImportJob` (new discriminator value) | Symmetric with `parties` / `product` / `invoice` |
| 2 | `commitToken` flow narrows to **Payment** + 0..1 `PaymentAllocation` per row (vs invoice's Document + N lines) | Simpler row tx — but FK across two existing tables (`Party` + `Document`) |
| 3 | **Lenient allocation policy** — payment with `invoiceNumber` field must strict-match an existing invoice (`INVOICE_NOT_FOUND` → ERROR); payment WITHOUT `invoiceNumber` lands as **unallocated** (advance balance) | Real-world Tally exports often omit invoice ref on opening-balance receipts and lump-sum advances. Strict-only would force users to drop the row; lenient preserves the receipt against the party |
| 4 | `Payment.mode` mapping dictionary — source strings (`"Bank A/c"`, `"NEFT"`, `"Cheque"`, `"Online Transfer"`) → schema mode strings (`CASH`/`UPI`/`BANK_TRANSFER`/`CHEQUE`/`NEFT_RTGS_IMPS`/`CREDIT_CARD`/`OTHER`). Unknown → `OTHER` + WARNING `MODE_DEFAULTED` (NO fly-create of new mode values — schema is closed). Lookup uses **NFKC fold + lowercase + trim + collapsed whitespace** (Devanagari + casing + spacing tolerant) | Source-software vocabulary diverges across English/Hindi sheets + spacing; normalised lookup is auditable and reviewable |
| 5 | **Over-allocation guard** — `Σ(existing PaymentAllocation.amount for invoiceId) + new ≤ Document.grandTotal` checked in tx; overflow → ERROR `OVER_ALLOCATION` (4xx, user-actionable). Distinct from `ALLOCATION_INTERNAL_CONFLICT` (5xx system bug — P2002 collision on `@@unique([paymentId, invoiceId])`) | Schema has NO `Document.amountReceived` / `amountDue` columns; paid-state is derived from `Σ PaymentAllocation` per `invoiceId`. Guard preserves accounting invariant. Two distinct codes prevent collapsing a true Σ-overflow with a primary-key race |
| 6 | **Cross-job duplicate check** — `(businessId, partyId, date, amount, mode)` against existing non-deleted `Payment` rows → WARNING `DUPLICATE_PAYMENT`; resolutions = SKIP \| CREATE_NEW | Re-importing a Tally year twice is a real foot-gun (idempotent file with no surrogate key); we surface, never silently drop |
| 7 | **Intra-file duplicate** — same triple within the uploaded file → first STAGED, rest WARNING `INTRA_FILE_DUPLICATE` | Often a CSV export quirk (split rows) |
| 8 | Sentinel response code 409 `COMMIT_BLOCKED_INVOICE_NOT_FOUND` (mirrors 7.1C 409 `COMMIT_BLOCKED_PRODUCT_NOT_FOUND`) | FE deep-links to invoices import |
| 9 | `Payment.importJobId` + `Payment.importedBy` (additive nullable, mirror 7.1A Party, 7.1C Document) | Audit + bulk-delete escape hatch by `importJobId` |
| 10 | Batched audit emitter `payments.imported_batch` carrying parallel arrays `paymentIds[]`, `amounts[]`, `partyIds[]`, `allocatedDocumentIds[]` (null per-index when unallocated) | Reduces audit-row count vs per-payment row — receipts are high-volume and per-row audit was a 7.1C learning (no functional change to invoice audit, just chose differently here) |
| 11 | `GET /api/payments?importJobId=xxx` filter (mechanical 5-line add — mirror 7.1C documents filter) | Bulk view + bulk-delete escape hatch |
| 12 | `EntityPicker` gains 4th tile **Payments**; `PaymentRowCard` renders party chip + (invoice-chip OR "Unallocated/advance" pill) + mode badge + amount | FE polish — invoice chip is deep-link to that invoice for trust |
| 13 | **Opt-in `STRICT_REJECT` mode** for unknown payment modes via upload-time `?strictMode=true` query param (default off). When on, unknown source modes → ERROR `MODE_UNKNOWN_STRICT` instead of WARNING `MODE_DEFAULTED` | Priya/Amit personas demand audit-clean ledgers — they prefer the row blocks than silently lands as `OTHER` |

## §2 What's INHERITED (verbatim — no diff)

From 7.1A:
- Security envelope: XXE prescan (libxmljs2 NOENT off), zip-bomb yauzl
  prescan, CSV-injection prefix (`'\t'` on `=`/`+`/`-`/`@`), 10 MB file
  cap, 10k row cap, multipart MIME allowlist
- Rate limits: 5 uploads/hr, 20/day per business; 3 failed parses in 10
  min per `(businessId, userId)` → 1h cooldown
- 1-active-job-per-business across ALL entities (parties/products/invoice/
  payments) — uploading payments while a products job is `PREVIEWED`
  returns 409 `ACTIVE_JOB_EXISTS`
- `ImportJob` + `ImportJobRow` tables (no new tables added in 7.1D)
- `commitToken` (single-use, 4h TTL) + `Idempotency-Key` (server cache 24h)
- 7 `import_job.*` audit action keys
- DPDP 24h purge of `ImportJobRow.raw`/`.normalized` post-commit; permanent
  `Payment` ledger rows kept (mirrors `Document` retention from 7.1C)
- Error-CSV download (CSV-injection-safe)
- M1-M11 security directives (per 7.1A §Security)

From 7.1B:
- BigInt-string `paise` pipeline `price.util.ts` then narrow-to-Int at the
  boundary via `narrowPaiseToInt(big) → AMOUNT_OUT_OF_RANGE` if > 2^31-1
- Expand → backfill → contract migration shape (here: expand-only since
  the new columns are pure-additive and nullable)
- Entity-aware FE wizard skeleton (`ImportLandingPage` + entity tile)
- Commit dispatcher pattern (`commit-dispatcher.ts` gets new `case 'payments'`)
- M10 length-prefix advisory lock during fly-create of parties

From 7.1C:
- `date-parser.util.ts` reused verbatim (NFKC + ASCII-only digit check
  + 32-char length cap + hand-rolled 4-format state machine)
- `party-resolver.ts` reused verbatim (chunk-preload by `(lower(name),
  phone)`; precedence `EXISTING` → fly-create via canonical
  `createParty()`; `PARTY_NAME_ONLY_MATCH` warning subset of
  `PARTY_AUTO_CREATED`)
- `commit-blocked` sentinel pattern: any row with `INVOICE_NOT_FOUND` →
  CTA disabled + sticky banner + deep-link
- Per-row tx pattern (single outer tx per row, no nested `$transaction`;
  Postgres rollback semantics on mid-tx crash)
- Cross-tenant scoping rule: every FK preload includes `WHERE businessId = $1`;
  integration test asserts business B's parties/invoices invisible to A
- `ImportJobRow.createdEntityId IS NULL` retry guard

## §3 Failure Mode Walkthrough

Inherits 7.1A scenarios 1-7 verbatim. **Payment-specific additions**:

1. **Provider/dependency outage** — no new external provider. Same
   Postgres + S3 envelope. Payment commit fans out to 1 INSERT Payment +
   0..1 INSERT PaymentAllocation + 1 UPDATE ImportJobRow + 1 audit row
   (or batched audit emitter every 50 rows) — smaller per-row footprint
   than invoices. Chunk size 200.
2. **Abuse spike** — same 7.1A rate-limit envelope. Payment FK lookups
   hit `Party.businessId + (lower(name), phone)` and `Document.businessId
   + type='SALE_INVOICE' + lower(documentNumber)` — both indexes exist
   today. No new ratelimit.
3. **Database bloat** — `ImportJobRow.raw`/`.normalized` NULLed at 24h.
   `Payment` + `PaymentAllocation` are permanent ledger. Alert when a
   single `importJobId` produces > 50k `Payment` rows (10k-row cap × 5
   chunks margin).
4. **Client-version lag** — `clientVersion >= 7.1.3` required for
   `entity='payments'`; older clients → 426 `UPGRADE_REQUIRED`. The FE
   tile renders only for clients ≥ 7.1.3 (parties on 7.1.0, products
   7.1.0, invoices 7.1.2, payments 7.1.3).
5. **Regulatory change (DPDP)** — `Payment` rows are **business-owned**;
   DPDP cascade is a no-op on Payment.amount/date/mode. `Payment.importedBy`
   is `SetNull` on User delete. `Payment.partyId` is `Restrict` — the
   party row stays (a payment's principal is the *business*, not the
   data principal in question). Fly-created parties from `MATCH_OR_FLY_CREATE`
   carry their own `importedBy` already (7.1A) and follow that DPDP path.
6. **Cost runaway** — same DB-CPU mitigation. Payment commits are
   ~2x lighter per row than invoices (no N-line fanout). Metric
   `import_commit.duration_p99_ms{entity='payments'}` with Sentry alert
   at > 20s p99.
7. **Insider abuse** — every committed Payment carries `createdBy=userId`
   + `importJobId` + `importedBy`. Batched audit row
   `payments.imported_batch` is immutable with parallel arrays. Bulk-
   soft-delete-by-`importJobId` is the escape hatch (Payment.isDeleted=
   true + Payment.deletedAt + Payment.updatedBy=userId; PaymentAllocation
   cascade-deletes through `onDelete: Cascade`). Cross-tenant leak
   prevented by every FK-resolution query including `WHERE businessId = $1`
   (integration test).

## §4 Resolved Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | **PAYMENT_IN only** in v1; PAYMENT_OUT (vendor receipts) deferred | PAYMENT_OUT requires Vendor module + vendor-bill resolution; cross-cutting with parties-as-vendors. Out of scope; `[FUTURE_EPIC]` |
| 2 | **Lenient allocation policy** — strict when source supplies `invoiceNumber`, unallocated when absent | Best of both: real Tally/Busy receipts often miss invoice refs (advances, opening balances); blocking them = lost migrations. When invoiceNumber IS present and the invoice doesn't exist, we BLOCK (mirrors 7.1C product-strict) — the user fixes the invoice import or drops the row |
| 3 | **Multi-allocation per row out of scope** | `paymentRow.invoiceNumber = "INV-1,INV-2,INV-3"` → ERROR `MULTI_ALLOCATION_UNSUPPORTED`. Rare in source exports; single allocation covers 95% of receipts. `[FUTURE_EPIC]` |
| 4 | **Party resolution = same `MATCH_OR_FLY_CREATE` default** as 7.1C; `REQUIRE_PARTIES_FIRST` mode also exposed | Consistency. The same upload-step radio appears. Default is fly-create for the Raju persona |
| 5 | **Mode mapping = dictionary, NO fly-create** | `Payment.mode` is a closed string enum (CASH, UPI, BANK_TRANSFER, CHEQUE, NEFT_RTGS_IMPS, CREDIT_CARD, OTHER — see `shared/enums.ts`). Unknown source values → `OTHER` + WARNING (or ERROR in STRICT_REJECT mode). Allowing fly-create would let import poison a closed enum with arbitrary user strings, breaking dashboard filters/reports |
| 6 | **Amount = Int paise** via `narrowPaiseToInt`; `Payment.amount` schema is Int | Schema fact; cap Rs 2.14 crore per payment. Larger receipts need separate widening epic |
| 7 | **Amount must be > 0** (strictly positive) — zero or negative → ERROR `AMOUNT_NEGATIVE` | Reversal payments are out of scope (Phase 6 PayrollRun reversal is the only existing path); import doesn't write reversal rows |
| 8 | **Date parser** reused verbatim from 7.1C — same 4 formats, same NFKC + ASCII-only + length cap; field is `Payment.date` (NOT `paymentDate` — schema fact) | One parser; one bug surface |
| 9 | **Dedup intra-file** = `(date, partyResolvedKey, amount)` triple where `partyResolvedKey = lower(name)+phone`; first → STAGED, rest → WARNING `INTRA_FILE_DUPLICATE` | Mode left OUT of intra-file key — source software sometimes splits one receipt into two mode rows; we'd false-positive otherwise |
| 10 | **Dedup cross-job** = `(businessId, partyId, date, amount, mode)` against existing non-deleted `Payment` → WARNING `DUPLICATE_PAYMENT`; resolutions = SKIP \| CREATE_NEW | Mode IS in cross-job key because a Cash+UPI payment same-day same-amount IS two legit receipts |
| 11 | **Over-allocation guard** computes `Σ existing PaymentAllocation.amount WHERE invoiceId = $1` in same tx **before** inserting new allocation; if `Σ + new > Document.grandTotal` → ERROR `OVER_ALLOCATION` (4xx user-actionable) | Schema has no `Document.amountReceived` column — paid-state is derived; we MUST not corrupt the derivation. SELECT FOR UPDATE on Document row in same tx prevents concurrent two-import race |
| 12 | **No mutation of `Document.amountReceived` / `amountDue`** — these columns DO NOT exist on `Document`. Paid-state is derived via `Σ PaymentAllocation.amount`. (Brief said otherwise; schema is SSOT.) | Schema verification done; corrected scope |
| 13 | **Migration: additive only** — `Payment.importJobId String?`, `Payment.importedBy String?`, index `(businessId, importJobId)`, both FKs `onDelete: SetNull` | Mirrors 7.1A Party / 7.1C Document additive shape |
| 14 | **Chunk size 200 payments/tx** — single outer tx per row inside the chunk; no nested `$transaction` | Identical to 7.1C; payment fanout is smaller so this is conservative |
| 15 | **Batched audit emitter** `payments.imported_batch` flushed every 50 committed rows + once at chunk end; parallel arrays (NULL-per-index for unallocated) | Per-row audit rows × 10k payments = 10k audit inserts; the batch shape compresses ~200x. **Schema invariant**: array lengths MUST be equal across the 4 arrays — runtime assert before INSERT |
| 16 | **`PaymentAllocation` insert is conditional** — only when `normalizedRow.allocatedDocumentId !== null` | Unallocated payments are first-class (advance balance shows on party ledger) |
| 17 | **Strict invoice match** by `(businessId, type='SALE_INVOICE', lower(documentNumber), documentNumber IS NOT NULL, isDeleted=false)` → exact one row. Multiple matches (legacy data) → ERROR `INVOICE_AMBIGUOUS` with the candidate IDs | Schema has `@@unique([businessId, type, documentNumber])` so collisions shouldn't exist for new data; legacy seed data might |
| 18 | **Invoice match is case-insensitive** on `documentNumber` (consistent with 7.1C dedup) | Source text variations |
| 19 | **Mode dictionary** lives in `src/services/import/normalizers/payment-mode-map.constants.ts` — single SSOT. Seed values cover Tally/Vyapar/Busy common strings. Lookup key = `NFKC(input).toLowerCase().trim().replace(/\s+/g, ' ')` so `"Bank A/c"`, `"BANK A/C "`, `"बैंक  A/c"` all resolve to the same dictionary entry | Auditable, code-reviewed, no runtime mutation; Hindi/Devanagari + spacing/case tolerant |
| 20 | **Allocation amount = payment amount** (one-to-one, no partial allocation in v1) | Multi-allocation is `[FUTURE_EPIC]`; partial allocation has UX implications (residual advance handling) out of scope |
| 21 | **`PaymentAllocation` cleanup via cascade** — `Payment.onDelete: Restrict` from `Document` AND `PaymentAllocation.payment onDelete: Cascade` (schema fact) → soft-delete payment cascades allocations | Bulk-delete escape hatch by `importJobId` uses soft-delete (`isDeleted=true`) so allocation rows stay (no cascade fires on soft-delete) but a hard delete would cascade. We use soft only |
| 22 | **Sentinel block on `INVOICE_NOT_FOUND`** — commit CTA disabled with banner deep-linking to invoices import (mirrors 7.1C product sentinel) | Allowing commit with "drop bad rows" silently drops receipts; users wouldn't notice the lost data until reconciliation |
| 23 | **`?importJobId=` filter on `GET /api/payments`** — mechanical 5-line edit | Mirror 7.1C; bulk-delete and view-by-import UX |
| 24 | **`clientVersion >= 7.1.3`** server-side enforced for payments entity; 426 on older | Versioning policy from 7.1A |
| 25 | **`Payment.referenceNumber` populated when source supplies a cheque/UPI ref** (≤ 100 chars per schema); over-length → truncate **the LAST 100 chars** (Razorpay/cheque-serial pattern — uniqueness lives in the tail, e.g. `pay_OabcDEFghi…SERIAL001234567`) + WARNING `REFERENCE_TRUNCATED` | Schema has `@db.VarChar(100)`; head-truncation would collapse Razorpay payment IDs / serially-numbered cheque refs to identical prefixes and destroy the audit signal. Tail-truncation preserves serial uniqueness |
| 26 | **Intra-chunk allocation is SEQUENTIAL** — commit-payments processes rows via `for…of` (NOT `Promise.all`/parallel) inside each 200-row chunk. Each row opens a per-row tx, runs `SELECT FOR UPDATE` on the referenced `Document.id`, computes Σ existing allocations, INSERTs PaymentAllocation, commits — then the next row starts | Parallel processing within a chunk would let two rows targeting the same invoice both pass the Σ-guard against pre-write state and over-allocate. Sequential + FOR UPDATE serialises both intra-chunk (same connection, sequential) AND cross-chunk/cross-import (lock) races to the same invoice |
| 27 | **`ALLOCATION_INTERNAL_CONFLICT` (5xx) distinct from `OVER_ALLOCATION` (4xx)** — Prisma P2002 raised by the `@@unique([paymentId, invoiceId])` constraint on `PaymentAllocation` is mapped to `ALLOCATION_INTERNAL_CONFLICT` (system bug — same payment cannot reach the same invoice twice in correct code); the explicit Σ-guard raises `OVER_ALLOCATION` (user-actionable — file has too much money allocated to one invoice). The two MUST NOT be collapsed | Collapsing them would silently hide a code regression (e.g. retry without idempotency) behind a user-facing "over-allocation" error and ship the bug |
| 28 | **Tally `YYYYMMDD` raw 8-digit date pre-normalisation** — before handing to the shared `date-parser.util.ts`, the Tally parser pre-formats any 8-digit numeric date attribute as `YYYY-MM-DD` (regex `/^\d{8}$/`). Other formats (Vyapar `DD/MM/YYYY`, etc.) are NOT touched | The shared parser only accepts the 4 declared formats; Tally's raw 8-digit is a 5th format that lives at the parser-adapter layer, not in the shared util |
| 29 | **Busy XLSX Excel-serial date handling** — XLSX parser is invoked with `cellDates: true, dateNF: 'yyyy-mm-dd'`. The `xlsx` library converts Excel serial numbers (e.g. `45291`) into ISO date strings at parse time; the shared date util receives an already-ISO string | Avoids hand-rolled serial→date math (Lotus 1-2-3 leap-year bug etc.) and keeps the shared date util free of Excel-specific branches |

## §5 Data Model

**No new tables.** Reuses `ImportJob`, `ImportJobRow`, `Payment`,
`PaymentAllocation`, `Document`, `Party`. Adds the
`importJobId`+`importedBy` addendum to `Payment` (mirrors 7.1A Party,
7.1C Document).

### Schema verification (from `server/prisma/schema.prisma`)

- `Payment` columns confirmed: `id`, `offlineId`, `businessId`, `type
  (String)`, `partyId`, `amount (Int paise)`, `date (DateTime)`,
  `mode (String enum-like)`, `referenceNumber (VarChar 100 nullable)`,
  `notes (VarChar 500 nullable)`, `isDeleted`, `deletedAt`, `createdBy`,
  `updatedBy`, `createdAt`, `updatedAt`, `reversesPaymentId` (unique
  nullable — Phase 6 payroll reversal, untouched by import)
- `Payment.type` accepted values: `PAYMENT_IN`, `PAYMENT_OUT`,
  `PAYROLL_OUT`, `PAYROLL_IN`. Import writes **only `PAYMENT_IN`**
- `Payment.mode` accepted values: `CASH`, `UPI`, `BANK_TRANSFER`,
  `CHEQUE`, `NEFT_RTGS_IMPS`, `CREDIT_CARD`, `OTHER`
- `PaymentAllocation`: `(id, paymentId, invoiceId, amount Int, createdAt,
  updatedAt)`, `@@unique([paymentId, invoiceId])`, `@@index([invoiceId])`,
  `payment onDelete: Cascade`, `invoice (Document) onDelete: Restrict`
- `Document.grandTotal` is `Int` (line 967). **No `Document.amountReceived`
  / `amountDue` columns exist** — paid-state derived
- Existing indexes that cover our query patterns: `(businessId, date)`,
  `(businessId, partyId)`, `(businessId, mode)`, `(businessId, isDeleted)`,
  `@@unique([paymentId, invoiceId])` on PaymentAllocation, `(invoiceId)`

### Schema diffs

**Payment model addendum** (additive, nullable):

- `importJobId String?` — FK ImportJob (`onDelete: SetNull`)
- `importedBy   String?` — FK User      (`onDelete: SetNull`)
- Index `(businessId, importJobId)` for cleanup / bulk-delete view

No new indexes on `PaymentAllocation` — the existing
`@@unique([paymentId, invoiceId])` covers our point-lookup; the existing
`@@index([invoiceId])` covers the over-allocation `Σ amount WHERE
invoiceId = $1` query.

### Migrations (this slice)

One migration file, in transaction (no `CONCURRENTLY` needed — sparse
nullable btree on a moderately-sized table).

- **Migration A** — `prisma/migrations/<ts>_payments_import_expand/migration.sql`:
  - `ALTER TABLE "Payment" ADD COLUMN "importJobId" TEXT NULL`
  - `ALTER TABLE "Payment" ADD COLUMN "importedBy" TEXT NULL`
  - `ALTER TABLE "Payment" ADD CONSTRAINT "Payment_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"(id) ON DELETE SET NULL`
  - `ALTER TABLE "Payment" ADD CONSTRAINT "Payment_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "User"(id) ON DELETE SET NULL`
  - `CREATE INDEX "Payment_businessId_importJobId_idx" ON "Payment" ("businessId", "importJobId")`
  - ~15 lines.

**Cleanup spec**: identical to 7.1A. Same cron, same retention windows.
`Payment` + `PaymentAllocation` rows are permanent ledger and never
purged; only `ImportJobRow.raw`/`.normalized` is NULLed 24h post-commit.

### Over-allocation guard (per-row tx)

Inside the per-row tx:

```sql
-- Lock invoice row to prevent concurrent allocation race
SELECT "grandTotal"
FROM "Document"
WHERE id = $1 AND businessId = $2 AND type = 'SALE_INVOICE' AND isDeleted = false
FOR UPDATE;

-- Sum existing allocations (excluding cascade-deleted, which don't exist
-- because PaymentAllocation has no isDeleted; we filter by joined Payment.isDeleted)
SELECT COALESCE(SUM(pa.amount), 0) AS allocated
FROM "PaymentAllocation" pa
JOIN "Payment" p ON p.id = pa.paymentId
WHERE pa.invoiceId = $1 AND p.isDeleted = false;

-- If allocated + newAmount > grandTotal → ERROR OVER_ALLOCATION (rollback)
-- If subsequent INSERT raises P2002 on @@unique([paymentId, invoiceId])
--   → ERROR ALLOCATION_INTERNAL_CONFLICT (5xx; system bug, NOT user-actionable)
```

**Integration test**: two concurrent imports each allocating Rs 600 to
the same Rs 1000 invoice — one must succeed, one must fail
`OVER_ALLOCATION` (advisory lock via `SELECT FOR UPDATE` serializes them).

## §6 Error codes — `PaymentIssueCode` union

```ts
type PaymentIssueCode =
  | 'INVALID_DATE'                    // 7.1C parser ERROR
  | 'AMOUNT_NEGATIVE'                 // ≤ 0
  | 'AMOUNT_OUT_OF_RANGE'             // > 2_147_483_647 paise
  | 'PARTY_NOT_FOUND'                 // only in REQUIRE_PARTIES_FIRST mode
  | 'PARTY_AUTO_CREATED'              // warning, MATCH_OR_FLY_CREATE
  | 'PARTY_NAME_ONLY_MATCH'           // warning, name match without phone
  | 'INVOICE_NOT_FOUND'               // ERROR — invoiceNumber supplied but no match (blocks commit)
  | 'INVOICE_AMBIGUOUS'               // ERROR — >1 invoice matched (legacy data)
  | 'MULTI_ALLOCATION_UNSUPPORTED'    // ERROR — invoiceNumber has comma
  | 'OVER_ALLOCATION'                 // ERROR (4xx, user-actionable) — Σ-guard: Σ existing + new > grandTotal
  | 'ALLOCATION_INTERNAL_CONFLICT'    // ERROR (5xx, system bug) — Prisma P2002 on @@unique([paymentId, invoiceId]); never expected in correct code
  | 'MODE_DEFAULTED'                  // WARNING — unknown source mode → OTHER (default mode)
  | 'MODE_UNKNOWN_STRICT'             // ERROR — unknown source mode (STRICT_REJECT mode only)
  | 'REFERENCE_TRUNCATED'             // WARNING — referenceNumber > 100 chars; LAST 100 chars retained
  | 'DUPLICATE_PAYMENT'               // WARNING — cross-job triple match
  | 'INTRA_FILE_DUPLICATE'            // WARNING — same triple in this file
```

**Mapping rule**: in commit-payments tx, `try { insert PaymentAllocation }
catch (e) { if (e.code === 'P2002' && e.meta.target.includes('paymentId_invoiceId'))
throw new ImportError('ALLOCATION_INTERNAL_CONFLICT', 500) }`. The Σ-guard
check that precedes the insert is the ONLY path to `OVER_ALLOCATION`.

All other 7.1A codes remain valid. `PartyIssueCode` / `ProductIssueCode` /
`InvoiceIssueCode` stay entity-distinct (no merging).

## §7 API Contract changes

**Unchanged from 7.1A** — same 5 routes, same error envelope, same
`commitToken` flow, same `Idempotency-Key` contract.

Diff for Payments:

```ts
// POST /api/imports
interface CreateImportReq {
  entity: 'payments'                              // NEW value
  format: 'tally_xml' | 'vyapar_csv' | 'busy_xls' | 'generic_csv'
  file: File
  columnMapping?: Record<string, string>          // generic_csv only
  partyResolutionMode?: 'MATCH_OR_FLY_CREATE' | 'REQUIRE_PARTIES_FIRST'
                                                  // default MATCH_OR_FLY_CREATE
  strictMode?: boolean                            // NEW — default false; when true,
                                                  //   unknown payment-modes → ERROR
                                                  //   MODE_UNKNOWN_STRICT instead of
                                                  //   WARNING MODE_DEFAULTED. Wired as
                                                  //   `?strictMode=true` query param
  clientVersion: string                           // must be >= 7.1.3
}

// Row-level normalized shape
interface NormalizedPayment {
  date: string                  // ISO YYYY-MM-DD after parse
  partyResolved: {
    partyId: string | null      // null only in REQUIRE_PARTIES_FIRST + not-found
    matchedBy: 'EXISTING' | 'FLY_CREATED' | 'NOT_FOUND'
    source: { name: string; phone: string | null }
  }
  amountPaise: number           // Int paise, strictly > 0
  mode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE'
      | 'NEFT_RTGS_IMPS' | 'CREDIT_CARD' | 'OTHER'
  modeDefaulted: boolean        // true → WARNING MODE_DEFAULTED (or ERROR in strictMode)
  referenceNumber: string | null
  referenceTruncated: boolean   // true → WARNING REFERENCE_TRUNCATED; stored = last 100 chars
  invoiceMatch: {
    requested: string | null    // raw invoiceNumber from source (or null)
    documentId: string | null   // resolved invoice id (or null when no requested)
    matchedBy: 'BY_NUMBER' | 'NOT_FOUND' | 'AMBIGUOUS' | 'NOT_REQUESTED'
  }
  allocatedDocumentId: string | null  // populated only when matchedBy === 'BY_NUMBER'
                                      // and overAllocationOk; else null = advance
  notes: string | null          // ≤ 500 chars
}

// Commit response — 409 sentinel
{
  success: false,
  error: {
    code: 'COMMIT_BLOCKED_INVOICE_NOT_FOUND',
    message: 'N payments reference invoices that are not in HisaabPro yet.',
    invoiceNotFoundCount: number,
    invoiceAmbiguousCount: number,
    overAllocationCount: number
  }
}

// 500 envelope for ALLOCATION_INTERNAL_CONFLICT
{
  success: false,
  error: {
    code: 'ALLOCATION_INTERNAL_CONFLICT',
    message: 'Internal allocation conflict — please contact support.',
    rowIndex: number
  }
}
```

`GET /api/payments?importJobId=xxx` filter — additive 5-line change in
the existing payments list route. Cursor pagination preserved.

## §8 Multi-source field maps

### Tally XML

`<VOUCHER VCHTYPE="Receipt">` — already supported VCHTYPE in 7.1C parser
(was previously silently skipped). 7.1D adds the branch:

```xml
<VOUCHER VCHTYPE="Receipt" DATE="20250315">
  <PARTYLEDGERNAME>Raju Traders</PARTYLEDGERNAME>
  <PARTYMAILINGADDRESS.LIST>
    <PARTYMAILINGADDRESS>9876543210</PARTYMAILINGADDRESS>
  </PARTYMAILINGADDRESS.LIST>
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Bank A/c</LEDGERNAME>
    <AMOUNT>-50000.00</AMOUNT>           <!-- negative = dr (received into bank) -->
  </ALLLEDGERENTRIES.LIST>
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Raju Traders</LEDGERNAME>
    <AMOUNT>50000.00</AMOUNT>            <!-- positive = cr (party balance reduced) -->
    <BILLALLOCATIONS.LIST>
      <NAME>INV-2025-007</NAME>          <!-- invoice ref -->
      <AMOUNT>50000.00</AMOUNT>
    </BILLALLOCATIONS.LIST>
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

Mapping rules:
- `partyName` ← `PARTYLEDGERNAME` (first non-bank/non-cash LEDGERNAME)
- `partyPhone` ← `PARTYMAILINGADDRESS.LIST/PARTYMAILINGADDRESS` first 10-digit
  numeric (rest discarded)
- `amount` ← `|sum of bank/cash leg AMOUNTs|` (Tally's debit-side is the
  money-in leg for a receipt voucher)
- `mode` ← derived from bank-leg `LEDGERNAME` matched against the mode
  dictionary using normalised lookup (NFKC + lowercase + trim + collapse-ws),
  e.g. `"State Bank A/c"` / `"state  bank a/c"` / `"स्टेट बैंक A/c"` all
  resolve to `BANK_TRANSFER`
- `invoiceNumber` ← `BILLALLOCATIONS.LIST/NAME` first entry; if multiple
  entries → `MULTI_ALLOCATION_UNSUPPORTED` ERROR
- `referenceNumber` ← `<CHEQUENO>` if present
- `date` ← `DATE` attribute. Tally emits raw 8-digit `YYYYMMDD`. The
  Tally adapter pre-formats `/^\d{8}$/` to `YYYY-MM-DD` before invoking
  the shared `date-parser.util.ts` (Resolved Decision #28)

### Vyapar CSV — Payments export

Headers (sample):
`Date,Party Name,Phone,Amount,Payment Mode,Reference No,Invoice No,Notes`

Mapping (autodetect dictionary in `src/services/import/normalizers/payment-column-dict.constants.ts`):
- `date` ← `Date` | `Payment Date` | `Receipt Date`
- `partyName` ← `Party Name` | `Customer` | `Customer Name`
- `partyPhone` ← `Phone` | `Mobile`
- `amount` ← `Amount` | `Received` | `Receipt Amount`
- `mode` ← `Payment Mode` | `Mode` | `Type`
- `referenceNumber` ← `Reference No` | `Reference` | `Cheque No` | `UPI Ref`
- `invoiceNumber` ← `Invoice No` | `Invoice` | `Bill No`
- `notes` ← `Notes` | `Description` | `Remarks`

### Busy XLSX — `ReceiptRegister` sheet

Same column dictionary; XLSX → CSV via `xlsx` lib's `sheet_to_json` invoked
with `{ cellDates: true, dateNF: 'yyyy-mm-dd' }` (Resolved Decision #29).
This converts Excel serial numbers (e.g. `45291`) into ISO date strings at
parse time so downstream code sees only `YYYY-MM-DD`. First non-header row
may be a merged-cell title — parser skips rows whose `date` cell is empty.

### Generic CSV

Same autodetect over the dictionary above; if zero columns match → 400
`MAPPING_REQUIRED` and the FE shows the column mapper. Required mappings:
`date`, `partyName`, `amount`, `mode`. Optional: phone, reference,
invoiceNumber, notes.

## §9 Allocation algorithm

```
Per chunk (200 rows):
  for (const row of chunk) {        // SEQUENTIAL — never Promise.all
    await prisma.$transaction(async (tx) => {
      // 1. resolve party FK (preloaded map)
      // 2. resolve invoice FK (preloaded map)
      if (normalizedRow.source.invoiceNumber == null) {
        // unallocated → advance balance; STAGED
      } else if (commaInInvoiceNumber) {
        throw ImportError('MULTI_ALLOCATION_UNSUPPORTED')
      } else if (resolvedInvoiceId == null) {
        throw ImportError('INVOICE_NOT_FOUND')              // blocks commit
      } else if (multipleResolutions) {
        throw ImportError('INVOICE_AMBIGUOUS')
      } else {
        // 3. SELECT FOR UPDATE Document where id = resolvedInvoiceId
        // 4. SELECT Σ existing PaymentAllocation.amount for invoiceId
        // 5. if Σ + newAmount > Document.grandTotal → throw OVER_ALLOCATION (4xx)
        // 6. INSERT Payment
        // 7. INSERT PaymentAllocation
        //    catch P2002 on @@unique([paymentId, invoiceId])
        //    → throw ALLOCATION_INTERNAL_CONFLICT (5xx system bug)
        // 8. UPDATE ImportJobRow
        // 9. push to in-memory audit batch buffer
      }
    })
  }
  // flush audit batch at end of chunk
```

**Why sequential, not `Promise.all`** (Resolved Decision #26): two rows
within the same chunk could both target the same invoice (legitimate —
two partial receipts on one big bill). Parallel processing would let
both compute Σ against pre-write state and both pass the guard, then
both INSERT and over-allocate. The Postgres `SELECT FOR UPDATE` lock is
held only inside each row's tx; running rows in parallel on different
DB connections would each acquire+release the lock without seeing the
other's pending allocation. Sequential `for…of` on a single connection
(or, equivalently, serialised by the row-lock when two import sessions
race) is the only correct shape.

**Chunk-preload (one SELECT per chunk, not per row)**:

```sql
SELECT id, lower("documentNumber") AS lnumber
FROM "Document"
WHERE businessId = $1
  AND type = 'SALE_INVOICE'
  AND isDeleted = false
  AND "documentNumber" IS NOT NULL
  AND lower("documentNumber") = ANY($2::text[])
```

Build an in-memory `Map<lnumber, documentId[]>` to detect ambiguity.

**Commit-time over-allocation check**: per-row tx executes the
`SELECT FOR UPDATE` on Document.grandTotal + the SUM over existing
allocations BEFORE the `INSERT PaymentAllocation`. Two concurrent imports
allocating to the same invoice are serialized by the row-lock; two rows
within one chunk are serialised by `for…of`.

## §10 UX flows + copy

Mirrors 7.1C. Only differences:

1. Settings → Data Import → "Import Payments" tile (4th tile, alongside
   Parties, Products, Invoices)
2. Same format picker; entity selected by tile
3. Drag-drop file (≤10 MB, ≤10k rows)
4. Same party-resolution-mode radio (default `MATCH_OR_FLY_CREATE`)
5. **Generic CSV only**: mapping wizard auto-detects payment columns
6. Server creates `ImportJob (entity='payments')`, runs reused security
   prescans, parses → normalizes (sync ≤ 500, async-polled 500-2k)
7. Preview screen — same buckets; row card = `<PaymentRowCard>` with
   chips:
   - Party chip (taps to /parties/:id)
   - Invoice chip OR `Unallocated · advance` pill (taps to /invoices/:id
     when allocated)
   - Mode badge (mode-defaulted variant = yellow with "Set as 'Other'")
   - Amount in `Rs 1,00,000` format, tabular-nums
   - Date `15 Mar 2025`
   - Reference (truncated chip if `REFERENCE_TRUNCATED` — chip copy
     names "last 100 chars" so user understands serial-preserving behaviour)
8. User drops bad rows / accepts duplicates as SKIP
9. **Commit-blocked banner** (sticky top of preview) when any row has
   `INVOICE_NOT_FOUND` / `INVOICE_AMBIGUOUS` / `OVER_ALLOCATION` /
   `MULTI_ALLOCATION_UNSUPPORTED` / `AMOUNT_NEGATIVE` / `AMOUNT_OUT_OF_RANGE` /
   `MODE_UNKNOWN_STRICT`:
   `N payments reference invoices that aren't in HisaabPro yet. Import
   invoices first or drop those payments.`
   with **deep-link** to `/settings/data-import?entity=invoice`
10. Commit → chunks of **200 payments/tx**; per-row tx inside each chunk
    SEQUENTIAL (no `Promise.all`)
11. Summary screen → "View payments" → `/payments?importJobId=xxx`

### UX copy (diff only)

| Element | Copy |
|---------|------|
| Tile title | `Import Payments` |
| Format picker title | `Where are your customer receipts today?` |
| Party-mode radio | (inherited from 7.1C — same copy) |
| Strict-mode toggle (advanced) | `Strict mode — reject unknown payment modes (recommended for accountant-reviewed ledgers)` |
| Commit primary CTA | `Import N payments` |
| Commit primary CTA (blocked) | `Fix N invoice errors first` (disabled) |
| Commit confirm title | `Import N payments?` |
| Commit confirm body | `This adds N customer receipts to your books. M will be allocated to existing invoices; K will land as advances. This action is logged in your audit trail.` |
| Commit success toast | `Imported N payments` |
| Invoice-not-found chip | `Invoice '<number>' not found — import invoices first` |
| Invoice-ambiguous chip | `Invoice '<number>' matches more than one — needs fixing` |
| Over-allocation chip | `Would over-pay invoice by Rs X.XX` |
| Allocation-internal-conflict toast (5xx) | `Something went wrong with this payment. Please contact support — error code ALLOCATION_INTERNAL_CONFLICT.` |
| Multi-allocation chip | `Multiple invoices per payment not supported in v1` |
| Mode-defaulted chip (default mode) | `Mode '<source>' saved as 'Other'` |
| Mode-unknown-strict chip (strictMode=true) | `Mode '<source>' is not in HisaabPro's payment-mode list — fix the file or turn off strict mode` |
| Reference-truncated chip | `Reference shortened — kept the last 100 chars` |
| Amount-negative row error | `Amount must be greater than zero` |
| Amount-out-of-range | `Amount too large — split into smaller receipts` |
| Unallocated pill | `Advance · unallocated` |
| Empty (no imports) | `No imports yet. Bring your customer receipts over from Tally, Vyapar, or Busy in under 10 minutes.` |
| Re-upload warning | `Someone imported a payments file like this 3 days ago (N rows). Import it again?` |

## §11 Acceptance criteria

Per-source happy paths:

- [ ] `FEATURE_DATA_IMPORT=true` + admin → upload Tally Receipt fixture →
      `POST /api/imports {entity:'payments'}` returns 200 with
      `{ jobId, status:'PREVIEWED', commitToken, counts:{ staged:≥1 } }`
- [ ] Upload Vyapar payments CSV → `staged ≥ 1`, mode dictionary applied,
      mode-defaulted count surfaced
- [ ] Upload Busy ReceiptRegister XLSX with cells stored as Excel serials
      (e.g. `45291`) → parses; xlsx `cellDates: true, dateNF: 'yyyy-mm-dd'`
      hands ISO date string to date-util; row STAGED OK with `date =
      '2024-01-01'`
- [ ] Upload Generic CSV without mapping → 400 `MAPPING_REQUIRED`
- [ ] Upload Generic CSV with autodetect → 200; preview shows party,
      amount, mode, allocation chip per row
- [ ] Upload Tally fixture with `DATE="20250315"` (raw 8-digit) →
      pre-normalised to `2025-03-15` before date-util → row STAGED OK
- [ ] Upload row with `Payment Mode = "बैंक A/c "` (Devanagari + trailing
      space) → resolves via NFKC + lowercase + trim + collapse-ws normaliser
      to `BANK_TRANSFER`; no MODE_DEFAULTED warning
- [ ] Upload row with `Payment Mode = "BANK  A/C"` (double-space, upper)
      → resolves to `BANK_TRANSFER`

Failure cases (≥ 6 required):

- [ ] Row with `amount = 0` → ERROR `AMOUNT_NEGATIVE`
- [ ] Row with `amount > 2^31` paise → ERROR `AMOUNT_OUT_OF_RANGE`
- [ ] Row with invoiceNumber `"INV-XYZ"` not in DB → ERROR
      `INVOICE_NOT_FOUND`; commit CTA disabled; banner shows count
- [ ] Row with invoiceNumber `"INV-1,INV-2"` → ERROR
      `MULTI_ALLOCATION_UNSUPPORTED`; commit blocked
- [ ] Row with unknown source mode `"Wire Transfer"` (strictMode=false)
      → STAGED + WARNING `MODE_DEFAULTED`; Payment.mode = `OTHER` after commit
- [ ] Row with unknown source mode `"Wire Transfer"` AND `?strictMode=true`
      → ERROR `MODE_UNKNOWN_STRICT`; commit blocked; row NOT auto-defaulted
- [ ] Row with referenceNumber of 150 chars `"VERY_LONG_PREFIX_PAYMENT_SERIAL_001234567"`
      style → STAGED + WARNING `REFERENCE_TRUNCATED`; stored value is the
      LAST 100 chars (uniqueness tail preserved)
- [ ] Two rows with refs `"VERY_LONG_PREFIX_PAYMENT_SERIAL_001234567"` and
      `"VERY_LONG_PREFIX_PAYMENT_SERIAL_001234568"` (≥101 chars each, differ
      in the last digit) → both STAGED with distinct stored
      `referenceNumber` values (assert `db.payment.referenceNumber` ends
      with `...001234567` and `...001234568` respectively)
- [ ] Row with ambiguous date `03/05/2025` → ERROR `INVALID_DATE`
- [ ] Row with devanagari date `१५/०३/२०२५` → STAGED OK (folds to ASCII)
- [ ] Row with party not in DB, `REQUIRE_PARTIES_FIRST` mode → ERROR
      `PARTY_NOT_FOUND`
- [ ] Row with party not in DB, `MATCH_OR_FLY_CREATE` mode (default) →
      STAGED + WARNING `PARTY_AUTO_CREATED`; party created via canonical
      `createParty()` (verified by duplicate-phone guard)
- [ ] Over-allocation: invoice grandTotal Rs 1000, existing allocation
      Rs 600, new payment Rs 500 → ERROR `OVER_ALLOCATION` (4xx); commit
      blocked; response code maps to the explicit Σ-guard, NOT P2002
- [ ] **Intra-chunk over-allocation**: a single chunk contains 50 receipts
      (each Rs 50, total Rs 2500) all referencing one invoice with
      grandTotal Rs 1000. Commit runs row-by-row via `for…of`; the FIRST
      20 rows succeed (Σ reaches Rs 1000), rows 21-50 each fail
      `OVER_ALLOCATION` and roll back their own tx; final state = 20
      Payment + 20 PaymentAllocation rows committed, 30 ImportJobRows
      marked ERROR. Assertion: NEVER `Promise.all` in commit-payments
      (lint check against the regex `Promise\.all` in
      `commit-payments.service.ts` is a CI invariant)
- [ ] **Σ-correctness intra-chunk variant**: a single chunk has 50
      receipts all to one Rs 1000 invoice. If `Σ ≤ grandTotal` → all
      succeed; if `Σ > grandTotal` → first-N-only commit with
      `OVER_ALLOCATION` on remainder (no parallel race lets all 50 pass)
- [ ] **Σ-guard vs P2002 distinction**: synthetic test inserts a
      `PaymentAllocation(paymentId=P1, invoiceId=I1, amount=100)` then
      attempts another `PaymentAllocation(paymentId=P1, invoiceId=I1,
      amount=200)` (same composite key — only possible via a code bug or
      retry-without-idempotency). Result: 500 `ALLOCATION_INTERNAL_CONFLICT`,
      NOT 4xx `OVER_ALLOCATION`. Sentry alert fires
- [ ] **Concurrent over-allocation race**: two imports each Rs 600 on a
      Rs 1000 invoice → one succeeds, one fails `OVER_ALLOCATION`
      (asserts `SELECT FOR UPDATE` serializes)
- [ ] Cross-job duplicate: existing Payment `(B,P,2025-03-15,50000,CASH)`,
      import row with same triple+mode → WARNING `DUPLICATE_PAYMENT`;
      resolutions SKIP \| CREATE_NEW
- [ ] Intra-file duplicate: two rows same `(date,party,amount)` → first
      STAGED, second WARNING `INTRA_FILE_DUPLICATE`
- [ ] Commit 50-payment fixture (30 allocated, 20 unallocated) → 50
      Payment rows + 30 PaymentAllocation rows + 1 batched audit row with
      4 parallel arrays of length 50 (20 null in allocatedDocumentIds[])
- [ ] Every committed Payment carries `importJobId` + `importedBy`
- [ ] Mid-tx crash recovery: kill conn after Payment INSERT but before
      PaymentAllocation INSERT → retry produces exactly one Payment + one
      PaymentAllocation, no orphans
- [ ] Cross-tenant FK isolation: business A upload with party name +
      invoice number that exist in business B → zero matches against B's
      data (integration test)
- [ ] Double-POST commit (same Idempotency-Key + commitToken) → identical
      response, no duplicate Payments
- [ ] Audit batch shape: `payments.imported_batch` payload has 4 arrays
      of equal length; assert runtime check fires when lengths diverge
- [ ] `GET /api/payments?importJobId=xxx` returns only the rows committed
      under that job
- [ ] DPDP erasure of uploader → `Payment.importedBy` NULLed; rows survive
      (Party FK is Restrict — party stays; audit row notes restriction)
- [ ] Client < 7.1.3 attempting `entity='payments'` → 426 `UPGRADE_REQUIRED`
- [ ] Active job from another entity (e.g. invoices PREVIEWED) blocks new
      payments upload with 409 `ACTIVE_JOB_EXISTS`
- [ ] Screenshot: loading, error, empty, success at 375px and 320px

## §12 Out of Scope

- [FUTURE_EPIC] PAYMENT_OUT (vendor receipts) — requires Vendor module
- [FUTURE_EPIC] Multi-allocation per payment (one row → many invoices)
- [FUTURE_EPIC] Partial allocation with residual advance handling
- [FUTURE_EPIC] Refund / reversal payment imports (Phase 6 reversal path
  exists for payroll only; import does not write reversal rows)
- [FUTURE_EPIC] Credit-note linking on import (credit note → invoice
  allocation has its own accounting model)
- [FUTURE_EPIC] `PaymentDiscount` import (Phase 6 schema-side discount
  row tied to Payment) — discounts are usually computed at invoice level
  in source software
- [FUTURE_EPIC] `Document.amountReceived` / `amountDue` materialized
  columns — current derivation is correct, materialization is a perf
  optimization for a separate epic
- [FUTURE_EPIC] Mode dictionary extension via Settings UI — dictionary
  stays code-only in v1
- [FUTURE_EPIC] Resumable / chunked uploads (>10k rows) — 7.1E
- [FUTURE_EPIC] Background-worker offload — 7.1E
- [FUTURE_EPIC] BigInt widening on `Payment.amount` (currently Int paise)
- [FUTURE_EPIC] Multi-currency receipts

## §13 Open Questions

**NONE** — all decisions resolved in §4. Schema deviation from brief
(no `Document.amountReceived` column) documented in §4 row #12 with
SSOT-corrected approach.

---

## File Plan

Hard rule: every row ≤ 250 lines. Reuses **all** 7.1A/B/C files where
possible.

### Backend (`server/`)

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|------------|-------|-------|
| 1 | `prisma/schema.prisma` | edit | ~10 | schema | `Payment.importJobId`+`importedBy` + index |
| 2 | `prisma/migrations/<ts>_payments_import_expand/migration.sql` | create | ~15 | migration | Single in-tx; FK SetNull + btree index |
| 3 | `src/types/import.types.ts` | edit | ~60 | types | Add `NormalizedPayment`, `PaymentIssueCode` (+ `ALLOCATION_INTERNAL_CONFLICT`, `MODE_UNKNOWN_STRICT`), broaden `entity` union to include `'payments'`, add `strictMode?: boolean` on CreateImportReq |
| 4 | `src/constants/import.constants.ts` | edit | ~20 | constants | `PAYMENT_CHUNK=200`, `PAYMENT_AUDIT_BATCH=50`, `REFERENCE_MAX_LEN=100`, `REFERENCE_TRUNCATE_FROM='tail'`, `INT_PAISE_MAX` reused |
| 5 | `src/schemas/import.schemas.ts` | edit | ~30 | schema | Add `entity='payments'` Zod branch; reuse `partyResolutionMode` enum; add `strictMode: z.boolean().optional().default(false)` |
| 6 | `src/services/import/normalizers/payment-mode-map.constants.ts` | create | ~80 | constants | SSOT dictionary; values keyed by normalised string `NFKC(s).toLowerCase().trim().replace(/\s+/g, ' ')`; exports `normaliseModeKey()` + `lookupMode()`; ~30 mappings covering Tally/Vyapar/Busy English + Hindi synonyms |
| 7 | `src/services/import/normalizers/payment-column-dict.constants.ts` | create | ~50 | constants | Autodetect dictionary for Vyapar/Busy/Generic CSV |
| 8 | `src/services/import/normalizers/payment-normalizer.ts` | create | ~230 | service | Per-row normalize: date (reuse 7.1C util after Tally `\d{8}` pre-format), amount (string→Int paise via `narrowPaiseToInt`), mode mapping via `lookupMode()` with strictMode branch, reference TAIL-truncation, party FK lookup integration, invoice FK lookup integration |
| 9 | `src/services/import/resolvers/invoice-resolver.ts` | create | ~120 | service | Chunk-preload Document rows by `(businessId, type='SALE_INVOICE', lower(documentNumber))`; emit NOT_FOUND / AMBIGUOUS / BY_NUMBER / NOT_REQUESTED |
| 10 | `src/services/import/dedup/payment-dedup.ts` | create | ~140 | service | Intra-file `(date,partyKey,amount)` triple + cross-job `(businessId,partyId,date,amount,mode)` SELECT |
| 11 | `src/services/import/parsers/tally-xml.parser.ts` | edit | ~90 | service | Add `<VOUCHER VCHTYPE="Receipt">` branch with PARTYLEDGERNAME + ALLLEDGERENTRIES bank-leg detection + BILLALLOCATIONS reading + `/^\d{8}$/` date pre-format |
| 12 | `src/services/import/parsers/vyapar-csv.parser.ts` | edit | ~40 | service | Payment column dictionary registration |
| 13 | `src/services/import/parsers/busy-excel.parser.ts` | edit | ~55 | service | `ReceiptRegister` sheet branch + `sheet_to_json` invoked with `{ cellDates: true, dateNF: 'yyyy-mm-dd' }` |
| 14 | `src/services/import/parsers/generic-csv.parser.ts` | edit | ~30 | service | Payment header autodetect vocabulary |
| 15 | `src/services/import/commit-payments.service.ts` | create | ~245 | service | **Sequential `for…of` over chunk rows (NEVER `Promise.all`)** — per-row tx: SELECT FOR UPDATE Document → over-allocation Σ-check → INSERT Payment → (optionally) INSERT PaymentAllocation (P2002 → ALLOCATION_INTERNAL_CONFLICT 5xx) → UPDATE ImportJobRow → batched audit; pre-scan COMMITTED on retry; 200/chunk. CI lint asserts no `Promise.all` in this file |
| 16 | `src/services/import/commit-dispatcher.ts` | edit | ~30 | service | Add `case 'payments':` branch |
| 17 | `src/services/import/audit.ts` | edit | ~30 | service | Add `payments.imported_batch` emitter with parallel-array length-equality assert |
| 18 | `src/routes/imports/create.route.ts` | edit | ~20 | route | Accept `entity='payments'` + `?strictMode=true` query param in Zod |
| 19 | `src/routes/imports/get.route.ts` | edit | ~10 | route | Return payment-shape polymorphic by entity |
| 20 | `src/routes/payments/list.route.ts` | edit | ~10 | route | `?importJobId=` filter — mechanical add |
| 21 | `scripts/enforce-audit-coverage.mjs` | edit | ~5 | script | Add `payments.imported_batch` to expected keys |
| 22 | `tests/fixtures/import/payments/tally-sample.xml` | create | n/a | fixture | 50-receipt fixture, mix of allocated / unallocated / multi-allocation / unknown-invoice + ≥1 `DATE="20250315"` raw 8-digit + ≥1 Devanagari ledger name |
| 23 | `tests/fixtures/import/payments/vyapar-sample.csv` | create | n/a | fixture | 50-receipt flat, ≥1 mode-defaulted, ≥1 over-allocation seed, ≥1 strictMode-rejected mode, ≥2 long-reference rows differing only in last digit |
| 24 | `tests/fixtures/import/payments/busy-sample.xlsx` | create | n/a | fixture | ReceiptRegister sheet with ≥3 rows using Excel-serial date cells (not ISO strings) |
| 25 | `tests/fixtures/import/payments/generic-sample.csv` | create | n/a | fixture | autodetect targets + over-allocation + duplicate-payment + reference-truncate-tail + devanagari-date + Devanagari-mode + intra-chunk-overflow rows |
| 26 | `tests/integration/import-payments.test.ts` | create | ~250 | test | All §11 acceptance criteria including intra-chunk over-allocation (50 rows → 1 invoice), Σ-guard vs P2002 distinction, concurrent-over-allocation race, mid-tx crash, cross-tenant isolation, DPDP, batched-audit equal-length, strictMode mode rejection, tail-truncation uniqueness, Devanagari mode lookup, Tally 8-digit date, Busy Excel-serial date |

**Reused as-is from 7.1A/B/C (no edits)**: xxe-prescan, zip-bomb-prescan,
csv-injection util, import-job.service core, all middleware, cleanup-cron,
7.1B `price.util.ts` (incl. `narrowPaiseToInt`), 7.1C `date-parser.util.ts`,
7.1C `party-resolver.ts`, malicious fixtures, idempotency middleware,
rate-limit middleware, `commit-parties.service.ts`, `commit-products.service.ts`,
`commit-invoices.service.ts`.

### Frontend (`src/`)

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|------------|-------|-------|
| 27 | `src/features/import/import.types.ts` | edit | ~40 | types | `PaymentIssueCode` (+ALLOCATION_INTERNAL_CONFLICT, MODE_UNKNOWN_STRICT), payment preview shape, strictMode flag |
| 28 | `src/features/import/import.constants.ts` | edit | ~10 | constants | Payment format labels |
| 29 | `src/features/import/import.service.ts` | edit | ~25 | service | `entityType: 'import'`, `entityLabel: \`Payments: \${fileName}\``; pass strictMode through |
| 30 | `src/features/import/useColumnAutodetect.ts` | edit | ~40 | hook | Payment header dictionary |
| 31 | `src/features/import/useCommitBlockSentinel.ts` | edit | ~35 | hook | Extend to cover `INVOICE_NOT_FOUND` / `INVOICE_AMBIGUOUS` / `OVER_ALLOCATION` / `MULTI_ALLOCATION_UNSUPPORTED` / `AMOUNT_NEGATIVE` / `AMOUNT_OUT_OF_RANGE` / `MODE_UNKNOWN_STRICT`. `ALLOCATION_INTERNAL_CONFLICT` is treated as a 5xx fatal — toast, not a per-row chip |
| 32 | `src/features/import/pages/ImportLandingPage.tsx` | edit | ~25 | page | Add "Import Payments" tile (4th) |
| 33 | `src/features/import/pages/ImportUploadPage.tsx` | edit | ~40 | page | Payment-entity title; reuse `<PartyResolutionToggle>`; advanced disclosure with strictMode toggle |
| 34 | `src/features/import/pages/ImportMappingPage.tsx` | edit | ~30 | page | Payment column targets |
| 35 | `src/features/import/pages/ImportPreviewPage.tsx` | edit | ~55 | page | Render `<PaymentRowCard>`; commit-blocked banner copy for payments; 5xx ALLOCATION_INTERNAL_CONFLICT toast path |
| 36 | `src/features/import/components/PaymentRowCard.tsx` | create | ~190 | sub-component | Party chip + invoice chip OR `Unallocated · advance` pill + mode badge (defaulted variant yellow; strict-rejected variant red) + amount tabular-nums + date + reference (truncated chip with "last 100 chars" copy) + per-row warnings/errors |
| 37 | `src/features/import/components/AllocationChip.tsx` | create | ~90 | sub-component | Invoice deep-link chip OR advance pill OR error-state variants (not-found / ambiguous / over / multi) |
| 38 | `src/features/import/components/ColumnMapper.tsx` | edit | ~20 | sub-component | Entity-aware target columns for payments |
| 39 | `src/lib/translations.en.ts` | edit | ~70 | constants | `import.payments.*` keys incl. strictMode toggle copy, tail-truncate copy, internal-conflict toast |
| 40 | `src/lib/translations.hi.ts` | edit | ~70 | constants | hi-IN parity |

Total **new+edited**: ~40 files; every estimate ≤ 250 lines. Largest new
files: `import-payments.test.ts` at ~250L (at cap), `commit-payments.service.ts`
at ~245L, `payment-normalizer.ts` at ~230L, `PaymentRowCard.tsx` at ~190L.

---

## UI States

Same five wizard pages as 7.1A/B/C. Differences for payment flow are
detailed in §10. All four UI states (Loading / Error / Empty / Success)
exist on every screen with exact copy in §10 and reuse `<ListSkeleton>`,
`<ErrorState onRetry />`, `<EmptyState />`, render `<PaymentRowCard>`.
Tested at 320px and 375px.

Autocomplete: file input `accept=".xml,.csv,.xls,.xlsx"`; mapping inputs
`autocomplete="off"`; party-resolution radio has no autocomplete; strictMode
toggle has no autocomplete.

## Mobile

Inherited from 7.1A/B/C. `<PaymentRowCard>` height ≤ 88px at 320px (no
nested expansion needed — single row data fits without collapse).
Allocation chip is a single tap-target ≥ 44px deep-linking to the
invoice or party. Mode badge truncates to 8 chars at 320px.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Tally `<VOUCHER VCHTYPE="Receipt">` with no `BILLALLOCATIONS.LIST` | Unallocated payment (advance); STAGED OK |
| Tally Receipt voucher with multiple `BILLALLOCATIONS.LIST/NAME` entries | ERROR `MULTI_ALLOCATION_UNSUPPORTED` |
| Tally bank-leg `LEDGERNAME` not in mode dictionary (e.g. `"Personal Wallet"`) | mode → `OTHER` + WARNING `MODE_DEFAULTED` (or ERROR `MODE_UNKNOWN_STRICT` when strictMode=true) |
| Tally bank-leg `LEDGERNAME = "बैंक A/c"` (Devanagari) | Normalised lookup (NFKC + lc + trim + ws-collapse) hits dictionary entry → `BANK_TRANSFER` |
| Tally `DATE="20250315"` (raw 8-digit, Tally's default) | Adapter pre-formats `\d{8}` → `2025-03-15` before date-util |
| Busy XLSX with date cell stored as Excel serial `45291` | `cellDates: true, dateNF: 'yyyy-mm-dd'` converts to `2024-01-01` ISO string before date-util |
| Vyapar CSV with negative `Amount` value (a refund) | ERROR `AMOUNT_NEGATIVE` (refund flow is out of scope) |
| Vyapar CSV with `Payment Mode = ""` blank | mode → `OTHER` + WARNING `MODE_DEFAULTED` (or ERROR in strictMode) |
| Vyapar CSV with `Payment Mode = "BANK  A/C "` (uppercase + double-space + trailing) | Normalised lookup hits `bank a/c` entry → `BANK_TRANSFER` |
| Generic CSV with `invoiceNumber = "INV-001 "` (trailing space) | Trim before lookup; case-insensitive match |
| Generic CSV row with `partyPhone = "+91 98765 43210"` | Normalize via canonical Party phone util (reuse from `createParty()`) — same as 7.1C |
| Reference number = 150-char Razorpay-style id `pay_OabcDEFghi…SERIAL001234567` | Store the LAST 100 chars (`…SERIAL001234567`); WARNING `REFERENCE_TRUNCATED`; uniqueness lives in the tail |
| Two refs differ only in last digit (`…001234567` vs `…001234568`) at >100 chars | Both stored as DISTINCT values (tail-truncation preserves uniqueness) |
| Payment for invoice that has been soft-deleted | Treated as `INVOICE_NOT_FOUND` (resolver filters `isDeleted=false`) |
| Payment for invoice in business B (cross-tenant attempt) | Resolver `WHERE businessId = $1` returns zero rows → `INVOICE_NOT_FOUND` (does NOT leak existence) |
| Over-allocation: invoice fully paid via existing allocations, new payment of same invoice | ERROR `OVER_ALLOCATION` (4xx, Σ-guard path) |
| Allocated payment whose amount < invoice grandTotal | OK — partial payment lands; remaining `amountDue` stays positive (derived view) |
| Same chunk contains 50 receipts to the same invoice (Σ > grandTotal) | `for…of` processes sequentially; first-N succeed, remainder ERROR `OVER_ALLOCATION`; NEVER all-pass (parallel race excluded by design) |
| Code bug retries an allocation with identical `(paymentId, invoiceId)` → P2002 from `@@unique` | Mapped to `ALLOCATION_INTERNAL_CONFLICT` (5xx); Sentry alert fires; user sees support toast, NOT a confusing 4xx over-allocation |
| Commit retry after mid-tx crash | Per-row guard `createdEntityId IS NULL` + Postgres rollback → exactly one Payment + at-most-one Allocation |
| Same Payment imported twice (idempotent retry, same `Idempotency-Key` + `commitToken`) | Cached response replayed; no duplicate rows |
| Cross-tenant party-resolution leak attempt | `WHERE businessId = $1` on every preload; integration test asserts zero leak |

## Security

Inherits 7.1A §Security **verbatim**. Same auth/role gates, same rate
limits, same lockout, same XXE/zip-bomb/CSV-injection envelope, same
idempotency contract, M1-M11 directives intact.

### NEW MUST_FIX surface (security audit will verify)

1. **Cross-tenant invoice resolution leak** — `invoice-resolver.ts`
   query `WHERE businessId = $1` is non-optional. Integration test
   asserts business B's invoice number invisible to A even when string
   matches exactly.
2. **Over-allocation race (cross-import)** — `SELECT FOR UPDATE` on the
   Document row inside the per-row tx prevents two concurrent imports
   from each thinking the invoice has room. Integration test runs two
   concurrent imports each Rs 600 on a Rs 1000 invoice; one must error
   `OVER_ALLOCATION`.
3. **Over-allocation race (intra-chunk)** — commit-payments processes
   rows sequentially via `for…of` over the chunk; NEVER `Promise.all`.
   This serialises rows in the same chunk that target the same invoice.
   CI lint rule: `grep -E 'Promise\.all' commit-payments.service.ts` must
   return zero matches.
4. **P2002 vs Σ-guard collapse** — Prisma P2002 on `@@unique([paymentId,
   invoiceId])` maps to `ALLOCATION_INTERNAL_CONFLICT` (5xx). The Σ-guard
   maps to `OVER_ALLOCATION` (4xx). They MUST NOT share a code — collapsing
   them would silently hide a code regression (e.g. idempotency-key bug)
   behind a user-facing 4xx and ship the bug.
5. **Mode-enum poisoning** — no fly-create of `Payment.mode` values.
   Dictionary is code-only SSOT (`payment-mode-map.constants.ts`);
   lookup is normalised (NFKC + lc + trim + ws-collapse), Hindi-tolerant.
   Unknown → `OTHER` + WARNING (or `MODE_UNKNOWN_STRICT` ERROR when
   `?strictMode=true`). Integration test: upload row with
   `mode = "DROP TABLE Payment"` → committed as `OTHER` (or rejected in
   strict mode), no SQL evaluated.
6. **Reference-number truncation as audit signal** — TAIL-truncated (last
   100 chars) to preserve uniqueness in Razorpay/cheque serials. Emits
   `REFERENCE_TRUNCATED` warning. Head-truncation would collapse distinct
   payment ids to identical prefixes and destroy the audit trail —
   regression test asserts two 150-char refs differing in the last digit
   remain distinct after import.
7. **Fly-created party via canonical service** — reuses 7.1C's guarantee
   that `party-resolver.ts` invokes `createParty()` (which routes through
   M10 length-prefix advisory lock + canonical Zod + audit) and never
   raw `prisma.party.create()`. Verified by integration test asserting
   duplicate-phone guard fires.
8. **Batched audit emitter — equal-length invariant** — runtime assert
   before INSERT: `paymentIds.length === amounts.length === partyIds.length
   === allocatedDocumentIds.length`. Divergence throws an unrecoverable
   server error rather than silently emit a corrupt audit row (compliance
   risk — audit row IS the source of truth for "what was imported").
9. **No PII expansion** — payment ledger PII (party name+phone) sources
   from existing Party rows; no new principal data. DPDP rules for Party
   apply unchanged.

### Audit row additions

- `payments.imported_batch` per chunk-flush (every 50 rows + at chunk
  end), payload `{ importJobId, paymentIds: string[], amounts: number[],
  partyIds: string[], allocatedDocumentIds: (string|null)[] }`
- 7 `import_job.*` action keys reused unchanged
- `enforce-audit-coverage.mjs --block` updated to expect
  `payments.imported_batch`

### Cross-tenant isolation

- Party resolver — `WHERE businessId = $1` (reuse 7.1C)
- Invoice resolver — `WHERE businessId = $1 AND type='SALE_INVOICE'`
- Dedup cross-job query — `WHERE businessId = $1`
- Over-allocation SUM — `WHERE pa.invoiceId = $1` joined with Payment
  where `Payment.businessId = $2` (joined business cardinality)
- Integration test asserts business B's parties/invoices/payments
  invisible to A across all four query paths

## Observability

Same 7 analytics events as 7.1A — `entity: 'payments'` added to the
existing union. New properties on commit event:
`flyCreatedPartyCount`, `allocatedCount`, `unallocatedCount`,
`modeDefaultedCount`, `modeStrictRejectedCount`, `overAllocationCount`,
`allocationInternalConflictCount`.

Sentry alerts: any single `ALLOCATION_INTERNAL_CONFLICT` event in prod
pages the on-call (this code SHOULD NEVER fire — every occurrence is a
real bug). `OVER_ALLOCATION` is a normal user-facing error and is NOT
paged.

Metrics gain values for `entity='payments'` on the existing series. New
label `allocationStatus` on `import_commit.duration_p99_ms`.

Cost alert: `Payment` row insert rate per business per day — alert if
> 20k payments/day (well above any legit historical receipt import).

## Test Infrastructure

- 4 new fixtures at `tests/fixtures/import/payments/` (one per format,
  50 receipts each)
- Reuses malicious-billion-laughs.xml and malicious-zip-bomb.xlsx from 7.1A
- Generic fixture includes: 1 over-allocation seed row, 1 ambiguous-invoice
  row, 1 multi-allocation row, 1 unknown-mode row, 1 strictMode-rejected
  row, 1 ref-truncate-tail row, 2 long-ref rows differing only in last
  digit, 1 devanagari-date row, 1 devanagari-mode row, 1 unknown-invoice
  row, 1 negative-amount row, 1 zero-amount row, 1 amount-out-of-range
  row, 1 cross-job duplicate seed (pre-seeded existing Payment), 1
  intra-file duplicate pair, 1 intra-chunk over-allocation block (50
  rows → 1 invoice)
- Busy XLSX fixture includes ≥3 date cells stored as raw Excel serial
  numbers (NOT pre-formatted ISO) to exercise `cellDates: true` path
- Tally XML fixture includes ≥1 `DATE="20250315"` raw 8-digit attribute
- New integration test `tests/integration/import-payments.test.ts`
  covers every §11 acceptance bullet, plus:
  - **Intra-chunk over-allocation** — 50 receipts in one chunk to one
    invoice; assert first-N-only commit, never parallel race
  - **Σ-guard vs P2002 distinction** — synthetic P2002 returns 5xx
    `ALLOCATION_INTERNAL_CONFLICT`, Σ-guard returns 4xx `OVER_ALLOCATION`
  - **Concurrent over-allocation race** — `Promise.all` of two commits
    each allocating to the same invoice; assert exactly one succeeds
  - **Mid-tx crash recovery** — kill conn after Payment INSERT before
    PaymentAllocation INSERT; retry; assert exactly one Payment + one
    Allocation, no orphans
  - **Cross-tenant FK isolation** across all 4 query paths
  - **Batched audit equal-length assertion** — synthetic divergence
    in the array builder throws and rolls back
  - **DPDP erasure** — uploader User soft-delete → `Payment.importedBy`
    NULLs; rows survive; audit row notes
  - **Fly-create through canonical service** — assert duplicate-phone
    guard fires
  - **Devanagari mode lookup** — `"बैंक A/c"` resolves to `BANK_TRANSFER`
  - **strictMode rejection** — `?strictMode=true` + `"Wire Transfer"`
    row → `MODE_UNKNOWN_STRICT` ERROR, commit blocked
  - **Tail-truncation uniqueness** — two 150-char refs differing in last
    digit remain distinct post-import
  - **Tally 8-digit date** — `DATE="20250315"` → `2025-03-15`
  - **Busy Excel-serial date** — serial `45291` → `2024-01-01`
- CI lint invariant: `grep -nE 'Promise\.all' commit-payments.service.ts`
  must return zero matches (regression guard against intra-chunk race)
- CI sets `FEATURE_DATA_IMPORT=true` for test business; reserved
  test-party phone range from 7.1A reused

## Accepted Trade-offs

- **Reuse `ImportJob.entity` discriminator** — no new tables / routes
- **PAYMENT_IN only in v1**, PAYMENT_OUT deferred — vendor module is
  cross-cutting; ship the customer-receipt flow first
- **Single allocation per payment** in v1 — multi-allocation is rare in
  source exports; `[FUTURE_EPIC]`
- **No `Document.amountReceived` / `amountDue` columns** — derived view
  preserved; materialized columns are a perf epic when reports get slow
- **Lenient allocation policy** (strict only when invoiceNumber supplied)
  — preserves real-world Tally export shape over rigor
- **Mode dictionary is closed**, no fly-create — protects enum integrity
- **Sequential intra-chunk processing** (no `Promise.all`) trades chunk
  throughput for correctness — at 200 rows/chunk and ~20ms per tx, a chunk
  takes ~4s wall-clock. Acceptable for an import flow; correctness > speed
- **strictMode is opt-in** (default off) — Raju persona wants forward
  motion (defaulting to OTHER); Priya/Amit can opt into rejection
- **Batched audit row (vs per-payment audit row used by 7.1C invoices)**
  — payments are higher-volume and a per-row audit at 10k receipts is
  10k extra INSERTs; batched shape with 4 parallel arrays compresses
  ~200x. Conscious divergence from 7.1C, justified by volume
- **Reference TAIL-truncated at 100 chars** with warning — schema cap;
  head-truncation would collapse Razorpay/cheque serials to identical
  prefixes and destroy audit. Alternative is widening `VarChar(100)`
  (cross-cutting, deferred)
- **Σ-guard ERROR and P2002 ERROR kept distinct (4xx vs 5xx)** — refusing
  to collapse 4xx and 5xx is a conscious cost (one extra error code, one
  extra Sentry rule); the benefit is that any P2002 immediately surfaces
  as a system regression instead of being lost in the user-facing 4xx noise
- **Negative amounts rejected** rather than silently flipping sign —
  refund flow is out of scope and any sign-flip is a silent data fabrication
- **No DocumentNumberSeries impact** — payments don't consume invoice
  numbers (consistent with 7.1C)
- **Soft-delete on bulk-by-`importJobId`** — preserves audit; allocations
  are NOT cascade-deleted (soft-delete doesn't cascade); paid-state
  derivation excludes deleted payments via the JOIN filter on
  `Payment.isDeleted = false`

## Cross-feature Impact

- **Payment model**: gains `importJobId String?` + `importedBy String?`.
  One additive migration. Symmetric with 7.1A Party / 7.1C Document
- **Payments list**: `?importJobId=xxx` added to `GET /api/payments` —
  mirrors other entities
- **Audit log**: new action key `payments.imported_batch`; 7
  `import_job.*` keys reused
- **Party creation**: fly-create still goes through canonical
  `createParty()` — no edit to party service
- **Feature flag**: same `FEATURE_DATA_IMPORT`. No separate flag
- **Commit dispatcher**: one new branch `case 'payments':`
- **FE wizard**: 4th `EntityPicker` tile; new `<PaymentRowCard>` family;
  new `<AllocationChip>`; reused `<PartyResolutionToggle>`; new strictMode
  toggle inside advanced disclosure on `ImportUploadPage`
- **No change to 7.1A/B/C commit paths** — 7.1D only reads existing
  Party / Document / Product rows for resolution
- **No change to existing Phase 6 payroll-reversal code** —
  `Payment.reversesPaymentId` stays null on imported rows;
  `Payment.type` always `PAYMENT_IN`

## Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Concurrent over-allocation race (cross-import) | High | `SELECT FOR UPDATE` on Document inside per-row tx; integration test runs two concurrent imports |
| 2 | Intra-chunk over-allocation race | High | Sequential `for…of` over chunk rows (NEVER `Promise.all`); CI lint asserts; acceptance test of 50 rows → 1 invoice asserts first-N-only commit |
| 3 | P2002 collapsed onto OVER_ALLOCATION (silent regression) | High | Distinct codes `ALLOCATION_INTERNAL_CONFLICT` (5xx) vs `OVER_ALLOCATION` (4xx); Sentry pages on any 5xx; integration test asserts mapping |
| 4 | Mode-enum poisoning via fly-create | High | Dictionary SSOT, no fly-create, normalised lookup, unknown → OTHER + WARNING (or strict-reject ERROR) |
| 5 | Cross-tenant invoice/party leak | High | `WHERE businessId = $1` on every preload; integration test |
| 6 | Mid-tx crash leaving orphan Payment without Allocation | High | Per-row tx with Postgres rollback; `createdEntityId IS NULL` retry guard |
| 7 | Batched audit row with mismatched array lengths (silent corruption of compliance evidence) | High | Runtime length-equality assert before INSERT; throws hard error |
| 8 | Reference head-truncation destroying serial uniqueness | High | TAIL-truncation at 100 chars; regression test on two refs differing only in last digit |
| 9 | Schema deviation: brief assumed `Document.amountReceived` exists; it doesn't | Resolved | Scope corrected to use derived `Σ PaymentAllocation`; over-allocation guard via SUM + SELECT FOR UPDATE |
| 10 | Reference-number silent truncation | Medium | Surface as WARNING chip; store truncated value (last 100 chars) |
| 11 | Negative-amount rows from refund-style source files | Medium | ERROR `AMOUNT_NEGATIVE`; refunds are out of scope, user drops or fixes |
| 12 | Tally raw 8-digit date not understood by shared date-util | Medium | Tally adapter pre-formats `/^\d{8}$/` to `YYYY-MM-DD` before invoking util |
| 13 | Busy XLSX Excel-serial date misread as integer | Medium | `sheet_to_json({ cellDates: true, dateNF: 'yyyy-mm-dd' })` |
| 14 | Soft-delete-by-importJobId leaves allocations un-soft-deleted (allocation rows have no isDeleted column) | Low | Allocation paid-state derivation joins `Payment.isDeleted=false`, so soft-deleted Payment's allocations are excluded from Σ correctly |
| 15 | Unallocated payments confusingly shown as "advance" on party ledger | Low | UX copy `Advance · unallocated` on the chip; party ledger already shows advance balance from Phase 6 |
| 16 | DocumentNumberSeries — N/A | None | Payments don't consume number series |
| 17 | Cost of batched audit grows when many small chunks land — equal-length arrays are repeated headers | Low | Flush every 50 + at chunk end; max array size 200 — JSON payload ~10kb max per row, acceptable |

## Acceptance Criteria

(canonical bullet list in §11; this section duplicates the binary subset
the verifier ticks against)

- [ ] `curl POST /api/imports {entity:'payments', clientVersion:'7.1.3'}`
      with valid CSV → 200 `{ success: true, data: { jobId, status:
      'PREVIEWED', commitToken, counts } }`
- [ ] Without auth → 401
- [ ] `clientVersion: '7.1.2'` → 426 `UPGRADE_REQUIRED`
- [ ] Bad input (missing `partyResolutionMode` value) → 400
- [ ] Active job from another entity blocks new upload → 409
      `ACTIVE_JOB_EXISTS`
- [ ] Commit with `INVOICE_NOT_FOUND` rows → 409
      `COMMIT_BLOCKED_INVOICE_NOT_FOUND` with counts payload
- [ ] Commit with synthetic P2002 on PaymentAllocation → 500
      `ALLOCATION_INTERNAL_CONFLICT` (NOT 4xx `OVER_ALLOCATION`)
- [ ] Chunk with 50 rows targeting one invoice (Σ > grandTotal) → first-N
      succeed, remainder ERROR `OVER_ALLOCATION`, no all-pass
- [ ] Two 150-char refs differing only in last digit → both stored as
      distinct values (tail-truncation)
- [ ] `?strictMode=true` + unknown mode row → ERROR `MODE_UNKNOWN_STRICT`,
      commit blocked
- [ ] Tally `DATE="20250315"` → `Payment.date = 2025-03-15`
- [ ] Busy XLSX Excel-serial `45291` → `Payment.date = 2024-01-01`
- [ ] Devanagari mode `"बैंक A/c"` → `Payment.mode = BANK_TRANSFER`
- [ ] All §11 failure cases verified by `tests/integration/import-payments.test.ts`
- [ ] Screenshot: loading, error, empty, success at 375px
- [ ] 320px: no horizontal scroll on `<PaymentRowCard>`; allocation chip
      truncates; mode badge truncates to 8 chars
- [ ] All copy strings live in `translations.en.ts` + `translations.hi.ts`
- [ ] `node scripts/enforce.js` → 0 errors
- [ ] `npx tsc -b --noEmit` → 0 errors
- [ ] Audit-coverage script asserts `payments.imported_batch` key
- [ ] CI lint: `grep -E 'Promise\.all' commit-payments.service.ts` → 0 matches

## QA Checklist

- [ ] Upload Tally Receipt fixture → preview renders 50 rows; allocated
      chip on rows with `BILLALLOCATIONS.LIST`, advance chip on rest
- [ ] Upload Vyapar payments CSV → mode mapping applied; defaulted
      rows show yellow chip
- [ ] Upload Busy ReceiptRegister XLSX (Excel-serial dates) → all rows
      parse to correct ISO dates; merged-header row skipped
- [ ] Upload Vyapar CSV with strictMode toggle ON + unknown mode →
      red chip "Mode '<source>' is not in HisaabPro's payment-mode list",
      commit CTA disabled
- [ ] Upload Vyapar CSV with `Payment Mode = "BANK  A/C"` (case + spacing
      variation) → resolves to BANK_TRANSFER, no warning chip
- [ ] Upload row with Razorpay-style 150-char reference →
      `REFERENCE_TRUNCATED` chip with copy "kept the last 100 chars";
      DB shows last-100 substring
- [ ] Generic CSV mapping wizard → autodetect populates 4 required
      columns (date, partyName, amount, mode)
- [ ] Toggle `REQUIRE_PARTIES_FIRST` mode → rows with unknown party
      become ERROR rows
- [ ] Drop a row in preview → commit count decreases; banner count
      decreases if it was blocking
- [ ] Commit a 50-row file with mix of allocated (30) + unallocated (20)
      → Summary screen shows `30 allocated to invoices, 20 advances`
- [ ] Click "View payments" → `/payments?importJobId=xxx` filters to
      the 50 just-imported
- [ ] Bulk-soft-delete by importJobId (admin escape hatch) → 50
      Payments soft-deleted; party ledger reflects rollback
- [ ] Concurrent two-window import to the same invoice → second window
      gets `OVER_ALLOCATION` error
- [ ] Single-window import of a 50-row chunk all to one Rs 1000 invoice
      → first 20 rows succeed (Σ=Rs 1000), remaining 30 fail
      `OVER_ALLOCATION`; never all-pass
- [ ] Synthetic P2002 (test harness inserts duplicate `(paymentId,
      invoiceId)`) → 500 ALLOCATION_INTERNAL_CONFLICT toast; Sentry alert
      verified
- [ ] Offline retry while commit is in-flight → `Idempotency-Key`
      replay returns same response; no duplicates
- [ ] Dark mode parity verified on `<PaymentRowCard>`, allocation chip,
      mode badge (defaulted yellow + strict-rejected red variants),
      commit-blocked banner, strictMode toggle
- [ ] Hindi translation parity verified (incl. Devanagari mode-lookup
      chip text)

---

## §Revision Log v2

**Date:** 2026-05-19
**Audit reference:** `docs/SCOPE_AUDIT_PHASE7_IMPORT_7_1D_PAYMENTS.md` (BLOCK — 3 MUST_SHIP + 4 SHOULD_SHIP)

### MUST_SHIP gaps closed

1. **Intra-chunk over-allocation race (Gap 1)** — added Resolved Decision
   #26 mandating sequential `for…of` (never `Promise.all`) inside
   commit-payments. Updated §9 Allocation algorithm with the sequential
   loop body + rationale. Added §11 acceptance tests for 50-row →
   1-invoice chunk (first-N-only commit). Added §Security #3 (intra-chunk
   race) with a CI lint invariant `grep -E 'Promise\.all'
   commit-payments.service.ts → 0 matches`. Added §Risks row #2.

2. **P2002 collapsed onto OVER_ALLOCATION (Gap 2)** — introduced new
   error code `ALLOCATION_INTERNAL_CONFLICT` (5xx) in §6 union. Added
   Resolved Decision #27 documenting the 4xx-vs-5xx separation rationale.
   Added explicit P2002→ALLOCATION_INTERNAL_CONFLICT mapping rule in §6
   and inside §5 SQL block. Added §7 API contract 500 envelope. Added
   §Security #4 (P2002 vs Σ-guard collapse). Added Sentry alert (pages
   on any ALLOCATION_INTERNAL_CONFLICT). Added §Observability commit
   property `allocationInternalConflictCount`. Added §11 acceptance test
   for synthetic P2002 mapping. Added §Risks row #3.

3. **Reference truncation tail (Gap 3)** — rewrote Resolved Decision #25
   from "first 100 chars" to "last 100 chars (Razorpay/cheque-serial
   pattern)". Updated UX copy `Reference shortened — kept the last 100
   chars`. Added §11 acceptance test for two 150-char refs differing
   only in last digit remaining distinct. Added §Security #6
   (head-truncation footgun). Added §Edge Cases rows for Razorpay-style
   IDs. Added §Risks row #8.

### SHOULD_SHIP folds

1. **Hindi/Devanagari + whitespace + case normalisation on mode lookup**
   — updated Resolved Decision #19: lookup key =
   `NFKC(s).toLowerCase().trim().replace(/\s+/g, ' ')`. File Plan #6
   exposes `normaliseModeKey()` + `lookupMode()`. Added §11 acceptance
   tests for `"बैंक A/c "` and `"BANK  A/C"`. Added Edge Cases rows.

2. **Opt-in `STRICT_REJECT` mode for unknown payment-modes** — added
   new diff row #13 in §1; new `MODE_UNKNOWN_STRICT` code; CreateImportReq
   `strictMode?: boolean` + `?strictMode=true` query param; UX copy for
   advanced disclosure toggle + red chip; §11 acceptance tests; new
   §Observability property `modeStrictRejectedCount`.

3. **Tally `YYYYMMDD` raw 8-digit dates** — added Resolved Decision #28;
   Tally parser adapter pre-formats `/^\d{8}$/` → `YYYY-MM-DD` before
   invoking shared date-util. §8 Tally mapping rules updated. §11 +
   §Edge Cases + §Risks rows added. Tally fixture must include ≥1 raw
   8-digit date.

4. **Busy XLSX Excel-serial date handling** — added Resolved Decision
   #29; `xlsx.utils.sheet_to_json` invoked with `{ cellDates: true,
   dateNF: 'yyyy-mm-dd' }`. §8 Busy section + File Plan #13 + §11 +
   §Edge Cases + §Risks updated. Busy fixture must include ≥3 raw
   Excel-serial date cells.

### Gaps declined

None. All MUST_SHIP + SHOULD_SHIP gaps addressed.

### Net file-count delta

No new files; all changes fold into existing rows. Line estimates on
`payment-mode-map.constants.ts` (+10), `payment-normalizer.ts` (+10),
`commit-payments.service.ts` (+5), `tally-xml.parser.ts` (+10),
`busy-excel.parser.ts` (+5), `import-payments.test.ts` (unchanged at cap),
`PaymentRowCard.tsx` (+10), translations (+10 each), `ImportUploadPage.tsx`
(+10) — all still ≤ 250-line cap.
