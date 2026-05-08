# SCOPE: Barcode Camera Scanning (#106) + Label Printing (#111)

**Phase 4 — HisaabPro**
**Status:** Ready to build
**Last updated:** 2026-05-08

---

## Goal

Replace the existing `BarcodeScanner` component (which uses the non-standard `BarcodeDetector` browser API) with a Capacitor MLKit native scanner on Android/iOS and a `@zxing/browser` file-picker fallback on web/PWA. Wire label printing from the ProductsPage multi-select bulk action using React-PDF and `window.print()`.

---

## Personas

| Persona | Context |
|---------|---------|
| **Raju** — micro retailer, Rs 1–5L/month | Scans a single product barcode at POS counter on a Rs 10K Android phone. Expects instant add-to-cart. Prints 40×30mm thermal labels for shelf tagging. |
| **Priya** — wholesaler, Rs 5–25L/month | Multi-selects 10–20 products on the Products page, chooses A4_3×8 sheet, prints 24 labels per page from a desktop browser or exports PDF. |

---

## User Stories

1. As Raju, I tap the camera icon in the POS scan bar, point my phone at a product barcode, and the product is added to cart immediately — without typing anything.
2. As Raju, if the barcode is not found in the database, I see a toast "Product not found for barcode [X]" and the scanner stays open so I can try again.
3. As Raju, when I'm offline, scanning looks up the product in the local IDB cache (Dexie) and adds it to cart — no network call.
4. As Priya, I long-press products on the Products page to enter bulk mode, tap "Print Labels", choose quantity per product and sheet format, preview the layout, then download PDF or print.
5. As Priya, I can change the label template (standard / compact / barcode-only) in the print dialog before printing.

---

## Out of Scope

- QR code generation for products (display only, not a new feature)
- Label templates beyond the three defined (`standard`, `compact`, `barcode-only`)
- Sheet formats beyond the three defined (`THERMAL_40x30`, `A4_3x8`, `A5_2x5`)
- Bluetooth/USB label printer SDK integration (window.print() only)
- Barcode scanning in the Invoice line-item picker (ProductSearchInput) — web-only path; file-picker scan in that context is Phase 5
- Barcode scanning on the Web invoice form (separate ticket)
- Custom label dimensions or per-product custom fields on labels
- Label history / saved print jobs
- Capacitor iOS plugin wiring (Android only for Phase 4; iOS hook added but untested)

---

## Assumptions

1. `@capacitor-mlkit/barcode-scanning` is installed via npm and the Android plugin is synced via `npx cap sync android`. The iOS native module is registered but camera permission UI on iOS is not QA'd in Phase 4.
2. The existing `BarcodeScanner` component (using `BarcodeDetector`) is **replaced**, not kept. The replacement is `src/components/ui/BarcodeScanner.tsx` — same file, rewritten.
3. Web/PWA fallback is a **file picker** (`<input type="file" accept="image/*" capture="environment">`), decoded with `@zxing/browser`. The old manual text-entry fallback is retained below the file picker as a last resort.
4. `BarcodeDetector` check is removed entirely; the scanner detects native vs. web via `Capacitor.isNativePlatform()`.
5. `useBarcodeLookup` already handles the success/error flow for POS. No changes needed to that hook except the offline IDB check inserted before the API call.
6. The Dexie IDB product cache key is `products` (matching the existing `api-cache.ts` pattern). Products must have been loaded at least once for offline scan to work; if not cached, the scan fails gracefully with "You're offline — product not in local cache".
7. `POST /api/products/label-data` already exists and returns the shape needed; no new BE endpoints are built.
8. `GET /api/products/by-barcode/:code` already exists; it returns `{ success: true, data: { product: ProductSummary | null } }`. A 404 is returned when product is not found.
9. `Product.labelTemplate` column already exists in schema (`String? @default("standard")`); no migration needed.
10. `BarcodeDisplay` SVG component (`src/features/products/components/BarcodeDisplay.tsx`) is reused as-is for rendering barcodes inside label cells.
11. Label quantities default to 1 copy per product. Maximum is 99 per product per print job.
12. The bulk action "Print Labels" is added to `ProductsPage`'s `bulkActions` array alongside the existing Delete and Export actions.
13. The label print dialog is a full-screen bottom sheet on mobile (375px), a centred modal on wider viewports — implemented as a single responsive component.
14. Indian price format: `₹1,00,000` (using existing `formatRupees` / `paiseToRupees` utility; amounts stored in paise).
15. `window.print()` triggers the browser/OS print dialog. The React-PDF download produces a `labels-[date].pdf` file.
16. LOC limit: every new/modified file stays at or below 250 lines. The label preview component is split: `LabelPrintDialog.tsx` (dialog shell + state) and `LabelSheetPreview.tsx` (pure rendering).
17. No new Prisma schema changes or migrations are required.

