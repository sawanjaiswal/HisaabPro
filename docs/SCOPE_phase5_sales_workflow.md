# SCOPE — Phase 5 Epic B: Sales Workflow
## Features #133 BOGO/Free-item Lines · #134 Invoice Custom Fields · #122 Sales Pipeline UI · #132 Multiple Price Lists

**Status:** DRAFT — 2026-05-13
**Author:** Sawan Jaiswal
**Personas:** Raju (micro retailer), Priya (growing wholesaler), Amit (multi-location distributor)

---

## Summary

Phase 5 Epic B completes the B2B sales workflow for HisaabPro: four sequentially shippable PRs that add promotional free-item lines to invoices, attach custom metadata fields to all sales documents, expose estimates/sale-orders/delivery-challans as first-class list+detail+create pages with one-tap conversion between them, and introduce named price lists that auto-populate line-item rates based on party assignment. All four PRs reuse the existing polymorphic `Document` model and the existing notification/offline infrastructure — no new provider or backend infrastructure is introduced.

---

## Goals

- Priya can create an estimate, convert it to a sale order, and then to a tax invoice, all in under 3 minutes, from her phone.
- Amit can assign "North Zone Wholesale" price list to a party so that every new invoice auto-fills the correct rates — zero manual rate entry.
- Raju can mark a festival bonus item as FREE on an invoice so the printout shows "FREE" and the totals are correct, without needing to remember to set rate = 0.
- Any business can add "PO Number" or "Transport Mode" as a custom field on invoices and have it appear on the printout.

---

## What & Why (Indian MSME Context)

**BOGO / free-item lines** are a staple of Indian festival sales (Diwali, Holi). A wholesaler gives "buy 12 get 2 free" — the free qty must appear on the invoice for the buyer's records and for GST compliance (free supplies are taxable at MRP in certain categories), but the line must zero its revenue contribution to the seller's books.

**Invoice custom fields** are required for B2B procurement: buyers demand fields like PO Number, Dispatch Mode, Transporter Name, and LR Number on every invoice. Vyapar and Tally let businesses define these; HisaabPro must match them to win enterprise conversion.

**Sales pipeline UI** (estimates → sale orders → delivery challans → invoices) is the standard B2B flow for wholesale and distributor businesses. Without first-class pages for each document type, users manually recreate data across documents, leading to errors and customer complaints.

**Multiple price lists** are essential for distributors with tiered pricing: retail, semi-wholesale, wholesale, and regional variants. Maintaining a single "sale price" on a product breaks down at 5+ party segments. The feature brings HisaabPro to parity with ERP systems used by Amit-tier businesses.

---

## Personas

| Persona | PR1 BOGO | PR2 Custom Fields | PR3 Sales Pipeline | PR4 Price Lists |
|---------|----------|-------------------|-------------------|-----------------|
| Raju (micro retailer, Rs 1-5L/month) | Festival "buy X get Y free" on counter invoices | Occasional PO number for GST buyer | Rarely uses estimates; may use for quotations | Single price list (default product price) |
| Priya (wholesaler, Rs 5-25L/month, 2-5 staff) | Scheme invoicing for distributors | Mandatory: PO No, Transport, LR No on every invoice | Core workflow: estimate → order → invoice daily | 2-3 price lists (retail, semi-wholesale, wholesale) |
| Amit (distributor, Rs 25L-2Cr/month, 5-20 staff) | Promotional free goods with scheme tracking | Complex fields: region code, scheme name, batch ref | Estimate approval workflow with team; challan + invoice pair | 5-10 price lists by region and customer tier |

---

## Build Sequence & PR Map

| PR | Feature | Estimated effort | Dependencies |
|----|---------|-----------------|--------------|
| PR1 — #133 | BOGO / free-item lines | 1-2 days | None (pure additive) |
| PR2 — #134 | Invoice custom fields | 3-4 days | PR1 optional (can ship independently) |
| PR3 — #122 | Sales pipeline UI | 1 week | PR1+PR2 desirable but not blocking |
| PR4 — #132 | Multiple price lists | 1-2 weeks | PR3 desirable (pipeline pages benefit from correct rates) |

---

## Pre-PR Mandatory Splits (LOC ratchet)

Before ANY of these PRs touches the files below, they must be split. The `scripts/enforce.js` ratchet blocks commits that exceed 250 LOC.

### `src/features/invoices/components/LineItemEditor.tsx` — currently 242 LOC

Split plan (must complete before PR1 branch opens):
```
LineItemEditor.tsx               # orchestrator, max 80 LOC after split
LineItemRow.tsx                  # quantity / rate / discount / total row cells
LineItemTaxSection.tsx           # GST: taxCategory, HSN, CGST/SGST/IGST cells
LineItemFreeToggle.tsx           # "Mark as free" chip + strikethrough badge (PR1 adds this)
line-item-editor.css             # already exists — no change
```

### `src/App.tsx` — currently 244 LOC

PR3 adds ~12 route declarations (estimates, sale-orders, delivery-challans: list + new + detail + edit = 4 each × 3 types). Split before PR3:
```
src/router/routes.tsx            # all <Route> declarations
src/router/AppRouter.tsx         # <Routes> wrapper with layout guards
src/App.tsx                      # providers only (< 60 LOC after split)
```

---

## PR1 — #133: BOGO / Free-Item Lines

### Summary

Add `isFreeItem` flag to `DocumentLineItem`. When toggled, the calc helpers zero all monetary fields for that line while preserving quantity. Frontend shows a "FREE" badge and strikethrough rate.

### User Flow

**Flow 1 — Mark a line as free on a new invoice**

```
Given: user is on InvoiceCreatePage, has added 3 line items
When: user taps "..." (overflow) on a line item row
Then: bottom sheet shows "Mark as free item" option

When: user taps "Mark as free item"
Then:
  - rate cell shows strikethrough "₹120" + green "FREE" badge
  - taxableValue, cgstAmount, sgstAmount, igstAmount, cessAmount = 0 for that line
  - quantity remains editable
  - subtotal row updates immediately
  - grand total updates immediately

When: user taps "Save Invoice"
Then: server persists line with isFreeItem=true, rate=0, all tax amounts=0
```

**Flow 2 — Unmark a free item**

```
Given: user is editing an invoice with a free-item line
When: user taps "..." on the free line → "Unmark as free"
Then: rate reverts to product's salePrice (re-fetched from product)
      tax fields recalculate using the product's taxCategory
```

**Flow 3 — Invoice printout**

```
Given: invoice has 2 paid lines + 1 free line
When: user taps Print / Share PDF
Then: PDF shows all 3 lines
      free line: quantity shown, rate column shows "FREE" (not ₹0)
      subtotal excludes the free line's value
      GST table excludes the free line
```

**Error paths**

| Scenario | Handling |
|----------|----------|
| User marks ALL lines as free | UI allows it; server saves; grand total = 0; toast "Invoice total is ₹0 — all items are free" (info, not blocking) |
| Free line on a PURCHASE document type | isFreeItem field exists but free-toggle is hidden in UI (purchase flow not in scope) |
| Offline save with free item | Mutation queued normally; optimistic UI shows FREE badge immediately |

### Data Model — PR1

```prisma
// Add to DocumentLineItem (migration: ALTER TABLE ... ADD COLUMN)
isFreeItem Boolean @default(false)
```

No other schema changes. No new models.

Migration column default ensures all existing rows read `false` — backward compatible.

### API Contract — PR1

The existing `POST /api/documents` and `PUT /api/documents/:id` endpoints accept line item arrays. Extend the line item schema to accept `isFreeItem: boolean` (default false).

