---
architecture_of: SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md (v2, PASS_v2 — all M/S closed)
scope_audit_ref: SCOPE_AUDIT_PHASE7_IMPORT_7_1D_PAYMENTS.md (PASS_v2, 0 MUST_SHIP, 0 SHOULD_SHIP gaps)
parent_architectures:
  - ARCHITECTURE_PHASE7_IMPORT_7_1A.md (security envelope, M1-M11, audit pipeline, cleanup cron, DPDP)
  - ARCHITECTURE_PHASE7_IMPORT_7_1B.md (commit-dispatcher, BigInt-paise pipeline, expand→contract migration, FE EntityPicker)
  - ARCHITECTURE_PHASE7_IMPORT_7_1C.md (party-resolver + createPartyTx, date-parser util, commit-blocked sentinel, per-chunk tx, batched audit, ARCH M1-M6/S1-S4)
architect: architect
created: 2026-05-19T19:00:00+05:30
revised: 2026-05-19T20:30:00+05:30 (v2 — folded M1, M2, S1, S2, S3 from ARCHITECTURE_AUDIT_PHASE7_IMPORT_7_1D)
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/services/import/commit-dispatcher.ts (extend)
feature_flag: FEATURE_DATA_IMPORT (shared cohort=0 with 7.1A/B/C)
status: v2 (resubmit to architecture-auditor)
---

# ARCHITECTURE — Phase 7 #149 · Slice 7.1D — Payments Import (v2)

> Adds `entity='payments'` to the import engine — last slice of epic #149.
> **Diff-only against 7.1C.** Everything not redefined below is identical to
> 7.1A/B/C. The Conformance Map in §12 pins every SCOPE Resolved Decision
> (1-29) plus closed v2 advisories M1-M3 + S4-S7 from the SCOPE audit to a
> concrete artifact.
>
> **v2 (2026-05-19)** folds ARCHITECTURE_AUDIT M1 + M2 + S1 + S2 + S3.
> See §14 Revision Log.

SCOPE line refs use `SCOPE L<n>` against `SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md`.
AUDIT refs use `AUDIT M<n>` / `AUDIT S<n>` against
`SCOPE_AUDIT_PHASE7_IMPORT_7_1D_PAYMENTS.md`.

---

## §1 Reused from 7.1A/B/C verbatim — no changes

Everything below is consumed as-is. **No 7.1D file modifies these.**

| Concern | SSOT | What 7.1D inherits |
|---|---|---|
| Security envelope (M1-M11 — userId binding, filename sanitize, 4-field commit bind, error-CSV, XXE+zip-bomb prescan, multer 10MB, 10k row cap, 10s parse timeout) | 7.1A §3-§4 | Verbatim |
| Routes (5 routes — POST /api/imports, GET /:id, POST /:id/commit, DELETE /:id, GET /api/imports, GET /:id/error-csv) | 7.1A §3 | Polymorphic — Zod adds `'payments'` to entity enum (1 line) |
| Middleware order (requireAuth → requireActiveBusiness → requireRole('admin') → requireFeature → requireMinClientVersion → importRateLimit → idempotencyCheck → multer) | 7.1A §3 | Verbatim |
| `requireMinClientVersion` constant | 7.1A const | **Bumped to `'7.1.3'`** for `entity='payments'`. Parties=`7.1.0`, product=`7.1.0`, invoice=`7.1.2` unchanged (per-entity gate) |
| Idempotency framework (commitToken 4h TTL + Idempotency-Key 24h + row-level `createdEntityId IS NULL` guard) | 7.1A §6 + 7.1B §8.1 | Verbatim |
| `commit-dispatcher.ts` pickCommitChunk(entity) | 7.1B/C File Plan | **Extended** with `case 'payments': return commitChunkPayments`; `ImportEntity` union extends to `'parties' \| 'product' \| 'invoice' \| 'payments'` |
| Audit pipeline (`import_job.*` 7 actions + `enforce-audit-coverage.mjs --block`) | 7.1A §10 | Extended with **`payments.imported_batch`** (one new action key — see §6.4) |
| DPDP retention + hourly cleanup cron (`ImportJobRow.raw`/`.normalized` NULL 24h post-commit) | 7.1A §9 | Verbatim; `Payment` + `PaymentAllocation` are permanent ledger — out of cleanup scope |
| Active-job gate (one job/business across entities — entity-agnostic FOR UPDATE) | 7.1A | Verbatim |
| Rate-limit envelope (5/hr, 20/day per business) | 7.1A | Verbatim |
| FE `EntityPicker.tsx`, `PreviewRowCard` dispatcher, `PreviewTable` column dispatcher | 7.1B/C FE plan | Extended — adds "Payments" tile + `PaymentRowCard` delegate |
| FE offline contract — `api()` wrapper with `entityType:'import'` + `excludeFromOfflineQueue:true` | 7.1B §9 | Verbatim; `entityLabel: \`Payments: \${fileName}\`` |
| BigInt-paise pipeline (`toPaiseBigInt`) + `narrowPaiseToInt` boundary narrow (`AMOUNT_NEGATIVE` / `AMOUNT_OUT_OF_RANGE`) | 7.1B + 7.1C §2.5 | Verbatim |
| `date-parser.util.ts` (NFKC + ASCII-only digit check + 32-char length cap + hand-rolled 4-format state machine) | 7.1C §2.3 | Verbatim — invoked from each payment parser adapter |
| `party-resolver.ts` (chunk-preload by `(lower(name), phone)`; `PARTY_AUTO_CREATED` / `PARTY_NAME_ONLY_MATCH`) | 7.1C §2.6 | Verbatim |
| `createPartyTx()` (tx-injectable canonical party-create, `pg_advisory_xact_lock` at length-prefix-safe hash) | 7.1C §2.6 + ARCH M5 | Verbatim — called from inside payment chunk tx |
| Commit-blocked sentinel pattern (any row with the sentinel error → 409, banner + deep-link) | 7.1C §2.7 + §2.8 + ARCH S3 | Reused shape; payments use `COMMIT_BLOCKED_INVOICE_NOT_FOUND` instead of `..._PRODUCT_NOT_FOUND` |
| Per-chunk tx (200 rows/chunk), no nested `$transaction`, dispatcher contract `(tx, args) => ChunkResult` | 7.1C §2.8 + ARCH M1 | Verbatim — 7.1D mirrors topology row-for-row |
| Batched audit emitter shape (parallel arrays, length-equality runtime assert) | 7.1C §6.4 + ARCH S1 | Verbatim shape — new action key `payments.imported_batch` |
| Cross-tenant scoping rule — every FK preload `WHERE businessId = $1`; integration test asserts business B invisible to A | 7.1C §11 #7-#8 | Verbatim |
| `ImportJobRow.createdEntityId IS NULL` retry guard | 7.1A/B/C | Verbatim |
| Error-CSV route (CSV-injection-safe) | 7.1A M4 | Verbatim |

No DROP of any 7.1A/B/C file. Every 7.1D file is **additive** alongside.

---

## §2 New surfaces in 7.1D

### §2.1 Parsers (4 new files / 4 edits)

Each parser file already branches by `entity` (7.1B/C). 7.1D adds a
`payments` branch in each — symmetric across entities.

