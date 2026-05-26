**[10:42 AM]**

# SCOPE — Phase 7 #149 · Slice 7.1C — Invoices Import

> Tally XML + Vyapar CSV + Busy Excel + Generic CSV (with field mapping).
> **Sales Invoice entity** (`Document` model, `type='SALE_INVOICE'`).
> Reuses the 7.1A + 7.1B framework end-to-end (routes, schema tables,
> security envelope, audit pipeline, cleanup cron, FE wizard, commit
> dispatcher pattern). Behind `FEATURE_DATA_IMPORT` env flag, cohort=0 in
> MVP — same flag as 7.1A/B.

This document is **terse on purpose**. Anything not redefined here is
**unchanged from 7.1A and 7.1B**. `SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md`
remains SSOT for security envelope / idempotency / audit / cleanup /
DPDP / rate limits / mobile / offline. `SCOPE_PHASE7_IMPORT_7_1B_PRODUCTS.md`
is SSOT for the entity-aware FE wizard, the commit-dispatcher pattern,
the BigInt-paise pipeline (which 7.1C narrows to `Int paise` on the wire
because `Document.grandTotal` is `Int`, see §Money handling), and the
expand→backfill→contract migration discipline.

Pre-flight: read CLAUDE.md, OFFLINE_RULES, PRISMA_MIGRATION_RULES,
PLATFORM_SHELL, PAGE_AUDIT_CHECKLIST, prior 7.1A/B SCOPE + ARCH + SECURITY.
No matching `~/.claude/learnings/scope-writer-blindspots-*` files.

---

## Summary

Migrate a business's historical sales invoices from their previous billing
software into HisaabPro. Upload → parse (header + line aggregation) →
resolve party + product FKs → preview header-with-nested-lines → resolve
dedups → commit, with per-row staging so a bad import never half-creates
an invoice (header without lines, or wrong tax math posted to the books).

## Goals

