---
status: approved
feature: gst-phase-2
created: 2026-05-03T12:00:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
agents_invoked:
  - scope-writer (output: docs/SCOPE_gst_phase_2.md)
acceptance:
  backend:
    - curl POST /api/gst/settings → 200 with gstEnabled true
    - curl GET /api/gst/returns/GSTR1/2026-04 → 200 with b2b/b2cl/b2cs/cdnr sections
    - curl POST /api/einvoice/generate → 201 with irn 64 chars
    - curl POST /api/ewaybill/generate → 201 with ewbNumber
    - curl without auth → 401
    - curl bad GSTIN → 400 GSTIN_FORMAT_INVALID
  frontend:
    - screenshots: loading, error, empty, success for every new screen
    - 320px no overflow tested
    - dark theme tested
---

# GST Phase 2 — Full Scope (v7 Gold Standard)

## Summary

v7 delivers complete GST coverage for all three HisaabPro personas: Raju (can opt out, gets exempt defaults), Priya (full GSTR-1 B2B invoicing), and Amit (e-invoice IRN, e-way bill Part A + Part B, GSTR-3B). No features deferred to v8/v9 — this is the entire GST surface in one release.

---

## 1. Settled Baseline (Already Exists — No Re-build)

These schema fields, utilities, and routes exist and are correct. v7 wires them together.

**Schema (confirmed present):**
- `Business`: `gstin`, `stateCode`, `compositionScheme`, `eInvoiceEnabled`, `eWayBillEnabled`, `turnoverSlab`
- `Party`: `gstin`, `stateCode`, `compositionScheme`, `gstinVerified`, `gstinVerifiedAt`
- `Product`: `hsnCode`, `sacCode`, `taxCategoryId`
- `DocumentLineItem`: `taxCategoryId`, `hsnCode`, `sacCode`, `cgstRate/Amount`, `sgstRate/Amount`, `igstRate/Amount`, `cessRate/Amount`, `taxableValue`
- `Document`: `placeOfSupply`, `supplyType`, `isReverseCharge`, `isComposite`, `totalCgst/Sgst/Igst/Cess`
- `TaxCategory`, `HsnCode`, `EInvoice`, `EWayBill`, `GstReturn`, `GstReconciliation` — all exist
- `TemplateConfig.columns`: `hsn`, `taxRate`, `taxAmount`, `cessRate`, `cessAmount` flags exist
- `TemplateConfig.fields`: `businessGstin`, `customerGstin`, `placeOfSupply` flags exist

**Client utilities (confirmed present):**
- `tax-calc.utils.ts` — `calculateLineTax()`, `calculateDocumentTax()`, `isInterState()` — all correct, basis-points + paise
- `gstin.utils.ts` — 15-char regex, `validateGstin()`, `extractStateCode()`, `determineSupplyType()` — done
- `GstSettingsPage`, `TaxCategoriesPage`, `CreateTaxCategoryPage` — exist

**Server routes (confirmed present):**
- `GET/POST /api/gstin/validate`, `/api/gstin/verify`
- `GET/POST/PUT/DELETE /api/tax-categories`
- `GET /api/hsn/search`
- `GET /api/gst/returns/:type/:period`
- `POST /api/gst/returns/:type/:period/export`
- `POST /api/einvoice/generate`, `/api/einvoice/cancel`, `GET /api/einvoice/:documentId`
- `POST /api/ewaybill/generate`, `/api/ewaybill/cancel`, `PUT /api/ewaybill/update-partb`, `GET /api/ewaybill/:documentId`

---

## 2. New Schema Fields Required

These fields do NOT exist and must be added via migration before any feature work.

```prisma
// Business — add these 3 fields
model Business {
  // ... existing fields ...
  gstEnabled          Boolean  @default(false)  // NEW: explicit opt-in gate
  taxPricingMode      String   @default("EXCLUSIVE")  // NEW: EXCLUSIVE | INCLUSIVE (per-business default)
  gstDeclarationText  String?  // NEW: editable declaration text on templates
}

// DocumentSettings — add 1 field
model DocumentSettings {
  // ... existing fields ...
  taxPricingMode  String  @default("EXCLUSIVE")  // NEW: per-business pricing mode default
}

// Document — add 1 field
model Document {
  // ... existing fields ...
  taxPricingMode  String  @default("EXCLUSIVE")  // NEW: per-invoice override (EXCLUSIVE | INCLUSIVE)
}

// HsnCode — add 1 field
model HsnCode {
  // ... existing fields ...
  uqc  String  @default("NOS")  // NEW: Unit Quantity Code for GSTR-1 table 12 (NOS, KGS, MTR, LTR, etc.)
}

// InvoiceTemplate — add 1 field (on existing model, check current name)
// declarationText already covered by gstDeclarationText on Business — no template-level field needed
// (template renders business.gstDeclarationText when fields.gstDeclaration = true)
// Add to TemplateFieldsConfig (client type):
//   gstDeclaration: boolean  — NEW: toggles declaration text block on print
//   gstTaxSummary: boolean   — NEW: toggles CGST/SGST/IGST subtotals table on print
//   einvoiceQr: boolean      — NEW: toggles IRN QR code block on print (already qrCode exists, this is GST-specific)
```

**Migration sequence:**
1. `ALTER TABLE "Business" ADD COLUMN "gstEnabled" BOOLEAN NOT NULL DEFAULT false;`
2. `ALTER TABLE "Business" ADD COLUMN "taxPricingMode" VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE';`
3. `ALTER TABLE "Business" ADD COLUMN "gstDeclarationText" TEXT;`
4. `ALTER TABLE "DocumentSettings" ADD COLUMN "taxPricingMode" VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE';`
5. `ALTER TABLE "Document" ADD COLUMN "taxPricingMode" VARCHAR(20) NOT NULL DEFAULT 'EXCLUSIVE';`
6. `ALTER TABLE "HsnCode" ADD COLUMN "uqc" VARCHAR(10) NOT NULL DEFAULT 'NOS';`
7. Backfill: set `gstEnabled = true` WHERE `gstin IS NOT NULL` (auto-migrate businesses that saved GSTIN before this field existed)
8. UQC data patch: seed known UQC values for common HSN chapters (not blocking — defaults to 'NOS' until patched)

---

## 3. GST Opt-In Gate

### 3.1 Behavior

**Hybrid model:** A `gstEnabled` Boolean on `Business` is the authoritative gate. It auto-flips to `true` when a GSTIN is saved (server-side trigger in `updateGstSettings`). It can also be toggled manually in Settings > GST by a business with no GSTIN (composition scheme dealers without output tax, or businesses that registered mid-year).

| State | gstEnabled | gstin | Effect |
|-------|-----------|-------|--------|
| Raju — unregistered | false | null | Invoice form shows no tax columns. Templates render without GST block. GSTR exports blocked. |
| Priya — registered | true | "29ABCDE..." | Invoice form shows per-line tax picker, CGST/SGST/IGST calculated. Templates show GST block. |
| Composition dealer | true | "29ABCDE..." | compositionScheme=true. Invoice renamed "Bill of Supply". Tax columns hidden; flat rate tracked internally. |
| Registered, no GSTIN saved yet | true | null | Allowed (e.g. GSTIN applied but not received). Invoices save with 0% tax. Warning banner shown. |

### 3.2 API Contract

```ts
// GET /api/gst/settings
interface GstSettingsResponse {
  success: true
  data: {
    gstEnabled: boolean
    gstin: string | null
    stateCode: string | null
    compositionScheme: boolean
    compositionRate: number        // basis points: 100 | 500 | 600 (1%/5%/6%)
    eInvoiceEnabled: boolean
    eWayBillEnabled: boolean
    turnoverSlab: string | null    // '<1CR' | '1CR-5CR' | '5CR-10CR' | '10CR-20CR' | '>20CR'
    taxPricingMode: 'EXCLUSIVE' | 'INCLUSIVE'
    gstDeclarationText: string | null
  }
}

// PATCH /api/gst/settings
interface GstSettingsPatchReq {
  gstEnabled?: boolean
  gstin?: string                   // triggers auto-populate stateCode + gstEnabled=true
  compositionScheme?: boolean
  compositionRate?: number
  eInvoiceEnabled?: boolean
  eWayBillEnabled?: boolean
  turnoverSlab?: string
  taxPricingMode?: 'EXCLUSIVE' | 'INCLUSIVE'
  gstDeclarationText?: string
}
// Response: same as GstSettingsResponse

// Error shapes
// 400: { success: false, error: { code: 'GSTIN_FORMAT_INVALID', message: 'GSTIN must be 15 characters in the format: 29ABCDE1234F1Z5' } }
// 400: { success: false, error: { code: 'EINVOICE_REQUIRES_GSTIN', message: 'Enable GST and save your GSTIN before turning on e-invoice' } }
// 401: { success: false, error: { code: 'UNAUTHORIZED' } }
```