```ts
// LineItemInput (extension — existing fields omitted for brevity)
interface LineItemInput {
  // ... existing fields ...
  isFreeItem?: boolean   // default false
}

// LineItemResponse (extension)
interface LineItemResponse {
  // ... existing fields ...
  isFreeItem: boolean
}
```

**Calc helper behaviour** (in `server/src/services/document/`):

```ts
// When isFreeItem === true, zero all monetary fields:
if (item.isFreeItem) {
  rate           = 0
  discountValue  = 0
  discountAmount = 0
  lineTotal      = 0
  taxableValue   = 0
  cgstAmount     = 0
  sgstAmount     = 0
  igstAmount     = 0
  cessAmount     = 0
  profit         = 0
  profitPercent  = 0
  // quantity and productId preserved as-is
}
```

The quantity is NOT zeroed — it participates in stock deduction so inventory remains accurate.

### UI States — PR1

**LineItemEditor (free toggle)**
- Default: no "FREE" badge, rate field is editable
- Free state: rate cell shows `~~₹{rate}~~ FREE` (strikethrough + green chip), rate field disabled
- Saving: spinner on save button, row non-interactive
- Error saving: toast "Could not save invoice. Tap to retry."

**Invoice totals section**
- Shows "Scheme discount" line if any free item exists: `- ₹{sum of zeroed values}` (informational only)
- Grand total is correct regardless

### UX Copy — PR1

| Element | Text |
|---------|------|
| Overflow option to free | "Mark as free item" |
| Overflow option to unmark | "Remove free status" |
| FREE badge on line | "FREE" |
| Info toast when all lines free | "All items are free — invoice total is ₹0" |
| PDF rate column for free line | "FREE" |

### Edge Cases — PR1

| Scenario | Handling |
|----------|----------|
| Convert a document with free items (e.g. ESTIMATE → INVOICE) | `convertDocument` copies `isFreeItem=true`; calc re-runs on the target document type |
| Recurring invoice template with free line | Free line persists in recurring definition; generated copies also have `isFreeItem=true` |
| Free item + batch tracking | Batch deduction still occurs at full quantity |
| Tax-inclusive invoice with free line | `isFreeItem=true` zeros the entire line including embedded tax |
| Credit note for a free-line invoice | Free lines appear on credit note with isFreeItem=true; no refund value generated |

### Out of Scope — PR1

- Purchase-side free goods (vendor schemes)
- Free items that generate separate GST liability at MRP (Phase 6 GST edge cases)
- "Scheme" report showing free goods history
- Automatic BOGO rules (e.g. "buy 6 get 1 free" auto-triggered — Phase 6)

---

## PR2 — #134: Invoice Custom Fields

### Summary

Extend the existing `CustomFieldDefinition` model to support sales document types (INVOICE, ESTIMATE, SALE_ORDER, DELIVERY_CHALLAN). Add `DocumentCustomFieldValue` model to store per-document values. Add a custom-fields section to invoice/estimate/order/challan forms and a settings UI to define fields.

### User Flow

**Flow 1 — Admin defines a new invoice custom field**

```
Given: user is in Settings → Documents → Custom Fields
When: user taps "Add Field"
Then: drawer opens with:
  - Field name (text)
  - Field type (TEXT / NUMBER / DATE / DROPDOWN)
  - Options (if DROPDOWN — tag input)
  - Required toggle
  - Applies to (multi-select: Invoice, Estimate, Sale Order, Delivery Challan)
  - Show on printout toggle

When: user taps "Save"
Then: field is created; appears in the custom-fields section of selected document forms
      Toast: "Custom field saved."
```

**Flow 2 — User fills custom fields on an invoice**

```
Given: business has defined custom fields: "PO Number" (TEXT, required), "Transport Mode" (DROPDOWN)
When: user is on InvoiceCreatePage
Then: below the "Notes" section, a "Additional Details" section appears
      "PO Number" shows a text input (required, red asterisk)
      "Transport Mode" shows a dropdown

When: user saves invoice without filling "PO Number"
Then: validation error inline: "PO Number is required"
      Save blocked

When: user fills all required fields and saves
Then: DocumentCustomFieldValue rows created atomically with the document
      Custom fields appear on PDF printout if "Show on printout" is enabled
```

**Flow 3 — Edit custom field values on an existing document**

```
Given: invoice already saved with custom field values
When: user opens invoice edit page
Then: custom fields section shows saved values pre-populated

When: user changes a value and saves
Then: DocumentCustomFieldValue rows upserted (not duplicated)
```

**Error paths**

| Scenario | Handling |
|----------|----------|
| Required field left blank | Inline validation error; save blocked client-side + server-side 400 |
| Field definition deleted after values were set | Orphaned values soft-deleted; form no longer shows the deleted field |
| DROPDOWN value removed from options after entry | Existing value shows as "(removed option)" in read view; edit form shows plain text |
| Offline save with custom field values | Mutation queued; custom field values included in the queued body |

### Data Model — PR2

**Extend existing `CustomFieldDefinition`:**

```prisma
// Add to CustomFieldDefinition model:
documentTypes String[] @default([])
// Values: "INVOICE", "ESTIMATE", "SALE_ORDER", "DELIVERY_CHALLAN"
// When empty, field applies to entityType only (backward compat for PARTY/PRODUCT fields)
// entityType column remains; for new document-targeted fields, set entityType = "DOCUMENT"
```

**New model:**

```prisma
model DocumentCustomFieldValue {
  id           String   @id @default(cuid())
  documentId   String
  fieldDefId   String
  businessId   String
  valueJson    Json     // string, number, date ISO string, or selected option string
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  document Document              @relation(fields: [documentId], references: [id], onDelete: Cascade)
  fieldDef CustomFieldDefinition @relation(fields: [fieldDefId], references: [id], onDelete: Restrict)

  @@unique([documentId, fieldDefId])
  @@index([documentId])
  @@index([businessId, fieldDefId])
  @@index([fieldDefId])
}
```

**Relation additions:**

```prisma
// CustomFieldDefinition — add:
documentValues DocumentCustomFieldValue[]

// Document — add:
customFieldValues DocumentCustomFieldValue[]

// Business — add:
documentCustomFieldValues DocumentCustomFieldValue[]
```

### API Contract — PR2

**Custom field definitions (extend existing `/api/custom-fields`):**

```ts
// Extend CreateCustomFieldInput:
interface CreateCustomFieldInput {
  name: string
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN'
  options?: string[]
  required?: boolean
  showOnInvoice?: boolean
  entityType: 'PARTY' | 'PRODUCT' | 'DOCUMENT'
  documentTypes?: Array<'INVOICE' | 'ESTIMATE' | 'SALE_ORDER' | 'DELIVERY_CHALLAN'>
  sortOrder?: number
}
```

GET `/api/custom-fields?entityType=DOCUMENT&documentType=INVOICE` — returns fields with INVOICE in `documentTypes`.

**Document custom field values (new nested resource):**

```
GET    /api/documents/:id/custom-fields         list values for a document
PUT    /api/documents/:id/custom-fields         upsert all values atomically (array)
```

```ts
// PUT /api/documents/:id/custom-fields request
interface UpsertDocumentCustomFieldsReq {
  values: Array<{
    fieldDefId: string
    valueJson: string | number | null   // serialised per fieldType
  }>
}

// Response
interface DocumentCustomFieldsRes {
  values: Array<{
    fieldDefId: string
    name: string
    fieldType: string
    valueJson: unknown
  }>
}
```

Document create/update (`POST /api/documents`, `PUT /api/documents/:id`) accepts optional `customFieldValues` array in body. Server persists values atomically inside the transaction:

```ts
// Document create/update body extension:
interface DocumentBodyExtension {
  customFieldValues?: Array<{ fieldDefId: string; valueJson: unknown }>
}
```

**Error shapes:**

