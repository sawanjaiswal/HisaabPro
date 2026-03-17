# Phase 2 — GST & Compliance PRD

**Status:** Draft
**Features:** #63–#82 (20 features from ROADMAP.md)
**Timeline:** Weeks 13–18
**Goal:** Fully GST-compliant billing that accountants trust

---

## 1. What

Transform HisaabPro from a non-GST billing app into a fully GST-compliant invoicing platform. Users can create tax invoices with auto-calculated CGST/SGST/IGST, generate e-invoices (IRN + QR), create e-way bills, export GSTR-1/3B JSON for filing, and handle special regimes (Composition, RCM, TDS/TCS). Also adds multi-currency and recurring invoices.

---

## 2. Domain Model

### New Entities

```
TaxCategory {
  id, businessId, name, rate (basis points, e.g. 1800 = 18%),
  cessRate (basis points), cessType (PERCENTAGE | FIXED_PER_UNIT),
  hsnCode?, sacCode?, isDefault, isActive,
  createdAt, updatedAt
}

HsnCode {
  code (PK), description, chapter, defaultRate (basis points),
  cessApplicable (bool), cessRate?
}
// Pre-seeded ~12K records, read-only, synced to IndexedDB

EInvoice {
  id, documentId (unique), irn, ackNumber, ackDate,
  qrCodeData, signedInvoice (JSON), status (GENERATED | CANCELLED),
  cancelReason?, cancelledAt?, rawResponse (JSON),
  createdAt
}

EWayBill {
  id, documentId, ewbNumber, ewbDate, validUpto,
  transportMode (ROAD | RAIL | AIR | SHIP),
  transporterId?, transporterName?,
  vehicleNumber?, vehicleType?,
  distance (km), fromPincode, toPincode,
  status (ACTIVE | CANCELLED | EXTENDED),
  cancelReason?, cancelledAt?,
  partBUpdates (JSON[]), // vehicle change log
  createdAt
}

GstReturn {
  id, businessId, period (YYYY-MM), returnType (GSTR1 | GSTR3B | GSTR9),
  status (DRAFT | EXPORTED | FILED), filedAt?,
  jsonData (JSON), summary (JSON),
  invoiceCount, totalTaxableValue, totalTax,
  createdAt, updatedAt
}

RecurringInvoice {
  id, businessId, templateDocumentId,
  partyId, frequency (WEEKLY | MONTHLY | QUARTERLY | YEARLY),
  startDate, endDate?, nextRunDate,
  dayOfMonth?, dayOfWeek?,
  autoSend (bool), status (ACTIVE | PAUSED | COMPLETED),
  generatedCount, lastGeneratedAt?,
  createdAt, updatedAt
}
```

### Existing Model Changes

```
Business += {
  gstin String?,
  stateCode String? (2-digit, extracted from GSTIN),
  compositionScheme Boolean @default(false),
  eInvoiceEnabled Boolean @default(false),
  eWayBillEnabled Boolean @default(false),
  turnoverSlab String? // for e-invoice threshold tracking
}

Party += {
  stateCode String? (2-digit, extracted from GSTIN),
  gstinVerified Boolean @default(false),
  gstinVerifiedAt DateTime?,
  compositionScheme Boolean @default(false)
}

Product += {
  taxCategoryId String? (FK → TaxCategory)
}

Document += {
  placeOfSupply String? (2-digit state code),
  supplyType String @default("B2B"), // B2B, B2C_LARGE, B2C_SMALL, EXPORT, SEZ
  isReverseCharge Boolean @default(false),
  isComposite Boolean @default(false),
  totalTaxableValue Int @default(0), // paise
  totalCgst Int @default(0), // paise
  totalSgst Int @default(0), // paise
  totalIgst Int @default(0), // paise
  totalCess Int @default(0), // paise
  eInvoiceId String? (FK → EInvoice, unique),
  eWayBillId String? (FK → EWayBill),
  recurringInvoiceId String? (FK → RecurringInvoice)
}

DocumentLineItem += {
  taxCategoryId String?,
  hsnCode String?,
  sacCode String?,
  taxableValue Int @default(0), // paise (lineTotal after discount)
  cgstRate Int @default(0), // basis points
  cgstAmount Int @default(0), // paise
  sgstRate Int @default(0), // basis points
  sgstAmount Int @default(0), // paise
  igstRate Int @default(0), // basis points
  igstAmount Int @default(0), // paise
  cessRate Int @default(0), // basis points
  cessAmount Int @default(0) // paise
}
```

### State Machines

**EInvoice:** `(none) → GENERATED → CANCELLED`
- Cancel allowed within 24h of generation only (NIC rule)