### 3.3 UX Copy

| Element | Copy |
|---------|------|
| Toggle label | Enable GST Billing |
| Toggle sub-label | Show tax rates on invoices, GSTIN on templates, enable GSTR exports |
| Disabled state sub-label | GST disabled — all invoices use Exempt 0% |
| GSTIN field placeholder | 22ABCDE1234F1Z5 |
| GSTIN verified badge | GSTIN Verified |
| GSTIN unverified badge | Not Verified — tap to verify |
| GSTIN format error | Invalid GSTIN format. Must be 15 characters: 2 digit state + 5 letter PAN + 4 digits + check digit (e.g. 29ABCDE1234F1Z5) |
| GSTIN state mismatch warning | GSTIN state code (29 — Karnataka) does not match your business state. Please check. |
| Settings saved toast | GST settings saved |
| GST enabled first-time toast | GST billing enabled. Default tax categories have been set up. |
| Composition scheme label | Composition Scheme |
| Composition scheme sub-label | Pay tax at a flat rate on turnover. Cannot collect GST from customers. Invoices print as "Bill of Supply". |

---

## 4. Invoice Form — Tax Engine

### 4.1 Per-Line-Item Tax UX

**Tax picker location:** Each line item row in the invoice form has a tax rate dropdown as the last column before the amount. The column header reads "Tax".

**Picker behavior:**
1. Dropdown lists all active `TaxCategory` records for the business (e.g. Exempt 0%, GST 5%, GST 12%, GST 18%, GST 28%)
2. When a product is selected, `taxCategoryId` from the product auto-fills the line item's tax picker. No user action needed for tagged products.
3. HSN/SAC type-ahead: a separate HSN/SAC field on each line item (visible when `gstEnabled = true` and `columns.hsn.visible = true`). Type 4+ characters → calls `/api/hsn/search?q=<term>&limit=10` → shows code + description + default rate. Selecting an HSN entry auto-fills the line item's HSN code and switches the tax picker to the matched rate.
4. If product has `taxCategoryId = null` (untagged product): line item shows orange warning badge "Tax rate not set". Default is Exempt 0% — invoice saves, but the warning remains until the user either picks a rate or clicks "Save as Exempt".
5. Composition scheme businesses: tax dropdown hidden on line items. A single "Composition Supply" badge replaces all tax columns. Internal calc tracks composition liability but does not print to customer.

### 4.2 Tax-Inclusive vs Tax-Exclusive Pricing

**Default:** Tax-exclusive (`EXCLUSIVE`). User types Rs 100 → GST 18% adds Rs 18 → invoice total Rs 118.

**Business-level setting:** `Settings > Invoice Settings > Tax Pricing Mode` toggle: "Tax Exclusive (add tax on top)" / "Tax Inclusive (MRP pricing — tax backed out)". Stored in `Business.taxPricingMode` and `DocumentSettings.taxPricingMode`.

**Per-invoice override:** Invoice form header shows a small "Prices are tax-exclusive / tax-inclusive" toggle chip. When flipped to inclusive, each line item's `rate` is treated as MRP and the taxable value is back-calculated: `taxableValue = rate * 10000 / (10000 + gstRateBP)`. Stored in `Document.taxPricingMode`.

**Tax-inclusive back-calculation formula (all in basis points and paise):**
```
taxableValue = Math.round(lineTotal * 10000 / (10000 + gstRateBP))
gstAmount    = lineTotal - taxableValue
```

**Rule of thumb mapping to personas:**
- Raju: exclusive (general trade)
- Priya: exclusive (wholesale)
- Amit: per-product (may mix MRP + trade; per-invoice override handles it)

### 4.3 Place of Supply

Shown in the invoice form header when `gstEnabled = true`. Auto-filled from `party.stateCode`. Editable dropdown using `INDIAN_STATES` map. When changed, CGST+SGST ↔ IGST split recalculates live. Place of supply defaults to business's own state for B2C invoices.

### 4.4 Supply Type Classification (Auto)

No user input required. Determined at invoice-save time by `determineSupplyType()`:
- `partyGstin` present → B2B
- No GSTIN + inter-state + grandTotal > Rs 2,50,000 → B2C_LARGE
- Otherwise → B2C_SMALL

Shown as a read-only badge on the invoice form ("B2B", "B2C Large", "B2C Small"). The user can see but not override — driven purely by party data.

### 4.5 Reverse Charge Mechanism (RCM)

**Toggle location:** Invoice form header, below Place of Supply. Appears on both PURCHASE_INVOICE and SALE_INVOICE (certain notified services — legal, GTA, security agency, import of service). Off by default.

**When RCM = on:**
- SALE_INVOICE: tax columns print normally but a prominent line reads "Tax payable on reverse charge basis (RCM)" above the tax summary table. B2B party required.
- PURCHASE_INVOICE: self-invoice flow triggered (see Section 8).
- The `Document.isReverseCharge` flag is set to true, which flows into GSTR-3B table 3.1(d) (inward supplies liable to RCM).

**Service categories with auto-RCM prompt:** When the invoice has a line item whose HSN SAC code falls in the notified RCM services list (9982 — legal, 9965 — GTA, 9985 — security, 998313 — technical testing), the form shows an orange advisory banner: "This may be subject to Reverse Charge (RCM). Turn on the RCM toggle if applicable."

### 4.6 Composition Scheme Invoice Flow

When `Business.compositionScheme = true`:
- Document type SALE_INVOICE is relabeled "Bill of Supply" on the print template
- Tax columns hidden on the invoice form and print
- A flat composition rate indicator shows: "Composition scheme — 1% / 5% / 6% of taxable turnover" (rate from `Business.compositionRate`)
- ITC claim blocked: PURCHASE_INVOICE form shows orange banner "Composition dealers cannot claim ITC on purchases"
- `Party.compositionScheme = true` on a purchase party triggers advisory: "This supplier is a composition dealer — they cannot issue tax invoices. Treat as RCM if applicable."

### 4.7 E-Way Bill Auto-Prompt

When invoice is saved (SALE_INVOICE, goods type) and conditions met:
- `Business.eWayBillEnabled = true`
- `grandTotal >= Rs 50,000` (5,000,000 paise)
- `isInterState = true` (placeOfSupply ≠ businessStateCode)

A modal appears immediately after save: "E-Way Bill Required — This invoice is an inter-state supply above ₹50,000. Generate e-way bill now?"

**Modal fields:**
- Transport Mode (ROAD / RAIL / AIR / SHIP) — default ROAD
- Transporter GSTIN (optional)
- Transporter Name (optional)
- Vehicle Number (required for ROAD)
- Distance (km) — required
- From Pincode — auto-filled from `business.pincode`, editable
- To Pincode — auto-filled from `party.addresses[billing].pincode`, editable
- Vehicle Type — REGULAR / ODC (over-dimensional cargo)

**If user dismisses:** A "Generate E-Way Bill" button appears on the invoice detail page permanently until generated.

### 4.8 E-Invoice Auto-Generate

When `Business.eInvoiceEnabled = true` and invoice is saved (SALE_INVOICE, B2B, status = SAVED):
- System auto-calls `/api/einvoice/generate` immediately after save
- IRN generation is async with a non-blocking spinner overlay "Generating e-invoice…"
- If NIC IRP API fails: invoice save succeeds (IRN is best-effort — never blocks save). Error banner shown: "E-invoice generation failed — retry from invoice detail page". Retry button persists on invoice detail until IRN is generated.
- If `eInvoiceEnabled = false` (default): "Generate IRN" button appears manually on invoice detail page for invoices that qualify (SALE_INVOICE, SAVED, party has GSTIN, business has GSTIN).

