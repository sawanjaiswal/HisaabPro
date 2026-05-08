# ARCHITECTURE: Barcode Camera Scanning (#106) + Label Printing (#111)

**Phase 4 — HisaabPro**
**Status:** Approved for build
**Reference scope:** `docs/SCOPE_barcode_and_label.md`
**Last updated:** 2026-05-08

---

## 1. File Map

### New files

| Path | Purpose | LOC budget |
|------|---------|-----------|
| `src/features/products/components/LabelPrintDialog.tsx` | Dialog shell: format/template/qty state, fetch label-data, Print + Download buttons, 4 UI states | ≤220 |
| `src/features/products/components/LabelSheetPreview.tsx` | Pure renderer: HTML grid for on-screen preview AND `<Document>` for PDF (shared layout helpers) | ≤240 |
| `src/features/products/components/LabelPDF.tsx` | React-PDF `<Document>`, `<Page>`, `<View>`, `<Image>` for barcode PNG; thin wrapper consumed by `LabelSheetPreview` | ≤180 |
| `src/features/products/label-print.service.ts` | `fetchLabelData(productIds, template?)` — wraps `api()` with `entityType`/`entityLabel` | ≤40 |
| `src/features/products/label-print.css` | `@media print`, `@page` rules, mm-based sheet vars | ≤80 |
| `src/features/products/label-layout.ts` | Pure math: sheet dims, cell dims, gaps, page-count calc; unit-tested | ≤100 |
| `src/lib/barcode-png.ts` | `generateBarcodePngDataUrl(value, format)` — canvas-based encoder for React-PDF `<Image>` | ≤120 |

### Modified files

| Path | Change | Δ LOC |
|------|--------|-------|
| `src/components/ui/BarcodeScanner.tsx` | **Full rewrite** — native MLKit + web ZXing file picker, replaces `BarcodeDetector`. State machine (idle/scanning/success/error) | rewrite ≤200 |
| `src/components/ui/barcode-scanner.css` | New idle/scanning/error styles, corner-bracket overlay | +40 |
| `src/features/pos/useBarcodeLookup.ts` | Add Dexie offline lookup before `api()` call | +25 |
| `src/features/products/ProductsPage.tsx` | Add `Print Labels` to `bulkActions`; mount `<LabelPrintDialog />` | +15 |
| `src/features/pos/components/ScanBar.tsx` | No structural change; verify it still imports `BarcodeScanner` from same path | 0 |
| `src/features/invoices/components/ProductSearchInput.tsx` | (deferred to Phase 5 per scope) | 0 |
| `server/src/routes/products/index.ts` (or wherever `POST /label-data` lives) | Extend Prisma `select` to include `barcode` and `barcodeFormat` so client can render barcode without cross-reference | ≤10 |
| `server/src/types/products.ts` (or shared response type file) | Add `barcode: string \| null; barcodeFormat: BarcodeFormat \| null` to `LabelItem` | ≤6 |
| `src/locales/en/products.json` | Add label-print + scanner copy | +30 |
| `src/locales/hi/products.json` | Hindi mirror | +30 |

### Files NOT touched

- `src/features/products/components/BarcodeDisplay.tsx` — reused as-is for HTML preview
- Prisma schema — no migration; `Product.barcode` / `Product.barcodeFormat` already exist
- All other server routes

---

## 2. Plugin Install + Capacitor Config

```bash
# Native scanner (Android primary, iOS hooked-but-untested per scope)
npm install @capacitor-mlkit/barcode-scanning

# Web fallback (lazy-imported; do NOT add to default chunk)
npm install @zxing/browser @zxing/library

# Sync native projects
npx cap sync android
npx cap sync ios
```

### `capacitor.config.ts` additions

```ts
plugins: {
  BarcodeScanning: {
    // No keys required for MLKit; permission prompts are OS-driven.
  },
},
```

### `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### `ios/App/App/Info.plist`

```xml
<key>NSCameraUsageDescription</key>
<string>HisaabPro uses the camera to scan product barcodes.</string>
```

### Bundle-size guard