**EWayBill:** `(none) → ACTIVE → CANCELLED | EXTENDED`
- Cancel within 24h. Extend before expiry.
- Part-B update (vehicle change) allowed while ACTIVE.

**RecurringInvoice:** `ACTIVE ↔ PAUSED → COMPLETED`
- COMPLETED when endDate reached or manually stopped.

**GstReturn:** `DRAFT → EXPORTED → FILED`
- DRAFT = auto-generated from invoices. EXPORTED = JSON downloaded. FILED = user confirms filed on GSTN.

---

## 3. User Flows

### 3a. GST Setup (one-time)
1. Settings → GST Settings
2. Enter business GSTIN → auto-extract state code, validate format
3. Toggle: "Registered under Composition Scheme" (changes invoice template)
4. Toggle: "Enable E-Invoicing" (if turnover > Rs 5 crore)
5. Toggle: "Enable E-Way Bill" (if transporting goods)
6. System creates default tax categories: GST 0%, 5%, 12%, 18%, 28%, Exempt

### 3b. Assign Tax to Products
1. Products → Edit product
2. Select "Tax Rate" dropdown (from TaxCategory list)
3. Enter/search HSN/SAC code (autocomplete from pre-seeded DB)
4. Save → all future invoices for this product auto-apply this rate

### 3c. Create GST Invoice
1. User creates invoice (existing flow)
2. Selects party → system reads party GSTIN → extracts state code
3. Place of Supply auto-determined: party state vs business state
   - Same state → CGST + SGST (each = rate/2)
   - Different state → IGST (full rate)
   - User can override Place of Supply
4. Each line item: product HSN/tax rate pre-filled from product master
   - User can override per line
   - Tax calculated: taxableValue = lineTotal (after discount)
   - Tax amounts rounded per line (Section 170)
5. Invoice summary shows: subtotal, CGST total, SGST total, IGST total, cess, round-off, grand total
6. Save → tax ledger entries auto-created
7. Document title: "Tax Invoice" (or "Bill of Supply" if Composition Scheme)

### 3d. GSTIN Verification
1. Party create/edit → enter GSTIN
2. Format validation (15-char regex + checksum) instant
3. "Verify" button → API call to government → returns legal name, state, status
4. Show verified badge + auto-fill: state code, legal name
5. If API unavailable → show "Unverified" badge, don't block save

### 3e. E-Invoice Generation
1. After saving B2B tax invoice (if e-invoice enabled)
2. "Generate IRN" button on invoice detail
3. System sends invoice JSON to NIC IRP sandbox API
4. NIC returns: IRN (64-char hash), acknowledgement number, signed QR code
5. Store IRN + QR → display on invoice PDF
6. Cancel: within 24 hours, "Cancel IRN" button → reason required

### 3f. E-Way Bill
1. After saving invoice with goods value > Rs 50,000
2. "Generate E-Way Bill" button
3. User enters: transport mode, vehicle number (if road), distance, transporter details
4. System sends to NIC E-Way Bill API
5. Returns: EWB number, valid-until date
6. Print/share e-way bill with transporter
7. Update Part-B (vehicle change) while in transit

### 3g. Credit/Debit Notes
1. From invoice detail → "Create Credit Note" / "Create Debit Note"
2. Pre-fills line items from original invoice
3. User adjusts quantities/amounts for return/correction
4. Linked to original invoice (originalDocumentId)
5. Tax auto-calculated (mirrors original tax treatment)
6. Reduces outstanding balance + appears in GSTR reports

### 3h. GSTR-1 Export
1. Reports → GST Returns → GSTR-1
2. Select period (month)
3. System aggregates all sales invoices for the period
4. Categorizes: B2B (invoice-wise), B2C Large (>2.5L), B2C Small (aggregated by state), Credit Notes, HSN Summary
5. Shows summary dashboard + drill-down
6. "Export JSON" → downloads GSTR-1 JSON (government format)
7. User uploads to GSTN portal manually

### 3i. GSTR-3B Report
1. Reports → GST Returns → GSTR-3B
2. Select period → system aggregates:
   - Outward supplies (taxable + exempt + nil-rated)
   - Tax payable (CGST + SGST + IGST + Cess)
3. Shows summary matching GSTR-3B table structure
4. Export as JSON or PDF for CA

### 3j. Recurring Invoices
1. From any saved invoice → "Set as Recurring"
2. Select frequency (weekly/monthly/quarterly/yearly)
3. Set start date, end date (optional), day of month
4. Toggle auto-send (WhatsApp/email)
5. System auto-generates invoice on schedule → notification to user
6. Dashboard shows upcoming + overdue recurring invoices

