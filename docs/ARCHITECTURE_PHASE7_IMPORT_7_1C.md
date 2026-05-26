---
architecture_of: SCOPE_PHASE7_IMPORT_7_1C_INVOICES.md (v1, PASS — 5 SHOULD_SHIP advisories folded)
scope_audit_ref: SCOPE_AUDIT_PHASE7_IMPORT_7_1C_INVOICES.md (PASS, 0 MUST_SHIP gaps)
parent_architectures:
  - ARCHITECTURE_PHASE7_IMPORT_7_1A.md (security envelope, M1-M9, audit pipeline, cleanup cron, DPDP)
  - ARCHITECTURE_PHASE7_IMPORT_7_1B.md (commit-dispatcher pattern, expand→contract migration discipline, BigInt-paise pipeline, FE EntityPicker)
architect: architect
created: 2026-05-19T14:05:00+05:30
revised: 2026-05-19T17:30:00+05:30 (v2 — resolves M1-M6 + S1-S4 from ARCHITECTURE_AUDIT_PHASE7_IMPORT_7_1C.md)
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/services/import/commit-dispatcher.ts (extend)
  - server/src/services/party/create.ts (refactor — delegates to create-tx.ts)
  - server/src/services/party/create-tx.ts (new — tx-injectable variant)
feature_flag: FEATURE_DATA_IMPORT (shared cohort=0 with 7.1A/B)
status: draft v2 (re-submit to architecture-auditor)
---

# ARCHITECTURE — Phase 7 #149 · Slice 7.1C — Invoices Import

> Adds `entity='invoice'` to the import engine. **Diff-only.** Anything not
> redefined below is identical to 7.1A and 7.1B. The Conformance Map at
> the end pins every SCOPE decision (and every SHOULD_SHIP S1-S5 from the
> scope audit, plus M1-M6 + S1-S4 from the architecture audit) to a concrete
> artifact.

SCOPE line refs use `SCOPE L<n>` against `SCOPE_PHASE7_IMPORT_7_1C_INVOICES.md`.
AUDIT advisories use `AUDIT S<1-5>` against `SCOPE_AUDIT_PHASE7_IMPORT_7_1C_INVOICES.md`.
ARCH-AUDIT refs use `ARCH M<n>` / `ARCH S<n>` against
`ARCHITECTURE_AUDIT_PHASE7_IMPORT_7_1C.md`.

---

## §1 Reused from 7.1A/B verbatim — no changes

Everything in this list is consumed by 7.1C as-is. **No 7.1C file modifies these.**

| Concern | SSOT | What 7.1C inherits |
|---|---|---|
| Security envelope (M1 userId, M2 filename sanitize, M3 four-field commit bind, M4 error-CSV) | 7.1A §3 | Verbatim — every M directive applies |
| Routes (5 routes — POST /api/imports, GET /:id, POST /:id/commit, DELETE /:id, GET /api/imports) | 7.1A §3 | Polymorphic: route Zod adds `'invoice'` to entity enum (1 line) |
| Middleware order (requireAuth → requireActiveBusiness → requireRole('admin') → requireFeature('DATA_IMPORT') → requireMinClientVersion → importRateLimit → idempotencyCheck → multer) | 7.1A §3 | Verbatim |
| `requireMinClientVersion` constant | 7.1A const | **Bumped** to `'7.1.2'` for `entity='invoice'` requests (per-entity gate; parties/product remain `'7.1.0'`). Resolves AUDIT S2 conflict |
| Idempotency framework (commitToken + Idempotency-Key + row-level `createdEntityId IS NULL` guard) | 7.1A §6 + 7.1B §8.1 | Verbatim |
| `commit-dispatcher.ts` pickCommitChunk(entity) | 7.1B File Plan #24 | **Extended** with `case 'invoice': return commitChunkInvoices` (3-line diff). `ImportEntity` union extends to `'parties' \| 'product' \| 'invoice'` (ARCH M4) |
| Audit pipeline (`import_job.*` 7 actions) + emitter wiring + `enforce-audit-coverage.mjs --block` | 7.1A §10 + 7.1B File Plan #26 | Extended with **`invoices.imported_batch`** (one new action key — see ARCH S1 fold in §6.4) |
| DPDP retention + hourly cleanup cron (`ImportJobRow.raw`/`.normalized` NULL 24h post-commit) | 7.1A §9 | Verbatim; `Document` rows are permanent ledger and out of cleanup scope |
| Active-job gate (`SELECT ... FOR UPDATE WHERE businessId=$1 AND status IN (...)` — entity-agnostic) | 7.1A `upload.service.ts` | Verbatim — parties / product / invoice all share the same per-business singleton |
| Rate-limit envelope (5/hr, 20/day per business) | 7.1A | Verbatim |
| XXE pre-scan + zip-bomb pre-scan + 10MB multer cap + 10k row cap + 10s parse timeout | 7.1A §4 | Verbatim |
| Error-CSV route (`GET /api/imports/:id/error-csv`, CSV-injection-safe formula prefix) | 7.1A M4 | Verbatim |
| FE `EntityPicker.tsx`, `PreviewRowCard` dispatcher, `PreviewTable` column dispatcher | 7.1B FE plan | Extended — adds "Invoices" tile + `InvoiceRowCard` delegate |
| FE offline contract — `api()` wrapper with `entityType:'import'` + `excludeFromOfflineQueue:true` | 7.1B §9 | Verbatim; `entityLabel: \`Invoices: \${fileName}\`` |
| BigInt-paise pipeline (`toPaiseBigInt` in `price.util.ts`) | 7.1B File Plan #9 | Verbatim — 7.1C consumes it then narrows to Int at the row-insert boundary |

No DROP of any 7.1A/B file. Every new 7.1C file is **additive** alongside,
**except** `services/party/create.ts` which is refactored to delegate to a
new tx-injectable sibling (ARCH M2).

---

## §2 New surfaces in 7.1C

### §2.1 Parsers (4 new files / 4 edits)

Each parser file existing today already branches by `entity`. 7.1C adds an
`invoice` branch in each — keeping parsers symmetric across entities.

| Parser | Source contract | Branch logic |
|---|---|---|
| `tally-xml.parser.ts` | `<VOUCHER VCHTYPE="Sales">` blocks; inventory entries nested in `<ALLINVENTORYENTRIES.LIST>` | Already streams XML; add `extractSaleVoucher()` walker. **Aggregation implicit** — one `<VOUCHER>` = one invoice; `<ALLINVENTORYENTRIES.LIST>` items = lines. No separate aggregation pass. |
| `vyapar-csv.parser.ts` | Flat sales export, one row per line; header dictionary case-insensitive | Reuses 7.1B's NFKC + alias header detection; emits flat `RawInvoiceLineRow` (one per source line). **Aggregation runs in §2.2 normalizer.** |
| `busy-xlsx.parser.ts` | `SalesRegister` sheet (case-insensitive sheet name) | Same as Vyapar but XLSX; zip-bomb pre-scan inherited |
| `generic-csv.parser.ts` | Mapping-driven; FE-supplied `columnMapping` | Header dictionary: `invoice_number`, `invoice_date`, `party_name`, `party_phone`, `sku`, `item_name`, `qty`, `rate`, `gst_rate`, `line_total`, `total_amount` (SCOPE L55 verbatim) |

The dispatcher in `parsers/index.ts` is already entity-aware (7.1B); it
gains `case ['invoice', format]` entries (8 lines), and its local
`ImportEntity` union is extended to include `'invoice'` (ARCH M4).

### §2.2 Normalizer with **in-normalize multi-line aggregation** (AUDIT S4)

**Phase ordering (AUDIT S4 fix — explicit):**

> Aggregation runs in the **normalize phase, before staging**. Each
> `ImportJobRow` corresponds to one **aggregated invoice**, not one source
> row. Commit chunks iterate aggregated rows; line splits across chunk
> boundaries are impossible by construction.

The pipeline:

```
parser → RawInvoiceLineRow[]    (flat, 1-per-source-row)
       ↓
invoice-aggregator.ts           (groups by (lower(invoiceNumber), normalizedDate))
       ↓
NormalizedInvoiceDraft[]        (1-per-invoice, lines nested)
       ↓
invoice-normalizer.ts           (FK resolve, tax math, range guard, issue codes)
       ↓
NormalizedInvoice[]             (one ImportJobRow per element, lines as JSON in .normalized)
       ↓
parse.service.ts INSERT-MANY into ImportJobRow
```

**Aggregator** (`invoice-aggregator.ts`):

```ts
const groups = new Map<string, AggregatedGroup>()
for (const raw of rawRows) {
  const date = parseInvoiceDate(raw.invoice_date)  // §2.3
  if (date.error) { stagedErrors.push({sourceIndex, code:'INVALID_DATE'}); continue }
  const num = raw.invoice_number?.trim()
  if (!num) { stagedErrors.push({sourceIndex, code:'INVOICE_NUMBER_REQUIRED'}); continue }
  const key = `${num.toLowerCase()}|${date.iso}`
  const g = groups.get(key) ?? newGroup(raw, date.iso, num)
  if (g.lines.length > 0) assertHeaderMatch(g, raw)  // AUDIT S1 — HEADER_MISMATCH_WITHIN_INVOICE
  g.lines.push(rawLineFrom(raw))
  groups.set(key, g)
}
for (const g of groups.values()) {
  if (g.lines.length === 0) g.issues.push({code:'NO_LINES'})  // unreachable by construction
}
```

For Tally XML the parser emits already-grouped `RawInvoiceGroup` shape and
the aggregator short-circuits (`if (parser.preAggregated) return rawRows as Groups`).

`assertHeaderMatch` compares `party_name`, `party_phone`, `total_amount`,
`cgst_total`, `sgst_total`, `igst_total` against the first row of the
group; differing value → push `HEADER_MISMATCH_WITHIN_INVOICE` (ERROR) on
that group, abort accumulation for that group (still consume subsequent
rows for the same key so the count is accurate).

### §2.3 Date parser — hand-rolled state machine (SCOPE L312-343)

`date.util.ts` — single exported function `parseInvoiceDate(raw: string)`:

```ts
export function parseInvoiceDate(raw: unknown):
  { iso: string; error?: never } | { iso?: never; error: 'INVALID_DATE' } {
  if (typeof raw !== 'string') return { error: 'INVALID_DATE' }
  if (raw.length > 32) return { error: 'INVALID_DATE' }              // length cap
  const nfkc = raw.normalize('NFKC').trim()
  if (!/^[0-9\/\-A-Za-z ]+$/.test(nfkc)) return { error: 'INVALID_DATE' }
                                                                     // ASCII-only post-NFKC
  // State machine — try formats in precedence, each strict-match
  return tryISO(nfkc) ?? tryDDMonYYYY(nfkc) ?? tryDDSlashMMYYYY(nfkc)
       ?? tryDDDashMMYYYY(nfkc) ?? { error: 'INVALID_DATE' }
}
```

Each `try*` function is **linear-scan, zero regex backtracking** —
explicit digit-class checks, month-name table lookup, leap-year check
inline. **No `date-fns`, no `dayjs`, no regex with quantifier ambiguity.**

The single bounded regex `/^[0-9\/\-A-Za-z ]+$/` is anchored at both
ends with bounded character class — linear in input size, no backtracking
surface. ReDoS-safe.

**Resolves SCOPE L327-344 + AUDIT S1 (`INVALID_DATE` already in union — no change needed).**

The 8-case suite from SCOPE L335-343 is implemented in
`tests/unit/import/date.util.test.ts` plus an extra **future-date 100yr**
case (`"2125-03-15"` → OK iso, no rule rejects it — date parser is
syntactic, not semantic; if forward-date rejection is wanted it lives in
a separate `validateBusinessReasonableDate` not in this slice).

### §2.4 Tax reconciler — ±50 paise tolerance (SCOPE L368-390)

`tax-reconciler.ts` — pure function over a `NormalizedInvoiceDraft`:

```ts
const computed = {
  subtotal: sum(lines, 'lineTotalPaise'),
  cgst:     sum(lines, 'cgstPaise'),
  sgst:     sum(lines, 'sgstPaise'),
  igst:     sum(lines, 'igstPaise'),
  cess:     sum(lines, 'cessPaise'),
}
const computedGrand = computed.subtotal + computed.cgst + computed.sgst +
                      computed.igst + computed.cess
const diff = computedGrand - reportedGrandPaise
if (Math.abs(diff) > 50) issues.push({
  code: 'TAX_MATH_MISMATCH', severity: 'WARNING',
  payload: { computed: computedGrand, reported: reportedGrandPaise, diff },
})
// Source-of-record fidelity (Resolved Decision #9): we commit the
// SOURCE-REPORTED totals, never the computed ones.
```

7-case suite per SCOPE L383-389 lives in `tests/unit/import/tax-reconciler.test.ts`.

### §2.5 Range guard — Int paise overflow at 2_147_483_647

`Document.grandTotal` and `DocumentLineItem.{rate,lineTotal,*Amount}`
are **`Int`** (live schema verified: lines 966, 1107, 1110-1125). The
BigInt pipeline from 7.1B produces `bigint`; at the row boundary in
the normalizer we narrow:

```ts
function narrowPaiseToInt(paise: bigint, code: 'AMOUNT_OUT_OF_RANGE' | 'AMOUNT_NEGATIVE'):
  number | { error: typeof code } {
  if (paise < 0n) return { error: 'AMOUNT_NEGATIVE' }       // AUDIT S3 — split code
  if (paise > 2_147_483_647n) return { error: 'AMOUNT_OUT_OF_RANGE' }
  return Number(paise)  // safe — proven ≤ 2^31-1
}
```

**Resolves AUDIT S3**: `AMOUNT_NEGATIVE` is a distinct code with copy
*"Negative total — use the credit-note flow."* `AMOUNT_OUT_OF_RANGE` keeps
the *"Total too large — split into smaller invoices"* copy.

### §2.6 Party resolver — canonical `createPartyTx()` route (SCOPE L41-42, L298, L304 + ARCH M2)

`party-resolver.ts` does a single-roundtrip preload per chunk:

```sql
SELECT id, lower(name) AS lname, COALESCE(phone,'') AS phone
FROM "Party"
WHERE "businessId" = $1 AND "deletedAt" IS NULL
  AND (lower(name), COALESCE(phone,'')) = ANY($2::text[])
```

Match precedence:
1. `(lower(name), phone)` exact pair → `EXISTING`
2. Phone missing on source → `(lower(name))` alone → `EXISTING` + WARNING `PARTY_NAME_ONLY_MATCH` (AUDIT S1)
3. No match + mode=`REQUIRE_PARTIES_FIRST` → ERROR `PARTY_NOT_FOUND`
4. No match + mode=`MATCH_OR_FLY_CREATE` → mark `FLY_CREATED` + WARNING `PARTY_AUTO_CREATED`; **defer actual INSERT** to chunk commit-tx (§6)

#### Fly-create routed via canonical `createPartyTx()` (ARCH M2)