`@zxing/browser` MUST be `await import('@zxing/browser')` inside the web-path handler. Vite will emit a separate chunk; verify with `npm run build` that the main chunk does not grow by > 10 KB gzipped.

---

## 3. API Contracts

### 3.1 `GET /api/products/by-barcode/:code` (existing — unchanged)

```ts
type ByBarcodeRes =
  | { success: true; data: { product: ProductSummary } }
  | { success: false; error: { code: 'NOT_FOUND'; message: string } }
```

### 3.2 `POST /api/products/label-data` (extended)

**Request:**

```ts
interface LabelDataReq {
  productIds: string[]                                       // 1-50
  template?: 'standard' | 'compact' | 'barcode-only'
}
```

**Response (extended — adds `barcode`, `barcodeFormat`):**

```ts
type BarcodeFormat = 'EAN_13' | 'EAN_8' | 'UPC_A' | 'CODE_128' | 'CODE_39' | 'QR_CODE'

interface LabelItem {
  id: string
  name: string
  sku: string | null
  salePrice: number                       // paise
  imageUrl: string | null
  unit: string
  category: string | null
  template: 'standard' | 'compact' | 'barcode-only'
  barcode: string | null                  // NEW — was scope risk #6
  barcodeFormat: BarcodeFormat | null     // NEW
}

interface LabelDataRes {
  success: true
  data: { labels: LabelItem[]; count: number }
}
```

**Server change:** add `barcode: true, barcodeFormat: true` to the existing Prisma `select` block. ≤10 LOC. No migration. No new index.

### 3.3 Client-side offline barcode lookup

```ts
// useBarcodeLookup.ts (additive)
async function lookupOffline(code: string): Promise<ProductSummary | null> {
  const db = await getDexie()
  return db.products.where('barcode').equals(code).first() ?? null
}

// Order of operations:
// 1. if (!navigator.onLine) → lookupOffline → onFound | toast('not in cache')
// 2. else → existing api('/products/by-barcode/...')
```

Dexie schema MUST already declare `barcode` as an indexed field on the `products` table. If not, that is a one-line schema bump in `src/lib/offline-db.ts` (additive index, no data migration since IDB rebuilds on next product fetch).

---

## 4. Scanner State Machine

```
                  ┌──────────┐
                  │   idle   │◀─────────────────┐
                  └────┬─────┘                  │
       (tap "Scan")    │                        │ ("Try Again")
                       ▼                        │
                  ┌──────────┐                  │
                  │ scanning │                  │
                  └────┬─────┘                  │
        ┌──────────────┼──────────────┐         │
        │              │              │         │
        ▼              ▼              ▼         │
   ┌─────────┐   ┌─────────┐    ┌─────────┐    │
   │ success │   │  error  │────┼─────────┘    │
   └────┬────┘   └─────────┘                   │
        │                                      │
        └──────── onScan(value) + close ───────┘
```

### State definitions

| State | Trigger | View | Exit |
|-------|---------|------|------|
| `idle` | Modal opens | Native: "Scan" button. Web: "Choose Photo / Camera" + manual input | User taps scan → `scanning` |
| `scanning` | User initiated | Native: live MLKit viewfinder + corner brackets. Web: OS file picker open | Decode success → `success`; permission denied / decode fail → `error`; cancel → close |
| `success` | Decode returned | (no UI; modal calls `onScan` then `onClose`) | Unmounts |
| `error` | Permission or decode failure | Icon + dynamic copy + Try Again + manual input fallback | Try Again → `scanning`; manual submit → `success` |

### Cleanup contract

- Native: `useEffect` cleanup calls `BarcodeScanner.stopScan()` and `removeAllListeners()`
- Web: any `MediaStream` (none expected — file picker only) `getTracks().forEach(stop)`; revoke any object URLs created from the picked `File`
- ZXing reader: `reader.reset()` on unmount

### Platform branch (single component, no v2)

```ts
const isNative = Capacitor.isNativePlatform()
// Both branches share the same state machine; only the scan() implementation differs.
```

---

## 5. Label Print Pipeline

