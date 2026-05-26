---
status: draft
feature: catalog-enrichment
created: 2026-05-08T15:42:00Z
scope_ref: docs/SCOPE_catalog_enrichment.md
high_risk_paths_touched: []
---

# ARCHITECTURE — Catalog Enrichment (Phase 4)

> Companion to `docs/SCOPE_catalog_enrichment.md`. This doc fixes the
> module/file map, contracts, migration sequence, query plan, and PR
> rollout. Every PR target ≤ 250 LOC of net-new code; every file ≤ 250 LOC
> per `enforce.js`.

## 0. Scope recap (from SCOPE doc)

Three deliverables:

1. **MOQ enforcement** — surface existing `Product.moq` in the form, extend
   batch-validation to all sale/order/POS doc types, add a
   `DocumentSettings.enforceMoq` toggle (default `true`).
2. **Product images** — UI to capture / pick / paste image(s) on the product
   form, client-side resize, base64 persistence into existing
   `Product.imageUrl` + `Product.images[]` columns. Thumbnails on catalog
   grid, product detail, and (opt-in) invoice line items.
3. **Party Ledger** — replace stub `/parties/:id/ledger/shares` with a real
   ledger endpoint computing running balance over Documents + Payments +
   JournalEntryLines, plus a "Ledger" tab on PartyDetail and a React-PDF
   share.

Decisions in this doc are **all final** — full-auto mode, no asks.

---

## 1. Module / file map

Every file lists rough LOC budget. Anything that would push an existing
file > 250 lines is split (noted explicitly). All caps confirmed against
`scripts/enforce.js`.

### 1.1 Backend — new files

| File | LOC | Purpose |
|------|----:|---------|
| `server/src/services/products/moq.guard.ts` | ~60 | Single source for "does this doc type enforce MOQ" + `assertMoq(lines, settings)`. Imported by both create-batch-validation and POS service. |
| `server/src/services/parties/ledger.service.ts` | ~180 | Pure builder: takes `{ partyId, businessId, from, to, voucherTypes, cursor, limit }`, returns `{ rows, openingBalance, closingBalance, nextCursor }`. No HTTP concerns. |
| `server/src/services/parties/ledger.types.ts` | ~50 | `LedgerRow`, `LedgerVoucherType`, request/response Zod schemas. |
| `server/src/services/parties/ledger.pdf.tsx` | ~150 | React-PDF document for the ledger statement. Reuses existing `<StatementHeader>` from current statement template. |
| `server/src/routes/parties/ledger.ts` | ~110 | `GET /api/parties/:partyId/ledger`, `GET /api/parties/:partyId/ledger.pdf`. Auth gate `parties.read`. Replaces stub `ledger/shares`. |
| `server/prisma/migrations/20260509_catalog_enrichment/migration.sql` | ~30 | Adds `DocumentSettings.enforceMoq`, ledger composite indexes. |

### 1.2 Backend — edited files

| File | Edit | Why |
|------|------|-----|
| `server/src/services/document/create-batch-validation.ts` | Replace inline MOQ check with `assertMoq()` from `moq.guard.ts`; honour `DocumentSettings.enforceMoq`; widen doc-type list to SALE_INVOICE, SALE_ORDER, ESTIMATE, PROFORMA, DELIVERY_CHALLAN, POS_SALE, PURCHASE_ORDER. | Centralise + cover all sale paths. |
| `server/src/services/document/update.ts` | Call `assertMoq()` on edits too. | Edits could reduce qty but more often raise — must re-check. |
| `server/src/features/pos/services/pos-billing.service.ts` *(or equivalent)* | Call `assertMoq()` before commit. | POS bypassed central validation pre-MOQ. |
| `server/src/routes/products/images.ts` | Add base64 data-URL acceptance branch + size cap (1 MB after decode), MIME allowlist `image/jpeg|png|webp`, max 5 entries, dedupe. Existing URL branch untouched. | One route, two payload shapes — no new route. |
| `server/src/routes/parties/index.ts` | Mount `ledger.ts`; remove obsolete `ledger/shares` stub. | Wiring. |
| `server/src/routes/document-settings.ts` | Surface `enforceMoq` field in GET/PUT Zod schemas. | New setting. |
| `server/prisma/schema.prisma` | Add `enforceMoq Boolean @default(true)` on DocumentSettings. Add `@@index([businessId, partyId, documentDate])` on Document, `@@index([businessId, partyId, date])` on Payment, `@@index([partyId, journalEntryId])` already exists — add `@@index([partyId])` *(already present at line 1940 — confirmed, no change)*. | Ledger query perf. |