---

## Functional Requirements

### #106 — Barcode Camera Scanning

#### BarcodeScanner component rewrite (`src/components/ui/BarcodeScanner.tsx`)

| State | Description |
|-------|-------------|
| **idle** | Camera not yet started. Shows "Open Camera" / "Choose Image" buttons. |
| **scanning** | Native: live camera viewfinder with corner-bracket guide + "Point at barcode" hint. Web: file picker active (OS sheet open). |
| **success** | Barcode decoded. Component calls `onScan(value)` and closes. No visible state — host handles success. |
| **error** | Permission denied or decode failed. Shows error message + "Try Again" + "Enter Manually" fallback input. |

**Native path (Capacitor.isNativePlatform() === true)**

1. Call `BarcodeScanner.requestPermissions()`.
   - Denied → error state: "Camera permission denied. Allow in phone Settings > HisaabPro."
2. Call `BarcodeScanner.scan({ formats: ['EAN_13','EAN_8','UPC_A','CODE_128','CODE_39','QR_CODE'] })`.
3. On result → call `onScan(result.barcodes[0].rawValue)`.
4. On cancel (user backs out) → call `onClose()`.

**Web path (Capacitor.isNativePlatform() === false)**

1. Render `<input type="file" accept="image/*" capture="environment">` triggered by "Scan from Camera / Gallery" button.
2. On file selected → decode with `BrowserMultiFormatReader` from `@zxing/browser`.
3. Success → call `onScan(text)`.
4. Failure (no barcode found) → error state: "No barcode found in image. Try again or enter manually."
5. Manual entry input always visible below the file picker button.

**Offline IDB cache lookup (in `useBarcodeLookup`)**

Before calling `api(...)`, check `navigator.onLine`:
- If offline: query Dexie table `products` where `barcode === code` (exact match).
  - Found → call `onFound(product)`.
  - Not found → error toast: "You're offline — product not in local cache."
- If online: proceed with existing `api('/products/by-barcode/...')` call.

#### POS wiring

`ScanBar.tsx` already imports `BarcodeScanner` and passes `onScan` → `lookup`. No structural change needed. Only the underlying `BarcodeScanner` component changes.

#### Invoice line-item picker (deferred — see Out of Scope)

`ProductSearchInput.tsx` is untouched in Phase 4.

---

### #111 — Label Printing

#### Flow

1. User long-presses a product on `ProductsPage` → enters bulk mode.
2. Selects 1–N products (up to 50 per print job).
3. Taps the "Print Labels" bulk action button.
4. `LabelPrintDialog` opens (bottom sheet mobile / centred modal desktop):
   - Sheet format selector: `THERMAL_40x30` | `A4_3x8` | `A5_2x5` (radio chips)
   - Template override: `standard` | `compact` | `barcode-only` (radio chips; default = per-product `labelTemplate`)
   - Per-product quantity stepper: − / [n] / + (1–99, default 1)
   - "Preview" tab + "Download PDF" button + "Print" button
5. On "Preview": renders `LabelSheetPreview` inline — live update as options change.
6. On "Download PDF": calls `pdf(<LabelDocument />).download('labels-YYYY-MM-DD.pdf')` via `@react-pdf/renderer`.
7. On "Print": calls `window.print()` with a `@media print` stylesheet that hides everything except the label sheet.

#### API call

```
POST /api/products/label-data
Body: { productIds: string[], template?: string }
```

Called once when the dialog opens. Cached for the lifetime of the dialog — no re-fetch on quantity change or template change (template override applied client-side from response data).

#### Label templates

| Template | Content |
|----------|---------|
| `standard` | Barcode SVG (EAN13 or CODE128) + product name (truncated 2 lines) + ₹ price |
| `compact` | Barcode SVG + ₹ price only |
| `barcode-only` | Barcode SVG only |

When template is overridden in dialog, it applies to ALL selected products uniformly. When "per product" is selected (default), each product uses its own `Product.labelTemplate`.

#### Sheet formats