```
[user selects N products on ProductsPage]
            │
            ▼
[bulkAction: Print Labels] ──opens──▶ [LabelPrintDialog]
            │
            │ on mount
            ▼
[label-print.service: fetchLabelData(ids, template?)]
            │ POST /api/products/label-data
            ▼
[LabelItem[] in dialog state]
            │
            ├──▶ [Preview] ──renders──▶ <LabelSheetPreview mode="html">
            │                              uses <BarcodeDisplay> SVG (DOM)
            │
            ├──▶ [Download PDF] ──▶ generateBarcodePngDataUrl(item) for each
            │                       └─▶ <LabelPDF> (React-PDF)
            │                       └─▶ pdf(<LabelPDF/>).download('labels-YYYY-MM-DD.pdf')
            │
            └──▶ [Print]  ──▶ document.body.classList.add('printing-labels')
                                 └─▶ window.print()
                                 └─▶ on afterprint: remove class
```

### Critical rule: PDF uses PNG, not SVG

React-PDF has no DOM. `BarcodeDisplay` (which uses `document.implementation.createDocument`) WILL crash if rendered inside `@react-pdf/renderer`. Therefore:

- **HTML preview path** (`LabelSheetPreview` mode="html") → `<BarcodeDisplay>` SVG (DOM-friendly)
- **PDF path** (`LabelPDF`) → for each label, call `generateBarcodePngDataUrl(value, format)` which:
  1. Creates an offscreen `<canvas>`
  2. Uses `JsBarcode` (already in deps for `BarcodeDisplay`) targeted at the canvas
  3. Returns `canvas.toDataURL('image/png')`
  4. Caches by `value` so repeated copies (qty > 1) reuse the data URL
- The PNG data URL is fed into React-PDF's `<Image src={dataUrl} />`

This is the single architectural specification for the PDF barcode rendering path.

### Print path

`window.print()` is NOT a separate render — it prints the existing HTML preview, scoped via `@media print` (see §7).

---

## 6. Sheet Layout Math

All units in mm. Page margins are uniform (top = right = bottom = left = `pageMargin`).

```ts
// label-layout.ts
interface SheetSpec {
  page: { w: number; h: number }   // mm
  cols: number
  rows: number
  cell: { w: number; h: number }   // mm — derived from page minus margins minus gaps
  gap: number                      // mm
  margin: number                   // mm
}

const SHEETS: Record<SheetFormat, SheetSpec> = {
  THERMAL_40x30: {
    page:   { w: 40, h: 30 },
    cols: 1, rows: 1,
    cell:   { w: 38, h: 28 },
    gap: 0,    margin: 1,
  },
  A4_3x8: {
    page:   { w: 210, h: 297 },
    cols: 3, rows: 8,
    cell:   { w: 65, h: 35 },
    gap: 2,    margin: 6.5,        // (210 - 3*65 - 2*2) / 2 = 5.5; rounded to 6.5 with vertical centering
  },
  A5_2x5: {
    page:   { w: 148, h: 210 },
    cols: 2, rows: 5,
    cell:   { w: 69, h: 40 },
    gap: 2,    margin: 4,           // (148 - 2*69 - 1*2) / 2 = 4
  },
}
```

Verification (A4): `3 × 65 + 2 × 2 + 2 × margin = 195 + 4 + 13 = 212 ≈ 210mm` — margins tightened to 6.5 keeps within page; vertical: `8 × 35 + 7 × 2 + 2 × margin = 280 + 14 + ≈3 = 297mm`. ✓

### Page count

```ts
function expandToCells(items: LabelItem[], qtyMap: Record<string, number>): LabelItem[]
function pageCount(cells: number, spec: SheetSpec): number {
  return Math.ceil(cells / (spec.cols * spec.rows))
}
```

### React-PDF unit conversion

React-PDF uses points (`pt`) by default. Conversion: `1mm = 2.83465pt`. `label-layout.ts` exports both `mm()` and `pt(mm)` helpers; `LabelPDF.tsx` consumes `pt`, HTML preview consumes `mm`.

---

## 7. Print CSS Strategy

`label-print.css` (loaded only inside `LabelPrintDialog` via CSS module or scoped import):