```ts
// Required field missing
{ success: false, error: { code: 'CUSTOM_FIELD_REQUIRED', message: 'PO Number is required', fieldDefId: string } }
// Invalid value type
{ success: false, error: { code: 'CUSTOM_FIELD_INVALID_VALUE', message: '...', fieldDefId: string } }
```

### UI States — PR2

**Settings → Custom Fields page (documents tab)**
- Loading: skeleton rows
- Empty: "No custom fields for documents yet." + "Add Field" CTA
- Error: "Could not load custom fields. Tap to retry."
- Populated: list of fields with name, type badge, document type chips, required indicator, edit/delete

**Custom fields section in document forms**
- No fields defined: section hidden entirely (no empty state shown in form)
- Fields present: "Additional Details" collapsible section below Notes
- Required field, unfilled: red border + "This field is required" below input
- DROPDOWN: native bottom-sheet picker on mobile
- Saving: all inputs disabled during save

### UX Copy — PR2

| Element | Text |
|---------|------|
| Settings section label | "Document Custom Fields" |
| Form section header | "Additional Details" |
| Add field button | "Add Field" |
| Save field button | "Save Field" |
| Required field indicator | red asterisk |
| Required validation error | "{fieldName} is required" |
| Invalid number | "Enter a valid number" |
| Field saved toast | "Custom field saved." |
| Field deleted toast | "Custom field removed." |
| Delete confirm | "Delete this custom field? All values on existing documents will also be removed." — "Delete" / "Cancel" |

### Edge Cases — PR2

| Scenario | Handling |
|----------|----------|
| More than 20 custom fields for document type | API returns 400 `CUSTOM_FIELD_LIMIT_REACHED` |
| Document conversion (ESTIMATE → INVOICE) | `convertDocument` copies `customFieldValues` from source to target |
| PDF generation with custom fields | Only fields with `showOnInvoice=true` appear on printout, below "Notes" |
| Field type change after values exist | Field type is immutable after creation; user must delete and recreate |
| Recurring invoice with custom fields | Custom fields in the template are copied to each generated invoice instance |

### Out of Scope — PR2

- Custom fields on line items (per-line custom data — Phase 6)
- Conditional custom fields (show field B only if field A = "X")
- Custom fields on payments or parties (parties already have this; payments Phase 6)
- Custom field export in reports

---

## PR3 — #122: Sales Pipeline UI

### Summary

Build first-class list + detail + create/edit pages for ESTIMATE, SALE_ORDER, and DELIVERY_CHALLAN document types, reusing the invoice form components. Add a "Convert" action on each detail page that opens a drawer with allowed target types and calls the existing `convertDocument` service. Register new routes and nav entries.

### Existing Backend (do not rebuild)

`ALLOWED_CONVERSIONS` in `server/src/services/document/helpers.ts`:
```ts
ESTIMATE:          ['SALE_ORDER', 'SALE_INVOICE']
PROFORMA:          ['SALE_INVOICE']
SALE_ORDER:        ['SALE_INVOICE', 'DELIVERY_CHALLAN']
PURCHASE_ORDER:    ['PURCHASE_INVOICE']
DELIVERY_CHALLAN:  ['SALE_INVOICE']
```

`POST /api/documents/:id/convert` endpoint already exists in `server/src/routes/documents/convert-restore.ts`. No new backend routes needed for core pipeline.

New backend routes needed only for the list pages:
```
GET /api/documents?type=ESTIMATE            (already exists — filter by type)
GET /api/documents?type=SALE_ORDER          (already exists)
GET /api/documents?type=DELIVERY_CHALLAN    (already exists)
```

Confirm these existing list endpoints support cursor pagination and type filter — they do via the polymorphic Document query in `document.service.ts`.

### User Flow — PR3

**Flow 1 — Create and convert an estimate**

```
Given: user taps "Estimates" in More menu
Then: EstimateListPage shows with cursor-paginated list

When: user taps "+" (new estimate)
Then: EstimateCreatePage opens (same form as InvoiceCreatePage, doc type = ESTIMATE)
      Header shows "New Estimate"
      Document number auto-generated (ESTIMATE-001 series)

When: user fills party, line items, saves
Then: estimate saved; navigates to EstimateDetailPage
      Toast: "Estimate saved."

When: user taps "Convert" on EstimateDetailPage
Then: bottom sheet opens with options:
      "Convert to Sale Order"
      "Convert to Invoice"

When: user selects "Convert to Sale Order" and taps "Confirm"
Then: POST /api/documents/:id/convert { targetType: 'SALE_ORDER' }
      Success → navigate to SaleOrderDetailPage for the new document
      Toast: "Estimate converted to Sale Order."
```

**Flow 2 — Sale order to delivery challan + invoice**

```
Given: user is on SaleOrderDetailPage
When: user taps "Convert"
Then: bottom sheet shows:
      "Convert to Invoice"
      "Convert to Delivery Challan"

When: user selects "Convert to Delivery Challan"
Then: DeliveryChallanDetailPage opens for the new document

When: user is on DeliveryChallanDetailPage and taps "Convert"
Then: bottom sheet shows "Convert to Invoice" only

When: user confirms
Then: InvoiceDetailPage opens for the new invoice
      Original sale order and challan show "Converted" status badge
```

**Flow 3 — View pipeline status on list**

```
Given: user is on EstimateListPage
Then: each row shows: estimate number, party name, date, amount, status badge
      Status badges: DRAFT (grey), SENT (blue), ACCEPTED (green), REJECTED (red), CONVERTED (purple)

When: user taps a converted estimate
Then: EstimateDetailPage shows "Converted to: Sale Order #SO-007" with a link
```

**Error paths**

| Scenario | Handling |
|----------|----------|
| Convert a CONVERTED document | API returns 409 `ALREADY_CONVERTED`; toast "This document has already been converted." |
| Convert target type not in ALLOWED_CONVERSIONS | API returns 400 `CONVERSION_NOT_ALLOWED`; bottom sheet shows only valid targets so this is unreachable from UI |
| Network fails during convert | Toast "Could not convert document. Check your connection." — original document unchanged |
| Empty estimate list | "No estimates yet. Create your first estimate." + "New Estimate" button |

### Routes — PR3

Add to `src/config/routes.config.ts`:

```ts
// Estimates
ESTIMATES: '/estimates',
ESTIMATE_NEW: '/estimates/new',
ESTIMATE_DETAIL: '/estimates/:id',
ESTIMATE_EDIT: '/estimates/:id/edit',

// Sale Orders
SALE_ORDERS: '/sale-orders',
SALE_ORDER_NEW: '/sale-orders/new',
SALE_ORDER_DETAIL: '/sale-orders/:id',
SALE_ORDER_EDIT: '/sale-orders/:id/edit',

// Delivery Challans
DELIVERY_CHALLANS: '/delivery-challans',
DELIVERY_CHALLAN_NEW: '/delivery-challans/new',
DELIVERY_CHALLAN_DETAIL: '/delivery-challans/:id',
DELIVERY_CHALLAN_EDIT: '/delivery-challans/:id/edit',
```

These 12 routes must be added to `src/router/routes.tsx` (after App.tsx is split per pre-PR mandate above).

### Nav — PR3

Add to `NavKey` type in `src/config/verticals.config.ts`:

```ts
| 'estimates' | 'sale-orders' | 'delivery-challans'
```

Add to `MORE_MENU_ITEMS` in `src/features/more/more.constants.ts` under `'efficiency'` group:

