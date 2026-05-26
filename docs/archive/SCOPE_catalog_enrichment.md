# SCOPE: Catalog Enrichment — Phase 4 Epic
**Issues:** #116 (Item Images polish), #117 (Product MOQ), #120 (Party Ledger)
**Date:** 2026-05-08
**Status:** APPROVED FOR BUILD

---

## Goal

Three catalog/accounting features that bring HisaabPro to wholesaler-grade quality:
(1) prevent under-quantity orders at the line level, (2) complete the product image pipeline so items look professional in the catalog and on invoices, and (3) give parties a formal double-entry ledger view distinct from the existing collection statement.

---

## Personas

| Persona | Primary touchpoint |
|---------|-------------------|
| **Raju** (micro retailer) | MOQ warning during POS checkout; product thumb in catalog grid |
| **Priya** (growing wholesaler) | MOQ enforcement on SALE/SALE_ORDER; party ledger for reconciliation; product images on invoice line items |

---

## Assumptions

1. **Schema is already migrated.** `Product.moq Int?` and `Product.imageUrl/images` columns exist in the phase-4 migration (`20260320130000_feat_phase4_images_moq_labels_stock_verification`). No new migration needed for these two fields.
2. **`DocumentSettings` carries the two new boolean flags** `enforceMoq` (default `true`) and `showLineItemImages` (default `false`). A migration adds these two columns to `DocumentSettings`. No separate `BusinessSettings` model is created.
3. **Image storage is URL-based, not blob-in-DB.** The upload pipeline converts the picked file to base64 → POST to `/api/products/:id/images/upload` (multipart or base64 body) → server validates, stores to an S3-compatible bucket (or local FS in dev), returns the public URL. The existing `/api/products/:id/images` route already accepts URLs; the new upload route is the missing piece.
4. **Business logo upload pipeline** exists on the auth/business-profile route (`/api/auth/business` or similar). The upload helper in `server/src/lib/upload.ts` (or equivalent) is reused. If the helper does not exist, a new one is created and shared.
5. **Capacitor `@capacitor/camera` and `@capacitor/filesystem` are already installed** (used for receipt OCR). No new native plugin installs needed.
6. **Drag-to-reorder** uses a touch-friendly list. Given Capacitor 8 + React 19, `@hello-pangea/dnd` (already used if present, else `react-beautiful-dnd` replacement) is the implementation. If neither is installed, reorder is done via up/down arrow buttons on mobile (simpler, no new dep).
7. **Party Ledger** reads from three sources: `Document` (where `partyId = X` and `isDeleted = false`), `Payment` (where `partyId = X` and `isDeleted = false`), and `JournalEntryLine` (where `partyId = X` and `journalEntry.status = 'POSTED'`). Journal lines are the source of truth for DR/CR amounts in paise.
8. **Running balance** is computed server-side (opening balance at range start + cumulative net per row, chronological ASC). The client does not recompute it.
9. **Ledger is a new tab on PartyDetail**, not a new top-level route. The existing PartyDetail page has a tab bar; "Ledger" is added next to "Statement".
10. **PDF share** reuses the same React-PDF share flow as the statement. The filename template is `ledger_<partyName>_<fromDate>_<toDate>.pdf`.
11. **MOQ = 0 is treated identically to NULL** (no MOQ set). The UI shows an empty field for both.
12. **MOQ validation fires only on document line save/submit, not on keystroke.** The 400 / `BELOW_MOQ` error is returned by the document creation/update endpoint.
13. **`enforceMoq = false`** means the server returns a 200 with a `warnings: [{ code: 'BELOW_MOQ', ... }]` field instead of a 400. The client shows a warning toast and allows the operation to proceed.
14. **Catalog grid thumbnail** is 64×64px. Invoice line item thumbnail is 40×40px. Both use `imageUrl` (primary image). No lazy-load library needed — native `loading="lazy"` on `<img>`.
15. **i18n keys** follow the existing pattern in `src/i18n/en.json` and `src/i18n/hi.json`.
16. **Permission model:** Images and MOQ are gated on `inventory.edit` (write) / `inventory.view` (read). Party ledger is gated on `parties.read`. No new permissions.
17. **Rate limits:** Ledger endpoint 30 req/min per user (same as statement). Image upload 10 req/min per user.
18. **Offline behaviour:** Ledger and catalog reads use `cacheReads: true`. Image uploads and MOQ mutations queue normally via `api()` with `entityType`/`entityLabel`.

---

## User Stories

### Feature 1 — Product MOQ (#117)