### 3k. Multi-Currency
1. Invoice creation → select currency (dropdown, default INR)
2. Enter exchange rate (INR equivalent)
3. Line items in foreign currency, totals shown in both currencies
4. Tax calculated on INR equivalent (GST law requirement)
5. Stored: foreignCurrency, exchangeRate, foreignTotal + all paise fields in INR

---

## 4. API Contract

### Tax Categories
```
GET    /api/tax-categories                    → { success, data: TaxCategory[] }
POST   /api/tax-categories                    → { success, data: TaxCategory }
PUT    /api/tax-categories/:id                → { success, data: TaxCategory }
DELETE /api/tax-categories/:id                → { success }
```

### HSN Codes
```
GET    /api/hsn/search?q=<query>&limit=20     → { success, data: HsnCode[] }
GET    /api/hsn/:code                          → { success, data: HsnCode }
```

### GSTIN
```
POST   /api/gstin/verify    { gstin }          → { success, data: { legalName, stateCode, status, type } }
POST   /api/gstin/validate  { gstin }          → { success, data: { valid, stateCode, checksum } }
```

### E-Invoice
```
POST   /api/einvoice/generate   { documentId }               → { success, data: EInvoice }
POST   /api/einvoice/cancel     { documentId, reason }       → { success, data: EInvoice }
GET    /api/einvoice/:documentId                              → { success, data: EInvoice }
```

### E-Way Bill
```
POST   /api/ewaybill/generate   { documentId, transport }    → { success, data: EWayBill }
POST   /api/ewaybill/cancel     { documentId, reason }       → { success, data: EWayBill }
PUT    /api/ewaybill/update-partb { documentId, vehicle }    → { success, data: EWayBill }
GET    /api/ewaybill/:documentId                              → { success, data: EWayBill }
```

### GST Returns
```
GET    /api/gst/returns/:returnType/:period    → { success, data: GstReturn }
POST   /api/gst/returns/:returnType/:period/export → { success, data: { json, filename } }
PUT    /api/gst/returns/:returnType/:period/status { status } → { success }
```

### Tax Reports
```
GET    /api/reports/tax-summary?from=&to=      → { success, data: { cgst, sgst, igst, cess, total } }
GET    /api/reports/hsn-summary?from=&to=      → { success, data: HsnSummaryRow[] }
GET    /api/reports/tax-ledger?from=&to=       → { success, data: TaxLedgerEntry[] }
```

### Recurring Invoices
```
GET    /api/recurring-invoices                 → { success, data: RecurringInvoice[] }
POST   /api/recurring-invoices                 → { success, data: RecurringInvoice }
PUT    /api/recurring-invoices/:id             → { success, data: RecurringInvoice }
DELETE /api/recurring-invoices/:id             → { success }
POST   /api/recurring-invoices/:id/pause       → { success }
POST   /api/recurring-invoices/:id/resume      → { success }
```

### Credit/Debit Notes
```
// Uses existing Document endpoints with type = CREDIT_NOTE | DEBIT_NOTE
// + originalDocumentId field linking to the source invoice
POST   /api/documents   { type: "CREDIT_NOTE", originalDocumentId, ... }
```

### Multi-Currency (extends existing Document)
```
// Document create/update body adds:
{ foreignCurrency?: string, exchangeRate?: number }
// All paise fields remain in INR
```

---

## 5. UI States (per screen)

### GST Settings Page
- **Loading**: Skeleton for settings form
- **Error**: "Failed to load GST settings" + retry
- **Empty**: First-time setup wizard (GSTIN entry + toggles)
- **Success**: Settings form with current values + toast on save

### Tax Categories Page
- **Loading**: Skeleton list
- **Error**: "Failed to load tax rates" + retry
- **Empty**: "No tax rates yet. Set up GST to auto-create defaults." + "Setup GST" CTA
- **Success**: List of rates with edit/delete, "Add Tax Rate" button

### HSN Search (Bottom Sheet)
- **Loading**: Skeleton rows in search results
- **Error**: "HSN database unavailable" (offline fallback to cached)
- **Empty**: "No results for [query]" + "Enter code manually"
- **Success**: Search results with code + description + default rate

### Invoice with Tax (extends existing)
- Tax breakup section appears between subtotal and grand total
- Place of Supply indicator below party name
- HSN column in line items (collapsible on mobile)

### GSTR-1 / GSTR-3B Report Pages
- **Loading**: Skeleton dashboard cards
- **Error**: "Failed to generate report" + retry
- **Empty**: "No invoices for [period]"
- **Success**: Summary cards + categorized table + "Export JSON" button