```ts
{ id: 'estimates',          navKey: 'estimates',          label: 'Estimates',         description: 'Quotes & proposals',      icon: 'FileQuestion', route: ROUTES.ESTIMATES,         color: 'var(--color-primary-50)',   group: 'efficiency' },
{ id: 'sale-orders',        navKey: 'sale-orders',        label: 'Sale Orders',       description: 'Confirmed orders',         icon: 'ClipboardList', route: ROUTES.SALE_ORDERS,       color: 'var(--color-secondary-50)', group: 'efficiency' },
{ id: 'delivery-challans',  navKey: 'delivery-challans',  label: 'Delivery Challans', description: 'Dispatch documents',       icon: 'Truck',        route: ROUTES.DELIVERY_CHALLANS, color: 'var(--color-warning-50)',   group: 'efficiency' },
```

**Visibility per vertical** (no vertical hides these by default — all three are shown for all business types):

```ts
// No addition to any *_HIDDEN set.
// All verticals show estimates, sale-orders, delivery-challans.
```

Rationale: services vertical uses estimate → order heavily; B2B retail uses sale-order → invoice; restaurants use delivery challan for table bills; pharmacies and distributors use the full chain. None have a reason to hide these.

### Component Reuse Strategy — PR3

Do not create new form components. All three pipeline pages reuse invoice form infrastructure via a shared `documentType` prop:

```
DocumentListPage.tsx           (new — generic list, accepts documentType prop)
DocumentDetailPage.tsx         (new — generic detail, accepts documentType prop)
DocumentFormPage.tsx           (new — wraps existing InvoiceCreatePage logic with documentType)
ConvertDrawer.tsx              (new — shows allowed target types, calls /convert)
```

Alternatively, thin wrapper pages for each type that pass `documentType` to the generic component:
```
EstimateListPage.tsx   → <DocumentListPage documentType="ESTIMATE" />
SaleOrderListPage.tsx  → <DocumentListPage documentType="SALE_ORDER" />
etc.
```

Either approach is acceptable; the architecture decision belongs to the implementing engineer. The constraint is: do not duplicate the line item editor, party picker, totals section, or tax section.

### UI States — PR3 (per page type, identical across all three types)

**List page (EstimateListPage / SaleOrderListPage / DeliveryChallanListPage)**
- Loading: 3 skeleton card rows, 12px radius
- Empty: "[Document type] list is empty. Create your first [document type]." + "New [type]" CTA
- Error: "Could not load [document type] list. Tap to retry."
- Populated: cursor-paginated; each row: doc number, party name, date, amount (₹), status badge

**Detail page**
- Loading: skeleton header + 2 stat cards + skeleton line item rows
- Error: "Could not load document. Tap to retry."
- Populated: all fields, line items, totals, action buttons (Edit / Convert / Share / Print / Delete)
- Converted (status = CONVERTED): "Convert" button hidden; "Converted to: [type] #[num]" chip shown

**Form page (create/edit)**
- Loading (edit — fetching existing doc): skeleton form
- Save success: toast "[Document type] saved." → navigate to detail page
- Save error: toast "Could not save. Please try again."
- Offline save: toast "Saved — will sync when online." (no navigate)

**ConvertDrawer**
- Loading (POST in progress): "Converting..." spinner inside drawer
- Success: drawer closes; toast "Converted to [target type]." → navigate to new document detail
- Error: toast "Could not convert. Please try again." — drawer stays open

### UX Copy — PR3

| Element | Estimates | Sale Orders | Delivery Challans |
|---------|-----------|-------------|-------------------|
| Page title | "Estimates" | "Sale Orders" | "Delivery Challans" |
| New button | "New Estimate" | "New Sale Order" | "New Challan" |
| Empty state | "No estimates yet. Create your first estimate." | "No sale orders yet." | "No delivery challans yet." |
| Detail header | "Estimate #{num}" | "Sale Order #{num}" | "Challan #{num}" |
| Convert button label | "Convert" | "Convert" | "Convert" |
| Convert drawer title | "Convert Estimate" | "Convert Sale Order" | "Convert Challan" |
| Convert option (to invoice) | "Convert to Invoice" | "Convert to Invoice" | "Convert to Invoice" |
| Convert option (to order) | "Convert to Sale Order" | — | — |
| Convert option (to challan) | — | "Convert to Delivery Challan" | — |
| Converted badge | "Converted" | "Converted" | "Converted" |
| Already converted toast | "This document has already been converted." | same | same |
| Save toast | "Estimate saved." | "Sale Order saved." | "Delivery Challan saved." |

### i18n — PR3 (ext28 file: `sales-workflow`)

Keys to add (en + hi):

```
salesWorkflow.estimates.title
salesWorkflow.estimates.empty
salesWorkflow.estimates.new
salesWorkflow.saleOrders.title
salesWorkflow.saleOrders.empty
salesWorkflow.saleOrders.new
salesWorkflow.deliveryChallans.title
salesWorkflow.deliveryChallans.empty
salesWorkflow.deliveryChallans.new
salesWorkflow.convert.title
salesWorkflow.convert.toInvoice
salesWorkflow.convert.toSaleOrder
salesWorkflow.convert.toChallan
salesWorkflow.convert.success
salesWorkflow.convert.alreadyConverted
salesWorkflow.convert.error
```

### Edge Cases — PR3

| Scenario | Handling |
|----------|----------|
| User navigates directly to `/estimates/bad-id` | 404 page (existing pattern) |
| Estimate with no party selected | Allowed (party is optional on estimates); detail page shows "No party" |
| CONVERTED document opened for editing | Edit form shows read-only state with "This document has been converted and cannot be edited." banner |
| Delete a converted estimate | Allowed; linked sale order/invoice is NOT deleted; the `originalDocumentId` link is set to null via soft delete |
| Offline create estimate | Queued with `entityType: 'estimate'`, `entityLabel: estimateNumber`; no navigate on optimistic `{}` return |
| App.tsx route count | App.tsx must be split before this PR per pre-PR mandate; after split, `routes.tsx` can hold 250+ routes |

### Out of Scope — PR3

- Public share link for estimates (shareable URL that buyer can view without login) — Phase 6
- Estimate approval workflow (buyer signs off in-app) — Phase 6
- Recurring estimates — Phase 6
- Purchase-order pipeline (/purchase-orders, /purchase-invoices) — already exists separately; not touched here
- PROFORMA invoice as a first-class pipeline page — Phase 6
- Multi-stage conversion (convert same estimate to multiple orders) — Phase 6

---

## PR4 — #132: Multiple Price Lists

### Summary

Add `PriceList` and `PriceListItem` models. Assign a default price list to a party. Implement `resolvePrice(partyId, productId)` with user-approved precedence: `PartyPricing` (existing per-party-per-product override) wins, then `Party.defaultPriceList`, then `Product.salePrice`. Integrate into document create/update so line items auto-populate rates.

### User Flow — PR4

**Flow 1 — Create a price list**

```
Given: user is in More → Price Lists (or Settings → Price Lists)
When: user taps "New Price List"
Then: form opens: name (text), description (optional)

When: user saves
Then: PriceList row created; navigates to PriceListDetailPage
      Toast: "Price list created."

On PriceListDetailPage:
  - "Add Product" button opens product picker
  - Each row: product name, current price (editable inline)
  - Bulk edit: tap "Edit Prices" to enter all prices at once in a table
```

**Flow 2 — Assign price list to a party**

```
Given: user is on PartyEditPage
Then: "Default Price List" dropdown (optional) added to party form
      Options: "(None)", then list of active price lists

When: user selects "Wholesale - North Zone" and saves
Then: party.defaultPriceListId updated
      Toast: "Party updated."
```

**Flow 3 — Auto-populate rate when adding a product to a document**

