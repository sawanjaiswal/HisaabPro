---
status: approved
feature: gst-phase-2
created: 2026-05-03T18:10:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/services/auth.service.ts
  - server/src/lib/jwt.ts
  - server/src/config/secrets.nic.ts
agents_invoked:
  - scope-writer (output: docs/SCOPE_gst_phase_2.md)
  - architect (output: docs/ARCHITECTURE_gst_phase_2.md)
acceptance:
  backend:
    - tsc clean across server + client
    - npx prisma migrate dev --name gst_phase_2_fields runs cleanly on a fresh DB
    - curl PATCH /api/gst/settings { gstin } -> 200, gstEnabled auto-flipped to true
    - curl GET /api/gst/settings -> 200 with all 7 fields
    - curl POST /api/invoices (intra-state, 18% line) -> totalCgst+totalSgst populated, totalIgst = 0
    - curl POST /api/invoices (inter-state, 18% line) -> totalIgst populated, totalCgst+totalSgst = 0
    - curl POST /api/invoices (composition business) -> all tax totals 0
    - curl POST /api/invoices (taxPricingMode INCLUSIVE, line 11800 @ 18%) -> taxableValue = 10000, igst = 1800
    - curl POST /api/einvoice/generate (B2B SAVED) -> 201 with 64-char IRN
    - curl POST /api/einvoice/generate (duplicate) -> 200 returning existing IRN (idempotent)
    - curl POST /api/einvoice/cancel (>24h) -> 400 EINVOICE_CANCEL_WINDOW_EXPIRED
    - curl POST /api/ewaybill/generate (intra-state) -> 400 EWAYBILL_BELOW_THRESHOLD
    - curl POST /api/ewaybill/generate (inter-state >=50k) -> 201 with 12-digit ewbNumber
    - curl GET /api/gst/returns/GSTR1/2026-04 -> 200 with b2b/b2cl/b2cs/cdnr/cdnur/hsn/nil/exp sections
    - curl POST /api/gst/returns/GSTR1/2026-04/export { format: 'JSON' } -> NIC v3.0 envelope, all amounts in rupees
    - curl GET /api/gst/returns/GSTR3B/2026-04 -> 200 with all 11 sections
    - curl POST /api/gst/backfill/preview -> counts of untagged products + null-pos invoices
    - curl POST /api/gst/backfill/execute (with idempotency key) -> writes AuditLog rows
    - curl bad GSTIN -> 400 GSTIN_FORMAT_INVALID
    - curl unauthenticated -> 401 UNAUTHORIZED
    - NIC sandbox down simulation -> 502 EINVOICE_NIC_UNAVAILABLE, invoice save still succeeds
  frontend:
    - screenshots: GstSettingsPage loading/error/empty/success
    - screenshots: InvoiceForm tax column loading/error/empty/success on 320px and 375px
    - screenshots: EWayBill modal loading/error/empty/success
    - screenshots: EInvoiceCard not-generated/loading/error/success/cancel-window
    - screenshots: GSTR-1 export page loading/error/empty/success
    - screenshots: GSTR-3B summary page loading/error/empty/success
    - screenshots: BackfillWizard 5 steps on 320px
    - dark theme tested across all new screens
    - 320px overflow audit clean (no horizontal scroll)
    - offline gate: e-invoice / e-way bill / GSTR export all show "must be online" toast when offline
---

# GST Phase 2 — Architecture (v7)

This document is the technical design for the v7 epic. Every decision below traces to a clause in `docs/SCOPE_gst_phase_2.md` (cited as `SCOPE §N`). All money is paise (integer). All rates are basis points (e.g. `1800` for 18.00%). The design is mobile-first (320px floor), offline-correct (per `.claude/rules/OFFLINE_RULES.md`), and additive (no breaking changes to v6 invoices).

---

## 1. Schema Migration Sequence

### 1.1 Field-by-field plan

Six new columns, applied in one Prisma migration named **`gst_phase_2_fields`** (`server/prisma/migrations/<ts>_gst_phase_2_fields/migration.sql`). All six are additive and NOT NULL with safe defaults from the first statement, so the add-column → backfill → make-NOT-NULL three-step is collapsed to a single statement per column. The only column requiring a runtime backfill (`Business.gstEnabled`) carries a default of `false`, then a deterministic `UPDATE` flips rows that already have a GSTIN. There is no make-NOT-NULL second pass required because every column ships with its default.

| # | Table | Column | Type | NOT NULL | Default | Backfill SQL |
|---|-------|--------|------|----------|---------|--------------|
| 1 | `Business` | `gstEnabled` | `BOOLEAN` | yes | `false` | `UPDATE "Business" SET "gstEnabled" = true WHERE "gstin" IS NOT NULL;` |
| 2 | `Business` | `taxPricingMode` | `VARCHAR(20)` | yes | `'EXCLUSIVE'` | none |
| 3 | `Business` | `gstDeclarationText` | `TEXT` | no | `NULL` | none (templates fall back to in-code default copy from SCOPE §8.4) |
| 4 | `DocumentSettings` | `taxPricingMode` | `VARCHAR(20)` | yes | `'EXCLUSIVE'` | `UPDATE "DocumentSettings" ds SET "taxPricingMode" = b."taxPricingMode" FROM "Business" b WHERE ds."businessId" = b.id;` (sync to parent business after step 2 lands) |
| 5 | `Document` | `taxPricingMode` | `VARCHAR(20)` | yes | `'EXCLUSIVE'` | none — historical docs were exclusive; the backfill wizard (Section 7) recomputes tax in place but does not re-classify mode |
| 6 | `HsnCode` | `uqc` | `VARCHAR(10)` | yes | `'NOS'` | data patch via separate `prisma/seed.gst.uqc.ts` keyed by HSN chapter (NOS / KGS / MTR / LTR / SQM / BOX / DOZ / GMS / PKG / TON per SCOPE §11.3); idempotent UPSERT |

### 1.2 Why one combined migration

All six are pure additive `ALTER TABLE ADD COLUMN ... NOT NULL DEFAULT <literal>`. PostgreSQL 11+ takes a metadata-only lock for these — no table rewrite, no long lock, no downtime. The single backfill `UPDATE` on `Business.gstEnabled` runs over a small table (one row per tenant). Running them as a single migration keeps history clean and avoids partially-migrated states between PRs.

### 1.3 Rollback plan

The migration body explicitly emits the inverse `ALTER TABLE ... DROP COLUMN` statements in a commented `-- DOWN` block at the bottom (Prisma does not run them, but they are the documented manual rollback). Because the columns are additive and unread by v6 code, rolling back the application without rolling back the DB is also safe — orphaned columns sit unused. The only rollback hazard is the UQC seed script: the rollback should NOT re-NULL `uqc` (other rows already depend on the seeded values for GSTR-1 hsn summary builds).

### 1.4 Indexes

