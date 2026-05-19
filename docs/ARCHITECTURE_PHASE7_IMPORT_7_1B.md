---
architecture_of: SCOPE_PHASE7_IMPORT_7_1B_PRODUCTS.md (v2)
scope_audit_ref: SCOPE_AUDIT_PHASE7_IMPORT_7_1B_PRODUCTS.md (PASS_v2, 0 MUST_SHIP gaps)
parent_architecture: ARCHITECTURE_PHASE7_IMPORT_7_1A.md
architect: architect
created: 2026-05-19T11:10:00+05:30
high_risk_paths_touched:
  - prisma/schema.prisma
  - prisma/migrations/**
  - server/src/services/import/commit.service.ts (split)
feature_flag: FEATURE_DATA_IMPORT (shared with 7.1A; cohort=0)
status: draft (pending architecture-auditor)
---

# ARCHITECTURE — Phase 7 #149 · Slice 7.1B — Products Import

> Adds `entity='product'` to the 7.1A import engine. Same routes, same
> middleware order, same security envelope, same audit pipeline.
> **Reference, don't repeat** — `ARCHITECTURE_PHASE7_IMPORT_7_1A.md`
> remains the SSOT for the security envelope (§3, M1-M4), middleware
> chain (§3), parser interface (§4), job lifecycle (§5), commit lock
> model (§6.1 advisory-lock + M3 four-field bind ASSERT + chunk loop),
> sync-vs-async budget (§7), feature flag wiring (§8), DPDP retention
> (§9), audit coverage (§10), state machine (§5/§11), perf budget
> (§12), and FE-state matrix (§15). This document only **diffs**.

Anything **not** in §1-§11 below is **identical to 7.1A**. SCOPE line
references use the form `SCOPE L<n>` against
`docs/SCOPE_PHASE7_IMPORT_7_1B_PRODUCTS.md`.

---

## §1 Constants (additions to `src/constants/import.constants.ts`)

All additive. No 7.1A constant changes.

```ts
// --- Product money math (SCOPE L38, L89, L295-340) ---
/** Raw decimal-string validation: 1-12 integer digits, ≤2 fractional. */
export const PRICE_REGEX = /^\d{1,12}(\.\d{0,2})?$/
/** Detects >2 fractional digits → WARNING PRICE_PRECISION_LOST. */
export const PRICE_PRECISION_REGEX = /^\d{1,12}\.\d{3,}$/
/** Strip Indian comma grouping ("1,23,456.78") before regex test. */
export const PRICE_COMMA_STRIP = /,/g
/** Safety-net upper bound mirrors regex (≤ 12 int digits + 2 paise). */
export const PRICE_MAX_PAISE = BigInt(Number.MAX_SAFE_INTEGER) // 9_007_199_254_740_991

// --- Product field caps (SCOPE L160-168) ---
export const SKU_MAX_LEN = 64
export const PRODUCT_PLACEHOLDER_NAMES = new Set([
  'item 1', 'item', 'test', 'sample', 'new item', 'product 1',
])
export const HSN_VALID_LENGTHS = new Set([4, 6, 8])

// --- Dedup (SCOPE L36, L118, L271-293) ---
export const TRGM_NEAR_DUP_THRESHOLD = 0.7
/** Product near-dedup top-K candidates returned for review. */
export const TRGM_TOP_K = 5

