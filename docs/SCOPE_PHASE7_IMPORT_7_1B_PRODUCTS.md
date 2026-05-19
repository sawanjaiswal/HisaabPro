**[10:14 AM]**

# SCOPE — Phase 7 #149 · Slice 7.1B — Products Import

> Tally XML + Vyapar CSV + Busy Excel + Generic CSV (with field mapping).
> **Products entity.** Reuses the 7.1A framework end-to-end (routes, schema
> tables, security envelope, audit pipeline, cleanup cron, FE pages).
> Behind `FEATURE_DATA_IMPORT` env flag, cohort=0 in MVP — same flag as 7.1A.

**v2 revision (2026-05-19)** — this revision closes the 8 MUST_SHIP gaps
flagged by `SCOPE_AUDIT_PHASE7_IMPORT_7_1B_PRODUCTS.md` (2026-05-19, BLOCK
verdict). Sections changed in v2 are tagged inline with `[v2]`. SHOULD_SHIP
gaps remain marked as `[SHOULD_SHIP]` and are not addressed in this revision
(see Revision Log for accept/defer decisions).

This document is **terse on purpose**. Anything not explicitly redefined
here is **unchanged from 7.1A** — `docs/SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md`
remains the SSOT for the security envelope, idempotency model, audit/
metrics contract, cleanup cron, DPDP cascade, rate limits, mobile rules,
and offline contract.

---

## Summary

Migrate a business's product catalog from their previous billing software
into HisaabPro in one self-serve flow. Upload → parse → preview → resolve
dedups → commit, with per-row staging so a bad import never corrupts the
product catalog (and never doubles `currentStock`).

## Goals

- [MUST_SHIP] Support 4 source formats: Tally XML (`<STOCKITEM>`), Vyapar CSV, Busy Excel (`ItemMaster` sheet), Generic CSV
- [MUST_SHIP] Reuse `ImportJob`/`ImportJobRow` with `entity='product'` discriminator (no new tables)
- [MUST_SHIP] Staged-row preview before commit; user drops/edits bad rows
- [MUST_SHIP] SKU-based + Name-based dedup; flag near-dupes (trigram ≥0.7, business-scoped) for review
- [MUST_SHIP] Chunked commit (500 rows/tx); commit creates initial `StockMovement` for opening stock inside the same tx, idempotently via `UNIQUE (importJobRowId)`
- [MUST_SHIP] Money in **paise** as BigInt — decimal-string→BigInt(paise) normalization with regex-pre-validated overflow guard (no `parseFloat` in the money path)
- [MUST_SHIP] `unitId` resolution: source unit string → `Unit` row in this business via NFKC-normalized, devanagari-aware alias map; missing unit → ERROR `UNIT_NOT_FOUND` with link to "Create unit"
- [MUST_SHIP] `taxCategoryId` resolution: GST % → existing `TaxCategory` row; missing → WARNING + fallback to business-default
- [MUST_SHIP] Stock guard: `openingStock` must be ≥0; negative → ERROR `INVALID_OPENING_STOCK` (HP `StockMovement.quantity` is `Decimal(18,3)` — see §schema-prereq)
- [MUST_SHIP] Idempotent commit via reused `commitToken` model (see 7.1A §API Contract — unchanged)
- [MUST_SHIP] Business-scoped tenancy via `req.activeBusiness.id` (unchanged from 7.1A)
- [MUST_SHIP] Security envelope reused as-is (see 7.1A §Security)
- [MUST_SHIP] Audit coverage: same 7 action keys + `products.imported` per product
- [MUST_SHIP] FE format-picker extended to also pick **entity** (Parties / Products) — single picker, both flows share the same wizard
- [MUST_SHIP] Reserved fixture files (4 formats × golden 5-row) + reused malicious fixtures
- [SHOULD_SHIP] Generic CSV column-mapping wizard with auto-detect heuristic — extend 7.1A wizard to recognise product headers (`name`, `sku`, `hsn`, `mrp`, `sale_price`, `purchase_price`, `gst_rate`, `unit`, `opening_stock`)
- [SHOULD_SHIP] Download per-row error CSV (CSV-injection-safe — reuses 7.1A util)
- [SHOULD_SHIP] Tally `<MRP>` captured but stored only if non-zero (Indian SKUs often omit MRP)
- [NICE_TO_HAVE] Auto-create `Unit` rows when missing instead of erroring (deferred — risk of unit-pollution)
- [NICE_TO_HAVE] Persist last-used Generic-CSV product mapping per business
- [FUTURE_EPIC] Product variants (size/colour matrix), image upload, barcode column import — all 7.1F
- [FUTURE_EPIC] Stock movement history import (opening stock only in this slice) — 7.1F
- [FUTURE_EPIC] Multi-godown opening-stock split — 7.1F
- [FUTURE_EPIC] Batch / serial-number import — 7.1F

## Personas + One-line Goal

| Persona | Volume | Goal |
|---------|--------|------|
| **Raju** (micro retailer) | Vyapar CSV, 50-300 SKUs | Bring his FMCG catalog over in <10 min with sale prices intact |
| **Priya** (wholesaler) | Busy Excel, 500-2k SKUs | Preview, drop discontinued items, keep HSN + GST mapping correct |
| **Amit** (distributor) | Tally XML, 2k-10k SKUs | Async polled import, dedup report by SKU, bulk-delete escape hatch via `importJobId` |

## User Flow

Mirrors 7.1A. Only differences called out:

1. Settings → Data Import → "Import Products" tile (alongside "Import Parties")
2. Same format picker; entity is selected by the tile clicked
3. Drag-drop file (≤10 MB, ≤10k rows — same caps)
4. **Generic CSV only**: mapping wizard auto-detects product columns (see Resolved Decisions #1)
5. Server creates `ImportJob (entity='product')`, runs reused XXE/zip-bomb pre-scans, then parses (sync ≤2k, async-polled 2k-10k)
6. Preview screen — same bucket structure; row card shows `name`, `sku`, `salePrice`, `openingStock`, `unit` (not phone/GSTIN)
7. User drops bad rows / accepts near-dupes
8. Commit → chunks of 500/tx with row-level guard
9. **NEW step inside same tx** [v2]: for each row with `openingStock > 0`, write a `StockMovement { type:'OPENING_BALANCE', quantity, productId, importJobId, importJobRowId }`. The `UNIQUE (importJobRowId)` constraint plus `ON CONFLICT DO NOTHING` makes the insert idempotent across mid-chunk retries (see §Idempotency).
10. Summary screen → link to Products list filtered by `?importJobId=xxx`

### Error / cancel paths

All identical to 7.1A. New product-specific cases:

| Where | Behavior |
|-------|----------|
| Unit string ("pcs", "kg", "ltr") doesn't match any `Unit` row | Row → ERROR `UNIT_NOT_FOUND`; preview shows "Create unit 'pcs'" inline action |
| GST % doesn't match any `TaxCategory` row | Row → WARNING `TAX_RATE_FALLBACK`; falls back to business-default TaxCategory |
| `salePrice` raw string fails regex `^\d{1,12}(\.\d{0,2})?$` OR BigInt(paise) > BigInt(Number.MAX_SAFE_INTEGER) | ERROR `PRICE_OUT_OF_RANGE` |
| `salePrice` has >2 decimal places (e.g. `"1.2345"`) | WARNING `PRICE_PRECISION_LOST` — rounded to 2dp before BigInt conversion |
| Negative opening stock | ERROR `INVALID_OPENING_STOCK` |
| Duplicate SKU within the same source file | First → STAGED; rest → DUPLICATE_EXACT (intra-file) |

## Failure Mode Walkthrough

Inherits 7.1A scenarios 1-7 verbatim. **Product-specific additions** to scenarios:

3. **Database bloat** — extends 7.1A cleanup spec. NEW: `StockMovement` rows created during commit are **NOT** purged by the import cleanup cron — they're permanent inventory ledger. Cleanup nulls `ImportJobRow.raw`/`.normalized` after 24h but leaves the `StockMovement` linkage by `importJobId` intact (for traceability).
5. **DPDP erasure** — products are business-owned, not data-principal-owned. DPDP cascade is a **no-op** for product imports (no PII in product rows). The audit row `data_principal.erased` is still written if the uploader requests erasure, with the same `ImportJob.fileName` NULLing.
6. **Cost runaway** — same DB-CPU mitigation. Additional risk: commit creates 1 `StockMovement` per product with opening stock; 10k products = 10k extra rows in `StockMovement` per import. Cap: alert when single `importJobId` produces >10k `StockMovement` rows (which can't happen given 10k-row file cap, but guards a future limit raise).
7. **Insider abuse** — every committed Product carries `importedBy=userId` + `importJobId` (same as Party). Audit row `products.imported` is immutable. Bulk-delete-by-`importJobId` is the escape hatch. **[v2]** Cross-tenant similarity leak prevented by composite `(businessId, name gin_trgm_ops)` GIN index — every dedup query MUST include `WHERE p.businessId = $1`; integration test asserts this.

## Resolved Decisions

| # | Decision | Why | Industry exemplar |
|---|----------|-----|-------------------|
| 1 | Generic CSV header auto-detect: name/sku/hsn/mrp/sale_price/purchase_price/gst_rate/unit/opening_stock | Predictable english names; users who export from Excel use these | Zoho Inventory CSV template |
| 2 | Unit string must match existing `Unit` row; no auto-create | Auto-creating "pc" + "pcs" + "piece" pollutes the unit list permanently | Manual unit setup is one-time work |
| 3 | GST % mismatched → WARNING + fallback to business-default | Common in MSME data; blocking would force a 200-row "create tax category" flow | — |
| 4 | Opening stock as `Decimal(18,3)` on StockMovement.quantity | Kg/ltr units need fractional stock; Decimal avoids float drift downstream | DH inventory pattern |
| 5 | Opening stock creates one `StockMovement` per product inside commit tx | Single source of truth for `currentStock` — never double-write the Product column AND the ledger | DH bulk-import pattern |
| 6 | SKU dedup wins over Name dedup when both fire | SKU is intended-unique; name collisions are common ("Pen Blue") | — |
| 7 | MRP captured but optional (zero ok) | Indian SKUs often omit MRP except for retail FMCG | — |
| 8 | Barcode column NOT imported in 7.1B | Defer to 7.1F — barcode format validation + dedup is its own design | — |
| 9 | Image columns NOT imported | Defer to 7.1F — needs upload pipeline | — |
| 10 | Reuse `ImportJob.entity` discriminator (`'product'`) | Existing column; no new tables; routes stay polymorphic | — |
| 11 | Same routes as 7.1A — entity-aware via `ImportJob.entity` | One import system, many entities | Stripe Bulk Action |
| 12 | Trigram threshold 0.7 (vs Levenshtein 2 for parties) | Product names vary more than party names ("Pen Blue Reynolds" vs "Reynolds Blue Pen") — trigram handles word-order | — |
| 13 | Active-job rule stays **per-business across entities**: 1 active job total (parties OR products) | Simpler mental model; commit-lock contention is per-business regardless of entity | — |
| 14 [v2] | Column rename `createdPartyId` → `createdEntityId` uses **expand→backfill→contract** across two migrations | Single-shot rename breaks 7.1A in-flight requests during partial deploy; expand pattern keeps both columns dual-written during the overlap window | Stripe schema-migration playbook |
| 15 [v2] | `ImportJob.createdPartyIds Json` column kept verbatim at DB level; Prisma model renames type-side via `@map("createdPartyIds")` to `createdEntityIds` | JSON column has no SQL-level consumer dependency; type-only rename costs zero migration risk. Entity is already inferable from `ImportJob.entity` | — |
| 16 [v2] | Money is BigInt(paise) end-to-end; regex pre-validates raw decimal string before any numeric conversion | `parseFloat` loses precision at >2^53; project rule "no floating point money" applies | Stripe Decimal API |
| 17 [v2] | Unit alias resolution: `NFKC → trim → lowercase → strip trailing dot → alias lookup`; precedence devanagari → latin → case-fold → whitespace-strip | Indian MSME data routinely mixes hindi/english scripts and casings; lossless folding avoids false negatives | Vyapar / Zoho Inventory |

## API Contract

**Unchanged from 7.1A** — same 5 routes (`POST /api/imports`, `GET /api/imports/:id`, `POST /api/imports/:id/commit`, `DELETE /api/imports/:id`, `GET /api/imports`), same error envelope, same `commitToken` flow, same Idempotency-Key contract. See 7.1A §API Contract.

Diff for Products:

```ts
// POST /api/imports
interface CreateImportReq {
  entity: 'product'                              // CHANGED — was 'parties' in 7.1A
  format: 'tally_xml' | 'vyapar_csv' | 'busy_xls' | 'generic_csv'
  file: File
  columnMapping?: Record<string, string>         // generic_csv keys differ — see normalization map below
  clientVersion: string                          // must be >=7.1.0 (unchanged)
}

// Row-level normalized shape (replaces NormalizedParty)
interface NormalizedProduct {
  name: string
  sku: string | null
  hsnCode: string | null
  salePrice: bigint          // paise, BigInt — [v2] no float
  purchasePrice: bigint | null
  mrp: bigint | null         // paise, BigInt
  unitId: string             // resolved to a real Unit row
  unitSourceText: string     // original "pcs" / "kg" string for audit
  taxCategoryId: string | null
  gstRateResolved: number | null  // % the user's source claimed
  openingStock: string       // Decimal-as-string (preserves precision for Prisma Decimal(18,3))
  description: string | null
}

// Issue codes for Products [v2 — adds PRICE_PRECISION_LOST]
type ProductIssueCode =
  | 'NAME_REQUIRED'
  | 'UNIT_NOT_FOUND'
  | 'TAX_RATE_FALLBACK'      // warning
  | 'PRICE_OUT_OF_RANGE'
  | 'PRICE_PRECISION_LOST'   // warning — >2 decimal places, rounded
  | 'INVALID_OPENING_STOCK'
  | 'SKU_TOO_LONG'           // >64 chars
  | 'HSN_INVALID'            // not 4/6/8 digits — warning only
  | 'PLACEHOLDER_NAME'       // warning ("Item 1", "Test")
```

Error codes added: `UNIT_NOT_FOUND` · `PRICE_OUT_OF_RANGE` · `INVALID_OPENING_STOCK`. All other 7.1A codes remain valid.

## Data Model

**No new tables.** Reuses `ImportJob`, `ImportJobRow`, and (already-shipped) `Party` addendum logic on the `Product` model.

### Schema preconditions [v2 — Gap 7]

Before the migration runs, the architect MUST verify and the SCOPE asserts:

1. `StockMovementType` Postgres enum contains `OPENING_BALANCE`. If absent, migration A includes `ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE'` (must run **outside a transaction** — separate migration file with `-- prisma:no-transaction` directive, like Migration C below).
2. `StockMovement.quantity` is `Decimal(18,3)` (NOT `Float`, NOT `Int`). If currently Float, a follow-up data-type migration runs **before** 7.1B ships. SCOPE blocks if the precondition fails.
3. `StockMovement` columns the slice depends on: `(id, businessId, productId, quantity, type, importJobId?, importJobRowId?, sourceIndex?, createdAt)`. Migration A adds `importJobId String?`, `importJobRowId String?` and the constraint described below.
4. FK on Product → StockMovement is `ON DELETE RESTRICT` (matches existing HP convention; the bulk-delete escape hatch uses soft-delete per [SHOULD_SHIP] gap S3 — not addressed in v2).

### Schema diffs [v2 — Gap 1, Gap 2, Gap 4]

**Product model addendum** (additive, nullable — symmetric with Party addendum from 7.1A):

- `importJobId String?` — FK ImportJob
- `importedBy String?` — FK User
- Index `(businessId, importJobId)`

**StockMovement addendum**:

- `importJobId String?` — FK ImportJob; index `(businessId, importJobId)` for cleanup cron / bulk-delete lookups
- `importJobRowId String?` — FK ImportJobRow
- **UNIQUE constraint** `unique_stock_movement_import_row` on `(importJobRowId)` WHERE `importJobRowId IS NOT NULL` (partial unique index). This is the idempotency anchor — see §Idempotency.

**ImportJobRow expand→backfill→contract** [v2 — Gap 1]:

The rename from `createdPartyId` to `createdEntityId` uses three migrations across **two PRs** to keep 7.1A live during the deploy:

- **Migration A (this slice, in 7.1B PR)**:
  - `ADD COLUMN createdEntityId TEXT NULL` on `ImportJobRow`.
  - `UPDATE ImportJobRow SET createdEntityId = createdPartyId` (one-shot backfill; fast — column is sparsely populated).
  - Add index on `(jobId, createdEntityId)`.
  - `createdPartyId` is **NOT dropped** in this migration. Both columns coexist.
- **Code (this slice, in 7.1B PR — transitional dual-write)**:
  - 7.1A parties commit path is updated to write **both** `createdPartyId = pid` AND `createdEntityId = pid`.
  - 7.1B products commit path writes **only** `createdEntityId = productId`.
  - Row-level guard expression becomes `WHERE status='STAGED' AND createdEntityId IS NULL` (single column); the transitional `createdPartyId IS NULL AND createdEntityId IS NULL` double-check is only used during the deploy window where two app versions may be live (deploy-rolling minutes, not days).
- **Migration B (follow-up PR, 1+ release later — contract phase)**:
  - Verify zero NULL `createdEntityId` rows where `status='COMMITTED'` (assertion).
  - `DROP COLUMN createdPartyId`.

**ImportJob.createdPartyIds JSON** [v2 — Gap 1]:

Database column name is **grandfathered** (kept as `createdPartyIds`). Prisma model uses `@map("createdPartyIds")` to expose the field as `createdEntityIds` in code. The JSON payload is now entity-polymorphic — entity type is inferable from `ImportJob.entity`. No SQL-level rename; no migration risk.

```prisma
model ImportJob {
  // ...
  createdEntityIds Json? @map("createdPartyIds")
  entity           String  // 'parties' | 'product'
}
```

### Migrations (this slice) [v2 — Gap 4]

Three migration files in this slice. Architect emits.

- **Migration A** — `prisma/migrations/<ts>_product_import_expand/migration.sql`. In a transaction (Prisma default). Adds `Product.importJobId`, `Product.importedBy`, `StockMovement.importJobId`, `StockMovement.importJobRowId`, `ImportJobRow.createdEntityId` + backfill, plus btree indexes. ~40 lines.
- **Migration B** — `prisma/migrations/<ts>_stock_movement_import_row_unique/migration.sql`. In a transaction. Adds `CREATE UNIQUE INDEX unique_stock_movement_import_row ON "StockMovement" (importJobRowId) WHERE importJobRowId IS NOT NULL` (partial unique). ~5 lines.
- **Migration C** — `prisma/migrations/<ts>_product_trgm_index/migration.sql` **with `-- prisma:no-transaction` directive on line 1**. Runs `CREATE INDEX CONCURRENTLY IF NOT EXISTS product_business_name_trgm ON "Product" USING gin (business_id, name gin_trgm_ops);`. Cannot run inside a transaction (Postgres requirement for `CONCURRENTLY`). ~3 lines.
- (Schema-prerequisite migration for `OPENING_BALANCE` enum value, if needed, runs as a fourth `prisma:no-transaction` migration ahead of A.)

**Why CONCURRENTLY** [v2]: standard `CREATE INDEX` takes `ACCESS EXCLUSIVE` on `Product`. For Amit-class catalogs (>1M products), this freezes the invoicing app for the duration of the build (30s-5min). `CONCURRENTLY` is online — slower to build, no write block. Prisma wraps migrations in a transaction by default; the `prisma:no-transaction` directive on the first line of `migration.sql` opts out.

**`pg_trgm` extension**: 7.1A already created the extension and a trigram index on `Party.name`. Migration C parallels that for `Product` but uses the composite `(business_id, name gin_trgm_ops)` shape to enforce tenant scoping at the index level (see §Dedup).

**Cleanup spec**: identical to 7.1A. Same cron, same retention windows. The `import_cleanup.no_rows_processed` metric is shared.

## Idempotency [v2 — Gap 2]

The commit path inserts three rows per source row: `INSERT Product`, `INSERT StockMovement` (if `openingStock > 0`), and `UPDATE ImportJobRow`. All three live in the **same chunk transaction** (one `BEGIN ... COMMIT` per 500 rows, **no savepoints**). If the tx rolls back, nothing landed.

Mid-chunk crash (connection drops between Product INSERT and StockMovement INSERT) rolls the whole chunk back at the Postgres level — `currentStock` cannot drift.

For **commit-retry after a successful tx but failed response** (the classic 504-during-response case), idempotency is enforced at three levels:

1. **`commitToken`** (7.1A model) — second commit with stale token → 409 `BAD_COMMIT_TOKEN`.
2. **`Idempotency-Key`** (7.1A model) — second commit with matching key returns cached prior response.
3. **Row-level + StockMovement-level guards** (this slice):
   - `UPDATE ImportJobRow SET status='COMMITTED', createdEntityId=:productId WHERE id=:rowId AND status='STAGED' AND createdEntityId IS NULL` — rows already committed are skipped.
   - `INSERT INTO StockMovement (..., importJobRowId, ...) VALUES (...) ON CONFLICT (importJobRowId) DO NOTHING` — partial unique index `unique_stock_movement_import_row` makes the insert idempotent. (Prisma equivalent: `createMany({ data, skipDuplicates: true })`.)

**Statement order inside each row's iteration** (documented for architect):

```
1. INSERT Product (...) RETURNING id  →  productId
2. INSERT StockMovement (importJobRowId, importJobId, productId, quantity, type='OPENING_BALANCE', ...)
   ON CONFLICT (importJobRowId) DO NOTHING
3. UPDATE ImportJobRow SET status='COMMITTED', createdEntityId=productId
   WHERE id=:rowId AND status='STAGED' AND createdEntityId IS NULL
```

If retry replays an already-committed chunk: step 3's WHERE fails to match (already COMMITTED) and the chunk is a no-op; step 2's ON CONFLICT swallows the duplicate StockMovement; step 1 produces an orphan Product but only if the retry reaches that step before the WHERE check — to prevent orphans, **the retry pre-scans** `ImportJobRow.status` for each chunk and skips rows already `COMMITTED` before any INSERT runs. This pre-scan is documented as the entry point of `commit-products.service.ts`.

**Integration test (Gap 2)**: simulate mid-chunk crash by killing the connection after `INSERT Product` but before `INSERT StockMovement` for row #250 of a 500-row chunk. Retry the commit. Assert: exactly one Product row #250 exists, exactly one StockMovement #250 exists, `currentStock` equals the imported opening stock (not 2x).

## Dedup [v2 — Gap 3]

**Exact dedup** (`product-exact-dedup.ts`):

- SKU-exact match wins when both SKU and name match. Scoped to `WHERE businessId = $1`.
- Name-exact match (case-insensitive, NFKC-normalized) when SKU is empty/null on the incoming row.

**Near dedup** (`product-near-dedup.ts`) — trigram, business-scoped:

```sql
SET LOCAL pg_trgm.similarity_threshold = 0.7;
SELECT p.id, p.name, p.sku, p.salePrice
FROM "Product" p
WHERE p.businessId = $1
  AND p.deletedAt IS NULL
  AND similarity(p.name, $2) >= 0.7
ORDER BY similarity(p.name, $2) DESC
LIMIT 5;
```

**Tenant scoping is mandatory** — every near-dedup query MUST include the `WHERE p.businessId = $1` predicate. The composite GIN index `product_business_name_trgm ON "Product" USING gin (business_id, name gin_trgm_ops)` enforces this at the planner level (the planner uses the index only when `businessId` is in the predicate; a forgotten tenant filter would force a seq-scan and stand out in slow-query logs immediately).

**Integration test (Gap 3)**: seed two businesses A and B with overlapping product names ("Reynolds Pen Blue" in both). Upload product import to business A. Assert: dedup preview for business A contains zero candidate rows from business B (cross-tenant isolation). Repeat with deliberately omitted `businessId` filter in a debug build — assert the test fails (proves the filter is load-bearing, not redundant).

## Price normalization [v2 — Gap 5]

`parseFloat` is **forbidden** in the price path. The conversion goes raw-string → regex-validate → BigInt-paise.

```ts
// pseudocode for product-normalizer.ts
const PRICE_REGEX = /^\d{1,12}(\.\d{0,2})?$/
const PRICE_PRECISION_REGEX = /^\d{1,12}(\.\d{3,})?$/  // >2 decimals → warning

function toPaiseBigInt(raw: string): { paise: bigint; warning?: 'PRICE_PRECISION_LOST' } {
  const trimmed = raw.trim().replace(/,/g, '')          // strip Indian comma grouping
  let warning: 'PRICE_PRECISION_LOST' | undefined
  let normalized = trimmed
  if (PRICE_PRECISION_REGEX.test(trimmed)) {
    // >2 decimal places — round half-away-from-zero using string math
    const [intPart, fracPart] = trimmed.split('.')
    const rounded = roundFracStringTo2dp(fracPart)      // pure string helper
    normalized = `${intPart}.${rounded}`
    warning = 'PRICE_PRECISION_LOST'
  }
  if (!PRICE_REGEX.test(normalized)) {
    throw { code: 'PRICE_OUT_OF_RANGE' }                // also catches "abc", ">12 digits"
  }
  const [intStr, fracStr = ''] = normalized.split('.')
  const fracPadded = (fracStr + '00').slice(0, 2)       // ensure exactly 2 paise digits
  const paise = BigInt(intStr + fracPadded)
  if (paise > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw { code: 'PRICE_OUT_OF_RANGE' }                // safety net (regex already bounds to 12 digits)
  }
  return { paise, warning }
}
```

The regex `^\d{1,12}(\.\d{0,2})?$` bounds the integer portion to 12 digits (max `999_999_999_999.99` rupees = `99_999_999_999_999` paise), which fits inside `Number.MAX_SAFE_INTEGER` (9_007_199_254_740_991). Inputs with >12 integer digits or non-numeric characters fail the regex and emit `PRICE_OUT_OF_RANGE` **before** any numeric conversion.

**Boundary tests** (in `tests/integration/import-products.test.ts`):

- `"90071992547409.91"` → BigInt 9007199254740991 (`Number.MAX_SAFE_INTEGER` exactly) → OK
- `"90071992547409.92"` → BigInt 9007199254740992 → ERROR `PRICE_OUT_OF_RANGE` (overflow safety net)
- `"999999999999.99"` → 99999999999999n paise → OK (12-digit integer max)
- `"9999999999999"` (13 integer digits) → ERROR `PRICE_OUT_OF_RANGE` (regex rejects)
- `"1.2345"` → WARNING `PRICE_PRECISION_LOST`, normalized to `"1.23"` → 123n paise
- `"1,23,456.78"` → comma-stripped → 12345678n paise
- `"abc"` → ERROR `PRICE_OUT_OF_RANGE` (regex rejects)

**CLAUDE.md compliance**: "no floating point money" — preserved by the BigInt + string-math pipeline above.

## Unit alias resolution [v2 — Gap 6]

The unit-resolver folds source strings through this pipeline **in order** before alias lookup:

```
input  →  NFKC normalize  →  trim  →  case-fold (lowercase, latin only)
       →  strip trailing '.'  →  collapse internal whitespace  →  lookup
```

Devanagari aliases run **before** the latin case-fold step (devanagari has no case), but after NFKC (which composes combining marks consistently).

**Alias map** (in-memory constant, `src/services/import/unit-resolver.ts`):

```ts
// Precedence: devanagari first, then latin singular/plural folds
const UNIT_ALIASES: Record<string, string> = {
  // Devanagari (input is post-NFKC, pre-case-fold)
  'नग': 'piece',
  'किलो': 'kilogram',
  'किग्रा': 'kilogram',
  'ग्राम': 'gram',
  'लीटर': 'litre',
  'मीटर': 'metre',

  // Latin — singular and plural, lowercased post-fold
  'pc': 'piece', 'pcs': 'piece', 'piece': 'piece', 'pieces': 'piece',
  'nos': 'piece',                                  // safe: explicit plural form
  'kg': 'kilogram', 'kgs': 'kilogram', 'kilo': 'kilogram', 'kilos': 'kilogram',
  'kilogram': 'kilogram', 'kilograms': 'kilogram',
  'g': 'gram', 'gm': 'gram', 'gms': 'gram', 'gram': 'gram', 'grams': 'gram',
  'mg': 'milligram', 'mgs': 'milligram', 'milligram': 'milligram', 'milligrams': 'milligram',
  'l': 'litre', 'ltr': 'litre', 'litre': 'litre', 'litres': 'litre',
                                                   // 'liter'/'liters' US spelling
  'liter': 'litre', 'liters': 'litre',
  'ml': 'millilitre', 'mls': 'millilitre',
  'm': 'metre', 'mtr': 'metre', 'metre': 'metre', 'metres': 'metre',
  'meter': 'metre', 'meters': 'metre',
}
// 'no' is deliberately NOT mapped — too ambiguous with boolean header noise
// in malformed Generic CSVs (audit Gap 6). Source strings of bare "no" fall
// through to UNIT_NOT_FOUND with the inline Create-unit recovery.
```

**Test fixtures** for ambiguous inputs (each gets a row in `tests/fixtures/import/products/generic-sample.csv` + an assertion in the integration test):

- `"PCS"` (uppercase) → resolves to `piece`
- `"Pcs."` (trailing dot) → resolves to `piece`
- `"Pcs "` (trailing whitespace) → resolves to `piece`
- `"नग"` (devanagari) → resolves to `piece`
- `"किलो"` (devanagari) → resolves to `kilogram`
- `"pieces"` (plural) → resolves to `piece`
- `"liters"` (US plural) → resolves to `litre`
- `"no"` (bare) → ERROR `UNIT_NOT_FOUND` (intentional)
- `"doz"` (unmapped) → ERROR `UNIT_NOT_FOUND` with inline create-unit action

## File Plan

Hard rule: every row ≤ 250 lines. Reuses **all** 7.1A files where possible; only product-specific files are added/edited.

### Backend (`server/`)

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|------------|-------|-------|
| 1 | `prisma/schema.prisma` | edit | ~20 | schema | Product addendum, StockMovement addendum (importJobId, importJobRowId), ImportJobRow.createdEntityId, ImportJob.createdEntityIds `@map`, indexes |
| 2 | `prisma/migrations/<ts>_product_import_expand/migration.sql` | create | ~40 | migration | Migration A — expand columns + backfill (in tx) |
| 3 | `prisma/migrations/<ts>_stock_movement_import_row_unique/migration.sql` | create | ~5 | migration | Migration B — partial unique index (in tx) |
| 4 | `prisma/migrations/<ts>_product_trgm_index/migration.sql` | create | ~5 | migration | Migration C — `-- prisma:no-transaction` + composite GIN trgm |
| 5 | `src/types/import.types.ts` | edit | ~35 | types | Add `NormalizedProduct` (bigint prices, Decimal-string stock), `ProductIssueCode` incl. `PRICE_PRECISION_LOST`, broaden `entity` union |
| 6 | `src/constants/import.constants.ts` | edit | ~25 | constants | Add product-specific limits: SKU_MAX=64, PRODUCT_PLACEHOLDER_NAMES, TRGM_NEAR_DUP_THRESHOLD=0.7, PRICE_REGEX, PRICE_PRECISION_REGEX |
| 7 | `src/schemas/import.schemas.ts` | edit | ~30 | schema | Add product Zod schema branch |
| 8 | `src/services/import/normalizers/product-normalizer.ts` | create | ~230 | service | name/sku/hsn validators, BigInt paise conversion (no parseFloat), unit-resolver, tax-resolver, opening-stock Decimal-string parsing |
| 9 | `src/services/import/normalizers/price.util.ts` | create | ~90 | utils (pure) | `toPaiseBigInt`, `roundFracStringTo2dp`, regex constants — string-math money pipeline |
| 10 | `src/services/import/parsers/tally-xml.parser.ts` | edit | ~60 | service | Add `<STOCKITEM>` branch; dispatch by entity |
| 11 | `src/services/import/parsers/vyapar-csv.parser.ts` | edit | ~50 | service | Add product header-name detection |
| 12 | `src/services/import/parsers/busy-excel.parser.ts` | edit | ~60 | service | Add `ItemMaster` sheet branch |
| 13 | `src/services/import/parsers/generic-csv.parser.ts` | edit | ~40 | service | Wider column-mapping vocabulary |
| 14 | `src/services/import/dedup/product-exact-dedup.ts` | create | ~130 | service | SKU-exact (priority) then case-insensitive name-exact, scoped businessId |
| 15 | `src/services/import/dedup/product-near-dedup.ts` | create | ~120 | service | pg_trgm similarity ≥0.7 on Product.name, tenant-scoped by `businessId` |
| 16 | `src/services/import/commit-parties.service.ts` | create | ~180 | service | Split from existing commit.service.ts; parties branch + dual-write of `createdPartyId` AND `createdEntityId` during overlap window |
| 17 | `src/services/import/commit-products.service.ts` | create | ~220 | service | Products branch; per-row INSERT Product + ON-CONFLICT-DO-NOTHING StockMovement + UPDATE ImportJobRow guard; pre-scan COMMITTED rows on retry |
| 18 | `src/services/import/commit.service.ts` | edit | ~80 | service | Thin dispatcher by `ImportJob.entity` — delegates to commit-parties / commit-products |
| 19 | `src/services/import/audit.ts` | edit | ~30 | service | Add `products.imported` action; reuses 7 import_job.* actions |
| 20 | `src/services/import/unit-resolver.ts` | create | ~140 | service | NFKC + trim + case-fold + trailing-dot strip + devanagari/latin alias map (~50 entries) |
| 21 | `src/services/import/tax-resolver.ts` | create | ~80 | service | Map GST % → TaxCategory row; fallback to business-default |
| 22 | `src/routes/imports/create.route.ts` | edit | ~20 | route | Accept entity='product' in validation |
| 23 | `src/routes/imports/get.route.ts` | edit | ~10 | route | Return normalized shape polymorphic by entity |
| 24 | `tests/fixtures/import/products/tally-sample.xml` | create | n/a | fixture | golden 5-STOCKITEM |
| 25 | `tests/fixtures/import/products/vyapar-sample.csv` | create | n/a | fixture | golden 5-row |
| 26 | `tests/fixtures/import/products/busy-sample.xlsx` | create | n/a | fixture | golden 5-row in ItemMaster sheet |
| 27 | `tests/fixtures/import/products/generic-sample.csv` | create | n/a | fixture | golden 5-row incl. devanagari + price-precision rows |
| 28 | `tests/integration/import-products.test.ts` | create | ~250 | test | happy + 4 errors + dedup tenant-isolation + idempotent commit + mid-chunk crash recovery + StockMovement created + unit-not-found + tax-fallback + price boundary suite |

**Reused as-is from 7.1A (no edits)**: xxe-prescan, zip-bomb-prescan, csv-injection util, import-job.service core, all middleware, cleanup-cron, malicious fixtures. The audit-coverage script gains `products.imported` to its expected-key list (~5 line edit to `scripts/enforce-audit-coverage.mjs` — counted under #19).

### Frontend (`src/`)

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|------------|-------|-------|
| 29 | `src/features/import/import.types.ts` | edit | ~25 | types | Add product shapes, `ProductIssueCode` incl. `PRICE_PRECISION_LOST` |
| 30 | `src/features/import/import.constants.ts` | edit | ~15 | constants | Add product format labels + entity labels |
| 31 | `src/features/import/import.service.ts` | edit | ~20 | service | `entityType: 'import'`, `entityLabel: \`Products: \${fileName}\`` for product jobs |
| 32 | `src/features/import/useColumnAutodetect.ts` | edit | ~60 | hook | Add product header dictionary |
| 33 | `src/features/import/pages/ImportLandingPage.tsx` | edit | ~40 | page | Add "Import Products" tile; entity-aware routing |
| 34 | `src/features/import/pages/ImportUploadPage.tsx` | edit | ~15 | page | Title varies by entity |
| 35 | `src/features/import/pages/ImportMappingPage.tsx` | edit | ~30 | page | Product column targets |
| 36 | `src/features/import/pages/ImportPreviewPage.tsx` | edit | ~40 | page | Row card layout for products |
| 37 | `src/features/import/components/ProductRowCard.tsx` | create | ~120 | sub-component | Product-specific row preview; renders `PRICE_PRECISION_LOST` chip |
| 38 | `src/features/import/components/UnitNotFoundAction.tsx` | create | ~80 | sub-component | Inline "Create unit" action with deep-link |
| 39 | `src/features/import/components/ColumnMapper.tsx` | edit | ~30 | sub-component | Entity-aware target columns |
| 40 | `src/lib/translations.en.ts` | edit | ~55 | constants | `import.product.*` keys incl. `precisionLost` |
| 41 | `src/lib/translations.hi.ts` | edit | ~55 | constants | hi-IN |

Total **new+edited**: ~41 files; every estimate ≤ 250 lines. Largest new file: `import-products.test.ts` at ~250L (within cap). `commit.service.ts` is split into three files (parties / products / dispatcher) before edit — see Accepted Trade-offs.

## UI States

Same five pages as 7.1A. Differences:

### `ImportLandingPage`
- Now shows **two tiles**: "Import Parties" and "Import Products". Loading/Empty/Error states unchanged.
- Empty: `<EmptyState title="No imports yet" body="Bring your parties and products from Tally, Vyapar, or Busy in under 10 minutes." action="Start import" />`

### `ImportUploadPage`
- Title varies: "Upload your products" vs "Upload your parties". Drop-zone + errors otherwise identical.

### `ImportMappingPage`
- Target columns swap to: Name, SKU, HSN, MRP, Sale Price, Purchase Price, GST %, Unit, Opening Stock.

### `ImportPreviewPage`
- Row card uses `<ProductRowCard>` instead of party card; columns shown: Name · SKU · Sale Price (paise→Rs via `formatCurrency`) · Opening Stock · Unit.
- New WARNING chip types: `TAX_RATE_FALLBACK`, `PRICE_PRECISION_LOST`.
- New ERROR chip with inline "Create unit" action for `UNIT_NOT_FOUND`.

### `ImportDedupReviewPage`
- Side-by-side compares Name + SKU + Sale Price.

### `ImportSummaryPage`
- Success copy: "Imported N products" + "View products" → `/products?importJobId=xxx`.

Autocomplete: file `accept=".xml,.csv,.xls,.xlsx"`; mapping inputs `autocomplete="off"` (unchanged).

## Mobile

Unchanged from 7.1A §Mobile. Same 375/320 budgets, same `<BottomActionBar>` usage, same Capacitor file-picker fallback.

## UX Copy

Diff only — all other strings inherited.

| Element | Copy |
|---------|------|
| Tile title | `Import Products` |
| Format picker title (product) | `Where are your products today?` |
| Commit primary CTA | `Import N products` |
| Commit confirm title | `Import N products?` |
| Commit confirm body | `This adds N new products to your catalog. Opening stock will be recorded as an opening-balance movement.` |
| Success toast | `Imported N products` |
| Unit-not-found row chip | `Unit 'pcs' doesn't exist — create it?` |
| Tax fallback warning | `GST 5% not set up — using your default rate` |
| Price precision warning [v2] | `Price has more than 2 decimal places — rounded to nearest paisa` |
| Out-of-range price | `Price too large — check the digits` |
| Negative opening stock | `Opening stock can't be negative` |
| Re-upload warning | `Someone in this business imported a product file like this 3 days ago (N rows). Import it again?` |

## Edge Cases

Inherits 7.1A. New product-specific cases:

| Scenario | Handling |
|----------|----------|
| Tally `<STOCKITEM>` with no `<NAME>` | ERROR `NAME_REQUIRED` |
| Tally `<BASEUNITS>` = "pcs" but business has only "piece" | OK — alias map folds `pcs → piece`; resolves |
| Tally `<BASEUNITS>` = "doz" | ERROR `UNIT_NOT_FOUND`; inline "Create unit 'doz'" |
| Tally `<BASEUNITS>` = "नग" (devanagari) | OK — alias map folds → piece |
| Vyapar CSV "Item Name" + "Sale Price" + missing "Unit" | ERROR `UNIT_NOT_FOUND` with empty source string |
| Busy XLSX "MRP" empty, "Sale Rate" present | OK — mrp=null, salePrice set |
| Generic CSV `sale_price = "1,234.56"` | comma stripped → 123456n paise |
| Generic CSV `sale_price = "1.2345"` (4 decimal places) | WARNING `PRICE_PRECISION_LOST`; rounded to `"1.23"` → 123n paise |
| Generic CSV `sale_price = "9999999999999"` (13 digits) | ERROR `PRICE_OUT_OF_RANGE` (regex rejects before BigInt) |
| `opening_stock = "12.500"` and unit is kg | Decimal-string "12.500" preserved → Prisma Decimal(18,3) |
| `opening_stock = "-5"` | ERROR `INVALID_OPENING_STOCK` |
| Same SKU appears in two rows of source | First STAGED, rest DUPLICATE_EXACT |
| SKU = "" (empty) AND name collides with existing | Falls back to name-dedup; DUPLICATE_EXACT on name |
| HSN = "abc123" | WARNING `HSN_INVALID`; stored as-is |
| Name = "Item 1" / "Test" / "Sample" | STAGED + WARNING `PLACEHOLDER_NAME` |
| GST % = "5.5" but business has only 5% and 12% | WARNING `TAX_RATE_FALLBACK`; uses business-default |
| Commit retry after 504 (whole response lost) | `commitToken` + `Idempotency-Key` cache → identical response, zero new rows |
| Commit retry after **mid-chunk crash** [v2] | Per-row guard `createdEntityId IS NULL` + `StockMovement.UNIQUE(importJobRowId) ON CONFLICT DO NOTHING` → exactly one Product, exactly one StockMovement |
| Cross-tenant trgm leak attempt [v2] | Every near-dedup query has `WHERE businessId = $1`; composite GIN index enforces planner usage |

## Security

Inherits 7.1A §Security **verbatim**. Same auth/role gates, same rate
limits (per-business 5/hr, 20/day uploads; 1 active job per business
**across both entities**), same lockout (3 failed parses in 10 min per
`(businessId, userId)` → 1h cooldown), same XXE/zip-bomb/CSV-injection
envelope, same idempotency contract.

**Audit row additions**:
- `products.imported` per product, payload `{ productId, importJobId, sourceIndex, sku?, name }`
- The 7 `import_job.*` action keys are entity-agnostic and reused unchanged
- `enforce-audit-coverage.mjs --block` is updated to expect `products.imported`

**Cross-tenant isolation** [v2]: trigram near-dedup queries are tenant-scoped at the SQL level (`WHERE businessId = $1`) and at the index level (composite GIN on `(business_id, name gin_trgm_ops)`). Integration test asserts an upload to business A cannot surface candidate rows from business B.

**No new PII surface** — products are business-owned, not data-principal-owned. DPDP cascade is a no-op for product rows (see Failure Mode #5).

## Observability

Same 7 analytics events as 7.1A — properties include `entity: 'parties' | 'product'` so dashboards can split by entity. No new events.

Sentry alerts unchanged. Metrics gain a label dimension `entity` on the existing series (no new series).

## Test Infrastructure

- 4 new fixtures at `tests/fixtures/import/products/` (one per format, 5 rows each)
- Reuses malicious-billion-laughs.xml and malicious-zip-bomb.xlsx from 7.1A — they're entity-agnostic
- New integration test `tests/integration/import-products.test.ts` covers:
  - Each fixture → bucket counts
  - Commit → Product rows + StockMovement rows created with `importJobId` + `importedBy`
  - Unit-not-found path → ERROR with `unitSourceText` captured
  - Tax-fallback path → WARNING + Product uses business-default TaxCategory
  - **Mid-chunk crash recovery** [v2] — kill conn between Product INSERT and StockMovement INSERT for row 250; retry; assert exactly-one of each, no `currentStock` doubling
  - **Cross-tenant trgm isolation** [v2] — seed two businesses with overlapping names; upload to A; assert zero B-candidates in preview
  - **Price boundary suite** [v2] — 7 inputs (`"90071992547409.91"`, `"90071992547409.92"`, `"999999999999.99"`, `"9999999999999"`, `"1.2345"`, `"1,23,456.78"`, `"abc"`) with expected outcome per row
  - **Unit alias suite** [v2] — devanagari `"नग"`, `"किलो"`, plurals `"pieces"`/`"liters"`, casings `"PCS"`/`"Pcs."`/`"Pcs "`, `"no"` (must fail), `"doz"` (must fail with inline action)
  - Double-commit (same Idempotency-Key + commitToken) → no duplicate Products, no duplicate StockMovements
  - Concurrent upload of products while parties job is `PREVIEWED` for same business → 409 `ACTIVE_JOB_EXISTS`
  - Cross-business 404
  - `products.imported` audit row per product
  - DPDP erasure → no-op on products (sanity check: ImportJob.fileName still NULLed for uploader-erasure)
- CI sets `FEATURE_DATA_IMPORT=true` for test business

## Accepted Trade-offs

- **Reuse `ImportJob.entity` column** (already exists; was provisioned in 7.1A). No new tables, no new routes.
- **`commit.service.ts` split required before edit** — current file is ~240L; product branch adds ~220L. Before editing, split into `commit-parties.service.ts` + `commit-products.service.ts` + a thin `commit.service.ts` dispatcher. Architect MUST plan this split in ARCHITECTURE.md or backend agent does it as first commit.
- **Expand→backfill→contract rename** [v2] — `createdPartyId → createdEntityId` ships as Migration A (this slice, additive only) + transitional dual-write in code. The DROP COLUMN is a **separate follow-up PR** at least one release later. Accepts the temporary cost of dual-write logic in 7.1A's parties commit path for the duration of the overlap window in exchange for zero-downtime deploys and zero in-flight-7.1A breakage.
- **`ImportJob.createdPartyIds` JSON column kept verbatim at DB** [v2] — Prisma `@map` renames the type-side field to `createdEntityIds`. No DB migration. The JSON shape is entity-polymorphic; entity is inferable from `ImportJob.entity`.
- **Active-job limit stays per-business across entities** (1 total, not 1-per-entity). Simpler; users with both party+product jobs queue them.
- **No multi-godown opening-stock split** — all opening stock goes to the business's default godown. Multi-godown split is FUTURE_EPIC (7.1F).
- **No barcode / image / variant import** — defer to 7.1F.
- **Unit alias table is in-memory constant** [v2] — ~50 entries (latin + devanagari + plurals + case folds). Move to DB only if alias-coverage becomes a churning concern. `"no"` deliberately excluded due to header-noise ambiguity in malformed CSVs (false-positive risk > recovery cost).
- **GST % match is exact-string** ("5", "5.0", "5.00" all match a 5% TaxCategory after `parseFloat` on the **rate field only** — NOT on price). No fuzzy match.
- **Trigram threshold 0.7 is empirical** — re-tune after pilot.
- **BigInt-in-JSON serialization** [v2] — paise values are BigInt on the server but serialize as **strings** in JSON (JSON has no BigInt). FE re-parses via `BigInt(str)` for arithmetic and converts to Number only when calling `formatCurrency()` (safe inside `MAX_SAFE_INTEGER` since the regex bounded it).

## Out of Scope

- [FUTURE_EPIC] Invoices import (7.1C)
- [FUTURE_EPIC] Payments import (7.1D)
- [FUTURE_EPIC] Product variants (size/colour matrix) — 7.1F
- [FUTURE_EPIC] Product image upload during import — 7.1F
- [FUTURE_EPIC] Barcode column import + validation — 7.1F
- [FUTURE_EPIC] Stock movement history import (beyond opening) — 7.1F
- [FUTURE_EPIC] Multi-godown opening-stock split — 7.1F
- [FUTURE_EPIC] Batch / serial-number import — 7.1F
- [FUTURE_EPIC] Auto-create missing Unit rows — risk of unit-pollution
- [FUTURE_EPIC] Resumable / chunked uploads (>10k rows) — 7.1E
- [FUTURE_EPIC] Background-worker offload (>2k rows real worker) — 7.1E
- [FUTURE_EPIC] Decimal money type migration (price columns) — currently BigInt paise on the wire, Int paise at rest; widen to `Decimal(18,4)` cross-cuttingly later
- [FUTURE_EPIC] Multi-language unit map as a DB table — promote when alias set grows >50 entries
- [FUTURE_EPIC] Batched-similarity dedup query for >100k existing products — performance-only ([SHOULD_SHIP] S1)

## Cross-feature Impact

- **Product CRUD**: accepts `importJobId` + `importedBy` (nullable). One column addition.
- **StockMovement**: accepts `importJobId` (nullable) + `importJobRowId` (nullable, partial-unique). Two column additions.
- **Products list filter**: `?importJobId=xxx` added to `GET /api/products` (mirrors 7.1A's parties filter).
- **Unit nav**: deep-link "Create unit" from preview page passes back through to import preview after creation (URL state).
- **TaxCategory nav**: similar deep-link, but UI shows fallback note instead of forcing a trip.
- **Audit log**: new action key `products.imported`. The 7 `import_job.*` keys are reused unchanged.
- **DPDP erasure cascade**: no change — product rows aren't principal-owned.
- **Feature flag**: same `FEATURE_DATA_IMPORT` flag. No separate flag.
- **7.1A parties code path** [v2]: parties commit service dual-writes `createdPartyId` AND `createdEntityId` during the overlap window. One commit per the deploy plan; reverts cleanly when Migration B (contract phase) lands.

## Risks

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | `commit.service.ts` grows >250L after product branch | Medium | Split into entity-specific files BEFORE edit (see Accepted Trade-offs) |
| 2 | Column rename deploy breaks in-flight 7.1A requests | High | Expand→backfill→contract pattern; dual-write during overlap; DROP COLUMN in follow-up PR (Gap 1) |
| 3 | Unit alias table misses obscure units ("carton") | Low | Inline "Create unit" action gives user a one-click recovery; alias set covers ~50 common variants incl. devanagari + plurals |
| 4 | Trigram threshold 0.7 produces false positives on common SKUs | Medium | Side-by-side preview; user accepts/rejects per-row; bulk-delete escape hatch via importJobId |
| 5 | StockMovement double-write on commit retry | High | Partial unique index on `(importJobRowId)` + `ON CONFLICT DO NOTHING`; chunk tx with no savepoints; integration test for mid-chunk crash (Gap 2) |
| 6 | Cross-tenant trgm leak via missing `businessId` filter | High | Composite GIN index on `(business_id, name gin_trgm_ops)`; query SQL reviewed; integration test asserts isolation (Gap 3) |
| 7 | GIN trgm index creation locks Product table on production-sized catalogs | High | `CREATE INDEX CONCURRENTLY` in `-- prisma:no-transaction` migration; tested on shadow DB before prod (Gap 4) |
| 8 | Price overflow / precision loss via `parseFloat` | High | BigInt-only path; regex pre-validates raw string; boundary test suite covers 7 inputs (Gap 5) |
| 9 | `OPENING_BALANCE` enum value or `quantity` Decimal type missing in target schema | Medium | Schema preconditions §Data Model are verified by architect; migration adds enum value if absent (Gap 7) |

## Acceptance Criteria

- [ ] `FEATURE_DATA_IMPORT=true` + admin → upload product Tally fixture → `POST /api/imports` with `entity='product'` returns 200 `{ jobId, status: 'PREVIEWED', commitToken, counts: { staged: ≥1 } }`
- [ ] Upload each of 4 product fixtures → `staged ≥ 1`, all bucket counts populated
- [ ] Generic CSV without mapping → 400 `MAPPING_REQUIRED`
- [ ] Generic CSV with auto-detected mapping → 200; mapping reflected in preview
- [ ] Row with unknown unit ("doz") → ERROR `UNIT_NOT_FOUND`; `unitSourceText` populated; FE shows inline create-unit action
- [ ] Row with devanagari unit ("नग") → OK; resolves to `piece`
- [ ] Row with unknown GST % → WARNING `TAX_RATE_FALLBACK`; Product committed with business-default TaxCategory
- [ ] Row with negative opening stock → ERROR `INVALID_OPENING_STOCK`
- [ ] Row with salePrice raw string `"9999999999999"` → ERROR `PRICE_OUT_OF_RANGE` (regex rejects)
- [ ] Row with salePrice `"90071992547409.92"` → ERROR `PRICE_OUT_OF_RANGE` (BigInt overflow guard)
- [ ] Row with salePrice `"1.2345"` → WARNING `PRICE_PRECISION_LOST`; rounded to 123n paise
- [ ] Commit fixture → Product rows have `importJobId`+`importedBy`; StockMovement rows of type `OPENING_BALANCE` written with `importJobId` AND `importJobRowId` for every row with openingStock>0
- [ ] Mid-chunk crash test → exactly one Product + one StockMovement after retry; `currentStock` matches imported value (no doubling)
- [ ] Cross-tenant trgm test → upload to business A surfaces zero similar-name candidates from business B
- [ ] Audit log has all 7 `import_job.*` actions + per-product `products.imported`
- [ ] Double-POST commit (same Idempotency-Key + commitToken) → identical response, no duplicate Products, no duplicate StockMovements
- [ ] Commit with stale commitToken → 409 `BAD_COMMIT_TOKEN`
- [ ] Active product-import job blocks subsequent parties upload (same business) → 409 `ACTIVE_JOB_EXISTS`
- [ ] Cross-business `GET /api/imports/:id` → 404
- [ ] Without auth → 401; without active business → 400; non-admin → 403
- [ ] `clientVersion = "7.0.9"` → 426 `UPGRADE_REQUIRED`
- [ ] Malicious XXE / zip-bomb fixtures rejected (reused from 7.1A)
- [ ] Re-upload same product file → `previouslyUploadedAt` populated, counts-only response
- [ ] Cleanup cron 25h post-commit → `ImportJobRow.raw` and `.normalized` NULL; Product + StockMovement rows preserved
- [ ] DPDP erasure on uploader → `ImportJob.fileName` NULL; Product rows untouched (business-owned)
- [ ] Error CSV download with `=HYPERLINK(...)` in name → cell prefixed with `'`
- [ ] `enforce-audit-coverage.mjs --block` passes (now includes `products.imported`)
- [ ] Migration C uses `CREATE INDEX CONCURRENTLY` with `-- prisma:no-transaction` directive; shadow-DB plan shows zero write-block on Product
- [ ] 7.1A parties commit dual-writes `createdPartyId` AND `createdEntityId`; existing 7.1A tests pass unchanged
- [ ] No raw `fetch()` in `src/features/import/**`
- [ ] All FE mutations pass `entityType: 'import'`, `entityLabel: 'Products: <fileName>'`, `excludeFromOfflineQueue: true`
- [ ] Toggle airplane-mode mid-upload → offline banner; no IDB-queued request
- [ ] All strings present in en + hi translations
- [ ] Screenshots: 4 states × ImportLandingPage (+ Products tile), ImportPreviewPage with ProductRowCard incl. `PRICE_PRECISION_LOST` chip, ImportSummaryPage with product copy
- [ ] 320px no overflow; 375px hp-design audit passes
- [ ] `tsc clean`; `node scripts/enforce.js` clean; `node scripts/enforce-offline.mjs` clean

## QA Checklist

- [ ] curl POST /api/imports `entity=product` without auth → 401
- [ ] curl POST /api/imports `entity=product` non-admin → 403
- [ ] curl POST /api/imports each of 4 product fixtures → `staged ≥ 1`
- [ ] curl POST product fixture with unknown unit → ERROR `UNIT_NOT_FOUND` row
- [ ] curl POST product fixture with unknown GST % → WARNING `TAX_RATE_FALLBACK` row
- [ ] curl POST product fixture with devanagari unit → OK, resolves
- [ ] curl POST product fixture with `"1.2345"` price → WARNING `PRICE_PRECISION_LOST`
- [ ] curl POST product fixture with `"9999999999999"` price → ERROR `PRICE_OUT_OF_RANGE`
- [ ] curl GET /api/imports/:id (product job) paginates rows
- [ ] curl POST /api/imports/:id/commit twice with same Idempotency-Key → identical response, no duplicate Products, no duplicate StockMovements
- [ ] curl POST commit with stale commitToken → 409 `BAD_COMMIT_TOKEN`
- [ ] DB check after commit: every Product has `importJobId` populated; every StockMovement has `importJobId` + `importJobRowId` matching
- [ ] DB check: `unique_stock_movement_import_row` index exists; partial WHERE `importJobRowId IS NOT NULL`
- [ ] DB check: `product_business_name_trgm` GIN index exists; built via CONCURRENTLY (psql `\d Product`)
- [ ] DB check: `ImportJobRow` has both `createdPartyId` AND `createdEntityId` (Migration A applied, Migration B not yet)
- [ ] Bulk-delete-by-importJobId removes Products AND linked StockMovements (cascade) — soft-delete semantics covered in [SHOULD_SHIP] S3 (deferred)
- [ ] tsc + enforce + enforce-offline + audit-coverage all clean
- [ ] Screenshots × product-specific pages × 4 states
- [ ] Dark-mode parity

## Revision Log

**2026-05-19 v1** — initial PRD for 7.1B Products import, written against 7.1A v2 as baseline.

**2026-05-19 v2** — closes all 8 MUST_SHIP gaps from `SCOPE_AUDIT_PHASE7_IMPORT_7_1B_PRODUCTS.md` (verdict BLOCK).

Gaps closed:

- **Gap 1 (column rename ordering)** — added Resolved Decisions #14 + #15, rewrote §Data Model with explicit expand→backfill→contract migration sequence (Migration A in this slice with ADD+backfill, Migration B in follow-up PR with DROP), Prisma `@map` for the JSON column, and dual-write transitional code in 7.1A parties commit path. Updated Accepted Trade-offs, Risks #2, Acceptance criteria.
- **Gap 2 (StockMovement idempotency)** — new §Idempotency section. Added Migration B for `UNIQUE (importJobRowId)` partial index. Documented exact statement order (Product INSERT RETURNING → StockMovement INSERT ON CONFLICT DO NOTHING → ImportJobRow UPDATE guarded). Single-tx no-savepoint contract. Added mid-chunk-crash integration test to Test Infrastructure + Acceptance criteria. Risks #5.
- **Gap 3 (trigram tenant scope)** — new §Dedup section with explicit `WHERE businessId = $1` predicate. Migration C uses composite GIN index `(business_id, name gin_trgm_ops)`. Cross-tenant isolation test added. Failure Mode #7 updated. Risks #6.
- **Gap 4 (CONCURRENTLY)** — Migration C is a separate file with `-- prisma:no-transaction` directive on line 1. Rationale documented in §Data Model and §Migrations. Acceptance criterion added. Risks #7.
- **Gap 5 (price overflow)** — new §Price normalization section with regex `^\d{1,12}(\.\d{0,2})?$`, string-only BigInt conversion, 7-row boundary test suite. New pure utils file `price.util.ts` (File Plan #9). `NormalizedProduct.salePrice/purchasePrice/mrp` typed as `bigint`. CLAUDE.md "no floating point money" rule satisfied. Risks #8.
- **Gap 6 (unit aliases)** — new §Unit alias resolution section. Pipeline `NFKC → trim → case-fold → strip trailing dot → collapse whitespace → lookup`. Alias map expanded to ~50 entries with devanagari (नग, किलो, ग्राम, लीटर, मीटर, किग्रा), plurals (pieces, kilograms, litres/liters, etc.), and casings. `"no"` deliberately dropped due to false-positive risk. Unit alias integration test suite added. Resolved Decisions #17. File Plan #20 grows to ~140L (was ~90L).
- **Gap 7 (StockMovement enum/Decimal preconditions)** — new §Schema preconditions block in §Data Model. Explicitly lists required columns, asserts `StockMovementType` enum contains `OPENING_BALANCE` (separate `prisma:no-transaction` migration if absent), asserts `StockMovement.quantity` is `Decimal(18,3)`. `NormalizedProduct.openingStock` typed as Decimal-string. Risks #9.
- **Gap 8 (`PRICE_PRECISION_LOST` missing from union)** — added to `ProductIssueCode` union in §API Contract. Surfaced in §UX Copy (new chip text), §Edge Cases (warning row), §Acceptance (test row), and FE types file (File Plan #29).

SHOULD_SHIP gaps remain marked but unaddressed in v2 — see audit doc for the seven S1-S7. Each is acceptable as a follow-up because none introduces a correctness or security regression that the MUST_SHIP fixes don't already neutralise:

- S1 (trgm perf >100k) — performance, not correctness; defer to pilot data
- S2 (preview state on deep-link) — UX recovery, not data loss
- S3 (bulk-delete with invoice refs) — soft-delete semantics, follow-up epic
- S4 (Decimal money type) — `quantity` is already `Decimal(18,3)` (§schema-prereq); price columns are BigInt paise; full Decimal migration is [FUTURE_EPIC]
- S5 (audit row volume) — same retention pattern as 7.1A parties
- S6 (SKU case-sensitivity) — to be specified in `product-exact-dedup.ts` doc comment; documented here as case-insensitive + trimmed
- S7 (DH reuse-check evidence) — added inline: Resolved Decisions #4 + #5 cite DH inventory + bulk-import patterns; specific file paths to be added by backend agent when reading

Awaiting scope-auditor v2 pass.