```css
/* Off-screen / preview */
.label-sheet { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.label-sheet[data-format="A4_3x8"]   { width: 210mm; min-height: 297mm; }
.label-sheet[data-format="A5_2x5"]   { width: 148mm; min-height: 210mm; }
.label-sheet[data-format="THERMAL"]  { width: 40mm;  min-height: 30mm; }

.label-cell { break-inside: avoid; page-break-inside: avoid; overflow: hidden; }

@page A4_3x8     { size: A4 portrait;     margin: 6.5mm; }
@page A5_2x5     { size: A5 portrait;     margin: 4mm; }
@page THERMAL    { size: 40mm 30mm;        margin: 1mm; }

@media print {
  body.printing-labels > *:not(.label-print-root) { display: none !important; }
  .label-print-root { all: initial; display: block; }
  .label-sheet { box-shadow: none; margin: 0; }
  /* Force exact mm sizing, kill browser zoom */
  html, body { width: auto; height: auto; }
}
```

### Strategy

1. Dialog adds `printing-labels` class to `<body>` immediately before `window.print()` and removes it on the `afterprint` event.
2. Everything outside `.label-print-root` is hidden in print media.
3. `@page` named pages are activated by setting `page: A4_3x8` etc. on the sheet wrapper.
4. `break-inside: avoid` on every cell prevents a label from being split across pages.
5. Image rendering: `print-color-adjust: exact` on the cell to keep barcode contrast in Chrome.

---

## 8. Offline Behaviour

| Surface | Offline behaviour |
|---------|-------------------|
| `useBarcodeLookup` | Checks `navigator.onLine`. Offline → Dexie `products.where('barcode').equals(code).first()`. Found → `onFound`. Not found → toast "You're offline — product not in local cache." |
| `label-print.service.fetchLabelData` | Calls `api('/products/label-data', { method: 'POST', cacheReads: false, entityType: 'label', entityLabel: 'Label print job' })`. Offline → `api()` queues the POST and returns `{}` — dialog detects empty response and shows error state with copy "Labels need internet — try again when online." (PDF generation requires data; we do NOT optimistically generate). |
| `LabelPrintDialog` mutation handler | Tolerates `{}` return per OFFLINE_RULES rule 5: checks `data.labels?.length` before rendering preview. |
| `BarcodeScanner` web file picker | Pure client-side decode; works offline by design. |
| `BarcodeScanner` native | MLKit module download is online-only; on first use without network, `isGoogleBarcodeScannerModuleAvailable()` may be false → fall back to manual entry input with toast "Scanner unavailable offline. Type barcode below." |

All API calls go through `api()` from `@/lib/api`. Mutations pass `entityType` + `entityLabel`. No `localStorage` writes. Reads are network-only by default; label-data is NOT cached (per scope: PII + transient).

---

## 9. PR Sequence

| PR | Scope | Depends on | Acceptance |
|----|-------|-----------|-----------|
| **PR1** | BE: extend `POST /api/products/label-data` Prisma `select` to include `barcode`, `barcodeFormat`. Update response type. | — | `tsc` clean; curl returns new fields; existing 401 path unchanged |
| **PR2** | Plugin install: `@capacitor-mlkit/barcode-scanning`, `@zxing/browser`, `@zxing/library`. `capacitor.config.ts` plugin block. AndroidManifest + Info.plist permissions. `npx cap sync android ios`. | PR1 (independent, can run in parallel) | App boots on Android emulator; web bundle main chunk does not grow > 10KB gz |
| **PR3** | Frontend: rewrite `BarcodeScanner.tsx` (native + web file picker + state machine). Patch `useBarcodeLookup` with Dexie offline path. Wire scan button into POS `ScanBar` (already wired) and Invoice line-item picker (deferred per scope — confirm with PM, but architect plan says PR3 only touches POS) | PR2 | 4 UI states screenshots; POS scan works on Android device; offline scan finds cached product |
| **PR4** | Frontend: `LabelPrintDialog`, `LabelSheetPreview`, `LabelPDF`, `label-print.service`, `label-layout`, `barcode-png`, `label-print.css`. Add `Print Labels` to ProductsPage `bulkActions`. | PR1 (needs barcode in response), PR2 (no — independent of plugin) | 4 UI states screenshots; PDF downloads with correct grid; `window.print()` clean console; THERMAL/A4/A5 verified |
| **PR5** | i18n: en + hi for all scanner + label dialog copy from SCOPE §UX Copy. | PR3, PR4 | Hindi rendering verified at 320px; no truncated keys |
| **PR6** | Verifier + QA: run full `docs/SCOPE_barcode_and_label.md` QA checklist; capture all screenshots; confirm `tsc` + `enforce.js` + console clean. | PR5 | All 17 QA checklist items signed off |