### E-Invoice Page (within invoice detail)
- **Loading**: "Generating IRN..." progress
- **Error**: "IRN generation failed: [NIC error]" + retry
- **Empty**: "Generate IRN" button
- **Success**: IRN number + QR code displayed + "Cancel IRN" (if < 24h)

### E-Way Bill Page
- **Loading**: "Generating E-Way Bill..." progress
- **Error**: "E-Way Bill failed: [reason]" + retry
- **Empty**: Transport details form + "Generate" button
- **Success**: EWB number + validity + "Update Vehicle" + "Cancel" (if < 24h)

### Recurring Invoices Page
- **Loading**: Skeleton list
- **Error**: "Failed to load recurring invoices" + retry
- **Empty**: "No recurring invoices. Create one from any saved invoice." + illustration
- **Success**: List with status badges, next run date, pause/resume toggle

---

## 6. Mobile Considerations

- Tax breakup in invoice: collapsible accordion on mobile, inline on desktop
- HSN search: bottom sheet with search, not inline dropdown
- GSTR reports: card-based summary (mobile), table drill-down (desktop)
- E-invoice/E-way bill: single-action buttons, result in bottom sheet
- Place of Supply: auto-filled label, tap to change (bottom sheet state picker)
- Tax column in line items: hidden by default on mobile, show total tax per line as suffix
- All touch targets >= 44px

---

## 7. Edge Cases

1. **No GSTIN on party**: Default to B2C, intra-state (CGST+SGST). User can set Place of Supply manually.
2. **Composition Scheme business**: No tax line items. Title = "Bill of Supply". No e-invoice. No IGST.
3. **Reverse Charge**: Buyer pays tax instead of seller. Invoice marked "Reverse Charge". Tax appears in GSTR-3B differently.
4. **Zero-rated supply**: Tax rate 0% but still appears in GSTR with HSN. Different from "Exempt" and "Non-GST".
5. **Cess items**: Additional cess on top of GST (tobacco 12% + 5% cess). Separate field.
6. **Multi-currency + GST**: Tax always on INR equivalent. Exchange rate locked at invoice date.
7. **Credit note after e-invoice**: Must generate IRN for credit note too. Links to original IRN.
8. **E-way bill expiry**: Notify user before expiry. Allow extension (distance-based validity).
9. **E-invoice cancel > 24h**: Not possible via API. User must file on NIC portal directly. Show message.
10. **GSTIN format change**: Currently 15 chars. Store as string, validate with regex + checksum.
11. **Interstate B2C > Rs 2.5L**: Classified as B2C Large in GSTR-1 (invoice-wise, not aggregated).
12. **TDS deduction by buyer**: Reduce receivable by TDS amount. Track in separate TDS ledger.
13. **Financial year boundary**: Invoices near March 31 must be in correct FY for GSTR.
14. **Offline invoice with tax**: Calculate locally (pure math), sync tax fields with server later.
15. **Rounding**: Per CGST Rules Section 170 — round to nearest rupee per line item. Total may differ from sum of rounded lines.

---

## 8. Constraints

- All amounts in **paise** (integer). Rates in **basis points** (1800 = 18.00%).
- Tax calculation is **pure math** — must work 100% offline.
- E-invoice and E-way bill require **network** — queue if offline, generate on reconnect.
- HSN database **pre-seeded** in IndexedDB (~2MB compressed, ~12K codes).
- GSTIN verification **rate-limited** (government API) — cache results, verify on demand only.
- NIC sandbox API for development. Production API requires separate registration per business.
- No **actual filing** to GSTN — export JSON only. Users file manually on government portal.
- **Backward compatible**: Existing non-GST invoices remain unchanged. Tax fields default to 0.

---

## 9. Security

- **GSTIN storage**: Not PII per se, but verify before trusting (format + API check).
- **NIC API credentials**: Store encrypted, never in frontend. Backend proxy all NIC calls.
- **E-invoice signed data**: Store NIC's digital signature as-is. Never modify signed JSON.
- **Tax calculations**: Server-side verification on save (frontend calculates for UX, server recalculates and validates).
- **Rate limiting**: GSTIN verify endpoint — 10/min per business. E-invoice — 5/min per business.
- **Audit trail**: Every e-invoice generate/cancel logged with userId, timestamp, NIC response.

---

## 10. Out of Scope (Phase 2)

- Actual GSTR filing to GSTN portal (just JSON export)
- Input Tax Credit (ITC) matching/reconciliation → Phase 3
- GST audit/assessment tools → Phase 3
- Multi-branch / multi-GSTIN → Phase 3
- HSN camera scanning → Phase 3
- GSTR-2 auto-generation (deprecated by government)
- Real-time GSTN API integration
- GSTR-9 auto-generation (provide data export only)
- Automated TDS return filing