| Parser | Source contract | Branch logic |
|---|---|---|
| `tally-xml.parser.ts` | `<VOUCHER VCHTYPE="Receipt">` blocks (SCOPE L378-397) | Already streams XML; add `extractReceiptVoucher()` walker. Reads `PARTYLEDGERNAME`, `PARTYMAILINGADDRESS.LIST/PARTYMAILINGADDRESS`, bank/cash leg `LEDGERNAME` + `AMOUNT` (debit side = money-in), `BILLALLOCATIONS.LIST/NAME` (first → `invoiceNumber`; multiple → `MULTI_ALLOCATION_UNSUPPORTED`), `<CHEQUENO>` → `referenceNumber`. **Pre-formats** `DATE` attribute matching `/^\d{8}$/` to `YYYY-MM-DD` before calling shared `date-parser.util.ts` (SCOPE Resolved Decision #28, L412-414) |
| `vyapar-csv.parser.ts` | Flat payments export (SCOPE L416-429) | Reuses NFKC + alias header detection; emits flat `RawPaymentRow`. Header dictionary lives in `payment-column-dict.constants.ts` (SCOPE L421) |
| `busy-xlsx.parser.ts` | `ReceiptRegister` sheet (case-insensitive) | XLSX read with `{ cellDates: true, dateNF: 'yyyy-mm-dd' }` (SCOPE L434, Resolved Decision #29) — Excel serial `45291` becomes ISO string at parse time; shared date util never sees serials. Zip-bomb pre-scan inherited from 7.1A |
| `generic-csv.parser.ts` | Mapping-driven; FE-supplied `columnMapping` (SCOPE L440-444) | Required mappings: `date`, `partyName`, `amount`, `mode`. Optional: `phone`, `reference`, `invoiceNumber`, `notes`. Header autodetect via same dictionary; zero matches → 400 `MAPPING_REQUIRED` |

`parsers/index.ts` (entity-aware dispatch) gains `case ['payments', format]`
entries (8 lines) and extends `ImportEntity` union to include `'payments'`.

### §2.2 Payment normalizer (`payment-normalizer.ts`)

No aggregation needed (payments are flat — one source row = one payment).
The normalizer is the single orchestration point per row:

```
parser → RawPaymentRow[]
       ↓
payment-normalizer.ts
   ├─ parseInvoiceDate(raw.date)          → INVALID_DATE | iso
   ├─ narrowPaiseToInt(toPaiseBigInt(amt))→ AMOUNT_NEGATIVE | AMOUNT_OUT_OF_RANGE | int
   │  (extra guard: amount === 0 → AMOUNT_NEGATIVE — strictly > 0 per SCOPE Resolved Decision #7)
   ├─ resolveMode(raw.mode, strictMode)   → see §2.3
   ├─ truncateReference(raw.reference)    → see §2.4
   ├─ resolveInvoiceNumber(raw.invoice)   → comma-check; '' → null
   └─ partyResolver (chunk preload — 7.1C verbatim)
       ↓
NormalizedPayment[] (one ImportJobRow per element, JSON in .normalized)
```

Output shape is `NormalizedPayment` per SCOPE L322-343 — verbatim.

### §2.3 Payment-mode resolver (`payment-mode-map.ts` + `.constants.ts`)

Mode dictionary lives in `payment-mode-map.constants.ts` as a frozen
`Map<string, PaymentMode>` (SCOPE L156, L170, L406-408, L847). Closed enum —
no fly-create.

Lookup key normalisation (SCOPE Resolved Decision #19, AUDIT S4 closed):

```ts
function normaliseKey(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return raw.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
}
```

Seed dictionary covers Tally/Vyapar/Busy common strings in English **and
Devanagari** (`नकद → CASH`, `यूपीआई → UPI`, `बैंक A/c → BANK_TRANSFER`,
`चेक → CHEQUE`, `NEFT → NEFT_RTGS_IMPS`, etc.). Spacing/casing tolerant by
construction — `"Bank A/c"`, `"BANK A/C "`, `"बैंक  A/c"` all collapse to
the same key.

Resolution:
- key found → mode + `modeDefaulted=false` + NO issue
- key NOT found + `strictMode=false` → mode=`OTHER` + `modeDefaulted=true` +
  WARNING `MODE_DEFAULTED` (which uses the issue code value `MODE_UNKNOWN_DEFAULTED` per the union name SCOPE L283)
- key NOT found + `strictMode=true` → ERROR `MODE_UNKNOWN_STRICT` (SCOPE
  Resolved Decision #13, L283)

Mode code values in the issue union: SCOPE uses `MODE_DEFAULTED` (L282) and
`MODE_UNKNOWN_STRICT` (L283). 7.1D adopts `MODE_UNKNOWN_DEFAULTED` as the
canonical name in error catalogue + en/hi copy keys for symmetry with the
strict variant — **deviation noted in §13**. Reverse decision = use SCOPE's
`MODE_DEFAULTED`; rejected on naming asymmetry.

### §2.4 Reference-number tail-truncation (SCOPE Resolved Decision #25, MUST_SHIP #3 CLOSED)

`payment-utils.ts` exposes:

```ts
export const REFERENCE_MAX_LEN = 100
export const REFERENCE_TRUNCATE_FROM = 'tail' as const   // SSOT — File Plan constant

// NOTE: tail-100 truncation can collide if two refs share trailing 100 chars;
// dedup key (date,party,amount,mode) does NOT include reference; do NOT add
// @@unique([businessId, referenceNumber]) — would 500-error legitimate
// distinct truncated refs. See AUDIT S3 (closed v2) + §13 Deviation #3.
export function truncateReference(raw: unknown):
  { value: string | null; truncated: boolean } {
  if (typeof raw !== 'string') return { value: null, truncated: false }
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { value: null, truncated: false }
  if (trimmed.length <= REFERENCE_MAX_LEN) return { value: trimmed, truncated: false }
  // Tail-truncation — keep the LAST 100 chars (uniqueness lives in the tail
  // for Razorpay payment_ids and cheque serials). Head-truncation would
  // collapse `pay_OabcDEF…SERIAL001234567` family to identical prefixes
  // and destroy audit signal. See SCOPE Resolved Decision #25.
  return { value: trimmed.slice(-REFERENCE_MAX_LEN), truncated: true }
}
```

Schema fact: `Payment.referenceNumber @db.VarChar(100)`. Truncation
guarantees the post-trim string fits without DB-side truncation (which
would silently head-truncate in some Postgres configurations).

WARNING code: `REFERENCE_TRUNCATED` (SCOPE L284). Unit test #38 asserts
two refs differing only in the last digit at >100 chars store as
DISTINCT values (SCOPE L807).

### §2.5 Invoice resolver — strict when `invoiceNumber` supplied (SCOPE Resolved Decision #2, #17, #18)

`invoice-resolver-for-payments.ts` — chunk-preload, single roundtrip:

```sql
SELECT id, lower("documentNumber") AS lnumber, "grandTotal"
FROM "Document"
WHERE "businessId" = $1
  AND type = 'SALE_INVOICE'
  AND "isDeleted" = false
  AND "documentNumber" IS NOT NULL
  AND lower("documentNumber") = ANY($2::text[])
```

Match precedence per `normalizedRow.source.invoiceNumber`:
1. `null` / `''` / whitespace-only → `matchedBy='NOT_REQUESTED'`,
   `documentId=null` → **unallocated payment** (lenient — advances party balance, no `PaymentAllocation` row)
2. Contains `,` → ERROR `MULTI_ALLOCATION_UNSUPPORTED` (SCOPE Resolved Decision #3)
3. Lookup hit (1 row) → `matchedBy='BY_NUMBER'`, `documentId` set
4. Lookup hit (>1 rows — legacy data despite `@@unique`) → ERROR `INVOICE_AMBIGUOUS` with candidate IDs (SCOPE Resolved Decision #17)
5. Lookup miss → ERROR `INVOICE_NOT_FOUND` (blocks commit — sentinel — SCOPE L58, L173, L277)

The preload short-circuits when ANY row's `invoiceNumber` is `null` (no SQL
issued for that row — saves the round-trip on advance-heavy imports).

### §2.6 Over-allocation guard + P2002 mapping (MUST_SHIP #2 CLOSED — v2: Σ-check BEFORE INSERT)

**v2 ordering (AUDIT M1 closed):** Σ-check runs **before** Payment INSERT,
and on fail the row is marked ERROR + `continue` (no throw, no chunk
rollback). This matches the per-row race-skip pattern at §6 step 3a
(Document-soft-delete race) and preserves the SCOPE test #4 expectation
("rows 1..N COMMITTED, rows N+1..50 ERROR `OVER_ALLOCATION`").

Inside the per-row work (executed sequentially via `for…of` within the
chunk tx — see §6):

```ts
// 3a. Lock the Document row (held until chunk COMMIT)
const doc = await tx.$queryRaw<{grandTotal: number}[]>`
  SELECT "grandTotal"
  FROM "Document"
  WHERE id = ${invoiceId}
    AND "businessId" = ${businessId}
    AND type = 'SALE_INVOICE'
    AND "isDeleted" = false
  FOR UPDATE
`
if (doc.length === 0) {
  // race with delete — per-row error, no chunk rollback
  markRowError(row, 'INVOICE_NOT_FOUND')
  continue
}

// 3b. Sum existing allocations (filter by Payment.isDeleted via JOIN)
const sumRow = await tx.$queryRaw<{allocated: bigint}[]>`
  SELECT COALESCE(SUM(pa.amount), 0)::bigint AS allocated
  FROM "PaymentAllocation" pa
  JOIN "Payment" p ON p.id = pa."paymentId"
  WHERE pa."invoiceId" = ${invoiceId} AND p."isDeleted" = false
`
const existingSigma = Number(sumRow[0].allocated)

// 3c. Σ-guard — BEFORE Payment INSERT. Row-local error + continue.
if (existingSigma + paymentAmount > doc[0].grandTotal) {
  markRowError(row, 'OVER_ALLOCATION', {
    existingSigma, requested: paymentAmount, grandTotal: doc[0].grandTotal,
  })
  continue   // NO throw, NO chunk rollback — other rows independent
}

// 3d. INSERT Payment (only reached when Σ-guard passed)
const payment = await tx.payment.create({ data: { ... } })

// 3e. INSERT PaymentAllocation
try {
  await tx.paymentAllocation.create({
    data: { paymentId: payment.id, invoiceId, amount: paymentAmount },
  })
} catch (e) {
  // v2 robust P2002 discriminator (AUDIT S2 closed) — handles BOTH
  // Prisma meta.target shapes: array-of-strings AND concatenated string.
  if (e.code === 'P2002') {
    const t = e.meta?.target
    const key = Array.isArray(t) ? t.join('_') : String(t ?? '')
    const isAllocUnique =
      key === 'PaymentAllocation_paymentId_invoiceId_key' ||
      (key.includes('paymentId') && key.includes('invoiceId'))
    if (isAllocUnique) {
      Sentry.captureException(e, {
        tags: { import_phase: 'payment_allocation', severity: 'system_bug' },
      })
      throw new AppError('ALLOCATION_INTERNAL_CONFLICT', 500, { rowIndex })
    }
  }
  throw e
}

// 4. UPDATE ImportJob.committedRowCount += 1  (only when Σ-guard passed
//    and both INSERTs landed — Σ-skip rows above DO NOT increment)
// 5. UPDATE ImportJobRow status='COMMITTED', createdEntityId=payment.id
```

**Schema-verified Payment-level uniqueness** (schema.prisma:1270-1333) —
`Payment.offlineId @unique` (1272) and `Payment.reversesPaymentId @unique`
(1296) are the only field-level uniques on Payment. Import always writes
both as `null`, so a P2002 on `Payment.create()` is a true bug and falls
through the `throw e` re-raise above (caller treats as 500). The only
expected P2002 path is `PaymentAllocation.@@unique([paymentId, invoiceId])`
(1331) and is mapped to `ALLOCATION_INTERNAL_CONFLICT` 500.

**The two codes MUST NOT be collapsed** (SCOPE Resolved Decision #27,
MUST_SHIP #2). The Σ-guard catches user-actionable over-allocation (4xx
per-row, row-local continue). P2002 catches a true system bug (the same
payment cannot reach the same invoice twice in correct code).

### §2.7 Dedup — cross-job + intra-file (SCOPE Resolved Decisions #9, #10)

`payment-dedup.ts` — single helper, two passes:

**Intra-file** (in-memory map across normalized chunk batch, key = SCOPE Resolved Decision #9):
```
key = `${iso}|${partyResolvedKey}|${amountPaise}`
   where partyResolvedKey = `${lower(name)}|${phone ?? ''}`
```
Mode deliberately OUT of intra-file key (split-mode rows in source).
First row → STAGED. Subsequent → WARNING `INTRA_FILE_DUPLICATE`.

**Cross-job** (one SQL per chunk):
```sql
SELECT "partyId", date, amount, mode
FROM "Payment"
WHERE "businessId" = $1
  AND "isDeleted" = false
  AND ("partyId", date, amount, mode) IN ( ... chunk's resolved tuples ... )
```
Match → WARNING `DUPLICATE_PAYMENT`; resolutions = `SKIP` | `CREATE_NEW`
(SCOPE L161). Mode IS in cross-job key (legitimate same-day Cash + UPI is
two receipts).

### §2.8 Commit-payments service — per-chunk tx, sequential `for…of` (MUST_SHIP #1 CLOSED)

`commit-payments.service.ts` mirrors 7.1C `commitChunkInvoices` topology
verbatim. **Per-chunk tx, no nested `$transaction`.** The chunk's per-row
work is **SEQUENTIAL** — `for…of`, never `Promise.all` (SCOPE Resolved
Decision #26, L26-39).

```ts
export async function commitChunkPayments(
  tx: Tx,
  args: CommitChunkArgs,
): Promise<ChunkResult> {
  const { jobId, businessId, userId, strictMode } = args
  const stagedRows = await tx.importJobRow.findMany({
    where: { jobId, status: 'STAGED', createdEntityId: null },
    orderBy: { sourceIndex: 'asc' }, take: 200,
    select: { id: true, sourceIndex: true, normalized: true },
  })
  if (stagedRows.length === 0) return { createdPartyIds: [], sourceIndices: [], done: true }

  // PRE-FLIGHT (see §6 P1-P3)
  const invoiceSnapshot = await loadInvoiceSnapshot(tx, businessId, stagedRows)
  reResolveInvoicesInPlace(stagedRows, invoiceSnapshot)  // stale-snapshot sweep (7.1C ARCH M6)
  const blockedCount = countInvoiceNotFoundRows(stagedRows)
  if (blockedCount > 0) {
    throw new AppError('COMMIT_BLOCKED_INVOICE_NOT_FOUND', 409, '...', {
      blockedRowCount: blockedCount,
      missingInvoiceSample: collectMissingInvoiceSample(stagedRows, 5),
    })
  }

  // Parallel arrays carry ONLY committed rows (Σ-skip + race-skip rows excluded).
  const paymentIds: string[] = []
  const amounts: number[] = []
  const partyIds: string[] = []
  const allocatedDocumentIds: (string | null)[] = []
  const modes: PaymentMode[] = []
  const sourceIndices: number[] = []

  // SEQUENTIAL — never Promise.all (SCOPE Resolved Decision #26).
  // CI lint asserts no `Promise.all` across the entire commit-payments/
  // directory (File Plan row 31 — v2 broadened from single-file glob).
  for (const row of stagedRows) {
    const result = await commitOnePaymentWithinChunkTx(tx, row, args)
    if (result.skipped) continue   // Σ-skip / race-skip rows are row-local ERROR
    paymentIds.push(result.paymentId)
    amounts.push(result.amount)
    partyIds.push(result.partyId)
    allocatedDocumentIds.push(result.allocatedDocumentId)  // null for unallocated
    modes.push(result.mode)
    sourceIndices.push(row.sourceIndex)
  }

  // Runtime length-equality assert (SCOPE Resolved Decision #15)
  assertEqualLengths({ paymentIds, amounts, partyIds, allocatedDocumentIds, modes, sourceIndices })

  await emitPaymentsImportedBatch(tx, {
    jobId, businessId, userId,
    paymentIds, amounts, partyIds, allocatedDocumentIds, modes, sourceIndices,
  })

  return { createdPartyIds: paymentIds, sourceIndices, done: stagedRows.length < 200 }
}
```

`ChunkResult.createdPartyIds` carries Payment IDs (precedent: 7.1B carries
Product IDs, 7.1C carries Document IDs — same JSDoc-documented misnomer).
CI lint rule: `Promise.all` is banned **across the entire `commit-payments/`
directory** (File Plan row 31 note — v2 broadened from `commit-payments.service.ts`
single-file glob, AUDIT S1 closed; mechanical enforcement, SCOPE MUST_SHIP #1 CLOSED).

---

## §3 Migrations — single additive expand-only

One migration. Mirrors 7.1C Document shape row-for-row.

### Migration A — `<ts>_payment_import_expand` (in tx)

**Up:**
```sql
ALTER TABLE "Payment" ADD COLUMN "importJobId" TEXT NULL;
ALTER TABLE "Payment" ADD COLUMN "importedBy"  TEXT NULL;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_importJobId_fkey"
  FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_importedBy_fkey"
  FOREIGN KEY ("importedBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Payment_businessId_importJobId_idx"
  ON "Payment" ("businessId", "importJobId");
```

**Down:** drop the two FKs, the index, the two columns. Reversible.

No `CONCURRENTLY` — sparse-nullable btree on moderately-sized `Payment`;
short `ACCESS EXCLUSIVE` hold acceptable. ADR-stub at top of migration
file flags v2-with-CONCURRENTLY when row count crosses 1M.

Why expand-only sufficient: pure additive columns, both nullable, no
backfill, no rename. Existing `Payment` rows carry `importJobId=NULL`
(matches their reality — they weren't imported).

No GIN trgm index — no near-dedup for payments (deterministic
party+date+amount+mode tuple).

---

## §4 Schema preconditions — verified against live `schema.prisma`

Live schema verified at `server/prisma/schema.prisma:1270-1333`.

1. `Payment.id String @id @default(cuid())` — exists.
2. `Payment.businessId String` + `business Business @relation(... onDelete: Restrict)` — exists (line 1300).
3. `Payment.type String` — **freeform**, not pg_enum (line 1274, comment `// PAYMENT_IN, PAYMENT_OUT, PAYROLL_OUT, PAYROLL_IN`). 7.1D writes literal `'PAYMENT_IN'`. **Boot-time assertion is a documented no-op for 7.1D** — mirrors 7.1C §4 precondition for `Document.type`. Code comment in `src/lib/enum-guard.ts`:
   ```
   // 7.1D payment import: Payment.type is freeform String (schema.prisma:1274).
   // No pg_enum to assert at boot. If a future migration converts the column
   // to pg_enum, add `assertEnumValue('Payment_type', ['PAYMENT_IN', ...])`
   // here BEFORE shipping that migration.
   ```
4. `Payment.partyId String` + `party Party @relation(... onDelete: Restrict)` (line 1301) — fly-created party from 7.1C survives uploader DPDP erasure for the same reason `Document` does.
5. `Payment.amount Int` (line 1276, comment `// paise`) — Int paise confirmed. `narrowPaiseToInt` boundary check applies.
6. `Payment.date DateTime` (line 1277) — **field name is `date`, NOT `paymentDate`** (SCOPE Resolved Decision #8 explicit). Builders MUST use `date`.
7. `Payment.mode String` — freeform per schema, validated against the closed dictionary at app layer. (No DB-level enum; same precedent as `type`.)
8. `Payment.referenceNumber String? @db.VarChar(100)` (line 1279) — nullable, 100-char cap. Tail-truncate to fit (§2.4).
9. `Payment.notes String? @db.VarChar(500)` (line 1280) — nullable, 500-char cap. Notes truncated head-style with simple `slice(0,500)` (no audit ref, no uniqueness — non-issue).
10. `Payment.isDeleted Boolean @default(false)` + `Payment.deletedAt DateTime?` (lines 1281-1282) — soft-delete primary; bulk-delete-by-`importJobId` uses soft.
11. `Payment.createdBy String` + `creator @relation(onDelete: Restrict)` (line 1302) — populated with `auth.userId`; **distinct** from `importedBy`. Restrict ensures user cannot be hard-deleted while owning payments.
12. `PaymentAllocation` (lines 1320-1333):
    - `id String @id @default(cuid())`
    - `paymentId String` + `payment @relation(... onDelete: Cascade)` (line 1328) — hard-delete cascades; soft-delete does NOT cascade (matches SCOPE Resolved Decision #21).
    - `invoiceId String` + `invoice Document @relation(... onDelete: Restrict)` (line 1329) — Document cannot be hard-deleted while allocations exist.
    - `amount Int` (line 1324) — paise; same overflow ceiling as `Payment.amount`.
    - `@@unique([paymentId, invoiceId])` (line 1331) — the constraint that fires the P2002 → `ALLOCATION_INTERNAL_CONFLICT` path.
    - `@@index([invoiceId])` (line 1332) — covers the over-allocation Σ-query.
13. **No `Document.amountReceived` / `Document.amountDue` columns** — confirmed at `Document` model (line 942-). Paid-state is derived. SCOPE Resolved Decision #12 cited.
14. `Document.grandTotal Int` (line 967) — Int paise; Σ-guard math stays in number domain after narrow.
15. `ImportJobRow.createdEntityId` exists (7.1B Migration A) — reused for `Payment.id` write at guarded UPDATE.
16. `ImportJob.entity` accepts arbitrary string — Zod runtime union adds `'payments'`.
17. `Payment.reversesPaymentId` (lines 1296-1298) — **Phase 6 payroll-reversal pointer**, NOT touched by import. Import always writes `reversesPaymentId=null`. Phase 6 invariant preserved (single `@unique` reversal pointer). Field-level `@unique` (1296) — distinct P2002 target from the allocation unique; see §2.6 catch.
18. `Payment.offlineId String? @unique` (1272) — Phase-5 offline-create marker, never written by import (always `null`). Field-level `@unique` — distinct P2002 target from the allocation unique; see §2.6 catch.
19. Existing indexes that cover 7.1D query patterns: `(businessId, date)`, `(businessId, partyId)`, `(businessId, partyId, date)`, `(businessId, mode)`, `(businessId, isDeleted)`. Cross-job dedup query covered by `(businessId, partyId, date)` index. **No new indexes on `PaymentAllocation`** — existing `@@unique` + `@@index([invoiceId])` cover point-lookup + Σ-query.

**Schema surprise**: none. Live schema matches SCOPE §5 verification
verbatim (line 191-208). All column names, FK directions, and indexes
confirmed.

---

## §5 Error codes — final `PaymentIssueCode` union

```ts
type PaymentIssueCode =
  | 'INVALID_DATE'                       // ERROR
  | 'AMOUNT_NEGATIVE'                    // ERROR  ← strictly > 0 (Resolved Decision #7)
  | 'AMOUNT_OUT_OF_RANGE'                // ERROR  ← > 2^31-1 paise
  | 'PARTY_NOT_FOUND'                    // ERROR  (REQUIRE_PARTIES_FIRST only)
  | 'PARTY_AUTO_CREATED'                 // WARNING
  | 'PARTY_NAME_ONLY_MATCH'              // WARNING
  | 'INVOICE_NOT_FOUND'                  // ERROR  ← commit-blocked sentinel
  | 'INVOICE_AMBIGUOUS'                  // ERROR  ← legacy data >1 match
  | 'MULTI_ALLOCATION_UNSUPPORTED'       // ERROR  ← invoiceNumber contains comma
  | 'OVER_ALLOCATION'                    // ERROR  ← 4xx Σ-guard
  | 'ALLOCATION_INTERNAL_CONFLICT'       // ERROR  ← 5xx P2002 (system bug)
  | 'MODE_UNKNOWN_DEFAULTED'             // WARNING (default; mode=OTHER)
  | 'MODE_UNKNOWN_STRICT'                // ERROR  ← strictMode=true only
  | 'REFERENCE_TRUNCATED'                // WARNING (last 100 chars retained)
  | 'DUPLICATE_PAYMENT'                  // WARNING (cross-job triple match)
  | 'INTRA_FILE_DUPLICATE'               // WARNING
```

Severity fixed in `PAYMENT_ISSUE_SEVERITY` constant. FE chip color derives
from severity, copy from `t.import.payment.issues.<code>` (en + hi).

**Naming deviation** noted in §13: SCOPE L282 uses `MODE_DEFAULTED`; we use
`MODE_UNKNOWN_DEFAULTED` for symmetry with the strict-mode counterpart.

---

## §6 Statement order within chunk tx (NORMATIVE — v2)

Mirror of 7.1C §6 with payment-specific substitutions. **v2 (AUDIT M1+M2
closed):** Σ-check moved BEFORE Payment INSERT; OVER_ALLOCATION is a
per-row error with `continue` (NO throw, NO chunk rollback). Builders
MUST implement this order; deviation breaks idempotency and the SCOPE
test #4 invariant.

```
PRE-FLIGHT (within the chunk tx, before the per-row loop):
  P0. acquireBusinessLock(tx, businessId)
        — pg_advisory_xact_lock keyed by businessId; held until COMMIT.
          Coordinates with the active-job gate to prevent same-business
          parallel chunk execution. (Inherited 7.1A pattern.)
  P1. invoiceResolver.loadSnapshot(tx, businessId, stagedRows)
        — single-roundtrip SELECT (§2.5); returns Map keyed by lower(documentNumber)
  P2. (SELECT FOR UPDATE on chunk's ImportJobRows happened implicitly via
      the findMany — Prisma uses transactional read; the createdEntityId
      guard at step 5 enforces idempotency)
  P2.5 (stale-snapshot sweep — mirrors 7.1C ARCH M6):
        for (row of stagedRows)
          if (row.normalized.invoiceMatch.matchedBy === 'NOT_FOUND'):
            const fresh = invoiceSnapshot.lookup(row.normalized.invoiceMatch.requested)
            if (fresh): row.normalized.invoiceMatch = { ..., documentId: fresh.id, matchedBy: 'BY_NUMBER' }
        // Mutates row.normalized in-memory ONLY; not persisted.
        // (Skipped for rows where invoiceNumber was null — those are NOT_REQUESTED, not NOT_FOUND.)
  P3. blockedCount = count(rows where invoiceMatch.matchedBy === 'NOT_FOUND')
      if (blockedCount > 0) throw new AppError('COMMIT_BLOCKED_INVOICE_NOT_FOUND', 409, {
        blockedRowCount: blockedCount,
        missingInvoiceSample: collectMissingInvoiceSample(stagedRows, 5),
      })

  -- (No re-resolution of parties needed here. Parties are always resolved
     fly-create through createPartyTx + advisory lock per-row inside the
     loop; the chunk preload happened in 7.1C's party-resolver during
     normalize. Per SCOPE: skip P2.5-equivalent for parties.)

PER-ROW STATEMENTS (SEQUENTIAL for...of within the same chunk tx — NO
nested tx.$transaction, NO Promise.all — CI lint enforced on entire
commit-payments/ directory):

  For each row in stagedRows:
    1. (party resolution — if fly-create needed)
       a. tx.$executeRaw\`SELECT pg_advisory_xact_lock(
            hashtextextended('party-fly-create', 0),
            hashtextextended(${businessId} || '|' || lower(${name}) || '|' || ${phone ?? ''}, 0)
          )\`
       b. const existing = await tx.party.findFirst({ where: {...}, select: { id: true } })
          if (existing) partyId = existing.id
          else {
            const newParty = await createPartyTx(tx, businessId, partyData,
              { importJobId: jobId, importedBy: userId })
            partyId = newParty.id
          }
       // Inherits 7.1C ARCH M5 length-prefix advisory lock — verbatim.

    2. (SKIPPED in v2 — Payment INSERT moved to step 3d so the Σ-guard
       runs before any write. Step 2 is intentionally empty for diff-clarity
       against 7.1C; reuse the same dispatcher row-shape contract.)

    3. (CONDITIONAL — only when invoiceMatch.matchedBy === 'BY_NUMBER')

       3a. LOCK Document
           const docLock = await tx.$queryRaw\`
             SELECT "grandTotal"
             FROM "Document"
             WHERE id = ${invoiceId} AND "businessId" = ${businessId}
               AND type = 'SALE_INVOICE' AND "isDeleted" = false
             FOR UPDATE
           \`
           if (docLock.length === 0) {
             // Race with invoice soft-delete between pre-flight and lock.
             // Pre-flight already swept stale; a fresh miss here means
             // concurrent mutation. Row-local ERROR; continue. NO Payment
             // INSERT for this row.
             markRowError(row, 'INVOICE_NOT_FOUND')
             continue
           }

       3b. Σ EXISTING
           const sumRow = await tx.$queryRaw\`
             SELECT COALESCE(SUM(pa.amount), 0)::bigint AS allocated
             FROM "PaymentAllocation" pa
             JOIN "Payment" p ON p.id = pa."paymentId"
             WHERE pa."invoiceId" = ${invoiceId} AND p."isDeleted" = false
           \`
           existingΣ = Number(sumRow[0].allocated)

       3c. Σ-GUARD — BEFORE INSERT (v2)
           if (existingΣ + paymentAmount > docLock[0].grandTotal) {
             // 4xx user-actionable. Row-local ERROR; continue. NO Payment
             // INSERT, NO chunk rollback. Other rows proceed independently.
             markRowError(row, 'OVER_ALLOCATION', {
               existingSigma: existingΣ,
               requested: paymentAmount,
               grandTotal: docLock[0].grandTotal,
             })
             continue
           }

       3d. INSERT Payment (only after Σ-guard pass)
           const payment = await tx.payment.create({
             data: {
               businessId, type: 'PAYMENT_IN', partyId,
               amount: paymentAmountInt,
               date: isoDate,
               mode: resolvedMode,
               referenceNumber: tailTruncatedRef,  // null if absent
               notes: row.normalized.notes ?? null,
               createdBy: userId,
               importJobId: jobId,
               importedBy: userId,
               // reversesPaymentId: null, offlineId: null (defaults)
             },
             select: { id: true, amount: true, mode: true },
           })

       3e. INSERT PaymentAllocation (only when BY_NUMBER)
           try {
             await tx.paymentAllocation.create({
               data: { paymentId: payment.id, invoiceId, amount: payment.amount },
             })
           } catch (e) {
             if (e.code === 'P2002') {
               const t = e.meta?.target
               const key = Array.isArray(t) ? t.join('_') : String(t ?? '')
               const isAllocUnique =
                 key === 'PaymentAllocation_paymentId_invoiceId_key' ||
                 (key.includes('paymentId') && key.includes('invoiceId'))
               if (isAllocUnique) {
                 Sentry.captureException(e, { tags: { import_phase: 'payment_allocation', severity: 'system_bug' }})
                 throw new AppError('ALLOCATION_INTERNAL_CONFLICT', 500, { rowIndex })
               }
             }
             throw e   // any other P2002 (offlineId / reversesPaymentId) is also a true system bug
           }

       (Unallocated rows — matchedBy === 'NOT_REQUESTED' — skip step 3
        entirely. After party resolve at step 1 they jump to 3d-equivalent
        Payment INSERT directly; no Σ-guard applies.)

    4. tx.importJob.update({
         where: { id: jobId },
         data: { committedRowCount: { increment: 1 } },
       })
       // Only reached when steps 3a-3e all passed. Σ-skip / race-skip rows
       // (via the `continue`s above) DO NOT increment committedRowCount.

    5. const guarded = await tx.importJobRow.updateMany({
         where: { id: row.id, status: 'STAGED', createdEntityId: null },
         data: { status: 'COMMITTED', createdEntityId: payment.id },
       })
       if (guarded.count === 0) throw new AppError('CONCURRENT_COMMIT_RACE', 409, ...)

CHUNK-WIDE FINAL (batched audit emit):

  6. await tx.auditLog.create({
       data: {
         action: 'payments.imported_batch',
         businessId, actorUserId: userId,
         payload: {
           importJobId: jobId,
           paymentIds: [...],               // parallel arrays — ONLY committed rows
           amounts: [...],                  // Int paise
           partyIds: [...],
           allocatedDocumentIds: [...],     // null per-index for unallocated payments
           modes: [...],                    // resolved PaymentMode values
           sourceIndices: [...],
         },
       },
     })

COMMIT (the outer chunk tx).
```

**Step-order diagram (v2):**

```
        ┌────────────────────────────────────────┐
        │  3a SELECT FOR UPDATE Document         │
        │     miss → markRowError(INVOICE_NOT_…) │
        │            + continue                  │
        └────────────────┬───────────────────────┘
                         │
        ┌────────────────▼───────────────────────┐
        │  3b SUM PaymentAllocation              │
        │     (filter Payment.isDeleted=false)   │
        └────────────────┬───────────────────────┘
                         │
        ┌────────────────▼───────────────────────┐
        │  3c Σ-GUARD                            │
        │     existingΣ + new > grandTotal       │
        │     → markRowError(OVER_ALLOCATION)    │
        │       + continue   (NO throw, NO       │
        │       chunk rollback)                  │
        └────────────────┬───────────────────────┘
                         │ pass
        ┌────────────────▼───────────────────────┐
        │  3d INSERT Payment                     │
        └────────────────┬───────────────────────┘
                         │
        ┌────────────────▼───────────────────────┐
        │  3e INSERT PaymentAllocation           │
        │     P2002 → ALLOC_INTERNAL_CONFLICT    │
        │     (500, Sentry, system-bug)          │
        └────────────────┬───────────────────────┘
                         │
        ┌────────────────▼───────────────────────┐
        │  4 committedRowCount += 1              │
        │  5 ImportJobRow → COMMITTED            │
        └────────────────────────────────────────┘
```

**Why Σ-check moved before INSERT (v2 rationale).** Under per-chunk tx,
throwing at the OLD step 3c rolled back rows 1..N too — directly
contradicting integration test #4's "rows 1..40 COMMITTED, rows 41..50
ERROR" expectation. Σ-check is now a *gate* that decides whether to
INSERT; it never writes Payment for over-allocation rows, so no rollback
is needed. The continue-pattern owns OVER_ALLOCATION end-to-end; AUDIT
M1+M2 closed. This subsumes the now-obsolete §13 Open Q #3.

The normalize-time intra-chunk running tally
(`runningAllocationByInvoiceId` Map fed by the chunk's resolved invoice
ids) remains as an **upstream optimisation** — it lets the FE preview
mark over-allocation rows ERROR before the user ever clicks Commit. The
transactional Σ-check at 3a-c is the authoritative gate; the running
tally is a UX nicety. Acceptance gate §11 #4.

---

## §7 Pathology table — 13 rows

| # | Pathology | Defence | Test location |
|---|---|---|---|
| 1 | Malformed Tally Receipt voucher (missing `<PARTYLEDGERNAME>` or `<DATE>`) | Parser emits row with issues; no FK resolution attempted on missing party-name; row ERROR; commit-blocked? No — only `INVOICE_NOT_FOUND` blocks. User drops row. | `parsers-payments.test.ts` |
| 2 | Payment without `invoiceNumber` (lenient policy) | `matchedBy='NOT_REQUESTED'`; no `PaymentAllocation` inserted; Payment lands; party balance advances via derivation. Integration asserts unallocated payment with `partyId` populated, no allocation row. | integration #5 |
| 3 | 50-row chunk → 1 invoice intra-chunk Σ-overflow (v2) | Per-row 3a-c Σ-check fires; rows 1..N succeed (Σ ≤ grandTotal), rows N+1..50 each `markRowError('OVER_ALLOCATION') + continue`. NO chunk rollback, NO `throw`. Integration asserts split COMMITTED/ERROR counts and never all-pass nor all-fail. | integration #4 |
| 4 | P2002 on `@@unique([paymentId, invoiceId])` synthesised by direct INSERT path | v2 robust catch handles both meta.target shapes; maps to `ALLOCATION_INTERNAL_CONFLICT` 500 + Sentry alert tag. Test asserts 500 response code (NOT 4xx) and Sentry spy called for BOTH array-target AND concatenated-string-target Prisma shapes. | integration #11 |
| 5 | Unknown mode `"Crypto"` + `strictMode=false` | NFKC + lc + trim + ws-collapse → not in dictionary → mode=`OTHER` + WARNING `MODE_UNKNOWN_DEFAULTED`. Row commits. | `payment-mode-map.test.ts` |
| 6 | Unknown mode `"Crypto"` + `strictMode=true` | Same normalisation → not in dictionary → ERROR `MODE_UNKNOWN_STRICT`. Row blocked. | `payment-mode-map.test.ts` + integration #7 |
| 7 | Devanagari mode `"बैंक A/c "` | NFKC + lc + trim + ws-collapse → matches seeded dictionary key → `BANK_TRANSFER`. No issue raised. | `payment-mode-map.test.ts` (Devanagari case) |
| 8 | Two 150-char Razorpay refs differing only in last digit | Tail-truncate keeps last 100 chars; both stored as **distinct** values; WARNING `REFERENCE_TRUNCATED` on each. SCOPE L807 discriminating test. | `payment-utils.test.ts` |
| 9 | Tally `DATE="20250315"` 8-digit raw | Tally adapter pre-formats to `2025-03-15` before shared `parseInvoiceDate`; ISO branch matches; `Payment.date = 2025-03-15`. SCOPE L586. | `parsers-payments.test.ts` (Tally case) |
| 10 | Busy XLSX Excel serial `45291` | xlsx invoked with `{ cellDates: true, dateNF: 'yyyy-mm-dd' }`; library converts to ISO at parse; downstream sees `"2024-01-30"`. | `parsers-payments.test.ts` (Busy case) |
| 11 | `INVOICE_NOT_FOUND` blocks commit | Pre-flight P3 throws `COMMIT_BLOCKED_INVOICE_NOT_FOUND` (409) with `missingInvoiceSample`. NO Payment rows inserted. | integration #3 |
| 12 | Cross-job duplicate `(businessId, partyId, date, amount, mode)` | Preview WARNING `DUPLICATE_PAYMENT`; user resolves SKIP → row excluded from commit; user resolves CREATE_NEW → second Payment row created. | integration #8 |
| 13 | Two parallel POST /commit for same job — fly-create + Σ-guard race | Advisory lock on party (7.1C ARCH M5) + `SELECT FOR UPDATE` on Document serialise. Second commit observes the first's Σ; row-local OVER_ALLOCATION continue for whichever loses. Assert exactly 1 fly-created Party AND deterministic ledger total. | integration #13 |

---

## §8 File Plan — HARD GATE

Every row ≤ 250L. Build phase ordering: API.0 → API.6 → FE.1 → FE.3.

### Backend (`server/`)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 1 | `prisma/schema.prisma` | edit | ~10 | schema | API.0 |
| 2 | `prisma/migrations/<ts>_payment_import_expand/migration.sql` | create | ~20 | migration | API.0 |
| 3 | `src/types/import.types.ts` | edit | ~50 | types | API.1 |
| 4 | `src/constants/import.constants.ts` | edit | ~25 | constants | API.1 |
| 5 | `src/schemas/import.schemas.ts` (Zod adds `'payments'` entity + `strictMode?: boolean`) | edit | ~30 | schema | API.1 |
| 6 | `src/services/import/normalizers/payment-column-dict.constants.ts` (header aliases) | create | ~80 | constants | API.1 |
| 7 | `src/services/import/normalizers/payment-mode-map.constants.ts` (frozen Map seeded EN + Devanagari) | create | ~120 | constants | API.1 |
| 8 | `src/services/import/normalizers/payment-mode-map.ts` (`normaliseKey` + `resolveMode`) | create | ~80 | utils (pure) | API.2 |
| 9 | `src/services/import/normalizers/payment-utils.ts` (`truncateReference` + `REFERENCE_TRUNCATE_FROM='tail'` SSOT + collision-blind-spot comment) | create | ~80 | utils (pure) | API.2 |
| 10 | `src/services/import/normalizers/payment-normalizer.ts` (orchestrator) | create | ~220 | service | API.2 |
| 11 | `src/services/import/parsers/tally-xml.parser.ts` (Receipt voucher branch + 8-digit DATE pre-format) | edit | ~90 | service | API.3 |
| 12 | `src/services/import/parsers/vyapar-csv.parser.ts` (payments header dictionary) | edit | ~50 | service | API.3 |
| 13 | `src/services/import/parsers/busy-xlsx.parser.ts` (ReceiptRegister sheet, `cellDates:true, dateNF:'yyyy-mm-dd'`) | edit | ~60 | service | API.3 |
| 14 | `src/services/import/parsers/generic-csv.parser.ts` (mapping-driven payments) | edit | ~40 | service | API.3 |
| 15 | `src/services/import/parsers/index.ts` (dispatch `['payments', format]` + `ImportEntity` union extend) | edit | ~15 | service | API.3 |
| 16 | `src/services/import/resolvers/payment-invoice-resolver.ts` (chunk preload + `reResolveInvoicesInPlace`) | create | ~150 | service | API.3 |
| 17 | `src/services/import/dedup/payment-dedup.ts` (intra-file map + cross-job SQL) | create | ~140 | service | API.3 |
| 18 | `src/services/import/dedup/index.ts` (dispatcher extend) | edit | ~10 | service | API.3 |
| 19 | `src/services/import/commit-payments/types.ts` (Tx/Args/ChunkResult local types incl. `{ skipped: true }` row-result discriminator) | create | ~70 | types | API.4 |
| 20 | `src/services/import/commit-payments/over-allocation-guard.ts` (Σ-query — pure wrapper around 3a-c; intra-chunk running tally is FE-preview helper, not authoritative gate) | create | ~120 | utils | API.4 |
| 21 | `src/services/import/commit-payments/allocate-one.ts` (per-row Σ-guard → INSERT Payment → INSERT PaymentAllocation; v2 robust P2002 discriminator; row-local markRowError + return `{ skipped: true }`) | create | ~170 | service | API.4 |
| 22 | `src/services/import/commit-payments/commit-payments.service.ts` (chunk tx — sequential for…of, batched audit emit) | create | ~220 | service | API.4 |
| 23 | `src/services/import/commit-dispatcher.ts` (extend `ImportEntity` union + `case 'payments'`) | edit | ~10 | service | API.4 |
| 24 | `src/services/import/commit.service.ts` (sentinel surfaces COMMIT_BLOCKED_INVOICE_NOT_FOUND) | edit | ~20 | service | API.4 |
| 25 | `src/services/import/audit-emit.ts` (add `emitPaymentsImportedBatch` + runtime length-equality assert) | edit | ~50 | service | API.4 |
| 26 | `src/lib/enum-guard.ts` (no-op comment for `Payment.type`) | edit | ~10 | utils | API.4 |
| 27 | `src/routes/imports/create.route.ts` (Zod accepts `'payments'`; per-entity min-client-version → `7.1.3`) | edit | ~15 | route | API.5 |
| 28 | `src/routes/imports/get.route.ts` (polymorphic normalized shape — payments) | edit | ~10 | route | API.5 |
| 29 | `src/routes/payments/list.route.ts` (add `?importJobId=` filter — 5-line `where` extension) | edit | ~10 | route | API.5 |
| 30 | `scripts/enforce-audit-coverage.mjs` (add `payments.imported_batch`) | edit | ~3 | script | API.5 |
| 31 | `scripts/enforce.js` (**v2: CI lint rule bans `Promise.all` across glob `src/services/import/commit-payments/**/*.ts`** — directory-wide, not single-file. AUDIT S1 closed) | edit | ~20 | script | API.5 |
| 32 | `tests/fixtures/import/payments/tally-sample.xml` (8 vouchers; 8-digit DATE; Devanagari mode) | create | n/a | fixture | API.6 |
| 33 | `tests/fixtures/import/payments/vyapar-sample.csv` (50 rows incl. unallocated + duplicate triple) | create | n/a | fixture | API.6 |
| 34 | `tests/fixtures/import/payments/busy-sample.xlsx` (ReceiptRegister; serial 45291) | create | n/a | fixture | API.6 |
| 35 | `tests/fixtures/import/payments/generic-sample.csv` (**50 receipts × Rs 250 → 1 invoice grandTotal Rs 10k** for Σ-overflow test — v2 fixture spec) | create | n/a | fixture | API.6 |
| 36 | `tests/fixtures/import/payments/devanagari-modes.csv` (नकद, यूपीआई, बैंक A/c) | create | n/a | fixture | API.6 |
| 37 | `tests/unit/import/payment-mode-map.test.ts` (NFKC + lc + trim + ws-collapse; Devanagari + casing + spacing variants; unknown defaulted; strictMode rejected) | create | ~130 | test | API.6 |
| 38 | `tests/unit/import/payment-utils.test.ts` (tail-truncate; 100-char boundary; two-150-char-differ-in-tail DISTINCT) | create | ~90 | test | API.6 |
| 39 | `tests/unit/import/payment-normalizer.test.ts` | create | ~140 | test | API.6 |
| 40 | `tests/unit/import/payment-invoice-resolver.test.ts` (stale-snapshot re-resolve; AMBIGUOUS; NOT_REQUESTED short-circuit) | create | ~110 | test | API.6 |
| 41 | `tests/unit/import/parsers-payments.test.ts` (4 formats × happy/malicious; Tally 8-digit DATE; Busy serial 45291) | create | ~180 | test | API.6 |
| 42 | `tests/unit/import/over-allocation-guard.test.ts` (3a-c gate semantics; running-tally upstream optimisation) | create | ~110 | test | API.6 |
| 42b | `tests/unit/import/allocate-one-p2002.test.ts` (**v2 new — AUDIT S2 closed**: covers BOTH Prisma meta.target shapes — array `['paymentId','invoiceId']` AND concatenated string `'PaymentAllocation_paymentId_invoiceId_key'`; asserts ALLOCATION_INTERNAL_CONFLICT 500 + Sentry spy in both cases) | create | ~90 | test | API.6 |
| 43 | `tests/integration/import-payments.test.ts` (13-scenario suite — see §11) | create | ~250 | test | API.6 |
| 44 | `tests/integration/import-payments-race.test.ts` (split — scenarios #13 + Σ-guard concurrency) | create | ~140 | test | API.6 |
| 45 | `src/lib/translations.en.ts` (`import.payment.*` ≈ 22 keys + issue copy) | edit | ~50 | translation | FE.1 |
| 46 | `src/lib/translations.hi.ts` | edit | ~50 | translation | FE.1 |

### Frontend (`src/features/import/`)

| # | Path | Action | Est. Lines | Layer | Build phase |
|---|---|---|---|---|---|
| 47 | `src/features/import/types/import.types.ts` (extend with `NormalizedPayment` + `PaymentIssueCode`) | edit | ~40 | types | FE.1 |
| 48 | `src/features/import/constants/import.constants.ts` (payment format labels + mode chip colors) | edit | ~20 | constants | FE.1 |
| 49 | `src/features/import/services/import.service.ts` (`entityLabel: \`Payments: \${fileName}\``) | edit | ~10 | service | FE.1 |
| 50 | `src/features/import/components/EntityPicker.tsx` (add "Import Payments" tile — 4th) | edit | ~25 | sub-component | FE.2 |
| 51 | `src/features/import/components/FormatPicker.tsx` (payment-entity copy + 4 format options) | edit | ~20 | sub-component | FE.2 |
| 52 | `src/features/import/components/StrictModeToggle.tsx` (NEW — checkbox for `strictMode=true` in upload form; visible only when entity='payments') | create | ~80 | sub-component | FE.2 |
| 53 | `src/features/import/components/PaymentRowCard.tsx` (NEW — party chip + invoice chip OR "Unallocated/advance" pill + mode badge + amount + reference + issue chips) | create | ~220 | sub-component | FE.2 |
| 54 | `src/features/import/components/CommitBlockedBanner.tsx` (extend — accepts `kind: 'PRODUCT' \| 'INVOICE'`; payments deep-link to invoices import) | edit | ~30 | sub-component | FE.2 |
| 55 | `src/features/import/components/PreviewRowCard.tsx` (delegate to `PaymentRowCard` when entity='payments') | edit | ~15 | sub-component | FE.2 |
| 56 | `src/features/import/components/PreviewTable.tsx` (entity-aware columns — payment has Date · Party · Mode · Amount · Invoice · Issues) | edit | ~25 | sub-component | FE.2 |
| 57 | `src/features/import/hooks/useCommitBlockSentinel.ts` (extend — INVOICE_NOT_FOUND deep-link target) | edit | ~20 | hook | FE.2 |
| 58 | `src/features/import/pages/ImportUpload.tsx` (StrictModeToggle wired when entity='payments') | edit | ~30 | page | FE.3 |
| 59 | `src/features/import/pages/ImportJobPage.tsx` (commit CTA disabled state when CommitBlockedBanner shows; summary link `/payments?importJobId=`) | edit | ~30 | page | FE.3 |
| 60 | `src/features/import/import.css` (payment-row layout, mode-badge styles — token-only) | edit | ~40 | css | FE.3 |

**Totals (production code, excluding tests/fixtures/translations):**

Rows 6, 7, 8, 9, 10, 16, 17, 19, 20, 21, 22, 52, 53 (new files):
80 + 120 + 80 + 80 + 220 + 150 + 140 + 70 + 120 + 170 + 220 + 80 + 220 = **1740L**.

Largest single new file: `commit-payments.service.ts` at 220L (under
250L cap). Largest test file: `import-payments.test.ts` at 250L (at cap);
race scenarios split into row 44 to stay under.

**Build-phase ordering:**

- **API.0** schema + migration (high-risk-path gate first).
- **API.1** types / constants / Zod / payment-column-dict / payment-mode-map constants / translations skeleton.
- **API.2** pure utils — `payment-mode-map.ts`, `payment-utils.ts`, `payment-normalizer.ts`.
- **API.3** parsers + invoice-resolver + dedup.
- **API.4** commit-payments service (split into 4 files — types, over-allocation-guard, allocate-one, commit-payments.service) + dispatcher extend + audit emit + enum-guard comment.
- **API.5** routes + audit-coverage script + **v2 CI lint rule banning `Promise.all` across `src/services/import/commit-payments/**/*.ts` (File Plan row 31)**.
- **API.6** fixtures + unit + integration tests (split into 2 files; row 42b adds the v2 P2002 dual-shape unit test).
- **FE.1** types/constants/service/translations.
- **FE.2** sub-components incl. `StrictModeToggle` and `PaymentRowCard`.
- **FE.3** pages + css.

First build-agent action: `git status` on the 60+ paths; scaffold empty
stubs for every `create` row before any logic.

---

## §9 FE plan — diff against 7.1B/C

### Entity picker (File Plan #50)

`EntityPicker.tsx` already renders Parties + Products + Invoices tiles
(7.1B/C). Add a fourth tile "Import Payments" with the same `<Card>` +
`<Button variant="primary">` shell. Route:
`/import/upload?entity=payments`.

### `<PaymentRowCard>` (NEW, File Plan #53)

Single-row card (no accordion — payments are flat):

| Column | Source | Display |
|---|---|---|
| Date | `normalized.date` | `formatDate(iso, locale)`, `tabular-nums` |
| Party | `normalized.partyResolved.source.name` + chip | `<PartyAvatar/>` + name; chip = `EXISTING` / `FLY_CREATE` / `NAME_ONLY` |
| Mode | `normalized.mode` + `modeDefaulted` flag | `<Badge variant="info">` per resolved mode; if `modeDefaulted` shows `OTHER` chip with `aria-label="auto-defaulted"` |
| Amount | `normalized.amountPaise` | `formatCurrency(paise)`, `tabular-nums` |
| Invoice | `normalized.invoiceMatch.documentId` OR `'NOT_REQUESTED'` | If `BY_NUMBER` → invoice-number chip deep-linking to `/invoices/<id>`; if `NOT_REQUESTED` → "Advance" pill (`<Badge variant="default">`); if `NOT_FOUND`/`AMBIGUOUS` → error chip |
| Reference | `normalized.referenceNumber` + `referenceTruncated` | Truncated 16 chars with tooltip showing full stored value; warning chip if `referenceTruncated` |
| Issues | `row.issues[]` | Chips `<Badge variant="error\|warning">` per code; copy from `t.import.payment.issues.<code>` |

Mobile: full-width card. Tablet+: 2-col grid (PreviewTable). Touch target
≥ 44px on chips. Dark-mode parity via tokens. PAGE_AUDIT_CHECKLIST A-N
applies.

### `<StrictModeToggle>` (NEW, File Plan #52)

Single checkbox in upload form, visible only when entity='payments':

> ☐ **Strict mode** — reject rows with unknown payment modes
> (default off; recommended for clean ledgers).

Selection sent in `POST /api/imports` body field `strictMode: boolean`.
Wired as `?strictMode=true` query when checked (SCOPE L313-317).

### `<CommitBlockedBanner>` (extended, File Plan #54)

Existing 7.1C component gains a `kind` prop. For payments:

> **{count} invoices not found in HisaabPro.** Import invoices first or
> drop the affected payment rows.
> [**Import Invoices**] — deep-link to
> `/import?entity=invoice&resumeImportJobId=${currentJobId}`

Round-trip CTA on the invoice-import summary page (`?resumeImportJobId=…`)
mirrors 7.1C ARCH S3 — adds case for back-link to payment job.

Disables "Commit Import" CTA — `<Button disabled aria-disabled="true">`.

### Offline contract (unchanged)

`entityType: 'import'`, `entityLabel: \`Payments: \${fileName}\``,
`excludeFromOfflineQueue: true`. Mutation handlers tolerate `{}` return.

---

## §10 PR sequence — 6 independently-mergeable PRs

| PR | Title | Files | Gate |
|----|---|---|---|
| **PR-D0** | `feat(import): payment schema + migration A (expand-only)` | 1, 2 | Migration runs on shadow DB; tsc clean; lands behind `FEATURE_DATA_IMPORT=false`. **High-risk-path approved plan required.** |
| **PR-D1** | `feat(import): payment dispatcher + types/constants/zod + mode-map` | 3, 4, 5, 6, 7, 8, 19, 23, 26, 30, 31, 37 | tsc clean; `payment-mode-map.test.ts` green (NFKC/Devanagari/strictMode/spacing variants); v2 CI lint rule (row 31, directory glob) loads; `commit-payments.service.ts` stub throws `NOT_IMPLEMENTED`. |
| **PR-D2** | `feat(import): payment parsers + normalizer + utils + Tally pre-format + Busy cellDates` | 9, 10, 11, 12, 13, 14, 15, 32-36, 38, 39, 41 | All unit suites pass; parsers handle XXE + zip-bomb (reused from 7.1A); Tally 8-digit DATE asserts `2025-03-15`; Busy serial `45291` asserts ISO. No DB writes. |
| **PR-D3** | `feat(import): invoice-resolver + commit-payments (chunk tx) + Σ-guard-before-INSERT + P2002 mapping + dedup + audit` | 16, 17, 18, 20, 21, 22, 24, 25, 40, 42, 42b, 43, 44 | Integration #1-#13 pass incl. 50→1 fixture (#4 — v2 expected output: 40 COMMITTED + 10 OVER_ALLOCATION continue) + P2002→`ALLOCATION_INTERNAL_CONFLICT` (#11) + parallel race (#13); `enforce-audit-coverage --block` clean; v2 CI lint asserts no `Promise.all` anywhere under `commit-payments/`. |
| **PR-D4** | `feat(import): routes accept entity='payments' + per-entity min-client-version + ?importJobId= filter` | 27, 28, 29 | Route Zod accepts new entity; `requireMinClientVersion` returns 426 for `7.1.2`; `GET /api/payments?importJobId=` returns scoped results; server-side feature flag flips on for cohort=0 (still disabled in prod). |
| **PR-D5** | `feat(import): FE Payments tile + PaymentRowCard + StrictModeToggle + CommitBlockedBanner ext` | 45-60 | Screenshots × 4 UI states; 320px no overflow; LCP <2.5s on preview; per-route chunk ≤100KB gz; enforce-offline clean; PAGE_AUDIT_CHECKLIST A-N pass; invoice-deep-link round-trip manual gate. |

Each PR ships behind the existing `FEATURE_DATA_IMPORT` flag (cohort=0).
PR-D5 is the visibility flip; flag itself doesn't change until pilot.

---

## §11 Acceptance gates

`tsc -b --noEmit` clean, `node scripts/enforce.js` 0 errors,
`node scripts/enforce-audit-coverage.mjs --block` exit 0,
`node scripts/enforce-offline.mjs` exit 0,
**`scripts/enforce.js` lint rule `no-promise-all-in-commit-payments` exit 0
(v2 — directory-wide glob)**.

### Unit tests (must all pass — green CI)

- `payment-mode-map.test.ts` — 12 cases: 6 EN dictionary hits, 3 Devanagari hits, 1 spacing/casing edge (`"BANK A/C "`), 1 unknown defaulted, 1 unknown strictMode rejected
- `payment-utils.test.ts` — 5 cases: empty/null/short/exact-100/over-100 truncation; 2 150-char refs differing in last digit assert DISTINCT stored values (SCOPE L807)
- `payment-normalizer.test.ts` — 8 cases covering each issue code on the normalize path
- `payment-invoice-resolver.test.ts` — 5 cases: NOT_REQUESTED short-circuit, BY_NUMBER hit, NOT_FOUND, AMBIGUOUS (legacy seed), stale-snapshot re-resolve
- `parsers-payments.test.ts` — 4 formats × happy + 2 malicious + Tally 8-digit DATE assert + Busy serial 45291 assert
- `over-allocation-guard.test.ts` — 4 cases: empty invoice + full amount OK; partial existing + small new OK; partial existing + over new → row-local ERROR (NO throw, NO chunk rollback); intra-chunk running tally is upstream UX nicety only
- **`allocate-one-p2002.test.ts` (v2 new)** — 2 cases: P2002 with `meta.target = ['paymentId','invoiceId']` → ALLOCATION_INTERNAL_CONFLICT 500 + Sentry spy; P2002 with `meta.target = 'PaymentAllocation_paymentId_invoiceId_key'` → same outcome. AUDIT S2 closed.

### Integration suite — `tests/integration/import-payments.test.ts` + `import-payments-race.test.ts`

13 scenarios:

1. **50-row payments CSV happy path** — 50 rows → 50 Payments + variable PaymentAllocations; assert 1 `payments.imported_batch` audit row per chunk with parallel arrays length = committed count; `importJobId`+`importedBy` populated; per-payment provenance reconstructable via `Payment.importJobId = jobId` join.
2. **Idempotent commit replay** — same `Idempotency-Key` + `commitToken` → cached response, row counts unchanged.
3. **Commit-blocked sentinel (INVOICE_NOT_FOUND)** — upload with unknown invoice number → preview shows row ERROR → POST commit → `409 COMMIT_BLOCKED_INVOICE_NOT_FOUND` with `missingInvoiceSample`. Zero `Payment` rows persist.
4. **50-payments-to-1-invoice Σ-overflow (v2 expected output)** — generic-sample.csv (row 35): 50 receipts × Rs 250 → invoice grandTotal Rs 10,000. **Assert:**
   - First 40 rows commit (Σ reaches exactly Rs 10,000 after row 40: 40 × 250 = 10,000)
   - Rows 41-50 each row-local ERROR `OVER_ALLOCATION` + continue (NO chunk rollback, NO throw)
   - DB end-state: **40 Payment rows + 40 PaymentAllocation rows**
   - **10 ImportJobRow rows with status='ERROR'** carrying `OVER_ALLOCATION` issue code
   - `ImportJob.committedRowCount = 40`
   - **Exactly 1 `payments.imported_batch` audit row** with `paymentIds.length = 40` (parallel arrays length = 40)
   - **NEVER all-pass, NEVER all-fail, NEVER chunk rollback** (SCOPE MUST_SHIP #1 anchor, SCOPE L636 + L812, AUDIT M1+M2 anchor).
5. **Unallocated payment (lenient)** — vyapar-sample.csv row with empty `Invoice No` → `matchedBy='NOT_REQUESTED'`; Payment created with `partyId`; NO `PaymentAllocation` row; party ledger derivation shows advance.
6. **Fly-create routes through `createPartyTx()` (verbatim 7.1C ARCH M2)** — seed no party, upload, assert Party row carries `importJobId`+`importedBy`; legacy `createParty()` path tx-wraps (regression check).
7. **Strict-mode unknown mode rejected** — upload `"Crypto"` mode + `strictMode=true` → preview ERROR `MODE_UNKNOWN_STRICT` → commit excludes the row OR blocks (per resolution policy).
8. **Cross-job duplicate WARNING + resolution** — seed Payment `(partyA, 2025-03-15, 50000, CASH)`; upload contains same triple → preview WARNING; SKIP resolution excludes; CREATE_NEW resolution creates second Payment.
9. **Cross-tenant invoice resolution** — business A uploads, business B has invoice `INV-001` — resolver returns NOT_FOUND for A despite identical number in B. Debug-build companion: remove `businessId=$1` → test fails.
10. **Amount overflow + negative + zero** — three rows: `amount = 2_200_000_000` → ERROR `AMOUNT_OUT_OF_RANGE`; `amount = -1` → ERROR `AMOUNT_NEGATIVE`; `amount = 0` → ERROR `AMOUNT_NEGATIVE` (Resolved Decision #7 — strictly > 0).
11. **P2002 → ALLOCATION_INTERNAL_CONFLICT (5xx, not 4xx) — both meta.target shapes** — synthesise twice in `allocate-one.ts`: (a) `e.meta.target = ['paymentId','invoiceId']` array form; (b) `e.meta.target = 'PaymentAllocation_paymentId_invoiceId_key'` string form. Both assert 500 response with `error.code='ALLOCATION_INTERNAL_CONFLICT'` AND Sentry spy called with `severity:'system_bug'` tag (SCOPE MUST_SHIP #2 anchor, AUDIT S2 closed).
12. **DPDP uploader erasure** — `Payment.importedBy` → NULL via FK SetNull; `Payment.partyId` Restrict preserves fly-created Party (mirrors 7.1C invoice DPDP path).
13. **Parallel commit fly-create + Σ-guard race** — two concurrent POST /commit for same job (different per-request Idempotency-Keys). One advances first under `pg_advisory_xact_lock` + `SELECT FOR UPDATE`; second observes the first's allocation Σ and rows that would overflow get row-local OVER_ALLOCATION + continue. Assert exactly 1 fly-created Party AND deterministic final allocation total (≤ grandTotal).

### FE acceptance gates (PR-D5)

- Screenshots × 4 UI states on `PaymentRowCard` (allocated + unallocated)
- 320px no horizontal overflow on `<PaymentRowCard>` with 12-char party name + truncated 100-char ref tooltip
- LCP < 2.5s on preview page with 200-payment payload
- Per-route chunk gzipped ≤ 100KB
- PAGE_AUDIT_CHECKLIST A-N pass — token-only colors, no `z-50` literals, all strings in en+hi
- Dark-mode parity (auto via tokens)
- Invoice-deep-link round-trip manually verified (payment → CommitBlockedBanner → import invoices → back to payment job)
- StrictModeToggle persists across page reload of the upload form (component-local state; not query-param)

---

## §12 SCOPE Conformance Map — HARD GATE

| SCOPE decision (line ref) | Architecture artifact | Status |
|---|---|---|
| `entity='payments'` discriminator (L51) | §1 dispatcher + Zod #5 + File Plan #5, 23 | OK |
| Lenient allocation policy (L53, L153) | §2.5 precedence #1 + §6 step 3 conditional + integration #5 | OK |
| Closed mode dictionary, no fly-create (L54, L156, L170) | §2.3 + File Plan #7, 8 + tests #37 | OK |
| Over-allocation guard 4xx + `Σ` derivation (L55, L162) — **v2: row-local continue, NO chunk rollback** | §2.6 + §6 step 3a-c (BEFORE INSERT) + File Plan #20 + integration #4 (v2 expected output) | OK |
| Cross-job duplicate WARNING (L56, L161) | §2.7 cross-job + File Plan #17 + integration #8 | OK |
| Intra-file duplicate WARNING (L57, L160) | §2.7 intra-file + File Plan #17 | OK |
| Sentinel 409 `COMMIT_BLOCKED_INVOICE_NOT_FOUND` (L58, L173) | §2.8 pre-flight P3 + §6 + integration #3 + FE #54 | OK |
| `Payment.importJobId`+`importedBy` additive (L59, L164, L213-216) | §3 Migration A + §4 precondition + File Plan #1, #2 | OK |
| Batched audit `payments.imported_batch` with parallel arrays (L60, L166) | §2.8 step 6 + File Plan #25 + audit-coverage script #30 + integration #1 | OK |
| `GET /api/payments?importJobId=` filter (L61, L368) | File Plan #29 (5-line route edit) | OK |
| `EntityPicker` 4th tile + `PaymentRowCard` (L62) | §9 + File Plan #50, #53 | OK |
| `strictMode` opt-in (L63, L313-317) | §2.3 + Zod #5 + File Plan #52 StrictModeToggle + integration #7 | OK |
| Inherited security envelope (L67-82) | §1 inheritance table | OK |
| PAYMENT_IN only — Resolved Decision #1 (L152) | §6 step 3d `type: 'PAYMENT_IN'` constant + File Plan #22 | OK |
| Lenient allocation — Resolved Decision #2 (L153) | §2.5 + integration #5 | OK |
| Multi-allocation out of scope — Resolved Decision #3 (L154) | §2.5 precedence #2 + Tally parser comma check + File Plan #11 | OK |
| Party resolution `MATCH_OR_FLY_CREATE` default (L155) | §1 inherit + 7.1C `party-resolver.ts` verbatim | OK |
| Mode mapping closed, no fly-create — Resolved Decision #5 (L156) | §2.3 + File Plan #7, 8 | OK |
| Amount Int paise + `narrowPaiseToInt` — Resolved Decision #6 (L157) | §1 inherit + §2.2 + integration #10 | OK |
| Amount strictly > 0 — Resolved Decision #7 (L158) | §2.2 (amount===0 → AMOUNT_NEGATIVE) + integration #10 | OK |
| Date parser reused; field `Payment.date` — Resolved Decision #8 (L159) | §1 inherit + §4 precondition #6 + File Plan #11 | OK |
| Intra-file dedup triple — Resolved Decision #9 (L160) | §2.7 + File Plan #17 | OK |
| Cross-job dedup with mode — Resolved Decision #10 (L161) | §2.7 + integration #8 | OK |
| Σ-guard FOR UPDATE — Resolved Decision #11 (L162) — **v2: BEFORE Payment INSERT** | §2.6 + §6 step 3a-c + integration #4 | OK |
| No `Document.amountReceived` mutation — Resolved Decision #12 (L163) | §4 precondition #13 (column doesn't exist; schema verified) | OK |
| Migration additive only — Resolved Decision #13 (L164) | §3 | OK |
| Chunk 200 / per-chunk tx — Resolved Decision #14 (L165) | §2.8 + §6 — **architecture follows 7.1C per-chunk-tx** (mirror); SCOPE L165 says "per-row tx inside chunk" — see §13 Deviation #1 | DEVIATED |
| Batched audit emitter + length-equality assert — Resolved Decision #15 (L166) | §2.8 step 6 + File Plan #25 runtime assert | OK |
| Conditional `PaymentAllocation` INSERT — Resolved Decision #16 (L167) | §6 step 3e (CONDITIONAL on `BY_NUMBER`) | OK |
| Strict invoice match by lower(documentNumber) — Resolved Decision #17 (L168) | §2.5 + File Plan #16 | OK |
| Case-insensitive invoice match — Resolved Decision #18 (L169) | §2.5 SQL `lower(documentNumber)` | OK |
| Mode dictionary normalised key (NFKC + lc + trim + ws) — Resolved Decision #19 (L170) | §2.3 `normaliseKey` + tests #37 | OK |
| Allocation = payment amount (one-to-one) — Resolved Decision #20 (L171) | §6 step 3e `amount: payment.amount` | OK |
| `PaymentAllocation` cascade on hard-delete only — Resolved Decision #21 (L172) | §4 precondition #12 + soft-delete by `importJobId` is the bulk-delete path | OK |
| Sentinel block on INVOICE_NOT_FOUND — Resolved Decision #22 (L173) | §6 P3 + integration #3 | OK |
| `?importJobId=` filter mechanical — Resolved Decision #23 (L174) | File Plan #29 | OK |
| `clientVersion >= 7.1.3` server-enforced — Resolved Decision #24 (L175) | §1 row 4 + File Plan #27 + integration #11 (analogous to 7.1C #11) | OK |
| Tail-truncate to LAST 100 chars — Resolved Decision #25 (L176) | §2.4 + File Plan #9 `REFERENCE_TRUNCATE_FROM='tail'` constant + test #38 + collision-blind-spot comment (AUDIT S3) | OK |
| SEQUENTIAL for…of, NEVER `Promise.all` — Resolved Decision #26 (L177, MUST_SHIP #1) | §2.8 + File Plan #22 + **v2 CI lint rule #31 (directory glob)** + integration #4 (50→1) | OK |
| `ALLOCATION_INTERNAL_CONFLICT` 5xx distinct from `OVER_ALLOCATION` 4xx — Resolved Decision #27 (MUST_SHIP #2) | §2.6 catch block (v2 robust dual-shape) + §5 error codes + integration #11 + File Plan #42b | OK |
| Tally 8-digit DATE pre-format — Resolved Decision #28 (L179) | §2.1 Tally row + File Plan #11 + parsers test (Tally case) | OK |
| Busy XLSX `cellDates:true, dateNF:'yyyy-mm-dd'` — Resolved Decision #29 (L180) | §2.1 Busy row + File Plan #13 + parsers test (Busy case) | OK |
| Failure mode #1 provider outage | §1 inherit | OK |
| Failure mode #2 abuse spike | §1 rate-limit envelope inherit | OK |
| Failure mode #3 DB bloat | §1 cron + alert on >50k Payment per importJobId (§3 ADR-stub) | OK |
| Failure mode #4 client lag | §1 row 4 (7.1.3 floor) + integration #11 | OK |
| Failure mode #5 DPDP | §4 precondition #4 + #11 + integration #12 | OK |
| Failure mode #6 cost runaway | §2.8 chunk cap + Sentry alert `import_commit.duration_p99_ms{entity='payments'}` > 20s | OK |
| Failure mode #7 insider abuse | §6 step 3d createdBy + importJobId + immutable batched audit + cross-tenant WHERE businessId | OK |
| ARCH AUDIT M1 (closed v2) — Σ-check BEFORE INSERT, row-local continue | §2.6 + §6 step 3a-c + integration #4 | OK |
| ARCH AUDIT M2 (closed v2) — test #4 expectations under continue-pattern | §11 integration #4 (v2 expected output) | OK |
| ARCH AUDIT S1 (closed v2) — lint glob directory-wide | File Plan #31 (`commit-payments/**/*.ts`) | OK |
| ARCH AUDIT S2 (closed v2) — P2002 dual-shape discriminator + test | §2.6 catch + §6 step 3e + File Plan #42b | OK |
| ARCH AUDIT S3 (closed v2) — tail-truncation collision comment | §2.4 inline comment | OK |
| SCOPE AUDIT M1 (closed) — intra-chunk sequential | §2.8 + CI lint + integration #4 | OK |
| SCOPE AUDIT M2 (closed) — P2002 distinct 5xx | §2.6 + integration #11 | OK |
| SCOPE AUDIT M3 (closed) — tail-truncation | §2.4 + test #38 | OK |
| SCOPE AUDIT S4 (closed) — NFKC+lc+trim+ws mode normalisation | §2.3 + tests #37 | OK |
| SCOPE AUDIT S5 (closed) — strictMode opt-in | §2.3 + File Plan #5, #52 | OK |
| SCOPE AUDIT S6 (closed) — Tally 8-digit DATE | §2.1 + Resolved Decision #28 | OK |
| SCOPE AUDIT S7 (closed) — Busy cellDates | §2.1 + Resolved Decision #29 | OK |

---

## §13 Deviations from SCOPE

1. **Per-chunk tx (vs SCOPE Resolved Decision #14 "per-row tx inside chunk")** — Same deviation that 7.1C made (7.1C Deviation #3). Prisma's `Tx` cannot host a nested `tx.$transaction(...)`; the dispatcher contract `(tx, args) => ChunkResult` forces per-chunk topology. 7.1D mirrors 7.1C verbatim for symmetry across the import engine. Trade-off: 200-row chunk rollback blast radius (vs 1 row) on **unexpected** errors — but OVER_ALLOCATION is no longer one of those (v2 row-local continue at §6 step 3c). The chunk only rolls back on truly unrecoverable errors (`ALLOCATION_INTERNAL_CONFLICT` 5xx system bug, `CONCURRENT_COMMIT_RACE`, infrastructure failure). Reverse decision = lift per-row tx to orchestrator — rejected: breaks dispatcher symmetry with 7.1A/B/C.
2. **Mode issue code naming — `MODE_UNKNOWN_DEFAULTED` vs SCOPE L282 `MODE_DEFAULTED`** — adopted `MODE_UNKNOWN_DEFAULTED` for symmetry with `MODE_UNKNOWN_STRICT`. Naming-only deviation; behaviour identical. Translation keys + error catalogue use the longer name. Reverse decision = adopt SCOPE name — rejected on naming asymmetry with strict variant.
3. **Tail-truncation accepts theoretical reference-collision blind spot** — two distinct 150-char refs sharing identical trailing 100 chars store as the same `Payment.referenceNumber`. SCOPE accepts (Resolved Decision #25 + L807). DUPLICATE_PAYMENT dedup key (date,party,amount,mode) does NOT include reference, so no false-positive dedup. The §2.4 inline comment forbids adding `@@unique([businessId, referenceNumber])` later — would 500-error legitimate distinct truncated refs. Reverse decision = SHA256 fingerprint column — deferred to FUTURE_EPIC F1 (audit recommendation).
4. **1740 LOC vs ~1495 LOC of 7.1C** — production-code estimate is slightly larger due to the `commit-payments/` split into 4 files (types, over-allocation-guard, allocate-one, commit-payments.service) to keep each under 250L. v2 grew allocate-one.ts by ~20L for the robust P2002 dual-shape catch. Architecture judgement: better than a single 400L commit-payments service. Reverse decision = collapse `allocate-one.ts` into `commit-payments.service.ts` — rejected: would push commit-payments.service.ts to ~390L (over cap).

No other deviations.

---

## §14 v2 Revision Log

Audit ref: `ARCHITECTURE_AUDIT_PHASE7_IMPORT_7_1D.md` (BLOCK, 2 MUST_SHIP + 3 SHOULD_SHIP). All 5 gaps folded; expect re-audit PASS.

| Fold | Audit ref | Gap | Resolution | Sections touched |
|------|-----------|-----|------------|------------------|
| **F1** | AUDIT M1 | OVER_ALLOCATION throw at §6 step 3c rolled back rows 1..N too; contradicted integration test #4. | Re-ordered §6 per-row steps: 3a SELECT FOR UPDATE → 3b SUM existing → **3c Σ-guard BEFORE Payment INSERT, row-local `markRowError + continue` on fail (NO throw, NO chunk rollback)** → 3d INSERT Payment → 3e INSERT PaymentAllocation (with P2002 catch). Step 4 (`committedRowCount++`) and step 5 (`ImportJobRow → COMMITTED`) only reached on full pass. Removed obsolete dead `throw OVER_ALLOCATION` text. Removed §13 Open Q #3 (resolved by continue-pattern). Added v2 step-order diagram. | §2.6, §6 (full), §13, §14 |
| **F2** | AUDIT M2 | Integration test #4 expected output incompatible with throw pattern. | Rewrote integration #4 with concrete v2 fixture spec: 50 receipts × Rs 250 → invoice grandTotal Rs 10k. Asserts: first 40 rows commit (Σ reaches Rs 10k at row 40); rows 41-50 each `OVER_ALLOCATION` row-local ERROR + continue. End-state: 40 Payment rows + 40 PaymentAllocation rows + 10 ImportJobRow ERROR; `committedRowCount = 40`; exactly 1 batched audit row carrying `paymentIds.length = 40`. No chunk rollback. Updated File Plan #35 fixture spec to match. | §11 integration #4, File Plan #35 |
| **F3** | AUDIT S1 | CI lint glob in File Plan #31 covered only `commit-payments.service.ts`; refactor moving the loop into `allocate-one.ts` would silently poison the lint. | Broadened lint glob to directory: `src/services/import/commit-payments/**/*.ts`. Updated §2.8 + §11 + PR-D1 gate language to reflect directory-wide enforcement. | File Plan #31, §2.8, §11, §10 PR-D1/PR-D3 |
| **F4** | AUDIT S2 | P2002 discriminator (`Array.isArray(target) && target.includes(...)`) fragile to Prisma version returning concatenated string form. | Updated §2.6 + §6 step 3e catch to robust dual-shape: `const t = e.meta?.target; const key = Array.isArray(t) ? t.join('_') : String(t ?? ''); const isAllocUnique = key === 'PaymentAllocation_paymentId_invoiceId_key' \|\| (key.includes('paymentId') && key.includes('invoiceId'))`. Verified `schema.prisma:1270-1333` shows Payment-level uniques are `offlineId` (1272) and `reversesPaymentId` (1296) — both written as `null` by import, so any P2002 on Payment INSERT is a true bug and re-raises through `throw e`. Added File Plan row #42b: `tests/unit/import/allocate-one-p2002.test.ts` covering BOTH meta.target shapes. Added §4 precondition #18 documenting `offlineId` uniqueness. Integration #11 now exercises both shapes. | §2.6, §6 step 3e, §4 precondition #18, File Plan #21 (~+20L), File Plan #42b (new), §11 integration #11 |
| **F5** | AUDIT S3 | Tail-truncation collision blind spot — no protection against builder later adding `@@unique([businessId, referenceNumber])`. | Added inline comment to §2.4 `truncateReference`: `// NOTE: tail-100 truncation can collide if two refs share trailing 100 chars; dedup key (date,party,amount,mode) does NOT include reference; do NOT add @@unique([businessId, referenceNumber]) — would 500-error legitimate distinct truncated refs.` Promoted to §13 Deviation #3 with FUTURE_EPIC F1 reference. | §2.4 comment, §13 Deviation #3 |

**Net diff against v1:** +120L of architecture text, +1 File Plan row (#42b), +1 §4 precondition (#18), 5 sections rewritten. No SCOPE Conformance Map row regressed (all OK except the long-standing §14 deviation). Zero new BLOCKers introduced.

---

## Failure-Mode Implementation (extends 7.1A §16 + 7.1B + 7.1C)

| Failure mode | SCOPE mitigation | Architecture site |
|---|---|---|
| 1. Postgres outage | upload 503; in-flight resume idempotent | §1 + 7.1A §16 unchanged |
| 2. Abuse spike | 5/hr 20/day per business; 1-active-job across entities; chunk 200 cap | §1 + Resolved Decision #14 |
| 3. DB bloat | cleanup cron NULLs `ImportJobRow.raw`/`.normalized` 24h post-commit; `Payment` + `PaymentAllocation` permanent ledger; alert at >50k Payment per `importJobId` | §3 ADR-stub + Failure-mode SCOPE #3 |
| 4. Client-version lag | `requireMinClientVersion('7.1.3')` for payment routes; 426 for older | §1 row 4 + integration #11 analog |
| 5. DPDP erasure | Payment rows business-owned (no-op on amount/date/mode); fly-created party preserved (Document.partyId Restrict); `Payment.importedBy` SetNull; `Payment.partyId` Restrict | §4 precondition #4 + #11 + integration #12 |
| 6. Cost runaway | 200-chunk cap; chunk tx; batched audit reduces 200 writes/chunk → 1; `import_commit.duration_p99_ms{entity='payments'}` Sentry alert > 20s | §2.8 + §6 step 6 + Failure-mode SCOPE #6 |
| 7. Insider abuse | every Payment carries `createdBy=userId` + `importJobId`; immutable `payments.imported_batch` audit; soft-delete only; cross-tenant `WHERE businessId=$1` predicate (integration #9) | §6 step 3d, 6 + §1 + integration #9 |

---

## Open questions for architecture-auditor (v2)

1. **Migration A non-`CONCURRENTLY`** — acceptable on pilot business (Payment row count < 20k). ADR-stub at top of migration file flags v2-with-CONCURRENTLY when row count crosses 1M. Confirm.
2. **`MODE_UNKNOWN_DEFAULTED` rename vs SCOPE L282 `MODE_DEFAULTED`** — naming-only deviation logged in §13 #2. If auditor prefers SCOPE name, mechanical rename. Confirm.
3. ~~OVER_ALLOCATION throw vs row-local marking~~ — **RESOLVED in v2.** §6 step 3c uses row-local `markRowError + continue`. Σ-guard runs BEFORE Payment INSERT, so no rollback needed. Continue-pattern owns OVER_ALLOCATION end-to-end. AUDIT M1+M2 closed.

---

End of architecture (v2).