| # | As... | I want... | So that... |
|---|-------|-----------|------------|
| 1.1 | Priya | to set a minimum order qty on each product | I don't accept below-minimum line items from staff or customers |
| 1.2 | Priya | the system to block a sale line if qty < MOQ | under-quantity orders never get created by mistake |
| 1.3 | Raju | to see a warning (not a block) when MOQ enforcement is off | I know the customer is ordering below my preferred minimum |
| 1.4 | Priya | to enter MOQ in Hindi on the product form | the field is accessible without English literacy |

### Feature 2 — Item Images Polish (#116)

| # | As... | I want... | So that... |
|---|-------|-----------|------------|
| 2.1 | Priya | to attach up to 5 photos to a product from my phone camera or gallery | my catalog looks professional |
| 2.2 | Raju | to see a small product thumbnail in the catalog item grid | I can identify products without reading the name |
| 2.3 | Priya | the primary product image to appear on invoice line items (opt-in) | customers see product photos on their invoice PDF |
| 2.4 | Priya | to delete an image by tapping-and-holding it | I can remove wrong photos |
| 2.5 | Priya | to reorder images so the best photo becomes primary | the first photo is what customers see |

### Feature 3 — Party Ledger (#120)

| # | As... | I want... | So that... |
|---|-------|-----------|------------|
| 3.1 | Priya | to see a formal debit/credit ledger for each party | I can reconcile party balances like an accountant |
| 3.2 | Priya | to filter the ledger by date range and voucher type | I can focus on a specific period or transaction type |
| 3.3 | Priya | to share the ledger as a PDF | I can send it to the party over WhatsApp |
| 3.4 | Priya | the running balance to always be accurate | I trust the numbers without manual computation |

---

## Functional Requirements

### FR-1: Product MOQ

**FR-1.1 — Schema**
- `Product.moq Int?` already in schema (migration shipped). No new migration for the field.
- New migration: add `enforceMoq Boolean @default(true)` and `showLineItemImages Boolean @default(false)` to `DocumentSettings`.

**FR-1.2 — Product form**
- Field label EN: `Minimum Order Qty (MOQ)` / HI: `न्यूनतम ऑर्डर मात्रा (MOQ)`
- Input type: numeric, min 1, no decimal, optional.
- Placeholder EN: `e.g. 10` / HI: `जैसे 10`
- Inline helper text EN: `Leave blank for no minimum` / HI: `कोई न्यूनतम नहीं के लिए खाली छोड़ें`
- Appears in both Create Product and Edit Product forms, in the "Details" section below unit/category.

**FR-1.3 — Document line validation (server)**
- Applies to document types: `SALE`, `ESTIMATE`, `SALE_ORDER`, `DELIVERY_CHALLAN`, `POS_SALE`.
- On line create or update: fetch `product.moq` for each line's `productId`.
- If `moq` is null or 0: no check.
- If `line.qty < product.moq`:
  - If `business.documentSettings.enforceMoq = true`: return HTTP 400 `{ success: false, error: { code: "BELOW_MOQ", message: "Qty X is below minimum order qty Y for product Z" } }`.
  - If `enforceMoq = false`: proceed with save; return HTTP 200 with `{ success: true, data: {...}, warnings: [{ code: "BELOW_MOQ", productId, productName, qty, moq }] }`.
- Validation runs per-line; multiple violations return all in a single `errors[]` array (enforce=true) or `warnings[]` array (enforce=false).

**FR-1.4 — Client handling**
- On 400 `BELOW_MOQ`: show inline error below the qty field: `Qty must be at least {moq}` / `मात्रा कम से कम {moq} होनी चाहिए`.
- On 200 with `warnings[].BELOW_MOQ` (enforce=false): show warning toast: `Below MOQ for {productName} (min {moq})` / `{productName} का MOQ {moq} है — जारी है`.
- If product has no MOQ: no UI change.

**FR-1.5 — Settings toggle**
- Location: Settings > Document Settings > "Enforce MOQ" toggle.
- Label EN: `Enforce minimum order quantity` / HI: `न्यूनतम मात्रा लागू करें`
- Sub-label EN: `Block sales below MOQ. Turn off to show warnings only.`
- Default: on.

---

### FR-2: Item Images Polish (#116)