// --- Audit (SCOPE L45, L540-543) ---
export const ACTION_PRODUCT_IMPORTED = 'products.imported' as const
```

`CHUNK_SIZE=500`, `SYNC_PARSE_CAP=2000`, rate-limit constants,
`IMPORT_MIN_CLIENT_VERSION='7.1.0'`, and DPDP retention windows are
**reused unchanged** from 7.1A (`ARCHITECTURE_PHASE7_IMPORT_7_1A.md` §4
File Plan #4).

---

## §2 File Plan — HARD GATE

Every row ≤ 250 estimated lines. `commit.service.ts` (240L today) is
**split before edit** into three files: parties-branch, products-branch,
thin dispatcher. SCOPE Accepted Trade-off L578 mandates this.

### Backend (`server/src/`)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|------|--------|------------|-------|-------------|
| 1 | `prisma/schema.prisma` | edit | ~25 | schema | API.0 |
| 2 | `prisma/migrations/<ts>_opening_balance_enum/migration.sql` (conditional — only if enum value missing; `-- prisma:no-transaction` first line) | create | ~3 | migration | API.0 |
| 3 | `prisma/migrations/<ts>_product_import_expand/migration.sql` (Migration A — expand + backfill, in tx) | create | ~45 | migration | API.0 |
| 4 | `prisma/migrations/<ts>_stock_movement_import_row_unique/migration.sql` (Migration B — partial unique, in tx) | create | ~6 | migration | API.0 |
| 5 | `prisma/migrations/<ts>_product_trgm_index/migration.sql` (Migration C — CONCURRENTLY, `-- prisma:no-transaction`) | create | ~5 | migration | API.0 |
| 6 | `src/types/import.types.ts` | edit | ~40 | types | API.1 |
| 7 | `src/constants/import.constants.ts` | edit | ~25 | constants | API.1 |
| 8 | `src/schemas/import.schemas.ts` | edit | ~35 | schema | API.1 |
| 9 | `src/services/import/normalizers/price.util.ts` (pure: `toPaiseBigInt`, `roundFracStringTo2dp`, regex constants) | create | ~110 | utils | API.2 |
| 10 | `src/services/import/normalizers/product-normalizer.ts` (name/sku/hsn/openingStock/description; calls price.util + unit-resolver + tax-resolver) | create | ~230 | service | API.2 |
| 11 | `src/services/import/normalizers/unit-resolver.ts` (NFKC + devanagari + alias map ~50 entries) | create | ~150 | service | API.2 |
| 12 | `src/services/import/normalizers/tax-resolver.ts` (GST % → TaxCategory; business-default fallback) | create | ~90 | service | API.2 |
| 13 | `src/services/import/parsers/tally-xml.parser.ts` | edit | ~70 | service | API.3 |
| 14 | `src/services/import/parsers/vyapar-csv.parser.ts` | edit | ~55 | service | API.3 |
| 15 | `src/services/import/parsers/busy-xlsx.parser.ts` | edit | ~65 | service | API.3 |
| 16 | `src/services/import/parsers/generic-csv.parser.ts` | edit | ~45 | service | API.3 |
| 17 | `src/services/import/parsers/index.ts` (entity-aware dispatcher: parties parsers vs product parsers) | edit | ~25 | service | API.3 |
| 18 | `src/services/import/dedup/product-exact-dedup.ts` (SKU > Name; case-insensitive trimmed) | create | ~140 | service | API.3 |
| 19 | `src/services/import/dedup/product-near-dedup.ts` (pg_trgm ≥0.7, `businessId`-scoped) | create | ~130 | service | API.3 |
| 20 | `src/services/import/dedup/index.ts` (entity-aware dispatcher) | create | ~40 | service | API.3 |
| 21 | `src/services/import/commit.helpers.ts` (existing) | edit | ~30 | service | API.4 |
| 22 | `src/services/import/commit-parties.service.ts` (extracted; dual-writes `createdPartyId` AND `createdEntityId` — Gap 1) | create | ~200 | service | API.4 |
| 23 | `src/services/import/commit-products.service.ts` (per-row INSERT Product → StockMovement ON CONFLICT → UPDATE ImportJobRow guard; pre-scan COMMITTED rows on retry) | create | ~240 | service | API.4 |
| 24 | `src/services/import/commit.service.ts` (now a thin dispatcher on `ImportJob.entity`; reuses `acquireBusinessLock`, `lockJob`, `assertCommitBind`, `applyDedupResolutions`) | edit | ~120 | service | API.4 |
| 25 | `src/services/import/commit.resolutions.ts` (existing — extend `applyDedupResolutions` for product OVERWRITE) | edit | ~50 | service | API.4 |
| 26 | `src/services/import/audit-emit.ts` (existing — add `emitProductImported`) | edit | ~30 | service | API.4 |
| 27 | `src/routes/imports/create.route.ts` (existing — accept `entity='product'` in Zod) | edit | ~15 | route | API.5 |
| 28 | `src/routes/imports/get.route.ts` (existing — polymorphic normalized shape) | edit | ~10 | route | API.5 |
| 29 | `scripts/enforce-audit-coverage.mjs` (add `products.imported` to expected keys) | edit | ~5 | script | API.5 |
| 30 | `tests/fixtures/import/products/tally-sample.xml` (5 `<STOCKITEM>` + 1 devanagari unit) | create | n/a | fixture | API.6 |
| 31 | `tests/fixtures/import/products/vyapar-sample.csv` | create | n/a | fixture | API.6 |
| 32 | `tests/fixtures/import/products/busy-sample.xlsx` (ItemMaster sheet, 5 rows) | create | n/a | fixture | API.6 |
| 33 | `tests/fixtures/import/products/generic-sample.csv` (10 rows: aliases + price boundaries + devanagari) | create | n/a | fixture | API.6 |
| 34 | `tests/unit/import/price.util.test.ts` (7-row boundary suite — Gap 5) | create | ~140 | test | API.6 |
| 35 | `tests/unit/import/unit-resolver.test.ts` (devanagari, plurals, casings, `"no"`/`"doz"` reject) | create | ~120 | test | API.6 |
| 36 | `tests/unit/import/tax-resolver.test.ts` | create | ~80 | test | API.6 |
| 37 | `tests/unit/import/product-normalizer.test.ts` | create | ~180 | test | API.6 |
| 38 | `tests/unit/import/parsers-products.test.ts` (4 formats × happy + malicious; reuses 7.1A malicious fixtures) | create | ~200 | test | API.6 |
| 39 | `tests/integration/import-products.test.ts` (100-row CSV happy + tenant-isolation + mid-chunk crash + double-commit + active-job + price boundary + unit alias + DPDP no-op) | create | ~250 | test | API.6 |

### Frontend (`src/features/import/`)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|------|--------|------------|-------|-------------|
| 40 | `src/features/import/types/import.types.ts` (existing) | edit | ~30 | types | FE.1 |
| 41 | `src/features/import/constants/import.constants.ts` (existing — product format labels, entity labels) | edit | ~20 | constants | FE.1 |
| 42 | `src/features/import/services/import.service.ts` (existing — `entityLabel: \`Products: \${fileName}\``) | edit | ~25 | service | FE.1 |
| 43 | `src/features/import/components/FormatPicker.tsx` (existing — add entity-aware copy) | edit | ~20 | sub-component | FE.2 |
| 44 | `src/features/import/components/EntityPicker.tsx` (NEW — Parties / Products tile picker on landing) | create | ~110 | sub-component | FE.2 |
| 45 | `src/features/import/components/ProductRowCard.tsx` (NEW — name/sku/salePrice/openingStock/unit + chips incl. `PRICE_PRECISION_LOST`) | create | ~140 | sub-component | FE.2 |
| 46 | `src/features/import/components/UnitNotFoundAction.tsx` (NEW — inline "Create unit '<text>'" deep-link) | create | ~80 | sub-component | FE.2 |
| 47 | `src/features/import/components/PreviewRowCard.tsx` (existing — branches by entity, delegates to ProductRowCard) | edit | ~30 | sub-component | FE.2 |
| 48 | `src/features/import/components/PreviewTable.tsx` (existing — entity-aware column header set) | edit | ~40 | sub-component | FE.2 |
| 49 | `src/features/import/components/DedupResolution.tsx` (existing — show Name+SKU+SalePrice side-by-side for products) | edit | ~30 | sub-component | FE.2 |
| 50 | `src/features/import/pages/ImportUpload.tsx` (existing — title varies by entity; `accept=".xml,.csv,.xls,.xlsx"`) | edit | ~25 | page | FE.3 |
| 51 | `src/features/import/pages/ImportJobPage.tsx` (existing — Summary view uses product copy + link `/products?importJobId=`) | edit | ~30 | page | FE.3 |
| 52 | `src/features/import/import.css` (token-only — product-row layout) | edit | ~40 | css | FE.3 |
| 53 | `src/lib/translations.en.ts` (`import.product.*` ≈ 30 keys incl. `precisionLost`) | edit | ~60 | translation | FE.1 |
| 54 | `src/lib/translations.hi.ts` | edit | ~60 | translation | FE.1 |

**Total: 54 files (39 BE + 15 FE).** Largest new file: `import-products.test.ts` at 250L (cap). Largest service file: `commit-products.service.ts` at 240L. All other rows ≤ 230L.

**Build-phase ordering:**

- **API.0** schema + 4 migrations (high-risk-path gate first).
- **API.1** types / constants / Zod / audit-coverage script.
- **API.2** pure utils + product-normalizer + unit-resolver + tax-resolver.
- **API.3** parsers + dedup.
- **API.4** commit split (parties + products + dispatcher).
- **API.5** routes (composition only).
- **API.6** fixtures + unit + integration tests.
- **FE.1** types/constants/service/translations.
- **FE.2** components.
- **FE.3** pages + css.