| Format | Page size | Cols × Rows | Label size | Gap |
|--------|-----------|-------------|------------|-----|
| `THERMAL_40x30` | 40×30mm | 1×1 | 38×28mm | 1mm |
| `A4_3x8` | A4 (210×297mm) | 3×8 = 24 labels | 65×35mm | 2mm |
| `A5_2x5` | A5 (148×210mm) | 2×5 = 10 labels | 69×40mm | 2mm |

Labels are repeated per quantity: a product with qty=3 occupies 3 consecutive label cells.

---

## API Contract

### Existing: GET /api/products/by-barcode/:code

```ts
// Response (success)
interface ByBarcodeRes {
  success: true
  data: { product: ProductSummary }  // ProductSummary as defined in lib/types/product.types
}

// Response (not found)
interface ByBarcodeNotFound {
  success: false
  error: { code: 'NOT_FOUND'; message: string }
}
```

### Existing: POST /api/products/label-data

```ts
// Request
interface LabelDataReq {
  productIds: string[]          // 1–50 IDs
  template?: 'standard' | 'compact' | 'barcode-only'  // optional override
}

// Response
interface LabelDataRes {
  success: true
  data: {
    labels: LabelItem[]
    count: number
  }
}

interface LabelItem {
  id: string
  name: string
  sku: string | null
  salePrice: number        // paise integer
  imageUrl: string | null
  unit: string             // symbol e.g. "pcs"
  category: string | null
  template: 'standard' | 'compact' | 'barcode-only'
  // NOTE: barcode value and format are NOT returned by this endpoint.
  // BarcodeDisplay uses Product.barcode — the label renderer reads it
  // from the already-loaded product list in client state (ProductsPage data).
  // If not available, barcode cell renders as empty with "No barcode" text.
}
```

> **Builder note:** `LabelItem` does not include `barcode` or `barcodeFormat`. The label renderer must cross-reference the product list already in client state (from `useProducts`) to get these fields. Add a `barcode: string | null` and `barcodeFormat: BarcodeFormat | null` join in the `POST /label-data` handler if the cross-reference is too fragile — this is a pre-approved minor BE addition that does not require a new ticket.

---

## New Files

| Path | Purpose | Approx LOC |
|------|---------|-----------|
| `src/components/ui/BarcodeScanner.tsx` | Rewrite: native MLKit + web ZXing file picker (replaces BarcodeDetector) | ≤200 |
| `src/features/products/components/LabelPrintDialog.tsx` | Dialog shell: format/template/qty state, API call, Print/Download buttons | ≤220 |
| `src/features/products/components/LabelSheetPreview.tsx` | Pure rendering: label grid for web preview + React-PDF `<Document>` | ≤240 |
| `src/features/products/label-print.service.ts` | `fetchLabelData(productIds, template?)` — wraps `api()` with `entityType`/`entityLabel` | ≤40 |
| `src/features/products/label-print.css` | Print media query rules, sheet layout vars | ≤60 |

## Modified Files

| Path | Change |
|------|--------|
| `src/features/products/ProductsPage.tsx` | Add "Print Labels" to `bulkActions`; mount `LabelPrintDialog` |
| `src/features/pos/useBarcodeLookup.ts` | Add offline IDB check before API call |
| `src/components/ui/barcode-scanner.css` | Update for new idle/scanning/error states |

---

## UI States

### BarcodeScanner (scan modal)

| State | Copy | Notes |
|-------|------|-------|
| **idle** | "Scan Barcode" title · "Open Camera" (primary btn) · "Choose from Gallery" (secondary btn) · "Or enter manually" divider | Native: single "Scan" button only |
| **scanning** | Native: live viewfinder + "Point camera at barcode" hint + "Cancel" · Web: OS file picker open (no UI change in modal) | Corner-bracket guide overlay |
| **success** | (no UI — modal closes, host handles) | |
| **error** | Icon (AlertTriangle) · Error message (dynamic, see UX Copy) · "Try Again" btn · "Enter manually" input + search button | Retry re-triggers camera/picker |

### LabelPrintDialog (label modal)

| State | Copy | Notes |
|-------|------|-------|
| **loading** | Skeleton rows (one per selected product) · "Loading label data..." sr-only aria-live | Triggered on dialog open |
| **error** | "Could not load label data." · "Retry" btn | Network failure on `POST /label-data` |
| **preview** | Sheet preview renders · Download PDF btn active · Print btn active | Qty steppers + format/template chips visible |
| **empty** | "No products selected." · "Close" btn | Guard only — bulk action won't open dialog with 0 selected |