**Idempotency:** `EInvoice.documentId` is `@unique`. Duplicate generate calls return the existing record (HTTP 200 with existing IRN, not 201). Server upserts on the `documentId` unique constraint.

**IRN cancel:** "Cancel IRN" button visible on invoice detail only when:
- `eInvoice.status = 'GENERATED'`
- `Date.now() - eInvoice.ackDate.getTime() < 24h`
A countdown timer shows "X hours Y minutes remaining to cancel." After 24h, button is hidden and replaced with "IRN cancel window closed — issue a credit note to reverse."

---

## 5. API Contract (New / Modified Endpoints)

### 5.1 GST Settings

```ts
// PATCH /api/gst/settings
// Request
interface GstSettingsPatchReq {
  gstEnabled?: boolean
  gstin?: string
  compositionScheme?: boolean
  compositionRate?: number         // basis points: 100 | 500 | 600
  eInvoiceEnabled?: boolean
  eWayBillEnabled?: boolean
  turnoverSlab?: 'BELOW_1CR' | '1CR_TO_5CR' | '5CR_TO_10CR' | '10CR_TO_20CR' | 'ABOVE_20CR'
  taxPricingMode?: 'EXCLUSIVE' | 'INCLUSIVE'
  gstDeclarationText?: string
}
// Response: { success: true, data: GstSettingsData }
```

### 5.2 Invoice Save (Modified)

```ts
// POST /api/invoices  (existing — modification to accepted fields)
interface InvoiceLineItemReq {
  // ... existing fields ...
  taxCategoryId?: string
  hsnCode?: string
  sacCode?: string
  // cgstRate/sgstRate/igstRate/cessRate populated by server from taxCategoryId + isInterState
}
interface InvoiceReq {
  // ... existing fields ...
  placeOfSupply?: string          // 2-digit state code
  isReverseCharge?: boolean
  taxPricingMode?: 'EXCLUSIVE' | 'INCLUSIVE'
}
// Server computes: supplyType, cgstRate/Amount, sgstRate/Amount, igstRate/Amount, totalCgst/Sgst/Igst/Cess
// Response includes: computed tax totals, supplyType, e-invoice trigger result if eInvoiceEnabled
```

### 5.3 E-Invoice

```ts
// POST /api/einvoice/generate
// Request
interface GenerateIrnReq {
  documentId: string
}
// Response (201)
interface GenerateIrnRes {
  success: true
  data: {
    id: string
    documentId: string
    irn: string            // 64-char SHA-256 hash
    ackNumber: string
    ackDate: string        // ISO 8601
    qrCodeData: string     // Base64-encoded QR image or raw data string
    status: 'GENERATED'
    cancelWindowExpiresAt: string  // ackDate + 24h, ISO 8601
  }
}
// Error 400: EINVOICE_PARTY_GSTIN_MISSING | EINVOICE_BUSINESS_GSTIN_MISSING | EINVOICE_ALREADY_GENERATED | EINVOICE_WRONG_STATUS | EINVOICE_NOT_SALE_INVOICE
// Error 502: EINVOICE_NIC_UNAVAILABLE (NIC IRP API timeout/error — invoice save NOT blocked)

// POST /api/einvoice/cancel
// Request
interface CancelIrnReq {
  documentId: string
  reason: string    // max 100 chars, required
}
// Response (200)
interface CancelIrnRes {
  success: true
  data: {
    id: string
    documentId: string
    irn: string
    status: 'CANCELLED'
    cancelReason: string
    cancelledAt: string    // ISO 8601
  }
}
// Error 400: EINVOICE_CANCEL_WINDOW_EXPIRED | EINVOICE_NOT_GENERATED
```

### 5.4 E-Way Bill

```ts
// POST /api/ewaybill/generate
// Request
interface GenerateEWBReq {
  documentId: string
  transportMode: 'ROAD' | 'RAIL' | 'AIR' | 'SHIP'
  vehicleNumber?: string       // required if transportMode = ROAD
  vehicleType?: 'REGULAR' | 'ODC'
  transporterId?: string       // GSTIN of transporter
  transporterName?: string
  distance: number             // km, positive integer
  fromPincode: string          // 6-digit
  toPincode: string            // 6-digit
}
// Response (201)
interface GenerateEWBRes {
  success: true
  data: {
    id: string
    documentId: string
    ewbNumber: string          // 12-digit EWB number from NIC
    ewbDate: string            // ISO 8601
    validUpto: string          // ISO 8601 — typically 1 day per 100km
    transportMode: string
    vehicleNumber: string | null
    distance: number
    status: 'ACTIVE'
  }
}
// Error 400: EWAYBILL_BELOW_THRESHOLD | EWAYBILL_ALREADY_GENERATED | EWAYBILL_WRONG_STATUS

// PUT /api/ewaybill/update-partb
// Request
interface UpdatePartBReq {
  documentId: string
  vehicleNumber: string      // new vehicle number
  vehicleType?: 'REGULAR' | 'ODC'
  reason?: string            // reason for vehicle change
}
// Response (200): updated EWayBill record
// Error 400: EWAYBILL_NOT_ACTIVE | EWAYBILL_NOT_FOUND
```

### 5.5 GST Returns

```ts
// GET /api/gst/returns/GSTR1/:period (period = "2026-04")
interface Gstr1SummaryRes {
  success: true
  data: {
    period: string
    totalInvoices: number
    totalCreditNotes: number
    totalDebitNotes: number
    b2b:  { count: number; taxable: number; tax: number }   // paise
    b2cl: { count: number; taxable: number; tax: number }
    b2cs: { count: number; taxable: number; tax: number }
    cdnr: { count: number; taxable: number; tax: number }
    cdnur: { count: number; taxable: number; tax: number }
  }
}

// POST /api/gst/returns/GSTR1/:period/export  { format: 'JSON' | 'CSV' | 'EXCEL' }
interface Gstr1ExportRes {
  success: true
  data: {
    fileName: string    // "GSTR1_29ABCDE1234F1Z5_042026.json"
    json: {             // NIC offline tool schema v3.0
      gstin: string
      fp: string        // "042026" (MMYYYY)
      b2b: NicB2BEntry[]
      b2cl: NicB2CLEntry[]
      b2cs: NicB2CSEntry[]
      cdnr: NicCDNREntry[]
      cdnur: NicCDNUREntry[]
      hsn: NicHsnSummaryEntry[]
      nil: NicNilEntry
      exp: NicExportEntry[]
    }
  }
}

// NIC schema interfaces (all amounts in rupees, not paise — convert at export time)
interface NicB2BEntry {
  ctin: string         // customer GSTIN
  inv: Array<{
    inum: string       // invoice number
    idt: string        // "DD-MM-YYYY"
    val: number        // grand total in Rs
    pos: string        // 2-digit place of supply
    rchrg: 'Y' | 'N'  // reverse charge
    itms: Array<{
      num: number
      itm_det: { rt: number; txval: number; iamt: number; camt: number; samt: number; csamt: number }
    }>
  }>
}

interface NicHsnSummaryEntry {
  hsn_sc: string      // HSN/SAC code
  desc: string
  uqc: string         // Unit Quantity Code (from HsnCode.uqc)
  qty: number
  val: number         // total invoice value in Rs
  txval: number       // taxable value in Rs
  iamt: number
  camt: number
  samt: number
  csamt: number
}

// GET /api/gst/returns/GSTR3B/:period
interface Gstr3BSummaryRes {
  success: true
  data: {
    period: string
    outwardSupplies: {
      totalTaxable: number      // paise
      integratedTax: number
      centralTax: number
      stateTax: number
      cess: number
    }
    outwardRcm: { totalTaxable: number; integratedTax: number; centralTax: number; stateTax: number; cess: number }
    interStateB2C: { totalTaxable: number; integratedTax: number }
    nilExemptNonGst: { interState: number; intraState: number }  // paise
    itcAvailable: { igst: number; cgst: number; sgst: number; cess: number }
    itcReversed: { rule42_43: number; others: number }
    netItc: { igst: number; cgst: number; sgst: number; cess: number }
    taxPayable: { igst: number; cgst: number; sgst: number; cess: number }
    lateFee: number
  }
}
```

### 5.6 Data Migration / Backfill

