# Phase 6: BillBook User Requests — PRD

> 5 features from BillBook Play Store feature request analysis.
> Competitor research: Vyapar, MyBillBook, BillBook, Zoho Invoice India.
> Priority: Custom Units (P0) → Payment Stamps (P1) → Vehicle/Udyam (P1) → PDF Quality (P1) → Copy Labels (P2)

---

## Feature 1: Custom Units (P0)

### What
Allow businesses to create custom measurement units beyond the 19 predefined ones. Support variable packaging (Box of 6 vs Box of 10), service units (Hours, Trips, Sessions), and industry-specific units. Enable unit conversions between custom and predefined units.

### Why
- **Blocker for wholesalers**: Users selling in Bags, Cans, Drums, Crates can't bill accurately
- **Blocks service businesses**: No Hours, Trips, Days, Sessions for service billing
- **BillBook's #1 complaint**: "Unit list is too rigid"
- **Vyapar gap**: No service units (hours, trips) — inventory-focused only
- **Variable packaging**: Same product sold in "Box of 6" and "Box of 10" — need per-product unit override

### Domain Model

```
Unit (existing model — enhanced)
├── id: string (CUID)
├── businessId: string (FK)
├── name: string (e.g., "Box of 12", "Hours")
├── symbol: string (e.g., "box12", "hr")
├── type: PREDEFINED | CUSTOM
├── category: WEIGHT | VOLUME | COUNT | LENGTH | AREA | SERVICE | PACKAGING | OTHER (NEW)
├── baseUnitId?: string (FK, self-ref — e.g., Box of 12 → pcs)
├── baseUnitFactor?: number (e.g., 12 — 1 box12 = 12 pcs)
├── decimalAllowed: boolean (NEW — true for kg/ltr, false for pcs/box)
├── createdAt, updatedAt
```

### Questionnaire Answers

1. **Trigger**: Settings > Units page OR during product creation (inline "Add Unit" button) OR during invoice line item entry
2. **Flow**: User taps "Add Custom Unit" → enters Name + Symbol + Category → optionally sets base unit conversion → Save → unit available in product forms and invoices
3. **After completion**: Unit appears in all unit dropdowns. If conversion set, auto-converts quantities in invoices
4. **New DB fields**: `category` enum, `baseUnitId` FK, `baseUnitFactor` Float, `decimalAllowed` Boolean on Unit model
5. **API response**: Existing CRUD endpoints enhanced with new fields. No new endpoints needed
6. **Platform**: Mobile-first, works on both
7. **Native behavior**: None required
8. **Offline**: Custom units cached in IndexedDB. Create queued for sync
9. **Button**: "Add Unit" button in unit dropdown (inline) + "Manage Units" in Settings
10. **Success**: Toast "Unit created" + unit auto-selected in dropdown
11. **Error**: "Unit name already exists" / "Symbol already taken"
12. **Confirmation**: None (non-destructive)
13. **Undo**: No (can edit/delete later)
14. **Network fails**: Queued offline, synced on reconnect
15. **Empty**: "No custom units yet. Add your first unit to get started."
16. **Done twice**: Unique constraint prevents duplicate name/symbol per business
17. **NOT in scope**: Bulk unit import, unit group management, GST-specific unit mapping

### User Flow

```
Product Form / Invoice Line Item
  → Unit dropdown shows: [Predefined units] + [Custom units] + [+ Add Unit]
  → Tap "+ Add Unit"
  → Bottom sheet: Name, Symbol, Category (dropdown), Base Unit (optional), Factor (optional)
  → Validate: name unique, symbol unique, factor > 0
  → Save → unit created + auto-selected
  → Convert quantities if base unit conversion exists

Settings > Units (full management)
  → List: all units (predefined + custom) grouped by category
  → Predefined: view-only (cannot edit/delete)
  → Custom: edit name/symbol/conversion, delete (only if 0 products use it)
  → Add unit → same bottom sheet as inline
  → Conversions tab: manage conversion pairs (1 box = 12 pcs, etc.)
```