---

## 11. Build Plan (5 Batches)

### Batch A — Tax Foundation (features #64, #63, #65, #76, #78)
**Depends on:** Existing Document + Product + Party models
1. **Schema migration**: Add tax fields to Business, Party, Product, Document, DocumentLineItem. Create TaxCategory, HsnCode models.
2. **Tax Categories CRUD**: API + frontend page (Settings → Tax Rates)
3. **HSN Database**: Pre-seed migration + search API + IndexedDB cache
4. **GST Invoice Engine**: Modify `document-calc.ts` to include tax calculation. Pure function: `calculateTax(lineItems, placeOfSupply, isComposite, isReverseCharge)`.
5. **Place of Supply**: Auto-determine from GSTIN state codes. Override UI.
6. **GSTIN Verification**: Validate endpoint (local regex + checksum) + Verify endpoint (government API proxy).
7. **Product tax assignment**: Add taxCategoryId + HSN to product form.
8. **Invoice UI changes**: Tax breakup section, HSN column, Place of Supply indicator.

### Batch B — Returns & Notes (features #80, #79, #66, #68, #69, #70)
**Depends on:** Batch A (tax fields on documents)
1. **Credit/Debit Notes**: New document types with originalDocumentId link. Tax mirrors original.
2. **Tax Reports**: Tax summary, HSN-wise summary, tax ledger — all from existing invoice data.
3. **GSTR-1 Export**: Aggregate sales by category (B2B/B2C/CDN/HSN) → JSON in government format.
4. **GSTR-2 Report**: Purchase summary (read-only report, not return).
5. **GSTR-3B Report**: Combined tax liability summary → JSON/PDF export.
6. **GSTR-9 Data Export**: Annual summary → CSV/JSON for CA.

### Batch C — Special Regimes (features #73, #74, #75, #77)
**Depends on:** Batch A (tax engine)
1. **Reverse Charge**: Flag on invoice + different GSTR-3B categorization.
2. **Composition Scheme**: Business-level flag → "Bill of Supply" template, no tax breakup, flat % tracking.
3. **Additional Cess**: Cess fields on TaxCategory + line item calculation.
4. **TDS/TCS**: Deduction tracking on B2B invoices, separate ledger, TDS/TCS report.

### Batch D — E-Compliance (features #71, #72)
**Depends on:** Batch A (tax invoices exist)
1. **E-Invoice (NIC IRP)**: Generate IRN API proxy, store IRN + QR, cancel within 24h. Sandbox first.
2. **E-Way Bill (NIC)**: Generate/cancel/update-partB API proxy. Transport details form.

### Batch E — Non-GST Features (features #81, #82, #67)
**Depends on:** Batch A (extended Document model)
1. **Multi-Currency**: Currency selector + exchange rate on invoice. Tax on INR equivalent.
2. **Recurring Invoices**: Template + scheduler + auto-generate. Dashboard widget.
3. **GSTR-1 Reconciliation**: Compare exported GSTR-1 vs filed (manual entry of filed data).

---

## 12. Acceptance Criteria

- [ ] GST invoice generated with correct CGST+SGST (intra-state) or IGST (inter-state)
- [ ] Tax calculation matches manual calculation by CA (tested with 10 scenarios)
- [ ] Place of Supply auto-determined from GSTIN state codes
- [ ] HSN auto-fill works with search (type "1006" → shows "Rice")
- [ ] GSTIN verified against government API (sandbox)
- [ ] GSTR-1 JSON exported and validated against government JSON schema
- [ ] GSTR-3B summary matches manual calculation
- [ ] E-invoice IRN generated via NIC sandbox API
- [ ] E-invoice QR code renders on invoice PDF
- [ ] E-way bill generated for qualifying transactions (> Rs 50K)
- [ ] Credit note correctly reduces tax liability in GSTR-1
- [ ] Composition Scheme: "Bill of Supply" without tax breakup
- [ ] Reverse Charge: marked correctly in GSTR-3B
- [ ] TDS/TCS deduction tracked and reported
- [ ] Recurring invoices auto-generate on schedule
- [ ] Multi-currency invoice shows dual amounts (foreign + INR)
- [ ] All tax calculations work offline (pure math, no API needed)
- [ ] Existing non-GST invoices unaffected (backward compatible)
- [ ] Mobile: tax breakup readable on 375px, HSN search in bottom sheet
- [ ] 320px: no horizontal scroll, all touch targets >= 44px