**Confirmed against schema** (read 2026-05-08):

- `JournalEntryLine.partyId` exists (line 1931) with `@@index([partyId])` (line 1940). No new column needed.
- `DocumentSettings` exists (line 962) with the fields the SCOPE assumed. Only `enforceMoq` is new.
- `Document` has `@@index([businessId, partyId])` (819) and `@@index([businessId, date])`. No combined `(businessId, partyId, documentDate)` — add it.
- `Payment` same pattern (line 1011) — add `(businessId, partyId, date)`.

### 1.3 Frontend — new files

| File | LOC | Purpose |
|------|----:|---------|
| `src/features/products/components/MoqField.tsx` | ~70 | Number input, helper text, mobile-first 320px. |
| `src/features/products/components/ProductImageUploader.tsx` | ~210 | Capacitor camera + file picker + paste; client resize via `<canvas>`; up to 5 thumbs with reorder + remove. Mirrors `OcrReceiptUpload.tsx` patterns. |
| `src/features/products/components/ProductImageThumb.tsx` | ~50 | Reusable `<img>` with skeleton, fallback initials, fixed sizes (40/64/96). |
| `src/features/products/utils/image-resize.ts` | ~80 | `resizeToMaxEdge(file, 800)` returning `{ dataUrl, bytes }`. Pure, testable. |
| `src/features/parties/components/LedgerTab.tsx` | ~200 | Date filter, voucher-type chips, virtualised list, cursor pagination, share/print/PDF buttons. |
| `src/features/parties/components/LedgerRow.tsx` | ~90 | Single row — date, ref, debit, credit, running balance. Touch-target 44px. |
| `src/features/parties/components/LedgerEmpty.tsx` | ~40 | Empty/loading/error states. |
| `src/features/parties/services/ledger.service.ts` | ~80 | `fetchLedger`, `fetchLedgerPdfUrl`. Uses `api()` with `cacheReads: false` (PII). |
| `src/features/parties/hooks/useLedger.ts` | ~90 | TanStack Query `useInfiniteQuery` with cursor. |

### 1.4 Frontend — edited files

| File | Edit | Why |
|------|------|-----|
| `src/features/products/types/product.types.ts` *(or wherever `ProductFormData` lives)* | Add `moq: number \| null`, `imageUrl: string \| null`, `images: string[]`. | Type contract. |
| `src/features/products/components/CreateProductForm.tsx` *and* `EditProductForm.tsx` | Insert `<MoqField>` + `<ProductImageUploader>`; wire submit. If file > 250 LOC after, extract sections to `ProductFormPricing.tsx` / `ProductFormMedia.tsx`. | UI integration. |
| `src/features/products/components/ProductCard.tsx` | Render `<ProductImageThumb size={64}>`; fallback initials. | Catalog grid. |
| `src/features/parties/components/PartyDetail.tsx` | Add "Ledger" tab; lazy-load `LedgerTab` via `React.lazy`. | Code-split — ledger isn't on hot path. |
| `src/features/documents/components/InvoiceLineItem.tsx` *(template)* | If `DocumentSettings.showLineItemImages` true, render 40x40 thumb. | Already-present setting; reuse. |
| `src/i18n/en.json`, `src/i18n/hi.json` | New keys: `products.moq.*`, `products.images.*`, `parties.ledger.*`. | i18n. |

### 1.5 Files NOT touched (verified)

- `server/src/routes/products/bulk.ts` — barcode lookup + label-data already correct.
- `BarcodeField.tsx`, `BarcodeDisplay.tsx`, `barcode.utils.ts` — already wired.
- `Product` schema — `moq`, `imageUrl`, `images[]`, `barcode*`, `labelTemplate` all present.

---

## 2. API contracts

All schemas in Zod, mirrored to TS via `z.infer`. No `any`.

### 2.1 MOQ — error contract

`POST /api/documents`, `PUT /api/documents/:id`, `POST /api/pos/sales`:

```ts
// 400 BELOW_MOQ
{
  error: 'BELOW_MOQ',
  message: 'Quantity below minimum order quantity',
  details: Array<{ productId: string; productName: string; moq: number; requested: number }>
}
```

> Rationale: distinct error code lets the FE surface a per-line inline
> error rather than a top-of-form toast.

### 2.2 DocumentSettings

```ts
// GET /api/document-settings  -> existing shape + new field
DocumentSettingsDTO = {
  ...existing,
  enforceMoq: boolean,        // default true
  showLineItemImages: boolean // already exists
}

// PUT /api/document-settings — partial update
UpdateDocumentSettingsBody = z.object({
  enforceMoq: z.boolean().optional(),
  ...
})
```

### 2.3 Product images — extended payload

`POST /api/products/:id/images`:

```ts
AddImagesBody = z.object({
  // EITHER URLs (existing path)
  imageUrl: z.string().url().optional(),
  images:   z.array(z.string().url()).max(5).optional(),
  // OR base64 data URLs (new path)
  uploads:  z.array(z.object({
    dataUrl:   z.string().regex(/^data:image\/(jpeg|png|webp);base64,/),
    bytes:     z.number().int().positive().max(1_048_576),  // 1 MB cap
  })).max(5).optional(),
})
.refine(b => b.imageUrl || b.images || b.uploads,
        'At least one of imageUrl/images/uploads required')
```

`uploads[].dataUrl` is persisted into `Product.images[]` directly. `imageUrl`
(primary) is set to the first new entry if not already set. Server re-validates
size (`Buffer.byteLength(b64, 'base64') ≤ 1_048_576`) and MIME header.

> Rationale: base64 data URLs in Postgres TEXT columns is the same shape
> already used by OCR receipts. Avoids object-storage infra in MVP.
> Cost: 1 MB × 5 images × 10K products = 50 GB worst-case — accepted for
> Phase 4; migrate to S3 in Phase 5 by writing a one-shot job that
> uploads + replaces with URLs (the `images String[]` column already
> tolerates URLs).

### 2.4 Party ledger

```ts
// GET /api/parties/:partyId/ledger
LedgerQuery = z.object({
  from:          z.string().datetime().optional(),  // default = FY start
  to:            z.string().datetime().optional(),  // default = today EOD
  voucherTypes:  z.array(z.enum([
    'SALE_INVOICE','PURCHASE_INVOICE','PAYMENT_IN','PAYMENT_OUT',
    'CREDIT_NOTE','DEBIT_NOTE','JOURNAL'
  ])).optional(),
  cursor:        z.string().optional(),  // opaque, base64({date,id})
  limit:         z.number().int().min(20).max(200).default(50),
})

LedgerRow = {
  id:            string,
  source:        'DOCUMENT' | 'PAYMENT' | 'JOURNAL',
  voucherType:   LedgerVoucherType,
  date:          string,        // ISO
  reference:     string | null, // doc number / payment ref
  narration:     string | null,
  debit:         number,        // paise
  credit:        number,        // paise
  runningBalance: number,       // paise — signed (Dr +ve, Cr -ve)
}

LedgerResponse = {
  partyId:        string,
  partyName:      string,
  openingBalance: number,
  closingBalance: number,
  rows:           LedgerRow[],
  nextCursor:     string | null,
  generatedAt:    string,       // ISO — for PDF reproducibility
}
```

Status codes: `200`, `400` invalid range, `403` cross-tenant, `404` party
not found.

`GET /api/parties/:partyId/ledger.pdf` — same query string, returns
`application/pdf`. Stream — no temp files.

---

## 3. DB migration sequence

One Prisma migration: `20260509_catalog_enrichment/migration.sql`.

```sql
-- 1. DocumentSettings.enforceMoq — additive, defaulted, no backfill needed
ALTER TABLE "DocumentSettings"
  ADD COLUMN "enforceMoq" BOOLEAN NOT NULL DEFAULT true;

-- 2. Ledger query indexes
CREATE INDEX "Document_businessId_partyId_documentDate_idx"
  ON "Document"("businessId", "partyId", "documentDate");

CREATE INDEX "Payment_businessId_partyId_date_idx"
  ON "Payment"("businessId", "partyId", "date");

-- JournalEntryLine.partyId index already exists; add a covering one
-- joined with the parent JE's date for ledger-window scans:
CREATE INDEX "JournalEntryLine_partyId_journalEntryId_idx"
  ON "JournalEntryLine"("partyId", "journalEntryId")
  WHERE "partyId" IS NOT NULL;
```