### API Contract

```
# Existing endpoints — enhanced with new fields
GET    /api/units?search=&category=           → Unit[] (with category, baseUnitId, baseUnitFactor, decimalAllowed)
POST   /api/units                             → Unit (body: { name, symbol, category, baseUnitId?, baseUnitFactor?, decimalAllowed })
PUT    /api/units/:id                         → Unit (CUSTOM only)
DELETE /api/units/:id                         → void (fails if products reference it)

# Existing conversion endpoints — no changes needed
GET    /api/units/conversions                 → UnitConversion[]
POST   /api/units/conversions                 → UnitConversion (auto-creates reverse)
DELETE /api/units/conversions/:id             → void
```

### UI States
- **Loading**: Skeleton list in unit dropdown
- **Error**: "Couldn't load units. Tap to retry."
- **Empty**: "No custom units. Tap + to create one."
- **Success**: Unit list with category headers, custom units highlighted

### Edge Cases
- Delete unit with products → "X products use this unit. Reassign them first."
- Symbol conflict → "Symbol already taken by [Unit Name]"
- Conversion creates cycle → Prevent (A→B→C→A)
- Decimal quantity for non-decimal unit → Round to nearest integer with warning
- Very long unit name → Truncate at 30 chars

### Build Plan

```
1. types:     features/units/unit.types.ts              — UnitCategory enum, enhanced Unit interface
2. constants: features/units/unit.constants.ts           — UNIT_CATEGORIES, category labels/icons
3. utils:     features/units/unit.utils.ts               — validateUnitName, convertQuantity, formatUnitDisplay
4. hook:      features/units/useUnitManager.ts           — CRUD state, validation, offline queue
5. components: features/units/components/
   - AddUnitSheet.tsx          — Bottom sheet for creating custom unit
   - UnitCategoryBadge.tsx     — Category pill badge
   - UnitListItem.tsx          — Single unit row with edit/delete
6. page:      features/units/UnitsPage.tsx               — Full unit management page
7. css:       features/units/units.css                   — Styles
8. Integration:
   - Product form unit dropdown → add "+ Add Unit" option + AddUnitSheet
   - Invoice line item → respect decimalAllowed for quantity input
   - Template column → unit symbol from product's unit
```

### Acceptance Criteria
- [ ] User can create custom unit with name, symbol, category
- [ ] User can set base unit conversion (1 box = 12 pcs)
- [ ] Custom units appear in all unit dropdowns (product form, invoice line item)
- [ ] Inline "Add Unit" in dropdowns opens bottom sheet
- [ ] Cannot delete unit with products referencing it
- [ ] Duplicate name/symbol rejected with clear error
- [ ] Decimal quantities allowed/blocked per unit's `decimalAllowed` flag
- [ ] Settings > Units shows all units grouped by category
- [ ] Works offline (queued for sync)

---

## Feature 2: Payment Status Stamps on Invoice PDF (P1)

### What
Show a clear visual stamp/watermark on generated invoice PDFs indicating payment status: "PAID", "UNPAID", "PARTIAL", "CASH", "CREDIT", or "ADVANCE". Auto-updates based on payment records. Toggleable per template.

### Why
- **Only Zoho does this** — Vyapar and MyBillBook don't. Major differentiator
- **Indian businesses physically rubber-stamp "PAID"** on printed invoices — digital equivalent missing
- **WhatsApp-shared PDFs** can't show payment status without this — recipients don't know if paid
- **Reduces confusion** for both seller and buyer about outstanding amounts

### Domain Model

```
TemplateFieldsConfig (existing — add 1 field)
├── paymentStatusStamp: boolean (NEW — default true)

PrintSettings (existing — add 1 field)
├── stampStyle: 'watermark' | 'badge' | 'none' (NEW — default 'badge')
```

### Questionnaire Answers

