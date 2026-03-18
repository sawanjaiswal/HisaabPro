# Bill Scanning / OCR — PRD

> Feature #86 | Priority: P1 | Status: Building

## 1. What

Scan a bill/receipt image (camera or gallery) and extract line items via OCR. Extracted items populate the invoice creation form for quick data entry. Entirely client-side using Tesseract.js — no server needed, works offline.

## 2. User Flow

1. User taps "Scan Bill" on CreateInvoicePage (or from More hub)
2. Camera opens (Capacitor Camera on mobile) OR file picker on desktop
3. Image captured → resized to max 2000px → Canvas preprocessing (grayscale, contrast boost)
4. Tesseract.js OCR processes image (3-8s, progress bar shown)
5. Review screen shows extracted items in editable table:
   - Item name, quantity, rate, total
   - Confidence badge per item (green/yellow/red)
   - User can edit, delete, add items
   - Grand total comparison (OCR total vs sum of items)
6. User taps "Add to Invoice" → items convert to LineItemFormData[] → navigate to CreateInvoicePage with pre-filled items

## 3. Domain Model

```typescript
interface BillScanResult {
  rawText: string
  confidence: number         // 0-100
  extractedItems: ExtractedItem[]
  extractedTotal: number | null  // paise
  extractedDate: string | null   // ISO date
  imageDataUrl: string           // thumbnail for preview
  processingTimeMs: number
}

interface ExtractedItem {
  id: string                 // temp client ID
  name: string
  quantity: number | null
  rate: number | null        // paise
  total: number | null       // paise
  confidence: number         // 0-100, per-item
  isEdited: boolean          // user modified this
}
```

## 4. State Machine

```
IDLE → CAPTURING → PROCESSING → REVIEW → CONFIRMED
                      ↓            ↓
                   (error)     (edit item)
                      ↓            ↓
                    IDLE        REVIEW
```

## 5. Technical Approach

### OCR Engine
- **Tesseract.js v5** — client-side, WASM-based, offline
- Language: `eng` (English) — covers Indian bills (prices, quantities are in English/digits)
- Worker loaded lazily on first scan
- Image preprocessing via Canvas: grayscale → contrast boost → threshold

### Image Capture
- **Mobile**: `@capacitor/camera` (already installed v8.0.2)
- **Web fallback**: `<input type="file" accept="image/*" capture="environment">`
- Resize to max 2000px dimension before OCR (prevents OOM on cheap phones)

### Line Item Extraction
Parse OCR text using regex patterns for Indian bills:
- Pattern: `[item name] [qty] [rate] [total]`
- Common separators: spaces, tabs, dots
- Amount patterns: `₹`, `Rs`, `Rs.`, digits with commas
- Quantity patterns: `x`, `×`, `qty`, digits before rate

### Integration
- Result → `LineItemFormData[]` → pass to `useInvoiceForm.addLineItem()`
- Navigate to CreateInvoicePage with items pre-populated

## 6. Files

```
New:
  src/features/bill-scan/bill-scan.types.ts
  src/features/bill-scan/bill-scan.constants.ts
  src/features/bill-scan/bill-scan.utils.ts      (image preprocessing + OCR text parser)
  src/features/bill-scan/useBillScan.ts
  src/features/bill-scan/BillScanPage.tsx
  src/features/bill-scan/bill-scan.css
  src/features/bill-scan/components/BillCaptureInput.tsx
  src/features/bill-scan/components/OcrResultReview.tsx
  src/features/bill-scan/components/ScanProgress.tsx

Modify:
  src/config/routes.config.ts          (add BILL_SCAN route)
  src/App.tsx                          (add lazy route)
  src/features/invoices/CreateInvoicePage.tsx  (add "Scan Bill" button)
  package.json                         (add tesseract.js)
```

## 7. UI States

- **Idle**: Camera/file picker shown, "Take Photo" + "Choose from Gallery" buttons
- **Processing**: Full-screen progress bar with percentage, "Analyzing your bill..."
- **Review**: Editable item table with confidence badges + grand total
- **Error**: "Could not read this bill. Try a clearer photo." + retry button
- **Empty**: "No items found on this bill." + manual entry CTA

## 8. Edge Cases

- Blurry/dark image → low confidence → show warning, allow retry
- Rotated image → Tesseract handles rotation detection
- Hindi text → numbers/amounts still readable in English digits
- Handwritten bill → likely fails → user sees empty result, manual entry
- Very large image (>4MB) → resize before OCR
- OCR worker fails to load (offline, first use) → show error with "Download OCR engine" button

## 9. Out of Scope

- Server-side OCR (Cloud Vision) — future upgrade
- PDF bill scanning (text extraction from PDF) — future
- Auto-matching scanned items to existing products — future
- Hindi OCR — future (requires Hindi language pack, +4MB)
- Receipt template recognition — future

## 10. Acceptance Criteria

- [ ] Camera capture works on mobile (Capacitor) and web (file picker)
- [ ] OCR extracts at least item names and amounts from clear printed bills
- [ ] Review screen shows editable table with confidence indicators
- [ ] "Add to Invoice" creates LineItemFormData[] and navigates to CreateInvoicePage
- [ ] Progress indicator shown during OCR processing
- [ ] Error state with retry for unreadable images
- [ ] Image resized before OCR (max 2000px, prevents OOM)
- [ ] Tesseract worker lazy-loaded (not in main bundle)
- [ ] Dark mode support
- [ ] Reduced motion support
- [ ] Works offline (after first Tesseract worker download)
- [ ] tsc --noEmit clean
- [ ] npm run build clean