The live `services/party.service.ts` barrel exports `createParty(businessId, data)`
from `./party/create.ts`. That function opens its own `prisma.$transaction(...)`
and its `CreatePartyInput` has no `importJobId`/`importedBy` columns. We
**cannot** call it from inside an existing transaction (Prisma's
TransactionClient does not expose `$transaction` for nested interactive use —
this was ARCH M1's primary failure mode).

**Refactor — Single Source of Truth preserved:**

```ts
// NEW — server/src/services/party/create-tx.ts (~80L)
export interface CreatePartyTxOpts {
  importJobId?: string
  importedBy?: string
}
export async function createPartyTx(
  tx: Tx,
  businessId: string,
  data: CreatePartyInput,
  opts: CreatePartyTxOpts = {},
) {
  // — moved verbatim from create.ts body (STAFF guard, requireGroup,
  //   opening balance, tx.party.create with select, addresses createMany,
  //   custom fields createMany, opening balance create) —
  // — adds: importJobId + importedBy to tx.party.create.data when opts present —
}

// REFACTORED — server/src/services/party/create.ts (~25L)
export async function createParty(businessId: string, data: CreatePartyInput) {
  return prisma.$transaction((tx) => createPartyTx(tx, businessId, data, {}))
}
```

Net behaviour for non-import callers: identical. The public `createParty()`
contract is preserved; integration tests covering POST /api/parties continue
to pass without modification.

Import call site (inside chunk commit tx):

```ts
// In commit-invoices.service.ts (chunk tx — see §2.8)
import { createPartyTx } from '../../party/create-tx.js'  // CANONICAL

// Per-invoice fly-create — advisory lock acquired first (ARCH M5):
await tx.$executeRaw`SELECT pg_advisory_xact_lock(
  hashtextextended('party-fly-create', 0),
  hashtextextended(${businessId} || '|' || lower(${name}) || '|' || ${phone ?? ''}, 0)
)`
const existing = await tx.party.findFirst({
  where: { businessId, name: { equals: name, mode: 'insensitive' }, phone: phone ?? null, deletedAt: null },
  select: { id: true },
})
if (existing) { partyId = existing.id }
else {
  const newParty = await createPartyTx(tx, businessId, {
    name, phone, type: 'CUSTOMER', addresses: [], customFields: [],
    // ...CreatePartyInput defaults
  }, { importJobId: jobId, importedBy: auth.userId })
  partyId = newParty.id
}
```

The advisory lock is `pg_advisory_xact_lock` — **held until the outer chunk
tx commits or rolls back**. Combined with the chunk-tx topology in §2.8,
this serialises all fly-create attempts for the same
`(businessId, lower(name), phone)` triple across concurrent imports. The
post-lock `findFirst` covers the case where a sibling chunk already created
the party while we waited. Routes through the same duplicate-phone guard
that the FE create-party form hits (integration tests #5, #13 in §11
assert).

### §2.7 Product resolver — strict, no auto-create (SCOPE L43, L305)

`product-resolver.ts` — single-roundtrip preload per chunk:

```sql
SELECT id, sku, lower(name) AS lname
FROM "Product"
WHERE "businessId" = $1 AND "deletedAt" IS NULL
  AND (sku = ANY($2::text[]) OR lower(name) = ANY($3::text[]))
```

Match precedence:
1. `sku` exact (case-sensitive — SKUs are codes) → `BY_SKU`
2. `lower(name)` exact → `BY_NAME`
3. Else → `NOT_FOUND` → ERROR (no fly-create)

**Commit-blocked sentinel**: if ANY line in ANY remaining (non-dropped)
row has `PRODUCT_NOT_FOUND` after the §6 P2.5 re-resolution pass, the chunk
throws **`409 COMMIT_BLOCKED_PRODUCT_NOT_FOUND`** with payload
`{ blockedRowCount, missingSkuSample: string[5] }`. See §6 P2.5 for ARCH M6
stale-snapshot handling.

### §2.8 Commit-invoices service — chunk tx, 200 invoices/chunk (ARCH M1 RESOLVED)

`commit-invoices.service.ts` — chunk loop preserves 7.1B's pre-scan +
guarded-update pattern. **Per-chunk tx** (ARCH M1 resolution) — single
outer transaction, no nesting — matches 7.1B's `commit-products.service.ts`
shape and keeps the dispatcher contract symmetric across entities.

**Chunk tx topology — trade-off documentation:**

We considered two topologies after ARCH M1 invalidated the original
per-row-nested-tx design:

| Topology | Blast radius on mid-row crash | Dispatcher symmetry | Verdict |
|---|---|---|---|
| **Per-row tx** (orchestrator opens N tx outside the dispatcher) | 1 invoice | Breaks — dispatcher signature is `(tx, args) => ChunkResult`; would need orchestrator-level entity-aware loop | Rejected |
| **Per-chunk tx** (single outer tx, pre-flight pre-validates everything) | 200 invoices | Identical to 7.1B `commitChunkProducts(tx, args)` | **Chosen** |

We choose **per-chunk tx to maintain dispatcher contract symmetry**. The
200-row blast radius is acceptable because the chunk pre-flight (§6 P1-P3)
pre-validates **everything** that can be checked deterministically (party
resolution, product resolution post-re-resolve, range guards already
applied at normalize time). The only failure modes that can occur
*inside* the chunk tx are:

- DB connection death mid-INSERT → all 200 roll back, idempotency replay
  picks up cleanly via `createdEntityId IS NULL` guard
- `tx.party.create` duplicate-phone constraint violation (race with a
  concurrent FE party-create) — defended by ARCH M5 advisory lock
- Statement timeout — chunk capped at 200 invoices × ~4 statements =
  ≤800 statements; Postgres default `statement_timeout` ample

Per-row tx was the SCOPE-default (Resolved Decision #15) — this is the
single point where architecture overrides SCOPE; recorded in §13 Deviations.

Signature **identical** to 7.1B `commitChunkProducts`:

```ts
export async function commitChunkInvoices(
  tx: Tx,
  args: CommitChunkArgs,
): Promise<ChunkResult> {
  const { jobId, businessId, userId } = args
  const stagedRows = await tx.importJobRow.findMany({
    where: { jobId, status: 'STAGED', createdEntityId: null },
    orderBy: { sourceIndex: 'asc' }, take: 200,
    select: { id: true, sourceIndex: true, normalized: true },
  })
  if (stagedRows.length === 0) {
    return { createdPartyIds: [], sourceIndices: [], done: true }
  }
  // PRE-FLIGHT — see §6 P1, P2, P2.5 (ARCH M6), P3
  const partySnapshot   = await loadPartySnapshot(tx, businessId, stagedRows)
  const productSnapshot = await loadProductSnapshot(tx, businessId, stagedRows)
  reResolveProductsInPlace(stagedRows, productSnapshot)  // ARCH M6 — mutates normalized in-memory
  const blockedCount = countBlockedRows(stagedRows)
  if (blockedCount > 0) {
    throw new AppError('COMMIT_BLOCKED_PRODUCT_NOT_FOUND', 409, '...', {
      blockedRowCount: blockedCount,
      missingSkuSample: collectMissingSkuSample(stagedRows, 5),
    })
  }

  const documentIds: string[] = []
  const sourceIndices: number[] = []
  const documentNumbers: string[] = []
  const partyIds: string[] = []
  const grandTotals: number[] = []

  for (const row of stagedRows) {
    // §6 steps 1-6 — all statements share `tx` (no nested tx.$transaction)
    const result = await commitOneInvoiceWithinChunkTx(tx, row, args, partySnapshot)
    documentIds.push(result.documentId)
    sourceIndices.push(row.sourceIndex)
    documentNumbers.push(result.documentNumber)
    partyIds.push(result.partyId)
    grandTotals.push(result.grandTotal)
  }

  // ARCH S1 — batched audit emit (one per chunk, symmetric with 7.1B)
  await emitInvoicesImportedBatch(tx, {
    jobId, businessId, userId,
    documentIds, documentNumbers, partyIds, grandTotals,
    sourceIndices,
  })

  return {
    createdPartyIds: documentIds,  // ChunkResult shape compat — see JSDoc on field
    sourceIndices,
    done: stagedRows.length < 200,
  }
}
```

`ChunkResult` shape is **unchanged** from 7.1B
(`commit.helpers.ts:46`); `createdPartyIds` carries the **Document IDs**
created by this chunk. JSDoc on the field documents the misnomer
(precedent: 7.1B `commit-products.service.ts:237-239` carries Product IDs
in the same field).

Each invoice's N `DocumentLineItem` INSERTs batch into a single
`createMany` call (one query, not N queries). For a 50-line invoice that's
1 Document INSERT + 1 lines createMany + 1 ImportJobRow guarded UPDATE +
1 ImportJob counter UPDATE = 4 statements per invoice. A full chunk =
~800 statements / 1 audit row.

---

## §3 Migrations — single additive migration, expand-only

One migration. **No contract phase needed** — both new columns are nullable
and additive (no rename, no DROP, no NOT-NULL backfill).

### Migration A — `<ts>_invoice_import_expand` (in tx)

**Scope:** `Document` only. `Party.importJobId` + `Party.importedBy` already
exist in the live schema (`server/prisma/schema.prisma:475-499`, added by
7.1A's party-import slice — verified by grep at architecture-revision time;
no separate migration file required because 7.1A's expand-only schema
edit landed in the same way). §4 precondition #8 cites this fact.

**Up:**
```sql
ALTER TABLE "Document" ADD COLUMN "importJobId" TEXT NULL;
ALTER TABLE "Document" ADD COLUMN "importedBy"  TEXT NULL;
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_importedBy_fkey"
  FOREIGN KEY ("importedBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Document_businessId_importJobId_idx"
  ON "Document" ("businessId", "importJobId");
```

**Down:** drop the two FKs, the index, the two columns. Reversible.

Why no `CONCURRENTLY`: btree on a sparse nullable column on a young
table (`Document` rowcount on pilot business < 5k); short `ACCESS EXCLUSIVE`
hold is acceptable. If the migration ever runs against a multi-million-row
`Document` table, the architect approves a v2 with `CREATE INDEX
CONCURRENTLY` + `-- prisma:no-transaction` first line. Tracked in
ADR-stub at the bottom of the migration file.

**Why expand-only is sufficient (vs 7.1B's expand→backfill→contract):**
7.1B had to **rename** `createdPartyId → createdEntityId` while preserving
backwards-compat for in-flight parties jobs — that required the three-phase
discipline. 7.1C only **adds** columns; existing `Document` rows simply
have `importJobId=NULL` (matches their reality — they weren't imported).
No backfill needed.

No GIN trgm index — there is no near-dedup for invoices (SCOPE Resolved
Decision #8, deterministic numbers).

---

## §4 Schema preconditions — AUDIT S5 + ARCH M3 resolution

SCOPE references the literal `'SALE_INVOICE'` in 6+ places. AUDIT S5
asks: is `Document.type` a pg_enum or freeform text?

**Live schema fact** (`server/prisma/schema.prisma:944`):
```prisma
model Document {
  ...
  type       String // SALE_INVOICE, PURCHASE_INVOICE, ESTIMATE, ...
```

`type` is **freeform `String`**, not a pg_enum. Therefore:

- **The boot-time `assertSaleInvoiceEnum()` is a documented no-op for 7.1C.**
- A code comment in `src/lib/enum-guard.ts` records the choice:
  ```ts
  // 7.1C invoice import: Document.type is freeform String (schema.prisma:944).
  // No pg_enum to assert at boot. If a future migration converts the column
  // to pg_enum, add `assertEnumValue('Document_type', ['SALE_INVOICE', ...])`
  // here BEFORE shipping that migration — otherwise commits fail at runtime
  // instead of boot.
  ```
- A unit test (`tests/unit/lib/enum-guard.test.ts`) asserts that if/when
  someone DOES convert `Document.type` to pg_enum, the test (which
  introspects `information_schema.columns.data_type`) fails — forcing the
  developer to add the assertion explicitly.

Other preconditions (carried from SCOPE §Schema preconditions):
1. `ImportJob.entity` accepts arbitrary string — Zod runtime union adds `'invoice'`.
2. `ImportJobRow.createdEntityId` exists (7.1B Migration A) — reused.
3. `Document.documentNumber String?` — nullable. Dedup query filters `WHERE documentNumber IS NOT NULL`.
4. `Document @@unique([businessId, type, documentNumber])` exists (schema.prisma:1084) — DB-level guard against duplicates; our app-layer dedup is preview.
5. `DocumentLineItem.productId` is FK `Restrict` (schema.prisma:1140) — we MUST resolve every line's `productId` pre-INSERT (hence commit-blocked sentinel on `PRODUCT_NOT_FOUND`).
6. `DocumentLineItem.documentId` is FK `Cascade` (schema.prisma:1139) — soft-delete of a `Document` (via `isDeleted=true`) doesn't cascade through, only hard-delete does. We **never hard-delete** committed Documents.
7. `Document.partyId onDelete: Restrict` (schema.prisma:1036) — fly-created Party row from 7.1C can't be deleted while any Document FKs it. **This matches SCOPE L533** (DPDP failure-mode #5: party row is preserved when uploader is erased).
8. **`Party.importJobId` + `Party.importedBy` exist** (schema.prisma:475-477) with FKs `ImportJob onDelete: SetNull` + `User onDelete: SetNull` (relation name `"ImportedParties"`), and indexes `@@index([importJobId])` + `@@index([businessId, importJobId])` at schema.prisma:498-499. **ARCH M3 resolved by citation** — added by 7.1A party-import schema edit; no Migration A change required. `createPartyTx` populates these when called from the import path.

---

## §5 Error codes — S1 + S3 fold into Zod union

Final `InvoiceIssueCode` union (replaces SCOPE L200-211):

```ts
type InvoiceIssueCode =
  | 'INVOICE_NUMBER_REQUIRED'                    // ERROR
  | 'INVALID_DATE'                                // ERROR
  | 'NO_LINES'                                    // ERROR
  | 'HEADER_MISMATCH_WITHIN_INVOICE'              // ERROR  ← AUDIT S1
  | 'PARTY_NOT_FOUND'                             // ERROR (REQUIRE_PARTIES_FIRST only)
  | 'PARTY_AUTO_CREATED'                          // WARNING
  | 'PARTY_NAME_ONLY_MATCH'                       // WARNING ← AUDIT S1
  | 'PRODUCT_NOT_FOUND'                           // ERROR (commit-blocked sentinel)
  | 'TAX_MATH_MISMATCH'                           // WARNING
  | 'AMOUNT_OUT_OF_RANGE'                         // ERROR   ← AUDIT S3 split
  | 'AMOUNT_NEGATIVE'                             // ERROR   ← AUDIT S3 split
  | 'DUPLICATE_EXACT'                             // ERROR/RESOLVABLE
  | 'INTRA_FILE_DUPLICATE'                        // ERROR/RESOLVABLE
```

Severity is fixed (not data-driven) — encoded in
`INVOICE_ISSUE_SEVERITY` constant. FE chip color picks from severity, copy
picks from `t.import.invoice.issues.<code>`. Two new copy keys added to en+hi:

```ts
'import.invoice.issues.AMOUNT_NEGATIVE':
  en: "Negative total — use the credit-note flow.",
  hi: "नकारात्मक राशि — क्रेडिट-नोट उपयोग करें।",
'import.invoice.issues.HEADER_MISMATCH_WITHIN_INVOICE':
  en: "Header fields differ across this invoice's rows.",
  hi: "इस इनवॉइस की पंक्तियों में हेडर अलग है।",
'import.invoice.issues.PARTY_NAME_ONLY_MATCH':
  en: "Matched by name only — verify phone.",
  hi: "केवल नाम से मिला — फ़ोन सत्यापित करें।",
```

`AMOUNT_OUT_OF_RANGE` keeps its existing copy.

---

## §6 Statement order within chunk tx (NORMATIVE — ARCH M1, M5, M6 RESOLVED)

This is the **contract** for `commit-invoices.service.ts`. Builders MUST
implement this order; any deviation breaks idempotency guarantees.

```
PRE-FLIGHT (within the chunk tx, before the per-invoice loop):
  P1. partyResolver.loadSnapshot(tx, businessId, stagedRows)
        — single-roundtrip SELECT, returns Map keyed by (lower(name), phone)
  P2. productResolver.loadSnapshot(tx, businessId, stagedRows)
        — single-roundtrip SELECT, returns Map keyed by sku/lower(name)
  P2.5 (ARCH M6 — stale resolution sweep):
        for (row of stagedRows)
          for (line of row.normalized.lines)
            if (line.resolved.matchedBy === 'NOT_FOUND'):
              const fresh = productSnapshot.lookup(line.source.sku, line.source.name)
              if (fresh): line.resolved = { productId: fresh.id, matchedBy: 'BY_SKU'|'BY_NAME' }
        // Mutates `row.normalized` in-memory ONLY; not persisted.
        // The chunk's commit reads post-mutation state.
  P3. blockedCount = count(rows where ANY line.resolved.matchedBy === 'NOT_FOUND')
      if (blockedCount > 0) throw COMMIT_BLOCKED_PRODUCT_NOT_FOUND

PER-INVOICE STATEMENTS (within the same chunk tx — NO nested tx.$transaction):

  For each row in stagedRows:
    1. (if fly-create needed)
       a. await tx.$executeRaw\`SELECT pg_advisory_xact_lock(
            hashtextextended('party-fly-create', 0),
            hashtextextended(${businessId} || '|' || lower(${name}) || '|' || ${phone ?? ''}, 0)
          )\`
          // Lock held until chunk COMMIT — serialises concurrent fly-creates
          // for the same (businessId, name, phone) triple across imports.
       b. const existing = await tx.party.findFirst({...})
          if (existing) partyId = existing.id
          else {
            const newParty = await createPartyTx(tx, businessId, partyData,
              { importJobId: jobId, importedBy: auth.userId })
            partyId = newParty.id
          }
       // ARCH M5: lock + post-lock findFirst defeats the race window
       // where two concurrent chunks both saw "no party" pre-snapshot.

    2. const doc = await tx.document.create({
         data: {
           businessId, type: 'SALE_INVOICE', partyId,
           documentNumber, documentDate,
           subtotal, cgstAmount, sgstAmount, igstAmount, cessAmount, grandTotal,
           createdBy: userId, importJobId: jobId, importedBy: userId,
         },
         select: { id: true, documentNumber: true, grandTotal: true },
       })

    3. await tx.documentLineItem.createMany({
         data: lines.map((l, idx) => ({
           documentId: doc.id, productId: l.resolved.productId, sortOrder: idx,
           quantity: l.qty, rate: l.rate, lineTotal: l.lineTotal, taxableValue: l.taxable,
           cgstRate: l.cgstRate, cgstAmount: l.cgstAmount,
           sgstRate: l.sgstRate, sgstAmount: l.sgstAmount,
           igstRate: l.igstRate, igstAmount: l.igstAmount,
           cessRate: l.cessRate, cessAmount: l.cessAmount,
           hsnCode: l.hsnCode ?? null,
         })),
       })

    4. await tx.importJob.update({
         where: { id: jobId },
         data: { committedRowCount: { increment: 1 } },
       })
       // ARCH S2: this UPDATE serialises rows of the same job within the
       // chunk tx (single-row write to ImportJob). Across chunks, the
       // one-job-per-business cap (active-job gate) prevents two chunks
       // from contending on the same ImportJob row. Documented assumption.

    5. const guarded = await tx.importJobRow.updateMany({
         where: { id: row.id, status: 'STAGED', createdEntityId: null },
         data: { status: 'COMMITTED', createdEntityId: doc.id },
       })
       if (guarded.count === 0) {
         // A concurrent commit raced; ROLL BACK the entire chunk tx via throw.
         // Re-attempt picks up via the createdEntityId IS NULL filter in P0 findMany.
         throw new AppError('CONCURRENT_COMMIT_RACE', 409, ...)
       }

    6. (Per-invoice audit emit removed — see step 7 batched emit, ARCH S1.)

CHUNK-WIDE FINAL STATEMENT (ARCH S1 — batched audit, symmetric with 7.1B):

  7. await tx.auditLog.create({
       data: {
         action: 'invoices.imported_batch',
         businessId, actorUserId: userId,
         payload: {
           importJobId: jobId,
           documentIds: [...],        // one entry per committed invoice
           documentNumbers: [...],    // parallel array
           partyIds: [...],           // parallel array
           grandTotals: [...],        // parallel array (Int paise)
           sourceIndices: [...],      // parallel array
         },
       },
     })
     // Per-invoice provenance reconstructable by joining the parallel arrays
     // OR by querying Document WHERE importJobId = jobId.

COMMIT (the outer chunk tx).
```

**Why party-create is step 1 and not earlier (chunk pre-flight)**: fly-create
is a side-effect that must roll back atomically with the chunk on failure.
If we batched all fly-creates at chunk start without per-invoice ordering,
a mid-chunk crash would leak partial fly-creates. Per-invoice ordering
inside the chunk tx keeps the rollback boundary aligned with the chunk
boundary — exactly what the per-chunk-tx topology requires.

**Why ImportJob counter update is step 4 (before status flip)**: the
counter rolls back with the tx, so it's correct after a chunk-wide
rollback. ARCH S2 documents the serialisation assumption.

**The `createdEntityId` guard at step 5 is load-bearing**. Without it, a
double-commit scenario could create two `Document` rows for the same
source invoice (the `@@unique([businessId, type, documentNumber])` would
catch most, but `documentNumber=NULL` cases or case-variant numbers escape).

### §6.4 ARCH S1 fold — batched audit (override of SCOPE L52-53)

SCOPE L52-53 specifies `invoices.imported` **per invoice**. We override to
`invoices.imported_batch` **per chunk** for symmetry with 7.1B
(`product.imported_batch` — see `commit-products.service.ts:215-245`):

- **Volume control:** 200 invoices/chunk × 1 audit row = 1 audit row/chunk,
  vs 200 audit rows/chunk in the per-invoice model. ~200× reduction in
  audit-pipeline write amplification on large imports.
- **Per-invoice provenance preserved:** the batch payload carries parallel
  arrays `documentIds[] | documentNumbers[] | partyIds[] | grandTotals[] |
  sourceIndices[]`. Any consumer can reconstruct per-invoice provenance by
  index or by joining `Document.importJobId = jobId`.
- **Audit-coverage expected-keys update:** `scripts/enforce-audit-coverage.mjs`
  expects `invoices.imported_batch` (not `invoices.imported`) for
  `entity='invoice'` commits. File Plan #27 updated accordingly.
- **Acceptance addendum:** integration #1 asserts both (a) one
  `invoices.imported_batch` row per chunk with arrays length = committed
  count, and (b) per-invoice reconstruction works via `Document.importJobId`
  join.

---

## §7 Pathology table — 13 rows (ARCH M5 adds row #13)

| # | Pathology | Defence | Test location |
|---|---|---|---|
| 1 | Malformed Tally voucher (missing `<PARTYNAME>` or `<DATE>`) | Parser emits row with issues; aggregator marks group ERROR; commit-blocked? No — only `PRODUCT_NOT_FOUND` blocks. User drops row. | `parsers-invoices.test.ts` |
| 2 | Multi-line same `invoiceNumber` different `invoiceDate` | Aggregator key includes date → produces **two** groups with same number; second hits `DUPLICATE_EXACT` against the first within file (`INTRA_FILE_DUPLICATE`). Both rows surface to UI for user decision. | `invoice-aggregator.test.ts` |
| 3 | Negative line total (refund mis-classified as invoice) | `narrowPaiseToInt(paise, ...)` returns `{error:'AMOUNT_NEGATIVE'}`; row ERROR with credit-note copy. AUDIT S3 resolution. | `tax-reconciler.test.ts` + integration |
| 4 | Overflow `> 2^31-1` paise (Rs 2.14 crore+ invoice) | `narrowPaiseToInt` returns `AMOUNT_OUT_OF_RANGE`; row ERROR with split-invoice copy. Resolved Decision #11. | `tax-reconciler.test.ts` |
| 5 | Tax-math mismatch 18% computed vs 0% reported | `tax-reconciler` produces 51+ paise diff → `TAX_MATH_MISMATCH` WARNING (not error — source-of-record fidelity). Invoice still commits with source totals. | `tax-reconciler.test.ts` (7-case suite) |
| 6 | Party-name collision intra-file (two rows in same file, same name+phone) | Both rows resolve via per-chunk preload to **the same** resolved `partyId` if existing, or — in fly-create — invoice 1's party-create runs first (inside the same chunk tx, sequentially), invoice 2's snapshot lookup post-lock sees the row-1 INSERT and reuses the id. **Test:** seed no party, upload file with two invoices for "Raju Traders / 9999999990" → assert exactly 1 Party row, both Documents reference it. | `import-invoices.test.ts` #6 |
| 7 | Product SKU not found mid-chunk | Pre-flight (step P3, post P2.5 re-resolve) finds it; throws `COMMIT_BLOCKED_PRODUCT_NOT_FOUND` BEFORE any Document INSERT. **No half-commit.** | integration #4 |
| 8 | Mid-tx crash between Document INSERT (step 2) and DocumentLineItem createMany (step 3) | Chunk tx rolls back: zero Document, zero lines persist across the whole chunk. All `ImportJobRow`s in chunk stay `STAGED`. Retry pre-scan picks them up. **Exactly-once Document.** | integration #3 |
| 9 | `clientVersion=7.1.1` (below 7.1.2 floor for invoices) | `requireMinClientVersion('7.1.2')` middleware for invoice routes returns `426 UPGRADE_REQUIRED`. Resolves AUDIT S2. | `client-version.test.ts` |
| 10 | Duplicate `Idempotency-Key` replay (504 mid-response, client retries) | 7.1A `idempotencyCheck` middleware returns the cached prior response — zero new Documents. | integration #2 (reused from 7.1B) |
| 11 | Basis-point rounding edge (18% of `333` paise = `59.94` paise) | Source-provided `cgstAmount` is preserved as-is (Int paise). Tax-reconciler diff is +0.06 paise per line → 0 cumulative on tolerance. No warning. | `tax-reconciler.test.ts` edge case |
| 12 | Future-date 100yr (`"2125-03-15"`) | Date parser is syntactic; ISO format accepted; iso = `"2125-03-15"`. **No semantic future-date rejection in 7.1C** — that would be a separate business-rule layer not in scope. Test asserts the parser returns OK. | `date.util.test.ts` |
| 13 (ARCH M5) | **Two parallel POST /commit for the same job — fly-create race** | Both chunk-txs hit step 1a `pg_advisory_xact_lock` on `(party-fly-create, hashtextextended(businessId|lower(name)|phone))`. Lock is xact-scoped — second waiter blocks until first chunk COMMITS or ROLLS BACK. First commits, second's post-lock `findFirst` returns the freshly-inserted party; no second INSERT. **Assert exactly 1 Party row** under parallel commit (2 concurrent HTTP POST). | `import-invoices.test.ts` #13 |

---

## §8 File Plan — HARD GATE (ARCH M2 adds row 22, ARCH S3 updates row 49)

Every row ≤ 250L. Build phase ordering: API.0 → API.6 → FE.1 → FE.3.

### Backend (`server/`)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 1 | `prisma/schema.prisma` | edit | ~10 | schema | API.0 |
| 2 | `prisma/migrations/<ts>_invoice_import_expand/migration.sql` | create | ~15 | migration | API.0 |
| 3 | `src/types/import.types.ts` | edit | ~50 | types | API.1 |
| 4 | `src/constants/import.constants.ts` | edit | ~25 | constants | API.1 |
| 5 | `src/schemas/import.schemas.ts` | edit | ~30 | schema | API.1 |
| 6 | `src/services/import/normalizers/date.util.ts` | create | ~200 | utils (pure) | API.2 |
| 7 | `src/services/import/normalizers/invoice-aggregator.ts` | create | ~180 | service | API.2 |
| 8 | `src/services/import/normalizers/tax-reconciler.ts` | create | ~90 | utils (pure) | API.2 |
| 9 | `src/services/import/normalizers/amount-narrow.util.ts` (`narrowPaiseToInt`) | create | ~45 | utils (pure) | API.2 |
| 10 | `src/services/import/normalizers/invoice-normalizer.ts` (orchestrates aggregator + tax-reconciler + amount-narrow + resolver outputs) | create | ~240 | service | API.2 |
| 11 | `src/services/import/parsers/tally-xml.parser.ts` | edit | ~70 | service | API.3 |
| 12 | `src/services/import/parsers/vyapar-csv.parser.ts` | edit | ~50 | service | API.3 |
| 13 | `src/services/import/parsers/busy-xlsx.parser.ts` | edit | ~55 | service | API.3 |
| 14 | `src/services/import/parsers/generic-csv.parser.ts` | edit | ~40 | service | API.3 |
| 15 | `src/services/import/parsers/index.ts` (entity-aware dispatch — invoice branch + `ImportEntity` union extend) | edit | ~20 | service | API.3 |
| 16 | `src/services/import/resolvers/invoice-party-resolver.ts` | create | ~140 | service | API.3 |
| 17 | `src/services/import/resolvers/invoice-product-resolver.ts` (incl. `reResolveProductsInPlace` for ARCH M6) | create | ~140 | service | API.3 |
| 18 | `src/services/import/dedup/invoice-exact-dedup.ts` (case-insensitive `(documentNumber, documentDate)`) | create | ~110 | service | API.3 |
| 19 | `src/services/import/dedup/index.ts` (extend dispatcher) | edit | ~15 | service | API.3 |
| 20 | `src/services/import/commit-invoices.service.ts` (chunk tx, statement order §6, advisory lock per ARCH M5, batched audit per ARCH S1) | create | ~240 | service | API.4 |
| 21 | `src/services/import/commit-dispatcher.ts` (extend `ImportEntity = 'parties' \| 'product' \| 'invoice'` + `case 'invoice'` return `commitChunkInvoices`) | edit | ~10 | service | API.4 |
| **22** | **`src/services/party/create-tx.ts` (NEW — tx-injectable variant per ARCH M2; canonical body relocated here)** | **create** | **~80** | **service** | **API.4** |
| 23 | `src/services/party/create.ts` (REFACTOR — delegates to `createPartyTx` via `prisma.$transaction`) | edit | ~25 | service | API.4 |
| 24 | `src/services/import/commit.service.ts` (commit-blocked-product-not-found sentinel surfaces from chunk throw) | edit | ~20 | service | API.4 |
| 25 | `src/services/import/audit-emit.ts` (add `emitInvoicesImportedBatch` — ARCH S1) | edit | ~30 | service | API.4 |
| 26 | `src/lib/enum-guard.ts` (no-op comment + assertion stub per §4) | edit | ~15 | utils | API.4 |
| 27 | `src/routes/imports/create.route.ts` (Zod adds `'invoice'`; per-entity min-client-version branch) | edit | ~15 | route | API.5 |
| 28 | `src/routes/imports/get.route.ts` (polymorphic normalized shape — invoice nested lines) | edit | ~10 | route | API.5 |
| 29 | `scripts/enforce-audit-coverage.mjs` (add `invoices.imported_batch` — ARCH S1) | edit | ~3 | script | API.5 |
| 30 | `tests/fixtures/import/invoices/tally-sample.xml` (5 vouchers × ~3 lines avg) | create | n/a | fixture | API.6 |
| 31 | `tests/fixtures/import/invoices/vyapar-sample.csv` | create | n/a | fixture | API.6 |
| 32 | `tests/fixtures/import/invoices/busy-sample.xlsx` (SalesRegister sheet) | create | n/a | fixture | API.6 |
| 33 | `tests/fixtures/import/invoices/generic-sample.csv` (12 lines × 5 invoices flat) | create | n/a | fixture | API.6 |
| 34 | `tests/unit/import/date.util.test.ts` (8-case + future-100yr suite) | create | ~120 | test | API.6 |
| 35 | `tests/unit/import/invoice-aggregator.test.ts` (4-case suite) | create | ~110 | test | API.6 |
| 36 | `tests/unit/import/tax-reconciler.test.ts` (7-case suite) | create | ~130 | test | API.6 |
| 37 | `tests/unit/import/amount-narrow.util.test.ts` (negative/overflow/boundary) | create | ~70 | test | API.6 |
| 38 | `tests/unit/import/parsers-invoices.test.ts` (4 formats × happy/malicious — XXE/zip-bomb reused from 7.1A) | create | ~180 | test | API.6 |
| 39 | `tests/unit/import/invoice-product-resolver.test.ts` (ARCH M6 — stale-snapshot re-resolve) | create | ~80 | test | API.6 |
| 40 | `tests/unit/services/party/create-tx.test.ts` (ARCH M2 — `createParty()` still tx-wraps after refactor; `createPartyTx` accepts external tx + opts) | create | ~90 | test | API.6 |
| 41 | `tests/integration/import-invoices.test.ts` (13-scenario suite — see §11) | create | ~260 | test | API.6 |
| 42 | `src/lib/translations.en.ts` (`import.invoice.*` ≈ 25 keys) | edit | ~50 | translation | FE.1 |
| 43 | `src/lib/translations.hi.ts` | edit | ~50 | translation | FE.1 |

### Frontend (`src/features/import/`)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 44 | `src/features/import/types/import.types.ts` (extend with `NormalizedInvoice` + `InvoiceIssueCode` union) | edit | ~40 | types | FE.1 |
| 45 | `src/features/import/constants/import.constants.ts` (invoice format labels) | edit | ~15 | constants | FE.1 |
| 46 | `src/features/import/services/import.service.ts` (`entityLabel: \`Invoices: \${fileName}\``) | edit | ~10 | service | FE.1 |
| 47 | `src/features/import/components/EntityPicker.tsx` (add "Import Invoices" tile) | edit | ~25 | sub-component | FE.2 |
| 48 | `src/features/import/components/FormatPicker.tsx` (invoice-entity copy + 4 format options) | edit | ~20 | sub-component | FE.2 |
| 49 | `src/features/import/components/PartyResolutionToggle.tsx` (NEW radio — MATCH_OR_FLY_CREATE / REQUIRE_PARTIES_FIRST) | create | ~80 | sub-component | FE.2 |
| 50 | `src/features/import/components/InvoiceRowCard.tsx` (NEW — header + collapsed-by-default line preview; tap chevron to expand; party/product/issue chips) | create | ~200 | sub-component | FE.2 |
| 51 | `src/features/import/components/InvoiceLinesAccordion.tsx` (NEW — expanded line list, virtualised if N>20) | create | ~140 | sub-component | FE.2 |
| 52 | `src/features/import/components/CommitBlockedBanner.tsx` (NEW — PRODUCT_NOT_FOUND deep-link `/import?entity=product&resumeImportJobId=${currentJobId}` per ARCH S3) | create | ~95 | sub-component | FE.2 |
| 53 | `src/features/import/components/PreviewRowCard.tsx` (delegate to `InvoiceRowCard` when entity='invoice') | edit | ~15 | sub-component | FE.2 |
| 54 | `src/features/import/components/PreviewTable.tsx` (entity-aware column headers — invoice has Number · Date · Party · Lines · Total) | edit | ~25 | sub-component | FE.2 |
| 55 | `src/features/import/pages/ImportUpload.tsx` (party-resolution toggle in upload step when entity='invoice') | edit | ~30 | page | FE.3 |
| 56 | `src/features/import/pages/ImportJobPage.tsx` (commit CTA disabled state when CommitBlockedBanner shows; summary link `/invoices?importJobId=`; reads `?resumeImportJobId=` to surface "← Back to invoice import" CTA when on product summary, per ARCH S3) | edit | ~35 | page | FE.3 |
| 57 | `src/features/import/import.css` (invoice-row layout, accordion chevron, token-only) | edit | ~40 | css | FE.3 |

**Totals (production code, excluding tests/fixtures):**

Rows 6-10, 16-18, 20, 22, 25 (new files):
200 + 180 + 90 + 45 + 240 + 140 + 140 + 110 + 240 + 80 + 30 = **1495L**.

Architect judgement: 7.1C is closer in surface area to 7.1B (~1800L) than
to a small slice. Documented as deliberate overrun against the 900L brief
target. Reverse decision (collapse resolvers into one file) rejected on
one-responsibility-per-file grounds.

Largest single new file: `invoice-normalizer.ts` /
`commit-invoices.service.ts` at 240L (under 250L cap). Largest test file:
`import-invoices.test.ts` at 260L (10L over cap — split into
`import-invoices.test.ts` + `import-invoices-race.test.ts` if PR-C3 review
flags it; the 13th scenario is the natural split point).

**Build-phase ordering:**

- **API.0** schema + migration A (high-risk-path gate first).
- **API.1** types / constants / Zod / translations skeleton.
- **API.2** pure utils + normalizer + tax-reconciler + amount-narrow + date.util + aggregator.
- **API.3** parsers + resolvers + dedup.
- **API.4** commit-invoices + dispatcher extension + **party create-tx refactor (ARCH M2)** + commit.service sentinel + audit emit + enum-guard comment.
- **API.5** routes + audit-coverage script.
- **API.6** fixtures + unit + integration tests.
- **FE.1** types/constants/service/translations.
- **FE.2** sub-components.
- **FE.3** pages + css.

First build-agent action: `git status` on the 57 paths, then scaffold
empty stubs (imports + exports only) for every `create` row before any
logic. **Important:** API.4 refactor of `services/party/create.ts`
(row 23) MUST land in the same PR as row 22 (`create-tx.ts`); split
would leave the codebase compileless for the gap.

---

## §9 FE plan — diff against 7.1B

### Entity picker (File Plan #47)

`EntityPicker.tsx` already renders Parties + Products tiles (7.1B). Add a
third tile "Import Invoices" with the same `<Card>` + `<Button
variant="primary">` shell. Route: `/import/upload?entity=invoice`.

### `<InvoiceRowCard>` (NEW, File Plan #50)

Header row (always visible):

| Column | Source | Display |
|---|---|---|
| Number | `normalized.documentNumber` | bold, `tabular-nums` |
| Date | `normalized.documentDate` | `formatDate(iso, locale)` |
| Party | `normalized.partyResolved.source.name` + party chip | `<PartyAvatar/>` + name; chip = `EXISTING` / `FLY_CREATE` / `NAME_ONLY` |
| Lines | `normalized.lines.length` | "3 items" + chevron |
| Total | `normalized.grandTotalPaise` | `formatCurrency(paise)` (Indian format) |
| Issues | `row.issues` | chips `<Badge variant="error\|warning">` per code |

Collapsed by default; tap chevron → `<InvoiceLinesAccordion>` (File Plan #51)
expands with per-line: SKU · Product name · Qty + unit · Rate · Line total ·
per-line chips (e.g. `PRODUCT_NOT_FOUND` on the offending line).

Mobile (< md): full-width card. Tablet+: 2-col grid as in 7.1B
`PreviewTable`. Accordion uses `<Accordion>` primitive
(PAGE_AUDIT_CHECKLIST C) — no custom expand UI.

Touch target ≥44px on chevron. Dark-mode parity via tokens (no `dark:`
classes per PLATFORM_SHELL guidance).

### `<CommitBlockedBanner>` (NEW, File Plan #52 — ARCH S3)

Renders above the preview list when the chunk pre-flight returned
`COMMIT_BLOCKED_PRODUCT_NOT_FOUND` (or when local row-issue scan finds
ANY `PRODUCT_NOT_FOUND`). Copy:

> **{count} product SKUs not found.** Import these products first or drop
> the affected invoices.
> [**Import Products**] — deep-link to
> `/import?entity=product&resumeImportJobId=${currentJobId}`

Disables the "Commit Import" CTA — `<Button disabled aria-disabled="true">`.
The CommitBlockedBanner is the **only** way to disable the CTA — keeps
the rule mechanical.

**ARCH S3 round-trip:** on the product-import summary page
(`ImportJobPage.tsx` for `entity='product'`), if the URL carries
`?resumeImportJobId=<id>`, render a top-of-page CTA:

> **← Back to invoice import** — return to invoice import `<short-id>`
> (deep-links to `/import/job/<resumeImportJobId>?entity=invoice`)

Lets the user finish products and return to the still-staged invoice job
without losing context.

### `<PartyResolutionToggle>` (NEW, File Plan #49)

Two-radio group, visible only when entity='invoice', placed below the file
drop-zone on `ImportUpload.tsx`:

- `MATCH_OR_FLY_CREATE` (default) — copy: *"Auto-create unknown parties."*
- `REQUIRE_PARTIES_FIRST` — copy: *"Skip rows whose party isn't in your list."*

Selection sent in `POST /api/imports` body field `partyResolutionMode`.

### Offline contract (unchanged from 7.1B §9)

`entityType: 'import'`, `entityLabel: \`Invoices: \${fileName}\``,
`excludeFromOfflineQueue: true`. Mutation handlers tolerate `{}` return
per OFFLINE_RULES Rule 5.

---

## §10 PR sequence — 6 independently-mergeable PRs

| PR | Title | Files (from §8) | Gate |
|----|---|---|---|
| **PR-C0** | `feat(import): invoice schema + migration A (expand-only)` | 1, 2 | Migration runs on shadow DB; tsc clean on schema; PR-C0 lands behind `FEATURE_DATA_IMPORT=false` so the two nullable columns are inert until PR-C4 enables the route. **High-risk-path approved plan required.** |
| **PR-C1** | `feat(import): commit-dispatcher invoice branch + types/constants/zod/utils + party create-tx refactor` | 3, 4, 5, 9, 21, **22, 23**, 26, 29, 40 | tsc clean; `commit-dispatcher.test.ts` adds `entity='invoice'` case; `narrowPaiseToInt` unit test (#37) passes; `create-tx.test.ts` (#40) green — `createParty()` still tx-wraps; no behaviour change yet (commit-invoices stub throws `NOT_IMPLEMENTED`). |
| **PR-C2** | `feat(import): invoice parsers + normalizer + aggregator + date parser` | 6, 7, 8, 10, 11, 12, 13, 14, 15, 30-37, 38 | All unit suites pass: date.util (8+1), aggregator (4), tax-reconciler (7), amount-narrow, parsers-invoices (4×happy+malicious). No DB writes. |
| **PR-C3** | `feat(import): party + product resolvers + commit-invoices (chunk tx) + batched audit + dedup` | 16, 17, 18, 19, 20, 24, 25, 39, 41 | Integration #1-#13 (§11) pass — incl. ARCH M5 parallel-commit test #13; `enforce-audit-coverage --block` clean (`invoices.imported_batch`); mid-tx crash recovery test green; tenant isolation tests green; stale-snapshot re-resolve test (#39) green. |
| **PR-C4** | `feat(import): routes accept entity='invoice' + per-entity min-client-version` | 27, 28 | Route Zod accepts new entity; `requireMinClientVersion` returns 426 for 7.1.1; integration end-to-end runs through routes. **Server-side feature gate flips on for cohort=0** (still disabled in prod). |
| **PR-C5** | `feat(import): FE EntityPicker invoice tile + InvoiceRowCard + CommitBlockedBanner` | 42-57 | Screenshots × 4 UI states; 320px no overflow; LCP <2.5s on the preview page; per-route chunk ≤100KB gz; enforce-offline clean; PAGE_AUDIT_CHECKLIST A-N pass; ARCH S3 deep-link round-trip manually verified. |

Each PR ships **behind the existing `FEATURE_DATA_IMPORT` flag** (cohort=0).
PR-C5 is the visibility flip; the flag itself doesn't change until pilot.

---

## §11 Acceptance gates

`tsc -b --noEmit` clean, `node scripts/enforce.js` 0 errors,
`node scripts/enforce-audit-coverage.mjs --block` exit 0,
`node scripts/enforce-offline.mjs` exit 0.

### Unit tests (must all pass — green CI)

- `tests/unit/import/date.util.test.ts` — 8 SCOPE cases + future-100yr = 9 cases
- `tests/unit/import/invoice-aggregator.test.ts` — 4 SCOPE cases
- `tests/unit/import/tax-reconciler.test.ts` — 7 SCOPE cases
- `tests/unit/import/amount-narrow.util.test.ts` — 4 cases: 0n OK, 2_147_483_647n OK, 2_147_483_648n → OUT_OF_RANGE, -1n → NEGATIVE
- `tests/unit/import/parsers-invoices.test.ts` — 4 formats × happy + 2 malicious (XXE + zip-bomb reused from 7.1A)
- **`tests/unit/import/invoice-product-resolver.test.ts` (ARCH M6)** — 3 cases: (a) stale `NOT_FOUND` re-resolves to `BY_SKU` after fresh snapshot includes the SKU; (b) still-missing SKU remains `NOT_FOUND`; (c) `BY_NAME` re-resolution.
- **`tests/unit/services/party/create-tx.test.ts` (ARCH M2)** — 4 cases: (a) `createPartyTx(tx, businessId, data, {})` inserts on supplied tx; (b) with `{ importJobId, importedBy }` populates Party columns; (c) `createParty()` legacy signature wraps its own tx (verified via spy on `prisma.$transaction`); (d) STAFF guard still rejects.

### Integration suite — `tests/integration/import-invoices.test.ts`

13 scenarios (single ~260L file — split candidate noted in §8):

1. **50-row CSV happy path** — Generic CSV 50 rows aggregated to ~15 invoices → preview → commit → assert 15 `Document` rows + ~50 `DocumentLineItem` rows + 1 `import_job.committed` audit + **1 `invoices.imported_batch` audit per chunk with arrays length matching committed count (ARCH S1)** + `importJobId`+`importedBy` columns populated on Documents. Also assert per-invoice provenance reconstructable via `Document.importJobId = jobId` join.
2. **Idempotent commit replay** — same `Idempotency-Key` + `commitToken` → cached response, row counts unchanged.
3. **Mid-tx crash recovery** — kill `pg` connection mid-chunk after Document INSERT for invoice 5, before lines `createMany`. Retry. Exactly 1 Document with N lines exists for that source row, and chunk's other 4 invoices ALSO retry cleanly (chunk-wide rollback, ARCH M1).
4. **Commit-blocked sentinel (PRODUCT_NOT_FOUND)** — upload with an unknown SKU → preview shows row ERROR → POST commit → `409 COMMIT_BLOCKED_PRODUCT_NOT_FOUND` with `missingSkuSample`.
5. **Fly-create routes through `createPartyTx()` (ARCH M2)** — seed no party, upload, assert (a) Party row carries `importJobId`+`importedBy`, (b) `createParty()` legacy path remains tx-wrapped — assert via separate POST /api/parties call in same test that hits `prisma.$transaction` (spy or telemetry).
6. **Same-name-phone collision intra-file** — two invoices for "Raju / 9999..." with no pre-existing party → exactly 1 Party row created, both Documents reference it.
7. **Cross-tenant party resolution** — business A uploads, business B has party "Raju" — resolver returns NOT_FOUND for A (despite identical name in B). Debug-build companion: remove `businessId=$1` → test fails.
8. **Cross-tenant product resolution** — same as #7 for Product/SKU.
9. **Tax-math mismatch surfaces as WARNING but commits** — 51-paise diff → preview WARNING chip → commit succeeds → Document stores SOURCE-REPORTED `grandTotal`, not computed.
10. **Amount overflow + negative split (AUDIT S3)** — row with `lineTotal=2_200_000_000` paise → ERROR `AMOUNT_OUT_OF_RANGE`; row with `lineTotal=-1` → ERROR `AMOUNT_NEGATIVE`. Two distinct chips, two distinct copy keys.
11. **`clientVersion=7.1.1` rejected (AUDIT S2)** — POST `/api/imports` with `entity='invoice'` clientVersion `7.1.1` → `426 UPGRADE_REQUIRED`. Same upload with `entity='product'` clientVersion `7.1.1` → 200 (per-entity gate).
12. **DPDP uploader erasure** — uploader requests erasure → `ImportJob.fileName` NULL → `Document.importedBy` NULL (FK SetNull) → fly-created Party row **preserved** (Document.partyId FK Restrict blocks party delete), AND `Party.importedBy` also goes NULL via FK SetNull. Audit row `data_principal.erased` written.
13. **Parallel commit fly-create race (ARCH M5)** — seed no party. Fire 2 concurrent `POST /api/imports/:id/commit` for the same job (using same Idempotency-Key would fail #2; use different per-request keys to bypass replay cache). One advances first under `pg_advisory_xact_lock`; second waits; second's post-lock `findFirst` sees the row. **Assert exactly 1 Party row created** (count via `SELECT count(*) FROM "Party" WHERE name='Raju Traders' AND businessId=$1`).

### FE acceptance gates (PR-C5)

- Screenshots × 4 UI states on `InvoiceRowCard` collapsed + expanded
- 320px no horizontal overflow on `<InvoiceLinesAccordion>` expanded with 12 lines
- LCP < 2.5s on preview page with 200-invoice payload
- Per-route chunk gzipped ≤ 100KB (`InvoiceLinesAccordion` lazy-loaded)
- PAGE_AUDIT_CHECKLIST A-N pass — token-only colors, no `z-50` literals, all strings in en+hi
- Dark-mode parity (auto via tokens)
- **ARCH S3 deep-link round-trip** — manual: from invoice preview with PRODUCT_NOT_FOUND, tap "Import Products"; complete product import; assert product summary shows "← Back to invoice import" CTA; tap; lands on invoice job page with state preserved.

---

## §12 SCOPE Conformance Map — HARD GATE

| SCOPE decision (line ref) | Architecture artifact | Status |
|---|---|---|
| 4 source formats with invoice branch (L37) | §2.1 + File Plan #11-#15 | OK |
| Reuse `ImportJob`/`ImportJobRow` with `entity='invoice'` (L38) | §3 + §1 inheritance + Zod #5 | OK |
| Multi-line aggregation by `(invoiceNumber + invoiceDate)` (L39) | §2.2 + File Plan #7 | OK |
| Aggregation runs **in normalize phase** (AUDIT S4) | §2.2 explicit ordering paragraph | OK |
| FK resolution single-roundtrip per chunk (L40, L286-301) | §2.6 + §2.7 + File Plan #16, #17 | OK |
| Party resolution MATCH_OR_FLY_CREATE default + REQUIRE_PARTIES_FIRST opt-in (L41) | §2.6 + FE #49 PartyResolutionToggle | OK |
| Fly-create routes through canonical create path (L41-42) | §2.6 + File Plan #22 `createPartyTx` + §6 step 1 + integration test #5 | OK |
| Product resolution strict, no auto-create (L43) | §2.7 + commit-blocked sentinel §2.8 | OK |
| Tax-math ±50 paise tolerance + source-of-record fidelity (L44, L368-380) | §2.4 + File Plan #8 + integration #9 | OK |
| Date parsing hand-rolled + NFKC + ASCII-only + 32-char cap (L45, L312-343) | §2.3 + File Plan #6 | OK |
| Money in Int paise — `Document.grandTotal Int` (L46) | §2.5 + File Plan #9 + schema verified | OK |
| Dedup exact `(documentNumber, documentDate)` case-insensitive (L47) | File Plan #18 + §4 precondition #3 | OK |
| Resolutions SKIP \| CREATE_NEW only, no OVERWRITE (L48) | Inherits 7.1B `commit.resolutions.ts`; invoice branch rejects OVERWRITE in Zod | OK |
| Chunked commit 200 invoices/tx, per-row tx (L49 — Resolved Decision #15) | §2.8 + §6 — **architecture overrides to per-chunk tx**; documented in Deviations §13 + integration #3 | DEVIATED |
| Idempotent via commitToken + Idempotency-Key + row-level guard (L50) | §6 step 5 + §1 inheritance | OK |
| Business-scoped tenancy `req.activeBusiness.id` (L51) | §1 middleware inherit + §2.6/2.7 queries include `WHERE businessId = $1` | OK |
| Security envelope reused (L52) | §1 row 1 + integration #7, #8 | OK |
| Audit coverage + `invoices.imported` per invoice (L53) | **Architecture overrides to `invoices.imported_batch` per chunk (ARCH S1)** — per-invoice provenance preserved via parallel arrays + `Document.importJobId` join; §6.4 + File Plan #25, #29 + integration #1 | DEVIATED |
| FE wizard adds Invoice tile + InvoiceRowCard + nested line preview (L54) | §9 + File Plan #47, #50, #51 | OK |
| Commit CTA disabled on PRODUCT_NOT_FOUND (L54) | §9 CommitBlockedBanner + §2.7 + integration #4 | OK |
| Fixture set 4 formats × 5-invoice/12-line (L55) | File Plan #30-#33 | OK |
| Generic CSV header dictionary (L56-57) | §2.1 generic-csv row + File Plan #14 | OK |
| Per-row error CSV download (L58) | §1 row 11 (M4 inherited) | OK |
| Tally CGST/SGST/IGST ledger heuristic (L59) | §2.1 Tally row + File Plan #11 (~70L includes heuristic) | OK |
| Resolved Decisions #1-#21 (L122-148) | Each cited in §2-§6; see Failure-Mode table below for #1-#7 mitigations | OK |
| Resolved Decision #5 — fly-created parties carry `importJobId`+`importedBy` | §4 precondition #8 (live schema:475-499) + §2.6 `createPartyTx` opts + integration #5, #12 | OK |
| `Document.documentNumber` nullable — dedup filters NOT NULL (Schema precondition L226) | §4 precondition #3 | OK |
| `Document @@unique([businessId, type, documentNumber])` exists (L227) | §4 precondition #4 | OK |
| `DocumentLineItem.productId` FK Restrict — resolve before INSERT (L228-229) | §4 precondition #5 + commit-blocked sentinel | OK |
| Migration A additive only (L242-250) | §3 + File Plan #1, #2 | OK |
| No GIN trgm — no near-dedup for invoices (L252) | §3 last paragraph + Resolved Decision #8 | OK |
| Statement order in per-row tx (L260-269) | §6 — **architecture refactors to per-chunk-tx statement order**; documented in Deviations §13 | DEVIATED |
| Three-layer idempotency (L275-279) | §6 step 5 + §1 inheritance | OK |
| Mid-tx crash integration test (L281) | §11 integration #3 (chunk-wide rollback per ARCH M1) | OK |
| FK resolution preload SQL (L287-301) | §2.6 + §2.7 SQL blocks verbatim | OK |
| Tenant scoping mandatory + integration test (L307) | §2.6/2.7 + integration #7, #8 | OK |
| No trgm/fuzzy for invoices (L309) | §3 closing paragraph | OK |
| Date parser hand-rolled state machine + 4 formats (L319-326) | §2.3 + File Plan #6 + test #34 | OK |
| NFKC + non-ASCII reject + 32-char cap (L329-332) | §2.3 code block | OK |
| 8-case date test suite (L335-343) | §2.3 + File Plan #34 + §11 unit | OK |
| Aggregator algorithm (L351-355) | §2.2 + File Plan #7 + test #35 | OK |
| Aggregator 4-case suite (L358-362) | File Plan #35 + §11 unit | OK |
| Tally pre-aggregated short-circuit (L363) | §2.2 last sentence | OK |
| Tax-reconciler formula (L370-376) | §2.4 code block | OK |
| Tax-math 7-case suite (L383-389) | File Plan #36 + §11 unit | OK |
| AUDIT S1 — HEADER_MISMATCH_WITHIN_INVOICE + PARTY_NAME_ONLY_MATCH in union | §5 + File Plan #3 + emit sites §2.2, §2.6 | OK |
| AUDIT S2 — clientVersion floor 7.1.2 for invoice entity | §1 row 4 + §5 + integration #11 | OK |
| AUDIT S3 — split AMOUNT_OUT_OF_RANGE / AMOUNT_NEGATIVE | §2.5 + §5 + File Plan #9 + integration #10 | OK |
| AUDIT S4 — aggregation runs in normalize phase, explicit | §2.2 first paragraph | OK |
| AUDIT S5 — Document.type pg_enum/text decision + boot assertion | §4 + File Plan #26 enum-guard comment | OK |
| `?importJobId=` filter on `/api/invoices` (L89) | Reuses existing products filter pattern; 5-line edit to `/api/invoices` route — intentionally not in File Plan (mechanical) | DEVIATED |
| **ARCH M1** — nested tx invalid; pick topology | §2.8 + §6 chosen per-chunk tx; trade-off documented | OK |
| **ARCH M2** — `createParty()` path/signature wrong | §2.6 + File Plan #22 `create-tx.ts` (NEW) + #23 refactor | OK |
| **ARCH M3** — Party `importJobId`/`importedBy` migration | §4 precondition #8 — already live in schema:475-499 (7.1A); cited, not re-added | OK |
| **ARCH M4** — `ImportEntity` union + `ChunkResult` shape compat | File Plan #21 (`'parties' \| 'product' \| 'invoice'`) + §2.8 `ChunkResult` shape verbatim with JSDoc on misnomer | OK |
| **ARCH M5** — fly-create per-row advisory lock | §2.6 + §6 step 1a + integration #13 | OK |
| **ARCH M6** — stale product resolution re-resolve | §6 P2.5 + File Plan #17 `reResolveProductsInPlace` + unit test #39 | OK |
| **ARCH S1** — batched audit emit `invoices.imported_batch` | §6.4 + File Plan #25, #29 + integration #1 | OK |
| **ARCH S2** — ImportJob counter serialisation documented | §6 step 4 comment | OK |
| **ARCH S3** — CommitBlockedBanner deep-link with `resumeImportJobId` | §9 + File Plan #52, #56 + PR-C5 manual gate | OK |
| **ARCH S4** — Party `importedBy` SetNull integration assertion | Folded into integration #12 (DPDP) | OK |

---

## §13 Deviations from SCOPE

1. **`?importJobId=` filter on `/api/invoices`** — Mechanical 5-line `where`
   clause addition to the existing invoices list route, mirroring the
   products pattern from 7.1B. Intentionally not promoted to a File Plan
   row to avoid suggesting a new file. Reverse decision = add one row
   (~5L edit) to File Plan §8.
2. **900-LOC production-code budget overrun** — task brief targeted ≤900L;
   architect estimate is ~1495L. Documented in §8 File Plan totals with
   reasoning. Reverse decision = collapse `invoice-product-resolver.ts` +
   `invoice-party-resolver.ts` into one resolver file (~250L combined) —
   rejected: violates one-responsibility-per-file when either resolver
   grows.
3. **Per-row tx → per-chunk tx (SCOPE Resolved Decision #15)** — ARCH M1
   demonstrated Prisma's `Tx` cannot host a nested `tx.$transaction(...)` —
   the SCOPE-default per-row-tx topology won't compile under the
   dispatcher contract `(tx, args) => ChunkResult`. Two routes considered
   (orchestrator-level per-row tx OR per-chunk tx); architecture chooses
   **per-chunk tx** for dispatcher contract symmetry with 7.1B
   `commitChunkProducts`. Trade-off: 200-invoice blast radius on chunk
   failure (vs 1-invoice) — accepted because chunk pre-flight pre-validates
   everything deterministically checkable. See §2.8 trade-off table and
   §6 statement order. Reverse decision = lift the per-row tx to the
   orchestrator (commit.service.ts) — rejected: breaks dispatcher
   symmetry, complicates 7.1A/B/C drift over time.
4. **Per-invoice audit `invoices.imported` → batched `invoices.imported_batch`
   per chunk (SCOPE L52-53)** — ARCH S1 advisory. Per-invoice provenance is
   preserved via parallel-array payload + `Document.importJobId` join.
   Symmetric with 7.1B's `product.imported_batch`. ~200× write-amplification
   reduction on the audit pipeline. See §6.4. Reverse decision = restore
   per-invoice emit — rejected: write-amplification + asymmetry with 7.1B.

No other deviations. Every SCOPE MUST_SHIP, SHOULD_SHIP, every scope-audit
advisory (S1-S5), and every architecture-audit gap (M1-M6 + S1-S4) has a
concrete artifact.

---

## Failure-Mode Implementation (extends 7.1A §16 + 7.1B)

| Failure mode | SCOPE mitigation | Architecture site |
|---|---|---|
| 1. Postgres outage | upload returns 503; in-flight resume idempotent | §1 + 7.1A §16 unchanged |
| 2. Abuse spike | per-business 5/hr 20/day; 1 active job across entities; chunk size 200 invoices/tx bounds connection storm | §1 + Resolved Decision #14 |
| 3. DB bloat | hourly cleanup cron NULLs `ImportJobRow.raw`/`.normalized` 24h post-commit; `Document` ledger permanent; alert at >100k `DocumentLineItem` per `importJobId` | §1 + Failure-mode #3 in SCOPE |
| 4. Client-version lag | `requireMinClientVersion('7.1.2')` for invoice routes; 426 for older clients | §1 row 4 + integration #11 |
| 5. DPDP erasure | invoice rows business-owned (no-op); fly-created party preserved because `Document.partyId onDelete: Restrict`; `Document.importedBy onDelete: SetNull`; `Party.importedBy onDelete: SetNull` (schema:478) | §4 precondition #7, #8 + integration #12 |
| 6. Cost runaway | 200-invoice chunk cap; chunk tx (with statement_timeout headroom); `import_commit.duration_p99_ms{entity='invoice'}` Sentry alert >30s; **`import.commit.audit_write_ms_p99` no longer relevant — batched audit (ARCH S1) reduces 200 writes/chunk to 1** | §2.8 + §6.4 + Failure-mode #6 in SCOPE |
| 7. Insider abuse | every Document carries `createdBy=userId` + `importJobId`; immutable `invoices.imported_batch` audit (per-invoice via array reconstruction); soft-delete only (FK Restrict from PaymentAllocation); cross-tenant trgm/SKU/name leak prevented by `WHERE businessId=$1` predicate (integration #7, #8) | §6 step 2, 7 + §2.6/2.7 + integration #7, #8 |

---

## Open questions for architecture-auditor

Two architect judgement calls:

1. **Migration A is non-`CONCURRENTLY`.** Acceptable today (pilot business
   `Document` rowcount < 5k). If/when 7.1C is deployed against a
   multi-million-row `Document` table, the migration must be re-issued
   with `CREATE INDEX CONCURRENTLY` + `-- prisma:no-transaction`. ADR-stub
   committed inside the migration `.sql` file as a comment. Reverse =
   ship `CONCURRENTLY` now (extra PR review; defers nothing).
2. **`Document.type` boot assertion is a no-op (§4).** AUDIT S5 asked for
   the pg_enum/text decision; I picked "text → no-op + code comment +
   defensive unit test". Reverse = mandate that `Document.type` be
   converted to a pg_enum in 7.1D (or a future hardening epic) and
   activate the assertion then; the unit test in `enum-guard.test.ts`
   will fail at that moment, forcing the activation.

---

## §14 v2 Revision Log

**2026-05-19 v1** — initial architecture written against SCOPE v1
(scope-auditor PASS, 0 MUST_SHIP gaps). All 5 SHOULD_SHIP advisories
(S1-S5) folded into the design.

**2026-05-19 v2** — closes 6 MUST_SHIP + 4 SHOULD_SHIP gaps from
`ARCHITECTURE_AUDIT_PHASE7_IMPORT_7_1C.md`:

| Gap | Fold location |
|---|---|
| **ARCH M1** (nested tx invalid) | §2.8 rewritten — per-chunk tx with trade-off table; §6 statement-order rewritten as single-tx-per-chunk; trade-off paragraph appended to §2.8 last paragraph (dispatcher contract symmetry). Recorded as Deviation §13.3. |
| **ARCH M2** (`createParty()` path/signature) | §2.6 fly-create block rewritten; File Plan row 22 (NEW `services/party/create-tx.ts` ~80L) + row 23 refactor `services/party/create.ts` to delegate; integration #5 + unit #40 assertions added. |
| **ARCH M3** (Party `importJobId`/`importedBy`) | Verified live schema `server/prisma/schema.prisma:475-499` already carries these columns + FKs + indexes (added by 7.1A). §4 precondition #8 cites the lines. No Migration A change. Integration #12 asserts `Party.importedBy` FK SetNull on DPDP erasure (folds ARCH S4). |
| **ARCH M4** (`ImportEntity` union + `ChunkResult` compat) | File Plan row 21 expanded to ~10L explicit (extends union to `'parties' \| 'product' \| 'invoice'`); §2.8 signature now identical to 7.1B `commitChunkProducts`; `createdPartyIds` JSDoc'd as carrying Document IDs (precedent: 7.1B). |
| **ARCH M5** (fly-create race) | §6 step 1a `pg_advisory_xact_lock` on `(party-fly-create, hashtextextended(businessId|lower(name)|phone))` — lock held until chunk COMMIT serialises concurrent fly-creates; post-lock `findFirst` covers sibling success. §7 pathology row #13 + integration #13 (parallel POST /commit). |
| **ARCH M6** (stale product resolution) | §6 P2.5 added — re-resolve products from fresh `productSnapshot` in-place, mutate `row.normalized.lines[*].resolved.productId`; P3 reads post-mutation state. File Plan #17 includes `reResolveProductsInPlace`; unit test #39. |
| **ARCH S1** (per-row audit amplification) | §6.4 new sub-section — `invoices.imported_batch` per chunk with parallel arrays. Audit-coverage script #29 updated. Recorded as Deviation §13.4 (overrides SCOPE L52-53). Integration #1 asserts batched + reconstructable. |
| **ARCH S2** (committedRowCount serialisation) | §6 step 4 inline comment documents single-row-write serialisation assumption + one-job-per-business cap upstream. |
| **ARCH S3** (CommitBlockedBanner deep-link) | §9 + File Plan #52 (deep-link includes `&resumeImportJobId=${currentJobId}`); File Plan #56 reads the param on product-summary and surfaces "← Back to invoice import" CTA. PR-C5 gate adds manual round-trip verification. |
| **ARCH S4** (Party `importedBy` SetNull integration) | Auto-resolved by ARCH M3; integration #12 extended to assert. |

Pathology table grew from 12 to 13 rows. File Plan grew from 53 to 57
rows (4 new: #22 create-tx.ts, #39 product-resolver unit test, #40
create-tx unit test, plus consolidated audit-emit edit at #25). Total
production-code estimate moved from ~1375L to ~1495L (+120L for
`create-tx.ts` + audit-emit expansion). Conformance Map gained 10 new
rows (M1-M6, S1-S4) all status OK. Deviations list grew from 2 to 4.

Next agent: architecture-auditor (re-audit).