1. **Trigger**: Automatic — stamp appears on PDF/print based on document's payment status
2. **Flow**: Invoice is PAID → PDF shows green "PAID" stamp. PARTIAL → orange "PARTIAL" stamp. UNPAID → red "UNPAID". User can toggle off in template settings
3. **After completion**: Every generated PDF/print/image export includes the stamp
4. **New DB fields**: None — payment status already derived from `paidAmount` vs `grandTotal`. Template config gets `paymentStatusStamp` boolean
5. **API response**: No changes — status derived client-side
6. **Platform**: Both (PDF + print + image export)
7. **Native behavior**: None
8. **Offline**: Works offline — status from local data
9. **Button**: Toggle in Template Editor > Fields tab > "Payment Status Stamp"
10. **Success**: Stamp visible immediately in template preview
11. **Error**: N/A (derived from existing data)
12. **Confirmation**: None
13. **Undo**: Toggle off in template settings
14. **Network fails**: N/A
15. **Empty**: N/A
16. **Done twice**: N/A (idempotent display)
17. **NOT in scope**: Custom stamp text, stamp image upload, stamp position customization (v1 is fixed position)

### Stamp Variants

| Payment Status | Stamp Text | Color | Condition |
|---------------|-----------|-------|-----------|
| PAID | PAID | Green (#16A34A) | paidAmount >= grandTotal |
| PARTIAL | PARTIAL | Orange (#EA580C) | 0 < paidAmount < grandTotal |
| UNPAID | UNPAID | Red (#DC2626) | paidAmount === 0, status !== DRAFT |
| ADVANCE | ADVANCE | Blue (#2563EB) | paidAmount > 0, no invoice (standalone payment) |
| DRAFT | — | No stamp | status === DRAFT |

### Stamp Styles

1. **Badge** (default): Rotated -15deg, bordered rectangle, semi-transparent, top-right of invoice. Like a rubber stamp effect.
2. **Watermark**: Large diagonal text across the invoice body, very low opacity (0.08). Professional feel.

### User Flow

```
Template Editor > Fields tab
  → New toggle: "Payment Status Stamp" (default ON)
  → If ON → stamp auto-renders on preview

Template Editor > Print tab
  → New control: "Stamp Style" → Badge | Watermark | None
  → Preview updates live

Invoice Detail > Share/Print/Export
  → PDF includes stamp based on current payment status
  → If payment recorded later → stamp updates on next PDF generation
```

### Build Plan

```
1. types:     Add PaymentStampStyle to template-layout.types.ts
2. constants: Add STAMP_COLORS, STAMP_LABELS to template.constants.ts
3. config:    Add paymentStatusStamp to TemplateFieldsConfig, stampStyle to PrintSettings
4. defaults:  Update template.defaults.ts — paymentStatusStamp: true, stampStyle: 'badge'
5. components:
   - templates/components/PaymentStamp.tsx    — renders stamp overlay (badge or watermark)
   - Update FieldsTab.tsx                     — add toggle row
   - Update PrintTab.tsx                      — add stamp style selector
6. preview:   Update PreviewTotalsSummary.tsx or create PreviewStamp.tsx — show in preview
7. css:       Add stamp styles to template CSS (rotation, opacity, colors)
```

### Acceptance Criteria
- [ ] PAID stamp (green) shows when fully paid
- [ ] PARTIAL stamp (orange) shows when partially paid
- [ ] UNPAID stamp (red) shows when no payment recorded
- [ ] Stamp visible in template preview, PDF export, print, and image export
- [ ] Toggleable in template Fields tab
- [ ] Two styles: badge (rotated box) and watermark (diagonal text)
- [ ] No stamp on DRAFT invoices
- [ ] Stamp updates automatically when payment status changes

---

## Feature 3: Vehicle Number, Udyam Aadhar & Total Qty on Invoice (P1)

### What
1. **Vehicle Number**: First-class field on ALL invoice types (not just Delivery Challan), visible in form and PDF
2. **Udyam Aadhar**: MSME registration number field (UAM-XX-XX-XXXXXXX format, 19 chars) on Business profile, displayed on invoices for Section 43B(h) compliance
3. **Total Quantity**: Summary row in line items showing total qty across all items

### Why
- **Vehicle Number**: Transport/logistics businesses need this on every invoice, not buried in E-Way Bill settings. Vyapar only shows it via E-Way Bill toggle
- **Udyam Aadhar**: Section 43B(h) Finance Act 2023 — buyers must pay registered MSMEs within 15/45 days or lose tax deduction. Displaying Udyam on invoices enforces this right. Only Zoho has a dedicated field
- **Total Quantity**: Common request — wholesalers shipping 50 line items want a quick "Total: 1,250 pcs" summary

### Domain Model

```
Business (existing model — add field)
├── udyamNumber: String? (NEW — format: UAM-XX-XX-XXXXXXX or UDYAM-XX-XX-XXXXXXX)

Document (existing model — vehicleNumber already exists)
├── vehicleNumber: String? (EXISTING — just expose in UI for all doc types)

TemplateFieldsConfig (existing — add fields)
├── udyamNumber: boolean (NEW — default false)
├── totalQuantity: boolean (NEW — default true)
```

### Questionnaire Answers

1. **Trigger**: Vehicle Number → during invoice creation (Details tab). Udyam → one-time in Business Settings. Total Qty → auto-calculated from line items
2. **Flow**:
   - Vehicle: User enters vehicle number in invoice Details tab → shows on PDF if template field enabled
   - Udyam: User enters in Settings > Business > "Udyam Registration Number" → auto-displayed on all invoices if template field enabled
   - Total Qty: Auto-sum of all line item quantities → shown as summary row below items table
3. **After completion**: Fields appear on PDF based on template toggle settings
4. **New DB fields**: `udyamNumber` on Business model. `vehicleNumber` already exists on Document. No new model
5. **API response**: Business profile response includes `udyamNumber`. Document response already has `vehicleNumber`
6. **Platform**: Both
7. **Native behavior**: None
8. **Offline**: All local — no API dependency
9. **Buttons**: Vehicle Number input in invoice Details tab. Udyam in Settings > Business Profile
10. **Success**: Fields visible on invoice preview immediately
11. **Error**: "Invalid Udyam format. Expected: UDYAM-XX-XX-XXXXXXX" / Vehicle number validation: alphanumeric + hyphens only
12. **Confirmation**: None
13. **Undo**: Clear the field
14. **Network fails**: Works offline
15. **Empty**: Fields hidden when empty (no blank space)
16. **Done twice**: Udyam saved once in business profile, reused on all invoices
17. **NOT in scope**: Udyam verification API (no government API available for free), driver name/transport notes on all doc types (keep as Challan-only)

### Udyam Number Format
- Old format: `UAM-XX-XX-XXXXXXX` (19 chars)
- New format: `UDYAM-XX-XX-XXXXXXX` (21 chars)
- Both valid. Regex: `/^(UAM|UDYAM)-[A-Z]{2}-\d{2}-\d{7}$/`
- XX = State code (2 letters), XX = District code (2 digits), XXXXXXX = 7-digit serial

### User Flow

```
Invoice Creation > Details tab
  → Vehicle Number input (text, alphanumeric + hyphen)
  → Shows for ALL document types (not just Challan)

Settings > Business Profile
  → New field: "Udyam Registration Number"
  → Validation on blur (format check)
  → Saved to business profile
  → Auto-appears on invoices when template toggle is ON

Template Editor > Fields tab > Document Details section
  → "Vehicle Number" toggle (EXISTING — already there)
  → "Udyam Number" toggle (NEW)

Template Editor > Fields tab > Footer section (or new "Summary" section)
  → "Total Quantity" toggle (NEW — default ON)

Invoice Preview / PDF
  → Vehicle Number in document metadata block (near invoice date)
  → Udyam Number in business info block (near GSTIN/PAN)
  → Total Quantity as summary row below line items: "Total Quantity: 1,250 pcs"
```

### Build Plan

```
1. types:     Add udyamNumber to Business type. Add totalQuantity to TemplateFieldsConfig
2. constants: Add UDYAM_REGEX, VEHICLE_NUMBER_REGEX to validation constants
3. utils:     validateUdyamNumber(), formatTotalQuantity() in invoice utils
4. UI changes:
   - InvoiceDetailsSection.tsx → add Vehicle Number input for ALL doc types
   - Business settings page → add Udyam Registration Number field
   - FieldsTab.tsx → add "Udyam Number" and "Total Quantity" toggles
   - PreviewLineItems.tsx → add total quantity summary row
   - PreviewInvoiceHeader.tsx → show Udyam in business info block
5. css:       Minimal — reuse existing input/field styles
```

### Acceptance Criteria
- [ ] Vehicle Number input visible in invoice Details tab for ALL document types
- [ ] Udyam Number field in Business Settings with format validation
- [ ] Udyam displayed on invoice PDF in business info section (near GSTIN)
- [ ] Total Quantity summary row below line items table
- [ ] All 3 fields toggleable in template Fields tab
- [ ] Udyam validation: UAM-XX-XX-XXXXXXX or UDYAM-XX-XX-XXXXXXX format
- [ ] Vehicle number: alphanumeric + hyphens, max 15 chars
- [ ] Fields hidden when empty (no blank space on PDF)

---

## Feature 4: PDF Quality Enhancement (P1)

### What
Improve the visual quality of generated invoice PDFs: larger default font sizes, sharper logo/stamp/signature rendering, better image resolution on export, and configurable font size granularity.

### Why
- **BillBook's #2 complaint**: "Font size too small to read when printed"
- **MyBillBook complaint**: "Poor thermal print template customization"
- **Logo quality**: Uploaded logos appear faded/blurry on PDF export
- **Signature/stamp quality**: Uploaded signatures rendered at low resolution
- **Professional image**: PDF quality directly impacts the business owner's brand perception

### Changes (no new models — config/rendering improvements)

```
TemplateTypographyConfig (existing — enhanced)
├── fontSize: 'xs' | 'small' | 'medium' | 'large' | 'xl' (was 3 sizes, now 5)
├── headerFontSize: 'xs' | 'small' | 'medium' | 'large' | 'xl'
├── lineHeight: 'compact' | 'normal' | 'relaxed' (NEW)

useImageExport hook (existing — enhanced)
├── pixelRatio: 3 (was 2 — sharper on high-DPI)
├── quality: 1 (already 1)

Template preview CSS
├── Larger base font sizes for 'medium' and 'large' scales
├── Better image rendering: image-rendering: -webkit-optimize-contrast
```

### Questionnaire Answers

1. **Trigger**: Automatic (better defaults) + user-adjustable in template Style tab
2. **Flow**: User opens Template Editor > Style tab > adjusts Font Size (5 options instead of 3) + Line Height (3 options). Preview updates live. Exported PDFs use higher pixelRatio
3. **After completion**: All new PDFs generated at higher quality
4. **New DB fields**: None — `lineHeight` added to TemplateTypographyConfig (JSON blob in template)
5. **API**: No changes
6. **Platform**: Both
7. **Native**: None
8. **Offline**: Works offline
9. **Button**: Style tab in template editor
10. **Success**: Visibly sharper preview + PDF
11. **Error**: N/A
12. **Confirmation**: None
13. **Undo**: Change font size back
14. **Network**: N/A
15. **Empty**: N/A
16. **Done twice**: Idempotent
17. **NOT in scope**: Custom font upload, print DPI settings, thermal-specific font sizing (separate feature)

### Font Size Scale (in rem)

| Scale | Body | Table | Header | Subheader | Label |
|-------|------|-------|--------|-----------|-------|
| xs | 0.625rem | 0.5625rem | 0.875rem | 0.75rem | 0.5rem |
| small | 0.75rem | 0.6875rem | 1rem | 0.875rem | 0.625rem |
| **medium** | **0.875rem** | **0.8125rem** | **1.25rem** | **1rem** | **0.75rem** |
| large | 1rem | 0.9375rem | 1.5rem | 1.125rem | 0.875rem |
| xl | 1.125rem | 1rem | 1.75rem | 1.25rem | 1rem |

### Image Quality Improvements

1. **pixelRatio 2→3** in html-to-image export — 50% sharper on retina
2. **image-rendering: -webkit-optimize-contrast** on logo/signature images
3. **Logo maxHeight increase**: Allow up to 120px (was 100px cap)
4. **Signature rendering**: Ensure uploaded signature images are rendered at 2x resolution minimum

### Build Plan

```
1. types:     Add 'xs' | 'xl' to TemplateFontSize. Add TemplateLineHeight type
2. constants: Update FONT_SIZE_LABELS, add LINE_HEIGHT_LABELS
3. defaults:  Update default typography config with 'medium' + 'normal' lineHeight
4. components:
   - Update StyleTab.tsx → 5-option font size selector + line height selector
   - Update template preview CSS → new font size scale variables
5. hooks:     Update useImageExport.ts → pixelRatio: 3
6. css:       Add CSS custom properties for font scale + image rendering improvements
```

### Acceptance Criteria
- [ ] 5 font size options (xs/small/medium/large/xl) in template Style tab
- [ ] 3 line height options (compact/normal/relaxed) in template Style tab
- [ ] Preview updates live when changing font size or line height
- [ ] Exported images use pixelRatio 3 (sharper)
- [ ] Logo images render with optimize-contrast
- [ ] Medium font size is readable at arm's length when printed A4
- [ ] Thermal templates use appropriate font sizes (not affected by A4 scale)

---

## Feature 5: Duplicate Bill Copy Labels (P2)

### What
Auto-generate "ORIGINAL", "DUPLICATE", or "TRIPLICATE" copy labels on printed invoices. First print = Original. Reprint = Duplicate. Configurable in print settings.

### Why
- **Standard Indian accounting practice**: Invoices traditionally printed in triplicate (Original for Buyer, Duplicate for Transporter, Triplicate for Assessee/Seller)
- **Neither Vyapar nor MyBillBook has this** — unique feature
- **BUSY and Marg (desktop apps) have it** — expected by businesses migrating from desktop
- **E-Way Bill compliance**: "Duplicate for Transporter" is carried with goods during transit
- **Audit trail**: Distinguishes originals from reprints

### Domain Model

```
PrintSettings (existing — add fields)
├── copyLabels: boolean (NEW — default false)
├── copyLabelStyle: 'auto' | 'manual' (NEW)
├── copyLabelNames: string[] (NEW — default: ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'])

Document (existing — add tracking field)
├── printCount: number (NEW — default 0, incremented on each print/PDF generation)
```

### Questionnaire Answers

1. **Trigger**: When printing or exporting PDF — label auto-applied based on print count
2. **Flow**:
   - Auto mode: First print → "ORIGINAL". Second print → "DUPLICATE". Third → "TRIPLICATE". Subsequent → "COPY [N]"
   - Manual mode: User selects which copy to print from a dropdown before printing
   - Multi-copy: If copies=3, prints Original + Duplicate + Triplicate in one job
3. **After completion**: Each page has copy label in top-right corner
4. **New DB fields**: `printCount` on Document model (integer, tracks how many times printed/exported)
5. **API**: PATCH /api/documents/:id/print-count (increment on print)
6. **Platform**: Both
7. **Native**: Print dialog integration
8. **Offline**: printCount tracked locally, synced later
9. **Button**: Toggle in Template Editor > Print tab: "Copy Labels"
10. **Success**: Label visible on each printed page
11. **Error**: N/A
12. **Confirmation**: None
13. **Undo**: N/A (printing is irreversible)
14. **Network**: printCount queued for sync
15. **Empty**: No label if disabled
16. **Done twice**: printCount increments — second print correctly labeled "DUPLICATE"
17. **NOT in scope**: Custom label text per copy, copy-specific content differences, watermark on copies

### Copy Label Mapping

| Print # | Auto Label | Position |
|---------|-----------|----------|
| 1 | ORIGINAL | Top-right, small caps |
| 2 | DUPLICATE | Top-right, small caps |
| 3 | TRIPLICATE | Top-right, small caps |
| 4+ | COPY 4, COPY 5... | Top-right, small caps |

When `copies > 1` in print settings:
- Copy 1 of batch → ORIGINAL
- Copy 2 of batch → DUPLICATE
- Copy 3 of batch → TRIPLICATE

### User Flow

```
Template Editor > Print tab
  → New toggle: "Copy Labels" (default OFF)
  → If ON → new control: "Label Mode" → Auto | Manual
  → Auto: labels auto-assigned based on print count
  → Manual: dropdown before print to select label

Invoice Detail > Print/Export
  → If copyLabels ON:
    → Auto mode: check document.printCount → assign label → increment count
    → Manual mode: show bottom sheet with label options → user picks → print
  → Label rendered top-right of first page, small caps, subtle border
```

### Build Plan

```
1. types:     Add CopyLabelStyle to template-layout.types.ts. Add printCount to Document type
2. constants: Add DEFAULT_COPY_LABELS, COPY_LABEL_STYLE_OPTIONS
3. config:    Add copyLabels, copyLabelStyle, copyLabelNames to PrintSettings
4. defaults:  Update print settings defaults
5. components:
   - templates/components/CopyLabel.tsx         — renders the label overlay
   - Update PrintTab.tsx                        — add toggle + style selector
   - CopyLabelPicker.tsx                        — bottom sheet for manual mode
6. preview:   Show label in template preview
7. integration: Invoice detail page → increment printCount on print/export
8. css:       Copy label styles (positioned, small caps, border)
```

### Acceptance Criteria
- [ ] Copy labels toggle in Template Editor > Print tab
- [ ] Auto mode: first print = ORIGINAL, second = DUPLICATE, third = TRIPLICATE
- [ ] Manual mode: user picks label before printing
- [ ] Multi-copy prints label each copy differently (Original + Duplicate + Triplicate)
- [ ] Label positioned top-right, small caps, subtle
- [ ] printCount tracked per document and incremented on print/export
- [ ] Works on PDF export, image export, and browser print
- [ ] Label visible in template preview

---

## Build Order (recommended)

```
Phase 6A — Template System (features 2, 3, 4, 5 share template infrastructure)
  1. Payment Status Stamps (new component + 2 toggles)
  2. Vehicle/Udyam/Total Qty (3 new toggle fields + business settings field)
  3. PDF Quality (font scale expansion + image quality)
  4. Copy Labels (print tracking + label component)

Phase 6B — Units (independent feature)
  5. Custom Units (full feature: types → constants → utils → hook → page → integration)
```

Template features (2-5) can be built as a single batch since they all modify:
- `template-config.types.ts` (TemplateFieldsConfig, PrintSettings)
- `template.defaults.ts` (new defaults)
- `template.labels.ts` (new labels)
- `FieldsTab.tsx` and `PrintTab.tsx` (new toggles)
- Preview components (new renderers)

Custom Units (1) is independent and can be built in parallel.

---

## Security Considerations
- Udyam number is PII — encrypt at rest, don't log
- Vehicle number — sanitize input (alphanumeric + hyphens only)
- printCount — server-side increment only (prevent client manipulation)
- Custom unit names — sanitize for XSS (no HTML/script in unit names)

## Performance Considerations
- pixelRatio 3 increases export time ~50% — show progress indicator
- Custom units list: paginate if > 100 units (unlikely but defensive)
- Font size changes: CSS variables, no re-render of entire template
- Payment stamp: pure CSS overlay, zero performance impact

## Out of Scope (all features)
- Custom stamp images (upload your own stamp)
- GST-specific unit codes (UQC mapping)
- Udyam verification API (no free government API)
- Custom font upload
- Print DPI control
- Copy-specific content (different content per copy)
- Stamp position customization (v1 is fixed)