---

## UX Copy

### Barcode Scanner

| Element | Copy |
|---------|------|
| Dialog title | "Scan Barcode" |
| Native scan button | "Scan Barcode" |
| Web file button | "Choose Photo / Camera" |
| Scanning hint | "Point camera at a barcode" |
| Cancel button | "Cancel" |
| Error — permission denied (native) | "Camera permission denied. Go to Settings > HisaabPro > Camera to allow." |
| Error — no barcode in image (web) | "No barcode found in image. Try a clearer photo or enter below." |
| Error — offline, product not found | "You're offline — product not in local cache." |
| Error — product not found (online) | "Product not found for barcode [X]." |
| Manual entry placeholder | "Type or paste barcode..." |
| Manual entry submit button | "Search" |
| Try again button | "Try Again" |
| Success toast (POS) | "[Product Name] added to cart" |

### Label Print Dialog

| Element | Copy |
|---------|------|
| Dialog title | "Print Labels" |
| Sheet format label | "Sheet format" |
| Format chips | "Thermal 40×30mm" · "A4 — 24 per sheet" · "A5 — 10 per sheet" |
| Template label | "Label style" |
| Template chips | "Standard" · "Compact" · "Barcode only" |
| Qty column header | "Copies" |
| Qty decrease aria-label | "Decrease quantity for [product name]" |
| Qty increase aria-label | "Increase quantity for [product name]" |
| Loading text | "Loading label data..." |
| Error message | "Could not load label data." |
| Retry button | "Retry" |
| Download button | "Download PDF" |
| Print button | "Print" |
| Success toast (PDF downloaded) | "Labels PDF downloaded." |
| Error toast (print failed) | "Print failed. Try downloading the PDF instead." |
| Total label count (below grid) | "[N] label(s) on [M] page(s)" |

---

## Non-Functional Requirements

- All API calls use `api()` from `@/lib/api`. No raw `fetch()`.
- `label-print.service.ts` passes `entityType: 'label'`, `entityLabel: 'Label print job'` on the POST call.
- Every file ≤250 LOC.
- Mobile-first: 375px primary, 320px minimum — no overflow.
- Amount display: `₹X,XX,XXX` via existing `paiseToRupees` + Indian locale formatter.
- No `localStorage` writes for product or label data (Dexie only).
- `BarcodeScanner` must not leak camera streams on unmount — `useEffect` cleanup calls `BarcodeScanner.stopScan()` on native, `stream.getTracks().forEach(t => t.stop())` on web.
- `@capacitor-mlkit/barcode-scanning` is peer dep; import guarded with `Capacitor.isNativePlatform()` so web bundle does not include native plugin code path.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| MLKit plugin not available on older Android (API < 21) | Low | Graceful fallback to web ZXing path if `BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()` returns false |
| `@zxing/browser` adds ~120KB to web bundle | Medium | Dynamic import: `const { BrowserMultiFormatReader } = await import('@zxing/browser')` — only loaded when web scanner opens |
| `BarcodeDisplay` SVG uses `document.implementation.createDocument` — breaks in React-PDF (no DOM) | High | For PDF labels: encode barcode as a `<Canvas>`-drawn PNG data URL using `generateBarcodeDataUrl()` from `barcode.utils.ts`, not the DOM SVG path |
| React-PDF A4 grid: labels at column 3 overflow page width | Medium | Constrain cell widths to `(pageWidth - margins - gaps) / cols` with `pt` units; test both THERMAL and A4 in PDF |
| Offline IDB cache miss: user scans barcode but products were never fetched | Medium | Toast: "You're offline — product not in local cache." (non-blocking; user can manually search) |
| `POST /label-data` missing `barcode`/`barcodeFormat` fields | High | Cross-reference with `useProducts` data in dialog state; if product not in local list, render "No barcode" placeholder |

---

## Rollout

1. Build `BarcodeScanner` rewrite + `useBarcodeLookup` offline patch → test POS scan on Android device.
2. Build `LabelPrintDialog` + `LabelSheetPreview` → test A4 PDF download and thermal `window.print()`.
3. Wire `ProductsPage` bulk action.
4. QA sign-off on all artefacts below.
5. Ship as part of Phase 4 release.

---

## Acceptance Criteria

### Backend (no new endpoints expected)

