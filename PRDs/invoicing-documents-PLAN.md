# Mission Plan: Invoicing & Documents | Status: Awaiting Approval

> **PRD:** #3 — Invoicing & Documents
> **Date:** 2026-03-14
> **Owner:** Sawan Jaiswal
> **Phase:** 1C (MVP)
> **Roadmap Features:** #18-#34 (17 features)
> **Depends On:** Party Management (PRD #2), Basic Inventory (PRD #6)
> **Depended On By:** Payment Tracking (PRD #4), Invoice Templates (PRD #5), GST (Phase 2)

---

## 1. What

A unified invoicing and document system that handles 7 document types (Sale Invoice, Purchase Invoice, Estimate, Proforma Invoice, Sale Order, Purchase Order, Delivery Challan) with a shared data structure, document-to-document conversion chains, real-time profit display, auto-sharing via WhatsApp/email, image/PDF export, recycle bin recovery, and configurable invoice numbering — all working offline-first.

**Why this matters:** Invoicing is the core daily action. Indian MSME owners create 20-200 invoices/day. If this is slow, buggy, or incomplete, they leave. Competitors (Vyapar, MyBillBook) lose users on data loss and broken inventory during invoicing. We win by making invoice creation feel instant (< 10 seconds), never losing data (offline-first + recycle bin), and handling the full document lifecycle (estimate to invoice to delivery).

**Performance target:** Invoice creation (open form to saved) in < 10 seconds on a Rs 8,000 Android phone with 2G connectivity.

---

## 2. Domain Model

### 2.1 Document Types

All 7 document types share a common base structure (`Document`) with type-specific behavior.

| Document Type | Code | Affects Stock | Affects Outstanding | Converts To | Direction |
|--------------|------|--------------|-------------------|-------------|-----------|
| Sale Invoice | `SALE_INVOICE` | Decrease | Yes (receivable) | — (terminal) | Outward |
| Purchase Invoice | `PURCHASE_INVOICE` | Increase | Yes (payable) | — (terminal) | Inward |
| Estimate | `ESTIMATE` | No | No | Sale Order, Sale Invoice | Outward |
| Proforma Invoice | `PROFORMA` | No | No | Sale Invoice | Outward |
| Sale Order | `SALE_ORDER` | No | No | Sale Invoice, Delivery Challan | Outward |
| Purchase Order | `PURCHASE_ORDER` | No | No | Purchase Invoice | Inward |
| Delivery Challan | `DELIVERY_CHALLAN` | Decrease | No | Sale Invoice | Outward |

### 2.2 Conversion Chains

```
Estimate ──→ Sale Order ──→ Sale Invoice
   │              │
   │              └──→ Delivery Challan ──→ Sale Invoice
   │
   └──→ Sale Invoice (direct)

Proforma Invoice ──→ Sale Invoice

Purchase Order ──→ Purchase Invoice
```

**Rules:**
- A source document can be converted only once (status changes to `CONVERTED`)
- Converted document links back to source via `sourceDocumentId`
- All line items, charges, and terms copy to the new document (editable before save)
- Partial conversion is NOT supported in Phase 1 (all-or-nothing). Partial fulfillment comes in Phase 5 (#122).

### 2.3 Entity Relationship

```
Business (1) ──→ (N) Document
Document (N) ──→ (1) Party
Document (1) ──→ (N) DocumentLineItem
Document (1) ──→ (N) DocumentAdditionalCharge
Document (1) ──→ (0..1) Document (source, for conversions)
Document (1) ──→ (0..N) DocumentShareLog
DocumentLineItem (N) ──→ (1) Product
Business (1) ──→ (N) DocumentNumberSeries
Business (1) ──→ (N) TermsAndConditionsTemplate
Business (1) ──→ (0..1) DigitalSignature
Document (N) ──→ (0..1) RecycleBinEntry
```

---

## 3. State Machine

### 3.1 Document Lifecycle

```
                    ┌─────────────────────────────────────┐
                    │                                     │
  ┌───────┐    ┌────┴───┐    ┌────────┐    ┌───────────┐ │
  │ DRAFT │───→│ SAVED  │───→│ SHARED │───→│ CONVERTED │ │
  └───┬───┘    └────┬───┘    └────┬───┘    └───────────┘ │
      │             │             │                       │
      │             │             │     (only for non-    │
      │             │             │      terminal docs)   │
      │             ▼             ▼                       │
      │        ┌─────────────────────┐                    │
      └───────→│      DELETED        │────────────────────┘
               │  (Recycle Bin)      │     (restore)
               └─────────┬──────────┘
                         │ 30 days
                         ▼
               ┌─────────────────────┐
               │ PERMANENTLY_DELETED │
               └─────────────────────┘
```

### 3.2 State Definitions

| State | Description | Editable | Can Delete | Can Convert | Can Share |
|-------|-------------|----------|------------|-------------|-----------|
| `DRAFT` | Created but not finalized. Stock NOT deducted. Outstanding NOT updated. | Yes | Yes | No | No |
| `SAVED` | Finalized. Stock deducted (if applicable). Outstanding updated (if applicable). | Yes (creates edit log) | Yes (→ recycle bin) | Yes | Yes |
| `SHARED` | Saved + sent to party via WhatsApp/email. Functionally same as SAVED. | Yes (creates edit log) | Yes (→ recycle bin) | Yes | Yes |
| `CONVERTED` | Source document has been converted to next type. Frozen. | No | No | No | Yes (view only) |
| `DELETED` | In recycle bin. Invisible in normal lists. Stock/outstanding reversed. | No | Yes (permanent) | No | No |
| `PERMANENTLY_DELETED` | Gone forever. Auto-triggered 30 days after DELETED. | No | No | No | No |

### 3.3 Transition Rules

| From | To | Trigger | Side Effects |
|------|----|---------|-------------|
| DRAFT → SAVED | User taps "Save" | Validate line items > 0, assign invoice number, deduct stock (sale invoice / delivery challan), add stock (purchase invoice), update party outstanding (sale/purchase invoice) |
| DRAFT → DELETED | User discards draft | Remove from drafts list, no stock/outstanding change |
| SAVED → SHARED | User shares via WhatsApp/email OR auto-share triggers | Create ShareLog entry, update status |
| SAVED → CONVERTED | User converts to next document type | Freeze source, create new document with copied data, new document starts as DRAFT |
| SHARED → CONVERTED | User converts to next document type | Same as SAVED → CONVERTED |
| SAVED → DELETED | User deletes | Reverse stock changes, reverse outstanding changes, move to recycle bin, set `deletedAt` |
| SHARED → DELETED | User deletes | Same as SAVED → DELETED |
| DELETED → SAVED | User restores from recycle bin | Re-apply stock changes, re-apply outstanding changes, clear `deletedAt` |
| DELETED → PERMANENTLY_DELETED | 30-day cron job OR manual "Empty Bin" | Hard delete from DB (keep audit log entry) |

### 3.4 Edit Rules (for SAVED/SHARED documents)

When editing a saved document:
1. If line items change → recalculate stock delta (reverse old, apply new)
2. If party changes → reverse old party outstanding, apply to new party
3. If amount changes → update party outstanding with delta
4. Log all changes in audit trail: field, old value, new value, userId, timestamp
5. Transaction lock: if document date is older than business lock period (Settings), block edit unless admin unlocks

---

## 4. User Flows

### 4.1 Create Sale Invoice

```
Dashboard → FAB "+" → "Sale Invoice"
    │
    ├─→ [1] Select Party
    │       ├─→ Search bar (name/phone, debounced 300ms)
    │       ├─→ Recent 5 parties shown below search
    │       ├─→ Tap party → selected, show outstanding badge
    │       ├─→ [BRANCH] Over credit limit → yellow warning banner, continue allowed
    │       └─→ [BRANCH] Party not found → "Add New" → inline quick-add (name + phone) → auto-select
    │
    ├─→ [2] Add Line Items
    │       ├─→ "Add Item" button → product search (name, debounced 300ms)
    │       ├─→ Recent 10 products shown
    │       ├─→ Select product → row expands:
    │       │       ├─→ Qty (numeric input, default 1)
    │       │       ├─→ Rate (auto-filled: party-wise price > price list > default price)
    │       │       ├─→ Discount (amount or %, toggle)
    │       │       ├─→ Line Total (auto-calc: qty * rate - discount)
    │       │       └─→ [If role allows] Profit: "(margin: Rs X, Y%)" in green/red
    │       │
    │       ├─→ [BRANCH] Stock insufficient
    │       │       ├─→ If stock validation = WARN → yellow: "Only X in stock"
    │       │       ├─→ If stock validation = BLOCK → red: "Out of stock. Cannot add."
    │       │       └─→ If stock validation = OFF → no warning
    │       │
    │       ├─→ Swipe left on row → delete line item
    │       ├─→ Long press → drag to reorder
    │       └─→ Running total shown at bottom (sticky bar)
    │
    ├─→ [3] Additional Charges (collapsible section, default collapsed)
    │       ├─→ "+ Add Charge" → select type (Shipping/Packaging/Freight/Loading/Insurance/Custom)
    │       ├─→ Enter amount (fixed Rs) or percentage (of subtotal)
    │       └─→ Multiple charges allowed
    │
    ├─→ [4] Invoice Details (collapsible section)
    │       ├─→ Invoice Number: auto-generated (PREFIX-YEAR-SEQ), editable
    │       ├─→ Invoice Date: default today, date picker
    │       ├─→ Due Date: auto-calculated from payment terms, editable
    │       ├─→ Payment Terms: dropdown (COD/7/15/30/60/90 days/Custom)
    │       ├─→ Shipping Address: dropdown if party has multiple
    │       ├─→ Notes: free text
    │       └─→ Terms & Conditions: default from settings, editable per invoice
    │
    ├─→ [5] Invoice Summary (sticky bottom bar)
    │       ├─→ Subtotal: sum of line totals
    │       ├─→ Total Discount: sum of line discounts
    │       ├─→ Additional Charges: sum of charges
    │       ├─→ Round-off: per business settings (nearest 1/0.50/0.10)
    │       ├─→ GRAND TOTAL: large, bold
    │       └─→ [If role allows] Total Profit: "Profit: Rs X (Y%)" — green if positive, red if negative
    │
    ├─→ [6] Save
    │       ├─→ "Save" button → validate → save locally → queue sync
    │       ├─→ Stock deducted atomically
    │       ├─→ Party outstanding updated
    │       ├─→ Invoice number locked (no reuse)
    │       │
    │       └─→ Post-save bottom sheet:
    │               ├─→ "Share on WhatsApp" → generate image/PDF → open WhatsApp
    │               ├─→ "Send Email" → generate PDF → send via Resend
    │               ├─→ "Print" → thermal/A4 based on settings
    │               ├─→ "Record Payment" → payment flow
    │               └─→ "Done" → back to invoice list
    │
    └─→ [BRANCH] Auto-share enabled for this party
            └─→ After save, auto-trigger WhatsApp/email share (no user action needed)
```

**Time budget (< 10 seconds target on slow device):**

| Step | Target Time | How |
|------|------------|-----|
| Open form | < 1s | Pre-render form shell, lazy-load party/product lists |
| Select party | < 2s | IndexedDB search, cached recent parties |
| Add 1 line item | < 3s | IndexedDB product search, cached prices |
| Review totals | < 1s | Client-side calc, no server round-trip |
| Save | < 2s | Save to IndexedDB first, background sync |
| **Total** | **< 9s** | |

### 4.2 Convert Estimate to Sale Invoice

```
Estimates list → Tap estimate → View
    │
    ├─→ "Convert to Invoice" button (bottom)
    │
    ├─→ New Sale Invoice form opens, pre-filled with:
    │       ├─→ Same party
    │       ├─→ Same line items (qty, rate, discount)
    │       ├─→ Same additional charges
    │       ├─→ Same notes and T&C
    │       ├─→ NEW invoice number (auto-generated for Sale Invoice series)
    │       ├─→ Today's date as invoice date
    │       └─→ Due date recalculated from today
    │
    ├─→ User can edit anything before saving
    │
    ├─→ Save → new Sale Invoice created
    │       ├─→ Source Estimate marked as CONVERTED
    │       ├─→ Link: SaleInvoice.sourceDocumentId = Estimate.id
    │       └─→ Estimate shows badge: "Converted to INV-2526-042"
    │
    └─→ [BRANCH] Estimate products now out of stock
            └─→ Stock warnings shown on pre-filled line items (same as normal flow)
```

### 4.3 Share Invoice via WhatsApp

```
Invoice detail → "Share" button (or auto-trigger after save)
    │
    ├─→ Choose format: "Image (recommended)" / "PDF"
    │       ├─→ Image: render invoice template to canvas → export as JPG (< 500KB)
    │       └─→ PDF: render invoice template to PDF (react-pdf)
    │
    ├─→ Preview shown (scrollable)
    │
    ├─→ "Send via WhatsApp" → opens WhatsApp with:
    │       ├─→ Pre-filled message: "Invoice #{number} for Rs {total}\nFrom: {businessName}"
    │       ├─→ Attached: image or PDF file
    │       └─→ Pre-selected contact: party's phone number
    │
    ├─→ Status updated to SHARED
    ├─→ ShareLog created: { channel: 'WHATSAPP', sentAt, documentId }
    │
    └─→ [BRANCH] Offline → "Share will be sent when you're back online"
            └─→ Queued in share queue (separate from sync queue)
```

### 4.4 Recover Deleted Invoice

```
Settings → Recycle Bin (or invoice list → filter "Deleted")
    │
    ├─→ List of deleted documents (last 30 days)
    │       ├─→ Each row: type icon, number, party, total, deleted date, days remaining
    │       └─→ Sort: most recently deleted first
    │
    ├─→ Tap document → preview (read-only)
    │
    ├─→ "Restore" button
    │       ├─→ Confirm: "Restore Invoice #X? Stock and outstanding will be updated."
    │       ├─→ Restore → status back to SAVED
    │       ├─→ Stock re-deducted (sale) / re-added (purchase)
    │       ├─→ Outstanding re-applied
    │       └─→ Toast: "Invoice #X restored"
    │
    ├─→ "Delete Permanently" button
    │       ├─→ Confirm: "Permanently delete Invoice #X? This cannot be undone."
    │       ├─→ Requires PIN (if set)
    │       └─→ Hard delete
    │
    └─→ "Empty Bin" (top-right)
            ├─→ Confirm: "Permanently delete all {N} items? This cannot be undone."
            ├─→ Requires PIN (if set)
            └─→ Hard delete all
```

### 4.5 Create Purchase Invoice

Same flow as Sale Invoice (4.1) with these differences:
- Party search filters to suppliers (type = SUPPLIER or BOTH)
- Stock INCREASES on save instead of decreasing
- Outstanding is payable (we owe them) instead of receivable
- No profit margin display
- No auto-share (configurable, default off for purchases)
- Additional charges are typically: Freight, Loading, Insurance

### 4.6 Create Delivery Challan

```
Dashboard → FAB "+" → "Delivery Challan"
    │
    ├─→ [OPTIONAL] Link to Sale Order
    │       ├─→ "Link to Sale Order" → search/select existing SO
    │       ├─→ Line items pre-filled from SO
    │       └─→ Or skip → standalone challan
    │
    ├─→ Same line item entry as invoice (but NO rate/amount — only qty)
    │       ├─→ Product, Qty only (rates not shown on challan)
    │       └─→ Stock deducted on save
    │
    ├─→ Transport Details (challan-specific)
    │       ├─→ Vehicle Number (optional)
    │       ├─→ Driver Name (optional)
    │       ├─→ Transport Notes (optional)
    │
    ├─→ Save → stock deducted, challan number assigned
    │
    └─→ "Convert to Sale Invoice" available after save
            └─→ Opens Sale Invoice form with rates added
```

---

## 5. API Contract

### 5.1 Base URL

```
/api/v1/businesses/:businessId/documents
```

### 5.2 Document CRUD

#### List Documents

```
GET /api/v1/businesses/:businessId/documents
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `string` | required | `SALE_INVOICE`, `PURCHASE_INVOICE`, `ESTIMATE`, `PROFORMA`, `SALE_ORDER`, `PURCHASE_ORDER`, `DELIVERY_CHALLAN` |
| `status` | `string` | `SAVED,SHARED` | Comma-separated: `DRAFT`, `SAVED`, `SHARED`, `CONVERTED`, `DELETED` |
| `partyId` | `string` | — | Filter by party |
| `fromDate` | `string` (ISO) | — | Document date >= |
| `toDate` | `string` (ISO) | — | Document date <= |
| `search` | `string` | — | Search by document number, party name |
| `page` | `number` | 1 | Pagination |
| `limit` | `number` | 20 | Items per page (max 100) |
| `sortBy` | `string` | `documentDate` | `documentDate`, `createdAt`, `total`, `documentNumber` |
| `sortOrder` | `string` | `desc` | `asc`, `desc` |

**Response:**

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "uuid",
        "type": "SALE_INVOICE",
        "status": "SAVED",
        "documentNumber": "INV-2526-001",
        "documentDate": "2026-03-14T00:00:00.000Z",
        "dueDate": "2026-04-13T00:00:00.000Z",
        "party": {
          "id": "uuid",
          "name": "Rahul Electronics",
          "phone": "9876543210"
        },
        "subtotal": 15000.00,
        "totalDiscount": 500.00,
        "totalAdditionalCharges": 200.00,
        "roundOff": -0.50,
        "grandTotal": 14699.50,
        "totalProfit": 3200.00,
        "paidAmount": 10000.00,
        "balanceDue": 4699.50,
        "lineItemCount": 3,
        "createdAt": "2026-03-14T10:30:00.000Z",
        "updatedAt": "2026-03-14T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "totalPages": 8
    },
    "summary": {
      "totalAmount": 1250000.00,
      "totalPaid": 980000.00,
      "totalDue": 270000.00
    }
  }
}
```

#### Get Single Document

```
GET /api/v1/businesses/:businessId/documents/:documentId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "SALE_INVOICE",
    "status": "SAVED",
    "documentNumber": "INV-2526-001",
    "documentDate": "2026-03-14T00:00:00.000Z",
    "dueDate": "2026-04-13T00:00:00.000Z",
    "paymentTerms": "NET_30",
    "party": {
      "id": "uuid",
      "name": "Rahul Electronics",
      "phone": "9876543210",
      "email": "rahul@example.com",
      "gstin": null,
      "billingAddress": {
        "street": "123 Main Market",
        "city": "Indore",
        "state": "Madhya Pradesh",
        "pincode": "452001"
      },
      "shippingAddress": null,
      "outstandingBalance": 14699.50
    },
    "shippingAddressId": null,
    "lineItems": [
      {
        "id": "uuid",
        "sortOrder": 1,
        "product": {
          "id": "uuid",
          "name": "Samsung Galaxy M34",
          "sku": "SGM34-128",
          "unit": "PCS",
          "currentStock": 12
        },
        "quantity": 2,
        "rate": 8000.00,
        "discountType": "AMOUNT",
        "discountValue": 500.00,
        "discountAmount": 500.00,
        "lineTotal": 15500.00,
        "purchasePrice": 6400.00,
        "profit": 3100.00,
        "profitPercent": 20.0
      }
    ],
    "additionalCharges": [
      {
        "id": "uuid",
        "name": "Shipping",
        "type": "FIXED",
        "value": 200.00,
        "amount": 200.00
      }
    ],
    "subtotal": 15500.00,
    "totalDiscount": 500.00,
    "totalAdditionalCharges": 200.00,
    "roundOff": -0.50,
    "grandTotal": 15199.50,
    "totalProfit": 3100.00,
    "profitPercent": 20.39,
    "notes": "Handle with care",
    "termsAndConditions": "1. Goods once sold will not be returned.\n2. Subject to Indore jurisdiction.",
    "signatureUrl": "https://storage.example.com/signatures/business-uuid.png",
    "sourceDocument": null,
    "convertedTo": null,
    "shareLogs": [
      {
        "id": "uuid",
        "channel": "WHATSAPP",
        "sentAt": "2026-03-14T10:35:00.000Z",
        "recipientPhone": "9876543210"
      }
    ],
    "transportDetails": null,
    "createdBy": { "id": "uuid", "name": "Sawan" },
    "createdAt": "2026-03-14T10:30:00.000Z",
    "updatedAt": "2026-03-14T10:30:00.000Z"
  }
}
```

#### Create Document

```
POST /api/v1/businesses/:businessId/documents
```

**Request Body:**

```json
{
  "type": "SALE_INVOICE",
  "status": "SAVED",
  "partyId": "uuid",
  "documentDate": "2026-03-14",
  "paymentTerms": "NET_30",
  "dueDate": "2026-04-13",
  "shippingAddressId": "uuid | null",
  "notes": "Handle with care",
  "termsAndConditions": "1. Goods once sold...",
  "includeSignature": true,
  "lineItems": [
    {
      "productId": "uuid",
      "quantity": 2,
      "rate": 8000.00,
      "discountType": "AMOUNT",
      "discountValue": 500.00
    },
    {
      "productId": "uuid",
      "quantity": 5,
      "rate": 150.00,
      "discountType": "PERCENTAGE",
      "discountValue": 10
    }
  ],
  "additionalCharges": [
    {
      "name": "Shipping",
      "type": "FIXED",
      "value": 200.00
    },
    {
      "name": "Packaging",
      "type": "PERCENTAGE",
      "value": 2
    }
  ],
  "transportDetails": null
}
```

**Validations:**

| Field | Rule | Error |
|-------|------|-------|
| `type` | Required, one of 7 enum values | `INVALID_DOCUMENT_TYPE` |
| `partyId` | Required, must exist, must belong to business | `PARTY_NOT_FOUND` |
| `lineItems` | Required, min 1, max 100 | `LINE_ITEMS_REQUIRED`, `MAX_LINE_ITEMS_EXCEEDED` |
| `lineItems[].productId` | Must exist, must belong to business | `PRODUCT_NOT_FOUND` |
| `lineItems[].quantity` | Required, > 0, max 6 decimal places | `INVALID_QUANTITY` |
| `lineItems[].rate` | Required, >= 0 (free items allowed), max 2 decimal places | `INVALID_RATE` |
| `lineItems[].discountValue` | >= 0. If PERCENTAGE, <= 100 | `INVALID_DISCOUNT` |
| `additionalCharges[].value` | > 0. If PERCENTAGE, <= 100 | `INVALID_CHARGE` |
| `documentDate` | Required, valid date, not in future (configurable) | `INVALID_DATE` |
| `dueDate` | If provided, must be >= documentDate | `DUE_DATE_BEFORE_INVOICE` |
| Stock check (SALE_INVOICE) | Per business setting (OFF/WARN/BLOCK) | `INSUFFICIENT_STOCK` (only if BLOCK) |
| Credit limit (SALE_INVOICE) | Per party setting | `CREDIT_LIMIT_EXCEEDED` (warning, not blocking) |

**Response:** Same as Get Single Document (201 Created)

**Side Effects on Save (status = SAVED):**

| Document Type | Stock Effect | Outstanding Effect |
|--------------|-------------|-------------------|
| SALE_INVOICE | Decrease each product by qty | Party.outstanding += grandTotal |
| PURCHASE_INVOICE | Increase each product by qty | Party.outstanding -= grandTotal (we owe) |
| DELIVERY_CHALLAN | Decrease each product by qty | None |
| ESTIMATE | None | None |
| PROFORMA | None | None |
| SALE_ORDER | None | None |
| PURCHASE_ORDER | None | None |

#### Update Document

```
PUT /api/v1/businesses/:businessId/documents/:documentId
```

**Request Body:** Same structure as Create. Only provided fields are updated.

**Rules:**
- Cannot update if status is `CONVERTED` or `DELETED`
- If document is locked (older than lock period), returns `DOCUMENT_LOCKED`
- Stock and outstanding deltas recalculated: reverse old values, apply new values
- Creates audit log entry for every changed field

**Response:** Updated document (200 OK)

#### Delete Document (Soft Delete → Recycle Bin)

```
DELETE /api/v1/businesses/:businessId/documents/:documentId
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "DELETED",
    "deletedAt": "2026-03-14T11:00:00.000Z",
    "permanentDeleteAt": "2026-04-13T11:00:00.000Z"
  }
}
```

**Side Effects:**
- Status → DELETED
- Reverse stock changes (if applicable)
- Reverse outstanding changes (if applicable)
- Set `deletedAt` timestamp
- Cannot delete if status is `CONVERTED`

### 5.3 Document Conversion

```
POST /api/v1/businesses/:businessId/documents/:documentId/convert
```

**Request Body:**

```json
{
  "targetType": "SALE_INVOICE"
}
```

**Allowed Conversions:**

| Source Type | Allowed Target Types |
|-----------|---------------------|
| ESTIMATE | SALE_ORDER, SALE_INVOICE |
| PROFORMA | SALE_INVOICE |
| SALE_ORDER | SALE_INVOICE, DELIVERY_CHALLAN |
| PURCHASE_ORDER | PURCHASE_INVOICE |
| DELIVERY_CHALLAN | SALE_INVOICE |

**Response:** New document in DRAFT status (201 Created). Client redirects to edit form for the new document so user can review and save.

**Side Effects:**
- Source document status → CONVERTED
- Source document `convertedToId` → new document ID
- New document `sourceDocumentId` → source document ID
- New document gets NEW document number from its own series
- New document date = today
- All line items, charges, notes, T&C copied

### 5.4 Recycle Bin

```
GET /api/v1/businesses/:businessId/documents/recycle-bin
```

**Query Parameters:** `page`, `limit`, `type` (optional filter)

**Response:** Same as List Documents but only DELETED status.

#### Restore Document

```
POST /api/v1/businesses/:businessId/documents/:documentId/restore
```

**Response:** Restored document (200 OK)

**Side Effects:**
- Status → SAVED
- Re-apply stock changes
- Re-apply outstanding changes
- Clear `deletedAt`

#### Permanent Delete

```
DELETE /api/v1/businesses/:businessId/documents/:documentId/permanent
```

**Headers:** `X-PIN: 1234` (if PIN protection enabled)

**Response:** 204 No Content

#### Empty Recycle Bin

```
DELETE /api/v1/businesses/:businessId/documents/recycle-bin
```

**Headers:** `X-PIN: 1234` (if PIN protection enabled)

**Response:**

```json
{
  "success": true,
  "data": {
    "deletedCount": 15
  }
}
```

### 5.5 Invoice Sharing

#### Share via WhatsApp

```
POST /api/v1/businesses/:businessId/documents/:documentId/share/whatsapp
```

**Request Body:**

```json
{
  "format": "IMAGE",
  "recipientPhone": "9876543210",
  "message": "Invoice #INV-2526-001 for Rs 15,199.50"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "shareLogId": "uuid",
    "fileUrl": "https://storage.example.com/invoices/uuid.jpg",
    "fileSize": 245000,
    "whatsappDeepLink": "https://wa.me/919876543210?text=Invoice..."
  }
}
```

**Note:** On mobile (Capacitor), WhatsApp sharing uses the native share sheet. The API generates the file and returns the URL. The client handles the actual WhatsApp intent.

#### Share via Email

```
POST /api/v1/businesses/:businessId/documents/:documentId/share/email
```

**Request Body:**

```json
{
  "recipientEmail": "rahul@example.com",
  "subject": "Invoice #INV-2526-001 from Sawan Electronics",
  "body": "Dear Rahul,\n\nPlease find attached invoice...",
  "format": "PDF"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "shareLogId": "uuid",
    "emailId": "resend-message-id",
    "sentAt": "2026-03-14T10:35:00.000Z"
  }
}
```

#### Export as Image/PDF

```
GET /api/v1/businesses/:businessId/documents/:documentId/export
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `format` | `string` | `PDF` | `PDF`, `JPG`, `PNG` |
| `templateId` | `string` | business default | Invoice template to use |
| `quality` | `number` | 85 | Image quality (1-100), only for JPG |

**Response:** File binary with appropriate Content-Type header.

**Performance:** Image export must complete in < 3 seconds. Use server-side rendering (Puppeteer/Playwright) for PDF, canvas-based rendering for images on client.

### 5.6 Invoice Numbering

#### Get Next Number

```
GET /api/v1/businesses/:businessId/document-number-series/:type/next
```

**Response:**

```json
{
  "success": true,
  "data": {
    "nextNumber": "INV-2526-042",
    "prefix": "INV",
    "financialYear": "2526",
    "sequence": 42
  }
}
```

#### Configure Number Series

```
PUT /api/v1/businesses/:businessId/document-number-series/:type
```

**Request Body:**

```json
{
  "prefix": "INV",
  "suffix": "",
  "separator": "-",
  "includeFinancialYear": true,
  "financialYearFormat": "SHORT",
  "startingNumber": 1,
  "paddingDigits": 3,
  "resetOnNewYear": true
}
```

**Generates:** `{prefix}{separator}{financialYear}{separator}{paddedSequence}{suffix}`

Example: `INV-2526-001`, `EST-2526-015`, `PO-2526-003`

### 5.7 Document Settings

#### Get/Update Business Document Settings

```
GET /api/v1/businesses/:businessId/settings/documents
PUT /api/v1/businesses/:businessId/settings/documents
```

**Body:**

```json
{
  "defaultPaymentTerms": "NET_30",
  "stockValidation": "WARN",
  "roundOffTo": "NEAREST_1",
  "decimalPlaces": {
    "quantity": 2,
    "rate": 2,
    "amount": 2
  },
  "defaultTermsAndConditions": "1. Goods once sold...\n2. Subject to...",
  "autoShareOnSave": false,
  "autoShareChannel": "WHATSAPP",
  "autoShareFormat": "IMAGE",
  "showProfitOnInvoice": true,
  "allowFutureDates": false,
  "transactionLockDays": 0,
  "recycleBinRetentionDays": 30,
  "defaultAdditionalCharges": [
    { "name": "Shipping", "type": "FIXED", "value": 0 }
  ]
}
```

#### Digital Signature

```
POST /api/v1/businesses/:businessId/settings/signature
```

**Request Body:** `multipart/form-data` with `signature` file (PNG/JPG, max 2MB) or `signatureData` (base64 from draw pad).

```
GET /api/v1/businesses/:businessId/settings/signature
DELETE /api/v1/businesses/:businessId/settings/signature
```

#### Terms & Conditions Templates

```
GET    /api/v1/businesses/:businessId/terms-templates
POST   /api/v1/businesses/:businessId/terms-templates
PUT    /api/v1/businesses/:businessId/terms-templates/:templateId
DELETE /api/v1/businesses/:businessId/terms-templates/:templateId
```

**Body:**

```json
{
  "name": "Standard Sale Terms",
  "content": "1. Goods once sold will not be returned...",
  "isDefault": true,
  "appliesTo": ["SALE_INVOICE", "ESTIMATE", "PROFORMA"]
}
```

---

## 6. Data Model

### 6.1 Prisma Schema

```prisma
// ─── Document (shared base for all 7 types) ───────────────────────

enum DocumentType {
  SALE_INVOICE
  PURCHASE_INVOICE
  ESTIMATE
  PROFORMA
  SALE_ORDER
  PURCHASE_ORDER
  DELIVERY_CHALLAN
}

enum DocumentStatus {
  DRAFT
  SAVED
  SHARED
  CONVERTED
  DELETED
}

enum PaymentTerms {
  COD
  NET_7
  NET_15
  NET_30
  NET_60
  NET_90
  CUSTOM
}

enum DiscountType {
  AMOUNT
  PERCENTAGE
}

enum ChargeType {
  FIXED
  PERCENTAGE
}

enum RoundOffSetting {
  NONE
  NEAREST_1
  NEAREST_050
  NEAREST_010
}

enum StockValidation {
  OFF
  WARN
  BLOCK
}

enum ShareChannel {
  WHATSAPP
  EMAIL
  PRINT
}

enum ExportFormat {
  PDF
  JPG
  PNG
}

model Document {
  id                    String            @id @default(uuid())
  businessId            String
  business              Business          @relation(fields: [businessId], references: [id])

  // ─── Type & Status ──────────────────────
  type                  DocumentType
  status                DocumentStatus    @default(DRAFT)

  // ─── Numbering ──────────────────────────
  documentNumber        String            // e.g., "INV-2526-001"
  sequenceNumber        Int               // The numeric part, e.g., 1
  financialYear         String            // e.g., "2526" (April 2025 - March 2026)

  // ─── Party ──────────────────────────────
  partyId               String
  party                 Party             @relation(fields: [partyId], references: [id])
  shippingAddressId     String?
  shippingAddress       Address?          @relation("DocumentShippingAddress", fields: [shippingAddressId], references: [id])

  // ─── Dates ──────────────────────────────
  documentDate          DateTime          // Invoice/estimate/order date
  dueDate               DateTime?         // Only for SALE_INVOICE, PURCHASE_INVOICE
  paymentTerms          PaymentTerms?     @default(COD)

  // ─── Line Items & Charges ───────────────
  lineItems             DocumentLineItem[]
  additionalCharges     DocumentAdditionalCharge[]

  // ─── Calculated Totals ──────────────────
  subtotal              Decimal           @db.Decimal(12, 2) // Sum of line totals before discount
  totalDiscount         Decimal           @db.Decimal(12, 2) @default(0)
  totalAdditionalCharges Decimal          @db.Decimal(12, 2) @default(0)
  roundOff              Decimal           @db.Decimal(12, 2) @default(0)
  grandTotal            Decimal           @db.Decimal(12, 2)

  // ─── Profit (calculated, stored for query perf) ──
  totalCost             Decimal           @db.Decimal(12, 2) @default(0) // Sum of (qty * purchasePrice) per line
  totalProfit           Decimal           @db.Decimal(12, 2) @default(0) // grandTotal - totalCost - additionalCharges
  profitPercent         Decimal           @db.Decimal(5, 2)  @default(0)

  // ─── Content ────────────────────────────
  notes                 String?           @db.Text
  termsAndConditions    String?           @db.Text
  includeSignature      Boolean           @default(false)

  // ─── Transport (for Delivery Challan) ───
  vehicleNumber         String?
  driverName            String?
  transportNotes        String?

  // ─── Document Conversion Chain ──────────
  sourceDocumentId      String?           @unique
  sourceDocument        Document?         @relation("DocumentConversion", fields: [sourceDocumentId], references: [id])
  convertedTo           Document?         @relation("DocumentConversion")

  // ─── Sharing ────────────────────────────
  shareLogs             DocumentShareLog[]
  autoShareEnabled      Boolean           @default(false)

  // ─── Recycle Bin ────────────────────────
  deletedAt             DateTime?
  deletedBy             String?
  permanentDeleteAt     DateTime?         // deletedAt + 30 days

  // ─── Audit ──────────────────────────────
  createdBy             String
  createdByUser         User              @relation("DocumentCreatedBy", fields: [createdBy], references: [id])
  updatedBy             String?
  updatedByUser         User?             @relation("DocumentUpdatedBy", fields: [updatedBy], references: [id])
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  // ─── Offline Sync ──────────────────────
  clientId              String?           @unique // Client-generated UUID for offline-first dedup
  syncedAt              DateTime?

  @@unique([businessId, type, documentNumber])
  @@index([businessId, type, status])
  @@index([businessId, partyId])
  @@index([businessId, documentDate])
  @@index([businessId, status, deletedAt])
  @@index([permanentDeleteAt])  // For cleanup cron job
}

model DocumentLineItem {
  id                    String            @id @default(uuid())
  documentId            String
  document              Document          @relation(fields: [documentId], references: [id], onDelete: Cascade)

  productId             String
  product               Product           @relation(fields: [productId], references: [id])

  sortOrder             Int               @default(0)

  quantity              Decimal           @db.Decimal(12, 3) // Up to 3 decimal places (0.5 kg etc.)
  rate                  Decimal           @db.Decimal(12, 2)
  discountType          DiscountType      @default(AMOUNT)
  discountValue         Decimal           @db.Decimal(12, 2) @default(0) // The value entered (e.g., 10 for 10% or 10 for Rs 10)
  discountAmount        Decimal           @db.Decimal(12, 2) @default(0) // The calculated discount in Rs

  lineTotal             Decimal           @db.Decimal(12, 2) // (qty * rate) - discountAmount

  // ─── Profit Tracking ────────────────────
  purchasePrice         Decimal           @db.Decimal(12, 2) @default(0) // Snapshot of product's purchase price at time of invoice
  profit                Decimal           @db.Decimal(12, 2) @default(0) // lineTotal - (qty * purchasePrice)
  profitPercent         Decimal           @db.Decimal(5, 2)  @default(0)

  // ─── Stock Tracking ─────────────────────
  stockBefore           Decimal           @db.Decimal(12, 3) @default(0) // Snapshot for audit
  stockAfter            Decimal           @db.Decimal(12, 3) @default(0) // Snapshot for audit

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([documentId])
  @@index([productId])
}

model DocumentAdditionalCharge {
  id                    String            @id @default(uuid())
  documentId            String
  document              Document          @relation(fields: [documentId], references: [id], onDelete: Cascade)

  name                  String            // "Shipping", "Packaging", "Freight", etc.
  type                  ChargeType        @default(FIXED)
  value                 Decimal           @db.Decimal(12, 2) // The entered value
  amount                Decimal           @db.Decimal(12, 2) // Calculated amount in Rs
  sortOrder             Int               @default(0)

  createdAt             DateTime          @default(now())

  @@index([documentId])
}

model DocumentShareLog {
  id                    String            @id @default(uuid())
  documentId            String
  document              Document          @relation(fields: [documentId], references: [id], onDelete: Cascade)

  channel               ShareChannel
  format                ExportFormat      @default(PDF)
  recipientPhone        String?
  recipientEmail        String?
  fileUrl               String?           // URL of generated file
  fileSize              Int?              // Bytes
  message               String?           @db.Text

  sentAt                DateTime          @default(now())
  sentBy                String
  sentByUser            User              @relation(fields: [sentBy], references: [id])

  @@index([documentId])
}

// ─── Invoice Numbering Series ────────────────────────

model DocumentNumberSeries {
  id                    String            @id @default(uuid())
  businessId            String
  business              Business          @relation(fields: [businessId], references: [id])

  documentType          DocumentType
  financialYear         String            // "2526"

  prefix                String            @default("INV") // INV, EST, PRO, SO, PO, DC
  suffix                String            @default("")
  separator             String            @default("-")
  includeFinancialYear  Boolean           @default(true)
  financialYearFormat   String            @default("SHORT") // SHORT = "2526", FULL = "2025-2026"
  paddingDigits         Int               @default(3) // 001, 0001, etc.
  currentSequence       Int               @default(0) // Last used number
  startingNumber        Int               @default(1)
  resetOnNewYear        Boolean           @default(true)

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@unique([businessId, documentType, financialYear])
}

// ─── Default Prefixes ────────────────────────

// SALE_INVOICE      → "INV"
// PURCHASE_INVOICE  → "PUR"
// ESTIMATE          → "EST"
// PROFORMA          → "PRO"
// SALE_ORDER        → "SO"
// PURCHASE_ORDER    → "PO"
// DELIVERY_CHALLAN  → "DC"

// ─── Digital Signature ───────────────────────

model DigitalSignature {
  id                    String            @id @default(uuid())
  businessId            String            @unique
  business              Business          @relation(fields: [businessId], references: [id])

  imageUrl              String            // Stored in object storage
  imageType             String            // "image/png", "image/jpeg"
  fileSize              Int               // Bytes, max 2MB
  uploadedBy            String
  autoApply             Boolean           @default(true) // Auto-include in all invoices

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
}

// ─── Terms & Conditions Templates ────────────

model TermsAndConditionsTemplate {
  id                    String            @id @default(uuid())
  businessId            String
  business              Business          @relation(fields: [businessId], references: [id])

  name                  String            // "Standard Sale Terms", "Warranty Terms"
  content               String            @db.Text
  isDefault             Boolean           @default(false)
  appliesTo             DocumentType[]    // Which document types this template applies to

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([businessId])
}

// ─── Document Settings (per business) ────────

model DocumentSettings {
  id                      String            @id @default(uuid())
  businessId              String            @unique
  business                Business          @relation(fields: [businessId], references: [id])

  defaultPaymentTerms     PaymentTerms      @default(COD)
  stockValidation         StockValidation   @default(WARN)
  roundOffTo              RoundOffSetting   @default(NEAREST_1)

  quantityDecimalPlaces   Int               @default(2) // 2 or 3
  rateDecimalPlaces       Int               @default(2)
  amountDecimalPlaces     Int               @default(2)

  autoShareOnSave         Boolean           @default(false)
  autoShareChannel        ShareChannel      @default(WHATSAPP)
  autoShareFormat         ExportFormat      @default(IMAGE)

  showProfitDuringBilling Boolean           @default(true) // Feature #34
  allowFutureDates        Boolean           @default(false)
  transactionLockDays     Int               @default(0) // 0 = no lock
  recycleBinRetentionDays Int               @default(30)

  createdAt               DateTime          @default(now())
  updatedAt               DateTime          @updatedAt
}
```

### 6.2 IndexedDB Schema (Dexie — Offline)

```typescript
// db.ts — Dexie schema for offline-first

import Dexie, { type Table } from 'dexie';

interface OfflineDocument {
  id: string;           // UUID (client-generated for offline creation)
  serverId?: string;    // Server UUID (populated after first sync)
  businessId: string;
  type: DocumentType;
  status: DocumentStatus;
  documentNumber: string;
  sequenceNumber: number;
  financialYear: string;
  partyId: string;
  documentDate: string; // ISO string
  dueDate?: string;
  paymentTerms?: PaymentTerms;
  shippingAddressId?: string;
  lineItems: OfflineDocumentLineItem[];
  additionalCharges: OfflineDocumentAdditionalCharge[];
  subtotal: number;
  totalDiscount: number;
  totalAdditionalCharges: number;
  roundOff: number;
  grandTotal: number;
  totalCost: number;
  totalProfit: number;
  profitPercent: number;
  notes?: string;
  termsAndConditions?: string;
  includeSignature: boolean;
  vehicleNumber?: string;
  driverName?: string;
  transportNotes?: string;
  sourceDocumentId?: string;
  convertedToId?: string;
  deletedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Sync metadata
  _syncStatus: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete';
  _lastSyncedAt?: string;
  _conflictData?: object;
}

class HisaabDB extends Dexie {
  documents!: Table<OfflineDocument>;
  documentNumberSeries!: Table<OfflineDocumentNumberSeries>;

  constructor() {
    super('hisaab');
    this.version(1).stores({
      documents: 'id, serverId, [businessId+type+status], [businessId+partyId], [businessId+documentDate], [businessId+status+deletedAt], _syncStatus, documentNumber',
      documentNumberSeries: 'id, [businessId+documentType+financialYear]',
    });
  }
}
```

### 6.3 Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Single `Document` table vs per-type tables | Single table with `type` enum | 7 tables would mean 7x CRUD logic, 7x sync logic, 7x offline logic. Shared structure with type-specific behavior handled in service layer. |
| Store calculated totals | Yes (denormalized) | Avoid recalculating on every list query. Recalculate on save/update. |
| Store profit on line items | Yes (snapshot) | Purchase price can change. Need profit at time of sale for accurate reports. |
| Store stock before/after on line items | Yes (snapshot) | Audit trail for stock disputes. "At the time of this invoice, stock was X." |
| Soft delete with recycle bin | Yes (deletedAt + 30-day TTL) | User recovery, competitive feature, prevents accidental data loss. |
| Client-generated UUID | Yes (clientId field) | Offline-first: invoice created offline must have a stable ID before sync. Server deduplicates using clientId. |
| Financial year in number series | April-March (Indian FY) | Standard for Indian businesses. "2526" = April 2025 to March 2026. |

---

## 7. UI States

### 7.1 Document List Screen

| State | Condition | Display |
|-------|-----------|---------|
| **Loading** | Initial fetch or filter change | Skeleton loader: 5 rows with shimmer (document card shape) |
| **Empty — First Time** | No documents of this type ever created | Illustration + "Create your first {type}" CTA button + "What is a {type}?" help link |
| **Empty — Filtered** | Documents exist but filter yields 0 | "No {type} found for this filter" + "Clear Filters" button |
| **Success** | Documents loaded | Card list: each card shows documentNumber, partyName, date, grandTotal, status badge, payment status badge |
| **Error — Network** | API failed, no cached data | "Couldn't load {type}. Check your connection." + "Retry" button |
| **Error — Network (cached)** | API failed, cached data available | Show cached data + yellow banner: "Showing offline data. Some items may be outdated." |
| **Offline** | No network detected | Show full IndexedDB data + "You're offline — all changes saved locally" banner |

**List Card Design (375px mobile):**

```
┌─────────────────────────────────────┐
│ INV-2526-042          14 Mar 2026   │
│ Rahul Electronics                   │
│                                     │
│ ₹15,199.50         ● Partially Paid │
│ 3 items             Due: 13 Apr     │
└─────────────────────────────────────┘
```

**Status badges:** `Draft` (grey), `Saved` (blue), `Shared` (green), `Converted` (purple), `Overdue` (red)

**Payment badges (only for Sale/Purchase Invoice):** `Paid` (green), `Partially Paid` (yellow), `Unpaid` (red), `Overdue` (red, pulsing)

### 7.2 Document Form Screen (Create/Edit)

| State | Condition | Display |
|-------|-----------|---------|
| **Loading** | Opening form for edit (fetching document) | Skeleton form fields |
| **Ready — New** | Creating new document | Empty form, party search focused, invoice number pre-filled |
| **Ready — Edit** | Editing saved document | Pre-filled form, changes highlighted |
| **Ready — Convert** | Converting from another document | Pre-filled from source, banner: "Converting from EST-2526-015" |
| **Saving** | User tapped Save | "Save" button shows spinner, form disabled, "Saving..." text |
| **Save Success** | Saved successfully | Post-save bottom sheet with share/print/payment actions |
| **Save Error — Validation** | Client-side validation failed | Red inline errors under each invalid field, scroll to first error |
| **Save Error — Stock** | Stock insufficient (BLOCK mode) | Modal: "Insufficient stock for {product}. Available: {qty}" with "Edit Quantity" / "Save Anyway" (if admin) |
| **Save Error — Server** | API error on sync | Saved locally + yellow toast: "Saved offline. Will sync when connected." |
| **Duplicate Number** | Invoice number already used | Inline error under number field: "Already used. Suggested: {next}" with "Use Suggested" button |

### 7.3 Document Preview/Detail Screen

| State | Condition | Display |
|-------|-----------|---------|
| **Loading** | Fetching full document | Skeleton: invoice layout shape |
| **Success** | Document loaded | Full invoice render (template-based), action buttons at bottom |
| **Sharing** | User tapped Share | Generating file indicator → WhatsApp/email picker |
| **Share Success** | Shared successfully | Toast: "Sent via WhatsApp" + green check |
| **Share Error** | Share failed | Toast: "Failed to share. Try again." |
| **Converted View** | Document is CONVERTED | Purple banner: "Converted to INV-2526-042" with link to new document |
| **Deleted View** | Viewing from recycle bin | Red banner: "Deleted on {date}. Permanent delete in {N} days." + "Restore" / "Delete Permanently" buttons |

### 7.4 Signature Pad

| State | Condition | Display |
|-------|-----------|---------|
| **Empty** | No signature set | "Draw your signature below" + canvas pad + "Upload Image" alternative |
| **Drawing** | User is drawing | Canvas with stroke, "Clear" / "Save" buttons |
| **Saved** | Signature saved | Preview thumbnail + "Change" / "Remove" buttons |
| **Upload** | User chose upload | File picker (PNG/JPG, max 2MB) → preview → "Save" |

### 7.5 Recycle Bin

| State | Condition | Display |
|-------|-----------|---------|
| **Empty** | No deleted documents | Illustration + "Recycle bin is empty. Deleted invoices appear here for 30 days." |
| **Has Items** | Deleted documents exist | List with "Restore" swipe action per item, "Empty Bin" in top-right |
| **Restoring** | User tapped Restore | Spinner on item + "Restoring..." → Toast: "Restored" |
| **Emptying** | User tapped Empty Bin | Confirm dialog → spinner → "Bin emptied" |

---

## 8. Mobile

### 8.1 Layout Targets

| Screen | Breakpoint | Layout |
|--------|-----------|--------|
| Document List | 375px (iPhone SE) | Single-column card list, FAB bottom-right |
| Document Form | 375px | Single-column, sticky bottom summary bar |
| Document Preview | 375px | Scrollable invoice, sticky bottom action bar |
| Signature Pad | 375px | Full-width canvas, landscape-hint for better drawing |

### 8.2 Invoice Form — Mobile (375px)

```
┌─────────────────────────────────────┐
│ ← Sale Invoice                  ... │  ← Header (48px)
├─────────────────────────────────────┤
│                                     │
│ Customer *                          │
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Search customer...          │ │  ← Autocomplete input
│ └─────────────────────────────────┘ │
│  Recent: Rahul | Priya | Amit       │  ← Quick-select chips
│                                     │
│ ─── Items ──────────────────────── │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Samsung Galaxy M34        ← ×  │ │  ← Item card
│ │ Qty: [2]  Rate: [₹8,000]      │ │
│ │ Disc: [₹500] (Amount ▼)       │ │
│ │              Total: ₹15,500    │ │
│ │         Margin: ₹3,100 (20%)  │ │  ← Green text (if setting on)
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ USB Cable Type-C          ← ×  │ │
│ │ Qty: [5]  Rate: [₹150]        │ │
│ │ Disc: [10] (% ▼)              │ │
│ │              Total: ₹675       │ │
│ │         Margin: ₹375 (55.6%)  │ │
│ └─────────────────────────────────┘ │
│                                     │
│  [+ Add Item]                       │
│                                     │
│ ▶ Additional Charges (collapsed)    │  ← Expandable section
│ ▶ Invoice Details (collapsed)       │  ← Contains number, date, terms
│ ▶ Notes & T&C (collapsed)          │  ← Expandable section
│                                     │
├─────────────────────────────────────┤
│ Subtotal            ₹16,175.00      │  ← Sticky bottom bar
│ Discount              -₹575.00      │
│ Charges               +₹200.00      │
│ Round-off               -₹0.50      │
│ ──────────────────────────────────  │
│ TOTAL               ₹15,799.50      │  ← Bold, large
│ Profit: ₹3,475.00 (22.0%)          │  ← Green (if setting on)
│                                     │
│ ┌───────────┐  ┌──────────────────┐ │
│ │ Save Draft │  │    Save & Share  │ │  ← Two CTAs
│ └───────────┘  └──────────────────┘ │
└─────────────────────────────────────┘
```

### 8.3 Touch Targets & Gestures

| Element | Min Size | Gesture |
|---------|---------|---------|
| Line item card | 72px height | Tap to expand/edit, swipe left to delete |
| Qty/Rate input | 44px height | Tap to focus, numeric keyboard auto-opens |
| Product search result | 48px height | Tap to select |
| Party chip (recent) | 36px height | Tap to select |
| FAB (new invoice) | 56px diameter | Tap to create |
| Save button | 48px height, full width | Tap to save |
| Discount toggle (Amount/%) | 32px height | Tap to toggle |

### 8.4 Keyboard Handling

- Qty field: `inputmode="decimal"` — shows numeric keyboard with decimal
- Rate field: `inputmode="decimal"` — same
- Discount field: `inputmode="decimal"` — same
- Phone/search: `inputmode="text"` — standard keyboard
- "Enter" on qty field → focus moves to rate → discount → next item
- "Done" on last field → scroll to summary

### 8.5 Performance on Low-End Devices

| Concern | Solution |
|---------|----------|
| Form render time | Lazy-load collapsible sections, render line items with virtual list if > 20 |
| Product search | IndexedDB query with prefix index, limit 10 results, debounce 300ms |
| Party search | Same as product search |
| Total calculation | Pure client-side math, no re-render of entire form — only summary bar |
| Image export | Canvas-based on client (no server round-trip), compress to < 500KB |
| PDF export | React-PDF for client-side, Puppeteer fallback on server for complex templates |
| Offline save | IndexedDB write < 50ms, no network dependency |

---

## 9. Edge Cases

### 9.1 Invoice Numbering

| Edge Case | Handling |
|-----------|---------|
| Two users create invoice simultaneously offline | Both get same sequence number from local counter → on sync, server detects duplicate → reassigns second one to next available number → client receives corrected number |
| Financial year boundary (March 31 → April 1) | At 12:00 AM on April 1, new series starts. If user creates invoice at 11:59 PM on March 31 offline and syncs on April 1, invoice date determines the series (March 31 = old FY). |
| User manually enters a used number | Inline validation checks IndexedDB first (instant), server checks on sync. If conflict, auto-suggest next. |
| User changes prefix mid-year | Only affects new invoices. Existing invoices keep old prefix. |
| Sequence gap (deleted invoice) | Numbers are not reused. Gap is acceptable. INV-2526-041, INV-2526-043 is fine. |

### 9.2 Stock

| Edge Case | Handling |
|-----------|---------|
| Stock goes negative (validation OFF) | Allowed. Stock shows negative in inventory. Alert triggered. |
| Stock goes negative (validation WARN) | Warning shown. User can override. Stock goes negative. |
| Stock goes negative (validation BLOCK) | Blocked. User must reduce quantity or add stock first. |
| Edit saved invoice — change qty from 5 to 3 | Delta: +2 (return 2 to stock). Atomic operation: reverse old (add 5), apply new (deduct 3). |
| Edit saved invoice — remove line item | Reverse stock for that item (add qty back). |
| Edit saved invoice — change product | Reverse stock for old product, deduct stock for new product. |
| Delete invoice → restore from recycle bin | Delete: reverse all stock. Restore: re-apply all stock. If stock insufficient on restore, WARN (not block). |
| Product deleted after invoice created | Product cannot be hard-deleted if referenced in any non-deleted document. Soft-delete only. Invoice shows product name (denormalized/snapshot). |

### 9.3 Document Conversion

| Edge Case | Handling |
|-----------|---------|
| Convert estimate where product price changed since estimate | New invoice uses CURRENT price (editable). User sees difference. |
| Convert estimate where product was deleted | Line item shows product name (from snapshot) with "Product no longer available" warning. User can remove or replace. |
| Convert estimate where party was deleted | Cannot convert. Show: "Customer no longer exists. Reactivate or update the estimate." |
| Double-convert attempt (race condition) | Server checks source status. If already CONVERTED, return error: "Already converted to {documentNumber}". |
| Convert then delete the new document | Source document remains CONVERTED (does not revert). Manual unlink required via edit. |

### 9.4 Offline & Sync

| Edge Case | Handling |
|-----------|---------|
| Create invoice offline, same party creates invoice on another device | Both saved. On sync, both get unique numbers from server. No conflict on data — only number reassignment. |
| Edit same invoice on two devices offline | Conflict detected on sync. Show both versions. User picks "Keep mine" / "Keep theirs". Default: last-write-wins after 24h. |
| Delete on device A, edit on device B, both offline | Conflict: delete wins (safer). Edited version available in recycle bin. |
| 1000+ invoices pending sync after long offline | Background sync in batches of 50. Progress indicator. No UI blocking. |
| Server rejects sync (validation changed) | Keep in local queue, mark as "sync error". Show red badge on document. User can fix and retry. |

### 9.5 Sharing

| Edge Case | Handling |
|-----------|---------|
| WhatsApp not installed | Show toast: "WhatsApp not installed. Share as image or email instead." Fallback to native share sheet. |
| Email sending fails (Resend API error) | Toast: "Email failed. Retry?" Queue for retry. Log in ShareLog with error status. |
| Large invoice (50+ items) → huge image | Paginate the image (multi-page) or switch to PDF automatically if image > 1MB. |
| Party has no phone or email | Share button shows available options only. If no phone, WhatsApp option greyed out. If no email, email option greyed out. |
| Auto-share enabled but offline | Queue share for when online. Show badge: "Will be shared when connected." |

### 9.6 Recycle Bin

| Edge Case | Handling |
|-----------|---------|
| Restore invoice with same number now used | Restored invoice keeps its original number. If server detects conflict on sync, append "-R" suffix. |
| Restore invoice for deleted party | Cannot restore. Show: "Customer {name} has been deleted. Reactivate customer first." |
| 30-day cron misses (server downtime) | On next cron run, delete all items where permanentDeleteAt < now. Idempotent. |
| Recycle bin has 500+ items | Paginated (20 per page). Bulk "Empty Bin" runs in background job. |

---

## 10. Constraints

### 10.1 Limits

| Constraint | Limit | Reason |
|-----------|-------|--------|
| Max line items per document | 100 | Performance. PDF/image render time grows linearly. 100 items @ 3s is the max. |
| Max additional charges per document | 10 | UI space. More is rarely needed. |
| Max documents in recycle bin | 500 | Storage. Older items auto-permanently-deleted if limit hit. |
| Digital signature file size | 2 MB | Storage + render speed. PNG/JPG only. |
| Invoice image export max size | 1 MB | WhatsApp sharing limit is ~16MB but < 1MB is optimal for 2G. |
| PDF generation timeout | 10 seconds | Server-side Puppeteer. Fall back to simpler template if timeout. |
| Offline document queue | 1000 pending syncs | Beyond this, force sync before allowing new creation. |
| Document number max length | 30 characters | DB field size. PREFIX(10) + SEP(1) + YEAR(4) + SEP(1) + SEQ(6) + SUFFIX(8). |
| Notes max length | 2000 characters | Practical limit. Longer notes → use T&C section. |
| Terms & conditions max length | 5000 characters | Sufficient for detailed terms. |
| Terms templates per business | 20 | UI manageable. |
| Financial year series | Auto-created on first invoice of new FY | No manual creation needed. |

### 10.2 Performance SLAs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Invoice form open | < 1 second | Time from tap to interactive form (375px Android, 2G) |
| Product search results | < 300ms | Time from keystroke to results rendered |
| Invoice save (local) | < 500ms | Time from tap Save to confirmation toast |
| Invoice save (server sync) | < 3 seconds | Background, non-blocking |
| Invoice image export | < 3 seconds | Time from tap Share to image ready |
| Invoice PDF export | < 5 seconds | Server-side Puppeteer |
| Document list load | < 1 second | First 20 items rendered from IndexedDB |
| Recycle bin restore | < 1 second | Including stock/outstanding reversal |

### 10.3 Data Integrity

| Rule | Enforcement |
|------|-------------|
| Invoice number uniqueness | DB unique constraint: `(businessId, type, documentNumber)` |
| Stock atomicity | Prisma transaction: save document + update stock in single transaction |
| Outstanding atomicity | Prisma transaction: save document + update party balance in single transaction |
| Audit trail immutability | Audit log entries are append-only, no update/delete |
| Offline dedup | `clientId` unique constraint: if server receives document with existing clientId, return existing document (idempotent) |

---

## 11. Out of Scope

| Feature | Phase | Why Deferred |
|---------|-------|-------------|
| **GST (CGST/SGST/IGST)** | Phase 2 | Separate tax engine. All invoices in Phase 1 are non-GST. GST adds tax lines, HSN codes, place of supply. |
| **Credit Notes / Debit Notes** | Phase 2 (#80) | Returns are a tax-domain feature. Phase 1 handles returns via manual stock adjustment + payment reversal. |
| **Double-entry accounting journal** | Phase 3 (#83) | Phase 1 invoices update party outstanding (simple ledger). Full debit/credit entries come with accounting module. |
| **Partial fulfillment** | Phase 5 (#122) | Converting Estimate → Invoice is all-or-nothing. Partial (5 of 10 items) needs fulfillment tracking. |
| **Barcode scanning on line items** | Phase 4 (#106) | Requires camera integration. Phase 1 uses text search. |
| **Multi-godown stock selection** | Phase 4 (#109) | Phase 1 has single stock per product. Multi-location stock comes later. |
| **Recurring invoices** | Phase 2 (#82) | Requires scheduler/cron infrastructure. Phase 1 is manual creation. |
| **Custom fields on invoices** | Phase 5 (#134) | Dynamic fields need schema-less storage or EAV pattern. Phase 1 uses fixed schema. |
| **Batch/serial number selection** | Phase 4 (#107, #108) | Stock tracking in Phase 1 is aggregate quantity. Batch/serial is per-unit tracking. |
| **Multi-currency** | Phase 2 (#81) | All amounts in INR for Phase 1. |
| **E-invoicing / E-way bill** | Phase 2 (#71, #72) | Government API integration. Depends on GST engine. |
| **Invoice template customization** | PRD #5 | Separate PRD for templates, fonts, colors, column toggles. Phase 1 uses 1 default template. |
| **Bulk import of invoices** | Phase 4 (#112) | Excel import for migration. Phase 1 supports manual entry + opening balances. |
| **Free item quantity (buy X get Y)** | Phase 5 (#133) | Promotional feature, not core billing. |
| **Multiple price lists** | Phase 5 (#132) | Phase 1 has party-wise pricing. Named price lists (MRP, dealer, export) come later. |

---

## 12. Build Plan

### 12.1 File Structure

```
backend/
├── src/
│   ├── modules/
│   │   └── documents/
│   │       ├── document.routes.ts          # Express routes
│   │       ├── document.controller.ts      # Request handling, validation
│   │       ├── document.service.ts         # Business logic (CRUD, stock, outstanding)
│   │       ├── document.validators.ts      # Zod schemas for request validation
│   │       ├── document-number.service.ts  # Invoice numbering logic
│   │       ├── document-convert.service.ts # Conversion chain logic
│   │       ├── document-share.service.ts   # WhatsApp/email/export logic
│   │       ├── document-recycle.service.ts # Recycle bin logic
│   │       ├── document-profit.service.ts  # Profit calculation logic
│   │       ├── document.types.ts           # TypeScript interfaces
│   │       └── __tests__/
│   │           ├── document.service.test.ts
│   │           ├── document-number.test.ts
│   │           ├── document-convert.test.ts
│   │           ├── document-share.test.ts
│   │           └── document-recycle.test.ts
│   │
│   ├── modules/
│   │   └── settings/
│   │       ├── document-settings.routes.ts
│   │       ├── document-settings.controller.ts
│   │       ├── document-settings.service.ts
│   │       ├── signature.routes.ts
│   │       ├── signature.controller.ts
│   │       ├── signature.service.ts
│   │       ├── terms-template.routes.ts
│   │       ├── terms-template.controller.ts
│   │       └── terms-template.service.ts
│   │
│   └── jobs/
│       └── recycle-bin-cleanup.job.ts      # Cron: permanent delete after 30 days

frontend/
├── src/
│   ├── modules/
│   │   └── documents/
│   │       ├── pages/
│   │       │   ├── DocumentListPage.tsx         # List view for any document type
│   │       │   ├── DocumentFormPage.tsx          # Create/Edit form (shared for all types)
│   │       │   ├── DocumentDetailPage.tsx        # View/Preview document
│   │       │   └── RecycleBinPage.tsx            # Recycle bin
│   │       │
│   │       ├── components/
│   │       │   ├── DocumentCard.tsx              # List item card
│   │       │   ├── PartySelector.tsx             # Party search + quick-add
│   │       │   ├── LineItemEditor.tsx            # Single line item row
│   │       │   ├── LineItemList.tsx              # List of line items with add/remove
│   │       │   ├── AdditionalChargesEditor.tsx   # Charges section
│   │       │   ├── InvoiceSummaryBar.tsx         # Sticky bottom totals bar
│   │       │   ├── ProfitDisplay.tsx             # Profit margin display (per-line + total)
│   │       │   ├── DocumentNumberField.tsx       # Auto-generated number with edit
│   │       │   ├── PaymentTermsSelector.tsx      # COD/7/15/30/60/90/Custom
│   │       │   ├── PostSaveSheet.tsx             # Bottom sheet after save
│   │       │   ├── ShareFormatPicker.tsx         # Image/PDF/WhatsApp/Email picker
│   │       │   ├── ConvertButton.tsx             # Convert to next document type
│   │       │   ├── StatusBadge.tsx               # Document status badge
│   │       │   ├── PaymentStatusBadge.tsx        # Paid/Partial/Unpaid badge
│   │       │   ├── RecycleBinItem.tsx            # Recycle bin list item
│   │       │   └── TransportDetailsSection.tsx   # Vehicle/driver (for Delivery Challan)
│   │       │
│   │       ├── hooks/
│   │       │   ├── useDocuments.ts               # List query with filters
│   │       │   ├── useDocument.ts                # Single document query
│   │       │   ├── useDocumentForm.ts            # Form state management
│   │       │   ├── useDocumentMutations.ts       # Create/update/delete mutations
│   │       │   ├── useDocumentNumber.ts          # Get next number
│   │       │   ├── useDocumentConvert.ts         # Conversion logic
│   │       │   ├── useDocumentShare.ts           # Share via WhatsApp/email
│   │       │   ├── useRecycleBin.ts              # Recycle bin operations
│   │       │   ├── useInvoiceCalculations.ts     # Real-time totals + profit calc
│   │       │   └── useProductSearch.ts           # Product search for line items
│   │       │
│   │       ├── services/
│   │       │   ├── document.api.ts               # API client (fetch + offline queue)
│   │       │   ├── document.offline.ts           # IndexedDB CRUD
│   │       │   ├── document-export.ts            # Image/PDF generation (client-side)
│   │       │   └── document-calc.ts              # Pure calculation functions (shared)
│   │       │
│   │       └── types/
│   │           └── document.types.ts             # Shared TypeScript types
│   │
│   ├── modules/
│   │   └── settings/
│   │       ├── pages/
│   │       │   ├── DocumentSettingsPage.tsx
│   │       │   ├── SignaturePage.tsx
│   │       │   └── TermsTemplatesPage.tsx
│   │       │
│   │       └── components/
│   │           ├── SignaturePad.tsx               # Draw + upload signature
│   │           ├── NumberSeriesConfig.tsx         # Configure prefix/suffix/format
│   │           └── TermsTemplateEditor.tsx        # CRUD for T&C templates
│   │
│   └── shared/
│       └── components/
│           └── SignatureCanvas.tsx                # Reusable signature drawing canvas
```

### 12.2 Build Batches

| Batch | Files | Depends On | Est. Days | Description |
|-------|-------|-----------|-----------|-------------|
| **B1: Data Model** | Prisma schema (enums, Document, DocumentLineItem, DocumentAdditionalCharge, DocumentShareLog, DocumentNumberSeries, DigitalSignature, TermsAndConditionsTemplate, DocumentSettings), migration | Party model, Product model (PRD #2, #6) | 1 | Database foundation |
| **B2: Numbering Service** | `document-number.service.ts`, tests | B1 | 1 | Auto-increment with prefix/suffix, FY series, reset logic |
| **B3: Core CRUD API** | `document.routes.ts`, `document.controller.ts`, `document.service.ts`, `document.validators.ts`, `document.types.ts`, tests | B1, B2 | 3 | Create, read, update, list with filters + pagination. Stock deduction. Outstanding update. Profit calculation. All in Prisma transactions. |
| **B4: Conversion API** | `document-convert.service.ts`, tests | B3 | 1 | Convert between document types. Copy line items/charges. Update source status. |
| **B5: Recycle Bin API** | `document-recycle.service.ts`, `recycle-bin-cleanup.job.ts`, tests | B3 | 1 | Soft delete, restore, permanent delete, 30-day cleanup cron |
| **B6: Sharing API** | `document-share.service.ts`, tests | B3 | 1 | WhatsApp deep link generation, email via Resend, image/PDF export (server-side) |
| **B7: Settings API** | `document-settings.*`, `signature.*`, `terms-template.*` (routes, controllers, services) | B1 | 1 | Document settings CRUD, signature upload/draw, T&C templates CRUD |
| **B8: Offline Layer** | `document.offline.ts`, Dexie schema, sync queue integration | B3 | 2 | IndexedDB CRUD, sync queue for create/update/delete, conflict detection, client-generated UUIDs |
| **B9: Calculation Engine** | `document-calc.ts`, `useInvoiceCalculations.ts` | — | 1 | Pure functions: line totals, discounts, charges, round-off, profit. Shared between client and test suite. |
| **B10: Document Form UI** | `DocumentFormPage.tsx`, `PartySelector.tsx`, `LineItemEditor.tsx`, `LineItemList.tsx`, `AdditionalChargesEditor.tsx`, `InvoiceSummaryBar.tsx`, `ProfitDisplay.tsx`, `DocumentNumberField.tsx`, `PaymentTermsSelector.tsx`, `useDocumentForm.ts`, `useDocumentMutations.ts`, `useDocumentNumber.ts`, `useProductSearch.ts` | B3, B8, B9 | 4 | The main invoice creation form. Most complex UI in the app. |
| **B11: Document List UI** | `DocumentListPage.tsx`, `DocumentCard.tsx`, `StatusBadge.tsx`, `PaymentStatusBadge.tsx`, `useDocuments.ts` | B3, B8 | 1 | List page with filters, search, pagination, status badges |
| **B12: Document Detail UI** | `DocumentDetailPage.tsx`, `PostSaveSheet.tsx`, `ConvertButton.tsx`, `useDocument.ts`, `useDocumentConvert.ts` | B3, B4, B8 | 1 | View/preview, post-save actions, conversion trigger |
| **B13: Sharing UI** | `ShareFormatPicker.tsx`, `useDocumentShare.ts`, `document-export.ts` (client-side image/PDF) | B6 | 2 | Image generation (canvas), PDF generation (react-pdf), WhatsApp intent, email trigger |
| **B14: Recycle Bin UI** | `RecycleBinPage.tsx`, `RecycleBinItem.tsx`, `useRecycleBin.ts` | B5, B8 | 1 | Recycle bin list, restore, permanent delete, empty bin |
| **B15: Settings UI** | `DocumentSettingsPage.tsx`, `SignaturePage.tsx`, `SignaturePad.tsx`, `SignatureCanvas.tsx`, `TermsTemplatesPage.tsx`, `TermsTemplateEditor.tsx`, `NumberSeriesConfig.tsx` | B7 | 2 | Settings pages, signature pad (draw + upload), T&C editor, number series config |
| **B16: Delivery Challan Specifics** | `TransportDetailsSection.tsx`, challan-specific form logic | B10 | 0.5 | Transport details (vehicle, driver) — small addition to shared form |
| **B17: Integration Testing** | E2E tests for full flows | All | 2 | Create → share → convert → delete → restore. Offline create → sync. Stock validation. Number uniqueness. |

### 12.3 Batch Dependency Graph

```
B1 (Schema)
 ├─→ B2 (Numbering) ──→ B3 (Core CRUD)
 ├─→ B7 (Settings API) ──→ B15 (Settings UI)
 │                         B3 ──→ B4 (Conversion) ──→ B12 (Detail UI)
 │                         B3 ──→ B5 (Recycle Bin) ──→ B14 (Recycle UI)
 │                         B3 ──→ B6 (Sharing)     ──→ B13 (Sharing UI)
 │                         B3 ──→ B8 (Offline)     ──→ B10 (Form UI)
 │                                                     B11 (List UI)
 B9 (Calc Engine) ────────────────────────────────────→ B10 (Form UI)
 B10 + B16 (Challan specifics)
 All ──→ B17 (Integration Testing)
```

### 12.4 Total Estimate

| Category | Days |
|----------|------|
| Backend (B1-B7) | 9 |
| Offline (B8) | 2 |
| Frontend (B9-B16) | 12.5 |
| Testing (B17) | 2 |
| **Total** | **25.5 days** |

Buffer (20%): ~5 days → **~30 working days (6 weeks)**

---

## 13. Acceptance Criteria

### 13.1 Core Billing

- [ ] User can create a Sale Invoice with at least 1 line item in under 10 seconds on a 375px Android device
- [ ] Invoice auto-calculates: line totals (qty * rate - discount), subtotal, additional charges (fixed + percentage), round-off, grand total
- [ ] All calculations match manual calculation (zero rounding errors — test with 50+ scenarios)
- [ ] Invoice number auto-generated with correct format (PREFIX-YEAR-SEQ), unique per business + type + number
- [ ] Saving a Sale Invoice atomically deducts stock for all line items
- [ ] Saving a Sale Invoice atomically updates party outstanding balance
- [ ] Saving a Purchase Invoice atomically increases stock and updates party payable balance
- [ ] User can create all 7 document types: Sale Invoice, Purchase Invoice, Estimate, Proforma, Sale Order, Purchase Order, Delivery Challan

### 13.2 Line Items & Charges

- [ ] User can add up to 100 line items per invoice
- [ ] Product rate auto-fills from: (1) party-wise price, (2) default price — in that priority
- [ ] Discount supports both Amount (Rs) and Percentage (%) modes per line item
- [ ] Additional charges support both Fixed (Rs) and Percentage (of subtotal) modes
- [ ] Up to 10 additional charges per invoice with custom names
- [ ] Round-off applies per business setting (nearest 1/0.50/0.10/none)

### 13.3 Profit Display (Feature #34)

- [ ] Each line item shows: purchase price, profit amount (Rs), profit percentage — in green if positive, red if negative
- [ ] Invoice summary shows total profit and profit percentage
- [ ] Profit display respects role permissions (hidden from salesperson if setting is off)
- [ ] Profit calculation uses snapshot of purchase price at time of invoice creation

### 13.4 Document Conversion

- [ ] Estimate converts to Sale Order and Sale Invoice
- [ ] Proforma converts to Sale Invoice
- [ ] Sale Order converts to Sale Invoice and Delivery Challan
- [ ] Purchase Order converts to Purchase Invoice
- [ ] Delivery Challan converts to Sale Invoice
- [ ] Source document is frozen (CONVERTED status) after conversion
- [ ] Converted document links back to source, and source links forward to converted
- [ ] All line items, charges, notes, T&C copy correctly to new document
- [ ] A document cannot be converted twice (error shown)

### 13.5 Invoice Numbering (Feature #25)

- [ ] Each document type has its own number series with independent sequence
- [ ] Format: PREFIX-FINANCIALYEAR-PADDEDSEQUENCE (e.g., INV-2526-001)
- [ ] User can customize prefix, suffix, separator, padding, starting number
- [ ] Series auto-resets on new financial year (April 1) if setting enabled
- [ ] Duplicate numbers are prevented (DB constraint + client-side check)
- [ ] Offline-created invoices get provisional numbers, corrected on sync if needed

### 13.6 Sharing (Features #30, #31, #32)

- [ ] Invoice exports as JPG image (< 500KB, optimized for WhatsApp sharing)
- [ ] Invoice exports as PDF
- [ ] WhatsApp share opens WhatsApp with pre-filled message and image/PDF attached
- [ ] Email share sends PDF attachment via configured email service
- [ ] Auto-share on save works when enabled (per business setting, configurable per party)
- [ ] Share logs recorded for each share action
- [ ] Document status updates to SHARED after first share

### 13.7 Due Dates & Payment Terms (Feature #27)

- [ ] Payment terms dropdown: COD, 7, 15, 30, 60, 90 days, Custom
- [ ] Due date auto-calculates from invoice date + payment terms
- [ ] Due date is editable (override auto-calculation)
- [ ] Overdue invoices (past due date, unpaid) show red "Overdue" badge in list

### 13.8 Terms & Conditions (Feature #28)

- [ ] Business can create multiple T&C templates with names
- [ ] Default T&C auto-applies to new invoices (per document type)
- [ ] T&C editable per individual invoice (override default)
- [ ] Max 5000 characters per T&C

### 13.9 Digital Signature (Feature #29)

- [ ] User can draw signature on canvas (touch-optimized)
- [ ] User can upload signature image (PNG/JPG, max 2MB)
- [ ] Signature auto-applied to invoices when enabled
- [ ] Signature visible on exported PDF/image
- [ ] Signature can be changed or removed

### 13.10 Recycle Bin (Feature #33)

- [ ] Deleting a document moves it to recycle bin (soft delete)
- [ ] Deleted document's stock changes are reversed
- [ ] Deleted document's outstanding changes are reversed
- [ ] Recycle bin shows documents for last 30 days
- [ ] User can restore deleted document (stock + outstanding re-applied)
- [ ] User can permanently delete from recycle bin (requires PIN if set)
- [ ] "Empty Bin" permanently deletes all items (requires PIN if set)
- [ ] Auto-cleanup cron permanently deletes items older than 30 days
- [ ] CONVERTED documents cannot be deleted

### 13.11 Offline

- [ ] Invoice creation works fully offline (saved to IndexedDB)
- [ ] Invoice editing works fully offline
- [ ] Invoice deletion works fully offline
- [ ] All offline changes sync automatically when connection is restored
- [ ] Offline-created invoices appear immediately in document list
- [ ] Stock is updated locally (IndexedDB) for offline invoices
- [ ] Sync conflicts are detected and presented to user for resolution
- [ ] No data is lost during offline periods of up to 7 days

### 13.12 Stock Validation (Feature #46 dependency)

- [ ] Stock validation setting: OFF (no check), WARN (warning, allow override), BLOCK (prevent save)
- [ ] Warning/block fires at line item level when qty > available stock
- [ ] Stock check uses IndexedDB (instant, works offline)
- [ ] Stock deduction is atomic with invoice save (no partial deduction)

### 13.13 Performance

- [ ] Invoice form opens in < 1 second on 375px Android (IndexedDB, no server)
- [ ] Product search returns results in < 300ms
- [ ] Invoice save (local) completes in < 500ms
- [ ] Image export completes in < 3 seconds
- [ ] Document list loads first 20 items in < 1 second
- [ ] Form works smoothly with 20+ line items (no jank on scroll)

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] Domain model validated (7 document types, conversion chains)
- [ ] State machine validated (all transitions, side effects)
- [ ] API contract validated (all endpoints, request/response formats)
- [ ] Data model validated (Prisma schema, IndexedDB schema)
- [ ] Mobile UI validated (375px layouts, touch targets)
- [ ] Edge cases reviewed (stock, numbering, offline, sharing)
- [ ] Out of scope agreed (GST, accounting, partial fulfillment)
- [ ] Build plan estimated and batched
- [ ] Acceptance criteria complete and testable