**FR-2.1 — Upload endpoint**
- `POST /api/products/:id/images/upload`
- Accept: `multipart/form-data` with field `image` (file).
- Validate: max 1 MB, MIME type in `[image/jpeg, image/png, image/webp]`.
- On success: store file (S3 or local), build public URL, call existing upsert logic → update `Product.images[]` and `Product.imageUrl`.
- Return: `{ success: true, data: { product: { id, imageUrl, images } } }`.
- Errors: `FILE_TOO_LARGE` (400), `INVALID_FILE_TYPE` (400), `MAX_IMAGES_EXCEEDED` (400, max 5), `PRODUCT_NOT_FOUND` (404).
- Permission: `inventory.edit`.
- Rate limit: 10 req/min per user.

**FR-2.2 — Delete endpoint (already exists)**
- `DELETE /api/products/:id/images/:index` — already implemented.
- No changes; document the existing route in this SCOPE for QA reference.

**FR-2.3 — Reorder endpoint**
- `PUT /api/products/:id/images/reorder`
- Body: `{ images: string[] }` — full ordered array of URLs (must be a permutation of existing `images`).
- Validates: same set of URLs, no additions or removals.
- Sets `imageUrl = images[0]`.
- Return: `{ success: true, data: { product: { id, imageUrl, images } } }`.
- Permission: `inventory.edit`.

**FR-2.4 — Product form image uploader**
- Up to 5 image slots rendered as a horizontal scroll strip.
- Each slot: 80×80px card, rounded-lg, border dashed when empty.
- Tap empty slot → Capacitor action sheet: "Camera" | "Gallery" | "Cancel".
- Tap filled slot → action sheet: "Delete" | "Make Primary" | "Cancel".
- Reorder: up/down arrow buttons visible on each non-first/non-last image card. (No drag-and-drop dependency required on mobile.)
- Primary indicator: blue border + "Primary" badge on `images[0]`.
- Upload progress: spinner overlay on the slot being uploaded.
- Error: inline red text below strip.

**FR-2.5 — Catalog grid thumbnail**
- Product card in catalog/items-library grid shows 64×64px image (object-cover, rounded-md) at top-left of card.
- Fallback: grey placeholder with product initial letter.
- `loading="lazy"` on `<img>`.

**FR-2.6 — Invoice line item thumbnail**
- Applies when `documentSettings.showLineItemImages = true`.
- In the document form line row: 40×40px thumbnail left of product name.
- In React-PDF rendered invoice: 40×40pt image in the line item row.
- Fallback: no image cell (graceful omit if URL is null/broken).

**FR-2.7 — showLineItemImages setting**
- Location: Settings > Document Settings > "Show product images on invoices" toggle.
- Label EN: `Show product images on invoices` / HI: `इनवॉइस पर उत्पाद चित्र दिखाएं`
- Default: off.

---

### FR-3: Party Ledger (#120)

**FR-3.1 — Ledger endpoint**
- `GET /api/parties/:partyId/ledger`
- Query params:
  - `from` (required, ISO date string)
  - `to` (required, ISO date string)
  - `types` (optional, comma-separated: `INVOICE,PAYMENT,CREDIT_NOTE,DEBIT_NOTE,JOURNAL`)
  - `cursor` (optional, opaque cursor for next page)
  - `limit` (optional, default 50, max 100)
- Response:

```ts
interface LedgerRow {
  id: string              // source record ID
  date: string            // ISO date
  particulars: string     // narration / party name / product summary
  voucherType: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'JOURNAL'
  voucherNumber: string   // INV-2526-001 etc.
  debit: number           // paise; 0 if credit row
  credit: number          // paise; 0 if debit row
  balance: number         // running balance paise (positive = receivable, negative = payable)
}

interface LedgerResponse {
  success: true
  data: {
    partyId: string
    partyName: string
    from: string
    to: string
    openingBalance: number   // paise — balance before `from`
    closingBalance: number   // paise — balance at end of `to`
    totalDebit: number       // paise — sum of debit over range
    totalCredit: number      // paise — sum of credit over range
    rows: LedgerRow[]
    nextCursor: string | null
    hasMore: boolean
  }
}
```

- Auth: required. `parties.read` permission.
- Tenant isolation: server enforces `businessId = req.user.businessId` on both party and all source records.
- Rate limit: 30 req/min per user.
- `cacheReads: true` on client (party-scoped, tenant-isolated).

**FR-3.2 — Data sources and mapping**