First build-agent action: `git status` on the 54 paths, then scaffold empty stubs (imports + exports only) for every `create` row before any logic.

---

## §3 Routes (entity-aware) + middleware order

**No new routes.** SCOPE L127 — same 5 routes from 7.1A
(`POST /api/imports`, `GET /api/imports/:id`,
`POST /api/imports/:id/commit`, `DELETE /api/imports/:id`,
`GET /api/imports`) become entity-polymorphic.

Middleware composition is **unchanged** from 7.1A §3:

```
POST /api/imports
  requireAuth → requireActiveBusiness → requireRole('admin')
  → requireFeature('DATA_IMPORT') → requireMinClientVersion('7.1.0')
  → importRateLimit('upload') → idempotencyCheck
  → multer.memoryStorage(10MB) → createHandler
```

7.1A's M1-M4 directives apply verbatim:

- **M1** runtime `req.user.userId` assertion (still load-bearing for products audit rows).
- **M2** filename sanitisation in `create.route.ts` (`/[\x00-\x1F\x7F‪-‮⁦-⁩]/g`, slice 255, strip leading dots).
- **M3** four-field commit bind (`status=PREVIEWED ∧ commitToken ∧ idempotencyKey ∧ businessId ∧ userId`) is in `commit.helpers.ts:assertCommitBind` — **reused by both branches** of the new commit dispatcher.
- **M4** error-CSV via `GET /api/imports/:id/error-csv` (no signed URLs); `X-Content-Type-Options: nosniff`.