- [ ] `tsc` clean on server — no new type errors introduced.
- [ ] `curl -b cookies.txt GET /api/products/by-barcode/8901234567890` → `{ success: true, data: { product: { id, name, salePrice, ... } } }`
- [ ] `curl -b cookies.txt GET /api/products/by-barcode/NOTEXIST` → `{ success: false, error: { code: 'NOT_FOUND', ... } }`
- [ ] `curl -b cookies.txt -X POST /api/products/label-data -d '{"productIds":["<id>"]}' -H 'Content-Type: application/json'` → `{ success: true, data: { labels: [...], count: 1 } }`
- [ ] Without auth cookie → 401 on both endpoints.

### Frontend

- [ ] `tsc` clean on client — zero type errors.
- [ ] `node scripts/enforce.js` passes — no new offline violations, no new LOC ratchet breaches.
- [ ] `console` clean in Chrome DevTools during scan and label print flows (no warnings, no errors).

### Scan modal — 4 UI states

- [ ] Screenshot: **idle** — "Scan Barcode" dialog with "Open Camera" (native) or "Choose Photo / Camera" + manual input (web).
- [ ] Screenshot: **scanning** — live viewfinder (native) or file picker triggered (web).
- [ ] Screenshot: **error** — "Camera permission denied" message + "Try Again" button visible.
- [ ] (success has no screenshot — modal closes immediately).
- [ ] On successful scan: POS cart row appears with scanned product name and price.
- [ ] On unknown barcode (online): toast "Product not found for barcode [X]" appears.
- [ ] On scan while offline + product in IDB cache: product added to cart with "Saved — will sync when online" toast.
- [ ] On scan while offline + product NOT in IDB cache: toast "You're offline — product not in local cache."

### Label print dialog — 4 UI states

- [ ] Screenshot: **loading** — skeleton rows visible immediately on dialog open.
- [ ] Screenshot: **error** — "Could not load label data." + "Retry" button.
- [ ] Screenshot: **preview** — standard template, A4_3x8 grid, product names and ₹ prices visible, Indian number format correct.
- [ ] Screenshot: **empty** — "No products selected." (guard state).
- [ ] Changing sheet format updates label count text ("N label(s) on M page(s)").
- [ ] Changing template chip updates preview instantly.
- [ ] Qty stepper: − disabled at 1, + disabled at 99.
- [ ] "Download PDF" produces a downloadable file named `labels-YYYY-MM-DD.pdf`.
- [ ] "Print" triggers `window.print()` without console errors.
- [ ] Thermal 40×30mm: single label per page in PDF preview.
- [ ] A4_3x8: 3-column grid, 8 rows, 24 labels per page.
- [ ] A5_2x5: 2-column grid, 5 rows, 10 labels per page.

### Responsive

- [ ] Scan modal: no overflow at 320px.
- [ ] Label dialog: no overflow at 320px, quantity steppers tappable.
- [ ] Label dialog: bottom sheet on 375px, scrollable product list if > 5 products selected.

---

## QA Checklist

Verifier must check each item and provide evidence (screenshot or `curl` output).

- [ ] Android: tap camera icon in POS → MLKit scanner opens → scan EAN13 barcode → product added to cart
- [ ] Android: deny camera permission → error state shows with Settings link
- [ ] Web/PWA: tap camera icon in POS → file picker opens → select image with barcode → product added to cart
- [ ] Web/PWA: image with no barcode → error toast "No barcode found in image"
- [ ] POS: disable network → scan known product barcode → product added from IDB cache
- [ ] POS: disable network → scan unknown barcode → toast "You're offline — product not in local cache"
- [ ] ProductsPage: long-press → select 3 products → tap "Print Labels" → loading skeleton appears
- [ ] Label dialog: preview renders in standard template with ₹ prices in Indian format
- [ ] Label dialog: switch to compact → barcode + price only visible
- [ ] Label dialog: switch to barcode-only → name and price absent
- [ ] Label dialog: A4_3x8 selected → preview shows 3 columns
- [ ] Label dialog: THERMAL_40x30 selected → preview shows single label
- [ ] Label dialog: set qty=3 for one product → count shows +2 extra cells
- [ ] Download PDF → file downloads, opens in PDF viewer, labels correct
- [ ] Print → browser print dialog appears, label content visible in print preview
- [ ] 320px: scan modal no overflow, label dialog scrolls without overflow
- [ ] tsc clean, enforce.js clean, console clean