| Source model | Voucher type | DR condition | CR condition |
|-------------|-------------|-------------|-------------|
| `Document` (SALE, POS_SALE) | INVOICE | `totalAmount` → DR | — |
| `Document` (CREDIT_NOTE) | CREDIT_NOTE | — | `totalAmount` → CR |
| `Document` (DEBIT_NOTE) | DEBIT_NOTE | `totalAmount` → DR | — |
| `Document` (PURCHASE) | INVOICE | — | `totalAmount` → CR |
| `Payment` (PAYMENT_IN) | PAYMENT | — | `amount` → CR |
| `Payment` (PAYMENT_OUT) | PAYMENT | `amount` → DR | — |
| `JournalEntryLine` (where `partyId = X`, `status = POSTED`) | JOURNAL | `debit` → DR | `credit` → CR |

- Rows sorted chronologically ASC by `date`, then by `createdAt` for same-day tiebreak.
- Running balance = openingBalance + cumulative (DR - CR) per row.
- Opening balance = sum of all DR minus CR for the party before `from` date.

**FR-3.3 — UI: Ledger tab on PartyDetail**
- New tab labelled `Ledger` (EN) / `खाता बही` (HI) on the PartyDetail tab bar, placed after `Statement`.
- 4 UI states: Loading skeleton, Error (retry button), Empty (no transactions in range), Populated (table + pagination).
- Date range picker defaults to current financial year (April 1 → March 31).
- Voucher type filter: multi-select chip group (All / Invoice / Payment / Credit Note / Debit Note / Journal).
- Table columns on mobile (375px): Date | Particulars | DR | CR | Balance. Voucher # shown as sub-text under Particulars.
- "Load more" button at bottom of list (cursor pagination, not infinite scroll).
- Totals row pinned at bottom of loaded rows: "Total" | sum(DR) | sum(CR). Closing balance badge above totals.