**Zod additions** (`schemas/import.schemas.ts`, File Plan #8):

```ts
entity: z.enum(['parties', 'product']) // SCOPE L131-134
columnMapping: z.record(z.string(), z.string()).optional()
  // generic_csv keys for products: name, sku, hsn, mrp, sale_price,
  //   purchase_price, gst_rate, unit, opening_stock, description
```

The active-job rule (SCOPE L119 Resolved Decision #13) stays per-business across entities — a parties job in `{UPLOADED, PARSING, PREVIEWED, COMMITTING}` blocks a subsequent products upload with `409 ACTIVE_JOB_EXISTS`. The existing `SELECT ... FOR UPDATE` in `upload.service.ts` already filters `WHERE businessId=$1 AND status IN (...)` without an `entity` predicate, so no change.

---

## §4 Schema migrations — four files

Each migration ≤ 50 SQL lines; up + down outlined. PRISMA_MIGRATION_RULES applies (no `db push`, raw SQL only for GIN trgm). DROP COLUMN for `createdPartyId` is **deliberately not in this slice** — that's Migration D in the follow-up PR (SCOPE L212-214, Accepted Trade-off L579).

### Migration 0 — `<ts>_opening_balance_enum` (conditional, `prisma:no-transaction`)

Only required if `StockMovementType` enum lacks `OPENING_BALANCE`. Architect verifies before generating. SCOPE L180.

**Up:**
```sql
-- prisma:no-transaction
ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'OPENING_BALANCE';
```
**Down:** Postgres has no `DROP VALUE`. Down is a no-op with a comment; remediation = restore from snapshot. Standard Postgres limitation; acceptable for enum-extension.

### Migration A — `<ts>_product_import_expand` (in tx)

Expand phase of expand→backfill→contract for the `createdPartyId → createdEntityId` rename (SCOPE L199-218, Gap 1). Additive only — DROP is Migration D in a follow-up PR.

**Up:**
```sql
-- Product addendum
ALTER TABLE "Product" ADD COLUMN "importJobId" TEXT NULL;
ALTER TABLE "Product" ADD COLUMN "importedBy"  TEXT NULL;
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_importedBy_fkey"
  FOREIGN KEY ("importedBy")  REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Product_businessId_importJobId_idx"
  ON "Product" ("businessId", "importJobId");

-- StockMovement addendum (importJobRowId unique partial index lives in Migration B)
ALTER TABLE "StockMovement" ADD COLUMN "importJobId"    TEXT NULL;
ALTER TABLE "StockMovement" ADD COLUMN "importJobRowId" TEXT NULL;
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_importJobRowId_fkey"
  FOREIGN KEY ("importJobRowId") REFERENCES "ImportJobRow"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "StockMovement_businessId_importJobId_idx"
  ON "StockMovement" ("businessId", "importJobId");

-- ImportJobRow rename expand (Gap 1)
ALTER TABLE "ImportJobRow" ADD COLUMN "createdEntityId" TEXT NULL;
UPDATE "ImportJobRow" SET "createdEntityId" = "createdPartyId"
  WHERE "createdPartyId" IS NOT NULL;
CREATE UNIQUE INDEX "ImportJobRow_createdEntityId_key"
  ON "ImportJobRow" ("createdEntityId");
CREATE INDEX "ImportJobRow_jobId_createdEntityId_idx"
  ON "ImportJobRow" ("jobId", "createdEntityId");
```

**Down:** drop the four FKs, four indexes, three new columns. `createdEntityId` is dropped (it's a fresh column). `createdPartyId` is untouched.

The Prisma schema gains `createdEntityIds Json? @map("createdPartyIds")` on `ImportJob` — **no SQL change** for this; the JSON column is grandfathered (SCOPE L216-226, Resolved Decision #15).

### Migration B — `<ts>_stock_movement_import_row_unique` (in tx)

Idempotency anchor for StockMovement (SCOPE L195-197, L255, Gap 2).

**Up:**
```sql
CREATE UNIQUE INDEX "unique_stock_movement_import_row"
  ON "StockMovement" ("importJobRowId")
  WHERE "importJobRowId" IS NOT NULL;
```
**Down:** `DROP INDEX "unique_stock_movement_import_row";`

Split from A so the partial unique can be reviewed independently and so reverts can hit just the constraint.

### Migration C — `<ts>_product_trgm_index` (`prisma:no-transaction`, CONCURRENTLY)

Composite GIN trigram index — tenant-scoping at the planner level
(SCOPE L228-237, Gap 4).

**Up:**
```sql
-- prisma:no-transaction
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "product_business_name_trgm"
  ON "Product" USING gin ("businessId", "name" gin_trgm_ops);
```
**Down:** `DROP INDEX CONCURRENTLY IF EXISTS "product_business_name_trgm";`

`pg_trgm` is **already** created by 7.1A's parties trgm migration; the `IF NOT EXISTS` is defensive. `CONCURRENTLY` is mandatory — a non-concurrent build takes `ACCESS EXCLUSIVE` on `Product` for the duration (30s-5min on a >1M-row catalog) and freezes invoicing. The composite shape forces the planner to consume `businessId` as the leading column, so any near-dedup query missing the tenant predicate falls back to seq-scan and lights up the slow-query log.

---

## §5 Parser additions

Existing parsers (`parsers/{tally-xml,vyapar-csv,busy-xlsx,generic-csv}.parser.ts`) gain a product branch. Dispatch happens in `parsers/index.ts` keyed on `(format, entity)`. Parser interface (`Parser` type from `parser.types.ts`) is unchanged — same `ParserInput → Promise<ParserResult>` shape, just emits `RawProductRow` instead of `RawPartyRow`.

### Tally XML — `<STOCKITEM>` branch

`tally-xml.parser.ts` already streams `<LEDGER>` elements via fast-xml-parser with `processEntities:false`. Add a parallel walker for `<STOCKITEM>`. Fields extracted:

| Tally element | Maps to | Notes |
|---------------|---------|-------|
| `<NAME>` | `name` (req) | missing → ERROR `NAME_REQUIRED` |
| `<ALIAS>` (optional) | `sku` | first alias only |
| `<HSNCODE>` / `<HSNNUMBER>` | `hsnCode` | 4/6/8 valid; else WARNING |
| `<BASEUNITS>` | `unitSourceText` | fed to unit-resolver |
| `<OPENINGBALANCE>` | `openingStock` | Decimal-string; sign-aware (Tally `Dr/Cr` not relevant for stock) |
| `<OPENINGRATE>` | `purchasePrice` raw | string → toPaiseBigInt |
| `<STANDARDPRICE>` | `salePrice` raw | required for product to be useful; missing emits row with `salePrice=null` → product-normalizer flags ERROR `PRICE_REQUIRED` (already in `ProductIssueCode`) |
| `<MRP>` | `mrp` raw | zero stored as null (SCOPE L113 Decision #7) |
| `<GSTAPPLICABLE>` + `<GSTDETAILS><RATE>` | `gstRateResolved` | fed to tax-resolver |

XXE pre-scan (7.1A) runs first. `processEntities:false` blocks entity expansion. 10s `Promise.race` wraps the parse. No change to the security envelope.

### Vyapar / Busy / Generic — product header detection

`vyapar-csv.parser.ts` adds product header detection (case-insensitive, trim, NFKC):

```
'item name' | 'product name' | 'name'      → name
'item code' | 'sku' | 'code' | 'barcode'   → sku  (barcode NOT imported — see SCOPE L114)
'hsn' | 'hsn code' | 'hsn/sac'             → hsnCode
'sale price' | 'sales price' | 'mrp/price' → salePrice
'purchase price' | 'cost price'            → purchasePrice
'mrp'                                       → mrp
'gst %' | 'tax %' | 'gst rate'             → gstRateResolved
'unit' | 'uom' | 'base unit'                → unitSourceText
'opening stock' | 'stock' | 'qty'           → openingStock
'description'                                → description
```

If "Item Name" / "Product Name" is missing, parser returns `{ rows: [], warnings: [...] }` and the route maps to `400 PARSE_FAILED REQUIRED_COLUMN_MISSING`.

`busy-xlsx.parser.ts` (after zip-bomb pre-scan from 7.1A) reads the `ItemMaster` sheet (case-insensitive sheet name match) instead of the first sheet. Same column dictionary as Vyapar.

`generic-csv.parser.ts` is mapping-driven: it consumes the wider product `columnMapping` dictionary supplied in the request. The FE auto-detect (FE File Plan #44, `useColumnAutodetect`) proposes a default mapping that the user can override.

---

## §6 Normalizer — price BigInt pipeline + unit-alias resolver + GST fallback

`product-normalizer.ts` (File Plan #10) is a **pure** function `RawProductRow → NormalizedProduct | { issues: [...] }`. No I/O except an injected `{ units, taxCategories, businessDefaults }` lookup snapshot (loaded once per job in `parse.service.ts` before per-row iteration — avoids per-row DB hit).

### Price pipeline (`price.util.ts`, File Plan #9)

`parseFloat` is **forbidden** in the money path. Pipeline mirrors SCOPE L297-326 exactly:

```ts
export function toPaiseBigInt(raw: string):
  { paise: bigint; warning?: 'PRICE_PRECISION_LOST' } {
  const trimmed = raw.trim().replace(PRICE_COMMA_STRIP, '')
  let normalized = trimmed
  let warning: 'PRICE_PRECISION_LOST' | undefined
  if (PRICE_PRECISION_REGEX.test(trimmed)) {
    const [intPart, fracPart] = trimmed.split('.')
    normalized = `${intPart}.${roundFracStringTo2dp(fracPart)}`
    warning = 'PRICE_PRECISION_LOST'
  }
  if (!PRICE_REGEX.test(normalized)) {
    throw new PriceError('PRICE_OUT_OF_RANGE')
  }
  const [intStr, fracStr = ''] = normalized.split('.')
  const fracPadded = (fracStr + '00').slice(0, 2)
  const paise = BigInt(intStr + fracPadded)
  if (paise > PRICE_MAX_PAISE) {
    throw new PriceError('PRICE_OUT_OF_RANGE')   // safety net
  }
  return { paise, warning }
}
```

`roundFracStringTo2dp(frac: string)`: pure string-math half-away-from-zero rounding. No `Math.round`, no `Number()` on the truncated frac. Implementation walks digit 3, propagates carry leftward through digits 1-2, returns 2-char string.

7-row boundary suite (SCOPE L330-338) lives in `tests/unit/import/price.util.test.ts` (File Plan #34).

**Wire format** (SCOPE L587): JSON has no BigInt. The normalizer stores `salePrice/purchasePrice/mrp` as `bigint` in TS for in-process arithmetic; the route serializer converts via `String(b)` on the way out. FE `BigInt(str)` for arithmetic, `Number(b)` only when calling `formatCurrency()` (safe — regex bounds keep us inside `MAX_SAFE_INTEGER`).

### Unit-alias resolver (`unit-resolver.ts`, File Plan #11)

Pipeline (SCOPE L344-348): `NFKC normalize → trim → strip trailing '.' → collapse internal whitespace → devanagari lookup OR latin case-fold → alias-map lookup → resolve to canonical name → match against `units` snapshot for this business`.

```ts
function resolveUnit(raw: string, units: UnitRow[]):
  { unitId: string } | { error: 'UNIT_NOT_FOUND'; unitSourceText: string } {
  const normalized = raw.normalize('NFKC').trim()
                        .replace(/\.$/, '').replace(/\s+/g, ' ')
  // devanagari first (no case to fold)
  const devanagari = UNIT_ALIASES[normalized]
  const canonical = devanagari ?? UNIT_ALIASES[normalized.toLowerCase()]
  if (!canonical) {
    return { error: 'UNIT_NOT_FOUND', unitSourceText: raw }
  }
  const unit = units.find(u => u.name.toLowerCase() === canonical)
  if (!unit) {
    return { error: 'UNIT_NOT_FOUND', unitSourceText: raw }
  }
  return { unitId: unit.id }
}
```

The `UNIT_ALIASES` constant is the ~50-entry map from SCOPE L357-379 verbatim, including the documented `"no"` exclusion (SCOPE L380-383). `"no"` resolution would conflict with the boolean header noise common in malformed Generic CSVs — false-positive risk dwarfs the recovery cost (one inline "Create unit 'no'" click).

### Tax resolver (`tax-resolver.ts`, File Plan #12)

```
- parseFloat ALLOWED on the rate field only (SCOPE L585 — "GST % match is
  exact-string"). NEVER on price.
- Build a percent→TaxCategory map once per job from the snapshot.
- Missing: emit WARNING TAX_RATE_FALLBACK; return business-default
  TaxCategory id.
- Missing business default: ERROR TAX_CATEGORY_MISSING (operational
  setup issue — surface as row ERROR rather than crash).
```

### Opening-stock normalization

`Decimal(18,3)` on the wire from the start (SCOPE L153, schema-precondition L181). `NormalizedProduct.openingStock` is typed as `string` (Decimal-as-string preserves precision for Prisma `Decimal`). Negative → ERROR `INVALID_OPENING_STOCK`. Empty → `"0"`.

---

## §7 Dedup queries — tenant-scoped, both layers

### Exact dedup (`product-exact-dedup.ts`, File Plan #18)

SCOPE L273-277, Decision #6 (SKU wins over name):

```sql
-- Pass 1: SKU exact (case-insensitive trim) — wins when SKU non-empty
SELECT id, name, sku, "salePrice"
FROM "Product"
WHERE "businessId" = $1
  AND "deletedAt" IS NULL
  AND LOWER(TRIM(sku)) = LOWER(TRIM($2));

-- Pass 2: only if incoming row has empty/null SKU — name exact (NFKC, ci)
SELECT id, name, sku, "salePrice"
FROM "Product"
WHERE "businessId" = $1
  AND "deletedAt" IS NULL
  AND LOWER(name) = LOWER($2);
```

**Intra-file SKU dedup** (SCOPE L92, L523): when normalizer iterates rows, a `Map<lowercaseSku, firstSourceIndex>` tracks SKUs seen this file. Second occurrence → `DUPLICATE_EXACT` with `matchedPartyId` left null and `issues:[{code:'INTRA_FILE_DUP'}]`. First STAGED.

### Near dedup (`product-near-dedup.ts`, File Plan #19)

SCOPE L278-291 verbatim:

```sql
SET LOCAL pg_trgm.similarity_threshold = 0.7;
SELECT p.id, p.name, p.sku, p."salePrice", similarity(p.name, $2) AS sim
FROM "Product" p
WHERE p."businessId" = $1
  AND p."deletedAt" IS NULL
  AND similarity(p.name, $2) >= 0.7
ORDER BY sim DESC
LIMIT 5;
```

Both `businessId = $1` predicate **and** composite GIN index `product_business_name_trgm` together enforce tenant scoping. Cross-tenant leak integration test (SCOPE L292) seeds two businesses A/B with overlapping names "Reynolds Pen Blue", uploads to A, asserts zero B-candidates. A debug-build companion test deliberately omits the `businessId` filter and asserts the *test* fails — proving the predicate is load-bearing, not redundant.

`dedup/index.ts` (File Plan #20) dispatches by entity: parties → 7.1A `exact-dedup.ts` + `near-dedup.ts` (Levenshtein); product → these two files.

---

## §8 Commit flow — split + idempotency contract

### Split (Accepted Trade-off SCOPE L578)

Today `commit.service.ts` is 187L (read above). It already has:

- `acquireBusinessLock(tx, businessId)` — `pg_advisory_xact_lock` per-business
- `lockJob(tx, jobId)` — `SELECT ... FOR UPDATE` on `ImportJob`
- `assertCommitBind(job, ...)` — M3 four-field ASSERT
- `commitChunk(tx, ...)` — chunked loop in `commit.helpers.ts`
- `applyDedupResolutions(...)` — DUP → STAGED for `CREATE_NEW`, OVERWRITE in-place

The split refactor:

| File | Role |
|------|------|
| `commit.helpers.ts` (existing, edited #21) | Keep all shared helpers — `acquireBusinessLock`, `lockJob`, `assertCommitBind`, `Tx` type. Adds `lockJobWithEntity` returning `entity` field. |
| `commit-parties.service.ts` (NEW #22) | Owns the parties STAGED-pass + `commitChunk` (renamed `commitChunkParties`). Dual-writes `createdPartyId = pid` AND `createdEntityId = pid` per row (Gap 1 transitional overlap). |
| `commit-products.service.ts` (NEW #23) | Products STAGED-pass — see §8.1 below. Writes only `createdEntityId`. |
| `commit.service.ts` (existing, edited #24) | Thin dispatcher: lock + bind ASSERT + entity branch + counts roll-up + audit emit. ~120L. |
| `commit.resolutions.ts` (existing, edited #25) | `applyDedupResolutions` gains a `entity` discriminator. For products, OVERWRITE updates Product + emits zero new StockMovements (overwrite is name/price/HSN replacement; opening stock isn't replayed). |

### §8.1 Products commit per-row statement order (Gap 2)

SCOPE L258-269 dictates the exact ordering, reproduced here as the contract for `commit-products.service.ts`:

```ts
// Inside ONE chunk tx (no savepoints). Pre-scan first.
const stagedRows = await tx.importJobRow.findMany({
  where: {
    jobId,
    status: 'STAGED',          // skips already-COMMITTED rows on retry
    createdEntityId: null,     // row-level guard
  },
  orderBy: { sourceIndex: 'asc' },
  take: CHUNK_SIZE,            // 500
  select: { id, sourceIndex, normalized, matchedProductId },
})

for (const row of stagedRows) {
  // 1. INSERT Product RETURNING id
  const product = await tx.product.create({
    data: {
      businessId: auth.businessId,
      importJobId: jobId,
      importedBy: auth.userId,
      name, sku, hsnCode, salePrice, purchasePrice, mrp,
      unitId, taxCategoryId, description,
      currentStock: '0', // ledger drives stock; column initialised to 0
    },
    select: { id: true },
  })

  // 2. INSERT StockMovement ON CONFLICT DO NOTHING
  //    (partial UNIQUE on importJobRowId; Prisma createMany skipDuplicates)
  if (openingStockDecimal !== '0') {
    await tx.stockMovement.createMany({
      data: [{
        businessId: auth.businessId,
        productId: product.id,
        quantity: openingStockDecimal,
        type: 'OPENING_BALANCE',
        importJobId: jobId,
        importJobRowId: row.id,
        sourceIndex: row.sourceIndex,
      }],
      skipDuplicates: true,
    })
  }

  // 3. UPDATE ImportJobRow GUARDED
  const updated = await tx.importJobRow.updateMany({
    where: { id: row.id, status: 'STAGED', createdEntityId: null },
    data: { status: 'COMMITTED', createdEntityId: product.id },
  })
  // updated.count === 0 means a concurrent commit already bound it.
  // Belt-and-suspenders: Product row is orphaned only if retry reached
  // step 1 first. Pre-scan above + tx rollback on the rare race make
  // this practically impossible; mid-chunk-crash test asserts the
  // outcome (SCOPE L269, Risks #5).

  // 4. per-product audit row
  await emitProductImported(tx, auth, { productId: product.id, jobId,
    sourceIndex: row.sourceIndex, sku, name })
}
```

`applyDedupResolutions` runs **before** the STAGED loop (existing pattern from 7.1A). `CREATE_NEW` flips `DUPLICATE_EXACT|DUPLICATE_NEAR → STAGED`; the loop above picks them up. `OVERWRITE` updates the matched Product in-place and marks the row `COMMITTED` directly (no new StockMovement — opening stock was the original commit's responsibility; overwrite doesn't replay history).

### §8.2 Why this survives every retry pathology

| Pathology | Defence |
|-----------|---------|
| 504 mid-response, client retries with same `Idempotency-Key` | 7.1A `idempotencyCheck` middleware returns cached prior response |
| Client retries with stale `commitToken` | M3 ASSERT fails → 409 `BAD_COMMIT_TOKEN` |
| Mid-chunk crash between `INSERT Product` and `INSERT StockMovement` | tx rollback at PG level — both rows gone; retry pre-scan finds STAGED again and re-runs cleanly |
| Mid-chunk crash after `INSERT StockMovement` but before `UPDATE ImportJobRow` | tx rollback — same as above |
| Mid-chunk crash after `UPDATE ImportJobRow COMMIT` and before client got response | Retry pre-scan filters STAGED only → row is already COMMITTED → no-op; ON CONFLICT swallows any zombie StockMovement insert; UPDATE guard makes step 3 a 0-row update |
| Two concurrent commits for same business | `pg_advisory_xact_lock` serialises; loser sees `status='COMMITTING'` (or `'COMMITTED'`) and 409s on the bind ASSERT |
| Two concurrent updates to same row | row-level `WHERE status='STAGED' AND createdEntityId IS NULL` → loser updates 0 rows; partial-unique `(importJobRowId)` blocks duplicate StockMovement at the DB |

The single source of truth for `currentStock` is the `StockMovement` ledger (SCOPE L111 Decision #5). The Product column is initialised to `'0'`; a downstream materialiser (existing inventory service) rolls movements up. Commit never writes `currentStock` directly — that's how doubling is mechanically prevented.

---

## §9 FE — entity picker + product row card

No new pages. SCOPE L65-67 — the entity is picked by tile on `ImportLandingPage` (existing), the wizard pages branch on `ImportJob.entity` already.

### Entity picker (`EntityPicker.tsx`, File Plan #44)

Renders two tiles on the landing page: "Import Parties" / "Import Products". Each tile routes to `ImportUpload` with `?entity=parties|product` query param. Cards use `<Card>` + `<Button variant="primary">`, tap target ≥44px, dark-mode parity via tokens.

### Product row card (`ProductRowCard.tsx`, File Plan #45)

Replaces `PreviewRowCard` body when `job.entity === 'product'`. Columns shown:

| Column | Source | Display |
|--------|--------|---------|
| Name | `normalized.name` | bold; PlaceholderName chip if WARNING |
| SKU | `normalized.sku` | secondary text |
| Sale Price | `BigInt(normalized.salePrice)` | `formatCurrency(Number(b))` (safe — regex-bounded inside MAX_SAFE_INTEGER) |
| Opening Stock | `normalized.openingStock` (Decimal string) + unit | "12.500 kg" |
| Issues | `row.issues` | chips: `<Badge variant="error|warning">` per issue code |

New chip types: `TAX_RATE_FALLBACK` (warning, yellow), `PRICE_PRECISION_LOST` (warning, yellow), `UNIT_NOT_FOUND` (error, red, with inline `<UnitNotFoundAction unitSourceText={row.unitSourceText}/>`).

### Preview-table column header changes (File Plan #48)

`PreviewTable.tsx` branches on entity to choose column dictionary:

- Parties: Name · Phone · GSTIN · Opening Balance
- Product: Name · SKU · Sale Price · Opening Stock · Unit

Same `<ResponsiveTable>` primitive (cards <md, table ≥md) — no new responsive primitive.

### Unit-not-found deep-link

`UnitNotFoundAction.tsx` (File Plan #46) renders a button "Create unit '<text>'". On tap, deep-links to `/settings/units/new?name=<unitSourceText>&returnTo=/import/jobs/:jobId/preview`. Unit page (existing) reads `returnTo` query param. On successful unit create, redirects back, and `ImportJobPage` re-runs parse-or-resolve. (Resolve only — the unit-resolver snapshot is built fresh on each `GET /api/imports/:id`; no re-parse needed.)

### Offline contract (unchanged)

All API calls go through `api()` with:
- `entityType: 'import'`
- `entityLabel: \`Products: \${fileName}\``  (SCOPE L664)
- `excludeFromOfflineQueue: true` (uploads are too large for IDB queue; SCOPE L665)

Mutation handlers tolerate `{}` return per OFFLINE_RULES Rule 5.

---

## §10 Test plan

### Parser unit (File Plan #38) — 4 formats × happy/malicious

| Test | Fixture | Assertion |
|------|---------|-----------|
| Tally happy | `products/tally-sample.xml` | 5 RawProductRow, first row `name="Reynolds Pen Blue"`, `<BASEUNITS>="नग"` preserved |
| Tally XXE | `malicious-billion-laughs.xml` (reused) | `UNSAFE_XML` thrown by xxe-prescan |
| Vyapar happy | `products/vyapar-sample.csv` | 5 rows; "Sale Price"/"Unit"/"Stock" detected |
| Vyapar missing-header | mutated fixture | `PARSE_FAILED REQUIRED_COLUMN_MISSING` |
| Busy happy | `products/busy-sample.xlsx` | 5 rows from `ItemMaster` sheet |
| Busy zip-bomb | `malicious-zip-bomb.xlsx` (reused) | `UNSAFE_ARCHIVE` |
| Generic happy | `products/generic-sample.csv` w/ mapping | 10 rows; devanagari + price-precision present |
| Generic no-mapping | same w/o columnMapping | `MAPPING_REQUIRED` |

### Pure utils

- `price.util.test.ts` (#34) — 7-row boundary suite from SCOPE L330-338.
- `unit-resolver.test.ts` (#35) — 9 cases incl. devanagari `"नग"`/`"किलो"`, plurals `"pieces"`/`"liters"`, casings `"PCS"`/`"Pcs."`/`"Pcs "`, rejected `"no"`/`"doz"`.
- `tax-resolver.test.ts` (#36) — exact, fallback, missing-default error.
- `product-normalizer.test.ts` (#37) — placeholder names, HSN validation, negative opening-stock ERROR, SKU max-len ERROR.

### Integration (File Plan #39) — `tests/integration/import-products.test.ts`

Single 250L file covering:

1. **Happy 100-row** — upload `vyapar-sample.csv` × 20 to make 100 rows → preview → commit → assert 100 `Product` rows with `importJobId`+`importedBy`; 100 `StockMovement` rows type=`OPENING_BALANCE` with `importJobId`+`importJobRowId`; **1** `import_job.committed` audit row + 100 `products.imported` audit rows.
2. **Cross-tenant trgm isolation** (Gap 3) — seed businesses A & B with overlapping names; upload to A; assert near-dedup preview surfaces zero B-candidates. Debug-build companion: remove `businessId` filter, assert this same test fails.
3. **Mid-chunk crash** (Gap 2) — kill `pg` connection after row 250's Product INSERT, before its StockMovement INSERT. Retry commit. Assert: exactly 1 Product row #250, exactly 1 StockMovement #250, `currentStock` (rolled from ledger) equals imported value (not 2×).
4. **Double-commit** — POST commit twice with identical `Idempotency-Key` + `commitToken`. Identical response body; row counts unchanged.
5. **Stale commitToken** — POST commit with mutated token → 409 `BAD_COMMIT_TOKEN`.
6. **Active-job cross-entity** — start parties job (status=PREVIEWED), POST products upload same business → 409 `ACTIVE_JOB_EXISTS`.
7. **Price boundary suite** (Gap 5) — 7 inputs from SCOPE L330-338 inside the integration test (not just unit) to verify the full upload→preview path emits the right issue codes.
8. **Unit alias suite** (Gap 6) — 9 inputs from SCOPE L385-395 in `generic-sample.csv` rows.
9. **Cross-business 404** — business A's user reads `GET /api/imports/:idFromBusinessB` → 404.
10. **DPDP no-op** (SCOPE L98-99) — uploader requests erasure; assert Product rows untouched; `ImportJob.fileName` NULLed.
11. **Cleanup cron 25h post-commit** — `ImportJobRow.raw`+`.normalized` NULL; Product + StockMovement preserved.

CI: `FEATURE_DATA_IMPORT=true` for test business. Shadow-DB step verifies Migration C ran via `CONCURRENTLY` (`SELECT indexdef FROM pg_indexes WHERE indexname='product_business_name_trgm'` contains `gin`).

---

## §11 PR sequence — independently reviewable

Six PRs land in order. Each compiles + passes its own tests; subsequent PRs assume prior PRs are merged.

| PR | Title | Files (from #) | Gate |
|----|-------|----------------|------|
| PR1 | `chore(import): split commit.service into entity branches` | 21, 22 (parties extract w/ dual-write), 24 (dispatcher), 25 | All 7.1A tests pass unchanged; new `commit.dispatch.test.ts` asserts `entity='parties'` routes to parties branch. **High-risk-path PR — schema untouched.** |
| PR2 | `feat(import): schema + migrations A/B/C + OPENING_BALANCE enum guard` | 1, 2, 3, 4, 5 | Architect-approved plan; migrations run on shadow DB; `CONCURRENTLY` verified; expand-only (no DROP). |
| PR3 | `feat(import): product normalizer + unit + tax + price.util` | 6, 7, 8, 9, 10, 11, 12, 34, 35, 36, 37 | All pure-utils tests pass; tsc clean. No DB writes yet. |
| PR4 | `feat(import): product parsers + dedup` | 13, 14, 15, 16, 17, 18, 19, 20, 30, 31, 32, 33, 38 | Parser unit tests pass; fixtures committed. |
| PR5 | `feat(import): product commit service + routes + audit` | 23, 26, 27, 28, 29, 39 | Integration suite passes; `enforce-audit-coverage.mjs --block` clean (`products.imported` added). |
| PR6 | `feat(import): FE entity picker + product row card` | 40-54 | Screenshots × 4 states; 320px no overflow; lighthouse ≥90; perf-budget chunk ≤100KB. |

A 7th PR (`PR-followup`) — a release later — drops `createdPartyId` (Migration D + remove dual-write from `commit-parties.service.ts`). Tracked separately; **not** in this slice.

Each PR is small enough to review in ≤30 minutes and ships behind `FEATURE_DATA_IMPORT=false` until PR6 lands and pilot cohort flips.

---

## SCOPE Conformance Map — HARD GATE

| SCOPE decision | Architecture artifact | Status |
|----------------|----------------------|--------|
| 4 source formats + product branch (L33) | §5 + File Plan #13-17 | OK |
| Reuse `ImportJob.entity='product'` discriminator (L34, L116) | §3 + Migration A `@map` on `createdEntityIds` | OK |
| Staged-row preview before commit (L35) | §8 + commit-products STAGED filter | OK |
| SKU + Name exact dedup; trigram ≥0.7 (L36, L118) | §7 + File Plan #18, #19; Migration C composite GIN | OK |
| Chunked 500/tx commit (L37) | §8.1 + `CHUNK_SIZE` reused | OK |
| StockMovement opening-balance inside same tx, idempotent via UNIQUE(importJobRowId) (L37, L243-269) | §8.1 + Migration B | OK |
| Money BigInt(paise) end-to-end, no parseFloat (L38, L295-340) | §6 + File Plan #9 price.util.ts + 7-row test suite | OK |
| Unit resolution NFKC + devanagari (L39, L342-395) | §6 + File Plan #11 unit-resolver.ts | OK |
| Tax fallback to business-default (L40) | §6 + File Plan #12 tax-resolver.ts | OK |
| Opening stock ≥0 ERROR (L41) | §6 + product-normalizer.ts | OK |
| Idempotent commit via commitToken (L42) | §3 M3 + §8.1 pathology table | OK |
| Business-scoped tenancy (L43) | §3 middleware + §7 dedup queries | OK |
| Security envelope reused (L44) | §3 references 7.1A §3 verbatim | OK |
| 7 audit actions + `products.imported` (L45, L540-543) | §3 M3 + §8.1 step 4 + File Plan #26, #29 | OK |
| Entity picker (L46) | §9 + File Plan #44 EntityPicker | OK |
| Reserved fixtures × 4 (L47) | File Plan #30-33 | OK |
| Generic CSV product column auto-detect (L48) | §5 + FE File Plan #44 useColumnAutodetect | OK |
| Error-CSV CSV-injection-safe (L49) | 7.1A M4 inherited; no change | OK |
| Tally `<MRP>` zero=null (L50, L113) | §5 Tally table | OK |
| Decisions #14-15 expand→backfill→contract (L120-121) | Migration A §4 + `@map` JSON column | OK |
| Decision #16 BigInt(paise) (L122) | §6 + File Plan #9 | OK |
| Decision #17 unit-resolver pipeline (L123) | §6 + File Plan #11 | OK |
| `OPENING_BALANCE` enum precondition (L180) | Migration 0 (conditional) §4 | OK |
| `Decimal(18,3)` precondition (L181) | §6 openingStock as Decimal-string | OK |
| StockMovement column adds (L182, L195-197) | Migration A + B §4 | OK |
| Product addendum columns (L188-191) | Migration A §4 | OK |
| Idempotency three-level defence (L249-269) | §8.1 + pathology table §8.2 | OK |
| Mid-chunk crash test (L269) | §10 test 3 | OK |
| Dedup tenant predicate + composite GIN (L284, L291) | §7 + Migration C | OK |
| Cross-tenant test (L292) | §10 test 2 | OK |
| Price regex `^\d{1,12}(\.\d{0,2})?$` (L301) | §1 constants + §6 | OK |
| 7-row price boundary suite (L330-338) | §10 test 7 + unit File Plan #34 | OK |
| `PRICE_PRECISION_LOST` in `ProductIssueCode` (L163) | §1 + File Plan #6 | OK |
| Unit alias 9-case suite (L385-395) | §10 test 8 + unit File Plan #35 | OK |
| `commit.service.ts` split before edit (L578, L622) | §8 + File Plan #21-24 (PR1) | OK |
| 5 routes unchanged, polymorphic (L127) | §3 + File Plan #27, #28 | OK |
| Active-job per-business across entities (L119) | §3 | OK |
| Per-business 5/hr 20/day rate limit (L534-538) | 7.1A inherited; no change | OK |
| FE `entityLabel: 'Products: <fileName>'` + `excludeFromOfflineQueue` (L664-665) | §9 + File Plan #42 | OK |
| All FE strings in en+hi (L666) | File Plan #53, #54 | OK |
| Screenshots × 4 states product pages (L667) | §10 + builder acceptance gate | OK |
| 320px no overflow (L668) | §9 + File Plan #52 token-only css | OK |
| `tsc` + `enforce.js` + `enforce-offline.mjs` clean (L669) | §10 acceptance gates inherit 7.1A §17 | OK |
| Bulk-delete by `importJobId` cascade (L688) | Migration A `ON DELETE SET NULL` (Products) + soft-delete deferred (S3) | OK |
| `?importJobId=` filter on `/api/products` (L610) | Out of scope for this arch doc — existing parties filter pattern applies; backend agent extends | DEVIATED |

The single `DEVIATED` row: SCOPE L610 names extending the existing Product list filter. The architect omits an explicit File Plan row for this because the change is a 5-line `where` clause addition in the existing `/api/products` route — too small to merit a File Plan row, and adding one would falsely suggest a new file is required. Documented here so the auditor sees the deliberate choice.

---

## Failure-Mode Implementation (extends 7.1A §16)

| Failure mode | SCOPE mitigation | Architecture site |
|--------------|------------------|-------------------|
| 1. Postgres outage | upload returns 503; in-flight resume idempotent | 7.1A §16 unchanged |
| 2. Abuse spike | per-business 5/hr 20/day; 1 active job across entities | 7.1A `import-rate-limit.ts` + 7.1A active-job SELECT FOR UPDATE |
| 3. DB bloat | hourly cleanup cron; **StockMovement NOT purged** (permanent ledger) | 7.1A cleanup cron unchanged + §4 Migration A note in `ON DELETE SET NULL` |
| 4. Client-version lag | `clientVersion ≥ 7.1.0`; 426 | 7.1A `require-min-client-version.ts` |
| 5. DPDP erasure | no-op for products (business-owned, no PII) | §10 test 10; `ImportJob.fileName` NULL preserved |
| 6. Cost runaway | 500/tx chunks; 1 commit/business; >10k StockMovement alert | §8.1 + 7.1A advisory lock |
| 7. Insider abuse + cross-tenant trgm leak | importedBy + importJobId on every Product + StockMovement; immutable audit; `(businessId, name gin_trgm_ops)` composite GIN | §4 Migration A + §7 + §10 test 2 |

---

## Deviations from SCOPE

1. **`?importJobId=` filter on `/api/products` (SCOPE L610)** — see Conformance Map. Mechanical 5-line addition to existing parties-filter pattern; intentionally not promoted to a File Plan row. Reverse decision = add one row to File Plan (~5 lines, edit existing route).

No other deviations. Every SCOPE MUST_SHIP and SHOULD_SHIP decision has a concrete architecture artifact.

---

## Open questions for architecture-auditor

None expected. Two architect judgement calls:

1. **Migration 0 is conditional.** If the running schema already has `OPENING_BALANCE` in `StockMovementType`, the migration is omitted (its directory is not created). The architect verifies via `\dT+ "StockMovementType"` on shadow DB before generating PR2. Reverse = always emit the migration; `ADD VALUE IF NOT EXISTS` is idempotent.
2. **PR1 ships before PR2.** This means parties dual-write code lands before the `createdEntityId` column exists. The dual-write is gated by `if ('createdEntityId' in fields)` runtime check inside `commit-parties.service.ts` so PR1 is safe to deploy alone. PR2 then enables the dual-write in practice. Reverse = ship PR1 + PR2 together as one larger PR, accept the larger review surface.

---

## Revision Log

**2026-05-19 v1** — initial architecture written against SCOPE v2 (scope-auditor PASS_v2, 0 MUST_SHIP gaps). Next agent: architecture-auditor.