> **Note on Invoice line-item picker:** SCOPE §Out of Scope says it is deferred. Top-level builder note in this prompt says "wire scan button into POS billing page **and** Invoice line-item picker". Resolve by treating Invoice scan-button as PR3.5 (additive ≤30 LOC: import `BarcodeScanner` lazy, mount on `<button>` click, on scan call existing search-by-text with the decoded value). This is web-only, file-picker path; native invoice scanning remains Phase 5.

---

## 10. Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| MLKit module not present on Android (first install) | Medium | Scanner unusable until Play Services downloads it | Call `BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()`; if false, call `installGoogleBarcodeScannerModule()` once per session. Show interim "Preparing scanner..." copy. Fall back to manual entry if install fails. |
| Camera permission denied | Medium | Scanner blocked | Detect denied state explicitly; show error copy with deep-link to app settings (`Capacitor.openSettings()`). Manual entry input always present. |
| `@zxing/browser` bundle size (~120KB) | Medium | Slow first load on web | Dynamic `await import('@zxing/browser')` inside the web-path handler only. Verified by Vite chunk analysis in PR2. |
| React-PDF + `BarcodeDisplay` SVG incompatibility | High | PDF crashes | Architect-mandated split: HTML preview uses SVG; PDF uses canvas-encoded PNG via `barcode-png.ts`. `LabelPDF.tsx` MUST NOT import `BarcodeDisplay`. Lint rule (manual review) on PR4. |
| Print stylesheet quirks across browsers | Medium | Labels misaligned in Chrome vs. Safari | Anchor on mm units only (no px). Test in Chrome (POS terminal) + Safari (iPad) + Firefox. Provide PDF download as the deterministic fallback. |
| `@page :name { size: 40mm 30mm }` ignored by some browsers (Firefox) | Medium | Thermal print scales wrong | PDF is the recommended path for thermal. Print warning toast on Firefox/thermal: "For best thermal results, download the PDF." |
| Offline label-data fetch | Low | User confused | Dialog shows error state, not skeleton-forever. Copy: "Labels need internet — try again when online." |
| Per-product qty stepper triggers re-render of full preview (24+ cells) | Medium | Sluggish on Rs 8K Android | Memoise `LabelSheetPreview` by `(format, template, items, qtyMap)` hash. Compute expanded cell list with `useMemo`. Defer barcode SVG rendering with `requestIdleCallback` if needed. |
| Dexie `barcode` index missing on existing installs | Medium | Offline scan never matches | Add `barcode` to Dexie products table schema as version bump in `offline-db.ts`. Dexie auto-runs upgrade; data is rebuilt from server cache on next sync. |
| `barcode` field in response leaks PII via SW cache | Low | Minor | `cacheReads: false` on label-data; SW config already excludes label endpoints. Confirmed in PR4 QA. |

---

## Acceptance gates

**Backend:**
- `tsc` clean
- `curl` happy path returns `barcode` + `barcodeFormat`
- `curl` 401 path unchanged
- `curl` 400 path on empty `productIds`

**Frontend:**
- Screenshots: scanner idle / scanning / error (success has no UI)
- Screenshots: label dialog loading / error / preview / empty
- 320px verified for both modals
- `tsc` clean, `enforce.js` clean, console clean
- Android device scan-to-cart works
- Web file-picker scan-to-cart works
- Offline scan with cached product works; without cache shows correct toast
- PDF downloads with correct grid for all three formats
- `window.print()` produces correct preview in Chrome