**FR-3.4 — UI: PDF share**
- Share button (top-right of Ledger tab): generates PDF via React-PDF.
- PDF layout mirrors statement PDF: business header, party info, date range, table (Date | Particulars | Voucher # | Voucher Type | DR | CR | Balance), totals, closing balance.
- Filename: `ledger_<partyName>_<from>_<to>.pdf` (spaces replaced with `_`).
- Share via Capacitor Share → native share sheet (WhatsApp / Drive / etc.).

**FR-3.5 — Empty state**
- Text EN: `No transactions found for this period` / HI: `इस अवधि में कोई लेनदेन नहीं मिला`
- CTA: `Change date range` / `तारीख बदलें`.

---

## Non-Functional Requirements

| # | Requirement |
|---|-------------|
| NFR-1 | All API calls use `api()` from `@/lib/api`. No raw `fetch()` in feature code. |
| NFR-2 | All mutations pass `entityType` and `entityLabel`. |
| NFR-3 | Ledger GET and catalog reads use `cacheReads: true`. Image uploads do not cache. |
| NFR-4 | No `localStorage` writes for entity data. |
| NFR-5 | Mutation handlers tolerate optimistic `{}` return (offline queue safe). |
| NFR-6 | Each new file ≤ 250 LOC. Split into service / route / schema / hook / component layers. |
| NFR-7 | 375px primary layout, no overflow at 320px. Touch targets ≥ 44px. |
| NFR-8 | `tsc --noEmit` clean on both `server/` and `src/` after each feature. |
| NFR-9 | Image upload endpoint uses idempotency middleware (same file re-upload returns existing URL without duplication). |
| NFR-10 | Running balance computed server-side; never float — paise (Int) only throughout. |
| NFR-11 | Ledger pagination cursor-based (not offset). Avoid COUNT(*) queries; derive `hasMore` from `limit + 1` fetch. |

---

## API Contract

### MOQ — Document line validation (new error)

All existing document line create/update endpoints are amended. No new route.

```ts
// Error response when enforceMoq = true and qty < moq
interface BelowMoqError {
  success: false
  error: {
    code: 'BELOW_MOQ'
    message: string  // "Qty 2 is below minimum order qty 10 for Cement Bag"
    violations: Array<{
      lineIndex: number
      productId: string
      productName: string
      qty: number
      moq: number
    }>
  }
}

// Warning in response body when enforceMoq = false
interface SuccessWithWarnings<T> {
  success: true
  data: T
  warnings: Array<{
    code: 'BELOW_MOQ'
    productId: string
    productName: string
    qty: number
    moq: number
  }>
}
```

### Image Upload

```ts
// POST /api/products/:id/images/upload
// Content-Type: multipart/form-data
// Field: image (File, max 1MB, JPEG/PNG/WebP)

interface ImageUploadResponse {
  success: true
  data: {
    product: {
      id: string
      imageUrl: string | null
      images: string[]
    }
  }
}

// Errors
// 400 { success: false, error: { code: 'FILE_TOO_LARGE', message: 'Image must be under 1MB' } }
// 400 { success: false, error: { code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, WebP allowed' } }
// 400 { success: false, error: { code: 'MAX_IMAGES_EXCEEDED', message: 'Maximum 5 images per product' } }
// 404 { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } }
```

### Image Reorder

```ts
// PUT /api/products/:id/images/reorder
interface ReorderRequest {
  images: string[]   // full ordered array; must be same set as current images[]
}

interface ReorderResponse {
  success: true
  data: {
    product: {
      id: string
      imageUrl: string | null
      images: string[]
    }
  }
}

// 400 { success: false, error: { code: 'INVALID_ORDER', message: 'images must be a permutation of existing images' } }
```

### Party Ledger

```ts
// GET /api/parties/:partyId/ledger?from=2025-04-01&to=2026-03-31&types=INVOICE,PAYMENT&cursor=...&limit=50

interface LedgerRow {
  id: string
  date: string           // YYYY-MM-DD
  particulars: string
  voucherType: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'JOURNAL'
  voucherNumber: string
  debit: number          // paise
  credit: number         // paise
  balance: number        // paise running total
}

interface LedgerResponse {
  success: true
  data: {
    partyId: string
    partyName: string
    from: string
    to: string
    openingBalance: number
    closingBalance: number
    totalDebit: number
    totalCredit: number
    rows: LedgerRow[]
    nextCursor: string | null
    hasMore: boolean
  }
}

// Errors
// 401 { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }
// 403 { success: false, error: { code: 'FORBIDDEN', message: 'parties.read permission required' } }
// 400 { success: false, error: { code: 'VALIDATION_ERROR', message: 'from and to are required' } }
// 404 { success: false, error: { code: 'PARTY_NOT_FOUND', message: 'Party not found' } }
```

---

## Data Model

### New migration: DocumentSettings fields

```sql
-- Migration: add enforceMoq + showLineItemImages to DocumentSettings
ALTER TABLE "DocumentSettings"
  ADD COLUMN IF NOT EXISTS "enforceMoq" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "DocumentSettings"
  ADD COLUMN IF NOT EXISTS "showLineItemImages" BOOLEAN NOT NULL DEFAULT false;
```

Prisma schema additions to `DocumentSettings`:

```prisma
enforceMoq         Boolean @default(true)
showLineItemImages Boolean @default(false)
```

No other schema changes. `Product.moq`, `Product.imageUrl`, `Product.images` already exist.

---

## UI States (all 4 required per screen)

### Product Form (MOQ field + Image uploader)

| State | Description |
|-------|-------------|
| Loading | Form skeleton — field placeholders shimmer. Image strip shows 5 empty dashed slots. |
| Error | Toast: `Failed to save product. Please try again.` / `उत्पाद सहेजना विफल। पुनः प्रयास करें।` + Retry button on form. |
| Empty (new product) | All fields blank. MOQ field shows placeholder. Image strip shows 5 empty slots. |
| Success | Toast: `Product saved` / `उत्पाद सहेजा गया` (1.5s, bottom). Navigate back to product list. |

### Image Upload Slot

| State | Description |
|-------|-------------|
| Idle (empty) | Dashed border, plus icon, "Add photo" text below. |
| Uploading | Spinner overlay on slot, progress indicator. |
| Error | Red border, error icon, text: `Upload failed` / `अपलोड विफल`. Tap to retry. |
| Filled | Product image (object-cover), blue border on primary. Delete/reorder controls on tap. |

### Catalog Grid (thumbnail)

| State | Description |
|-------|-------------|
| Loading | Card skeleton with grey 64×64 square placeholder. |
| Error | Product initial letter in grey circle — same fallback as no-image state. |
| Empty (no image) | Grey circle with product initial letter, blue tint. |
| Loaded | 64×64 product thumbnail, object-cover, rounded-md. |

### Party Ledger Tab

| State | Description |
|-------|-------------|
| Loading | Row skeletons (8 rows of shimmer). Date picker and filter chips are visible but disabled. |
| Error | Full-tab error state: icon + `Failed to load ledger` / `खाता बही लोड नहीं हुई` + Retry button. |
| Empty | Illustration + `No transactions found for this period` / `इस अवधि में कोई लेनदेन नहीं मिला` + CTA `Change date range`. |
| Populated | Table rows + running balance + totals row + Load more button (if `hasMore`). Share PDF button active. |

---

## UX Copy

### MOQ

| Element | EN | HI |
|---------|----|----|
| Field label | Minimum Order Qty (MOQ) | न्यूनतम ऑर्डर मात्रा (MOQ) |
| Placeholder | e.g. 10 | जैसे 10 |
| Helper | Leave blank for no minimum | कोई न्यूनतम नहीं के लिए खाली छोड़ें |
| Inline error (enforce=true) | Qty must be at least {moq} | मात्रा कम से कम {moq} होनी चाहिए |
| Warning toast (enforce=false) | Below MOQ for {name} (min {moq}) | {name} का MOQ {moq} है — जारी है |
| Settings label | Enforce minimum order quantity | न्यूनतम मात्रा लागू करें |
| Settings sub-label | Block sales below MOQ. Turn off to show warnings only. | MOQ से कम पर रोक लगाएं। केवल चेतावनी के लिए बंद करें। |

### Images

| Element | EN | HI |
|---------|----|----|
| Uploader slot label | Add photo | फ़ोटो जोड़ें |
| Action sheet — camera | Camera | कैमरा |
| Action sheet — gallery | Gallery | गैलरी |
| Action sheet — delete | Delete | हटाएं |
| Action sheet — make primary | Make primary | प्राथमिक बनाएं |
| Upload error toast | Image upload failed | चित्र अपलोड विफल |
| File too large error | Image must be under 1MB | चित्र 1MB से छोटा होना चाहिए |
| Wrong type error | Only JPEG, PNG, WebP allowed | केवल JPEG, PNG, WebP |
| Max images error | Maximum 5 images per product | अधिकतम 5 चित्र |
| Delete success toast | Image removed | चित्र हटाया गया |
| Settings label | Show product images on invoices | इनवॉइस पर उत्पाद चित्र दिखाएं |

### Party Ledger

| Element | EN | HI |
|---------|----|----|
| Tab label | Ledger | खाता बही |
| Empty state | No transactions found for this period | इस अवधि में कोई लेनदेन नहीं मिला |
| Empty CTA | Change date range | तारीख बदलें |
| Error state | Failed to load ledger | खाता बही लोड नहीं हुई |
| Retry button | Retry | पुनः प्रयास |
| Load more button | Load more | और लोड करें |
| Share button | Share PDF | PDF शेयर करें |
| PDF generating toast | Generating PDF… | PDF बन रही है… |
| PDF share success | Ledger shared | खाता बही शेयर हुई |
| Column: Date | Date | तारीख |
| Column: Particulars | Particulars | विवरण |
| Column: DR | DR | डेबिट |
| Column: CR | CR | क्रेडिट |
| Column: Balance | Balance | शेष |
| Opening balance label | Opening Balance | आरंभिक शेष |
| Closing balance label | Closing Balance | अंतिम शेष |

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Product has MOQ but is added to document offline | Queue the mutation. When synced, server validates and returns `BELOW_MOQ` error or warning; client shows a sync-error toast referencing the document. |
| All 5 image slots filled, user tries to add 6th | `MAX_IMAGES_EXCEEDED` 400. Client: `Maximum 5 images per product` toast, picker not opened. |
| Image upload mid-way on 2G (network drops) | `api()` queues the upload in the offline mutation queue with `entityType: 'product-image'`, `entityLabel: productName`. User sees "Upload queued" indicator. |
| Image URL becomes broken/404 after upload | Fallback to product initial letter. No error thrown in UI. |
| Reorder submitted with mismatched image set | `INVALID_ORDER` 400. Client: `Image order update failed — please try again`. |
| Party ledger: party belongs to different business | Server query enforces `businessId`, returns 404 `PARTY_NOT_FOUND`. |
| Ledger with 0 transactions in range | Returns 200 with `rows: []`, `openingBalance`, `closingBalance` computed correctly. UI shows empty state. |
| Ledger: JournalEntry with status DRAFT | Excluded from ledger (only POSTED entries included). |
| Ledger cursor invalid / stale | Return 400 `INVALID_CURSOR`. Client resets to first page. |
| MOQ set to 0 in DB | Treated as null — no validation. |
| `enforceMoq` setting not yet provisioned for business (missing DocumentSettings row) | Default to `enforceMoq = true` (safe default). |
| POS sale with quantity below MOQ (keyboard) | Same BELOW_MOQ logic; in POS context, if enforce=true, show inline error in line row and block finalize. |
| Product deleted after image uploaded | Image URLs become orphaned. Not cleaned in this scope — see Out of Scope. |
| Running balance crosses zero (DR exceeds CR or vice versa) | Show negative balance in red, positive in green. |
| PDF generation fails (React-PDF error) | Toast: `PDF generation failed. Try again.` / `PDF नहीं बनी। पुनः प्रयास करें।` |

---

## Security

| Control | Detail |
|---------|--------|
| Auth | All new endpoints require valid session cookie (existing `auth` middleware). |
| Permission — image upload | `inventory.edit` |
| Permission — image delete/reorder | `inventory.edit` |
| Permission — MOQ field write | `inventory.edit` (part of product save) |
| Permission — ledger read | `parties.read` |
| Permission — ledger PDF | `parties.read` (no separate permission) |
| Tenant isolation | All queries filter by `businessId = req.user.businessId`. Product image routes already enforce this. Ledger enforces partyId belongs to businessId before aggregating. |
| Rate limiting | Image upload: 10 req/min per user. Ledger: 30 req/min per user. |
| File upload validation | Server-side MIME type check (not client-only). File size enforced in middleware before reaching handler. |
| Image URL injection | URLs stored as plain strings; no server-side fetch of the URL. Client renders with `<img>` (no dangerouslySetInnerHTML). |
| Cursor opaqueness | Cursor is base64-encoded JSON (lastId + lastDate). Not signed (not sensitive — just pagination). If tampered, returns empty page or 400. |

---

## Out of Scope

- **GST on invoices** — Phase 2, separate epic.
- **Orphaned image cleanup** — S3 lifecycle rules or a cleanup job for deleted product images are not in this scope.
- **Drag-and-drop reorder** — replaced by up/down arrow buttons on mobile. Desktop drag-and-drop not in this scope.
- **Video upload** — images only (JPEG/PNG/WebP).
- **Image CDN / resize pipeline** — no server-side thumbnail generation. Client resizes before upload via canvas (optional, not required for v1).
- **Party ledger for ALL parties in bulk** — per-party view only; no bulk ledger export in this scope.
- **Ledger chart / graph visualisation** — table only.
- **MOQ on PURCHASE documents** — only SALE, ESTIMATE, SALE_ORDER, DELIVERY_CHALLAN, POS_SALE.
- **MOQ per party or price tier** — global per product only.
- **JournalEntry manual creation UI** — existing feature; only read into ledger view here.
- **Offline ledger view** — ledger reads use `cacheReads: true` for the last-fetched page only; no full offline ledger.
- **SMS/email auto-send of ledger PDF** — share is manual via Capacitor share sheet only.
- **Watermarked PDFs** — not in scope.
- **Balance sheet / trial balance** — separate financial reports feature.

---

## Acceptance Criteria

### Backend

- [ ] `tsc --noEmit` clean in `server/` after all changes.
- [ ] `curl -X GET /api/parties/:partyId/ledger?from=2025-04-01&to=2026-03-31 -H "Cookie: ..."` → `{ "success": true, "data": { "rows": [...], "hasMore": false } }`.
- [ ] `curl` without auth → `{ "success": false, "error": { "code": "UNAUTHORIZED" } }` HTTP 401.
- [ ] `curl` with `parties.read`-lacking token → HTTP 403.
- [ ] `curl` without `from`/`to` → HTTP 400 `VALIDATION_ERROR`.
- [ ] `curl POST /api/documents/:id/lines` with `qty < moq` and `enforceMoq=true` → HTTP 400 `BELOW_MOQ`.
- [ ] Same with `enforceMoq=false` → HTTP 200 with `warnings[].code = "BELOW_MOQ"`.
- [ ] `curl POST /api/products/:id/images/upload` with valid image → HTTP 200, `product.images.length` incremented.
- [ ] Same with file > 1MB → HTTP 400 `FILE_TOO_LARGE`.
- [ ] Same with non-image MIME → HTTP 400 `INVALID_FILE_TYPE`.
- [ ] Same when product already has 5 images → HTTP 400 `MAX_IMAGES_EXCEEDED`.
- [ ] `curl PUT /api/products/:id/images/reorder` with valid permutation → HTTP 200, `product.imageUrl = images[0]`.
- [ ] Ledger pagination: first page with `limit=2` returns `hasMore: true` and valid `nextCursor`; second page with cursor returns next 2 rows and correct running balance continuation.
- [ ] All new endpoints: cross-tenant access attempt → 404.

### Frontend

- [ ] `tsc --noEmit` clean in `src/` after all changes.
- [ ] Console: no errors or unhandled warnings on any new screen.
- [ ] Product form: MOQ field visible, saves to server, empty = no MOQ.
- [ ] Product form: image uploader shows 5 slots; camera/gallery picker opens on tap; upload progress visible; image appears after upload.
- [ ] Catalog grid: products with `imageUrl` show thumbnail; products without show initial-letter fallback.
- [ ] Invoice line: when `showLineItemImages=true`, product image visible in document form line row.
- [ ] Party detail: Ledger tab visible next to Statement tab.
- [ ] Party Ledger: all 4 UI states reachable (loading, error, empty, populated).
- [ ] Party Ledger: date range filter and voucher type filter work correctly.
- [ ] Party Ledger: "Load more" loads next cursor page and appends rows.
- [ ] Party Ledger PDF: tapping Share PDF generates and opens native share sheet.
- [ ] Settings page: `enforceMoq` toggle works; `showLineItemImages` toggle works.
- [ ] **Screenshot required:** Product form MOQ field at 375px.
- [ ] **Screenshot required:** Image uploader on product form at 375px (filled state).
- [ ] **Screenshot required:** Catalog grid with thumbnail at 375px.
- [ ] **Screenshot required:** Party Ledger — loading state at 375px.
- [ ] **Screenshot required:** Party Ledger — error state at 375px.
- [ ] **Screenshot required:** Party Ledger — empty state at 375px.
- [ ] **Screenshot required:** Party Ledger — populated state at 375px.
- [ ] **Layout check:** All new screens at 320px — no horizontal overflow, no truncated buttons.

### QA Artifacts

- [ ] Product form with MOQ field visible and saving correctly.
- [ ] Blocked SALE line when `qty < moq` with enforce=true.
- [ ] Warning toast when `qty < moq` with enforce=false.
- [ ] Image upload flow (camera/gallery → upload → slot filled → primary badge).
- [ ] Catalog grid thumbnail present for products with images.
- [ ] Invoice line item thumbnail when `showLineItemImages=true`.
- [ ] Party ledger all 4 states.
- [ ] Party ledger PDF generated and shareable.
- [ ] Delete image by tapping slot → Delete action.
- [ ] Reorder images via up/down arrows → `imageUrl` updates to first image.

---

## Open Questions

| # | Question | Resolution |
|---|----------|------------|
| OQ-1 | Where exactly is the business-logo upload helper? | Resolved by assumption: reuse upload utility from `server/src/lib/upload.ts` (or create it if absent). Implementer to locate the closest existing pattern in the auth/business route. |
| OQ-2 | Should `enforceMoq` live on `DocumentSettings` or a new `BusinessSettings` model? | Resolved by assumption: `DocumentSettings` (already per-business, already has related billing toggles). |
| OQ-3 | Should drag-and-drop be implemented for image reorder? | Resolved by assumption: up/down buttons on mobile. No new DnD library dependency. |
| OQ-4 | What is the opening balance for the ledger — account-based or document-balance-based? | Resolved by assumption: sum of (DR - CR) from all source records before `from` date, using the same three source models. Not tied to a LedgerAccount balance. |
| OQ-5 | Does the PDF ledger need a digital signature or stamp? | Resolved: out of scope. Plain PDF only. |
| OQ-6 | Should POS SALE lines also be blocked by MOQ? | Resolved by spec: yes, `POS_SALE` is in the enforced document type list. |
| OQ-7 | Max image size per upload vs. total per product? | Resolved: 1MB per upload; max 5 images per product total. No total-size cap. |
| **TRUE BLOCKER** | **Image storage backend** — Is an S3-compatible bucket configured in this environment (local dev path, credentials, bucket name)? This must be confirmed before the upload route can be finalised. If not, the upload pipeline defaults to local filesystem in dev and is a deploy-time config item. | **Needs confirmation from Sawan before image upload is shipped to staging.** |

---

## Rollout

| Phase | Action |
|-------|--------|
| 1 | Run migration: add `enforceMoq` + `showLineItemImages` to `DocumentSettings`. |
| 2 | Ship MOQ backend validation + product form MOQ field. Feature flag: `enforceMoq` defaults true but can be toggled per business via Settings. |
| 3 | Ship image upload route + product form image uploader + catalog thumbnail. Confirm storage backend before enabling on staging. |
| 4 | Ship invoice line thumbnail (requires `showLineItemImages` setting to be manually enabled — opt-in, default off). |
| 5 | Ship party ledger tab + PDF share. |
| 6 | QA sign-off per checklist above. |
| 7 | Release to production under feature toggle `phase4_catalog_enrichment`. |