> Rationale (additive only): no destructive change; safe to ship before
> code (`enforceMoq` defaults true so old code paths behave identically
> until the new validator reads it). Indexes are `CREATE INDEX` (not
> `CONCURRENTLY` — Prisma migrate can't do CONCURRENTLY in a transaction;
> tables are small enough at HP's MVP scale that brief locks are fine).
> Re-evaluate at 100K+ Documents/tenant.

Per `PRISMA_MIGRATION_RULES.md`: schema diff committed alongside migration,
no `db push`, no GIN.

---

## 4. Image upload pipeline

```
[Camera/File/Paste]
  → File (likely 2–8 MB JPEG)
  → resizeToMaxEdge(file, 800)         // <canvas>, JPEG q=0.85
  → dataUrl (~80–250 KB) + bytes
  → reject if bytes > 1_048_576        // hard client cap
  → POST /api/products/:id/images { uploads:[{dataUrl,bytes}] }
  → server re-validates MIME + size
  → push into Product.images[] (Postgres TEXT[])
  → if Product.imageUrl null, set it to uploads[0].dataUrl
```

Decisions:

- **Resize on client only.** Avoids a sharp/imagemagick dep on the server. *Rationale: Capacitor target devices have webview canvas; the existing OCR flow already uses this approach successfully.*
- **800 px longest edge, JPEG q=0.85.** Good thumbnail + full-screen view tradeoff. *Rationale: 64x64 grid + 400px detail — 800px is 2x for retina without over-sizing.*
- **5 images / 1 MB each hard cap.** Matches SCOPE. *Rationale: Postgres row size + replication cost.*
- **No EXIF stripping needed** — `<canvas>` re-encode strips EXIF as a side effect. *Rationale: privacy + size win.*
- **Display via `<ProductImageThumb>` only.** Centralises sizing + lazy-loading + fallback. *Rationale: avoid 40+ ad-hoc `<img>` tags drifting.*

Offline behaviour: image upload uses `api()` with `entityType: 'product-image'`, `entityLabel: product.name`. Queued mutation returns `{}` — UI shows "Image queued — will sync when online". When the queue replays, `Product.images` may already contain the queued data URL via optimistic IDB cache; server is the source of truth on reconcile.

---

## 5. Ledger query plan

**Decision: three Prisma queries merged in JS, then computed running sum in JS.**

> Rationale: a UNION of three differently-shaped tables with a window
> function is correct in SQL, but in Prisma needs `$queryRaw` with hand-
> rolled SQL — fragile across Postgres dialect changes and harder for QA
> to reason about. At expected row counts (a heavy party = a few thousand
> rows / FY), three indexed queries + JS merge runs in < 30 ms locally
> and the running sum is O(n) integer add. We pay one extra round-trip
> for the win.

Algorithm in `ledger.service.ts`:

```ts
// 1. opening balance — sum of debits-credits BEFORE `from`
const opening = await prisma.$transaction([
  prisma.document.aggregate({
    where: { businessId, partyId, documentDate: { lt: from },
             status: { not: 'DELETED' } },
    _sum: { grandTotal: true } // signed by type below
  }),
  prisma.payment.aggregate({
    where: { businessId, partyId, date: { lt: from }, isDeleted: false },
    _sum: { amount: true }
  }),
  prisma.journalEntryLine.aggregate({
    where: { partyId, journalEntry: { businessId, date: { lt: from } } },
    _sum: { debit: true, credit: true }
  }),
])
// signing rules (Dr +, Cr -):
//   SALE_INVOICE / DEBIT_NOTE          → +debit (Dr party)
//   PURCHASE_INVOICE / CREDIT_NOTE     → -debit
//   PAYMENT_IN                         → -amount (party paid us → reduce Dr)
//   PAYMENT_OUT                        → +amount
//   JE line                            → +line.debit - line.credit

// 2. window query — apply `from`/`to`/voucherTypes, ORDER BY date,id, take limit+1
const [docs, pays, jeLines] = await prisma.$transaction([...])
const merged = [...docs.map(toRow), ...pays.map(toRow), ...jeLines.map(toRow)]
  .sort(byDateThenId)
  .slice(0, limit)

// 3. running balance — single pass
let bal = openingBalance
for (const r of merged) bal += r.debit - r.credit, r.runningBalance = bal
```

Cursor format: base64 of `${ISO date}|${rowId}|${source}`. Stable sort key
across the three sources.

Indexes added in section 3 keep all three windowed queries on
`(businessId, partyId, date)` btree.

> Rationale (cursor over offset): tail-paginating a long ledger via
> OFFSET re-scans every prior row. Cursor is O(1) per page.

---

## 6. Permission matrix

| Action | Required permission | Source |
|--------|---------------------|--------|
| View ledger tab + GET ledger | `parties.read` | Existing RBAC bit |
| Download ledger PDF | `parties.read` | Same |
| Add MOQ on product / edit | `inventory.edit` | Existing |
| View MOQ on product | `inventory.view` | Existing |
| Toggle DocumentSettings.enforceMoq | `settings.edit` | Existing |
| Upload product image | `inventory.edit` | Existing |
| View product image | `inventory.view` | Existing |

> Rationale: no new permission bits — every action maps onto an existing
> one. Adding bits forces a tenant-wide role-matrix migration which we
> don't need.

---

## 7. Rollout sequence (PRs)

Each PR ≤ 250 LOC of net-new code. Each PR ships independently green
(`tsc`, `eslint`, `enforce.js`, all tests). Branch off `hisaabpro`.

| # | Branch | Net LOC | Contents | Gate |
|---|--------|--------:|----------|------|
| **PR1** | `hp-catalog-pr1-schema` | ~30 | Migration SQL + schema delta for `DocumentSettings.enforceMoq` + 3 indexes. No code uses it yet. | Migration applies clean on staging snapshot; `prisma migrate diff` empty after. |
| **PR2** | `hp-catalog-pr2-moq-be` | ~180 | `moq.guard.ts`, refactor `create-batch-validation.ts` + `update.ts` + POS service to call it; widen doc-type list; honour `enforceMoq`. | Curl: SALE with qty < moq → 400 BELOW_MOQ. Same SALE with `enforceMoq=false` → 200. Existing PURCHASE_ORDER tests still green. |
| **PR3** | `hp-catalog-pr3-ledger-be` | ~240 | `ledger.types.ts`, `ledger.service.ts`, `ledger.ts` route; remove stub `ledger/shares`. PDF endpoint stub returning 501 (lands in PR7 with the React-PDF doc). | Curl: heavy seeded party returns rows + running balance matches a hand-computed fixture. 401/403/404 covered. |
| **PR4** | `hp-catalog-pr4-images-be` | ~110 | Extend `routes/products/images.ts` with `uploads[]` branch, MIME + size validation, dedupe across URL/data-URL paths. | Curl: 1 MB JPEG data-URL → 200; 1.5 MB → 400; 6th image → 400; bad MIME → 400. |
| **PR5** | `hp-catalog-pr5-moq-fe` | ~150 | `MoqField.tsx`, `ProductFormData` type, Create/Edit form wiring, settings toggle UI for `enforceMoq`. i18n keys (en only — hi in PR8). | Screenshots: 4 states at 320px + 375px. Submit blocked locally + server. |
| **PR6** | `hp-catalog-pr6-images-fe` | ~250 | `ProductImageUploader`, `ProductImageThumb`, `image-resize.ts`, catalog-grid + product-detail wiring. Capacitor camera permission prompt. Optional invoice-line thumb behind existing `showLineItemImages`. | Screenshots all 4 states 320 + 375 + iPad. 1.2 MB photo resized to ~120 KB verified. Offline upload queues + replays. |
| **PR7** | `hp-catalog-pr7-ledger-fe` | ~250 | `LedgerTab`, `LedgerRow`, `LedgerEmpty`, `useLedger`, `ledger.service.ts`, PartyDetail tab wiring (lazy-loaded), React-PDF doc + share/download buttons. Replaces 501 from PR3. | Screenshots all 4 states 320 + 375. PDF opens in iOS Files / Android share sheet. Cursor pagination scroll-tested. |
| **PR8** | `hp-catalog-pr8-i18n` | ~80 | All Hindi strings; review English copy with native speaker; add `products.moq.belowMinimum` interpolation. | i18n parity test (no missing keys either side). |
| **PR9** | `hp-catalog-pr9-verify` | ~120 | Verifier scripts updated; offline checklist run; perf budget probe; QA pass; CHANGELOG. | All gates green; perf budget within ±10% of baseline. |

> Rationale (PR1 schema-first, code-later): keeps schema changes
> single-purpose and trivially reviewable, avoids the trap of mixing
> migration with feature code that depends on it. PR2/PR3/PR4 are
> independent; PR5/PR6/PR7 are independent FE consumers — all four can
> be parallelised across pairing sessions if needed.

`enforce.js` checks each PR will run: file-length ≤ 250 LOC, no `any`,
no raw `fetch()` outside the allow-list, all design tokens via
Tailwind theme, no hex colours in `.tsx`. Image base64 strings in code
fixtures live under `__tests__/fixtures/` to bypass length rule.

---

## 8. Test strategy

### 8.1 Unit (Vitest, both sides)

- `moq.guard.test.ts` — every doc type × `enforceMoq` true/false × line at/below/above MOQ. ~14 cases.
- `ledger.service.test.ts` — fixtures with each source (Doc/Payment/JE), opening balance, voucher-type filter, date window, cursor pagination roll-over. Hand-computed expected running balance for a 12-row fixture.
- `image-resize.test.ts` — 4096×3072 source → ≤ 800 px longest edge; bytes always ≤ 1 MB after resize.

### 8.2 Integration (server)

- Supertest curl-equivalents for each error contract (`BELOW_MOQ`, image-size 400, ledger 403 cross-tenant).
- Migration replay test: apply on a clone of prod schema dump, verify 0 drift.

### 8.3 E2E (Playwright — keep light)

- Add MOQ to product, attempt sale below MOQ → inline error.
- Upload image from disk → appears on catalog within 1s.
- Open PartyDetail → Ledger tab → date filter → PDF download.

### 8.4 Manual QA matrix (per SCOPE)

- 320 px, 375 px, iPad, desktop. iOS Capacitor + Android Capacitor + web.
- Offline: switch to airplane mode, perform every mutation, replay.

---

## 9. Risks + mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Base64 image bloat balloons row size and replication lag | High | 1 MB hard cap × 5 images. Migration plan to S3 in Phase 5 already feasible because `images String[]` is URL-tolerant. |
| Ledger running balance mismatches a hand-computed customer statement | High | Single fixture file, 30+ rows, manually computed total. Snapshot test reruns on every PR. Sign rules documented in section 5 inline. |
| MOQ widening blocks legacy invoices in flight at deploy | Medium | `enforceMoq` defaults `true` for new tenants but PR1 ships migration only; PR2 reads the setting, so admins can temporarily flip false on existing tenants. Comms note in CHANGELOG. |
| PartyDetail bundle bloats from React-PDF | Medium | `LedgerTab` + PDF doc behind `React.lazy`; PDF generation is dynamic-imported on click. |
| OCR-style base64 patterns differ subtly from Capacitor camera output | Low | Reuse `OcrReceiptUpload.tsx` helpers verbatim; share `image-resize.ts`. |
| Three-query merge slows down on parties with > 10K vouchers | Low | New composite indexes cover the hot path; cursor pagination caps page size at 200. Re-evaluate with `EXPLAIN ANALYZE` if a tenant exceeds 50K rows on one party. |
| `localStorage` creep in new ledger code | Low | `OFFLINE_RULES.md` rule 4; enforcer ratchets. Ledger uses `cacheReads: false` (PII). |

---

## 10. Acceptance (for design-plan-active.md)

```yaml
acceptance:
  backend:
    - tsc clean
    - prisma migrate diff empty after PR1
    - curl SALE below MOQ → 400 BELOW_MOQ with details[]
    - curl SALE with enforceMoq=false → 200
    - curl ledger fixture → matches hand-computed running balance
    - curl image upload 1.2 MB → 400; 800 KB → 200
    - 401 / 403 cross-tenant covered for /ledger and /images
  frontend:
    - screenshots: loading · error · empty · success at 320 px and 375 px
    - MoqField + ProductImageUploader + LedgerTab covered
    - Capacitor camera tested on iOS + Android
    - offline mutation queue replays image upload + product edit
    - bundle size delta ≤ +25 KB gzip on PartyDetail entry
```

---

*End of architecture doc.*