- [MUST_SHIP] Support 4 source formats: Tally XML (`<VOUCHER VCHTYPE="Sales">`), Vyapar CSV sales export, Busy XLSX `SalesRegister` sheet, Generic CSV (flat one-row-per-line)
- [MUST_SHIP] Reuse `ImportJob`/`ImportJobRow` with `entity='invoice'` discriminator (no new tables)
- [MUST_SHIP] Multi-line aggregation: group source rows by `invoiceNumber + invoiceDate` into one `Document` header + N `DocumentLineItem` rows
- [MUST_SHIP] FK resolution — **Party** by `(businessId, name+phone)` case-insensitive; **Product** by `(businessId, sku)` exact then `(businessId, name)` case-insensitive — both within a single SQL roundtrip per file (see §FK Resolution)
- [MUST_SHIP] Party resolution policy = **MATCH_OR_FLY_CREATE** (default) with WARNING `PARTY_AUTO_CREATED`; alternative `REQUIRE_PARTIES_FIRST` mode rejects rows whose party isn't already in DB (selectable in upload step — see Resolved Decision #4)
- [MUST_SHIP] Product resolution is **strict**: `PRODUCT_NOT_FOUND` → ERROR. Never auto-create products from invoice import (accounting integrity — a wrong-SKU silent-create pollutes the catalog with phantom products)
- [MUST_SHIP] Tax math validation: `Σ(lineTotal) + Σ(cgst+sgst+igst+cess) ≈ reportedGrandTotal` within ±50 paise tolerance; mismatch → WARNING `TAX_MATH_MISMATCH` with computed-vs-reported diff (no auto-correct — preserves source-of-record fidelity)
- [MUST_SHIP] Date parsing: DD/MM/YYYY (Indian), DD-Mon-YYYY (Tally), DD-MM-YYYY, YYYY-MM-DD (Generic/ISO); reject ambiguous MM/DD/YYYY → ERROR `INVALID_DATE`. Unicode-digit normalization (NFKC + reject any non-ASCII digit) prevents DoS via mixed-script date strings (see §Security)
- [MUST_SHIP] Money in **Int paise** on the wire and at rest — `Document.grandTotal` and `DocumentLineItem.rate` are `Int` not BigInt. Reuse the **string-math** pipeline from 7.1B (`toPaiseBigInt` in `price.util.ts`) and then range-check against `2^31-1` (`Int` max) before insert; > range → ERROR `AMOUNT_OUT_OF_RANGE`
- [MUST_SHIP] Dedup: case-insensitive `(documentNumber + documentDate)` exact match against existing `Document` rows where `type='SALE_INVOICE'` AND `businessId=$1` → DUPLICATE_EXACT. **No NEAR-dedup** for invoices (numbers are deterministic — fuzzy matching = false positives that block legitimate re-numbering)
- [MUST_SHIP] Resolutions: SKIP | CREATE_NEW only. **OVERWRITE is NOT supported** (existing invoice mutation is an accounting event that needs full edit flow, not import)
- [MUST_SHIP] Chunked commit (200 invoices/tx — smaller than 7.1B's 500 because each invoice fans out to N+1 INSERTs); transaction shape `BEGIN; INSERT Document; INSERT DocumentLineItem[*]; UPDATE ImportJobRow; COMMIT;` per row. **No partial-commit allowed** — a row either lands fully (header + every line + audit) or rolls back. No StockMovement side effect in 7.1C (see Accepted Trade-offs #4)
- [MUST_SHIP] Idempotent commit via reused `commitToken` + `Idempotency-Key` model + per-row guard `WHERE status='STAGED' AND createdEntityId IS NULL` (continues 7.1B's contract on `ImportJobRow.createdEntityId`)
- [MUST_SHIP] Business-scoped tenancy via `req.activeBusiness.id` (unchanged)
- [MUST_SHIP] Security envelope reused as-is (see 7.1A §Security)
- [MUST_SHIP] Audit coverage: same 7 `import_job.*` action keys + `invoices.imported` per invoice (payload `{ documentId, importJobId, sourceIndex, documentNumber, partyId, grandTotal }`)
- [MUST_SHIP] FE wizard: add `Invoice` tile to entity picker; `InvoiceRowCard` with **nested line preview** (collapsed by default, tap to expand); commit CTA disabled when any row contains a line with `PRODUCT_NOT_FOUND`
- [MUST_SHIP] Fixture set: 4 formats × 5-invoice/12-line golden + reuse malicious fixtures from 7.1A
- [SHOULD_SHIP] Generic CSV mapping autodetect: header dictionary covers `invoice_number`, `invoice_date`, `party_name`, `party_phone`, `sku`, `item_name`, `qty`, `rate`, `gst_rate`, `line_total`, `total_amount`
- [SHOULD_SHIP] Per-row error CSV download (CSV-injection-safe util reused from 7.1A)
- [SHOULD_SHIP] Tally CGST/SGST/IGST ledger-name heuristic — match against business's existing TaxCategory rows by GST%; missing → recompute from `lineTotal × gstRate`
- [NICE_TO_HAVE] `REQUIRE_PARTIES_FIRST` mode persisted as per-business default
- [NICE_TO_HAVE] Show running totals (Σ subtotal, Σ tax, Σ grand) in preview header
- [FUTURE_EPIC] Purchase invoices, estimates, proforma, delivery challan → 7.1D
- [FUTURE_EPIC] Credit / debit notes → 7.1D
- [FUTURE_EPIC] E-invoice / e-way-bill auto-generation on import → 7.1G compliance slice
- [FUTURE_EPIC] Invoice PDF attachment import → 7.1F
- [FUTURE_EPIC] Payments import + payment-to-invoice allocation → 7.1D
- [FUTURE_EPIC] Recurring-invoice template import → 7.1F

## Personas + One-line Goal

| Persona | Volume | Goal |
|---------|--------|------|
| **Raju** (micro retailer) | Vyapar CSV, 50-200 invoices | Bring last FY's sales over with party names intact; tolerate auto-create for unknown walk-ins |
| **Priya** (wholesaler) | Busy XLSX, 500-2k invoices | Strict mode — parties must exist (imported via 7.1A first); preview tax-mismatch warnings before commit |
| **Amit** (distributor) | Tally XML, 2k-10k invoices | Async-polled import with line preview; dedup report by invoice number; bulk-delete escape hatch via `importJobId` |

## User Flow

Mirrors 7.1B. Only differences:

1. Settings → Data Import → "Import Invoices" tile (alongside Parties, Products)
2. Same format picker; entity selected by tile
3. Drag-drop file (≤10 MB, ≤10k **rows** — note: a 10k-row CSV may be only ~1500 invoices after aggregation)
4. **New upload-step toggle**: "Party resolution mode" radio — `MATCH_OR_FLY_CREATE` (default) | `REQUIRE_PARTIES_FIRST`
5. **Generic CSV only**: mapping wizard auto-detects invoice columns (see Resolved Decision #1)
6. Server creates `ImportJob (entity='invoice')`, runs reused XXE/zip-bomb pre-scans, then parses → aggregates lines → normalizes (sync ≤500 invoices, async-polled 500-2k)
7. Preview screen — same bucket structure; row card = `<InvoiceRowCard>` with collapsed-by-default line list (tap chevron to expand)
8. User drops bad rows / accepts duplicates as SKIP
9. **Commit-blocked sentinel**: if ANY remaining row has at least one line with `PRODUCT_NOT_FOUND`, commit CTA is disabled with copy `Fix N product-not-found errors first or drop those invoices`
10. Commit → chunks of **200 invoices/tx**; per-row tx as defined in §Idempotency
11. Summary screen → "View invoices" → `/invoices?importJobId=xxx` filter

### Error / cancel paths

All identical to 7.1A. New invoice-specific cases:

| Where | Behavior |
|-------|----------|
| Source row has line for SKU not in catalog | Line → ERROR `PRODUCT_NOT_FOUND`; row inherits ERROR; preview shows count of missing products + link to Import Products |
| Source has party name+phone not in DB AND mode=`REQUIRE_PARTIES_FIRST` | Row → ERROR `PARTY_NOT_FOUND`; preview shows count + link to Import Parties |
| Source has party name+phone not in DB AND mode=`MATCH_OR_FLY_CREATE` | Row → STAGED + WARNING `PARTY_AUTO_CREATED`; party will be created in same tx as the invoice |
| Source-claimed `grandTotal` differs from computed by >50 paise | Row → STAGED + WARNING `TAX_MATH_MISMATCH` with diff in chip |
| Source date in MM/DD/YYYY ambiguous (e.g. `03/05/2025`) | Row → ERROR `INVALID_DATE` (no silent guess) |
| Source date contains non-ASCII digit (e.g. devanagari numerals `१२/०५/२०२५`) | NFKC normalize → if folds to ASCII digits, accept; else → ERROR `INVALID_DATE` (anti-DoS) |
| Source invoiceNumber empty | ERROR `INVOICE_NUMBER_REQUIRED` |
| Source has duplicate `(invoiceNumber, invoiceDate)` rows intra-file | First → STAGED; rest → DUPLICATE_EXACT (intra-file) |
| Source invoice has zero lines after aggregation | ERROR `NO_LINES` |
| Computed line total `> 2^31-1` paise (~Rs 2.14 crore) | ERROR `AMOUNT_OUT_OF_RANGE` |

## Failure Mode Walkthrough

Inherits 7.1A scenarios 1-7 verbatim. **Invoice-specific additions**:

1. **Provider/dependency outage** — no external provider beyond Postgres + S3 (same as 7.1A/B). NEW: invoice commit fans out to `Document` + N `DocumentLineItem` rows; a Postgres connection storm during commit is bounded by the chunk-size cap of 200 invoices/tx (worst-case 200 × 50 lines = ~10k inserts/tx — still inside Prisma's transaction budget).
2. **Abuse spike** — rate limit envelope from 7.1A (5/hr, 20/day per business). Invoice imports MAY include party+product FK lookups that hit `Party.name` and `Product.sku` indexes — verified existing indexes cover the lookup pattern. No new ratelimit needed.
3. **Database bloat** — `ImportJobRow.raw`/`.normalized` NULLed by 7.1A cleanup cron 24h post-commit. `Document` + `DocumentLineItem` rows are permanent ledger; not purged. Cap: alert when single `importJobId` produces > 100k `DocumentLineItem` rows (impossible given 10k-row file cap × no line is its own row in source, but guards future limit raise).
4. **Client-version lag** — `clientVersion >= 7.1.0` enforced server-side; older clients → 426 `UPGRADE_REQUIRED`. FE polyfills the entity picker for `Invoice` on clients ≥ 7.1.2 only; older clients see Parties/Products only.
5. **Regulatory change (DPDP)** — invoice rows are **business-owned**, not data-principal-owned. DPDP cascade is a no-op for invoice rows. **HOWEVER**: a fly-created party from `MATCH_OR_FLY_CREATE` is data-principal-owned. The party row carries `importedBy=userId` + `importJobId`; DPDP erasure of uploader NULLs `ImportJob.fileName` and writes `data_principal.erased`, but does NOT delete the party (party FKs through to `Document` — `onDelete: Restrict`). This is explicit and documented to the user in the audit row's payload.
6. **Cost runaway** — same DB-CPU mitigation as 7.1A/B. Invoice commits are ~5x heavier per row than parties (header+lines+audit). Mitigation: 200-invoice chunk cap; metric `import_commit.duration_p99_ms{entity='invoice'}` with Sentry alert at >30s p99.
7. **Insider abuse** — every committed Document carries `createdBy=userId` + `importJobId`. Audit row `invoices.imported` is immutable with `documentId`, `documentNumber`, `partyId`, `grandTotal`. Bulk-delete-by-`importJobId` is the escape hatch — soft-delete only (`isDeleted=true`, `deletedBy=userId`) because `Document.onDelete: Restrict` blocks hard delete when `PaymentAllocation` rows reference the invoice. Cross-tenant leak prevented by every FK-resolution query including `WHERE businessId = $1` (integration test).

## Resolved Decisions

| # | Decision | Why | Industry exemplar |
|---|----------|-----|-------------------|
| 1 | Generic CSV header autodetect: invoice_number / invoice_date / party_name / party_phone / sku / item_name / qty / rate / gst_rate / line_total / total_amount | Predictable english names; users who export from Excel use these | Zoho Books CSV template |
| 2 | Multi-line aggregation key = `invoiceNumber + invoiceDate` (case-insensitive on number) | Both fields MUST appear on every source row; together they are deterministic within one file | Vyapar export shape |
| 3 | Tax math validation tolerance = ±50 paise | Source software's internal rounding (paise-half-up vs banker's) routinely produces ±0.5 paise drift per line; ±50 paise covers 100-line invoices | — |
| 4 | Party resolution = `MATCH_OR_FLY_CREATE` default, with `REQUIRE_PARTIES_FIRST` opt-in | Raju imports a year of invoices without first importing parties (real workflow); Priya prefers strict mode | Tally migration playbook |
| 5 | Fly-created parties ALWAYS get `importJobId` + `importedBy` so escape-hatch bulk-delete can identify them | Otherwise insider-abuse failure mode #7 has no cleanup path for the side-effect rows | — |
| 6 | Product resolution = strict, no auto-create | Auto-creating products from invoice line items has no source data for `unitId`, `taxCategoryId`, `salePrice` — would produce poisoned catalog | Tally policy |
| 7 | No OVERWRITE resolution | Mutating a posted invoice is an accounting event with audit, e-invoice, payment-allocation implications. Out of scope; user uses the edit flow | — |
| 8 | No NEAR-dedup for invoices | Invoice numbers are deterministic strings; trigram on `INV-2024-001` matches `INV-2024-002` which is wrong | — |
| 9 | Tax math kept as-imported, never auto-corrected | Source-of-record fidelity for audit / GST returns; a recompute that silently differs from the original paper invoice is a compliance risk | — |
| 10 | Money is `Int paise` on the wire (matches `Document.grandTotal Int`) — NOT BigInt | Schema fact; range cap is `2^31-1 ≈ Rs 2.14 crore` per Int column. Invoices > this need a separate compliance flow | Existing HP schema |
| 11 | Range guard via 7.1B `price.util.ts` then `if (paise > 2_147_483_647) throw AMOUNT_OUT_OF_RANGE` | Reuses the BigInt-string pipeline for safety, narrows to Int at boundary | — |
| 12 | Date parsing: NFKC normalize + reject non-ASCII digits | DoS surface: pathological Unicode (Arabic-Indic / fullwidth digits etc.) in date strings forces date-fns into expensive backtrack; ASCII-only rule terminates fast | OWASP input-validation guidance |
| 13 | Date parser is a hand-rolled state machine over a fixed set of 4 formats (DD/MM/YYYY, DD-Mon-YYYY, DD-MM-YYYY, YYYY-MM-DD) | date-fns multiparse is regex-heavy and has had ReDoS CVEs; hand-rolled bounded automaton is safer and faster | — |
| 14 | Chunk size = 200 invoices/tx (vs 500 for parties/products) | Each invoice fans out to N+1 INSERTs (header + lines + audit); 200 × ~7-line-avg = ~1400 row inserts/tx — safe under Prisma's tx timeout | Empirical |
| 15 | Per-row tx, not per-chunk-tx, for invoice commit | Smaller blast radius for mid-row crash; one bad invoice rolls back just itself, not 199 siblings. Trade: more tx overhead (acceptable at 200 invoices) | — |
| 16 | Commit-blocked sentinel on `PRODUCT_NOT_FOUND` lines | Allowing commit with "drop bad lines" silently posts an incomplete invoice to the books (legal document) — refuse | — |
| 17 | `documentNumber` dedup is case-insensitive | "INV-001" and "inv-001" are user-experienced as the same number; case-different is almost always a typo | — |
| 18 | `Document` is NOT given `importJobId` column (vs `Product.importJobId` in 7.1B) | Use the existing `notes` field? No — pollutes UX. Decision: ADD `Document.importJobId String?` column following 7.1B's pattern, identical migration discipline | Symmetric with 7.1B |
| 19 | FK resolution does single-roundtrip preload (`SELECT id, name, phone FROM Party WHERE businessId=$1 AND (name,phone) IN (...)`) then in-memory match | Per-row queries would N+1 with 10k lookups | DH bulk-import pattern |
| 20 | GST rate stored as **basis points** to match `DocumentLineItem.cgstRate Int` | Schema fact; "18%" → `1800` bp | Existing HP schema |
| 21 | Active-job rule stays per-business across ALL entities (parties OR products OR invoices = 1 active) | Already established in 7.1B; consistency | — |

## API Contract

**Unchanged from 7.1A** — same 5 routes, same error envelope, same
`commitToken` flow, same `Idempotency-Key` contract.

Diff for Invoices:

```ts
// POST /api/imports
interface CreateImportReq {
  entity: 'invoice'                              // CHANGED
  format: 'tally_xml' | 'vyapar_csv' | 'busy_xls' | 'generic_csv'
  file: File
  columnMapping?: Record<string, string>         // generic_csv only
  partyResolutionMode?: 'MATCH_OR_FLY_CREATE' | 'REQUIRE_PARTIES_FIRST'
                                                 // default MATCH_OR_FLY_CREATE
  clientVersion: string                          // must be >=7.1.2
}

// Row-level normalized shape
interface NormalizedInvoice {
  documentNumber: string         // required, non-empty after trim
  documentDate: string           // ISO-8601 YYYY-MM-DD after parse
  partyResolved: {
    partyId: string | null       // null when fly-create pending
    matchedBy: 'EXISTING' | 'FLY_CREATED'
    source: { name: string; phone: string | null }
  }
  subtotalPaise: number          // Int paise
  totalCgstPaise: number
  totalSgstPaise: number
  totalIgstPaise: number
  totalCessPaise: number
  grandTotalPaise: number
  taxMathDiffPaise: number       // computed - reported; surfaces in WARNING
  lines: Array<{
    productResolved: {
      productId: string | null
      matchedBy: 'BY_SKU' | 'BY_NAME' | 'NOT_FOUND'
      source: { sku: string | null; name: string }
    }
    quantity: number             // Float — matches schema
    ratePaise: number
    cgstRateBp: number           // basis points; 18% → 1800
    sgstRateBp: number
    igstRateBp: number
    cgstPaise: number
    sgstPaise: number
    igstPaise: number
    lineTotalPaise: number
  }>
}

// Issue codes added
type InvoiceIssueCode =
  | 'INVOICE_NUMBER_REQUIRED'
  | 'INVALID_DATE'
  | 'NO_LINES'
  | 'PARTY_NOT_FOUND'         // only in REQUIRE_PARTIES_FIRST mode
  | 'PARTY_AUTO_CREATED'      // warning, MATCH_OR_FLY_CREATE
  | 'PRODUCT_NOT_FOUND'       // ERROR, no auto-create
  | 'TAX_MATH_MISMATCH'       // warning, > 50 paise diff
  | 'AMOUNT_OUT_OF_RANGE'     // any paise total > 2_147_483_647
  | 'DUPLICATE_EXACT'         // existing (documentNumber, documentDate)
  | 'INTRA_FILE_DUPLICATE'    // duplicate within same file
```

All other 7.1A codes remain valid. `ProductIssueCode`/`PartyIssueCode`
unions are kept entity-distinct (no merging).

## Data Model

**No new tables.** Reuses `ImportJob`, `ImportJobRow`, and adds the
`importJobId`+`importedBy` addendum to `Document` (mirrors 7.1B's
`Product` addendum exactly).

### Schema preconditions

1. `ImportJob.entity` column already accepts arbitrary string (no enum); add `'invoice'` to runtime Zod union only.
2. `ImportJobRow.createdEntityId` shipped in 7.1B Migration A — reused.
3. `Document.documentNumber` is **nullable** (DRAFT invoices have null); the dedup query MUST filter `WHERE documentNumber IS NOT NULL` to avoid NULL=NULL nonsense.
4. `Document.@@unique([businessId, type, documentNumber])` already enforces no duplicates at DB level; our app-layer dedup is a soft preview that prevents the constraint violation surfacing as a 500.
5. `DocumentLineItem.productId` is FK `Restrict` — we MUST resolve every line's `productId` before INSERT.

### Schema diffs

**Document model addendum** (additive, nullable — symmetric with 7.1B's Product addendum):

- `importJobId String?` — FK ImportJob (`onDelete: SetNull`)
- `importedBy String?` — FK User (`onDelete: SetNull`)
- Index `(businessId, importJobId)` for cleanup / bulk-delete

No additional indexes on `DocumentLineItem` — the existing `(documentId)` cascade index suffices.

### Migrations (this slice)

One migration file, in transaction (no `CONCURRENTLY` needed — `Document.importJobId` is a sparse nullable column with a btree index, not GIN).

- **Migration A** — `prisma/migrations/<ts>_invoice_import_expand/migration.sql`. In a transaction.
  - `ALTER TABLE "Document" ADD COLUMN "importJobId" TEXT NULL`
  - `ALTER TABLE "Document" ADD COLUMN "importedBy" TEXT NULL`
  - `ALTER TABLE "Document" ADD CONSTRAINT "Document_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"(id) ON DELETE SET NULL`
  - `ALTER TABLE "Document" ADD CONSTRAINT "Document_importedBy_fkey" FOREIGN KEY ("importedBy") REFERENCES "User"(id) ON DELETE SET NULL`
  - `CREATE INDEX "Document_businessId_importJobId_idx" ON "Document" ("businessId", "importJobId")`
  - ~15 lines.

**No GIN trgm index** for invoices — there is no near-dedup query.

**Cleanup spec**: identical to 7.1A. Same cron, same retention windows. The `Document` + `DocumentLineItem` rows are permanent ledger and never purged; only `ImportJobRow.raw`/`.normalized` is nulled 24h post-commit.

## Idempotency

The commit path inserts 1 Document + N DocumentLineItem + (optionally) 1 fly-created Party + 1 UPDATE ImportJobRow + 1 audit row, all in **one tx per source invoice** (per-row tx, not per-chunk — see Resolved Decision #15).

Statement order inside each invoice's tx:

```
1. (if fly-create needed) INSERT Party (...) RETURNING id  →  newPartyId
2. INSERT Document (..., partyId, importJobId, importedBy) RETURNING id  →  docId
3. INSERT DocumentLineItem (...) × N
4. UPDATE ImportJobRow SET status='COMMITTED', createdEntityId=:docId
   WHERE id=:rowId AND status='STAGED' AND createdEntityId IS NULL
5. INSERT AuditLog (action='invoices.imported', payload=...)
```

If retry replays an already-committed row: step 4's WHERE fails to match (already COMMITTED) and step 4 returns `rowCount=0`. The retry pre-scans `ImportJobRow.status` for each chunk and **skips rows already `COMMITTED` before any INSERT runs** — same pattern as 7.1B `commit-products.service.ts` (documented as the entry point of `commit-invoices.service.ts`).

For mid-tx crash (e.g. connection drops between step 2 and step 3): Postgres rolls back the whole row — neither Document nor any lines persist. `ImportJobRow.status` stays `STAGED`. The retry is safe.

Three layers of idempotency (same as 7.1B):

1. `commitToken` (7.1A) — second commit with stale token → 409 `BAD_COMMIT_TOKEN`
2. `Idempotency-Key` (7.1A) — second commit with matching key returns cached prior response
3. Row-level guard `createdEntityId IS NULL` (7.1B) — rows already committed are skipped

**Integration test**: simulate mid-tx crash by killing the connection after step 2 (Document INSERT) but before step 3 (any lines) for invoice #50 of a 200-invoice chunk. Retry. Assert: exactly one Document #50 exists, exactly N DocumentLineItem rows for it, no orphaned half-invoice.

## FK Resolution

Two preloads run **once per chunk** of 200 invoices to avoid N+1:

```sql
-- Parties: build a (name, phone) set across all rows in the chunk
SELECT id, lower(name) AS lname, phone
FROM "Party"
WHERE businessId = $1
  AND deletedAt IS NULL
  AND (lower(name), COALESCE(phone, '')) = ANY($2::text[])

-- Products: build (sku, lower(name)) set across all lines in the chunk
SELECT id, sku, lower(name) AS lname
FROM "Product"
WHERE businessId = $1
  AND deletedAt IS NULL
  AND (sku = ANY($2::text[]) OR lower(name) = ANY($3::text[]))
```

Match precedence:
- **Party**: `(lower(name), phone)` exact pair → existing party. If phone missing on source, fall back to `lower(name)` alone — flag with WARNING `PARTY_NAME_ONLY_MATCH` (subset of `PARTY_AUTO_CREATED` issue category)
- **Product**: `sku` exact (case-sensitive — SKUs are codes) → `BY_SKU`. Else `lower(name)` exact → `BY_NAME`. Else `NOT_FOUND` → ERROR

**Tenant scoping mandatory**: both queries `WHERE businessId = $1`. Integration test asserts upload to business A surfaces zero products/parties from business B even when names overlap exactly.

**No trgm/fuzzy match in 7.1C** — exact only. Trigram resolution for invoices is `[NICE_TO_HAVE]`, deferred (false-positive risk on SKU codes is high).

## Date parsing

Hand-rolled state machine in `src/services/import/normalizers/date.util.ts`. Pipeline:

```
input  →  NFKC normalize  →  reject any non-ASCII digit  →  try formats in order
```

Format precedence (each format is tried as a strict match — no fallthrough on partial):

1. `YYYY-MM-DD` (ISO) — Generic CSV expected
2. `DD-Mon-YYYY` where Mon ∈ {Jan..Dec} — Tally expected (e.g. `15-Mar-2025`)
3. `DD/MM/YYYY` — Vyapar / Indian convention
4. `DD-MM-YYYY` — Busy convention

Ambiguous MM/DD/YYYY (e.g. `03/05/2025` could be 3-May or 5-Mar): rejected with ERROR `INVALID_DATE`. Indian convention is DD/MM — period.

Anti-DoS:

- NFKC normalize first; then if any char in the string is not in `[0-9 / \- A-Za-z]`, reject. This blocks Unicode bidi marks, RTL overrides, zero-width joiners, and astral-plane digits that would otherwise force the parser into expensive code paths.
- Hard cap on input length: 32 chars. Source dates beyond that are rejected as `INVALID_DATE` before any parsing.
- No regex backtracking — the state machine uses linear scanning with explicit char-class checks.

**8-case test suite** (in `tests/integration/import-invoices.test.ts`):

- `"2025-03-15"` → ISO OK
- `"15-Mar-2025"` → Tally OK
- `"15/03/2025"` → Indian OK
- `"15-03-2025"` → Busy OK
- `"03/05/2025"` → ERROR `INVALID_DATE` (ambiguous; could be 3-May or 5-Mar — reject)
- `"१५/०३/२०२५"` (devanagari digits) → NFKC folds to ASCII → OK
- `"‮15/03/2025"` (RTL override) → ERROR `INVALID_DATE` (non-ASCII char rejected)
- `"15/03/2025" + "A" × 100` (overlong) → ERROR `INVALID_DATE` (length cap)

## Multi-line aggregation

CSV exports flatten one source row per line. The aggregator groups consecutive source rows by `(lower(invoiceNumber), documentDate)` into one normalized invoice header.

Algorithm (in `src/services/import/normalizers/invoice-aggregator.ts`):

1. Read all source rows; build groups keyed by `(lower(trim(invoiceNumber)), normalizedDocumentDate)`
2. **Within a group**, the header fields (party_name, party_phone, subtotal, grandTotal, cgst, sgst, igst) are taken from the **first** row; subsequent rows' header fields are validated to match — if they differ, mark the group as ERROR `HEADER_MISMATCH_WITHIN_INVOICE`
3. Each row contributes one line: `(sku, item_name, qty, rate, gst_rate, line_total)`
4. Empty groups (zero lines) → ERROR `NO_LINES`

**4-case test suite**:

- 1 invoice × 3 lines flat → 1 group, 3 lines, OK
- 2 invoices interleaved (`INV1,line1; INV2,line1; INV1,line2`) → 2 groups, correctly split by key
- 1 invoice × 2 lines with different `party_name` across rows → ERROR `HEADER_MISMATCH_WITHIN_INVOICE`
- 1 invoice header row with no line data → ERROR `NO_LINES`

For Tally XML, aggregation is implicit (`<ALLINVENTORYENTRIES.LIST>` is already nested under one `<VOUCHER>`). No aggregation pass needed.

## Tax math validation

After normalization, for each invoice compute:

```
computedSubtotal   = Σ(line.lineTotalPaise)
computedCgst       = Σ(line.cgstPaise)
computedSgst       = Σ(line.sgstPaise)
computedIgst       = Σ(line.igstPaise)
computedGrandTotal = computedSubtotal + computedCgst + computedSgst + computedIgst + computedCess
```

If `|computedGrandTotal - reportedGrandTotal| > 50 paise` → WARNING `TAX_MATH_MISMATCH` with payload `{ computed, reported, diff }`. The invoice still commits using the **source-reported** totals (Resolved Decision #9).

If any computed value exceeds `2_147_483_647` → ERROR `AMOUNT_OUT_OF_RANGE` (column is `Int`, would overflow).

**7-case test suite**:

- Perfect math: subtotal 10000, cgst 900, sgst 900, grand 11800 → OK no warning
- 1 paise drift: grand 11801 → OK no warning (within tolerance)
- 50 paise drift: grand 11850 → OK no warning (at tolerance edge)
- 51 paise drift: grand 11851 → WARNING `TAX_MATH_MISMATCH`
- Negative diff (reported < computed): grand 11700 → WARNING
- IGST-only (interstate): cgst 0, sgst 0, igst 1800, grand 11800 → OK
- Overflow: subtotal 2_147_000_000, cgst 1_000_000 → grand exceeds Int → ERROR `AMOUNT_OUT_OF_RANGE`

## File Plan

Hard rule: every row ≤ 250 lines. Reuses **all** 7.1A/7.1B files where possible.

### Backend (`server/`)

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|------------|-------|-------|
| 1 | `prisma/schema.prisma` | edit | ~10 | schema | `Document.importJobId`+`importedBy`, index |
| 2 | `prisma/migrations/<ts>_invoice_import_expand/migration.sql` | create | ~15 | migration | Single in-tx migration; no CONCURRENTLY needed |
| 3 | `src/types/import.types.ts` | edit | ~50 | types | Add `NormalizedInvoice`, `InvoiceIssueCode`, broaden `entity` union to include `'invoice'` |
| 4 | `src/constants/import.constants.ts` | edit | ~25 | constants | TAX_MATH_TOLERANCE_PAISE=50, INVOICE_CHUNK=200, INT_PAISE_MAX=2147483647, DATE_INPUT_MAX_LEN=32, DATE_FORMATS array |
| 5 | `src/schemas/import.schemas.ts` | edit | ~25 | schema | Add invoice Zod branch + `partyResolutionMode` enum |
| 6 | `src/services/import/normalizers/date.util.ts` | create | ~140 | utils (pure) | NFKC + ASCII-only + length cap + hand-rolled state machine for 4 formats |
| 7 | `src/services/import/normalizers/invoice-aggregator.ts` | create | ~180 | service | Group by `(invoiceNumber, date)`; header-mismatch detection; line collection |
| 8 | `src/services/import/normalizers/invoice-normalizer.ts` | create | ~220 | service | Per-invoice normalize: dates, money (string→Int paise via 7.1B `price.util.ts` then range-check), tax-math validate, party+product FK lookup integration |
| 9 | `src/services/import/normalizers/tax-math.util.ts` | create | ~80 | utils (pure) | Compute Σ totals, compare to reported, emit diff or `AMOUNT_OUT_OF_RANGE` |
| 10 | `src/services/import/resolvers/party-resolver.ts` | create | ~150 | service | Chunk-preload Party rows by (lower(name), phone); match precedence; `MATCH_OR_FLY_CREATE` vs `REQUIRE_PARTIES_FIRST` policy |
| 11 | `src/services/import/resolvers/product-resolver.ts` | create | ~120 | service | Chunk-preload Product rows by SKU + lower(name); strict no-auto-create |
| 12 | `src/services/import/parsers/tally-xml.parser.ts` | edit | ~80 | service | Add `<VOUCHER VCHTYPE="Sales">` branch with ALLINVENTORYENTRIES + LEDGERENTRIES tax-ledger heuristic |
| 13 | `src/services/import/parsers/vyapar-csv.parser.ts` | edit | ~60 | service | Invoice column dictionary + multi-line flat shape |
| 14 | `src/services/import/parsers/busy-excel.parser.ts` | edit | ~70 | service | `SalesRegister` sheet branch |
| 15 | `src/services/import/parsers/generic-csv.parser.ts` | edit | ~40 | service | Invoice header autodetect vocabulary |
| 16 | `src/services/import/dedup/invoice-exact-dedup.ts` | create | ~120 | service | `(lower(documentNumber), documentDate, businessId)` exact match against existing `Document` where `type='SALE_INVOICE'` AND `documentNumber IS NOT NULL` |
| 17 | `src/services/import/commit-invoices.service.ts` | create | ~240 | service | Per-invoice tx: fly-create-party → INSERT Document → INSERT lines × N → UPDATE ImportJobRow → audit. Pre-scan COMMITTED on retry. 200/chunk |
| 18 | `src/services/import/commit-dispatcher.ts` | edit | ~30 | service | Add `'invoice'` branch dispatching to `commit-invoices.service.ts` |
| 19 | `src/services/import/audit.ts` | edit | ~15 | service | Add `invoices.imported` action key |
| 20 | `src/routes/imports/create.route.ts` | edit | ~25 | route | Accept `entity='invoice'` + `partyResolutionMode` in Zod |
| 21 | `src/routes/imports/get.route.ts` | edit | ~15 | route | Return invoice-shape polymorphic by entity (nested lines) |
| 22 | `scripts/enforce-audit-coverage.mjs` | edit | ~5 | script | Add `invoices.imported` to expected keys |
| 23 | `tests/fixtures/import/invoices/tally-sample.xml` | create | n/a | fixture | 5-invoice × 12-line golden |
| 24 | `tests/fixtures/import/invoices/vyapar-sample.csv` | create | n/a | fixture | 5-invoice × 12-line flat |
| 25 | `tests/fixtures/import/invoices/busy-sample.xlsx` | create | n/a | fixture | 5-invoice in SalesRegister sheet |
| 26 | `tests/fixtures/import/invoices/generic-sample.csv` | create | n/a | fixture | 5-invoice incl. tax-mismatch row + devanagari-date row + unknown-SKU row |
| 27 | `tests/integration/import-invoices.test.ts` | create | ~250 | test | happy × 4 formats + 8-date suite + 7-tax-math suite + 4-aggregation suite + FK-resolution suite (party-exists/fly/strict/product-found/product-NF) + 50-invoice commit happy + mid-tx crash recovery + cross-tenant isolation + double-commit idempotent + audit-key + commit-blocked-on-PRODUCT_NOT_FOUND |

**Reused as-is from 7.1A/B (no edits)**: xxe-prescan, zip-bomb-prescan, csv-injection util, import-job.service core, all middleware, cleanup-cron, 7.1B `price.util.ts`, malicious fixtures, idempotency middleware, rate-limit middleware, `commit-parties.service.ts`, `commit-products.service.ts`.

### Frontend (`src/`)

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|------------|-------|-------|
| 28 | `src/features/import/import.types.ts` | edit | ~40 | types | `InvoiceIssueCode`, invoice preview shape with nested lines |
| 29 | `src/features/import/import.constants.ts` | edit | ~15 | constants | Invoice format labels, `partyResolutionMode` enum |
| 30 | `src/features/import/import.service.ts` | edit | ~25 | service | `entityType: 'import'`, `entityLabel: \`Invoices: \${fileName}\`` for invoice jobs; pass partyResolutionMode |
| 31 | `src/features/import/useColumnAutodetect.ts` | edit | ~50 | hook | Invoice header dictionary |
| 32 | `src/features/import/useCommitBlockSentinel.ts` | create | ~60 | hook | Returns `{ blocked, productNotFoundCount, reason }` — gates commit CTA |
| 33 | `src/features/import/pages/ImportLandingPage.tsx` | edit | ~30 | page | Add "Import Invoices" tile |
| 34 | `src/features/import/pages/ImportUploadPage.tsx` | edit | ~50 | page | Add party-resolution-mode radio (invoice only); title varies |
| 35 | `src/features/import/pages/ImportMappingPage.tsx` | edit | ~30 | page | Invoice column targets |
| 36 | `src/features/import/pages/ImportPreviewPage.tsx` | edit | ~60 | page | Render InvoiceRowCard; show commit-blocked banner when sentinel fires |
| 37 | `src/features/import/components/InvoiceRowCard.tsx` | create | ~180 | sub-component | Header summary + collapsible line list; PRODUCT_NOT_FOUND red chip per line; TAX_MATH_MISMATCH warning chip |
| 38 | `src/features/import/components/InvoiceLinePreview.tsx` | create | ~120 | sub-component | Single line row: SKU, name, qty, rate, lineTotal, GST chips |
| 39 | `src/features/import/components/PartyResolutionToggle.tsx` | create | ~80 | sub-component | Radio with helper text and "Why?" inline tooltip |
| 40 | `src/features/import/components/ColumnMapper.tsx` | edit | ~25 | sub-component | Entity-aware target columns for invoices |
| 41 | `src/lib/translations.en.ts` | edit | ~70 | constants | `import.invoice.*` keys |
| 42 | `src/lib/translations.hi.ts` | edit | ~70 | constants | hi-IN |

Total **new+edited**: ~42 files; every estimate ≤ 250 lines. Largest new file: `import-invoices.test.ts` at ~250L (at cap). `commit-invoices.service.ts` at ~240L (within cap). `invoice-normalizer.ts` at ~220L (within cap).

## UI States

Same five wizard pages as 7.1A/B. Differences for invoice flow:

### `ImportLandingPage`
- Now shows **three tiles**: Parties, Products, Invoices

### `ImportUploadPage`
- Title varies. **NEW**: party-resolution-mode radio (invoice entity only)
- Helper text on `REQUIRE_PARTIES_FIRST`: `Reject rows whose customer isn't already in Parties. Use this if you've imported Parties first.`
- Helper text on `MATCH_OR_FLY_CREATE` (default): `Create missing customers automatically as part of this import.`

### `ImportMappingPage`
- Target columns: Invoice #, Date, Party Name, Party Phone, SKU, Item Name, Qty, Rate, GST %, Line Total, Grand Total

### `ImportPreviewPage`
- Row card = `<InvoiceRowCard>` with collapsed line list (tap chevron to expand)
- Per-line chip set: SKU · qty · rate · `PRODUCT_NOT_FOUND` red chip when applicable
- Per-invoice warning chips: `TAX_MATH_MISMATCH` (yellow with diff), `PARTY_AUTO_CREATED` (yellow), `DUPLICATE_EXACT` (gray)
- **Commit-blocked banner** (sticky top of preview): `N invoices have product-not-found errors. Fix or drop those invoices to continue.` with deep-link to Import Products
- Loading: existing `<ListSkeleton>` with invoice-shape skeleton variant
- Error: existing `<ErrorState onRetry />`
- Empty: existing `<EmptyState />`
- Success: data render with InvoiceRowCard rows

### `ImportDedupReviewPage`
- Side-by-side compares: invoiceNumber · documentDate · grandTotal · party · line count
- Resolutions = SKIP | CREATE_NEW only (no OVERWRITE radio)

### `ImportSummaryPage`
- Success copy: `Imported N invoices` + `View invoices` → `/invoices?importJobId=xxx`
- If `M` parties were fly-created: secondary line `Also created M new customers`

Autocomplete: file `accept=".xml,.csv,.xls,.xlsx"`; mapping inputs `autocomplete="off"`; party-resolution radio has no autocomplete.

## Mobile

Unchanged from 7.1A/B §Mobile. Same 375/320 budgets. **NEW**: `<InvoiceRowCard>` collapsed-by-default to keep row height ≤ 96px at 320px; expanding shows lines in a vertically-stacked list (no horizontal table — 320px can't fit invoice line columns side-by-side). Tap target on chevron ≥ 44px.

Capacitor file-picker fallback: same as 7.1A.

## UX Copy

Diff only — all other strings inherited.

| Element | Copy |
|---------|------|
| Tile title | `Import Invoices` |
| Format picker title (invoice) | `Where are your sales invoices today?` |
| Party-mode radio label | `How to handle missing customers` |
| Party-mode option A | `Create missing customers automatically (recommended)` |
| Party-mode option B | `Reject invoices whose customer isn't in HisaabPro yet` |
| Commit primary CTA | `Import N invoices` |
| Commit primary CTA (blocked) | `Fix N product errors first` (button disabled) |
| Commit confirm title | `Import N invoices?` |
| Commit confirm body | `This adds N sales invoices to your books. M new customers will be created. This action is logged in your audit trail.` |
| Commit success toast | `Imported N invoices` |
| Tax-mismatch chip | `Tax math off by Rs X.XX — kept as imported` |
| Product-not-found chip (line) | `SKU '<sku>' not found — import products first` |
| Party-auto-created chip | `New customer: <name>` |
| Invalid-date row error | `Date '<source>' is unclear — use DD/MM/YYYY` |
| Amount out of range | `Total too large — split into smaller invoices` |
| Commit-blocked banner | `N invoices have product-not-found errors. Fix or drop those invoices to continue.` |
| Empty (no invoices yet) | `No imports yet. Bring your sales invoices over from Tally, Vyapar, or Busy in under 15 minutes.` |
| Re-upload warning | `Someone imported an invoice file like this 3 days ago (N rows). Import it again?` |

## Edge Cases

Inherits 7.1A/B. New invoice-specific cases:

| Scenario | Handling |
|----------|----------|
| Tally `<VOUCHER>` with `VCHTYPE != "Sales"` (e.g. Receipt) | Skipped silently (not in scope) — counted in `skippedNonSales` metric |
| Tally `<VOUCHER>` with no `<ALLINVENTORYENTRIES.LIST>` (service invoice) | ERROR `NO_LINES` |
| Tally CGST/SGST ledger entries missing | WARNING `TAX_MATH_MISMATCH` after recompute attempt |
| Vyapar CSV with `Gst %` column blank | Treated as 0%; tax math computed accordingly |
| Busy SalesRegister with merged-cell header row | Parser skips first row if no data; merged cells flattened by xlsx lib |
| Generic CSV `invoice_date = ""` empty | ERROR `INVALID_DATE` |
| Generic CSV `rate` column in rupees (decimal) | Same string→paise pipeline as 7.1B; range-checked against Int max |
| Source invoice with `grandTotal = 0` | OK — common for sample invoices; STAGED |
| Source invoice with negative `lineTotal` | ERROR `AMOUNT_OUT_OF_RANGE` (Int but business rule: invoice line totals are non-negative; use credit-note flow for negatives — out of scope) |
| Two source files imported back-to-back with overlapping invoice numbers | Second file's overlapping rows → DUPLICATE_EXACT against rows committed in first import |
| Party fly-created during commit then user erases via DPDP | Party row stays (FK Restrict from Document); audit log notes the restriction |
| `documentNumber` with trailing whitespace `"INV-001 "` | Trim before dedup; preserved as-trimmed |
| Same invoice in source matches existing Document (number+date) | DUPLICATE_EXACT; resolution = SKIP only (no OVERWRITE) |
| Commit retry after mid-tx crash | Per-row guard `createdEntityId IS NULL` + Postgres tx rollback semantics → exactly one Document + N lines, no orphans |
| Cross-tenant FK-resolution leak attempt | Both party + product preloads have `WHERE businessId = $1`; integration test asserts business B's parties/products invisible to business A |

## Security

Inherits 7.1A §Security **verbatim**. Same auth/role gates, same rate limits (per-business 5/hr, 20/day uploads; 1 active job per business across all entities), same lockout (3 failed parses in 10 min per `(businessId, userId)` → 1h cooldown), same XXE/zip-bomb/CSV-injection envelope, same idempotency contract.

### NEW MUST_FIX surface (security audit will verify)

1. **Date-parsing DoS (Unicode digit attacks)** — addressed by NFKC normalize + ASCII-only digit check + 32-char length cap + hand-rolled state machine (no regex backtracking). See §Date parsing.
2. **Int paise overflow on tax calc** — `tax-math.util.ts` performs Σ in JS Number arithmetic; before insert, every paise value range-checked against `2_147_483_647`. > range → ERROR. Test: subtotal `2_147_000_000` + cgst `1_000_000` → `AMOUNT_OUT_OF_RANGE`.
3. **Fly-created party bypassing party validation rules** — `party-resolver.ts` creates parties through the **canonical Party creation service** (`createParty()` in `src/services/party.service.ts`), NOT a raw `prisma.party.create()`. This routes through the same Zod validation, name+phone normalization, duplicate-phone guard, and audit row that interactive party creation uses. Integration test: fly-create with malformed phone → same error as direct API would produce. Fly-create with phone duplicate of existing party → matches existing party instead of creating (idempotent name+phone match).

### Audit row additions

- `invoices.imported` per invoice, payload `{ documentId, importJobId, sourceIndex, documentNumber, partyId, grandTotalPaise }`
- The 7 `import_job.*` action keys reused unchanged
- `enforce-audit-coverage.mjs --block` updated to expect `invoices.imported`

### Cross-tenant isolation

- Both FK-resolution preloads include `WHERE businessId = $1` (explicit param, never inferred)
- Dedup query `WHERE businessId = $1 AND type='SALE_INVOICE' AND documentNumber IS NOT NULL`
- Integration test asserts business B's invoices/parties/products invisible to business A across all three query paths

### No new PII surface

- Invoices contain party name + phone (PII) but these are sourced from already-PII-bearing Party rows; no new principal data
- DPDP cascade rules for Party rows (7.1A) apply — uploader erasure NULLs `ImportJob.fileName`; party rows referenced by Documents stay (FK Restrict)

## Observability

Same 7 analytics events as 7.1A — `entity: 'invoice'` added to the existing union. New properties on commit event: `flyCreatedPartyCount`, `linesTotal`, `taxMismatchCount`.

Sentry alerts unchanged. Metrics gain values for `entity='invoice'` on the existing series. New label `partyResolutionMode` on commit-duration metric.

Cost alert: `Document` + `DocumentLineItem` row insert rate per business per day — alert if > 50k lines/day (well above any legit import).

## Test Infrastructure

- 4 new fixtures at `tests/fixtures/import/invoices/` (one per format, 5 invoices × ~12 lines each)
- Reuses malicious-billion-laughs.xml and malicious-zip-bomb.xlsx from 7.1A
- Generic fixture includes one row with tax mismatch, one row with devanagari date, one row with unknown SKU, one row with header-mismatch-across-lines
- New integration test `tests/integration/import-invoices.test.ts` covers:
  - Each fixture × 4 formats → bucket counts
  - Commit → Document rows + DocumentLineItem rows + audit `invoices.imported` × N
  - 50-invoice commit happy path → all rows COMMITTED in one polled async batch
  - Date parsing 8-case suite (see §Date parsing)
  - Tax math 7-case suite (see §Tax math validation)
  - Multi-line aggregation 4-case suite (see §Multi-line aggregation)
  - FK resolution: party-exists / party-fly-create / party-strict-mode-error / product-by-SKU / product-by-name / product-not-found
  - **Mid-tx crash recovery** — kill conn after Document INSERT but before any DocumentLineItem; retry; assert exactly one Document + N lines, no orphans
  - **Cross-tenant FK isolation** — seed business A and B with overlapping party-name + SKU; upload to A; assert zero B-references resolved
  - **Commit-blocked sentinel** — file with one PRODUCT_NOT_FOUND line; commit endpoint returns 409 `COMMIT_BLOCKED` with `{ productNotFoundCount }`
  - Double-commit (same Idempotency-Key + commitToken) → identical response, no duplicate Documents
  - Concurrent upload of invoices while products job is PREVIEWED for same business → 409 `ACTIVE_JOB_EXISTS`
  - Cross-business 404
  - `invoices.imported` audit row per invoice with `grandTotalPaise` payload
  - DPDP erasure → uploader's `ImportJob.fileName` NULLed; fly-created Party rows survive (FK Restrict), with audit note
  - Fly-create through canonical service (not raw prisma.party.create) — verified by asserting the duplicate-phone guard fires when fly-create would collide with existing party
- CI sets `FEATURE_DATA_IMPORT=true` for test business

## Accepted Trade-offs

- **Reuse `ImportJob.entity` discriminator** (already exists) — no new tables, no new routes
- **No StockMovement creation on invoice import** — historical invoices represent already-happened transactions; their stock impact is already in current inventory (whether tracked or not). Posting OPENING_BALANCE movements for imported invoice lines would **double-count** stock against opening stock imported in 7.1B. User imports Products (with opening stock) THEN imports Invoices; no movement is auto-posted. `[FUTURE_EPIC]` to add a "post stock movements" toggle in 7.1F if requested
- **No payment-allocation creation** — invoices import with `paidAmount=0`, `balanceDue=grandTotal`. Payment-allocation import is 7.1D
- **No e-invoice / e-way-bill auto-generation** — these are GST compliance flows that produce IRNs and require gov-portal API calls; out of scope. `EInvoice` and `EWayBill` reverse-relations stay null on imported documents
- **No invoice numbering sequence consumption** — imported invoices use the source-system's `documentNumber` verbatim; `DocumentNumberSeries` is **not advanced** (would break user's running sequence). New invoices created via the regular flow continue from where the sequence was, not from the imported max
- **Per-row tx, not per-chunk tx** — smaller blast radius for bad rows; ~2-3x tx overhead acceptable at 200 invoices/chunk
- **No NEAR-dedup** — invoice numbers are deterministic; fuzzy match risk > recovery value
- **Source-reported totals stored as-is** — even when tax math mismatches the recompute, the imported value is what lands in the books. Audit fidelity > computational "correctness"
- **`Document` is `Int paise` not `BigInt`** — schema fact; max invoice = Rs 2.14 crore. Larger invoices need a separate schema migration to widen the Document columns to BigInt — out of scope for 7.1C
- **Commit dispatcher gets a new branch** — `commit-dispatcher.ts` already has `parties` and `product` branches from 7.1B. Adding `invoice` is one new case; dispatcher stays thin (≤ 50 lines total after edit)
- **`commit-invoices.service.ts` is a new file** (~240L) — not a split. The dispatcher pattern keeps each entity's commit logic in its own file ≤ 250L

## Resolved Decisions (continued)

| # | Decision | Why |
|---|----------|-----|
| 22 | No StockMovement side effect on invoice import | Prevents double-counting against 7.1B opening stock |
| 23 | No payment-allocation side effect | Payments import is 7.1D |
| 24 | No DocumentNumberSeries advancement on import | Preserves user's running invoice number sequence |
| 25 | Fly-create routes through `createParty()` canonical service | Same validation + audit path as interactive creation; prevents bypass |
| 26 | Invoice import does NOT create EInvoice/EWayBill records | Out of scope; future compliance epic |
| 27 | `MATCH_OR_FLY_CREATE` is default mode (vs `REQUIRE_PARTIES_FIRST`) | Raju persona; most users skip importing parties first |
| 28 | Empty invoice numbers ERROR (vs auto-assign next sequence number) | Source-of-record fidelity; auto-assignment is silent data fabrication |
| 29 | Commit blocked when any line has `PRODUCT_NOT_FOUND` | "Drop bad lines" silently posts an incomplete legal document |
| 30 | Chunk size 200 (not 500 as 7.1B parties) | 200 × ~7-line avg = ~1400 inserts; safe under tx timeout |

## Out of Scope

- [FUTURE_EPIC] Purchase invoices, estimates, proforma, delivery challan — 7.1D
- [FUTURE_EPIC] Credit / debit notes — 7.1D
- [FUTURE_EPIC] Payments + payment-to-invoice allocations — 7.1D
- [FUTURE_EPIC] E-invoice / e-way-bill generation on import — 7.1G (GST compliance)
- [FUTURE_EPIC] Invoice PDF attachments — 7.1F
- [FUTURE_EPIC] Recurring-invoice template import — 7.1F
- [FUTURE_EPIC] StockMovement posting for invoice lines — 7.1F (optional toggle)
- [FUTURE_EPIC] DocumentNumberSeries reconciliation post-import — 7.1F
- [FUTURE_EPIC] Multi-currency invoice import — 7.1F (currently INR-only assumption)
- [FUTURE_EPIC] B2C-Large / Export / SEZ supply-type handling — 7.1G
- [FUTURE_EPIC] TDS/TCS column import — 7.1G
- [FUTURE_EPIC] Composite-scheme tax handling — 7.1G
- [FUTURE_EPIC] Resumable / chunked uploads (>10k rows) — 7.1E
- [FUTURE_EPIC] Background-worker offload (>2k invoices real worker) — 7.1E
- [FUTURE_EPIC] Fuzzy/near dedup for invoice numbers — judged not valuable
- [FUTURE_EPIC] OVERWRITE resolution for existing invoices — judged unsafe
- [FUTURE_EPIC] Auto-recompute and write-corrected-totals — judged unsafe (audit fidelity)
- [FUTURE_EPIC] Decimal money widening on Document columns (`Int` → `BigInt`) — cross-cutting

## Cross-feature Impact

- **Document model**: gains `importJobId String?` + `importedBy String?`. One additive migration. Symmetric with 7.1B Product addendum
- **Invoices list filter**: `?importJobId=xxx` added to `GET /api/documents` (or wherever invoice list lives) — mirrors 7.1A parties, 7.1B products
- **Audit log**: new action key `invoices.imported`; 7 `import_job.*` keys reused
- **Party creation**: fly-create goes through canonical `createParty()` — already-existing service code, no edit
- **Feature flag**: same `FEATURE_DATA_IMPORT` flag. No separate flag
- **Commit dispatcher** (7.1B): one new branch `case 'invoice':` returns `commit-invoices.service.ts`
- **FE wizard** (7.1B entity-aware): one new `EntityPicker` option, one new RowCard family, one new resolution-mode toggle
- **No change to existing 7.1A parties code path** — unlike 7.1B (which dual-wrote `createdPartyId`), 7.1C doesn't touch anything in 7.1A's commit
- **No change to existing 7.1B products code path** — 7.1C reads `Product.businessId+SKU+name` for resolution only

## Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | Date parsing DoS via Unicode | High | NFKC + ASCII-only + length cap + hand-rolled state machine (no regex backtracking); 8-case test suite |
| 2 | Int paise overflow on big invoices | Medium | Range-check before insert; ERROR `AMOUNT_OUT_OF_RANGE`; user splits into smaller invoices |
| 3 | Fly-create bypassing party validation | High | Route through canonical `createParty()`; integration test asserts duplicate-phone guard fires |
| 4 | Mid-tx crash leaving orphan Document | High | Per-row tx with Postgres rollback semantics; `ImportJobRow.createdEntityId IS NULL` guard on retry; integration test |
| 5 | Cross-tenant FK leak (resolve B's party for A's invoice) | High | All FK preloads `WHERE businessId = $1`; integration test |
| 6 | Commit dispatcher grows past 250L after 3rd entity branch | Low | Dispatcher is a switch — currently ~50L after 3 branches |
| 7 | Tax math recompute disagrees with source — user confusion | Medium | Show diff in chip; commit imported-as-reported; never auto-correct |
| 8 | Source has both `MATCH_OR_FLY_CREATE` and a phone that legitimately belongs to two different parties in DB | Low | Match takes (lower(name), phone) **pair** — both must equal; reduces collision space. If still collides → first hit wins (deterministic by Party.id ASC); WARNING surfaced for manual review post-commit |
| 9 | Commit-blocked sentinel false positive (e.g. one line out of 100 invoices missing SKU) blocks entire commit | Medium | Sentinel is per-invoice, not per-file; user drops the 1 bad invoice and rest commits |
| 10 | DocumentNumberSeries skew (imported numbers higher than current sequence value) | Medium | Documented as Accepted Trade-off; user manually bumps series in Settings → Invoice Numbering if desired. `[FUTURE_EPIC]` to auto-reconcile in 7.1F |

## Acceptance Criteria

- [ ] `FEATURE_DATA_IMPORT=true` + admin → upload invoice Tally fixture → `POST /api/imports` with `entity='invoice'` returns 200 `{ jobId, status: 'PREVIEWED', commitToken, counts: { staged: ≥1 } }`
- [ ] Upload each of 4 invoice fixtures → `staged ≥ 1`, all buckets populated
- [ ] Generic CSV without mapping → 400 `MAPPING_REQUIRED`
- [ ] Generic CSV with auto-detected mapping → 200; preview shows invoice number, date, party, line count per row
- [ ] Row with unknown SKU → ERROR `PRODUCT_NOT_FOUND`; FE shows red chip on the line; commit CTA blocked with banner
- [ ] Row with unknown party in `REQUIRE_PARTIES_FIRST` mode → ERROR `PARTY_NOT_FOUND`
- [ ] Row with unknown party in `MATCH_OR_FLY_CREATE` mode (default) → STAGED + WARNING `PARTY_AUTO_CREATED`
- [ ] Row with ambiguous date `03/05/2025` → ERROR `INVALID_DATE`
- [ ] Row with devanagari date `१५/०३/२०२५` → STAGED OK (folds to 15/03/2025)
- [ ] Row with RTL override `‮15/03/2025` → ERROR `INVALID_DATE`
- [ ] Row with overlong date input (>32 chars) → ERROR `INVALID_DATE`
- [ ] Row with subtotal causing grand > Int max → ERROR `AMOUNT_OUT_OF_RANGE`
- [ ] Row with tax math off by 51 paise → STAGED + WARNING `TAX_MATH_MISMATCH`; commit stores source-reported values
- [ ] Row with tax math off by 50 paise or less → STAGED no warning
- [ ] Row with empty invoice number → ERROR `INVOICE_NUMBER_REQUIRED`
- [ ] Source file with same invoice in two rows (intra-file dup) → first STAGED, rest INTRA_FILE_DUPLICATE
- [ ] Source row whose `(documentNumber, documentDate)` exists in DB → DUPLICATE_EXACT; resolutions = SKIP only
- [ ] Multi-line aggregation: 3 source rows with same `invoiceNumber+date` → 1 normalized invoice with 3 lines
- [ ] Multi-line aggregation: 2 source rows with same key but different party_name → ERROR `HEADER_MISMATCH_WITHIN_INVOICE`
- [ ] Commit 50-invoice fixture → 50 Documents + sum(N) DocumentLineItems + 50 `invoices.imported` audit rows; every Document carries `importJobId`+`importedBy`
- [ ] Commit with rows containing `PRODUCT_NOT_FOUND` → 409 `COMMIT_BLOCKED` with `{ productNotFoundCount }`
- [ ] Mid-tx crash test → exactly one Document + N DocumentLineItems after retry; no orphans, no half-invoices
- [ ] Cross-tenant FK isolation test → upload to business A surfaces zero party-matches / product-matches from business B
- [ ] Double-POST commit (same Idempotency-Key + commitToken) → identical response, no duplicate Documents
- [ ] Commit with stale commitToken → 409 `BAD_COMMIT_TOKEN`
- [ ] Active invoice-import job blocks subsequent parties/products upload → 409 `ACTIVE_JOB_EXISTS`
- [ ] Cross-business `GET /api/imports/:id` → 404
- [ ] Without auth → 401; without active business → 400; non-admin → 403
- [ ] `clientVersion = "7.1.1"` → 426 `UPGRADE_REQUIRED` (invoice entity requires ≥ 7.1.2)
- [ ] Malicious XXE / zip-bomb fixtures rejected (reused from 7.1A)
- [ ] Re-upload same invoice file → `previouslyUploadedAt` populated, counts-only response
- [ ] Cleanup cron 25h post-commit → `ImportJobRow.raw` and `.normalized` NULL; Document + DocumentLineItem rows preserved
- [ ] DPDP erasure on uploader → `ImportJob.fileName` NULL; Document rows untouched; fly-created Party rows survive (FK Restrict)
- [ ] Fly-create through canonical `createParty()` — duplicate-phone guard fires when collision with existing party
- [ ] Error CSV download with `=HYPERLINK(...)` in party name → cell prefixed with `'`
- [ ] `enforce-audit-coverage.mjs --block` passes (now includes `invoices.imported`)
- [ ] Migration A applies cleanly on shadow DB; rollback path verified
- [ ] No raw `fetch()` in `src/features/import/**`
- [ ] All FE mutations pass `entityType: 'import'`, `entityLabel: 'Invoices: <fileName>'`, `excludeFromOfflineQueue: true`
- [ ] Toggle airplane-mode mid-upload → offline banner; no IDB-queued request
- [ ] All strings present in en + hi translations
- [ ] Screenshots: 4 states × ImportLandingPage (with Invoices tile), ImportUploadPage with party-mode radio, ImportPreviewPage with InvoiceRowCard (collapsed + expanded), ImportPreviewPage with commit-blocked banner, ImportSummaryPage with invoice copy
- [ ] 320px no overflow; 375px hp-design audit passes; InvoiceRowCard collapsed ≤ 96px tall at 320px
- [ ] `tsc clean`; `node scripts/enforce.js` clean; `node scripts/enforce-offline.mjs` clean; `node scripts/enforce-audit-coverage.mjs` clean

## QA Checklist

- [ ] curl POST /api/imports `entity=invoice` without auth → 401
- [ ] curl POST /api/imports `entity=invoice` non-admin → 403
- [ ] curl POST /api/imports each of 4 invoice fixtures → `staged ≥ 1`
- [ ] curl POST invoice fixture with unknown SKU → ERROR `PRODUCT_NOT_FOUND` line
- [ ] curl POST invoice fixture with unknown party + REQUIRE_PARTIES_FIRST → ERROR `PARTY_NOT_FOUND`
- [ ] curl POST invoice fixture with unknown party + default mode → WARNING `PARTY_AUTO_CREATED`
- [ ] curl POST invoice fixture with devanagari date → OK
- [ ] curl POST invoice fixture with ambiguous MM/DD/YYYY date → ERROR `INVALID_DATE`
- [ ] curl POST invoice fixture with tax-mismatch row → WARNING `TAX_MATH_MISMATCH`
- [ ] curl POST invoice fixture with Int-overflow amount → ERROR `AMOUNT_OUT_OF_RANGE`
- [ ] curl GET /api/imports/:id (invoice job) returns nested-line shape paginates rows
- [ ] curl POST /api/imports/:id/commit twice with same Idempotency-Key → identical response, no duplicate Documents
- [ ] curl POST commit with stale commitToken → 409 `BAD_COMMIT_TOKEN`
- [ ] curl POST commit while rows contain PRODUCT_NOT_FOUND → 409 `COMMIT_BLOCKED`
- [ ] DB check after commit: every Document has `importJobId` + `importedBy` populated; every line FK-correct
- [ ] DB check: `Document_businessId_importJobId_idx` exists
- [ ] DB check: cross-tenant query returns zero rows (manual psql)
- [ ] Bulk-delete-by-importJobId soft-deletes Documents (isDeleted=true); does NOT delete Party / Product rows
- [ ] tsc + enforce + enforce-offline + audit-coverage all clean
- [ ] Screenshots × invoice-specific pages × 4 states
- [ ] Dark-mode parity

## Revision Log

**2026-05-19 v1** — initial PRD for 7.1C Invoices import, written against 7.1A v2 + 7.1B v2 as baseline. No prior audit at time of writing.

**[10:42 AM]**