```ts
// POST /api/gst/backfill/preview   { fromDate: 'YYYY-MM-DD', toDate: 'YYYY-MM-DD' }
interface BackfillPreviewRes {
  success: true
  data: {
    totalInvoices: number
    untaggedProducts: number          // products with taxCategoryId = null
    invoicesWithNoPlaceOfSupply: number
    affectedTaxableValue: number      // paise — sum of grandTotal for affected docs
  }
}

// POST /api/gst/backfill/execute
interface BackfillExecuteReq {
  defaultTaxCategoryId: string   // which category to assign to null-taxCategoryId products
  setPlaceOfSupplyFromParty: boolean  // auto-fill placeOfSupply from party.stateCode
  fromDate?: string
  toDate?: string
}
interface BackfillExecuteRes {
  success: true
  data: {
    productsUpdated: number
    invoicesUpdated: number
    taxRecalculated: number
    errors: Array<{ documentId: string; error: string }>
  }
}
```

---

## 6. Data Model Changes Summary

| Table | Field | Type | Default | Purpose |
|-------|-------|------|---------|---------|
| Business | gstEnabled | Boolean | false | GST opt-in gate |
| Business | taxPricingMode | String | 'EXCLUSIVE' | Business-level pricing default |
| Business | gstDeclarationText | String? | null | Editable declaration on templates |
| DocumentSettings | taxPricingMode | String | 'EXCLUSIVE' | Mirrors Business for new invoices |
| Document | taxPricingMode | String | 'EXCLUSIVE' | Per-invoice override |
| HsnCode | uqc | String | 'NOS' | Unit Quantity Code for GSTR-1 HSN summary |

**No changes** to: TaxCategory, EInvoice, EWayBill, GstReturn, DocumentLineItem (all fields exist)

---

## 7. UI States — Every New/Modified Screen

### 7.1 GST Settings Page (`/settings/gst`)

**Loading:** Skeleton with 2-row shimmer (toggle row + GSTIN input row). Height matches content.

**Error:** "Could not load GST settings. Check your connection and try again." [Retry] button.

**Empty (GST disabled):** Toggle off. Sub-label: "Enable GST billing to add tax rates to invoices, show GSTIN on templates, and export GSTR reports." No GSTIN field shown until toggle is on.

**Success (GST enabled):** Toggle on, GSTIN input visible, composition toggle, e-invoice/e-way bill toggles, pricing mode selector, declaration text textarea, turnover slab dropdown.

### 7.2 Invoice Form — Tax Column

**Loading (product select):** Tax picker shows spinner for 300ms while taxCategoryId resolves from product.

**Error (HSN search):** Inline toast below HSN field: "HSN search failed. Check connection." HSN field remains editable — user can type code manually.

**Empty (untagged product):** Orange badge on line item row: "Tax rate not set". Tax picker is open/focused automatically. A "Save as Exempt" secondary action closes the warning and sets to 0%.

**Success (tax calculated):** Tax amount column populated, summary row shows CGST/SGST or IGST breakdown.

### 7.3 E-Way Bill Modal (on invoice save)

**Loading:** Full-screen modal with skeleton form inputs.

**Error:** Modal stays open. Error banner at top: "E-Way Bill generation failed. [reason from NIC]. Please retry or dismiss and generate later." [Retry] [Generate Later] buttons.

**Empty (modal open):** Pre-filled from Pincode (business.pincode) and To Pincode (party billing address pincode). Vehicle Number and Distance are empty, marked required.

**Success:** Modal closes. Toast: "E-Way Bill generated — EWB No. [12-digit number]". Invoice detail page shows EWayBillCard with number, validity, and transport details.

### 7.4 E-Invoice Card (on invoice detail)

**Not generated:** "Generate IRN" button (visible when eInvoiceEnabled = true or business manually clicks). For auto-failed attempts: "IRN generation failed — retry" red button.

**Loading (generating):** Spinner overlay on the card. "Generating e-invoice…" text. Invoice detail rest of page remains interactive.

**Error (NIC down):** Red banner: "E-invoice generation failed. NIC IRP is currently unavailable. Try again in a few minutes." [Retry] button.

**Success:** Green card with: IRN (truncated to 24 chars + "..."), Ack No., Ack Date, cancel countdown, QR code image, and "Cancel IRN" button (visible within 24h window only).

### 7.5 GSTR-1 / GSTR-3B Export Page (`/reports/gst-returns`)

**Loading:** Skeleton table with 5 shimmer rows (one per B2B/B2CL/B2CS/CDNR/CDNUR section).

**Error:** "Could not generate GSTR-1 data. Check your connection." [Retry].

**Empty (no invoices in period):** "No invoices found for [Month Year]. Create invoices to generate your GSTR-1." [Create Invoice] CTA.

**Success:** Summary tiles (invoice count, total taxable value, total tax), section-wise breakdown table, [Export as JSON] and [Export as CSV] buttons. GST Return record created/updated in DB with status EXPORTED after download.

### 7.6 Data Backfill Wizard (`/settings/gst/backfill`)

**Step 1 — Preview:** "Review old invoices" with counts: X invoices without place of supply, Y products without tax category. [See Details] expandable list. [Proceed] / [Cancel].

**Step 2 — Options:** Date range picker (default: full history). Default tax category dropdown for untagged products. Toggle: "Auto-fill place of supply from party state". Tax recalculation preview: "Taxable amount will be re-computed for X invoices."

**Step 3 — Confirmation:** "This will update X products and recalculate tax on Y invoices. This cannot be automatically undone — we recommend downloading a backup first." [Download Backup] [Proceed Anyway].

**Step 4 — Processing:** Progress bar: "Updated 34 of 312 invoices…". Non-cancellable once started.

**Step 5 — Complete:** "Backfill complete. X products tagged, Y invoices updated, Z invoices recalculated." Error rows listed if any. [Done].

---

## 8. Print Templates — GST Block (All 30 Templates)

### 8.1 Changes to TemplateConfig

Two new boolean flags added to `TemplateFieldsConfig` (client type + default seeding on all 30 templates):

```ts
interface TemplateFieldsConfig {
  // ... existing 25 fields ...
  gstTaxSummary: boolean    // shows CGST/SGST/IGST/Cess subtotals table — default: true when gstEnabled
  gstDeclaration: boolean   // shows declaration text block — default: true when gstEnabled
}
```

Default for all 30 existing templates: `gstTaxSummary: false, gstDeclaration: false` (backward-compatible — no visual change until gstEnabled = true). When `gstEnabled` flips to true, the template editor auto-enables both flags and persists.

### 8.2 GST Tax Summary Block Layout

Rendered below the "Total" row and above "Grand Total" in the invoice summary section:

```
────────────────────────────────
Taxable Value:      ₹ 10,000.00
CGST (9%):             ₹  900.00
SGST (9%):             ₹  900.00
─────────────────────────────────
Total Tax:           ₹ 1,800.00
Grand Total:        ₹ 11,800.00
────────────────────────────────
```

For IGST (inter-state):
```
IGST (18%):          ₹ 1,800.00
```

For composition scheme ("Bill of Supply"):
```
[No tax breakdown printed]
Composition Dealer under GST
```

### 8.3 GSTIN Header Block

Business GSTIN: printed on a dedicated line directly below the business name/address block.
Format: `GSTIN: 29ABCDE1234F1Z5`

Customer GSTIN (when `fields.customerGstin = true`): printed in the customer header block, same format.

### 8.4 Declaration Text

Printed as a small italic paragraph at the very bottom of the invoice, above the terms & conditions, when `fields.gstDeclaration = true`.

Default text (editable via `Business.gstDeclarationText`):
> "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct."

Composition scheme default:
> "We declare that this Bill of Supply is issued under the Composition Scheme of the CGST Act, 2017. No tax is chargeable on this bill."

RCM default (appended when `isReverseCharge = true`):
> "Tax is payable on reverse charge basis."

### 8.5 IRN QR Code Block

When `eInvoice` record exists and `fields.qrCode = true`, the IRN QR code is printed in the bottom-right corner of the invoice (40mm × 40mm for A4, 30mm × 30mm for thermal 80mm, hidden on 58mm thermal — too narrow).

### 8.6 "Bill of Supply" Relabeling

When `Business.compositionScheme = true`, the document type printed at the top of the invoice changes:
- "TAX INVOICE" → "BILL OF SUPPLY"
- "SALES RETURN / CREDIT NOTE" → "CREDIT NOTE" (no change — CN still valid for composition)
This is a template render-time substitution, not a schema change.