No new indexes required. `gstEnabled` is queried only in single-row tenant context (already covered by PK). `taxPricingMode` is read with the row, never filtered on. `uqc` is read by HSN code (already PK on `HsnCode.code`). No GIN/trgm needed — none of the new columns participate in fuzzy search.

### 1.5 Migration command sequence

```
cd server
npx prisma migrate dev --name gst_phase_2_fields
node ./prisma/seed.gst.uqc.js          # idempotent UQC patch
```

Pre-commit gate: `.husky/pre-commit` already blocks `db push` per `.claude/rules/PRISMA_MIGRATION_RULES.md`. This migration uses `migrate dev` exclusively.

---

## 2. Service-Layer Architecture

### 2.1 Tax engine

**Location:** `src/features/tax/tax-calc.utils.ts` (client) and `server/src/services/tax-calc.service.ts` (server). The two files MUST stay byte-for-byte equivalent in math; a vitest snapshot test under `src/features/tax/__tests__/tax-calc.parity.test.ts` asserts that a fixed input vector returns identical breakdowns from each side.

**Style:** Pure functions, no classes, no DI. Inputs are plain objects, outputs are `LineTaxBreakdown` and `DocumentTaxSummary` (already exported from `tax.types.ts`). Pure-function choice is deliberate: the same code runs in the offline IndexedDB optimistic path (client) and the authoritative re-compute on save (server).

**Money invariant:** All amounts are `number` representing **paise** (integer). All rates are `number` representing **basis points** (`1800` = 18.00%). The single `Math.round()` per tax component is the only rounding boundary, applied at the end of `taxableValue × rate / 10000`. Sum of components = grand total — no separate round of the grand total (avoids rupee drift on multi-line invoices).

**Tax modes the engine handles** (all additive on top of the existing `calculateLineTax()`):

1. **Intra-state (CGST+SGST)** — already implemented; `cgstRate = floor(gstRate/2)`, `sgstRate = gstRate - cgstRate` so any odd basis point lands on SGST.
2. **Inter-state (IGST)** — already implemented.
3. **Reverse Charge (RCM)** — handled at the document level: if `Document.isReverseCharge = true`, line tax is still computed and stored, but `Document.totalCgst/Sgst/Igst` are set to 0 for the supplier's GSTR-1 (the recipient self-pays). A new helper `applyRcmFlag(summary, isRcm)` zeros the document totals while preserving line breakdowns for audit/print.
4. **Composition scheme** — when `business.compositionScheme = true` the document save short-circuits all line tax to zero. A new helper `isCompositionDocument(business)` returns `true` and a new `calculateCompositionTotals(lines, rate)` computes the internal flat liability (1%/5%/6% on grand total) for monthly summary use only — never written to `DocumentLineItem.cgstAmount` etc., never printed.
5. **Tax-Inclusive (MRP) back-calculation** — new helper `backCalculateInclusive(lineTotal, gstRateBP) → { taxableValue, gstAmount }` per SCOPE §4.2:
   ```
   taxableValue = Math.round(lineTotal * 10000 / (10000 + gstRateBP))
   gstAmount    = lineTotal - taxableValue
   ```
   Composition / inclusive are mutually exclusive — composition forces exclusive (no math anyway).

**API surface (additive):**
```ts
// existing — unchanged
export function isInterState(b: string|null, p: string|null): boolean
export function calculateLineTax(input: TaxLineInput, interState: boolean): LineTaxBreakdown
export function calculateDocumentTax(lines: TaxLineInput[], interState: boolean): DocumentTaxSummary

// NEW (Section 2.1)
export function backCalculateInclusive(lineTotal: number, gstRateBP: number): { taxableValue: number; gstAmount: number }
export function applyRcmFlag(summary: DocumentTaxSummary, isRcm: boolean): DocumentTaxSummary
export function calculateCompositionTotals(lines: TaxLineInput[], compositionRateBP: number): { taxableTurnover: number; compositionLiability: number }
export function determineSupplyType(partyGstin: string|null, interState: boolean, grandTotal: number): 'B2B'|'B2C_LARGE'|'B2C_SMALL'
```

The existing `gstin.utils.ts` already exports `determineSupplyType` — keep it there; do not duplicate. The tax-calc module imports it.

### 2.2 E-Invoice service (NIC IRP)

**Location:** New feature dir `src/features/e-invoice/` (client) and `server/src/services/einvoice/` (server, multi-file because the NIC adapter is non-trivial).

**Server structure:**
```
server/src/services/einvoice/
├── einvoice.service.ts           # public surface: generate, cancel, get
├── einvoice.envelope.ts          # NIC JSON Schema 1.1 builder (Document + lines + party + transport → envelope)
├── einvoice.nic-client.ts        # HTTP adapter; auth token, retry, circuit breaker
├── einvoice.errors.ts            # error taxonomy + mapper
├── einvoice.token-store.ts       # in-memory + Redis-backed auth token cache (6h TTL)
└── __tests__/einvoice.envelope.test.ts
```

**NIC IRP API contract (sandbox `einv-apisandbox.nic.in`, prod `einvoice1.gst.gov.in`):**

| Concern | Decision |
|---|---|
| Auth | `POST /eivital/v1.04/auth` — returns `AuthToken` (encrypted with NIC public key) and `Sek` (session key, AES-256). Token TTL: **6 hours**. We cache per business in `einvoice-token-store` (Redis if available, else in-process). On 401 we re-auth once then retry the original call. |
| Generate IRN | `POST /eicore/v1.03/Invoice` with body = AES-encrypted GSTR1-style envelope (Schema **1.1**). Response carries `Irn` (64-char SHA-256), `AckNo`, `AckDt`, `SignedQRCode`, `SignedInvoice`. |
| Cancel | `POST /eicore/v1.03/Invoice/Cancel` — only within 24h of `AckDt`. Body: `{ Irn, CnlRsn (1-4), CnlRem }`. |
| Idempotency | `EInvoice.documentId` is `@unique` (already in schema). Server-side: before calling NIC, `findUnique({ documentId })` — if found and `status='GENERATED'` return existing record with HTTP **200** (per SCOPE §4.8). Only HTTP **201** on a fresh insert. The NIC envelope itself is idempotent on `(Sgstin, DocNo, DocTyp, DocDt)` — a duplicate call returns the same IRN. |
| Retry policy | Exponential backoff `[300ms, 1s, 3s]` for 5xx and network errors only. Never retry 4xx. Total wall-clock cap **8 seconds** so the user-facing spinner doesn't stall the UI. |
| Circuit breaker | Per-instance opossum-style breaker: 5 consecutive failures within 60s opens the breaker for 30s. While open, all calls fail-fast with `EINVOICE_NIC_UNAVAILABLE` (502) so we don't hammer NIC during a known outage. Breaker state exposed at `/api/health/nic-irp` for ops. |
| Error taxonomy | See table below. |

**Error taxonomy (`einvoice.errors.ts`):**