```
Given: party "Balaji Traders" has defaultPriceList = "Wholesale - North Zone"
       "Wholesale - North Zone" has price for "Amul Butter 500g" = ₹220
       Product.salePrice for "Amul Butter 500g" = ₹250

When: user creates a new invoice for "Balaji Traders" and adds "Amul Butter 500g"
Then: rate auto-fills ₹220 (from price list, not ₹250 from product)
      User can override the rate manually per line

Given: party has PartyPricing for "Amul Butter 500g" = ₹200
When: user adds that product for that party
Then: rate auto-fills ₹200 (PartyPricing wins over price list)
```

**Flow 4 — Bulk edit prices in a price list**

```
Given: user is on PriceListDetailPage
When: user taps "Edit Prices"
Then: all product rows show inline editable number inputs (rupee value)

When: user changes 5 prices and taps "Save"
Then: PUT /api/price-lists/:id/items with array of { productId, priceInPaise }
      All 5 upserted atomically
      Toast: "Prices updated."
```

**Error paths**

| Scenario | Handling |
|----------|----------|
| Price list name already exists | API 409 `PRICE_LIST_NAME_EXISTS`; toast "A price list with this name already exists." |
| Party assigned a deleted price list | `defaultPriceListId` set to null on price list soft delete; next document resolves to product.salePrice |
| Product not in price list | Falls through to Product.salePrice — no error |
| Rate override after auto-fill | User can always manually type a different rate; auto-fill is non-sticky |
| Offline save price list | Queued with `entityType: 'price-list'`, `entityLabel: priceListName` |
| Permission denied | User without `pricing.edit` permission → action buttons hidden in UI; API returns 403 |

### Data Model — PR4

```prisma
model PriceList {
  id          String    @id @default(cuid())
  businessId  String
  name        String    @db.VarChar(100)
  description String?   @db.VarChar(300)
  currency    String    @default("INR")
  isActive    Boolean   @default(true)
  isDeleted   Boolean   @default(false)
  deletedAt   DateTime?
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  business  Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  items     PriceListItem[]
  parties   Party[]         @relation("PartyDefaultPriceList")

  @@unique([businessId, name])
  @@index([businessId, isActive])
  @@index([businessId, isDeleted])
}

model PriceListItem {
  id          String   @id @default(cuid())
  priceListId String
  productId   String
  priceInPaise Int     // positive integer, paise
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  priceList PriceList @relation(fields: [priceListId], references: [id], onDelete: Cascade)
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([priceListId, productId])
  @@index([priceListId])
  @@index([productId])
}
```

**Extension to existing models:**

```prisma
// Party — add:
defaultPriceListId String?
defaultPriceList   PriceList? @relation("PartyDefaultPriceList", fields: [defaultPriceListId], references: [id], onDelete: SetNull)

// Business — add:
priceLists PriceList[]

// Product — add:
priceListItems PriceListItem[]
```

### Price Resolution Logic — PR4

New file: `server/src/services/pricing/resolve.ts`

```ts
/**
 * resolvePrice — returns the price in paise for a product in the context
 * of a specific party. Precedence (high to low):
 *   1. PartyPricing (existing per-party-per-product row, if minQty satisfied)
 *   2. Party.defaultPriceList → PriceListItem for this product
 *   3. Product.salePrice
 *
 * Returns null if product is not found (caller handles).
 */
export async function resolvePrice(
  businessId: string,
  partyId: string,
  productId: string,
  quantity: number = 1
): Promise<number | null>
```

This function is called server-side in `document/create.ts` and `document/update.ts` when a line item is processed. The resolved rate is stored on the `DocumentLineItem.rate` field. User overrides on the line item are preserved as-is (server does not re-resolve on update if rate was manually changed — the client passes `rateOverridden: true` flag to skip resolution).

### API Contract — PR4

```
GET    /api/price-lists                            list (isActive filter, cursor pagination)
POST   /api/price-lists                            create
GET    /api/price-lists/:id                        detail + items
PUT    /api/price-lists/:id                        update name/description/isActive
DELETE /api/price-lists/:id                        soft delete
GET    /api/price-lists/:id/items                  list items (cursor)
PUT    /api/price-lists/:id/items                  bulk upsert items
DELETE /api/price-lists/:id/items/:productId       remove one item

GET    /api/documents/resolve-price?partyId=&productId=&qty=   (optional: used by frontend for live rate suggestion)
```

```ts
// POST /api/price-lists request
interface CreatePriceListReq {
  name: string           // max 100 chars
  description?: string   // max 300 chars
  isActive?: boolean     // default true
}

// PriceListRes
interface PriceListRes {
  id: string
  name: string
  description: string | null
  isActive: boolean
  itemCount: number
  createdAt: string
  updatedAt: string
}

// PUT /api/price-lists/:id/items request
interface BulkUpsertPriceListItemsReq {
  items: Array<{
    productId: string
    priceInPaise: number   // positive integer
  }>
}

// GET /api/documents/resolve-price response
interface ResolvePriceRes {
  priceInPaise: number
  source: 'PARTY_PRICING' | 'PRICE_LIST' | 'PRODUCT_SALE_PRICE'
  priceListId?: string
  priceListName?: string
}

// Error shapes
{ success: false, error: { code: 'PRICE_LIST_NAME_EXISTS', message: 'A price list with this name already exists.' } }
{ success: false, error: { code: 'PRICE_NOT_POSITIVE', message: 'Price must be greater than zero.' } }
```

### Permission — PR4

`pricing.edit` permission controls create/update/delete of price lists and items. Check whether this permission key exists:

```
RESOLVE BEFORE PR4: grep `pricing` in `server/src/services/settings/permissions-data.ts`.
Current grep result: no `pricing` key found in PERMISSION_MATRIX.
Action required: add pricing permission group before PR4 ships.
```

Proposed addition to `PERMISSION_MATRIX`:

```ts
{
  key: 'pricing', label: 'Price Lists',
  actions: [
    { key: 'view', label: 'View Price Lists' },
    { key: 'edit', label: 'Create / Edit Price Lists' },
  ],
},
```

Add `pricing.view` and `pricing.edit` to Owner, Partner, Manager roles. Stock Manager and Accountant get `pricing.view` only.

### UI States — PR4

**PriceListListPage**
- Loading: 3 skeleton card rows
- Empty: "No price lists yet. Create one to auto-fill rates by customer." + "New Price List" CTA
- Error: "Could not load price lists. Tap to retry."
- Populated: name, item count, active badge, edit/delete actions

**PriceListDetailPage**
- Loading: skeleton header + skeleton table rows
- Empty (no items): "No products added yet." + "Add Product" CTA
- Error: "Could not load price list. Tap to retry."
- Populated: product name, price (₹), edit inline, delete row

**Bulk edit mode**
- Tap "Edit Prices": all rows switch to editable number inputs
- Saving: "Saving..." spinner, all inputs disabled
- Save success: toast "Prices updated." → back to read mode
- Save error: toast "Could not save prices. Tap to retry."

**Party form — defaultPriceList field**
- Loading price lists for dropdown: spinner inside dropdown
- No price lists: dropdown shows "(None)" only with helper text "Create price lists in More → Price Lists"
- Selected: shows price list name + "×" to clear

**Line item rate auto-fill**
- Rate field shows suggested rate immediately when product is selected and party is set
- Source indicator (small text below rate field): "From price list: Wholesale - North Zone" or "Party pricing" or "Product price"
- User edits rate: source indicator disappears; rate treated as manual override

### UX Copy — PR4

| Element | Text |
|---------|------|
| List page title | "Price Lists" |
| New price list button | "New Price List" |
| Empty state | "No price lists yet. Create one to set custom rates for your customers." |
| Detail page — add product | "Add Product" |
| Detail page — edit prices | "Edit Prices" |
| Prices saved toast | "Prices updated." |
| Price list created toast | "Price list created." |
| Price list updated toast | "Price list updated." |
| Price list deleted toast | "Price list removed." |
| Delete confirm | "Delete this price list? Parties assigned to it will revert to standard pricing." — "Delete" / "Cancel" |
| Party form dropdown label | "Default Price List" |
| Party form dropdown placeholder | "None (use product price)" |
| Rate source — price list | "From: {priceListName}" |
| Rate source — party pricing | "Custom party rate" |
| Rate source — product default | "Product default price" |