### 8.7 HSN Column

`columns.hsn.visible = true` (default when `gstEnabled = true`). Renders the `DocumentLineItem.hsnCode` (or `sacCode` for services) in the items table. Header label defaults to "HSN/SAC".

---

## 9. Composition Scheme — Full Detail

### 9.1 Business Setup

In `Settings > GST > Composition Scheme`:
- Toggle: "Composition Scheme Dealer"
- Sub-label: "Pay GST at a flat rate on your taxable turnover. You cannot collect tax from customers."
- Rate selector (appears when toggle on): 1% (Traders), 5% (Restaurants), 6% (Service providers / Manufacturers)
  - Stored in `Business.compositionRate` (basis points: 100 | 500 | 600)
- Warning on enabling: "Once enabled, your invoices will print as 'Bill of Supply'. You cannot charge or collect GST from customers."

### 9.2 Composition Billing Behavior

| Field | Behavior |
|-------|----------|
| Invoice type label | "Bill of Supply" |
| Tax columns on form | Hidden |
| Tax columns on print | Hidden |
| TaxCategory picker | Hidden |
| Tax stored internally | `totalCgst/Sgst/Igst = 0`. Composition liability tracked via a monthly summary (out of scope for v7 — no composition liability report in v7). |
| GSTR-1 export | Composition invoices excluded from GSTR-1 (composition dealers file GSTR-4, out of scope). Export shows zero for composition business. |
| GSTR-3B | Section 3.1(b) "Outward taxable supplies (zero rated)" populated with composition turnover. |

### 9.3 Purchase Invoices for Composition Dealers