| HTTP | Code | Class | User remedy |
|---|---|---|---|
| 400 | `EINVOICE_PARTY_GSTIN_MISSING` | user-fixable | Add party GSTIN, retry |
| 400 | `EINVOICE_BUSINESS_GSTIN_MISSING` | user-fixable | Save GSTIN in Settings |
| 400 | `EINVOICE_ALREADY_GENERATED` | benign | Existing record returned with 200 instead |
| 400 | `EINVOICE_WRONG_STATUS` | user-fixable | Document must be SAVED, not DRAFT |
| 400 | `EINVOICE_NOT_SALE_INVOICE` | user-fixable | Only SALE_INVOICE qualifies |
| 400 | `EINVOICE_CANCEL_WINDOW_EXPIRED` | terminal | Issue credit note instead |
| 400 | `EINVOICE_NOT_GENERATED` | user-fixable | Generate first, then cancel |
| 502 | `EINVOICE_NIC_UNAVAILABLE` | retryable | Retry button persists; invoice save NOT blocked |
| 422 | `EINVOICE_NIC_VALIDATION` | user-fixable | NIC field-level error; surface NIC error array verbatim |

**Auth token storage** is a high-risk path (`server/src/config/secrets.nic.ts` reads NIC API username/password from env; security agent must vet before merge). The client never sees the NIC token — it lives in server memory + Redis only.

### 2.3 E-Way Bill service

**Location:** `server/src/services/ewaybill/` mirroring the e-invoice layout. Client feature dir: `src/features/e-way-bill/`.

**NIC EWB API differences from IRP:**
- Different host: `ewaybillapi.nic.in` (separate sandbox `ewbapisandbox.nic.in`).
- **Same** auth flow shape (token + Sek encryption) but the credential pair is distinct from IRP — separate env vars: `NIC_EWB_USERNAME`, `NIC_EWB_PASSWORD`. Tokens cached separately.
- **Part A** = `POST /ewb/v1.03/ewayapi` to generate the bill itself (returns 12-digit `ewbNumber`).
- **Part B** = `POST /ewb/v1.03/ewaypartb` to attach/update vehicle details (called separately so trucks can be re-assigned mid-route).
- Cancel = `POST /ewb/v1.03/ewayapi/cancel` within 24h.
- **Vehicle update flow:** the existing `EWayBill.partBUpdates Json[]` schema array stores each update event `{ vehicleNumber, vehicleType, reason, updatedAt }`. The service appends; never overwrites. `validUpto` is **not** extended automatically (NIC controls that based on distance).

**Threshold gate (server-side, before NIC call):**
- `grandTotal >= 5_000_000` paise (Rs 50,000) — configurable per state in `nic-thresholds.ts` because Karnataka, Tamil Nadu, etc. use intra-state thresholds.
- `isInterState(business.stateCode, document.placeOfSupply)` — when intra-state and below the state's intra threshold, return 400 `EWAYBILL_BELOW_THRESHOLD` without calling NIC.

### 2.4 GSTR-1 export

**Location:** `server/src/services/gst-returns/gstr1.service.ts` plus eight per-table builder modules under `server/src/services/gst-returns/builders/`.

**Build strategy:** **In-memory, not streaming.** A monthly GSTR-1 for the largest target persona (Amit at ~5,000 invoices/month) produces a JSON payload of ~8–12 MB. Postgres → Node memory → JSON.stringify → response is fine on the t3.small the API runs on. Streaming would force per-table NDJSON which the NIC offline tool does not accept, and would prevent a single signed download. The query is bounded by `Document.businessId + period` which is already indexed.

**Eight builders (one file each), all under `gst-returns/builders/`:**

| Builder | Output table | Source query |
|---|---|---|
| `b2b.builder.ts` | `b2b: NicB2BEntry[]` | `Document` where `supplyType='B2B'` and `documentType IN ('SALE_INVOICE','DEBIT_NOTE')` |
| `b2cl.builder.ts` | `b2cl: NicB2CLEntry[]` | `supplyType='B2C_LARGE'` |
| `b2cs.builder.ts` | `b2cs: NicB2CSEntry[]` | `supplyType='B2C_SMALL'` aggregated by `(placeOfSupply, gstRate)` — emits **one row per state-rate pair**, not one per invoice |
| `cdnr.builder.ts` | `cdnr` | `documentType='CREDIT_NOTE'` AND `parentDocument.supplyType='B2B'` |
| `cdnur.builder.ts` | `cdnur` | `documentType='CREDIT_NOTE'` AND `parentDocument.supplyType IN ('B2C_LARGE','EXPORT')` |
| `hsn.builder.ts` | `hsn: NicHsnSummaryEntry[]` | aggregated by `(hsnCode, gstRate, uqc)` from `DocumentLineItem` joined to `HsnCode` for `uqc` |
| `nil.builder.ts` | `nil` | line items with `taxCategory.rate=0` |
| `exp.builder.ts` | `exp` | `supplyType='EXPORT'` (flag-only in v7 per SCOPE §11.1) |

Each builder is a pure function `(prisma, businessId, period) => Promise<NicXEntry[]>`. The aggregator `gstr1.service.ts` runs them sequentially, assembles the envelope, and divides every paise field by 100 at the very end (single rupee-conversion boundary — see SCOPE §11.4).

**Envelope shape:**
```ts
{ gstin, fp: 'MMYYYY', gt: 0, cur_gt: 0, b2b, b2cl, b2cs, cdnr, cdnur, hsn: { data: [...] }, nil: { inv: [...] }, exp }
```
Matches NIC GSTR1 v3.0. Validated against a JSON Schema file `gstr1-v3.schema.json` in the same directory before being returned to the client (catches our own bugs before the user uploads to NIC).

**Post-export side-effect:** Upsert a `GstReturn` row `{ businessId, period, returnType: 'GSTR1', status: 'EXPORTED', summary, jsonData }`. This is what powers the SCOPE §13.1 banner gate ("if GstReturn has zero records, show backfill prompt").

### 2.5 GSTR-3B summary