### i18n — PR4 (add to ext28 `sales-workflow` file)

```
salesWorkflow.priceLists.title
salesWorkflow.priceLists.empty
salesWorkflow.priceLists.new
salesWorkflow.priceLists.detail.addProduct
salesWorkflow.priceLists.detail.editPrices
salesWorkflow.priceLists.detail.empty
salesWorkflow.priceLists.saved
salesWorkflow.priceLists.pricesSaved
salesWorkflow.priceLists.deleted
salesWorkflow.priceLists.deleteConfirm
salesWorkflow.priceLists.rateSource.priceList
salesWorkflow.priceLists.rateSource.partyPricing
salesWorkflow.priceLists.rateSource.productDefault
```

### Edge Cases — PR4

| Scenario | Handling |
|----------|----------|
| resolvePrice called with no party (estimate without party) | Skip steps 1+2; return Product.salePrice |
| PriceListItem.priceInPaise = 0 | Allowed (zero-priced items exist); does NOT trigger isFreeItem |
| Party with price list deleted | Party.defaultPriceListId nulled via `onDelete: SetNull`; next resolve falls to Product.salePrice |
| Product deleted but PriceListItem exists | `onDelete: Cascade` removes PriceListItem; no orphan |
| Document with price list rate + manual discount | Rate is PR4-resolved; discount applies on top (no interaction with price resolution) |
| Convert a document — rates preserved? | Converted document copies existing rates from source; `resolvePrice` is NOT re-run on conversion |
| Offline add product to invoice with price list | `GET /api/documents/resolve-price` fails offline; UI falls back to Product.salePrice cached in IDB; source indicator shows "Product default price (offline)" |
| 1000 products in a price list | Bulk edit view uses virtual scroll; PUT is a single atomic upsert |

### Nav — PR4

Add to `NavKey` type: `'price-lists'`

Add to `MORE_MENU_ITEMS` under `'efficiency'` group:

```ts
{ id: 'price-lists', navKey: 'price-lists', label: 'Price Lists', description: 'Custom rates by customer', icon: 'Tag', route: ROUTES.PRICE_LISTS, color: 'var(--color-secondary-50)', group: 'efficiency' },
```

Add to `routes.config.ts`:
```ts
PRICE_LISTS: '/price-lists',
PRICE_LIST_NEW: '/price-lists/new',
PRICE_LIST_DETAIL: '/price-lists/:id',
PRICE_LIST_EDIT: '/price-lists/:id/edit',
```

### Out of Scope — PR4

- Time-bound price lists (validity date range for seasonal pricing)
- Quantity-tiered pricing within a price list (e.g. 1-10 = ₹100, 11+ = ₹90; the existing `PartyPricing.minQty` handles basic tiering — price list is flat per product)
- Currency variants per price list (all INR in v1; `currency` field reserved for future)
- Price list import from CSV
- Price list cloning
- Price list per-godown or per-location (Phase 6)
- Automatic price list expiry notifications

---

## Cross-Feature Impact (all PRs)

### Document Service

| PR | File | Change |
|----|------|--------|
| PR1 | `server/src/services/document/create.ts` + `update.ts` | Apply `isFreeItem` zeroing in line calc loop |
| PR2 | `server/src/services/document/create.ts` + `update.ts` | Upsert `DocumentCustomFieldValue` rows atomically in transaction |
| PR2 | `server/src/services/document/convert.ts` | Copy `customFieldValues` from source document |
| PR4 | `server/src/services/document/create.ts` + `update.ts` | Call `resolvePrice()` per line when `rateOverridden` is not true |

### Line Item Editor

| PR | Change |
|----|--------|
| PR1 | Add `LineItemFreeToggle.tsx` component + "..." overflow menu per row |
| PR1 | `isFreeItem` prop flows from `LineItemFormData` through form state |
| PR4 | Rate field shows source indicator below it |
| PR4 | `rateOverridden` flag set when user manually edits rate |

(Split must happen before PR1 branch opens — see pre-PR mandate above.)

### Party Form

| PR | Change |
|----|--------|
| PR4 | Add `defaultPriceListId` optional dropdown to party create/edit form |

### Settings Pages

| PR | Change |
|----|--------|
| PR2 | Add "Document Custom Fields" tab to Settings → Documents (or new Settings → Custom Fields page if one exists) |

Verify: `src/features/settings/` — does a `CustomFieldsPage` exist for parties? If yes, extend with a "Documents" tab. If no, create new page.

### Offline Queue Labels

| PR | entityType | entityLabel |
|----|-----------|-------------|
| PR1 | `'invoice'` (existing) | invoice number |
| PR2 | `'invoice'` / `'estimate'` / `'sale-order'` / `'delivery-challan'` per document type | document number |
| PR3 | `'estimate'` / `'sale-order'` / `'delivery-challan'` | document number |
| PR4 | `'price-list'` | price list name |

---

## Security

| Concern | Applies to | Implementation |
|---------|-----------|---------------|
| Auth required | All new routes | `auth` middleware on all `/api/price-lists/*`, `/api/documents/:id/custom-fields` |
| Business isolation | All models | Every DB query filters by `req.user.businessId` |
| `pricing.edit` role | PR4 | `requirePermission('pricing.edit')` on POST/PUT/DELETE price list routes |
| `settings.modify` role | PR2 | `requirePermission('settings.modify')` on POST/PUT/DELETE custom field definitions (existing pattern) |
| `isFreeItem` abuse | PR1 | No permission gate — any invoice creator can mark items free (matches business reality: staff who create invoices have discretion over promotional lines) |
| Custom field value injection | PR2 | `valueJson` stored as Json in Prisma; never interpolated into SQL; safe |
| Price list read | PR4 | `requirePermission('pricing.view')` on GET routes |

---

## Mobile Layout

- 375px primary layout for all new pages
- 320px minimum — no horizontal overflow
- Price list detail with product table: virtual scroll if > 20 items; columns: product name (flex-grow) + price (80px) + delete icon (40px) — fits 320px
- Convert drawer: bottom sheet, 60% height, two or three options listed vertically, full-width buttons
- Line item free toggle: "..." tap target minimum 44×44px; accessible
- Custom field DROPDOWN: native `<select>` replaced with bottom-sheet picker on mobile (consistent with existing party form pattern)
- Estimate/sale-order/challan list rows: same layout as invoice list rows (party name + doc number + amount + status badge) — fits 320px

---

## File Structure