- ITC section hidden/greyed on PURCHASE_INVOICE form
- Banner: "You are a composition dealer. ITC on this purchase cannot be claimed."
- Tax on purchase invoice is still recorded (for supplier's GSTR-2A matching) but not added to an ITC register

---

## 10. Reverse Charge — Full Detail

### 10.1 RCM Toggle Placement

- PURCHASE_INVOICE: always visible
- SALE_INVOICE: visible only when `gstEnabled = true` (for notified outward services)

### 10.2 Notified RCM SAC Codes (Advisory Only)

| SAC | Service |
|-----|---------|
| 9982 | Legal services |
| 9965 | Goods Transport Agency (GTA) |
| 9985 | Security agency services |
| 998313 | Technical testing and analysis |
| 9987 | Maintenance and repair services (select sub-codes) |

When any line item's SAC code matches, the advisory banner fires. The user toggles RCM on/off manually; the system does not force it.

### 10.3 Self-Invoice for Unregistered Suppliers

When PURCHASE_INVOICE + `isReverseCharge = true` + `party.gstin = null` (unregistered supplier):
- A "Generate Self-Invoice" secondary action appears on the invoice detail page
- Self-invoice is a PDF copy of the purchase invoice relabeled "Self Invoice — Reverse Charge" with the recipient's own GSTIN as both supplier and recipient — fulfilling the self-invoicing requirement under GST rules
- Stored as a child document linked via `Document.parentDocumentId`
- NOT sent to NIC (no IRN for self-invoices)

### 10.4 RCM Print Output

When `isReverseCharge = true`:
- Tax columns print normally (shows tax amount that the recipient must self-pay)
- A red/bold line prints below tax totals: "Tax payable on reverse charge basis"
- Declaration text updated to include RCM clause (see Section 8.4)

---

## 11. GSTR-1 Export — NIC-Compatible JSON

### 11.1 Tables Exported

| Table | Description | Included in v7 |
|-------|-------------|----------------|
| B2B | Business-to-business invoices | Yes |
| B2CL | B2C large (inter-state > Rs 2.5L) | Yes |
| B2CS | B2C small (aggregated by state/rate) | Yes |
| CDNR | Credit/debit notes to registered | Yes |
| CDNUR | Credit/debit notes to unregistered | Yes |
| HSN | HSN-wise summary (table 12) | Yes |
| NIL | Nil-rated, exempt, non-GST supplies | Yes |
| EXP | Exports (with/without payment) | Yes (flag only — documents with `supplyType = 'EXPORT'`) |
| AT | Advances received | No (out of scope) |
| TXPD | Tax on advances adjusted | No (out of scope) |

### 11.2 NIC JSON Schema Version

Schema version: **GSTR1 v3.0** (current as of April 2026 — the offline tool import format). File name format: `GSTR1_{GSTIN}_{MMYYYY}.json` e.g. `GSTR1_29ABCDE1234F1Z5_042026.json`.

### 11.3 Unit Quantity Code (UQC) Population

`HsnCode.uqc` is added via migration. Common UQC values seeded:

| UQC | Meaning |
|-----|---------|
| NOS | Numbers |
| KGS | Kilograms |
| MTR | Metres |
| LTR | Litres |
| SQM | Square Metres |
| BOX | Box |
| DOZ | Dozen |
| GMS | Grams |
| PKG | Packages |
| TON | Metric Tons |

HSN chapters without a specific UQC default to 'NOS'. The GSTR-1 export service reads `HsnCode.uqc` when building the HSN summary. If a product's HSN is not in the HsnCode table, UQC defaults to 'NOS'.

### 11.4 Amount Units in Export

All paise values are divided by 100 at export time to produce rupee values with 2 decimal places (NIC schema expects rupees, not paise).

### 11.5 CSV/Excel Export

In addition to JSON, the export endpoint accepts `format: 'CSV'`. The CSV has one row per invoice in B2B format: Invoice No., Invoice Date, Customer Name, Customer GSTIN, Place of Supply, Invoice Value (Rs), Taxable Value (Rs), IGST (Rs), CGST (Rs), SGST (Rs), Cess (Rs), Supply Type, Reverse Charge (Y/N).

---

## 12. GSTR-3B — Full Detail

### 12.1 Sections Computed

| Section | Data source |
|---------|-------------|
| 3.1(a) Outward taxable supplies (other than zero-rated/nil) | SALE_INVOICE + DEBIT_NOTE where not RCM and not nil/exempt |
| 3.1(b) Outward taxable supplies (zero rated) | SALE_INVOICE with `supplyType = 'EXPORT'` or `'SEZ'` |
| 3.1(c) Other outward supplies (nil/exempt/non-GST) | Line items with taxRate = 0% (exempt) |
| 3.1(d) Inward supplies liable to RCM | PURCHASE_INVOICE where `isReverseCharge = true` |
| 3.1(e) Non-GST outward supplies | Line items with no HSN/SAC |
| 3.2 Inter-state supplies to unregistered | B2C_LARGE invoices by destination state |
| 4 ITC Available | PURCHASE_INVOICE IGST/CGST/SGST totals (where `compositionScheme = false`) |
| 4(D) ITC Reversed | Manual entry — not computed (out of scope for v7) |
| 5 Exempt/nil/non-GST inward supplies | PURCHASE_INVOICE with exempt line items |
| 6.1 Tax payable | Computed from 3.1 minus 4 net ITC |

### 12.2 Export Format

GSTR-3B JSON exported in same response envelope as GSTR-1. File name: `GSTR3B_{GSTIN}_{MMYYYY}.json`. No separate NIC schema version for 3B — it's a summary form; the JSON mirrors the GSTN portal's offline return format.

---

## 13. Data Migration Backfill Wizard

### 13.1 When It Appears

After `gstEnabled` flips to true for the first time AND `GstReturn` table has zero records AND `Document` table has records with `placeOfSupply = null`: a one-time prompt banner appears on the GST Settings page: "You have X old invoices that may not have tax data. Run the GST backfill wizard to bring them up to date." [Run Wizard] [Remind me later].

### 13.2 Backfill Logic

1. Fetch all SALE_INVOICE and PURCHASE_INVOICE with `placeOfSupply = null` or `totalCgst = 0 AND totalSgst = 0 AND totalIgst = 0`
2. For each invoice:
   - Set `placeOfSupply` from `party.stateCode` if `setPlaceOfSupplyFromParty = true`
   - For each line item: if `taxCategoryId = null`, assign the `defaultTaxCategoryId` chosen by user (default: Exempt category)
   - Recalculate `taxableValue`, `cgstAmount`, `sgstAmount`, `igstAmount`, `cessAmount` using the existing `tax-calc.ts` engine
   - Update `Document.totalCgst/Sgst/Igst/Cess` and `Document.grandTotal`
3. Backfill is idempotent: re-running with same parameters produces same result
4. Each updated document gets a `AuditLog` entry: `action: 'GST_BACKFILL', changes: { before, after }`

### 13.3 Product Auto-Tagging

All `Product` records with `taxCategoryId = null` are assigned the "Exempt (0%)" TaxCategory as part of GST first-enable setup (not the backfill wizard — this happens automatically). Flagged for owner review via a banner on the Products list page: "X products have no tax category assigned. Review and assign correct rates." [Review Products].

---

## 14. Mobile — Layout Constraints

All new screens must pass at 375px (primary) and 320px (minimum). No horizontal scroll permitted.

| Screen | Mobile-specific behavior |
|--------|--------------------------|
| Invoice form tax column | Tax picker is full-width bottom sheet on mobile (not inline dropdown). HSN typeahead shows in same bottom sheet with separate search input. |
| E-Way Bill modal | Full-screen bottom sheet on mobile. Two-column layout on 375px+, single-column on 320px. |
| GST Settings page | All toggles and inputs full-width. Declaration text textarea resizes to viewport. |
| GSTR-1 export | Summary tiles in 2-column grid (375px) or 1-column (320px). Export button fixed to bottom. |
| Backfill wizard | Single-column step form. Progress bar at top. |
| Invoice tax summary | Replaces single "Tax" row with expanded CGST/SGST breakdown — each on its own row. On 320px: abbreviated "C.Tax", "S.Tax", "I.Tax". |
| IRN cancel countdown | Pill badge on invoice detail. "X hrs Y mins" format. On 320px abbreviates to "Xh Ym". |

**Offline behavior:** All tax calculations run client-side (existing `tax-calc.utils.ts`). GSTR export requires network (server-computed). E-invoice/e-way bill require network (NIC API). If offline: export and e-compliance actions show "You must be online to generate e-invoice / e-way bill / GSTR exports." No queue for these — they are on-demand compliance actions.

---

## 15. UX Copy — Complete

### Buttons and Labels

| Element | Copy |
|---------|------|
| Enable GST toggle | Enable GST Billing |
| Composition scheme toggle | Composition Scheme Dealer |
| E-invoice toggle | Auto-generate E-Invoice (IRN) |
| E-way bill toggle | Auto-prompt E-Way Bill on qualifying invoices |
| Tax pricing mode — exclusive | Tax Exclusive — add tax on top of price |
| Tax pricing mode — inclusive | Tax Inclusive — price includes tax (MRP) |
| HSN field placeholder | Search HSN/SAC code… |
| Tax rate picker placeholder | Select tax rate |
| Untagged product badge | Tax rate not set |
| "Save as Exempt" action | Save as Exempt (0%) |
| Generate IRN button | Generate E-Invoice (IRN) |
| Cancel IRN button | Cancel E-Invoice |
| Generate EWB button | Generate E-Way Bill |
| Update Part B button | Update Vehicle Details |
| Export GSTR-1 JSON | Export GSTR-1 (NIC JSON) |
| Export GSTR-1 CSV | Export GSTR-1 (CSV) |
| Export GSTR-3B | Export GSTR-3B Summary |
| Run backfill button | Run GST Backfill Wizard |

### Toasts

| Trigger | Toast copy |
|---------|------------|
| GST enabled | GST billing enabled |
| GST settings saved | GST settings saved |
| IRN generated | E-Invoice generated — IRN saved |
| IRN cancelled | E-Invoice cancelled |
| E-Way Bill generated | E-Way Bill generated — EWB [number] |
| E-Way Bill Part B updated | Vehicle details updated |
| GSTR-1 exported | GSTR-1 exported — file saved |
| GSTR-3B exported | GSTR-3B exported — file saved |
| Backfill complete | GST backfill complete — X invoices updated |
| Product auto-tagged Exempt | X products tagged as Exempt (0%). Review in Products list. |

### Error Messages

| Error | User-facing message |
|-------|---------------------|
| GSTIN_FORMAT_INVALID | Invalid GSTIN format. Must be 15 characters: 2 digit state + 5 letter PAN + 4 digits + check digit (e.g. 29ABCDE1234F1Z5) |
| GSTIN_STATE_MISMATCH | GSTIN state (XX — State Name) does not match your business state. Please check before saving. |
| EINVOICE_PARTY_GSTIN_MISSING | Customer GSTIN is required for e-invoice generation. Add the customer's GSTIN first. |
| EINVOICE_BUSINESS_GSTIN_MISSING | Your business GSTIN must be saved before generating e-invoices. Go to GST Settings. |
| EINVOICE_ALREADY_GENERATED | E-invoice already generated for this invoice. Cancel and regenerate if needed. |
| EINVOICE_NIC_UNAVAILABLE | E-invoice generation failed — NIC portal is currently unavailable. Try again in a few minutes. |
| EINVOICE_CANCEL_WINDOW_EXPIRED | The 24-hour cancel window has expired. Issue a credit note to reverse this invoice. |
| EWAYBILL_BELOW_THRESHOLD | E-Way Bill is required only for invoices above ₹50,000. This invoice is below the threshold. |
| EWAYBILL_ALREADY_GENERATED | E-Way Bill already generated for this invoice. |
| EWAYBILL_NIC_UNAVAILABLE | E-Way Bill generation failed — NIC portal is currently unavailable. Try again in a few minutes. |
| GSTR_NO_INVOICES | No invoices found for [Month Year]. Create invoices to generate your GST return. |
| BACKFILL_IN_PROGRESS | Backfill is already running. Please wait for it to complete. |
| HSN_SEARCH_FAILED | HSN search failed. Check your connection or enter the code manually. |

### Confirmation Dialogs

| Action | Dialog title | Body | Confirm CTA | Cancel CTA |
|--------|-------------|------|-------------|------------|
| Enable composition scheme | Enable Composition Scheme? | You cannot collect tax from customers and cannot claim ITC on purchases. Existing invoices will not be changed. | Enable Composition | Cancel |
| Cancel IRN | Cancel E-Invoice? | This will cancel the IRN on the NIC portal. The invoice will remain in your records. You cannot undo this action. | Yes, Cancel IRN | Go Back |
| Run backfill | Confirm GST Backfill | Tax amounts on X old invoices will be recalculated. Download a backup before proceeding. This cannot be automatically undone. | Proceed with Backfill | Cancel |
| Disable GST | Disable GST Billing? | All invoices will show Exempt (0%) until GST is re-enabled. Existing invoices will not change. | Disable GST | Cancel |

---

## 16. Edge Cases

| Scenario | Handling |
|----------|----------|
| Invoice with mixed GST and exempt items | Each line item carries its own tax rate. Grand total sums CGST/SGST/IGST across all lines. Template renders one GST summary row per unique rate. |
| Same HSN code with different GST rates on same invoice | Allowed. HSN summary in GSTR-1 aggregates by HSN+rate combination. |
| Party GSTIN changes after invoice is saved | Already-saved invoice retains the GSTIN it was created with (stored in snapshot on DocumentLineItem). Party GSTIN field on Document frozen at save. |
| E-invoice generated, then invoice is manually edited | Editing a SAVED invoice with an active IRN shows a blocking alert: "This invoice has an active e-invoice (IRN). Cancel the IRN before editing, or the IRN will become invalid." Edit is allowed but IRN status is set to CANCELLED_BY_EDIT in the local DB (NIC is not notified — user must cancel via the NIC portal separately). |
| NIC IRP returns IRN already exists for this hash | Service returns the existing IRN (idempotent upsert). HTTP 200 with existing record. |
| E-way bill generated for intra-state invoice (no threshold breach) | Allowed (businesses may voluntarily generate for intra-state). Threshold validation only fires on the auto-prompt — manual generation from the detail page skips the threshold check. |
| Business has no pincode saved | E-way bill modal `fromPincode` field left blank, marked required. User must fill before generating. |
| Backfill runs while invoices are being created | Backfill queries for `placeOfSupply = null` at execution time. Invoices created during backfill (with proper place of supply from the new form) are not affected — they already have place of supply set. |
| GSTR-1 export with >10,000 invoices in a period | Server caps Prisma query at 10,000 (documented in code). Banner on export page: "Export limited to 10,000 invoices. For high-volume export, contact support." |
| Party is a composition dealer, creating sale invoice to them | `Party.compositionScheme = true` only affects purchase invoices (ITC warning). Sale invoices to composition parties proceed normally. |
| Composition business user turns off composition mid-year | Warning: "Switching off Composition mid-year may affect your GST filing. Ensure you file GSTR-4 for the composition period before switching." Toggle allowed but confirmation required. |
| RCM purchase with unregistered supplier, no GSTIN | Self-invoice generated with blank supplier GSTIN section. `party.gstin = null` renders as "Unregistered Supplier" on self-invoice. |
| HSN search returns no results | Empty state inline under HSN field: "No HSN codes found. Enter the code manually or contact your CA." HSN field accepts free-text entry. |
| Zero-value invoice (Rs 0 grand total) | E-way bill not triggered (below Rs 50,000). E-invoice allowed (NIC permits Rs 0 invoices for debit/credit adjustments). GSTR-1 export includes in B2B with Val = 0. |

---

## 17. Security

| Concern | Handling |
|---------|----------|
| Authentication | All GST routes require `auth` middleware. 401 if no valid JWT. |
| Business isolation | All queries filter by `req.user!.businessId`. No cross-tenant data access. |
| Permission gate | `PATCH /api/gst/settings` requires `settings.edit` permission. `POST /api/einvoice/generate` requires `invoicing.edit`. `POST /api/gst/returns/*/export` requires `reports.download`. |
| Subscription gate | E-invoice: `requirePlan('BUSINESS')`. E-way bill: `requirePlan('BUSINESS')`. GSTR export: `requirePlan('PRO')`. |
| NIC API credentials | Stored in server env vars (`NIC_CLIENT_ID`, `NIC_CLIENT_SECRET`, `NIC_API_BASE_URL`). Never returned to client. |
| GSTIN in responses | GSTIN is business data — returned only to authenticated users of that business. Not redacted. |
| Backfill endpoint | Rate-limited to 1 concurrent backfill per business (`BACKFILL_IN_PROGRESS` guard). No anonymous access. |
| Header injection | File names in `Content-Disposition` sanitized via `sanitizeFileName()` (already present in gst-returns.ts). |
| NIC payload validation | `buildNicPayload()` must validate required fields before calling NIC. Business with empty GSTIN or party with empty GSTIN → 400 before API call. |
| Rate limiting | `/api/einvoice/generate` and `/api/ewaybill/generate`: 10 requests/minute per business (add via existing rate limiter middleware). |

---

## 18. Out of Scope (v7)

These are explicitly NOT in v7. Any ticket proposing these should be rejected until they are separately scoped.

1. ITC matching / reconciliation against GSTR-2A or GSTR-2B (uploaded JSON comparison UI)
2. GSTR-2A reconciliation page (GstReconciliation model exists but GSTR-2A flow is deferred)
3. Automated GST filing / direct submission to GST portal API (v7 exports only — user files)
4. GSTR-9 annual return generation
5. GST registration assistance / new GSTIN application flow
6. Multiple GSTIN per business (branch GSTINs, SEZ units)
7. TDS/TCS computation engine (fields exist on Document for capture only — no calc)
8. Export invoice (zero-rated) Letter of Undertaking (LUT) / bond tracking
9. SEZ supply compliance beyond `supplyType = 'SEZ'` flag on invoice
10. Casual taxable person / non-resident taxable person filings
11. HSN master edits — HsnCode table is read-only seeded data; no admin UI in v7
12. GST refund applications (Section 54 CGST Act)
13. Input Service Distributor (ISD) credit distribution
14. TDS/TCS-GST provisions (Section 51/52 — applicable to e-commerce operators)
15. Advance receipt voucher GST treatment
16. Composition liability report (GSTR-4 equivalent)
17. Ledger drill-downs by tax head
18. ITC register / 2A/2B auto-matching

---

## 19. Acceptance Criteria

### Backend

- [ ] `curl -X PATCH /api/gst/settings -d '{"gstin":"29ABCDE1234F1Z5"}' -H "Authorization: Bearer <token>"` → `{ success: true, data: { gstEnabled: true, gstin: "29ABCDE1234F1Z5", stateCode: "29" } }`
- [ ] `curl -X PATCH /api/gst/settings -d '{"gstin":"INVALID"}' -H "..."` → `{ success: false, error: { code: "GSTIN_FORMAT_INVALID" } }` HTTP 400
- [ ] `curl /api/gst/returns/GSTR1/2026-04` → `{ success: true, data: { b2b: {...}, b2cl: {...}, b2cs: {...}, cdnr: {...}, cdnur: {...} } }`
- [ ] `curl -X POST /api/gst/returns/GSTR1/2026-04/export -d '{"format":"JSON"}'` → JSON file with NIC schema: `gstin`, `fp`, `b2b`, `b2cl`, `b2cs`, `cdnr`, `cdnur`, `hsn` keys present
- [ ] `curl -X POST /api/gst/returns/GSTR1/2026-04/export -d '{"format":"CSV"}'` → CSV with header row: `Invoice No.,Invoice Date,Customer Name,...`
- [ ] `curl /api/gst/returns/GSTR3B/2026-04` → `{ success: true, data: { outwardSupplies: {...}, itcAvailable: {...}, taxPayable: {...} } }`
- [ ] `curl -X POST /api/einvoice/generate -d '{"documentId":"<id>"}' -H "..."` → HTTP 201 with `irn` exactly 64 chars
- [ ] Same request twice → HTTP 200 with same `irn` (idempotent)
- [ ] `curl -X POST /api/einvoice/generate` with party missing GSTIN → HTTP 400 `EINVOICE_PARTY_GSTIN_MISSING`
- [ ] `curl -X POST /api/einvoice/cancel -d '{"documentId":"<id>","reason":"Duplicate"}' -H "..."` → HTTP 200 `status: CANCELLED`
- [ ] Cancel after 24h → HTTP 400 `EINVOICE_CANCEL_WINDOW_EXPIRED`
- [ ] `curl -X POST /api/ewaybill/generate -d '{"documentId":"<id>","transportMode":"ROAD","vehicleNumber":"KA01AB1234","distance":200,"fromPincode":"560001","toPincode":"400001"}' -H "..."` → HTTP 201 with `ewbNumber` 12 digits
- [ ] `curl -X PUT /api/ewaybill/update-partb -d '{"documentId":"<id>","vehicleNumber":"KA02CD5678"}' -H "..."` → HTTP 200 updated record
- [ ] Ewaybill generate for invoice below Rs 50,000 → HTTP 400 `EWAYBILL_BELOW_THRESHOLD`
- [ ] All GST routes without auth → HTTP 401
- [ ] `curl -X POST /api/gst/backfill/preview` → `{ totalInvoices: N, untaggedProducts: N, invoicesWithNoPlaceOfSupply: N }`
- [ ] `curl -X POST /api/gst/backfill/execute -d '{"defaultTaxCategoryId":"<exempt-id>","setPlaceOfSupplyFromParty":true}'` → `{ productsUpdated: N, invoicesUpdated: N }`
- [ ] GSTR-1 export file name matches pattern `GSTR1_{GSTIN}_{MMYYYY}.json`
- [ ] GSTR-3B: `taxPayable.cgst + taxPayable.sgst + taxPayable.igst = outwardSupplies total tax - netItc total`
- [ ] Tax calculation: Invoice Rs 10,000 + 18% GST, intra-state → `cgstAmount = 90000`, `sgstAmount = 90000`, `igstAmount = 0` (paise)
- [ ] Tax calculation: same invoice inter-state → `cgstAmount = 0`, `sgstAmount = 0`, `igstAmount = 180000` (paise)
- [ ] Tax-inclusive pricing: rate = Rs 118, GST 18% → `taxableValue = 100`, `igstAmount = 18` (in paise: rate=11800, taxableValue=10000, igst=1800)

### Frontend

- [ ] Screenshot: GST Settings page — loading state (skeleton)
- [ ] Screenshot: GST Settings page — GST enabled state (toggle on, GSTIN field, all sub-toggles)
- [ ] Screenshot: Invoice form — tax picker column showing per-line rates
- [ ] Screenshot: Invoice form — untagged product warning badge
- [ ] Screenshot: Invoice form — tax-inclusive mode enabled (chip shows "Prices include tax")
- [ ] Screenshot: E-Way Bill modal — pre-filled pincodes, required fields highlighted
- [ ] Screenshot: Invoice detail — EInvoiceCard (IRN generated, cancel countdown visible)
- [ ] Screenshot: Invoice detail — EWayBillCard (EWB number, validity, transport details)
- [ ] Screenshot: GSTR-1 page — summary tiles + section table
- [ ] Screenshot: GSTR-1 page — empty state (no invoices)
- [ ] Screenshot: GSTR-3B page — section breakdown
- [ ] Screenshot: Backfill wizard — all 5 steps
- [ ] Screenshot: Print template A4 with GST block (taxable value / CGST / SGST / Grand Total)
- [ ] Screenshot: Print template — "Bill of Supply" for composition dealer
- [ ] Screenshot: Print template — RCM notice line
- [ ] 375px: all new screens render without horizontal scroll
- [ ] 320px: all new screens render without horizontal scroll (single-column fallback verified)
- [ ] Dark theme: all new screens verified (no hardcoded light-background colors)

### Data Migration

- [ ] Fresh business with no invoices: enabling GST does NOT trigger backfill prompt
- [ ] Business with 50 invoices (pre-GST): enabling GST triggers backfill banner with correct count
- [ ] Run backfill with `setPlaceOfSupplyFromParty = true`: all invoices get `placeOfSupply` set from party state
- [ ] Run backfill with `defaultTaxCategoryId = <exempt>`: all products with null taxCategoryId assigned Exempt
- [ ] Re-run backfill: no duplicate updates (idempotent)
- [ ] Each backfilled invoice gets AuditLog entry with `action = 'GST_BACKFILL'`
- [ ] GSTR-1 export after backfill: backfilled invoices appear in correct sections (B2B/B2C) with recalculated tax

### Compliance

- [ ] GSTIN regex rejects: 14-char, 16-char, lowercase, invalid state code (>38)
- [ ] GSTIN regex accepts: all 37 valid state codes (01–38, skipping 25/28)
- [ ] Place of supply matrix: `businessStateCode = "29"`, `placeOfSupply = "27"` → `isInterState = true` → IGST applied
- [ ] Place of supply matrix: `businessStateCode = "29"`, `placeOfSupply = "29"` → `isInterState = false` → CGST+SGST applied
- [ ] B2C Large threshold: invoice Rs 2,50,001 inter-state, no party GSTIN → `supplyType = 'B2C_LARGE'`
- [ ] E-way bill threshold: invoice Rs 49,999 → no auto-prompt (below threshold)
- [ ] E-way bill threshold: invoice Rs 50,001 inter-state → auto-prompt appears on save
- [ ] Composition scheme: SALE_INVOICE prints "Bill of Supply", no tax breakdown
- [ ] Composition scheme: PURCHASE_INVOICE shows "cannot claim ITC" banner
- [ ] RCM: isReverseCharge = true → GSTR-3B section 3.1(d) populated
- [ ] GSTR-1 B2B entry: `rchrg` field = 'Y' when `isReverseCharge = true`
- [ ] NIC payload `TranDtls.RegRev = 'Y'` when `isReverseCharge = true`
- [ ] Tax-inclusive back-calculation: Rs 100 MRP at 18% GST → taxable = Rs 84.75, GST = Rs 15.25 (rounded: 84.75 + 15.25 = 100.00)
- [ ] IRN is exactly 64 characters (SHA-256 hex digest from NIC)
- [ ] IRN cancel window: cancel at hour 23.9 → succeeds; cancel at hour 24.1 → 400 EINVOICE_CANCEL_WINDOW_EXPIRED
- [ ] GSTR-1 JSON: `fp` field format = `"MMYYYY"` (e.g. `"042026"` for April 2026)
- [ ] GSTR-1 JSON: invoice dates in `"DD-MM-YYYY"` format
- [ ] GSTR-1 JSON: all monetary values in rupees (paise ÷ 100), 2 decimal places

---

## 20. QA Checklist

Verifier must confirm each item (binary: pass / fail — no "partial"):

**Setup**
- [ ] Fresh test business: GST disabled, no GSTIN → invoice form shows no tax column
- [ ] Add GSTIN → gstEnabled auto-sets to true → tax column appears on invoice form
- [ ] Add GSTIN with invalid format → 400 error with exact message shown
- [ ] Manual "Enable GST" toggle without GSTIN → tax column appears, no GSTIN on template

**Tax Calculation**
- [ ] Create intra-state B2B invoice, 1 line item, GST 18%, Rs 1,000 → CGST Rs 90, SGST Rs 90, Grand Total Rs 1,180
- [ ] Same invoice but change place of supply to different state → recalculates to IGST Rs 180, CGST/SGST = 0
- [ ] Tax-inclusive mode: enter rate Rs 118, GST 18% → taxable value = Rs 100, IGST = Rs 18
- [ ] Cess: line item with GST 28% + cess 5% → both calculated and shown in summary

**Templates**
- [ ] Generate PDF for GST-enabled intra-state invoice → GSTIN visible in header, CGST+SGST tax block in summary
- [ ] Generate PDF for GST-enabled inter-state invoice → IGST tax block in summary
- [ ] Generate PDF for composition dealer → "Bill of Supply" title, no tax breakdown, composition declaration
- [ ] Generate PDF for RCM invoice → "Tax payable on reverse charge basis" line present

**E-Invoice**
- [ ] Generate IRN for SALE_INVOICE with party GSTIN → 201, irn 64 chars, ackNumber, qrCodeData present
- [ ] Retry same request → 200 with same IRN
- [ ] Generate IRN for PURCHASE_INVOICE → 400 correct error
- [ ] Generate IRN for invoice with no party GSTIN → 400 EINVOICE_PARTY_GSTIN_MISSING
- [ ] Cancel within 24h → 200, status CANCELLED
- [ ] Cancel after 24h simulation → 400 EINVOICE_CANCEL_WINDOW_EXPIRED
- [ ] IRN QR code renders on PDF

**E-Way Bill**
- [ ] Create inter-state invoice Rs 51,000 with eWayBillEnabled → modal auto-appears on save
- [ ] Fill modal, submit → 201 ewbNumber 12 digits
- [ ] Invoice Rs 49,000 → modal does not appear
- [ ] Manual generate from detail page (below threshold) → 201 (no threshold check on manual)
- [ ] Update Part B → 200 with updated vehicleNumber, partBUpdates array has 1 entry

**GSTR-1**
- [ ] Create 3 B2B invoices, 2 B2C invoices for April 2026 → GET /api/gst/returns/GSTR1/2026-04 → correct counts
- [ ] Export JSON → file downloads, opens as valid JSON, `b2b` array has 3 entries
- [ ] Export CSV → file downloads, correct headers, 5 data rows (3 B2B + 2 B2C)
- [ ] HSN summary in JSON → `uqc` field present on every entry

**GSTR-3B**
- [ ] GET /api/gst/returns/GSTR3B/2026-04 → all 6 sections present
- [ ] RCM invoice present → section 3.1(d) populated with non-zero value
- [ ] Export GSTR-3B JSON → downloads with correct file name

**Backfill**
- [ ] Create 5 invoices without GST, then enable GST → banner shows "5 invoices need backfill"
- [ ] Preview endpoint → correct counts
- [ ] Execute → all 5 invoices have placeOfSupply set, products have taxCategoryId = exempt
- [ ] Re-execute → idempotent, no double-update

**Composition Scheme**
- [ ] Enable composition 5% → all new SALE_INVOICE documents have "Bill of Supply" print label
- [ ] Create PURCHASE_INVOICE → "cannot claim ITC" banner visible
- [ ] GSTR-3B for composition period → section 3.1(b) shows composition turnover

**Mobile**
- [ ] Tax picker on 375px → bottom sheet opens on tap, search works
- [ ] E-Way Bill modal on 375px → single-column layout, all fields accessible
- [ ] GSTR-1 page on 320px → no horizontal scroll, export button reachable
- [ ] Invoice detail with EInvoiceCard on 320px → IRN truncated cleanly, cancel button accessible

**Offline**
- [ ] Disconnect network, create invoice → tax calculated client-side correctly (no API call for calc)
- [ ] Attempt GSTR export while offline → "You must be online" message shown
- [ ] Attempt Generate IRN while offline → "You must be online" message shown