**Location:** `server/src/services/gst-returns/gstr3b.service.ts`. No builders subdirectory — 3B is one file (it's a flat 11-row summary, not nested tables).

**Period boundaries:** `period='2026-04'` covers `documentDate >= '2026-04-01' AND documentDate < '2026-05-01'` in the business's local time zone (Asia/Kolkata, hard-coded — Indian-only product). Edge: financial year boundaries on April 1 — handled by the date filter directly; no special case.

**Section → query mapping** per SCOPE §12.1:

| Section | Query |
|---|---|
| 3.1(a) | `SUM(taxable, igst, cgst, sgst, cess) FROM Document WHERE supplyType IN ('B2B','B2C_LARGE','B2C_SMALL') AND isReverseCharge=false AND NOT exempt-only` |
| 3.1(b) | `SUM(...) WHERE supplyType IN ('EXPORT','SEZ')` |
| 3.1(c) | line-level: `SUM(taxableValue) FROM DocumentLineItem WHERE taxCategory.rate=0 (exempt)` |
| 3.1(d) | `SUM(...) FROM Document WHERE documentType='PURCHASE_INVOICE' AND isReverseCharge=true` |
| 3.1(e) | line items with NULL hsnCode AND NULL sacCode |
| 3.2 | per-state `SUM(...) FROM Document WHERE supplyType='B2C_LARGE' GROUP BY placeOfSupply` |
| 4 ITC | `SUM(igst, cgst, sgst, cess) FROM Document WHERE documentType='PURCHASE_INVOICE' AND business.compositionScheme=false` |
| 4(D) ITC reversed | manual entry — not computed in v7 (returns 0; UI accepts a manual override) |
| 5 exempt inward | exempt line items on PURCHASE_INVOICE |
| 6.1 tax payable | computed: `3.1 totals - 4 net ITC` |
| late fee | always 0 (manual) |

All eleven aggregate as a single Postgres CTE for performance — one round-trip per period.

---

## 3. Module Boundaries

### 3.1 New feature directories

```
src/features/
├── gst/                       # gst-settings page wiring, opt-in gate, declaration text editor
│   ├── GstSettingsPage.tsx    # MOVES from src/features/tax/ to here (renamed import path)
│   ├── gst-settings.service.ts
│   ├── useGstSettings.ts
│   ├── gst.types.ts
│   └── components/GstOptInGate.tsx     # the boolean gate consumed by other features
├── e-invoice/
│   ├── EInvoiceCard.tsx
│   ├── EInvoiceCancelDialog.tsx
│   ├── e-invoice.service.ts
│   ├── e-invoice.types.ts
│   └── useEInvoice.ts
├── e-way-bill/
│   ├── EWayBillModal.tsx
│   ├── EWayBillCard.tsx
│   ├── EWayBillUpdatePartBDialog.tsx
│   ├── e-way-bill.service.ts
│   ├── e-way-bill.types.ts
│   └── useEWayBill.ts
└── gst-returns/
    ├── Gstr1Page.tsx
    ├── Gstr3bPage.tsx
    ├── GstReturnsHomePage.tsx
    ├── BackfillWizardPage.tsx        # 5-step machine
    ├── gst-returns.service.ts
    ├── gst-returns.types.ts          # NicB2BEntry, NicHsnSummaryEntry, etc.
    ├── useGstr1.ts
    ├── useGstr3b.ts
    └── useBackfill.ts
```

### 3.2 Existing dirs to extend (NOT replace)

- `src/features/tax/` — `tax-calc.utils.ts` gains the four new helpers from §2.1. `gstin.utils.ts` is unchanged (already correct). `useTaxCategories.ts` unchanged. `GstSettingsPage.tsx` MOVES out to `gst/` (one-line import-path migration; the component itself is already mature and just gets wrapped with the new opt-in gate UI).
- `src/features/invoices/` — invoice form gains a per-line tax picker column (new component `<TaxPickerColumn>`), an HSN typeahead column (`<HsnTypeahead>`), an inclusive/exclusive chip in the header, RCM toggle, place-of-supply selector. Invoice detail page gains `<EInvoiceCard>` and `<EWayBillCard>` slots.
- `src/features/templates/` — `template.types.ts` gains two flags `gstTaxSummary: boolean` and `gstDeclaration: boolean` on `TemplateFieldsConfig`. Renderer pipeline gains two render hooks (Section 6).
- `src/features/settings/` — adds a "GST" entry in the settings nav routing into `features/gst/`. Adds "Tax Pricing Mode" toggle into `InvoiceSettingsPage` writing to `DocumentSettings.taxPricingMode`.
- `src/features/documents/` — `document.types.ts` gains `taxPricingMode: 'EXCLUSIVE'|'INCLUSIVE'` on `DocumentResponse`.

### 3.3 Cross-feature contracts (TypeScript)

These types live in `src/features/tax/tax.types.ts` and `src/features/gst/gst.types.ts` and are imported by every consumer. **Single source of truth — do not redefine in feature dirs.**

```ts
// tax.types.ts (existing — extended)
export interface LineTaxBreakdown { /* unchanged */ }
export interface DocumentTaxSummary { /* unchanged */ }
export type TaxPricingMode = 'EXCLUSIVE' | 'INCLUSIVE'             // NEW
export type SupplyType = 'B2B' | 'B2C_LARGE' | 'B2C_SMALL' | 'EXPORT' | 'SEZ'  // NEW

// gst.types.ts (NEW)
export interface GstSettings {
  gstEnabled: boolean
  gstin: string | null
  stateCode: string | null
  compositionScheme: boolean
  compositionRate: number
  eInvoiceEnabled: boolean
  eWayBillEnabled: boolean
  turnoverSlab: TurnoverSlab | null
  taxPricingMode: TaxPricingMode
  gstDeclarationText: string | null
}
export type TurnoverSlab = 'BELOW_1CR' | '1CR_TO_5CR' | '5CR_TO_10CR' | '10CR_TO_20CR' | 'ABOVE_20CR'

// e-invoice.types.ts
export interface EInvoiceRecord {
  id: string; documentId: string; irn: string; ackNumber: string; ackDate: string
  qrCodeData: string; status: 'GENERATED'|'CANCELLED'
  cancelReason: string | null; cancelWindowExpiresAt: string
}

// e-way-bill.types.ts — mirrors EWayBill schema with date strings
```

A new app-level hook `useGstGate()` (in `src/features/gst/useGstGate.ts`) returns `{ gstEnabled, compositionScheme, taxPricingMode, gstin }`. **Every feature that branches on GST state reads from this hook only — never from a raw fetch.** This gives one cache key (`['gst-settings', businessId]`) and one place to invalidate.

---

## 4. API Endpoint Inventory

All routes are `/api/...`, JSON in/out. Auth = bearer cookie (`session`) + CSRF (`x-csrf-token`) per `src/lib/api.ts`. Idempotent column = whether the route is safe to retry blindly (server returns the same result for the same input).

### 4.1 GST Settings (existing path, extended)

| Method | Path | Idemp | Auth | Request | Response |
|---|---|---|---|---|---|
| GET | `/api/gst/settings` | yes | owner+ | — | `GstSettings` |
| PATCH | `/api/gst/settings` | yes | owner | `Partial<GstSettings>` | `GstSettings` |

### 4.2 Tax categories (existing — unchanged, listed for completeness)

| Method | Path | Idemp | Auth |
|---|---|---|---|
| GET / POST / PUT / DELETE | `/api/tax-categories[/:id]` | mixed | owner+ |

### 4.3 HSN search (existing)

| Method | Path | Idemp | Auth |
|---|---|---|---|
| GET | `/api/hsn/search?q=&limit=` | yes | any auth'd |

### 4.4 Invoices (existing — body schema extended, see §5.2 of SCOPE)

| Method | Path | Idemp | Auth | New fields accepted |
|---|---|---|---|---|
| POST | `/api/invoices` | **yes** (idempotency-key middleware) | owner+ | `placeOfSupply`, `isReverseCharge`, `taxPricingMode`, line-level `taxCategoryId/hsnCode/sacCode` |
| PUT | `/api/invoices/:id` | yes | owner+ | same |

### 4.5 E-Invoice

| Method | Path | Idemp | Auth | Notes |
|---|---|---|---|---|
| POST | `/api/einvoice/generate` | **yes** (`documentId` unique) | owner | 201 fresh / 200 existing |
| POST | `/api/einvoice/cancel` | yes (returns CANCELLED on second call) | owner | 24h gate |
| GET | `/api/einvoice/:documentId` | yes | viewer+ | — |

### 4.6 E-Way Bill

| Method | Path | Idemp | Auth |
|---|---|---|---|
| POST | `/api/ewaybill/generate` | **yes** (`documentId` unique) | owner |
| POST | `/api/ewaybill/cancel` | yes | owner |
| PUT | `/api/ewaybill/update-partb` | no (appends history row) | owner |
| GET | `/api/ewaybill/:documentId` | yes | viewer+ |

### 4.7 GST Returns

| Method | Path | Idemp | Auth |
|---|---|---|---|
| GET | `/api/gst/returns/GSTR1/:period` | yes | owner |
| POST | `/api/gst/returns/GSTR1/:period/export` | yes (writes `GstReturn` upsert) | owner |
| GET | `/api/gst/returns/GSTR3B/:period` | yes | owner |
| POST | `/api/gst/returns/GSTR3B/:period/export` | yes | owner |
| GET | `/api/gst/returns` | yes | owner |
| POST | `/api/gst/returns/:id/mark-filed` | yes | owner |

### 4.8 Backfill wizard

| Method | Path | Idemp | Auth |
|---|---|---|---|
| POST | `/api/gst/backfill/preview` | yes (read-only) | owner |
| POST | `/api/gst/backfill/execute` | **yes** (`Idempotency-Key` header — same key returns same result, never re-runs) | owner |
| GET | `/api/gst/backfill/status/:jobId` | yes | owner |

### 4.9 Health

| Method | Path | Idemp | Auth |
|---|---|---|---|
| GET | `/api/health/nic-irp` | yes | owner | exposes circuit-breaker state |
| GET | `/api/health/nic-ewb` | yes | owner | same for EWB |

**Total: 22 routes** (8 new, 14 already existing or trivially extended). Roughly aligned with the 25–35 estimate; we land at the lean end because tax-categories and HSN search are already shipped.

---

## 5. Frontend State Architecture

### 5.1 TanStack Query keys (canonical)

| Key | Cacheable? | Stale time | Invalidated by |
|---|---|---|---|
| `['gst-settings', businessId]` | yes (`cacheReads:true`) | 5 min | PATCH /api/gst/settings |
| `['tax-categories', businessId]` | yes | 30 min | tax-category mutations |
| `['hsn-search', q]` | no (per-keystroke) | 0 (server-cached) | — |
| `['einvoice', documentId]` | yes | 1 min | generate / cancel mutations |
| `['ewaybill', documentId]` | yes | 1 min | generate / cancel / update-partb |
| `['gstr1-summary', businessId, period]` | no | 0 | export mutation invalidates |
| `['gstr1-export', businessId, period]` | no | 0 | manual refetch only |
| `['gstr3b-summary', businessId, period]` | no | 0 | — |
| `['backfill-preview', businessId, range]` | no | 0 | execute invalidates |
| `['gst-returns-list', businessId]` | yes | 5 min | export mutations |

`cacheReads:true` reaches the `api()` IndexedDB cache (per OFFLINE_RULES Rule 3). Settings/tax-categories/IRN-records are tenant-internal and PII-safe to cache — GSTR data is NOT cached because it can be exported and the customer's whole month is sensitive.

### 5.2 Form state for tax picker

Per-line `<TaxPickerColumn>` is uncontrolled-ish: it owns a `taxCategoryId` field via `react-hook-form`'s `useFormContext`. Reading `tax-categories` from TanStack Query (cached). HSN typeahead is debounced 250ms, hits `useQuery` keyed by query string — results render in a portal popover so 320px row layout is unaffected.

The full invoice form remains under a single `useForm({ defaultValues, resolver: zodResolver(invoiceSchema) })`. Composition mode hides the column via a CSS class flipped from `useGstGate()` — no schema-level branching.

### 5.3 Optimistic update patterns (offline-correct)

Per `.claude/rules/OFFLINE_RULES.md`:

```ts
// invoice save (already follows this — extending)
await api('/invoices', {
  method: 'POST',
  body: JSON.stringify(payload),
  entityType: 'invoice',                 // existing
  entityLabel: payload.documentNumber,   // existing
})
queryClient.invalidateQueries(['invoices'])
toast.success(navigator.onLine ? 'Saved' : 'Saved — will sync when online')
```

**E-invoice and e-way bill mutations DO NOT pass `entityType` because they MUST NOT queue offline.** Instead they short-circuit:

```ts
// e-invoice.service.ts
export async function generateIrn(documentId: string): Promise<EInvoiceRecord> {
  if (!navigator.onLine) {
    throw new HpError('OFFLINE_REQUIRED', 'You must be online to generate an e-invoice')
  }
  return api<EInvoiceRecord>('/einvoice/generate', {
    method: 'POST',
    body: JSON.stringify({ documentId }),
    // NO entityType — refuse to queue
  })
}
```

The `api()` helper's queue-on-offline behavior is bypassed only when no `entityType` is provided AND the explicit `OFFLINE_REQUIRED` precheck fires.

### 5.4 GST gate flag in app context

Lives in the existing app-level provider stack (`src/app/AppProviders.tsx`) via `<GstSettingsProvider>` which reads `useGstSettings()` once and exposes it through `useGstGate()`. This is the single read for the entire app — tabs, routes, nav, every feature reads from here. When GST is toggled on/off the provider invalidates and refetches; the whole tree re-renders consistently.

---

## 6. Template Engine Extension

### 6.1 The two new flags

`TemplateFieldsConfig` in `template.types.ts` gains exactly two booleans:

```ts
gstTaxSummary: boolean   // renders the CGST/SGST/IGST/Cess subtotal table block
gstDeclaration: boolean  // renders the declaration paragraph at the bottom
```

`einvoiceQr` is **NOT** added — the existing `qrCode` flag is repurposed: when an `EInvoice` record exists for the document, the QR slot renders the IRN QR; otherwise it renders the existing UPI QR (or nothing). This avoids template-config schema drift.

### 6.2 Render pipeline hook points

The renderer is a top-down React tree under `src/features/templates/components/InvoiceRenderer.tsx`. The new blocks slot in at two well-defined points:

1. **`<TaxSummaryBlock>`** — rendered between the existing `<SubtotalRow>` and `<GrandTotalRow>` inside `<InvoiceFooter>`. Renders only when `template.fields.gstTaxSummary === true && document.totalCgst+totalSgst+totalIgst+totalCess > 0`. Layout per SCOPE §8.2:
   - intra-state → two rows: `CGST (X%)` + `SGST (X%)` then `Total Tax`
   - inter-state → one row: `IGST (X%)`
   - composition → no rows, but emits the literal "Composition Dealer under GST" line in place
   - 80mm thermal → reuses same component, font shrunk to 9pt; on 58mm → component returns `null` (too narrow per SCOPE §8.5 logic for QR also applies here — text crowding)

2. **`<GstDeclarationBlock>`** — rendered after `<TermsBlock>` inside `<InvoicePrintFooter>`. Renders only when `template.fields.gstDeclaration === true`. Source of text:
   ```
   business.gstDeclarationText
     ?? (business.compositionScheme ? COMPOSITION_DEFAULT : STANDARD_DEFAULT)
   + (document.isReverseCharge ? '\n' + RCM_APPENDIX : '')
   ```
   Defaults live in `template.constants.ts` (`STANDARD_GST_DECLARATION`, `COMPOSITION_GST_DECLARATION`, `RCM_DECLARATION_APPENDIX`).

### 6.3 Data shape passed to the renderer

`InvoiceRenderer` already receives `{ document, business, party, template, lines }`. **No change to props.** The new blocks compute everything from these props — no extra fetches, no extra context. This keeps PDF generation deterministic and serialisable for React-PDF.

### 6.4 Backward compatibility for the 30 existing templates

Default for the two flags is `false`. The migration **does not** rewrite stored template configs — they simply gain `undefined` for the new keys, which the renderer treats as `false`. This means **every shipped template prints byte-identical to v6 until the user enables GST**.

When `gstEnabled` flips from `false → true` (via `PATCH /api/gst/settings`), a server-side hook (`gst-settings.service.ts → onGstFirstEnabled`) does a one-shot update on the business's saved templates: sets `fields.gstTaxSummary = true`, `fields.gstDeclaration = true`, `columns.hsn.visible = true` for templates where these are `undefined`. **It never overwrites an explicit `false`** — if the user manually disabled the block they keep their setting. This hook runs in the same transaction as the GST enable so a rollback rolls both.

### 6.5 QR sizing per paper size

Logic lives in `<QrCodeBlock>`, switched on `template.layout.pageSize`:

| Paper | IRN QR size | UPI QR size (existing) |
|---|---|---|
| A4 | 40mm × 40mm | 35mm × 35mm |
| A5 | 35mm × 35mm | 30mm × 30mm |
| 80mm thermal | 30mm × 30mm | 25mm × 25mm |
| 58mm thermal | hidden (returns null) | hidden |

When BOTH UPI and IRN QR would render, IRN wins (regulatory > convenience).

---

## 7. Backfill Wizard Implementation

### 7.1 5-step UI state machine

`BackfillWizardPage.tsx` uses an `xstate`-style discriminated-union state in a `useReducer`:

```ts
type WizardState =
  | { step: 'preview', data: BackfillPreviewRes['data'] | null, loading: boolean }
  | { step: 'options', defaultTaxCategoryId: string, setPosFromParty: boolean, dateRange: [Date, Date] }
  | { step: 'confirmation', estimate: BackfillEstimate }
  | { step: 'processing', jobId: string, progress: { processed: number; total: number } }
  | { step: 'complete', result: BackfillExecuteRes['data'] }
```

Transitions: preview → options (next), options → confirmation (next), confirmation → processing (proceed), processing → complete (when status='COMPLETED'). Steps 1–3 allow back-navigation; step 4 is non-cancellable per SCOPE §7.6.

### 7.2 Two-endpoint contract

- `POST /api/gst/backfill/preview` — pure read. Counts untagged products, null-pos invoices, sums affected taxable value. No side effects.
- `POST /api/gst/backfill/execute` — write. Body matches SCOPE §5.6. Header: `Idempotency-Key: <uuid>` generated client-side per wizard run, persisted to sessionStorage so a refresh/retry hits the same key.

Server uses a Redis-backed idempotency table (existing middleware `server/src/middleware/idempotency.ts` — already used by `POST /api/invoices`). Same key + same body → 200 with cached response. Same key + different body → 409 `IDEMPOTENCY_KEY_REUSED`. Keys expire after 24h.

### 7.3 AuditLog write contract

Per SCOPE §13.2.4, every mutated document writes an `AuditLog` row:

```ts
{
  businessId, userId, entityType: 'Document', entityId: documentId,
  action: 'GST_BACKFILL',
  changes: { before: { placeOfSupply, totalCgst, totalSgst, totalIgst, totalCess, grandTotal },
             after:  { placeOfSupply, totalCgst, totalSgst, totalIgst, totalCess, grandTotal } }
}
```

A summary `AuditLog` row is also written for the wizard run: `entityType: 'BackfillJob'`, `action: 'GST_BACKFILL_RUN'`, `changes: { productsUpdated, invoicesUpdated, taxRecalculated, errors }`.

### 7.4 Transaction boundaries

**One transaction per document, NOT one per batch.** Reason: a single bad document (orphan party, negative tax) must not roll back the other 5,000 successful updates. The job loops:

```ts
for (const docId of documentIds) {
  try {
    await prisma.$transaction(async tx => {
      // 1. update line items (taxCategoryId, hsnCode, sacCode)
      // 2. recompute and update Document totals
      // 3. write AuditLog row
    })
    progress.processed++
  } catch (err) {
    errors.push({ documentId: docId, error: err.message })
  }
  await redis.set(`backfill:${jobId}:progress`, JSON.stringify(progress))
}
```

Progress is persisted every iteration so the client polling `GET /api/gst/backfill/status/:jobId` gets a live count and the job survives a worker restart (resume by reading already-completed AuditLog rows for the jobId — idempotent because tax recalc with same inputs produces same outputs).

### 7.5 Failure-resume strategy

Job status persisted as `{ status: 'RUNNING'|'COMPLETED'|'FAILED', processed, total, errors[] }` in Redis with 7-day TTL. If worker crashes mid-job, on next request the status endpoint detects the job age + stale heartbeat and marks it `INTERRUPTED`. Client offers a **Resume** button that calls execute again with the same idempotency key — the server skips already-processed documentIds (detected via existing `AuditLog WHERE entityId IN (...) AND action='GST_BACKFILL'` query).

---

## 8. Cross-Cutting Concerns

### 8.1 Offline queue policy

| Mutation | Queueable offline? | Behavior offline |
|---|---|---|
| Save invoice / credit note / etc. | **yes** (existing) | queued, optimistic `{}` return, sync on reconnect |
| Save GST settings (PATCH /api/gst/settings) | yes | queued, settings UI shows "Will save when online" |
| Tax category create / update | yes | queued |
| **Generate IRN** | **NO** | hard-fail with `OFFLINE_REQUIRED` toast — IRN is a NIC-issued identifier, cannot be invented offline |
| **Cancel IRN** | **NO** | same |
| **Generate EWB** | **NO** | same |
| **Update Part B** | **NO** | same |
| **GSTR-1/3B export** | **NO** | "Connect to internet to export" |
| **Backfill execute** | **NO** | "Connect to internet to run backfill" — server-side bulk recompute requires authoritative DB |

Implementation: each non-queueable mutation does an explicit `if (!navigator.onLine) throw new HpError('OFFLINE_REQUIRED')` check in its service function, AND omits `entityType` so the `api()` helper would not queue it even if the precheck were bypassed.

### 8.2 Idempotency middleware

Routes that **MUST** carry the existing `Idempotency-Key` middleware:
- `POST /api/invoices` (already does)
- `PUT /api/invoices/:id` (already does)
- `POST /api/einvoice/generate` (server enforces via `EInvoice.documentId @unique`; middleware is belt+braces against double-tap)
- `POST /api/ewaybill/generate` (same — `EWayBill.documentId @unique`)
- `POST /api/gst/backfill/execute`
- `POST /api/gst/returns/GSTR1/:period/export` (writes `GstReturn` row)

Routes that DON'T need it (read-only): all GETs, `/api/gst/settings` PATCH (latest-write-wins is fine — single tenant has one or two owners).

### 8.3 Rate limits / NIC quotas

NIC IRP free tier: **1,000 IRN generations / day / GSTIN** (sandbox), **higher for prod with paid GSP**. NIC EWB: similar. Two server-side guards:

1. **Per-business quota counter** in Redis: `nic-irp:{businessId}:{YYYY-MM-DD}`, INCR on each generate, TTL 26h. Reject at 950 (soft cap) with `EINVOICE_QUOTA_NEAR_LIMIT` warning, hard reject at 1000 with `EINVOICE_QUOTA_EXCEEDED`.
2. **Global rate limiter** on `/api/einvoice/*` and `/api/ewaybill/*` routes: 10 req/sec/business via existing `express-rate-limit` config.

Quota is **per business**, not per HisaabPro tenant — NIC binds quota to the supplier GSTIN, so a multi-business owner has independent counters.

### 8.4 Audit log surface

Every one of these writes an `AuditLog` row (existing model — already in schema):

| Action | `action` value | Payload `changes` |
|---|---|---|
| GST opt-in toggle | `GST_SETTINGS_UPDATE` | `{ before, after }` of changed fields only |
| GSTIN saved | same | included in above |
| Composition scheme toggle | same | flagged separately because it changes tax behavior across all future docs |
| IRN generated | `EINVOICE_GENERATED` | `{ irn, ackNumber, ackDate }` |
| IRN cancelled | `EINVOICE_CANCELLED` | `{ irn, reason }` |
| EWB generated | `EWAYBILL_GENERATED` | `{ ewbNumber, distance, transportMode }` |
| EWB Part B updated | `EWAYBILL_PARTB_UPDATED` | `{ before, after }` |
| EWB cancelled | `EWAYBILL_CANCELLED` | `{ reason }` |
| GSTR-1 / 3B exported | `GST_RETURN_EXPORTED` | `{ period, returnType, fileName }` |
| Backfill run | `GST_BACKFILL_RUN` | summary counts |
| Per-document backfill | `GST_BACKFILL` | before/after totals |

Audit log is read by the existing `/settings/activity` page — no new UI required.

### 8.5 Money invariant (enforced by review + types)

- All Prisma money columns are `Int` (paise). Already true; no new money columns added.
- All TypeScript money values are `number` integers. ESLint rule `no-floating-money` (existing in `enforce.js`) catches `*100` / `/100` outside `tax-calc.utils.ts`, `gstr1.service.ts` rupee export boundary, and `format.utils.ts` display formatter.
- All rate values are basis points (`Int` on schema, `number` in TS). `gstRateBP` naming convention enforced for any new variable holding a rate (review checklist).
- The only paise → rupees boundary is GSTR-1/3B export (NIC schema requires rupees). Enforced by a single helper `paiseToRupeesForNic(p: number): number` used everywhere in the export path.

---

## 9. High-Risk Path Inventory

Per `~/.claude/rules/HIGH_RISK_PATHS.md`, this epic touches:

| Path | Why touched | Required agents |
|---|---|---|
| `server/prisma/schema.prisma` | 6 new columns | architect ✓ |
| `server/prisma/migrations/**` | new migration `gst_phase_2_fields` | architect ✓ |
| `server/src/config/secrets.nic.ts` (NEW) | reads NIC IRP/EWB credentials from env | architect ✓, **security required** |
| `server/src/lib/env.ts` | adds 4 env vars: `NIC_IRP_USERNAME`, `NIC_IRP_PASSWORD`, `NIC_EWB_USERNAME`, `NIC_EWB_PASSWORD`, `NIC_ENV='sandbox'\|'prod'` | architect ✓ |
| `server/src/services/auth.service.ts` | unchanged in code; touched by association if NIC token is co-located. Decision: NIC tokens live in `services/einvoice/einvoice.token-store.ts` separately — auth.service is **NOT** touched | not required |
| `server/src/lib/jwt.ts` | not touched | not required |

**Conclusion: security agent must run next** before any code lands. The security review must cover:
1. NIC credentials — env handling, no logging of password/token, encrypted at rest if Redis.
2. NIC API token TTL handling — no token leakage in error responses.
3. Server-side enforcement that the GSTIN in a NIC IRP request matches `business.gstin` of the authenticated tenant (anti-cross-tenant IRN issuance).
4. Audit log coverage of every NIC interaction.
5. CSRF on all new POST/PATCH/PUT endpoints (already enforced by existing middleware — verify routes are mounted under the protected router).
6. Rate limiting per business, not per IP (multi-tenant attack surface).

---

## 10. Phasing Within v7 — PR Sequence

Each PR is independently mergeable, ships behind a feature flag where needed, and does not break v6 invoicing. Feature flag = `FEATURE_GST_V7` env var; routes return 404 when off; UI hides nav entries via `useFeatureFlag('gst_v7')`.

| # | PR | Scope | Depends on | Hours |
|---|---|---|---|---|
| 1 | **schema** | migration `gst_phase_2_fields` + UQC seed + Prisma client regen | — | 4 |
| 2 | **gst-settings** | `useGstGate()` + `<GstOptInGate>` + PATCH /api/gst/settings extended (new fields) + auto-flip rule + audit log | 1 | 8 |
| 3 | **tax-engine** | new tax-calc helpers (inclusive, RCM, composition) + parity tests + invoice route accepts `taxPricingMode` etc. | 1, 2 | 12 |
| 4 | **invoice-form-ui** | per-line tax picker, HSN typeahead column, place-of-supply selector, RCM toggle, inclusive/exclusive chip | 3 | 16 |
| 5 | **templates** | `gstTaxSummary` + `gstDeclaration` flags, `<TaxSummaryBlock>`, `<GstDeclarationBlock>`, Bill of Supply relabel, default seeding hook | 1, 4 | 12 |
| 6 | **composition-rcm** | composition scheme behaviors (form hides tax, ITC banners, self-invoice for unreg suppliers), RCM advisory banner, RCM print line | 4, 5 | 8 |
| 7 | **backfill-wizard** | 5-step UI + preview/execute endpoints + idempotency + AuditLog + resume | 3 | 16 |
| 8 | **e-invoice** | NIC IRP service (auth, generate, cancel) + circuit breaker + UI card + token store + `secrets.nic.ts` | 1, 4, **security review** | 24 |
| 9 | **e-way-bill** | NIC EWB service (Part A, Part B, cancel) + auto-prompt modal + card + threshold gate | 1, 4, **security review** | 16 |
| 10 | **gstr-1** | 8 builders + envelope + JSON/CSV export + GstReturn upsert | 3, 6 | 16 |
| 11 | **gstr-3b** | 11-row aggregator + summary page + JSON export | 3, 6 | 8 |
| 12 | **polish + remove-flag** | 320px audit, dark theme, error copy, remove `FEATURE_GST_V7` flag, docs | all | 8 |

**12 PRs total.** Critical path: 1 → 2 → 3 → 4 — once 4 lands, 5 / 7 / 8 / 9 can land in parallel. 10/11 require 6.

---

## 11. Risks & Open Questions

| # | Risk / open question | Owner | Mitigation |
|---|---|---|---|
| R1 | NIC sandbox vs prod credential provisioning. SCOPE assumes both available; in practice NIC sandbox is per-developer, prod is per-customer-GSTIN. | Sawan + ops | Document in admin onboarding: customer must paste their NIC API username/password into Settings → GST → Advanced. Encrypted at rest. Not provisioned automatically. |
| R2 | E-invoice eligibility threshold. Currently ₹5 cr aggregate annual turnover (Oct 2023). May change. SCOPE §3.2 has `turnoverSlab` but no enforcement of e-invoice mandatory above threshold. | product | v7 ships as **opt-in** — `eInvoiceEnabled` is user-controlled. We surface an advisory banner when `turnoverSlab >= 5CR_TO_10CR` recommending enable. Hard enforcement deferred to v8. |
| R3 | NIC schema versioning. v3.0 today; NIC ships v3.x updates without long deprecation windows. | engineering | Single envelope-builder file `gstr1.envelope.ts` + version constant `NIC_GSTR1_VERSION='3.0'`. Update isolates to one PR. |
| R4 | RCM SAC-code list (SCOPE §10.2) is advisory only, manually maintained in code. Government can add/remove SACs. | product | Constant file `rcm-sac-codes.ts`; review quarterly. Not blocking. |
| R5 | Composition rate of 6% applies to manufacturers + service providers post-2019. Some sources still list 5% for manufacturers. | product | Use `Business.compositionRate` as authoritative (user-set). Three preset choices. Don't hardcode. |
| R6 | Multi-currency invoices. SCOPE assumes INR. `Business.currencyCode` exists. | engineering | v7 GST features gated on `currencyCode === 'INR'`. Non-INR businesses see GST settings page disabled with explanation. |
| R7 | Inter-state vs intra-state EWB threshold differs by state (Karnataka intra ≥ ₹50k, Tamil Nadu intra ≥ ₹1L for some commodities). | engineering | `nic-thresholds.ts` constants by state code; default ₹50k. Out-of-scope to support every notification — flag this as "advisory threshold" in copy. |
| R8 | The auto-flip rule in §1.1 step 7 (set `gstEnabled=true` WHERE `gstin IS NOT NULL`) may surprise existing users who had a GSTIN saved as a "for reference" string but didn't intend GST mode. | product | One-time email/in-app banner on first login post-deploy: "We've enabled GST billing because you have a saved GSTIN. Click here to disable if not applicable." |

---

## 12. Acceptance

(Mirrors frontmatter; reproduced here for ease of reference. Each PR phase must satisfy the rows that fall in its slice — full set is the v7 release gate.)

**Backend (curl):**
- tsc clean across server + client
- `npx prisma migrate dev --name gst_phase_2_fields` runs cleanly on a fresh DB
- `PATCH /api/gst/settings { gstin }` → 200, `gstEnabled` auto-flipped to true
- `GET /api/gst/settings` → 200 with all 7 fields
- `POST /api/invoices` (intra-state, 18%) → CGST+SGST populated, IGST=0
- `POST /api/invoices` (inter-state, 18%) → IGST populated, CGST+SGST=0
- `POST /api/invoices` (composition) → all tax totals 0
- `POST /api/invoices` (INCLUSIVE, line ₹118 @ 18%) → taxableValue=₹100, igst=₹18
- `POST /api/einvoice/generate` (B2B SAVED) → 201 with 64-char IRN
- `POST /api/einvoice/generate` (duplicate) → 200 returning existing IRN
- `POST /api/einvoice/cancel` (>24h) → 400 EINVOICE_CANCEL_WINDOW_EXPIRED
- `POST /api/ewaybill/generate` (intra-state) → 400 EWAYBILL_BELOW_THRESHOLD
- `POST /api/ewaybill/generate` (inter-state ≥₹50k) → 201 with 12-digit ewbNumber
- `GET /api/gst/returns/GSTR1/2026-04` → 200 with b2b/b2cl/b2cs/cdnr/cdnur/hsn/nil/exp
- `POST /api/gst/returns/GSTR1/2026-04/export` → NIC v3.0 envelope, rupee amounts
- `GET /api/gst/returns/GSTR3B/2026-04` → 200 with all 11 sections
- `POST /api/gst/backfill/preview` → counts of untagged products + null-pos invoices
- `POST /api/gst/backfill/execute` (with idempotency key) → writes AuditLog rows
- bad GSTIN → 400 GSTIN_FORMAT_INVALID
- unauthenticated → 401 UNAUTHORIZED
- NIC sandbox down simulation → 502 EINVOICE_NIC_UNAVAILABLE, invoice save still succeeds

**Frontend (screenshots, 320px + 375px, light + dark):**
- GstSettingsPage: loading, error, empty (toggle off), success (toggle on)
- InvoiceForm tax column: loading, error, empty (untagged), success
- EWayBill modal: loading, error, empty, success
- EInvoiceCard: not-generated, loading, error, success, cancel-window
- GSTR-1 export page: loading, error, empty, success
- GSTR-3B summary page: loading, error, empty, success
- BackfillWizard: 5 steps each captured at 320px
- Offline gate: e-invoice / EWB / GSTR export show "must be online" toast when offline
- 320px overflow audit: no horizontal scroll on any new screen