```
server/src/
  services/
    document/
      create.ts                    MODIFY (PR1: isFreeItem calc; PR2: customFieldValues upsert; PR4: resolvePrice)
      update.ts                    MODIFY (same)
      convert.ts                   MODIFY (PR2: copy customFieldValues)
    pricing/
      resolve.ts                   NEW (PR4)
    price-list/
      price-list.service.ts        NEW (PR4: CRUD)
      price-list-item.service.ts   NEW (PR4: bulk upsert)
  routes/
    price-lists.ts                 NEW (PR4)
    documents/
      custom-field-values.ts       NEW (PR2: GET/PUT /api/documents/:id/custom-fields)

src/features/
  invoices/
    components/
      LineItemEditor.tsx           SPLIT before PR1
      LineItemRow.tsx              NEW (split)
      LineItemTaxSection.tsx       NEW (split)
      LineItemFreeToggle.tsx       NEW (PR1)
  estimates/
    pages/
      EstimateListPage.tsx         NEW (PR3)
      EstimateDetailPage.tsx       NEW (PR3)
      EstimateFormPage.tsx         NEW (PR3)
    estimate.service.ts            NEW (PR3)
  sale-orders/
    pages/
      SaleOrderListPage.tsx        NEW (PR3)
      SaleOrderDetailPage.tsx      NEW (PR3)
      SaleOrderFormPage.tsx        NEW (PR3)
    sale-order.service.ts          NEW (PR3)
  delivery-challans/
    pages/
      DeliveryChallanListPage.tsx  NEW (PR3)
      DeliveryChallanDetailPage.tsx NEW (PR3)
      DeliveryChallanFormPage.tsx   NEW (PR3)
    delivery-challan.service.ts     NEW (PR3)
  documents/
    components/
      ConvertDrawer.tsx            NEW (PR3 — shared across pipeline pages)
      DocumentStatusBadge.tsx      NEW (PR3 — shared)
  price-lists/
    pages/
      PriceListListPage.tsx        NEW (PR4)
      PriceListDetailPage.tsx      NEW (PR4)
      PriceListFormPage.tsx        NEW (PR4)
    price-list.service.ts          NEW (PR4)
    price-list-crud.service.ts     NEW (PR4)
  settings/
    pages/
      DocumentCustomFieldsPage.tsx NEW or EXTEND (PR2)

src/config/
  routes.config.ts                 MODIFY (PR3: 12 new routes; PR4: 4 new routes)
  verticals.config.ts              MODIFY (PR3: 3 new NavKeys; PR4: 1 new NavKey)

src/features/more/
  more.constants.ts                MODIFY (PR3: 3 new items; PR4: 1 new item)

src/router/
  routes.tsx                       NEW (App.tsx split before PR3)
  AppRouter.tsx                    NEW (App.tsx split before PR3)

src/i18n/
  ext28-sales-workflow.en.json     NEW (PR3+PR4 keys)
  ext28-sales-workflow.hi.json     NEW
```

---

## Open Questions

These must be resolved before the indicated PR opens:

| # | Question | Resolve before | Notes |
|---|----------|---------------|-------|
| OQ1 | Does `CustomFieldDefinition.entityType` column need a DB migration to accept `"DOCUMENT"` value, or is it already a free-text String that accepts any value? Current schema: `String @default("PARTY")` — free text, so no migration needed. Confirm with `prisma studio` or a test query. | PR2 | Likely no migration needed |
| OQ2 | Does `GET /api/documents?type=ESTIMATE` already support cursor pagination and return the same response shape as the invoice list? Grep `document.service.ts` → `listDocuments` function for `type` filter. | PR3 | If the list endpoint filters by type already, no new backend work for list pages |
| OQ3 | `pricing.edit` permission does not exist in `permissions-data.ts` PERMISSION_MATRIX. Must be added before PR4. Who approves permission matrix changes — is there a separate role-audit process? | PR4 | Needs Sawan approval on the proposed permission group above |
| OQ4 | `isFreeItem` on a DELIVERY_CHALLAN line: does it affect stock deduction? Decision needed: free-item quantity should still deduct stock (it's a real physical dispatch). Confirm before PR1 ships. | PR1 | Recommended: yes, deduct stock at full quantity |
| OQ5 | PDF printout for estimates/sale-orders/delivery-challans: do they use the same React-PDF template as invoices, or do they need separate templates? The existing `DocumentSettings` model controls template choice — confirm if ESTIMATE type needs its own template row or inherits invoice template. | PR3 | Likely inherits; confirm with Sawan |
| OQ6 | `resolvePrice` offline fallback: when `GET /api/documents/resolve-price` fails (network down), the frontend should fall back to IDB-cached product `salePrice`. Is `Product.salePrice` currently stored in the IDB cache? Confirm which product fields are cached. | PR4 | If not cached, add `salePrice` to the product IDB shape before PR4 |
| OQ7 | `CONVERTED` document status: does it already exist as a valid value on `Document.status` in the schema, or does it need to be added? Check if `convertDocument` service sets a status field. | PR3 | Grep `convert.ts` for status updates before assuming |
| OQ8 | ConvertDrawer: after converting, should the original document be updated to status `CONVERTED` and made non-editable? Decide the status lifecycle for converted documents before PR3 ships. | PR3 | Recommended: yes, status = CONVERTED, edit button hidden |

---

## Out of Scope (entire Epic B)

- Purchase-order pipeline (/purchase-orders, /purchase-invoices) — separate feature, already exists partially
- GST e-invoicing (IRN/QR) for ESTIMATE, SALE_ORDER, DELIVERY_CHALLAN document types — applies to SALE_INVOICE only per GSTN rules
- Public share links for estimates/orders (buyer views estimate on a public URL without login) — Phase 6
- Recurring estimates — Phase 6
- Estimate approval workflow (buyer countersign in-app) — Phase 6
- Multi-stage conversion (one estimate → multiple orders) — Phase 6
- Price list import from CSV / Excel — Phase 6
- Time-bound price list validity — Phase 6
- Quantity-tiered pricing within a price list (slabs) — Phase 6
- Price list per-godown or per-location — Phase 6
- BOGO auto-rules (system auto-marks items free based on quantity bought) — Phase 6
- Free-item GST liability at MRP for certain categories (Schedule III exceptions) — Phase 6

---

## Acceptance Criteria

### PR1 — BOGO / Free-Item Lines

**Backend**
- [ ] `curl -X PUT /api/documents/:invoiceId -H "Cookie: ..." -d '{"lineItems":[{"productId":"...","quantity":2,"isFreeItem":true},...]}' → { success: true, data: { lineItems: [{isFreeItem: true, rate: 0, taxableValue: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0, cessAmount: 0}] } }`
- [ ] `curl POST /api/documents` with mixed paid + free lines → grandTotal equals sum of paid lines only
- [ ] `curl POST /api/documents` without auth → 401
- [ ] `tsc --noEmit` clean on server after schema migration applied
- [ ] `npx prisma migrate dev --name add-free-item` runs without error
- [ ] Existing invoice with no `isFreeItem` column → migration adds `@default(false)`; all existing rows read `false`

**Frontend**
- [ ] Screenshot: LineItemEditor — free-item row shows strikethrough rate + "FREE" badge
- [ ] Screenshot: Invoice totals — grand total excludes free line value
- [ ] 375px: free badge fits within line item row without overflow
- [ ] 320px: no horizontal overflow on line item row with "FREE" badge
- [ ] Tap "..." → "Mark as free item" → rate zeros, badge appears (no page reload)
- [ ] Tap "Remove free status" → rate reverts to product.salePrice, badge disappears
- [ ] Console clean (no warnings or errors)
- [ ] `src/features/invoices/components/LineItemEditor.tsx` split complete; all resulting files ≤ 250 LOC

**QA**
- [ ] Invoice with 3 paid + 2 free lines: subtotal correct; tax correct; grand total correct
- [ ] PDF: free line shows "FREE" in rate column; subtotal excludes free line value
- [ ] Recurring invoice with free line: generated instance also has `isFreeItem=true`
- [ ] Convert ESTIMATE with free line to INVOICE: `isFreeItem=true` preserved
- [ ] Offline: mark line as free → save → queued mutation includes `isFreeItem: true`

---

### PR2 — Invoice Custom Fields

**Backend**
- [ ] `curl -X POST /api/custom-fields -d '{"name":"PO Number","fieldType":"TEXT","entityType":"DOCUMENT","documentTypes":["INVOICE","ESTIMATE"],"required":true}' → { success: true, data: { id, name, fieldType, documentTypes } }`
- [ ] `curl GET /api/custom-fields?entityType=DOCUMENT&documentType=INVOICE` → returns only fields with "INVOICE" in documentTypes
- [ ] `curl -X POST /api/documents -d '{..., "customFieldValues":[{"fieldDefId":"...","valueJson":"PO-2026-001"}]}' → { success: true, data: { id, customFieldValues: [...] } }`
- [ ] `curl -X POST /api/documents` with required custom field missing → `{ success: false, error: { code: "CUSTOM_FIELD_REQUIRED" } }` 400
- [ ] `curl -X POST /api/custom-fields` without auth → 401
- [ ] `curl -X POST /api/custom-fields` without `settings.modify` permission → 403
- [ ] `tsc --noEmit` clean on server after migration applied
- [ ] Convert ESTIMATE to INVOICE → customFieldValues copied to new document

**Frontend**
- [ ] Screenshot: Settings → Document Custom Fields — empty state
- [ ] Screenshot: Settings → Document Custom Fields — populated (2+ fields with type badges)
- [ ] Screenshot: InvoiceCreatePage — "Additional Details" section with TEXT and DROPDOWN fields
- [ ] Screenshot: Required field validation error (red border + message below)
- [ ] 375px: custom fields section fits without overflow
- [ ] 320px: no overflow in custom fields section
- [ ] DROPDOWN field opens bottom-sheet picker on mobile
- [ ] Console clean

**QA**
- [ ] Define field with `showOnInvoice=true` → field value appears on PDF printout
- [ ] Define field with `showOnInvoice=false` → field value absent from PDF
- [ ] Delete a custom field definition → existing document `customFieldValues` removed (cascade)
- [ ] 21 custom fields for same document type → API returns 400 `CUSTOM_FIELD_LIMIT_REACHED`
- [ ] Offline invoice save with custom fields → mutation queued; values included

---

### PR3 — Sales Pipeline UI

**Backend**
- [ ] `curl GET /api/documents?type=ESTIMATE` → `{ success: true, data: { documents: [...] } }` (cursor paginated)
- [ ] `curl GET /api/documents?type=SALE_ORDER` → same
- [ ] `curl GET /api/documents?type=DELIVERY_CHALLAN` → same
- [ ] `curl -X POST /api/documents/:estimateId/convert -d '{"targetType":"SALE_ORDER"}' → { success: true, data: { id, type: "SALE_ORDER" } }`
- [ ] `curl -X POST /api/documents/:estimateId/convert` (already CONVERTED) → 409 `ALREADY_CONVERTED`
- [ ] `curl GET /api/documents?type=ESTIMATE` without auth → 401
- [ ] `App.tsx` split complete and `tsc --noEmit` clean after split

**Frontend**
- [ ] Screenshot: EstimateListPage — loading (skeleton rows)
- [ ] Screenshot: EstimateListPage — empty ("No estimates yet..." + CTA)
- [ ] Screenshot: EstimateListPage — populated (3+ rows with status badges)
- [ ] Screenshot: EstimateDetailPage — populated with "Convert" button
- [ ] Screenshot: ConvertDrawer — open with conversion options
- [ ] Screenshot: SaleOrderListPage — populated
- [ ] Screenshot: DeliveryChallanListPage — populated
- [ ] 375px: all list pages render without overflow
- [ ] 320px: status badge + amount + doc number fit on one row without overflow
- [ ] Hindi: all pipeline strings render in Hindi
- [ ] `estimates`, `sale-orders`, `delivery-challans` NavKeys appear in More menu
- [ ] Console clean; `tsc --noEmit` clean on frontend

**QA**
- [ ] ESTIMATE → SALE_ORDER: original estimate shows "Converted" badge, link to new order
- [ ] SALE_ORDER → DELIVERY_CHALLAN + SALE_INVOICE: both conversions available from detail
- [ ] DELIVERY_CHALLAN → SALE_INVOICE: conversion works
- [ ] Navigate to `/estimates/invalid-id` → 404 page shown
- [ ] CONVERTED estimate → Edit button hidden; "This document has been converted" banner shown
- [ ] Offline create estimate → toast "Saved — will sync when online" (no crash, no navigate)

---

### PR4 — Multiple Price Lists

**Backend**
- [ ] `curl -X POST /api/price-lists -d '{"name":"Wholesale - North Zone"}' → { success: true, data: { id, name, isActive } }` 201
- [ ] `curl -X PUT /api/price-lists/:id/items -d '{"items":[{"productId":"...","priceInPaise":22000}]}' → { success: true, data: { updated: 1 } }`
- [ ] `curl GET /api/documents/resolve-price?partyId=P1&productId=PROD1` → `{ source: "PRICE_LIST", priceInPaise: 22000, priceListName: "Wholesale - North Zone" }`
- [ ] `curl POST /api/price-lists` with duplicate name → 409 `PRICE_LIST_NAME_EXISTS`
- [ ] `curl POST /api/price-lists` without auth → 401
- [ ] `curl POST /api/price-lists` without `pricing.edit` permission → 403
- [ ] `tsc --noEmit` clean on server
- [ ] `pricing` permission group added to `PERMISSION_MATRIX`

**Frontend**
- [ ] Screenshot: PriceListListPage — empty state
- [ ] Screenshot: PriceListListPage — populated (2+ price lists)
- [ ] Screenshot: PriceListDetailPage — product list with editable prices
- [ ] Screenshot: InvoiceCreatePage — rate field with "From: Wholesale - North Zone" source indicator
- [ ] Screenshot: PartyEditPage — "Default Price List" dropdown
- [ ] 375px: price list detail table fits
- [ ] 320px: product name column + price column + delete icon fit without overflow
- [ ] User without `pricing.edit` → "New Price List" button hidden; edit/delete hidden on rows
- [ ] Console clean; `tsc --noEmit` clean on frontend

**QA**
- [ ] Party with `defaultPriceList` → new invoice for that party → product added → rate = price list rate (not product.salePrice)
- [ ] Party with `PartyPricing` for product → rate = PartyPricing (not price list, not product.salePrice)
- [ ] Party with no price list → rate = product.salePrice
- [ ] User manually overrides rate → `rateOverridden: true` sent; resolvePrice NOT called again on save
- [ ] Price list soft deleted → parties assigned to it revert to product.salePrice on next invoice creation
- [ ] 1000-product price list bulk edit → PUT completes in < 5s; all rows saved atomically
- [ ] Offline add product to invoice (no network) → fallback to product.salePrice from IDB; source indicator shows "Product default price (offline)"

---

## QA Checklist (all PRs)

All items below must be confirmed by QA before each PR is merged.

**PR1**
- [ ] Mixed free + paid lines: correct subtotal, tax total, grand total
- [ ] Free item stock deducted at full quantity
- [ ] Free item appears on PDF with "FREE" in rate column
- [ ] Existing invoices unaffected (isFreeItem defaults to false, no UI change)

**PR2**
- [ ] Required document custom field blocks save both in UI and API
- [ ] Custom fields appear on PDF only when showOnInvoice = true
- [ ] Convert document copies custom field values to target
- [ ] Delete field definition cascades to values

**PR3**
- [ ] All 3 pipeline document types: list / create / edit / detail / convert flows working end-to-end
- [ ] ALLOWED_CONVERSIONS respected (no invalid convert options in UI)
- [ ] Converted document is non-editable
- [ ] App.tsx split complete; no route regressions (all existing routes still work)
- [ ] 320px no overflow on list rows

**PR4**
- [ ] Price resolution precedence: PartyPricing > PriceList > Product.salePrice — tested with all three cases
- [ ] pricing.edit permission guards all mutating price list routes
- [ ] Party.defaultPriceListId nullable; SetNull on price list delete
- [ ] Source indicator shown on rate field in invoice form
- [ ] Offline fallback to product.salePrice works without network

---

*End of SCOPE — Phase 5 Epic B: Sales Workflow*
